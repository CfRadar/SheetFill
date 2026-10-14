"""Authentication routes and shared FastAPI security dependencies."""

import asyncio
from datetime import datetime, timedelta, timezone
import logging
from typing import Any, Dict, Optional
import uuid
from bson import ObjectId
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from pydantic import BaseModel, Field

from app.activity import log_event
from app.cache import (
    get_cached_session,
    invalidate_session,
    invalidate_user_sessions,
    set_cached_session,
)
from app.config import settings
from app.db import get_db, is_db_connected
from app.security import (
    create_access_token,
    decode_access_token,
    get_client_ip,
    get_client_user_agent,
    verify_password,
)

logger = logging.getLogger("sheetfill.auth")
router = APIRouter(prefix="/api/auth", tags=["auth"])


class CurrentUser(BaseModel):
    id: str
    username: str
    role: str = "user"
    display_name: str
    access_expires_at: Optional[datetime] = None
    session_id: str


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1, max_length=128)
    device_id: Optional[str] = Field(None, max_length=128)


class LoginResponse(BaseModel):
    token: str
    expires_at: str
    access_expires_at: Optional[str] = None
    days_left: Optional[int] = None
    username: str
    display_name: str
    role: str


class MeResponse(BaseModel):
    user_id: str
    username: str
    display_name: str
    role: str
    is_active: bool
    access_expires_at: Optional[str] = None
    days_left: Optional[int] = None
    session_id: str


def _auth_error(status_code: int, code: str, message: str, details: Any = None) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "details": details},
    )


# --------------------------------------------------------------------------
# Rate Limiting Helper
# --------------------------------------------------------------------------
async def _check_rate_limit(key: str) -> None:
    """Checks if the IP+username bucket is locked out (5 failures within 15 min)."""
    if not is_db_connected():
        return
    db = get_db()
    rec = await db.login_attempts.find_one({"key": key})
    if rec and rec.get("locked_until"):
        locked_until = rec["locked_until"]
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        if now < locked_until:
            rem_sec = int((locked_until - now).total_seconds())
            raise _auth_error(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "RATE_LIMITED",
                f"Too many failed login attempts. Try again in {rem_sec} seconds.",
                {"retry_after_seconds": rem_sec},
            )


async def _record_login_failure(key: str, ip: str, username: str) -> None:
    """Records a failed attempt and locks out after 5 consecutive strikes."""
    if not is_db_connected():
        return
    db = get_db()
    now = datetime.now(timezone.utc)
    rec = await db.login_attempts.find_one({"key": key})

    if not rec:
        await db.login_attempts.insert_one(
            {
                "key": key,
                "ip_address": ip,
                "username": username.lower().strip(),
                "attempt_count": 1,
                "first_attempt_at": now,
                "last_attempt_at": now,
                "locked_until": None,
                "expires_at": now + timedelta(minutes=15),
            }
        )
    else:
        new_count = rec.get("attempt_count", 0) + 1
        locked_until = None
        if new_count >= 5:
            locked_until = now + timedelta(minutes=15)
        await db.login_attempts.update_one(
            {"key": key},
            {
                "$set": {
                    "attempt_count": new_count,
                    "last_attempt_at": now,
                    "locked_until": locked_until,
                    "expires_at": now + timedelta(minutes=15),
                }
            },
        )


async def _clear_login_failures(key: str) -> None:
    """Resets rate limit counter on successful authentication."""
    if not is_db_connected():
        return
    try:
        db = get_db()
        await db.login_attempts.delete_one({"key": key})
    except Exception:
        pass


