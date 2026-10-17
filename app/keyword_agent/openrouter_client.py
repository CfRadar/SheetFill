"""BYOK-compatible OpenRouter API Client with dynamic per-request key resolution and error mapping."""

import asyncio
import json
import logging
import random
import re
from typing import Any, Literal, Optional, TypeVar, Union

import httpx
from pydantic import BaseModel, ValidationError

from app.config import settings

logger = logging.getLogger("sheetfill.keyword_agent.openrouter")

T = TypeVar("T", bound=BaseModel)


# --------------------------------------------------------------------------
# Exceptions
# --------------------------------------------------------------------------
class OpenRouterError(Exception):
    """Base exception for OpenRouter operations."""
    def __init__(self, message: str, code: str = "OPENROUTER_ERROR"):
        super().__init__(message)
        self.code = code
        self.message = message


class OpenRouterAuthError(OpenRouterError):
    """Raised when user key is rejected (HTTP 401)."""
    def __init__(self, message: str = "Your OpenRouter API key is invalid or revoked. Please update it in Settings."):
        super().__init__(message, code="OPENROUTER_KEY_INVALID")


class OpenRouterCreditsError(OpenRouterError):
    """Raised when user account lacks credits (HTTP 402)."""
    def __init__(self, message: str = "Your OpenRouter account has insufficient credits for the selected model."):
        super().__init__(message, code="OPENROUTER_INSUFFICIENT_CREDITS")


class OpenRouterRateLimitError(OpenRouterError):
    """Raised when OpenRouter rate limit is exceeded (HTTP 429)."""
    def __init__(self, message: str = "OpenRouter rate limit reached. Please wait a moment before trying again."):
        super().__init__(message, code="OPENROUTER_RATE_LIMITED")


class QuotaExceeded(OpenRouterRateLimitError):
    """Raised when the daily LLM call quota or rate limit is exceeded."""
    pass


class LLMCallError(OpenRouterError):
    """Raised when an LLM call fails across all retry models."""
    def __init__(self, message: str = "LLM invocation failed across all candidate models."):
        super().__init__(message, code="LLM_CALL_FAILED")


class JSONExtractError(ValueError):
    """Raised when JSON cannot be extracted from LLM response text."""
    pass


# --------------------------------------------------------------------------
# JSON Extraction Helpers (from ClothScrapper json_utils)
# --------------------------------------------------------------------------
def extract_balanced_brace(text: str) -> str:
    """Finds the first balanced outermost curly brace pair {...} in text."""
    start_idx = -1
    depth = 0
    in_string = False
    escape = False

    for i, char in enumerate(text):
        if escape:
            escape = False
            continue
        if char == "\\":
            if in_string:
                escape = True
            continue
        if char == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if char == "{":
            if depth == 0:
                start_idx = i
            depth += 1
        elif char == "}":
            if depth > 0:
                depth -= 1
                if depth == 0 and start_idx != -1:
                    return text[start_idx : i + 1]

    raise JSONExtractError("No balanced JSON object {...} found in response text.")


def parse_model(model_cls: type[T], text: str) -> T:
    """Extracts JSON and parses it into a Pydantic model with markdown block fallback."""
    raw = text.strip()

    # Strategy 1: Direct JSON parsing
    try:
        return model_cls.model_validate_json(raw)
    except (ValidationError, ValueError):
        pass

    # Strategy 2: Extract code fence ```json ... ```
    fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
    if fence_match:
        try:
            return model_cls.model_validate_json(fence_match.group(1))
        except (ValidationError, ValueError):
            pass

    # Strategy 3: Outermost balanced brace extraction
    try:
        candidate = extract_balanced_brace(raw)
        return model_cls.model_validate_json(candidate)
    except (JSONExtractError, ValidationError, ValueError) as err:
        raise JSONExtractError(f"Could not parse valid {model_cls.__name__} from LLM response: {err}") from err


