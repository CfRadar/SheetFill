"""BYOK (Bring Your Own Key) encrypted storage and management for OpenRouter API keys."""

from datetime import datetime, timedelta, timezone
import logging
from typing import Any, Dict, Optional
import uuid
from bson import ObjectId
from cryptography.fernet import Fernet, InvalidToken
import httpx

from app.config import settings
from app.db import get_db, is_db_connected

logger = logging.getLogger("sheetfill.keyword_agent.key_store")


def _get_cipher() -> Fernet:
    """Returns Fernet cipher instance initialized with KEYWORD_AGENT_ENCRYPTION_KEY."""
    enc_key = settings.keyword_agent_encryption_key.strip()
    if not enc_key:
        if settings.env == "production":
            raise RuntimeError(
                "KEYWORD_AGENT_ENCRYPTION_KEY is required in production for BYOK encryption at rest."
            )
        # Development fallback key with persistent valid Fernet 32-byte secret
        enc_key = "ebmq8iQCdV9uKJ-kZl7mG0rRsgUMZH59fccFW9CqnAw="
    return Fernet(enc_key.encode("utf-8"))


def encrypt_key(plain_key: str) -> str:
    """Encrypts plaintext API key string into Fernet ciphertext."""
    cipher = _get_cipher()
    return cipher.encrypt(plain_key.strip().encode("utf-8")).decode("utf-8")


def decrypt_key(encrypted_key: str) -> str:
    """Decrypts ciphertext string into plaintext API key in memory."""
    cipher = _get_cipher()
    try:
        return cipher.decrypt(encrypted_key.encode("utf-8")).decode("utf-8")
    except InvalidToken as e:
        raise ValueError("Failed to decrypt OpenRouter API key: invalid ciphertext or modified encryption key.") from e


