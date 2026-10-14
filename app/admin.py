"""Admin router and management APIs for subscriber accounts, access duration, and audit logs."""

from datetime import datetime, timedelta, timezone
import logging
import re
import time
from typing import Any, Dict, List, Optional
import uuid
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, Field
from pymongo import ReturnDocument

from app.activity import log_event
from app.auth import CurrentUser, _auth_error, get_client_ip, get_client_user_agent, require_admin
from app.cache import invalidate_user_sessions
from app.config import settings
from app.db import get_db, is_db_connected
from app.security import (
    constant_time_compare,
    create_access_token,
    hash_password,
    verify_password,
)

logger = logging.getLogger("sheetfill.admin")
router = APIRouter(prefix="/api/admin", tags=["admin"])

# 15s in-memory cache for admin dashboard KPI stats
_stats_cache: Dict[str, Any] = {"data": None, "expires_at": 0.0}

USERNAME_REGEX = re.compile(r"^[a-zA-Z0-9_.-]{3,32}$")


# --------------------------------------------------------------------------
# Schemas
# --------------------------------------------------------------------------
class AdminLoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1, max_length=128)


class AdminLoginResponse(BaseModel):
    token: str
    expires_at: str
    username: str
    role: str = "admin"


class CreateUserRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=32)
    password: str = Field(..., min_length=4, max_length=128)
    display_name: Optional[str] = Field(None, max_length=64)
    duration_days: Optional[int] = Field(None, ge=1, le=3650)
    access_expires_at: Optional[datetime] = None
    notes: Optional[str] = Field(None, max_length=500)


class UpdateUserRequest(BaseModel):
    password: Optional[str] = Field(None, min_length=4, max_length=128)
    display_name: Optional[str] = Field(None, max_length=64)
    is_active: Optional[bool] = None
    notes: Optional[str] = Field(None, max_length=500)
    extension: Optional[str] = Field(None, pattern=r"^\+(7d|30d|90d|180d|365d)$")
    access_expires_at: Optional[datetime] = None


class UserItemResponse(BaseModel):
    id: str
    username: str
    display_name: str
    role: str
    is_active: bool
    status: str  # "active" | "expired" | "disabled"
    access_expires_at: Optional[str]
    days_left: Optional[int]
    created_at: str
    last_login_at: Optional[str]
    notes: Optional[str]
    is_online: bool = False


class UsersListResponse(BaseModel):
    items: List[UserItemResponse]
    total: int
    page: int
    limit: int
    total_pages: int


class AdminStatsResponse(BaseModel):
    total_users: int
    active_subscriptions: int
    expiring_soon: int
    expired: int
    online_now: int
    logins_today: int


