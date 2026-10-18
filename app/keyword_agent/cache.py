"""Asynchronous query and scrape cache backed by MongoDB 'keyword_agent_cache'."""

from datetime import datetime, timedelta, timezone
import hashlib
import json
import logging
import re
from typing import Any, Optional, Tuple

from app.db import get_db, is_db_connected

logger = logging.getLogger("sheetfill.keyword_agent.cache")

# Tiered TTL constants
TTL_MARKETPLACE = 12 * 3600   # 12 hours
TTL_SEARCH_PLAN = 24 * 3600   # 24 hours
TTL_ANALYSIS = 48 * 3600      # 48 hours

# English common stopwords for canonicalization
STOPWORDS = {
    "a", "about", "an", "and", "are", "as", "at", "be", "by", "for", "from",
    "how", "in", "is", "it", "of", "on", "or", "that", "the", "this", "to",
    "was", "what", "when", "where", "who", "will", "with", "men", "women",
}

# In-memory fallback if database is not connected
_memory_cache: dict[str, tuple[datetime, Any]] = {}
_memory_locks: dict[str, datetime] = {}
_cache_stats = {"hits": 0, "misses": 0}


def normalize_query(query: str) -> str:
    """
    Produces canonical query string:
    lowercase -> strip non-alphanumeric -> filter stopwords -> sort tokens.
    """
    clean = re.sub(r"[^\w\s]", " ", query.lower()).strip()
    tokens = [t for t in clean.split() if t and t not in STOPWORDS]
    if not tokens:
        tokens = [t for t in clean.split() if t]
    tokens.sort()
    return "-".join(tokens)


def make_cache_key(category: str, platform: str, query: str) -> str:
    """Generates deterministic SHA-256 cache key from canonical query."""
    canonical = normalize_query(query)
    q_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:16]
    return f"cache:{category}:{platform}:{q_hash}"


async def acquire_lock(lock_key: str, ttl_seconds: int = 30) -> bool:
    """Anti-stampede single-flight mutex lock."""
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=ttl_seconds)

    if is_db_connected():
        try:
            db = get_db()
            # Try to insert lock if not exists or expired
            res = await db.keyword_agent_locks.update_one(
                {"lock_key": lock_key, "expires_at": {"$lte": now}},
                {"$set": {"lock_key": lock_key, "acquired_at": now, "expires_at": expires_at}},
                upsert=False,
            )
            if res.modified_count > 0:
                return True

            # If not modified, try insert if not present
            try:
                await db.keyword_agent_locks.insert_one(
                    {"lock_key": lock_key, "acquired_at": now, "expires_at": expires_at}
                )
                return True
            except Exception:
                return False
        except Exception as e:
            logger.debug(f"Lock acquire error in Mongo: {e}")

    # Memory fallback
    if lock_key in _memory_locks and now < _memory_locks[lock_key]:
        return False
    _memory_locks[lock_key] = expires_at
    return True


async def release_lock(lock_key: str) -> None:
    """Releases anti-stampede lock."""
    if is_db_connected():
        try:
            db = get_db()
            await db.keyword_agent_locks.delete_one({"lock_key": lock_key})
        except Exception:
            pass
    _memory_locks.pop(lock_key, None)


async def get(key: str) -> Optional[Any]:
    """Retrieves value from cache if exists and not expired."""
    val, _ = await get_with_stale_fallback(key, allow_stale=False)
    return val


async def get_with_stale_fallback(key: str, allow_stale: bool = True) -> Tuple[Optional[Any], bool]:
    """
    Retrieves value from cache. If allow_stale is True and item is expired,
    returns (value, True) instead of (None, False).
    """
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
                is_stale = bool(exp and now > exp)
                if is_stale and not allow_stale:
                    _cache_stats["misses"] += 1
                    return None, False

                val_json = doc.get("value_json")
                try:
                    data = json.loads(val_json)
                except Exception:
                    data = val_json
                _cache_stats["hits"] += 1
                return data, is_stale
        except Exception as e:
            logger.warning(f"Cache get error from MongoDB for key '{key}': {e}")

    # 2. Memory cache fallback
    if key in _memory_cache:
        exp, val = _memory_cache[key]
        is_stale = bool(now > exp)
        if is_stale and not allow_stale:
            _cache_stats["misses"] += 1
            del _memory_cache[key]
            return None, False
        _cache_stats["hits"] += 1
        return val, is_stale

    _cache_stats["misses"] += 1
    return None, False


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


def get_stats() -> dict[str, int]:
    """Returns cache hit/miss stats."""
    return dict(_cache_stats)
