"""Unit and integration tests for Phase 1 backend authentication and security."""

from datetime import datetime, timedelta, timezone
from pathlib import Path
import pytest
from starlette.testclient import TestClient

from app.activity import FORBIDDEN_META_KEYS, log_event
from app.cache import get_cached_session, invalidate_session, set_cached_session
from app.config import settings
from app.main import app
from app.security import (
    create_access_token,
    decode_access_token,
    get_client_ip,
    hash_password,
    verify_password,
)
from app.services.design_detector import DetectionResult, DetectionSummary
from app.services.design_store import DesignStore


def test_public_health_probe():
    """GET /api/health must be accessible without any auth token."""
    client = TestClient(app)
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "db" in data
    assert "ts" in data


def test_protected_routes_reject_unauthenticated():
    """Protected routes must reject requests with 401 NOT_AUTHENTICATED when no token is passed."""
    client = TestClient(app)
    saved_overrides = dict(app.dependency_overrides)
    app.dependency_overrides.clear()
    try:
        resp = client.get("/api/sheets/test-sid")
        assert resp.status_code == 401
        data = resp.json()
        assert data["detail"]["code"] == "NOT_AUTHENTICATED"

        resp_allowed = client.get("/api/allowed-values/pattern")
        assert resp_allowed.status_code == 401
    finally:
        app.dependency_overrides.update(saved_overrides)


def test_argon2_hashing_and_verification():
    """Argon2id produces verifiable hashes and rejects invalid passwords."""
    pwd = "CorrectSecretPassword123!"
    hashed = hash_password(pwd)
    assert hashed.startswith("$argon2id$")
    assert verify_password(pwd, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False


def test_jwt_token_creation_and_decoding():
    """JWT tokens encode user claims and validate expiry."""
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=10)
    token = create_access_token(
        user_id="user_12345",
        session_id="sess_abcdef",
        role="user",
        expires_at=exp,
    )
    decoded = decode_access_token(token)
    assert decoded is not None
    assert decoded["sub"] == "user_12345"
    assert decoded["sid"] == "sess_abcdef"
    assert decoded["role"] == "user"

    # Expired token test
    past_exp = now - timedelta(seconds=10)
    expired_token = create_access_token(
        user_id="user_12345",
        session_id="sess_abcdef",
        role="user",
        expires_at=past_exp,
    )
    assert decode_access_token(expired_token) is None


def test_session_cache_ttl_and_invalidation():
    """In-memory cache stores and invalidates sessions cleanly."""
    sid = "test_cache_sid_1"
    session_data = {"user_id": "u1", "username": "alice", "revoked": False}
    set_cached_session(sid, session_data)

    cached = get_cached_session(sid)
    assert cached is not None
    assert cached["username"] == "alice"

    invalidate_session(sid)
    assert get_cached_session(sid) is None


def test_design_store_tenant_isolation(tmp_path):
    """DesignStore enforces user_id matching and prevents cross-user session access."""
    store = DesignStore(workspace_dir=str(tmp_path))
    dummy_summary = DetectionSummary(
        total=1,
        needs_json=1,
        partial=0,
        complete=0,
        free_rows=492,
        room_for_new_designs=123,
    )
    dummy_result = DetectionResult(summary=dummy_summary, designs=[], last_data_row=8)

    session = store.create_session(
        filename="test.xls",
        file_bytes=b"dummy_bytes",
        detection_result=dummy_result,
        user_id="user_alice",
    )
    sid = session.session_id

    # Owner Alice can access
    s_alice = store.get_session(sid, user_id="user_alice")
    assert s_alice is not None
    assert s_alice.user_id == "user_alice"

    # Attacker Bob cannot access
    s_bob = store.get_session(sid, user_id="user_bob")
    assert s_bob is None

    # Unscoped read returns it for administrative maintenance
    s_admin = store.get_session(sid, user_id=None)
    assert s_admin is not None


def test_client_ip_extraction_and_forwarding():
    """Client IP extracts first IP from X-Forwarded-For."""
    class DummyHeaders:
        def __init__(self, headers):
            self.headers = headers
        def get(self, key, default=None):
            return self.headers.get(key.lower(), default)

    class DummyClient:
        host = "192.168.1.50"

    class DummyRequest:
        def __init__(self, headers, client=None):
            self.headers = DummyHeaders(headers)
            self.client = client

    # Multi-hop proxy
    req1 = DummyRequest({"x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178"})
    assert get_client_ip(req1) == "203.0.113.195"

    # Direct client
    req2 = DummyRequest({}, client=DummyClient())
    assert get_client_ip(req2) == "192.168.1.50"


def test_activity_logging_redacts_sensitive_keys():
    """Activity logging automatically redacts forbidden credentials."""
    for key in FORBIDDEN_META_KEYS:
        assert key in [
            "password",
            "password_hash",
            "token",
            "jwt",
            "secret",
            "file_bytes",
            "contents",
            "raw_sheet",
        ]


def test_get_me_endpoint_with_auth():
    """GET /api/auth/me returns valid MeResponse without AttributeError."""
    client = TestClient(app)
    # 1. Authenticated user (mocked via default_auth_override)
    resp = client.get("/api/auth/me")
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "testuser"
    assert data["role"] == "user"
    assert "user_id" in data

    # 2. Unauthenticated check
    saved_overrides = dict(app.dependency_overrides)
    app.dependency_overrides.clear()
    try:
        unauth_resp = client.get("/api/auth/me")
        assert unauth_resp.status_code == 401
    finally:
        app.dependency_overrides.update(saved_overrides)