# --------------------------------------------------------------------------
# Admin Login (DEPRECATED: in favor of unified POST /api/auth/login)
# --------------------------------------------------------------------------
@router.post("/login", response_model=AdminLoginResponse)
async def admin_login(req: AdminLoginRequest, request: Request, response: Response) -> AdminLoginResponse:
    ip = get_client_ip(request)
    ua = get_client_user_agent(request)
    clean_username = req.username.strip()

    # Compare username and password against configured admin credentials
    username_match = constant_time_compare(clean_username, settings.admin_username)
    password_match = verify_password(req.password, settings.admin_password_hash)

    if not (username_match and password_match):
        log_event("admin_login_failed", username=clean_username, ip=ip, user_agent=ua)
        raise _auth_error(
            status.HTTP_401_UNAUTHORIZED,
            "INVALID_CREDENTIALS",
            "Invalid administrative credentials.",
        )

    if not is_db_connected():
        raise _auth_error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "DATABASE_UNAVAILABLE",
            "Database connection temporarily unavailable.",
        )

    db = get_db()
    now = datetime.now(timezone.utc)
    # Ensure admin user record exists in users collection
    admin_doc = await db.users.find_one_and_update(
        {"username": settings.admin_username, "role": "admin"},
        {
            "$setOnInsert": {
                "created_at": now,
            },
            "$set": {
                "password_hash": settings.admin_password_hash,
                "role": "admin",
                "is_active": True,
                "display_name": "Administrator",
                "access_expires_at": None,
                "updated_at": now,
                "last_login_at": now,
            },
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )

    uid = str(admin_doc["_id"])
    sid = str(uuid.uuid4())
    session_exp = now + timedelta(hours=2)

    # Insert admin session doc
    session_doc = {
        "session_id": sid,
        "user_id": ObjectId(uid),
        "device_id": str(uuid.uuid4()),
        "user_agent": ua,
        "ip": ip,
        "created_at": now,
        "last_seen_at": now,
        "expires_at": session_exp,
        "revoked": False,
        "revoked_reason": None,
    }
    await db.sessions.insert_one(session_doc)

    token = create_access_token(
        user_id=uid,
        session_id=sid,
        role="admin",
        expires_at=session_exp,
    )

    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.env == "production",
        max_age=7200,
    )

    log_event("admin_login_success", user_id=uid, username=settings.admin_username, ip=ip, user_agent=ua, session_id=sid)

    return AdminLoginResponse(
        token=token,
        expires_at=session_exp.isoformat(),
        username=settings.admin_username,
        role="admin",
    )


# --------------------------------------------------------------------------
# Subscriber Management Endpoints (require_admin)
# --------------------------------------------------------------------------
@router.get("/users", response_model=UsersListResponse)
async def list_users(
    search: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin: CurrentUser = Depends(require_admin),
) -> UsersListResponse:
    if not is_db_connected():
        raise _auth_error(status.HTTP_503_SERVICE_UNAVAILABLE, "DATABASE_UNAVAILABLE", "Database unavailable.")

    db = get_db()
    query: Dict[str, Any] = {"role": "user"}
    now = datetime.now(timezone.utc)

    if search:
        s_clean = search.strip()
        query["$or"] = [
            {"username": {"$regex": re.escape(s_clean), "$options": "i"}},
            {"display_name": {"$regex": re.escape(s_clean), "$options": "i"}},
            {"notes": {"$regex": re.escape(s_clean), "$options": "i"}},
        ]

    if status_filter == "disabled":
        query["is_active"] = False
    elif status_filter == "expired":
        query["is_active"] = True
        query["access_expires_at"] = {"$lte": now}
    elif status_filter == "active":
        query["is_active"] = True
        query["$or"] = [
            {"access_expires_at": None},
            {"access_expires_at": {"$gt": now}},
        ]

    total = await db.users.count_documents(query)
    skip = (page - 1) * limit
    cursor = db.users.find(query).sort("created_at", -1).skip(skip).limit(limit)

    users_list = await cursor.to_list(length=limit)

    # Check which users are online right now (seen in last 5m)
    five_min_ago = now - timedelta(minutes=5)
    active_sessions = await db.sessions.find(
        {"revoked": False, "last_seen_at": {"$gte": five_min_ago}},
        {"user_id": 1},
    ).to_list(length=1000)
    online_uids = {str(s["user_id"]) for s in active_sessions if "user_id" in s}

    items: List[UserItemResponse] = []
    for u in users_list:
        uid = str(u["_id"])
        is_active = u.get("is_active", True)
        acc_exp = u.get("access_expires_at")
        days_left = None

        if acc_exp:
            if acc_exp.tzinfo is None:
                acc_exp = acc_exp.replace(tzinfo=timezone.utc)
            days_left = max(0, (acc_exp - now).days)
            if not is_active:
                u_status = "disabled"
            elif now >= acc_exp:
                u_status = "expired"
            else:
                u_status = "active"
        else:
            u_status = "disabled" if not is_active else "active"

        created_at_dt = u.get("created_at", now)
        if hasattr(created_at_dt, "isoformat"):
            created_str = created_at_dt.isoformat()
        else:
            created_str = str(created_at_dt)

        last_login_dt = u.get("last_login_at")
        last_login_str = last_login_dt.isoformat() if last_login_dt else None

        items.append(
            UserItemResponse(
                id=uid,
                username=u.get("username", ""),
                display_name=u.get("display_name", u.get("username", "")),
                role=u.get("role", "user"),
                is_active=is_active,
                status=u_status,
                access_expires_at=acc_exp.isoformat() if acc_exp else None,
                days_left=days_left,
                created_at=created_str,
                last_login_at=last_login_str,
                notes=u.get("notes"),
                is_online=uid in online_uids,
            )
        )

    total_pages = (total + limit - 1) // limit if total > 0 else 1
    return UsersListResponse(
        items=items,
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages,
    )


