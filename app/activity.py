"""Activity logging utility for security, operations, and audit compliance."""

import asyncio
from datetime import datetime, timezone
import logging
from typing import Any, Dict, Optional
from bson import ObjectId

from app.db import get_db, is_db_connected

logger = logging.getLogger("sheetfill.activity")

FORBIDDEN_META_KEYS = {
    "password",
    "password_hash",
    "token",
    "jwt",
    "secret",
    "file_bytes",
    "contents",
    "raw_sheet",
}


class _AwaitableTask:
    """Wrapper that can be either awaited or safely ignored."""

    def __init__(self, task: Optional[asyncio.Task]):
        self._task = task

    def __await__(self):
        if self._task is not None:
            return self._task.__await__()

        async def _noop():
            return None

        return _noop().__await__()


def log_event(
    event: Optional[str] = None,
    user_id: Optional[str] = None,
    username: Optional[str] = None,
    ip: Optional[str] = None,
    user_agent: Optional[str] = None,
    session_id: Optional[str] = None,
    meta: Optional[Dict[str, Any]] = None,
    *,
    event_type: Optional[str] = None,
    user: Any = None,
    request: Any = None,
) -> _AwaitableTask:
    """Dispatches an audit activity log entry asynchronously without blocking requests.

    Supports both positional and keyword invocations (e.g. event_type=..., user=..., request=...),
    and can either be called synchronously or awaited.
    """
    ev = event or event_type or "unknown"
    uid = user_id
    uname = username or "anonymous"

    if user is not None:
        if hasattr(user, "id"):
            uid = user.id
        elif isinstance(user, dict) and "id" in user:
            uid = user["id"]
        if hasattr(user, "username"):
            uname = user.username
        elif isinstance(user, dict) and "username" in user:
            uname = user["username"]
        if hasattr(user, "session_id") and not session_id:
            session_id = user.session_id

    req_ip = ip or "127.0.0.1"
    req_ua = user_agent or "Unknown"

    if request is not None:
        if hasattr(request, "headers"):
            req_ua = request.headers.get("user-agent", req_ua)
            x_forwarded = request.headers.get("x-forwarded-for")
            if x_forwarded:
                req_ip = x_forwarded.split(",")[0].strip()
            elif hasattr(request, "client") and request.client:
                req_ip = request.client.host

    task: Optional[asyncio.Task] = None
    try:
        loop = asyncio.get_running_loop()
        task = loop.create_task(
            _write_log_entry(
                event=ev,
                user_id=uid,
                username=uname,
                ip=req_ip,
                user_agent=req_ua,
                session_id=session_id,
                meta=meta,
            )
        )
    except RuntimeError:
        pass
    except Exception as e:
        logger.warning(f"Failed to dispatch activity log for event '{ev}': {e}")

    return _AwaitableTask(task)


async def _write_log_entry(
    event: str,
    user_id: Optional[str],
    username: str,
    ip: str,
    user_agent: str,
    session_id: Optional[str],
    meta: Optional[Dict[str, Any]],
) -> None:
    """Writes log record to MongoDB collection activity_logs."""
    try:
        if not is_db_connected():
            return

        db = get_db()
        safe_meta: Dict[str, Any] = {}
        if meta and isinstance(meta, dict):
            for k, v in meta.items():
                if k.lower() in FORBIDDEN_META_KEYS:
                    safe_meta[k] = "[REDACTED]"
                elif isinstance(v, (str, int, float, bool, list, dict)) or v is None:
                    safe_meta[k] = v
                else:
                    safe_meta[k] = str(v)

        doc = {
            "ts": datetime.now(timezone.utc),
            "user_id": ObjectId(user_id) if (user_id and ObjectId.is_valid(user_id)) else None,
            "username": username,
            "event": event,
            "ip_address": ip,
            "user_agent": user_agent,
            "session_id": session_id,
            "details": safe_meta,
        }
        await db.activity_logs.insert_one(doc)
    except Exception as e:
        logger.warning(f"Failed to write activity log entry: {e}")
