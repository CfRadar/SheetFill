"""Integration tests for Keyword Agent route auth, BYOK error codes, and tenant isolation."""

import pytest
from httpx import ASGITransport, AsyncClient
from unittest.mock import AsyncMock, patch

from app.auth import CurrentUser, _get_current_authenticated_user, require_user
from app.main import app
from app.keyword_agent.openrouter_client import (
    OpenRouterAuthError,
    OpenRouterCreditsError,
    OpenRouterRateLimitError,
)


@pytest.mark.asyncio
async def test_unauthenticated_requests_rejected():
    """Confirms unauthenticated requests receive 401 across all keyword agent endpoints."""
    # Temporarily remove dependency overrides
    saved_overrides = dict(app.dependency_overrides)
    app.dependency_overrides.clear()

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            endpoints = [
                ("GET", "/api/keyword-agent/settings/openrouter-key"),
                ("PUT", "/api/keyword-agent/settings/openrouter-key"),
                ("DELETE", "/api/keyword-agent/settings/openrouter-key"),
                ("POST", "/api/keyword-agent/settings/openrouter-key/test"),
                ("GET", "/api/keyword-agent/models"),
                ("POST", "/api/keyword-agent/runs"),
                ("GET", "/api/keyword-agent/runs/run_dummy123/events"),
                ("GET", "/api/keyword-agent/runs/run_dummy123"),
                ("POST", "/api/keyword-agent/runs/run_dummy123/cancel"),
                ("POST", "/api/keyword-agent/runs/run_dummy123/chat"),
                ("GET", "/api/keyword-agent/system/preflight"),
                ("GET", "/api/keyword-agent/sources"),
            ]

            for method, path in endpoints:
                if method == "GET":
                    resp = await client.get(path)
                elif method == "POST":
                    resp = await client.post(path, json={})
                elif method == "PUT":
                    resp = await client.put(path, json={})
                elif method == "DELETE":
                    resp = await client.delete(path)
                assert resp.status_code == 401, f"Expected 401 on unauthenticated {method} {path}, got {resp.status_code}"
    finally:
        app.dependency_overrides.update(saved_overrides)


@pytest.mark.asyncio
async def test_run_creation_fails_when_user_has_no_key():
    """Confirms creating a run without a configured key returns 402 with OPENROUTER_KEY_MISSING."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with patch("app.keyword_agent.router.resolve_user_openrouter_key", new_callable=AsyncMock) as mock_resolve:
            mock_resolve.return_value = (None, None)

            brief_payload = {
                "platforms": ["amazon"],
                "tshirt_type": "Oversized T-Shirt",
                "color": "Black",
                "gender": "men",
            }
            resp = await client.post("/api/keyword-agent/runs", json=brief_payload)

            assert resp.status_code == 402
            data = resp.json()
            assert data["detail"]["code"] == "OPENROUTER_KEY_MISSING"


@pytest.mark.asyncio
async def test_key_status_endpoint_never_exposes_key():
    """Confirms key status returns only metadata and masked last4, never plaintext key."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with patch("app.keyword_agent.router.get_user_key_status", new_callable=AsyncMock) as mock_status:
            mock_status.return_value = {
                "configured": True,
                "last4": "9a2f",
                "preferred_model": "meta-llama/llama-3.3-70b-instruct:free",
                "last_verified_at": "2026-10-17T12:00:00Z",
            }

            resp = await client.get("/api/keyword-agent/settings/openrouter-key")
            assert resp.status_code == 200
            data = resp.json()

            assert data["configured"] is True
            assert data["last4"] == "9a2f"
            assert "api_key" not in data
            assert "encrypted_key" not in data
            assert "key" not in data


@pytest.mark.asyncio
async def test_cross_tenant_run_isolation():
    """Confirms User A cannot view or chat on a run owned by User B."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Mock database returning a run owned by 'different_user_999'
        with patch("app.keyword_agent.router.is_db_connected", return_value=True), \
             patch("app.keyword_agent.router.get_db") as mock_get_db:

            mock_db = AsyncMock()
            mock_db.keyword_agent_runs.find_one.return_value = {
                "run_id": "run_secret_b",
                "user_id": "different_user_999",
                "status": "completed",
            }
            mock_get_db.return_value = mock_db

            # Current authenticated user is 'test_user_id' from conftest fixture
            resp = await client.get("/api/keyword-agent/runs/run_secret_b")
            assert resp.status_code == 403


@pytest.mark.asyncio
async def test_openrouter_error_mapping():
    """Verifies OpenRouter exceptions map cleanly to user-friendly HTTP errors."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with patch("app.keyword_agent.router.resolve_user_openrouter_key", new_callable=AsyncMock) as mock_key, \
             patch("app.keyword_agent.router.acquire_user_run_slot", new_callable=AsyncMock):

            mock_key.return_value = ("sk-or-v1-fakekeyforunitest12345678", None)

            # Test OpenRouterAuthError -> 401
            with patch("app.keyword_agent.openrouter_client.OpenRouterClient.call_chat", side_effect=OpenRouterAuthError()):
                with patch("app.keyword_agent.router._get_user_run_doc", return_value={"result": {"titles": []}, "user_id": "test_user_id"}):
                    resp = await client.post("/api/keyword-agent/runs/run_1/chat", json={"message": "more modern"})
                    assert resp.status_code == 401
                    assert resp.json()["detail"]["code"] == "OPENROUTER_KEY_INVALID"

            # Test OpenRouterCreditsError -> 402
            with patch("app.keyword_agent.openrouter_client.OpenRouterClient.call_chat", side_effect=OpenRouterCreditsError()):
                with patch("app.keyword_agent.router._get_user_run_doc", return_value={"result": {"titles": []}, "user_id": "test_user_id"}):
                    resp = await client.post("/api/keyword-agent/runs/run_1/chat", json={"message": "more modern"})
                    assert resp.status_code == 402
                    assert resp.json()["detail"]["code"] == "OPENROUTER_INSUFFICIENT_CREDITS"
