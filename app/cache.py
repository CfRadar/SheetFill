"""In-memory thread-safe TTL cache layer for sub-millisecond session & permission validation."""

from datetime import datetime, timezone
import threading
from typing import Any, Dict, Optional
from cachetools import TTLCache

# Lock for thread-safe cache mutations
_lock = threading.Lock()

# 1. Session validation cache (TTL 30 seconds, max 5,000 active sessions)
_session_cache: TTLCache = TTLCache(maxsize=5000, ttl=30)

# Map user_id -> set of active session_ids for instant user-level invalidation
_user_sessions_map: Dict[str, set] = {}

# 2. Admin stats cache (TTL 15 seconds)
_admin_stats_cache: TTLCache = TTLCache(maxsize=10, ttl=15)

# 3. Static values cache (templates, allowed dropdowns)
_static_cache: Dict[str, Any] = {}


def get_cached_session(session_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves session record from cache."""
    with _lock:
        return _session_cache.get(session_id)


def set_cached_session(session_id: str, data: Dict[str, Any]) -> None:
    """Stores session record in cache and links it to user_id."""
    with _lock:
        _session_cache[session_id] = data
        uid = str(data.get("user_id", ""))
        if uid:
            if uid not in _user_sessions_map:
                _user_sessions_map[uid] = set()
            _user_sessions_map[uid].add(session_id)


def invalidate_session(session_id: str) -> None:
    """Removes a single session from cache."""
    with _lock:
        data = _session_cache.pop(session_id, None)
        if data:
            uid = str(data.get("user_id", ""))
            if uid in _user_sessions_map:
                _user_sessions_map[uid].discard(session_id)


def invalidate_user_sessions(user_id: str) -> None:
    """Immediately invalidates all cached sessions belonging to a user (e.g. on disable/expiry/edit)."""
    with _lock:
        uid = str(user_id)
        session_ids = _user_sessions_map.pop(uid, set())
        for sid in session_ids:
            _session_cache.pop(sid, None)


def get_cached_admin_stats() -> Optional[Dict[str, Any]]:
    """Retrieves cached admin stats."""
    with _lock:
        return _admin_stats_cache.get("stats")


def set_cached_admin_stats(stats: Dict[str, Any]) -> None:
    """Caches admin stats for 15 seconds."""
    with _lock:
        _admin_stats_cache["stats"] = stats


def invalidate_admin_stats() -> None:
    """Purges cached admin stats."""
    with _lock:
        _admin_stats_cache.pop("stats", None)


def get_static_cache(key: str) -> Optional[Any]:
    """Retrieves static resource from cache."""
    return _static_cache.get(key)


def set_static_cache(key: str, value: Any) -> None:
    """Stores static resource in cache."""
    _static_cache[key] = value