# --------------------------------------------------------------------------
# Routes: Login, Logout, Me
# --------------------------------------------------------------------------
@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest, request: Request, response: Response) -> LoginResponse:
    ip = get_client_ip(request)
    ua = get_client_user_agent(request)
    clean_username = req.username.strip().lower()
    rate_key = f"{ip}:{clean_username}"

    # 1. Rate limit check
    await _check_rate_limit(rate_key)

    if not is_db_connected():
        raise _auth_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "DATABASE_UNAVAILABLE",
            "Authentication service is starting up. Please try again in a few moments.",
        )

    db = get_db()
    user = await db.users.find_one({"username": clean_username})

    # 2. Verify password (generic error on missing user or invalid password)
    if not user or not verify_password(req.password, user.get("password_hash", "")):
        await _record_login_failure(rate_key, ip, clean_username)
        log_event("login_failed", username=clean_username, ip=ip, user_agent=ua)
        raise _auth_error(
            status.HTTP_401_UNAUTHORIZED,
            "INVALID_CREDENTIALS",
            "Invalid username or password.",
        )

    # Reset rate limit counter on valid credentials
    await _clear_login_failures(rate_key)

    # 3. Check account status & subscription expiry
    if not user.get("is_active", True):
        log_event("access_denied_disabled", str(user["_id"]), clean_username, ip, ua)
        raise _auth_error(
            status.HTTP_403_FORBIDDEN,
            "ACCOUNT_DISABLED",
            "Your account has been deactivated. Please contact administrator.",
        )

    now = datetime.now(timezone.utc)
    access_exp: Optional[datetime] = user.get("access_expires_at")
    if access_exp:
        if access_exp.tzinfo is None:
            access_exp = access_exp.replace(tzinfo=timezone.utc)
        if now >= access_exp:
            log_event("access_denied_expired", str(user["_id"]), clean_username, ip, ua)
            raise _auth_error(
                status.HTTP_403_FORBIDDEN,
                "ACCOUNT_EXPIRED",
                f"Your subscription expired on {access_exp.strftime('%Y-%m-%d %H:%M UTC')}. Please contact owner to renew.",
                {"expired_at": access_exp.isoformat()},
            )

    uid = str(user["_id"])

    # 4. Single-Device Policy enforcement
    if settings.session_policy == "block":
        # Check if an existing session was active in the last 10 minutes
        existing = await db.sessions.find_one(
            {"user_id": ObjectId(uid), "revoked": False, "expires_at": {"$gt": now}}
        )
        if existing:
            last_seen = existing.get("last_seen_at", existing.get("created_at", now))
            if last_seen.tzinfo is None:
                last_seen = last_seen.replace(tzinfo=timezone.utc)
            if (now - last_seen).total_seconds() < 600:
                raise _auth_error(
                    status.HTTP_409_CONFLICT,
                    "ALREADY_ACTIVE",
                    "This account is currently active on another device. Please log out there first.",
                )
            else:
                # Idle session: revoke
                await db.sessions.update_one(
                    {"_id": existing["_id"]},
                    {"$set": {"revoked": True, "revoked_reason": "replaced"}},
                )
                invalidate_session(existing["session_id"])
    else:
        # Default policy: "replace" -> revoke all existing active sessions of this user
        cursor = db.sessions.find({"user_id": ObjectId(uid), "revoked": False})
        async for s_doc in cursor:
            invalidate_session(s_doc["session_id"])
            log_event(
                "session_replaced",
                user_id=uid,
                username=clean_username,
                ip=ip,
                user_agent=ua,
                session_id=s_doc["session_id"],
            )
        await db.sessions.update_many(
            {"user_id": ObjectId(uid), "revoked": False},
            {"$set": {"revoked": True, "revoked_reason": "replaced"}},
        )
        invalidate_user_sessions(uid)

    # 5. Compute token expiration
    # token_expiry = min(ACCESS_TOKEN_MINUTES, time left until access_expires_at)
    max_token_exp = now + timedelta(minutes=settings.access_token_minutes)
    if access_exp and access_exp < max_token_exp:
        session_exp = access_exp
    else:
        session_exp = max_token_exp

    sid = str(uuid.uuid4())
    device_id = req.device_id or str(uuid.uuid4())

    # 6. Insert new session document
    session_doc = {
        "session_id": sid,
        "user_id": ObjectId(uid),
        "device_id": device_id,
        "user_agent": ua,
        "ip": ip,
        "created_at": now,
        "last_seen_at": now,
        "expires_at": session_exp,
        "revoked": False,
        "revoked_reason": None,
    }
    await db.sessions.insert_one(session_doc)

    # Update user last_login_at
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"last_login_at": now}})

    # Cache the fresh session
    set_cached_session(
        sid,
        {
            "user_id": uid,
            "username": clean_username,
            "display_name": user.get("display_name", clean_username),
            "role": user.get("role", "user"),
            "revoked": False,
            "revoked_reason": None,
            "expires_at": session_exp,
            "user_active": True,
            "access_expires_at": access_exp,
            "last_seen_update": now,
        },
    )

    # 7. Issue signed JWT
    token = create_access_token(
        user_id=uid,
        session_id=sid,
        role=user.get("role", "user"),
        expires_at=session_exp,
    )

    # Set secure cookie
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.env == "production",
        max_age=int((session_exp - now).total_seconds()),
    )

    days_left = None
    if access_exp:
        days_left = max(0, (access_exp - now).days)

    log_event("login_success", uid, clean_username, ip, ua, session_id=sid)

    return LoginResponse(
        token=token,
        expires_at=session_exp.isoformat(),
        access_expires_at=access_exp.isoformat() if access_exp else None,
        days_left=days_left,
        username=clean_username,
        display_name=user.get("display_name", clean_username),
        role=user.get("role", "user"),
    )


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    authorization: Optional[str] = Header(None),
) -> Dict[str, str]:
    token = _extract_token(request, authorization)
    if token:
        payload = decode_access_token(token)
        if payload and "sid" in payload:
            sid = payload["sid"]
            invalidate_session(sid)
            if is_db_connected():
                try:
                    db = get_db()
                    await db.sessions.update_one(
                        {"session_id": sid},
                        {"$set": {"revoked": True, "revoked_reason": "logout"}},
                    )
                except Exception:
                    pass
            log_event(
                "logout",
                user_id=payload.get("sub"),
                username=payload.get("sub", "unknown"),
                ip=get_client_ip(request),
                user_agent=get_client_user_agent(request),
                session_id=sid,
            )

    response.delete_cookie(key="access_token")
    return {"status": "ok", "message": "Successfully logged out."}




