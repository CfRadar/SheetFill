"""Pytest configuration and global fixtures."""

import pytest
from app.auth import CurrentUser, require_user
from app.main import app


@pytest.fixture(autouse=True)
def default_auth_override():
    """Default fixture to authenticate requests in existing integration tests."""
    app.dependency_overrides[require_user] = lambda: CurrentUser(
        id="test_user_id",
        username="testuser",
        display_name="Test User",
        role="user",
        session_id="test_sess_123",
    )
    yield
    app.dependency_overrides.clear()
