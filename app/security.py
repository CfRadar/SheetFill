"""Security utilities: Argon2 hashing, JWT handling, and IP extraction."""

from datetime import datetime, timezone
import hashlib
import hmac
from typing import Any, Dict, Optional
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError
from fastapi import Request
import jwt

from app.config import settings

_ph = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
)


def hash_password(password: str) -> str:
    """Hashes a plaintext password using Argon2id."""
    return _ph.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plaintext password against an Argon2 hash in constant time."""
    try:
        return _ph.verify(hashed_password, plain_password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def hash_token(token: str) -> str:
    """Computes SHA-256 hash of a session token for secure database storage."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def constant_time_compare(val1: str, val2: str) -> bool:
    """Compares two strings in constant time to prevent timing attacks."""
    return hmac.compare_digest(val1.encode("utf-8"), val2.encode("utf-8"))


def create_access_token(
    user_id: str,
    session_id: str,
    role: str = "user",
    expires_at: Optional[datetime] = None,
) -> str:
    """Creates a signed JWT access token."""
    if expires_at is None:
        raise ValueError("Token expiration timestamp is required.")

    # Ensure UTC timestamp
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    payload: Dict[str, Any] = {
        "sub": str(user_id),
        "sid": str(session_id),
        "role": str(role),
        "exp": int(expires_at.timestamp()),
        "iat": int(datetime.now(timezone.utc).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodes and validates a JWT token. Returns payload dict or None if invalid/expired."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"],
            options={"require": ["sub", "sid", "role", "exp"]},
        )
        return payload
    except (jwt.PyJWTError, Exception):
        return None


def get_client_ip(request: Request) -> str:
    """Extracts client IP from X-Forwarded-For (Render reverse proxy) or fallback to host."""
    xff = request.headers.get("x-forwarded-for")
    if xff:
        # First IP in XFF is the true client origin
        first_ip = xff.split(",")[0].strip()
        if first_ip:
            return first_ip
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"


def get_client_user_agent(request: Request) -> str:
    """Returns User-Agent header from request or fallback."""
    return request.headers.get("user-agent", "Unknown Device")
