"""Asynchronous query and scrape cache backed by MongoDB 'keyword_agent_cache'."""

from datetime import datetime, timedelta, timezone
import json
import logging
from typing import Any, Optional

from app.db import get_db, is_db_connected

logger = logging.getLogger("sheetfill.keyword_agent.cache")

# In-memory fallback if database is not connected
_memory_cache: dict[str, tuple[datetime, Any]] = {}


async def get(key: str) -> Optional[Any]:
    """Retrieves value from cache if exists and not expired."""
    now = datetime.now(timezone.utc)

    # 1. MongoDB cache lookup
    if is_db_connected():
        try:
            db = get_db()
            doc = await db.keyword_agent_cache.find_one({"key": key})
            if doc:
                exp = doc.get("expires_at")
                if exp and exp.tzinfo is None:
                    exp = exp.replace(tzinfo=timezone.utc)
                if exp and now > exp:
                    return None
                val_json = doc.get("value_json")
                try:
                    return json.loads(val_json)
                except Exception:
                    return val_json
        except Exception as e:
            logger.warning(f"Cache get error from MongoDB for key '{key}': {e}")

    # 2. Memory cache fallback
    if key in _memory_cache:
        exp, val = _memory_cache[key]
        if now > exp:
            del _memory_cache[key]
            return None
        return val

    return None


async def set(key: str, value: Any, ttl_seconds: int = 86400) -> None:
    """Stores value in cache with TTL."""
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=ttl_seconds)
    val_json = json.dumps(value) if not isinstance(value, str) else value

    if is_db_connected():
        try:
            db = get_db()
            await db.keyword_agent_cache.update_one(
                {"key": key},
                {
                    "$set": {
                        "key": key,
                        "value_json": val_json,
                        "created_at": now,
                        "expires_at": expires_at,
                    }
                },
                upsert=True,
            )
            return
        except Exception as e:
            logger.warning(f"Cache set error in MongoDB for key '{key}': {e}")

    _memory_cache[key] = (expires_at, value)


async def delete(key: str) -> None:
    """Removes key from cache."""
    if is_db_connected():
        try:
            db = get_db()
            await db.keyword_agent_cache.delete_one({"key": key})
        except Exception:
            pass
    _memory_cache.pop(key, None)
