"""MongoDB async connection client and index initialization using Motor."""

import asyncio
import logging
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo.errors import ConnectionFailure, PyMongoError

from app.config import settings

logger = logging.getLogger("sheetfill.db")

_client: Optional[AsyncIOMotorClient] = None
_db: Optional[AsyncIOMotorDatabase] = None
_is_connected: bool = False


async def connect_and_init_db(max_retries: int = 5, initial_delay: float = 1.0) -> bool:
    """Connects to MongoDB with retry backoff and initializes required indexes."""
    global _client, _db, _is_connected

    delay = initial_delay
    for attempt in range(1, max_retries + 1):
        try:
            logger.info(f"Connecting to MongoDB (attempt {attempt}/{max_retries})...")
            _client = AsyncIOMotorClient(
                settings.mongodb_uri,
                serverSelectionTimeoutMS=4000,
            )
            # Ping database to confirm connectivity
            await _client.admin.command("ping")
            _db = _client[settings.mongodb_db]
            _is_connected = True
            logger.info(f"Connected to MongoDB database '{settings.mongodb_db}' successfully.")

            # Create essential indexes
            await _ensure_indexes(_db)
            return True
        except (ConnectionFailure, PyMongoError, Exception) as e:
            logger.warning(f"MongoDB connection attempt {attempt} failed: {e}")
            _is_connected = False
            if attempt < max_retries:
                await asyncio.sleep(delay)
                delay = min(delay * 2, 8.0)

    logger.error("Could not connect to MongoDB after maximum retries. Running in degraded state.")
    return False


async def close_db() -> None:
    """Closes MongoDB connection cleanly on shutdown."""
    global _client, _db, _is_connected
    if _client:
        _client.close()
        _client = None
        _db = None
        _is_connected = False
        logger.info("MongoDB client disconnected.")


def get_db() -> AsyncIOMotorDatabase:
    """Returns active MongoDB database instance or raises RuntimeError."""
    if _db is None or not _is_connected:
        raise RuntimeError("Database is currently not connected.")
    return _db


def is_db_connected() -> bool:
    """Returns current connection status for health checks."""
    return _is_connected


async def _ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    """Creates indexes for users, sessions, activity_logs, and login_attempts."""
    try:
        # 1. users: unique username, active/expiry filters
        await db.users.create_index("username", unique=True)
        await db.users.create_index([("is_active", 1), ("access_expires_at", 1)])

        # 2. sessions: unique session_id, unique user_id (1 device), TTL expires_at
        await db.sessions.create_index("session_id", unique=True)
        await db.sessions.create_index("user_id")
        await db.sessions.create_index("expires_at", expireAfterSeconds=0)

        # 3. activity_logs: 90-day TTL (7,776,000 seconds), user & event lookup
        await db.activity_logs.create_index("ts", expireAfterSeconds=7776000)
        await db.activity_logs.create_index([("user_id", 1), ("ts", -1)])
        await db.activity_logs.create_index([("event", 1), ("ts", -1)])

        # 4. login_attempts: unique compound key, TTL for rate-limit window cleanup
        await db.login_attempts.create_index("key", unique=True)
        await db.login_attempts.create_index("expires_at", expireAfterSeconds=0)

        # 5. keyword_agent_user_keys: unique user_id
        await db.keyword_agent_user_keys.create_index("user_id", unique=True)

        # 6. keyword_agent_runs: user ownership and run lookup
        await db.keyword_agent_runs.create_index("run_id", unique=True)
        await db.keyword_agent_runs.create_index([("user_id", 1), ("created_at", -1)])

        # 7. keyword_agent_cache: unique cache key and TTL expiration
        await db.keyword_agent_cache.create_index("key", unique=True)
        await db.keyword_agent_cache.create_index("expires_at", expireAfterSeconds=0)

        # 8. keyword_agent_usage: per-user daily call counter
        await db.keyword_agent_usage.create_index([("user_id", 1), ("day", 1)], unique=True)

        logger.info("MongoDB indexes verified and created successfully.")
    except Exception as e:
        logger.error(f"Failed to create MongoDB indexes: {e}")
