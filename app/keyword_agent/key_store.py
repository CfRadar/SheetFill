"""BYOK (Bring Your Own Key) encrypted storage and management for OpenRouter API keys."""

from datetime import datetime, timezone
import logging
from typing import Any, Dict, Optional
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

    db = get_db()
    u_obj_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id

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
        },
        upsert=True,
    )

    logger.info(f"Updated OpenRouter key for user '{user_id}' (ending in ...{last4}).")
    return {
        "configured": True,
        "last4": last4,
        "preferred_model": model,
        "last_verified_at": now.isoformat(),
    }


async def get_user_key_status(user_id: str) -> Dict[str, Any]:
    """Returns key configuration status and masked last4. NEVER returns full key."""
    if not is_db_connected():
        return {
            "configured": False,
            "last4": None,
            "preferred_model": settings.keyword_agent_default_model,
            "last_verified_at": None,
        }

    db = get_db()
    u_obj_id = ObjectId(user_id) if ObjectId.is_valid(user_id) else user_id
    doc = await db.keyword_agent_user_keys.find_one({"user_id": u_obj_id})

    if not doc or not doc.get("encrypted_key"):
        return {
            "configured": False,
            "last4": None,
            "preferred_model": settings.keyword_agent_default_model,
            "last_verified_at": None,
        }

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
    if not doc or not doc.get("encrypted_key"):
        return None, None

    plain_key = decrypt_key(doc["encrypted_key"])
    model = doc.get("preferred_model") or settings.keyword_agent_default_model
    if model and model.endswith(":free"):
        model = model[:-5]
        # Silently persist migrated slug to MongoDB
        try:
            await db.keyword_agent_user_keys.update_one(
                {"user_id": u_obj_id},
                {"$set": {"preferred_model": model, "updated_at": datetime.now(timezone.utc)}},
            )
        except Exception:
            pass

    return plain_key, model