# --------------------------------------------------------------------------
# Shared Security Dependencies
# --------------------------------------------------------------------------
def _extract_token(request: Request, authorization: Optional[str]) -> Optional[str]:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return request.cookies.get("access_token")


async def require_user(
    request: Request,
    authorization: Optional[str] = Header(None),
) -> CurrentUser:
    """Shared FastAPI dependency verifying active user, session record, and subscription."""
    token = _extract_token(request, authorization)
    if not token:
        raise _auth_error(
            status.HTTP_401_UNAUTHORIZED,
            "NOT_AUTHENTICATED",
            "Authentication credentials were not provided.",
        )

    payload = decode_access_token(token)
    if not payload:
        raise _auth_error(
            status.HTTP_401_UNAUTHORIZED,
            "TOKEN_EXPIRED",
            "Your access token has expired or is invalid. Please sign in again.",
        )

    uid = payload["sub"]
    sid = payload["sid"]
    role = payload.get("role", "user")
    now = datetime.now(timezone.utc)

    # 1. Check in-memory cache
    cached = get_cached_session(sid)
    if cached:
        if cached.get("revoked", False):
            reason = cached.get("revoked_reason")
            code = "SESSION_REPLACED" if reason == "replaced" else "SESSION_REVOKED"
            msg = (
                "You were logged out because this account was logged into from another device."
                if reason == "replaced"
                else "Session has been revoked."
            )
            raise _auth_error(status.HTTP_401_UNAUTHORIZED, code, msg)

        if not cached.get("user_active", True):
            raise _auth_error(
                status.HTTP_403_FORBIDDEN,
                "ACCOUNT_DISABLED",
                "Your account has been deactivated.",
            )

        # Access expiry check is ALWAYS validated against now, even on cache hit
        acc_exp: Optional[datetime] = cached.get("access_expires_at")
        if acc_exp:
            if acc_exp.tzinfo is None:
                acc_exp = acc_exp.replace(tzinfo=timezone.utc)
            if now >= acc_exp:
                raise _auth_error(
                    status.HTTP_403_FORBIDDEN,
                    "ACCOUNT_EXPIRED",
                    "Your subscription has expired. Please contact owner to renew.",
                )

        # Periodic update of last_seen_at (at most once every 60 seconds)
        last_update: Optional[datetime] = cached.get("last_seen_update")
        if not last_update or (now - last_update).total_seconds() > 60:
            cached["last_seen_update"] = now
            if is_db_connected():
                try:
                    db = get_db()
                    asyncio.create_task(
                        db.sessions.update_one(
                            {"session_id": sid},
                            {"$set": {"last_seen_at": now}},
                        )
                    )
                except Exception:
                    pass

        return CurrentUser(
            id=uid,
            username=cached.get("username", uid),
            role=cached.get("role", role),
            display_name=cached.get("display_name", cached.get("username", uid)),
            access_expires_at=acc_exp,
            session_id=sid,
        )

    # 2. Cache miss -> query MongoDB
    if not is_db_connected():
        raise _auth_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "DATABASE_UNAVAILABLE",
            "Database connection temporarily unavailable.",
        )

    db = get_db()
    s_doc = await db.sessions.find_one({"session_id": sid})
    if not s_doc or s_doc.get("revoked", False):
        reason = s_doc.get("revoked_reason") if s_doc else "revoked"
        code = "SESSION_REPLACED" if reason == "replaced" else "SESSION_REVOKED"
        msg = (
            "You were logged out because this account was logged into from another device."
            if reason == "replaced"
            else "Session has been revoked."
        )
        raise _auth_error(status.HTTP_401_UNAUTHORIZED, code, msg)

    u_doc = await db.users.find_one({"_id": ObjectId(uid)})
    if not u_doc:
        raise _auth_error(status.HTTP_401_UNAUTHORIZED, "USER_NOT_FOUND", "User not found.")

    if not u_doc.get("is_active", True):
        raise _auth_error(
            status.HTTP_403_FORBIDDEN,
            "ACCOUNT_DISABLED",
            "Your account has been deactivated.",
        )

    acc_exp = u_doc.get("access_expires_at")
    if acc_exp:
        if acc_exp.tzinfo is None:
            acc_exp = acc_exp.replace(tzinfo=timezone.utc)
        if now >= acc_exp:
            raise _auth_error(
                status.HTTP_403_FORBIDDEN,
                "ACCOUNT_EXPIRED",
                "Your subscription has expired. Please contact owner to renew.",
            )

    # Save to cache
    set_cached_session(
        sid,
        {
            "user_id": uid,
            "username": u_doc.get("username", uid),
            "display_name": u_doc.get("display_name", u_doc.get("username", uid)),
            "role": u_doc.get("role", role),
            "revoked": False,
            "revoked_reason": None,
            "expires_at": s_doc.get("expires_at"),
            "user_active": True,
            "access_expires_at": acc_exp,
            "last_seen_update": now,
        },
    )

    return CurrentUser(
        id=uid,
        username=u_doc.get("username", uid),
        role=u_doc.get("role", role),
        display_name=u_doc.get("display_name", u_doc.get("username", uid)),
        access_expires_at=acc_exp,
        session_id=sid,
    )


async def require_admin(
    user: CurrentUser = Depends(require_user),
) -> CurrentUser:
    """Dependency verifying the caller is authenticated as an admin."""
    if user.role != "admin":
        raise _auth_error(
            status.HTTP_403_FORBIDDEN,
            "FORBIDDEN",
            "Administrative privileges are required for this endpoint.",
        )
    return user


@router.get("/me", response_model=MeResponse)
async def get_me(user: CurrentUser = Depends(require_user)) -> MeResponse:
    """Returns profile and subscription expiry details for the current user."""
    now = datetime.now(timezone.utc)
    days_left = None
    if user.access_expires_at:
        days_left = max(0, (user.access_expires_at - now).days)

    return MeResponse(
        user_id=user.id,
        username=user.username,
        display_name=user.display_name,
        role=user.role,
        is_active=True,
        access_expires_at=user.access_expires_at.isoformat() if user.access_expires_at else None,
        days_left=days_left,
        session_id=user.session_id,
    )
