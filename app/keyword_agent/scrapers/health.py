"""
Health tracking and circuit breaker for data sources.
Maintains live operational state, consecutive failure counts, and circuit breaker status in memory.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Literal
from pydantic import BaseModel, Field

logger = logging.getLogger("sheetfill.keyword_agent.scrapers.health")

CIRCUIT_BREAKER_THRESHOLD = 3
CIRCUIT_BREAKER_TIMEOUT_SECONDS = 1800  # 30 minutes


class HealthRecord(BaseModel):
    source_id: str
    status: Literal["healthy", "degraded", "blocked", "unavailable", "disabled", "unknown"]
    strategy_used: str | None = None
    failure_cause: str | None = None
    consecutive_failures: int = 0
    last_ok_at: float | None = None
    last_checked_at: float = Field(default_factory=time.time)
    circuit_breaker_open: bool = False


# In-memory store for source health records
_HEALTH_STORE: dict[str, dict[str, Any]] = {}
_HEALTH_LOCK = asyncio.Lock()


def map_result_status_to_health(
    result_status: str,
    status_override: str | None = None,
) -> tuple[Literal["healthy", "degraded", "blocked", "unavailable", "disabled", "unknown"], bool]:
    """
    Maps SourceResult.status to HealthRecord.status.
    Returns (health_status, is_success).
    """
    if status_override:
        if status_override == "unavailable":
            return "unavailable", False
        if status_override == "disabled":
            return "disabled", False

    if result_status in ("ok", "cached"):
        return "healthy", True
    if result_status == "partial":
        return "degraded", True
    if result_status == "blocked":
        return "blocked", False
    if result_status in ("unavailable", "needs_location"):
        return "unavailable", False
    if result_status == "skipped":
        return "unknown", False
    return "degraded", False


async def record_health(
    source_id: str,
    result_status: str,
    strategy_used: str | None = None,
    failure_cause: str | None = None,
    status_override: str | None = None,
    db_path: str | None = None,
) -> HealthRecord:
    """
    Updates the health status of a source after an execution or canary probe.
    """
    now = time.time()
    health_status, is_success = map_result_status_to_health(result_status, status_override)

    async with _HEALTH_LOCK:
        prev = _HEALTH_STORE.get(source_id, {})
        prev_failures = prev.get("consecutive_failures", 0)
        last_ok = prev.get("last_ok_at")

        if is_success:
            consecutive_failures = 0
            last_ok = now
        elif result_status == "skipped":
            consecutive_failures = prev_failures
        else:
            consecutive_failures = prev_failures + 1

        record_data = {
            "source_id": source_id,
            "status": health_status,
            "strategy_used": strategy_used,
            "failure_cause": failure_cause,
            "consecutive_failures": consecutive_failures,
            "last_ok_at": last_ok,
            "last_checked_at": now,
        }
        _HEALTH_STORE[source_id] = record_data

    breaker_open = (
        consecutive_failures >= CIRCUIT_BREAKER_THRESHOLD
        and (now - now) < CIRCUIT_BREAKER_TIMEOUT_SECONDS
    )

    return HealthRecord(
        source_id=source_id,
        status=health_status,
        strategy_used=strategy_used,
        failure_cause=failure_cause,
        consecutive_failures=consecutive_failures,
        last_ok_at=last_ok,
        last_checked_at=now,
        circuit_breaker_open=breaker_open,
    )


async def is_circuit_breaker_open(source_id: str, db_path: str | None = None) -> bool:
    """
    Checks if a source's circuit breaker is open (3 consecutive failures within 30 minutes).
    """
    now = time.time()
    async with _HEALTH_LOCK:
        rec = _HEALTH_STORE.get(source_id)
        if not rec:
            return False

        failures = rec.get("consecutive_failures", 0)
        last_checked = rec.get("last_checked_at", now)

        if failures >= CIRCUIT_BREAKER_THRESHOLD and (now - last_checked) < CIRCUIT_BREAKER_TIMEOUT_SECONDS:
            logger.warning(
                f"Circuit breaker OPEN for source '{source_id}': "
                f"{failures} consecutive failures. Skipping execution."
            )
            return True
        return False


async def reset_circuit_breaker(source_id: str | None = None, db_path: str | None = None) -> None:
    """Resets consecutive failures and re-enables a source (or all sources)."""
    async with _HEALTH_LOCK:
        if source_id:
            if source_id in _HEALTH_STORE:
                _HEALTH_STORE[source_id]["consecutive_failures"] = 0
                _HEALTH_STORE[source_id]["status"] = "healthy"
        else:
            for s in _HEALTH_STORE.values():
                s["consecutive_failures"] = 0
                s["status"] = "healthy"


async def get_source_health(source_id: str, db_path: str | None = None) -> HealthRecord | None:
    now = time.time()
    async with _HEALTH_LOCK:
        rec = _HEALTH_STORE.get(source_id)
        if not rec:
            return None

        failures = rec.get("consecutive_failures", 0)
        last_checked = rec.get("last_checked_at", now)
        is_open = (
            failures >= CIRCUIT_BREAKER_THRESHOLD
            and (now - last_checked) < CIRCUIT_BREAKER_TIMEOUT_SECONDS
        )

        return HealthRecord(
            source_id=rec["source_id"],
            status=rec["status"],
            strategy_used=rec.get("strategy_used"),
            failure_cause=rec.get("failure_cause"),
            consecutive_failures=failures,
            last_ok_at=rec.get("last_ok_at"),
            last_checked_at=last_checked,
            circuit_breaker_open=is_open,
        )


async def get_all_source_health(db_path: str | None = None) -> dict[str, HealthRecord]:
    now = time.time()
    records: dict[str, HealthRecord] = {}
    async with _HEALTH_LOCK:
        for source_id, rec in _HEALTH_STORE.items():
            failures = rec.get("consecutive_failures", 0)
            last_checked = rec.get("last_checked_at", now)
            is_open = (
                failures >= CIRCUIT_BREAKER_THRESHOLD
                and (now - last_checked) < CIRCUIT_BREAKER_TIMEOUT_SECONDS
            )
            records[source_id] = HealthRecord(
                source_id=rec["source_id"],
                status=rec["status"],
                strategy_used=rec.get("strategy_used"),
                failure_cause=rec.get("failure_cause"),
                consecutive_failures=failures,
                last_ok_at=rec.get("last_ok_at"),
                last_checked_at=last_checked,
                circuit_breaker_open=is_open,
            )
    return records
