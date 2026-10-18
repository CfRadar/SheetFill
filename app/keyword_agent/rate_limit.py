"""Per-user rate limiting and concurrency control for Keyword Agent runs."""

import asyncio
from datetime import datetime, timedelta, timezone
import logging
from typing import Dict, List
from fastapi import HTTPException, status

from app.config import settings

logger = logging.getLogger("sheetfill.keyword_agent.rate_limit")

# In-memory tracking of active runs and user request timestamps
_active_user_runs: Dict[str, str] = {}  # user_id -> run_id
_user_run_history: Dict[str, List[datetime]] = {}  # user_id -> list of timestamps
_lock = asyncio.Lock()


class RateLimitExceeded(HTTPException):
    def __init__(self, detail: str, retry_after: int = 60):
        super().__init__(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"code": "KEYWORD_AGENT_RATE_LIMITED", "message": detail, "retry_after": retry_after},
        )


async def acquire_user_run_slot(user_id: str, run_id: str) -> None:
    """Checks per-user concurrency and hourly run limits, acquiring a slot if permitted."""
    async with _lock:
        now = datetime.now(timezone.utc)

        # 1. Concurrency Check: Max 1 active run per user
        if user_id in _active_user_runs:
            existing_run = _active_user_runs[user_id]
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "CONCURRENT_RUN_IN_PROGRESS",
                    "message": "You already have a Keyword Agent run in progress. Please wait for it to complete or cancel it.",
                    "active_run_id": existing_run,
                },
            )

        # 2. Hourly Rate Limit Check
        history = _user_run_history.get(user_id, [])
        cutoff = now - timedelta(hours=1)
        valid_history = [t for t in history if t > cutoff]

        limit = settings.keyword_agent_hourly_run_limit
        if len(valid_history) >= limit:
            oldest = valid_history[0]
            retry_after = int((oldest + timedelta(hours=1) - now).total_seconds())
            raise RateLimitExceeded(
                f"Hourly limit of {limit} Keyword Agent runs reached. Try again in {max(1, retry_after)}s.",
                retry_after=max(1, retry_after),
            )

        # Register slot
        _active_user_runs[user_id] = run_id
        valid_history.append(now)
        _user_run_history[user_id] = valid_history


async def release_user_run_slot(user_id: str, run_id: str) -> None:
    """Releases the concurrency slot for a user once run finishes or cancels."""
    async with _lock:
        if _active_user_runs.get(user_id) == run_id:
            del _active_user_runs[user_id]


async def get_active_run_for_user(user_id: str) -> str | None:
    """Returns the run_id currently executing for user, or None."""
    async with _lock:
        return _active_user_runs.get(user_id)
