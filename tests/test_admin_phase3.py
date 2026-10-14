"""Unit and integration tests for Phase 3 Admin API."""

from datetime import datetime, timedelta, timezone
from bson import ObjectId
import pytest
from starlette.testclient import TestClient

from app.auth import CurrentUser, require_admin, require_user
from app.config import settings
from app.main import app
from app.security import create_access_token, hash_password


def test_admin_routes_reject_unauthenticated():
    """Admin routes reject unauthenticated requests with 401."""
    client = TestClient(app)
    saved = dict(app.dependency_overrides)
    app.dependency_overrides.clear()
    try:
        resp = client.get("/api/admin/users")
        assert resp.status_code == 401
    finally:
        app.dependency_overrides.update(saved)


def test_admin_routes_reject_standard_user():
    """Admin routes reject standard users (role='user') with 403 FORBIDDEN."""
    client = TestClient(app)
    saved = dict(app.dependency_overrides)
    # Provide standard user mock
    app.dependency_overrides[require_user] = lambda: CurrentUser(
        id="test_normal_user",
        username="normal_seller",
        display_name="Normal Seller",
        role="user",
        session_id="sess_123",
    )
    # Remove require_admin override so real dependency runs
    if require_admin in app.dependency_overrides:
        del app.dependency_overrides[require_admin]

    try:
        resp = client.get("/api/admin/users")
        assert resp.status_code == 403
        data = resp.json()
        assert data["detail"]["code"] == "FORBIDDEN"
    finally:
        app.dependency_overrides.update(saved)


def test_admin_login_rejects_invalid_password():
    """Admin login rejects invalid credentials with 401."""
    client = TestClient(app)
    saved = dict(app.dependency_overrides)
    app.dependency_overrides.clear()
    try:
        resp = client.post(
            "/api/admin/login",
            json={"username": settings.admin_username, "password": "WrongAdminPassword!"},
        )
        assert resp.status_code == 401
        data = resp.json()
        assert data["detail"]["code"] == "INVALID_CREDENTIALS"
    finally:
        app.dependency_overrides.update(saved)