@router.post("/users", response_model=UserItemResponse)
async def create_user(
    req: CreateUserRequest,
    request: Request,
    admin: CurrentUser = Depends(require_admin),
) -> UserItemResponse:
    clean_username = req.username.strip().lower()
    if constant_time_compare(clean_username, settings.admin_username.strip().lower()):
        raise _auth_error(
            status.HTTP_409_CONFLICT,
            "RESERVED_USERNAME",
            "This username is reserved and cannot be used for subscriber accounts.",
        )

    if not USERNAME_REGEX.match(clean_username):
        raise _auth_error(
            status.HTTP_400_BAD_REQUEST,
            "INVALID_USERNAME",
            "Username must be 3-32 characters, lowercase alphanumeric or '.' and '_'.",
        )

    if not is_db_connected():
        raise _auth_error(status.HTTP_503_SERVICE_UNAVAILABLE, "DATABASE_UNAVAILABLE", "Database unavailable.")

    db = get_db()
    existing = await db.users.find_one({"username": clean_username})
    if existing:
        raise _auth_error(
            status.HTTP_409_CONFLICT,
            "USER_EXISTS",
            f"User with username '{clean_username}' already exists.",
        )

    now = datetime.now(timezone.utc)
    access_exp: Optional[datetime] = None

    if req.duration_days:
        access_exp = now + timedelta(days=req.duration_days)
    elif req.access_expires_at:
        access_exp = req.access_expires_at
        if access_exp.tzinfo is None:
            access_exp = access_exp.replace(tzinfo=timezone.utc)
    else:
        # Default: 30 days
        access_exp = now + timedelta(days=30)

    pwd_hash = hash_password(req.password)
    doc = {
        "username": clean_username,
        "password_hash": pwd_hash,
        "role": "user",
        "display_name": req.display_name or clean_username,
        "is_active": True,
        "access_expires_at": access_exp,
        "notes": req.notes,
        "created_at": now,
        "updated_at": now,
        "created_by": ObjectId(admin.id),
        "last_login_at": None,
    }
    result = await db.users.insert_one(doc)
    uid = str(result.inserted_id)

    log_event(
        "user_created",
        user_id=admin.id,
        username=admin.username,
        ip=get_client_ip(request),
        user_agent=get_client_user_agent(request),
        meta={"new_user_id": uid, "new_username": clean_username, "expires_at": access_exp.isoformat()},
    )

    days_left = max(0, (access_exp - now).days) if access_exp else None

    return UserItemResponse(
        id=uid,
        username=clean_username,
        display_name=req.display_name or clean_username,
        role="user",
        is_active=True,
        status="active",
        access_expires_at=access_exp.isoformat() if access_exp else None,
        days_left=days_left,
        created_at=now.isoformat(),
        last_login_at=None,
        notes=req.notes,
        is_online=False,
    )