# --------------------------------------------------------------------------
# BYOK OpenRouter Client
# --------------------------------------------------------------------------
class OpenRouterClient:
    """
    Client for OpenRouter API taking the user's decrypted key dynamically per request.
    Strictly isolated per-request with zero shared master credentials.
    """

    BASE_URL = "https://openrouter.ai/api/v1"

    DEFAULT_FREE_MODELS = [
        "meta-llama/llama-3.3-70b-instruct:free",
        "google/gemini-2.0-flash-exp:free",
        "mistralai/mistral-small-24b-instruct-2501:free",
        "meta-llama/llama-3.1-8b-instruct:free",
    ]

    def __init__(
        self,
        api_key: str,
        preferred_model: Optional[str] = None,
        timeout_seconds: float = 90.0,
    ):
        self.api_key = api_key.strip()
        self.preferred_model = (preferred_model or settings.keyword_agent_default_model).strip()
        self.timeout_seconds = timeout_seconds
        self.llm_calls_used: int = 0

    def get_models_for_role(self, role: Literal["planner", "analyst", "social"]) -> list[str]:
        """Resolves fallback model chain prioritizing user's preferred model."""
        chain = []
        if self.preferred_model:
            chain.append(self.preferred_model)
        for m in self.DEFAULT_FREE_MODELS:
            if m not in chain:
                chain.append(m)
        return chain

    async def call_chat(
        self,
        messages: list[dict[str, str]],
        role: Literal["planner", "analyst", "social"] = "analyst",
        temperature: float = 0.2,
        max_tokens: int = 2000,
    ) -> str:
        """Sends chat completion with automatic model fallbacks and error mapping."""
        models = self.get_models_for_role(role)
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "HTTP-Referer": settings.frontend_origin,
            "X-Title": "Marketplace Keyword Agent",
            "Content-Type": "application/json",
        }

        last_error = None
        for model in models:
            payload = {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }

            try:
                async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                    resp = await client.post(
                        f"{self.BASE_URL}/chat/completions",
                        headers=headers,
                        json=payload,
                    )

                if resp.status_code == 200:
                    data = resp.json()
                    choices = data.get("choices", [])
                    if choices and "message" in choices[0]:
                        self.llm_calls_used += 1
                        return choices[0]["message"].get("content", "")
                    raise LLMCallError(f"Model '{model}' returned empty choices.")

                elif resp.status_code == 401:
                    logger.error("OpenRouter rejected user key (401 Unauthorized).")
                    raise OpenRouterAuthError()

                elif resp.status_code == 402:
                    logger.error(f"OpenRouter insufficient credits for model '{model}' (402).")
                    raise OpenRouterCreditsError()

                elif resp.status_code == 429:
                    logger.warning(f"OpenRouter rate limit on model '{model}' (429). Trying fallback.")
                    last_error = OpenRouterRateLimitError()
                    await asyncio.sleep(1.0)
                    continue

                else:
                    logger.warning(
                        f"OpenRouter call failed on '{model}' with HTTP {resp.status_code}: {resp.text[:200]}"
                    )
                    last_error = LLMCallError(f"OpenRouter returned status {resp.status_code}.")

            except (OpenRouterAuthError, OpenRouterCreditsError):
                # Critical user credentials errors must not fall back to other models
                raise
            except httpx.RequestError as exc:
                logger.warning(f"Network error calling OpenRouter with '{model}': {exc}")
                last_error = LLMCallError(f"Network error contacting OpenRouter: {exc}")

        if isinstance(last_error, OpenRouterError):
            raise last_error
        raise LLMCallError(str(last_error or "All fallback models failed."))

    async def call_structured(
        self,
        schema_cls: type[T],
        messages: list[dict[str, str]],
        role: Literal["planner", "analyst", "social"] = "analyst",
        temperature: float = 0.2,
    ) -> T:
        """Invokes chat completion and parses response into requested Pydantic schema."""
        raw_text = await self.call_chat(messages=messages, role=role, temperature=temperature)
        return parse_model(schema_cls, raw_text)

    async def chat(
        self,
        role: Literal["planner", "analyst", "social"] = "analyst",
        system: Optional[str] = None,
        user: Optional[str] = None,
        messages: Optional[list[dict[str, str]]] = None,
        schema: Optional[type[T]] = None,
        max_tokens: int = 2000,
        temperature: float = 0.2,
    ) -> Any:
        """
        Unified chat interface expected by agents:
        Takes role, system, user prompt, and optional Pydantic schema.
        If schema is provided, extracts and validates structured JSON.
        """
        msgs: list[dict[str, str]] = list(messages or [])
        if system:
            msgs.insert(0, {"role": "system", "content": system})
        if user:
            msgs.append({"role": "user", "content": user})

        if schema is not None:
            raw_text = await self.call_chat(
                messages=msgs, role=role, temperature=temperature, max_tokens=max_tokens
            )
            return parse_model(schema, raw_text)
        else:
            return await self.call_chat(
                messages=msgs, role=role, temperature=temperature, max_tokens=max_tokens
            )
