"""Tests for SSRF domain allowlisting and CSV formula injection prevention."""

import pytest
from app.keyword_agent.security import (
    ALLOWLISTED_HOSTS,
    SSRFError,
    escape_csv_cell,
    validate_url,
)


def test_ssrf_allows_legitimate_domains():
    validate_url("https://amazon.in/s?k=tshirt")
    validate_url("https://www.flipkart.com/search?q=tshirt")
    validate_url("https://myntra.com/men-tshirts")
    validate_url("https://meesho.com/search?q=tshirt")
    validate_url("https://openrouter.ai/api/v1/models")


def test_ssrf_rejects_non_allowlisted_domains():
    with pytest.raises(SSRFError, match="not in the outbound allowlist"):
        validate_url("https://evil-attacker-site.com/steal")

    with pytest.raises(SSRFError, match="not in the outbound allowlist"):
        validate_url("https://google.com")


def test_ssrf_rejects_insecure_scheme():
    with pytest.raises(SSRFError, match="Only https is permitted"):
        validate_url("http://amazon.in")

    with pytest.raises(SSRFError, match="Only https is permitted"):
        validate_url("file:///etc/passwd")


def test_csv_injection_formula_escaped():
    assert escape_csv_cell("=1+1") == "'=1+1"
    assert escape_csv_cell("+cmd|' /C calc'!A0") == "'+cmd|' /C calc'!A0"
    assert escape_csv_cell("-2+3") == "'-2+3"
    assert escape_csv_cell("@SUM(1,2)") == "'@SUM(1,2)"
    assert escape_csv_cell("\tTabbedText") == "'\tTabbedText"
    assert escape_csv_cell("\rCarriageReturn") == "'\rCarriageReturn"


def test_csv_injection_normal_cells_untouched():
    assert escape_csv_cell("Men Black T-Shirt") == "Men Black T-Shirt"
    assert escape_csv_cell("Oversized, Cotton") == "Oversized, Cotton"
    assert escape_csv_cell("") == ""
    assert escape_csv_cell(None) is None