@router.patch("/users/{uid}", response_model=UserItemResponse)
async def update_user(
    uid: str,
    req: UpdateUserRequest,
    request: Request,
    admin: CurrentUser = Depends(require_admin),
) -> UserItemResponse:
    if not ObjectId.is_valid(uid):
        raise _auth_error(status.HTTP_400_BAD_REQUEST, "INVALID_ID", "Invalid user ID.")

    if not is_db_connected():
        raise _auth_error(status.HTTP_503_SERVICE_UNAVAILABLE, "DATABASE_UNAVAILABLE", "Database unavailable.")

    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(uid), "role": "user"})
    if not user:
        raise _auth_error(status.HTTP_404_NOT_FOUND, "USER_NOT_FOUND", "Subscriber not found.")

    now = datetime.now(timezone.utc)
    updates: Dict[str, Any] = {"updated_at": now}
    need_session_invalidation = False

    if req.display_name is not None:
        updates["display_name"] = req.display_name.strip()

    if req.notes is not None:
        updates["notes"] = req.notes.strip()

    if req.is_active is not None:
        updates["is_active"] = req.is_active
        need_session_invalidation = True

    if req.password:
        updates["password_hash"] = hash_password(req.password)
        need_session_invalidation = True

    current_exp = user.get("access_expires_at")
    if req.extension:
        # e.g. +7d, +30d, +90d, +180d, +365d
        days_to_add = int(req.extension.lstrip("+").rstrip("d"))
        base_time = max(now, current_exp) if current_exp else now
        new_exp = base_time + timedelta(days=days_to_add)
        updates["access_expires_at"] = new_exp
        need_session_invalidation = True
    elif req.access_expires_at is not None:
        exp = req.access_expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        updates["access_expires_at"] = exp
        need_session_invalidation = True

    updated_user = await db.users.find_one_and_update(
        {"_id": ObjectId(uid)},
        {"$set": updates},
        return_document=ReturnDocument.AFTER,
    )

    if need_session_invalidation:
        invalidate_user_sessions(uid)
        # If disabled or password changed, revoke DB sessions
        if req.is_active is False or req.password:
            await db.sessions.update_many(
                {"user_id": ObjectId(uid), "revoked": False},
                {"$set": {"revoked": True, "revoked_reason": "admin_revocation"}},
            )

    log_event(
        "user_updated",
        user_id=admin.id,
        username=admin.username,
        ip=get_client_ip(request),
        user_agent=get_client_user_agent(request),
        meta={"target_user_id": uid, "updated_fields": list(updates.keys())},
    )

    acc_exp = updated_user.get("access_expires_at")
    is_active = updated_user.get("is_active", True)
    days_left = None
    if acc_exp:
        if acc_exp.tzinfo is None:
            acc_exp = acc_exp.replace(tzinfo=timezone.utc)
        days_left = max(0, (acc_exp - now).days)
        if not is_active:
            status_str = "disabled"
        elif now >= acc_exp:
            status_str = "expired"
        else:
            status_str = "active"
    else:
        status_str = "disabled" if not is_active else "active"

    return UserItemResponse(
        id=uid,
        username=updated_user.get("username", ""),
        display_name=updated_user.get("display_name", ""),
        role="user",
        is_active=is_active,
        status=status_str,
        access_expires_at=acc_exp.isoformat() if acc_exp else None,
        days_left=days_left,
        created_at=updated_user.get("created_at", now).isoformat(),
        last_login_at=updated_user.get("last_login_at").isoformat() if updated_user.get("last_login_at") else None,
        notes=updated_user.get("notes"),
        is_online=False,
    )


