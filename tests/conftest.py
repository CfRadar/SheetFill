"""Pytest configuration and global fixtures."""

import pytest
from app.auth import CurrentUser, _get_current_authenticated_user, require_user
from app.main import app


@pytest.fixture(autouse=True)
def default_auth_override():
    """Default fixture to authenticate requests in existing integration tests."""
    mock_user = lambda: CurrentUser(
        id="test_user_id",
        username="testuser",
        display_name="Test User",
        role="user",
        session_id="test_sess_123",
    )
    app.dependency_overrides[require_user] = mock_user
    app.dependency_overrides[_get_current_authenticated_user] = mock_user
    yield
    app.dependency_overrides.clear()