async def test_openrouter_key(api_key: str) -> Dict[str, Any]:
    """
    Performs a lightweight verification probe against OpenRouter API.
    Returns: {"valid": bool, "usage": float | None, "limit": float | None, "is_free_tier": bool}
    """
    clean_key = api_key.strip()
    if not clean_key.startswith("sk-or-"):
        raise ValueError("Invalid OpenRouter key format. Keys must start with 'sk-or-'.")

    url = "https://openrouter.ai/api/v1/auth/key"
    headers = {
        "Authorization": f"Bearer {clean_key}",
        "HTTP-Referer": settings.frontend_origin,
        "X-Title": "Marketplace Keyword Agent",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.get(url, headers=headers)
        except httpx.RequestError as e:
            logger.warning(f"Failed to connect to OpenRouter auth probe: {e}")
            raise RuntimeError(f"Could not reach OpenRouter API: {e}") from e

        if resp.status_code == 401:
            return {"valid": False, "error": "Invalid API key credentials or revoked key."}
        elif resp.status_code != 200:
            return {"valid": False, "error": f"OpenRouter verification returned HTTP {resp.status_code}."}

        data = resp.json().get("data", {})
        return {
            "valid": True,
            "label": data.get("label"),
            "usage": data.get("usage", 0.0),
            "limit": data.get("limit"),
            "is_free_tier": data.get("is_free_tier", False),
        }


async def save_user_key(
    user_id: str,
    plain_key: str,
    preferred_model: Optional[str] = None,
    verify_live: bool = True,
) -> Dict[str, Any]:
    """Validates, encrypts, and stores user OpenRouter API key in MongoDB."""
    clean_key = plain_key.strip()
    if not clean_key.startswith("sk-or-") or len(clean_key) < 20:
        raise ValueError("Invalid OpenRouter API key format. Key must start with 'sk-or-'.")

    # Optional live validation against OpenRouter
    if verify_live:
        probe = await test_openrouter_key(clean_key)
        if not probe.get("valid"):
            raise ValueError(probe.get("error", "OpenRouter key verification failed."))

    encrypted = encrypt_key(clean_key)
    last4 = clean_key[-4:]
    now = datetime.now(timezone.utc)
    model = (preferred_model or settings.keyword_agent_default_model).strip()
    key_id = f"key_{uuid.uuid4().hex[:8]}"

    db = get_db()
    u_obj_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id

    key_entry = {
        "key_id": key_id,
        "label": f"Key ...{last4}",
        "encrypted_key": encrypted,
        "key_last4": last4,
        "status": "active",
        "usage_count": 0,
        "last_used_at": None,
        "cooldown_until": None,
        "last_error": None,
        "created_at": now,
        "updated_at": now,
    }

    await db.keyword_agent_user_keys.update_one(
        {"user_id": u_obj_id},
        {
            "$set": {
                "user_id": u_obj_id,
                "encrypted_key": encrypted,
                "key_last4": last4,
                "provider": "openrouter",
                "preferred_model": model,
                "is_valid": True,
                "last_verified_at": now,
                "updated_at": now,
            },
            "$setOnInsert": {
                "created_at": now,
            },
            "$push": {
                "keys": key_entry,
            },
        },
        upsert=True,
    )

    logger.info(f"Updated OpenRouter key for user '{user_id}' (ending in ...{last4}).")
    return {
        "configured": True,
        "last4": last4,
        "preferred_model": model,
        "last_verified_at": now.isoformat(),
        "key_id": key_id,
    }


async def list_user_keys(user_id: str) -> list[Dict[str, Any]]:
    """Lists all masked OpenRouter keys in user's multi-key vault."""
    if not is_db_connected():
        return []
    db = get_db()
    u_obj_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
    doc = await db.keyword_agent_user_keys.find_one({"user_id": u_obj_id})
    if not doc:
        return []

    keys = doc.get("keys", [])
    if not keys and doc.get("encrypted_key"):
        return [{
            "key_id": "default",
            "label": "Primary Key",
            "last4": doc.get("key_last4", "****"),
            "status": "active" if doc.get("is_valid", True) else "invalid",
            "usage_count": 0,
            "last_used_at": None,
            "last_error": None,
            "created_at": doc.get("created_at"),
        }]

    results = []
    now = datetime.now(timezone.utc)
    for k in keys:
        cooldown_until = k.get("cooldown_until")
        if cooldown_until and cooldown_until.tzinfo is None:
            cooldown_until = cooldown_until.replace(tzinfo=timezone.utc)
        status = k.get("status", "active")
        if status == "cooldown" and cooldown_until and now >= cooldown_until:
            status = "active"

        created_at_val = k.get("created_at")
        results.append({
            "key_id": k.get("key_id"),
            "label": k.get("label", "Key"),
            "last4": k.get("key_last4", "****"),
            "status": status,
            "usage_count": k.get("usage_count", 0),
            "last_used_at": k.get("last_used_at"),
            "last_error": k.get("last_error"),
            "created_at": created_at_val.isoformat() if isinstance(created_at_val, datetime) else created_at_val,
        })
    return results


async def add_user_key(
    user_id: str,
    plain_key: str,
    label: str = "Key",
    verify_live: bool = True,
) -> Dict[str, Any]:
    """Validates and adds an additional key to the user's multi-key vault."""
    clean_key = plain_key.strip()
    if not clean_key.startswith("sk-or-") or len(clean_key) < 20:
        raise ValueError("Invalid OpenRouter API key format. Key must start with 'sk-or-'.")

    if verify_live:
        probe = await test_openrouter_key(clean_key)
        if not probe.get("valid"):
            raise ValueError(probe.get("error", "OpenRouter key verification failed."))

    encrypted = encrypt_key(clean_key)
    last4 = clean_key[-4:]
    now = datetime.now(timezone.utc)
    key_id = f"key_{uuid.uuid4().hex[:8]}"

    db = get_db()
    u_obj_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id

    new_key_entry = {
        "key_id": key_id,
        "label": label or f"Key ...{last4}",
        "encrypted_key": encrypted,
        "key_last4": last4,
        "status": "active",
        "usage_count": 0,
        "last_used_at": None,
        "cooldown_until": None,
        "last_error": None,
        "created_at": now,
        "updated_at": now,
    }

    await db.keyword_agent_user_keys.update_one(
        {"user_id": u_obj_id},
        {
            "$push": {"keys": new_key_entry},
            "$setOnInsert": {
                "user_id": u_obj_id,
                "preferred_model": settings.keyword_agent_default_model,
                "created_at": now,
            },
            "$set": {
                "encrypted_key": encrypted,
                "key_last4": last4,
                "updated_at": now,
            },
        },
        upsert=True,
    )

    return {
        "status": "ok",
        "key_id": key_id,
        "label": label or f"Key ...{last4}",
        "last4": last4,
    }


async def remove_user_key(user_id: str, key_id: str) -> bool:
    """Removes a specific key from the user's multi-key vault."""
    db = get_db()
    u_obj_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
    res = await db.keyword_agent_user_keys.update_one(
        {"user_id": u_obj_id},
        {"$pull": {"keys": {"key_id": key_id}}},
    )
    return res.modified_count > 0


async def mark_key_error(
    user_id: str,
    key_id: str,
    error_type: str,
    cooldown_seconds: int = 60,
) -> None:
    """Marks a key in cooldown (429/5xx) or exhausted (402)."""
    now = datetime.now(timezone.utc)
    cooldown_until = now + timedelta(seconds=cooldown_seconds)
    status = "exhausted" if "402" in str(error_type) else "cooldown"

    db = get_db()
    u_obj_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
    await db.keyword_agent_user_keys.update_one(
        {"user_id": u_obj_id, "keys.key_id": key_id},
        {
            "$set": {
                "keys.$.status": status,
                "keys.$.cooldown_until": cooldown_until,
                "keys.$.last_error": str(error_type),
            }
        },
    )


async def record_key_usage(user_id: str, key_id: str) -> None:
    """Increments usage count and updates last_used_at for key."""
    if not is_db_connected():
        return
    now = datetime.now(timezone.utc)
    db = get_db()
    u_obj_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
    await db.keyword_agent_user_keys.update_one(
        {"user_id": u_obj_id, "keys.key_id": key_id},
        {
            "$inc": {"keys.$.usage_count": 1},
            "$set": {"keys.$.last_used_at": now},
        },
    )


async def resolve_all_active_keys(user_id: str) -> list[tuple[str, str]]:
    """
    Returns active (decrypted_plain_key, key_id) pairs sorted by least used.
    """
    if not is_db_connected():
        return []
    db = get_db()
    u_obj_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
    doc = await db.keyword_agent_user_keys.find_one({"user_id": u_obj_id})
    if not doc:
        return []

    keys = doc.get("keys", [])
    now = datetime.now(timezone.utc)
    active_keys = []

    if not keys and doc.get("encrypted_key"):
        try:
            plain = decrypt_key(doc["encrypted_key"])
            return [(plain, "default")]
        except Exception:
            return []

    for k in keys:
        status = k.get("status", "active")
        cooldown_until = k.get("cooldown_until")
        if cooldown_until and cooldown_until.tzinfo is None:
            cooldown_until = cooldown_until.replace(tzinfo=timezone.utc)
        if status == "cooldown" and cooldown_until and now >= cooldown_until:
            status = "active"

        if status == "active":
            try:
                plain = decrypt_key(k["encrypted_key"])
                active_keys.append((plain, k.get("key_id", ""), k.get("usage_count", 0)))
            except Exception:
                pass

    active_keys.sort(key=lambda x: x[2])
    return [(plain, kid) for plain, kid, _ in active_keys]


async def get_user_key_status(user_id: str) -> Dict[str, Any]:
    """Returns key configuration status and masked last4. NEVER returns full key."""
    if not is_db_connected():
        return {
            "configured": False,
            "last4": None,
            "preferred_model": settings.keyword_agent_default_model,
            "last_verified_at": None,
            "key_count": 0,
        }

    db = get_db()
    u_obj_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
    doc = await db.keyword_agent_user_keys.find_one({"user_id": u_obj_id})

    if not doc or (not doc.get("encrypted_key") and not doc.get("keys")):
        return {
            "configured": False,
            "last4": None,
            "preferred_model": settings.keyword_agent_default_model,
            "last_verified_at": None,
            "key_count": 0,
        }

    keys = doc.get("keys", [])
    last_verified = doc.get("last_verified_at")
    last_verified_iso = (
        last_verified.isoformat() if isinstance(last_verified, datetime) else str(last_verified or "")
    )

    model = doc.get("preferred_model") or settings.keyword_agent_default_model
    if model and model.endswith(":free"):
        model = model[:-5]

    return {
        "configured": True,
        "last4": doc.get("key_last4", "****"),
        "preferred_model": model,
        "last_verified_at": last_verified_iso or None,
        "key_count": len(keys) if keys else 1,
    }


async def delete_user_key(user_id: str) -> bool:
    """Removes user OpenRouter API key from MongoDB."""
    db = get_db()
    u_obj_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
    res = await db.keyword_agent_user_keys.delete_one({"user_id": u_obj_id})
    logger.info(f"Deleted OpenRouter key for user '{user_id}'.")
    return res.deleted_count > 0


async def resolve_user_openrouter_key(user_id: str) -> tuple[Optional[str], Optional[str]]:
    """
    Resolves and decrypts the user's OpenRouter API key and preferred model in memory.
    Returns: (decrypted_api_key, preferred_model) or (None, None)
    """
    if not is_db_connected():
        return None, None

    db = get_db()
    u_obj_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
    doc = await db.keyword_agent_user_keys.find_one({"user_id": u_obj_id})
    if not doc:
        return None, None

    # Check multi-key vault first
    active_keys = await resolve_all_active_keys(user_id)
    plain_key = active_keys[0][0] if active_keys else None

    if not plain_key and doc.get("encrypted_key"):
        try:
            plain_key = decrypt_key(doc["encrypted_key"])
        except Exception:
            plain_key = None

    if not plain_key:
        return None, None

    model = doc.get("preferred_model") or settings.keyword_agent_default_model
    if model and model.endswith(":free"):
        model = model[:-5]
        try:
            await db.keyword_agent_user_keys.update_one(
                {"user_id": u_obj_id},
                {"$set": {"preferred_model": model, "updated_at": datetime.now(timezone.utc)}},
            )
        except Exception:
            pass

    return plain_key, model