@router.post("/users/{uid}/disable")
async def disable_user(
    uid: str,
    request: Request,
    admin: CurrentUser = Depends(require_admin),
) -> Dict[str, str]:
    if not ObjectId.is_valid(uid):
        raise _auth_error(status.HTTP_400_BAD_REQUEST, "INVALID_ID", "Invalid user ID.")

    if not is_db_connected():
        raise _auth_error(status.HTTP_503_SERVICE_UNAVAILABLE, "DATABASE_UNAVAILABLE", "Database unavailable.")

    db = get_db()
    res = await db.users.update_one({"_id": ObjectId(uid), "role": "user"}, {"$set": {"is_active": False}})
    if res.matched_count == 0:
        raise _auth_error(status.HTTP_404_NOT_FOUND, "USER_NOT_FOUND", "Subscriber not found.")

    await db.sessions.update_many(
        {"user_id": ObjectId(uid), "revoked": False},
        {"$set": {"revoked": True, "revoked_reason": "disabled"}},
    )
    invalidate_user_sessions(uid)

    log_event(
        "user_disabled",
        user_id=admin.id,
        username=admin.username,
        ip=get_client_ip(request),
        user_agent=get_client_user_agent(request),
        meta={"target_user_id": uid},
    )

    return {"status": "ok", "message": "User account deactivated."}


@router.post("/users/{uid}/enable")
async def enable_user(
    uid: str,
    request: Request,
    admin: CurrentUser = Depends(require_admin),
) -> Dict[str, str]:
    if not ObjectId.is_valid(uid):
        raise _auth_error(status.HTTP_400_BAD_REQUEST, "INVALID_ID", "Invalid user ID.")

    if not is_db_connected():
        raise _auth_error(status.HTTP_503_SERVICE_UNAVAILABLE, "DATABASE_UNAVAILABLE", "Database unavailable.")

    db = get_db()
    res = await db.users.update_one({"_id": ObjectId(uid), "role": "user"}, {"$set": {"is_active": True}})
    if res.matched_count == 0:
        raise _auth_error(status.HTTP_404_NOT_FOUND, "USER_NOT_FOUND", "Subscriber not found.")

    invalidate_user_sessions(uid)

    log_event(
        "user_enabled",
        user_id=admin.id,
        username=admin.username,
        ip=get_client_ip(request),
        user_agent=get_client_user_agent(request),
        meta={"target_user_id": uid},
    )

    return {"status": "ok", "message": "User account re-enabled."}


@router.post("/users/{uid}/force-logout")
async def force_logout(
    uid: str,
    request: Request,
    admin: CurrentUser = Depends(require_admin),
) -> Dict[str, str]:
    if not ObjectId.is_valid(uid):
        raise _auth_error(status.HTTP_400_BAD_REQUEST, "INVALID_ID", "Invalid user ID.")

    if not is_db_connected():
        raise _auth_error(status.HTTP_503_SERVICE_UNAVAILABLE, "DATABASE_UNAVAILABLE", "Database unavailable.")

    db = get_db()
    await db.sessions.update_many(
        {"user_id": ObjectId(uid), "revoked": False},
        {"$set": {"revoked": True, "revoked_reason": "admin_force_logout"}},
    )
    invalidate_user_sessions(uid)

    log_event(
        "user_force_logged_out",
        user_id=admin.id,
        username=admin.username,
        ip=get_client_ip(request),
        user_agent=get_client_user_agent(request),
        meta={"target_user_id": uid},
    )

    return {"status": "ok", "message": "All user sessions terminated."}


@router.delete("/users/{uid}")
async def delete_user(
    uid: str,
    request: Request,
    admin: CurrentUser = Depends(require_admin),
) -> Dict[str, str]:
    if not ObjectId.is_valid(uid):
        raise _auth_error(status.HTTP_400_BAD_REQUEST, "INVALID_ID", "Invalid user ID.")

    if not is_db_connected():
        raise _auth_error(status.HTTP_503_SERVICE_UNAVAILABLE, "DATABASE_UNAVAILABLE", "Database unavailable.")

    db = get_db()
    res = await db.users.delete_one({"_id": ObjectId(uid), "role": "user"})
    if res.deleted_count == 0:
        raise _auth_error(status.HTTP_404_NOT_FOUND, "USER_NOT_FOUND", "Subscriber not found.")

    await db.sessions.delete_many({"user_id": ObjectId(uid)})
    invalidate_user_sessions(uid)

    log_event(
        "user_deleted",
        user_id=admin.id,
        username=admin.username,
        ip=get_client_ip(request),
        user_agent=get_client_user_agent(request),
        meta={"target_user_id": uid},
    )

    return {"status": "ok", "message": "User deleted successfully."}


