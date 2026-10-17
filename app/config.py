"""Application configuration and environment variable loading."""

import os
from pathlib import Path
import sys
from typing import Optional
from pydantic import BaseModel


def _load_env_file() -> None:
    """Loads key-value pairs from .env into os.environ if not already set."""
    base_dir = Path(__file__).resolve().parent.parent
    env_file = base_dir / ".env"
    if not env_file.exists():
        return

    try:
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip("'\"")
                if k not in os.environ:
                    os.environ[k] = v
    except Exception as e:
        print(f"Warning: Failed to load .env file: {e}", file=sys.stderr)


_load_env_file()


class Settings(BaseModel):
    mongodb_uri: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    mongodb_db: str = os.getenv("MONGODB_DB", "sheetfill")
    jwt_secret: str = os.getenv("JWT_SECRET", "dev_secret_key_change_in_production_min_32_chars")
    admin_username: str = os.getenv("ADMIN_USERNAME", "admin")
    admin_password_hash: str = os.getenv("ADMIN_PASSWORD_HASH", "")
    frontend_origin: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
    access_token_minutes: int = int(os.getenv("ACCESS_TOKEN_MINUTES", "480"))
    session_policy: str = os.getenv("SESSION_POLICY", "replace").lower()
    env: str = os.getenv("ENV", "development").lower()
    max_upload_mb: int = int(os.getenv("MAX_UPLOAD_MB", "10"))

    # Keyword Agent (BYOK & Per-User Settings)
    keyword_agent_encryption_key: str = os.getenv("KEYWORD_AGENT_ENCRYPTION_KEY", "")
    keyword_agent_default_model: str = os.getenv("KEYWORD_AGENT_DEFAULT_MODEL", "meta-llama/llama-3.3-70b-instruct:free")
    keyword_agent_allowed_models: list[str] = [
        "meta-llama/llama-3.3-70b-instruct:free",
        "google/gemini-2.0-flash-exp:free",
        "mistralai/mistral-small-24b-instruct-2501:free",
        "meta-llama/llama-3.1-8b-instruct:free",
        "anthropic/claude-3.5-haiku",
        "openai/gpt-4o-mini",
        "deepseek/deepseek-chat",
    ]
    keyword_agent_hourly_run_limit: int = int(os.getenv("KEYWORD_AGENT_HOURLY_RUN_LIMIT", "10"))
    keyword_agent_rpm_limit: int = int(os.getenv("KEYWORD_AGENT_RPM_LIMIT", "15"))

    def validate_production(self) -> None:
        """Enforces mandatory variables when running in production."""
        if self.env == "production":
            errors = []
            if not os.getenv("MONGODB_URI"):
                errors.append("MONGODB_URI is required in production.")
            if not os.getenv("JWT_SECRET") or len(self.jwt_secret) < 32:
                errors.append("JWT_SECRET must be set to a secure string with at least 32 characters in production.")
            if not self.admin_password_hash:
                errors.append("ADMIN_PASSWORD_HASH is required in production.")
            if not self.keyword_agent_encryption_key:
                errors.append("KEYWORD_AGENT_ENCRYPTION_KEY is required in production for BYOK encryption at rest.")
            if errors:
                error_msg = "\n".join(f" - {e}" for e in errors)
                raise RuntimeError(f"Startup Configuration Errors:\n{error_msg}")


settings = Settings()


def get_settings() -> Settings:
    """Returns application settings singleton."""
    return settings