# --------------------------------------------------------------------------
# Dashboard KPI Stats & Activity Logs
# --------------------------------------------------------------------------
@router.get("/stats", response_model=AdminStatsResponse)
async def get_admin_stats(
    admin: CurrentUser = Depends(require_admin),
) -> AdminStatsResponse:
    global _stats_cache
    now_ts = time.time()

    if _stats_cache["data"] and now_ts < _stats_cache["expires_at"]:
        return AdminStatsResponse(**_stats_cache["data"])

    if not is_db_connected():
        raise _auth_error(status.HTTP_503_SERVICE_UNAVAILABLE, "DATABASE_UNAVAILABLE", "Database unavailable.")

    db = get_db()
    now = datetime.now(timezone.utc)
    seven_days = now + timedelta(days=7)
    today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    five_min_ago = now - timedelta(minutes=5)

    total_users = await db.users.count_documents({"role": "user"})
    active_subscriptions = await db.users.count_documents(
        {
            "role": "user",
            "is_active": True,
            "$or": [{"access_expires_at": None}, {"access_expires_at": {"$gt": now}}],
        }
    )
    expiring_soon = await db.users.count_documents(
        {
            "role": "user",
            "is_active": True,
            "access_expires_at": {"$gt": now, "$lte": seven_days},
        }
    )
    expired = await db.users.count_documents(
        {"role": "user", "is_active": True, "access_expires_at": {"$lte": now}}
    )

    # Distinct users online in the last 5 minutes
    online_uids = await db.sessions.distinct(
        "user_id",
        {"revoked": False, "last_seen_at": {"$gte": five_min_ago}},
    )
    online_now = len(online_uids)

    logins_today = await db.activity_logs.count_documents(
        {"event": "login_success", "ts": {"$gte": today_start}}
    )

    stats_data = {
        "total_users": total_users,
        "active_subscriptions": active_subscriptions,
        "expiring_soon": expiring_soon,
        "expired": expired,
        "online_now": online_now,
        "logins_today": logins_today,
    }

    _stats_cache = {"data": stats_data, "expires_at": now_ts + 15.0}

    return AdminStatsResponse(**stats_data)


@router.get("/activity")
async def get_activity_logs(
    user_id: Optional[str] = Query(None),
    event: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    admin: CurrentUser = Depends(require_admin),
) -> Dict[str, Any]:
    if not is_db_connected():
        raise _auth_error(status.HTTP_503_SERVICE_UNAVAILABLE, "DATABASE_UNAVAILABLE", "Database unavailable.")

    db = get_db()
    query: Dict[str, Any] = {}
    if user_id:
        if ObjectId.is_valid(user_id):
            query["user_id"] = ObjectId(user_id)
        else:
            query["username"] = user_id

    if event:
        query["event"] = event

    total = await db.activity_logs.count_documents(query)
    cursor = db.activity_logs.find(query).sort("ts", -1).skip(skip).limit(limit)
    raw_logs = await cursor.to_list(length=limit)

    items = []
    for log in raw_logs:
        items.append(
            {
                "id": str(log["_id"]),
                "ts": log["ts"].isoformat() if hasattr(log.get("ts"), "isoformat") else str(log.get("ts")),
                "user_id": str(log["user_id"]) if log.get("user_id") else None,
                "username": log.get("username", "anonymous"),
                "event": log.get("event", "unknown"),
                "ip_address": log.get("ip_address", "127.0.0.1"),
                "user_agent": log.get("user_agent", "Unknown"),
                "session_id": log.get("session_id"),
                "details": log.get("details", {}),
            }
        )

    return {"total": total, "items": items, "limit": limit, "skip": skip}
