"""Tests for value mapping, canonical casing, and RapidFuzz suggestions."""

from pathlib import Path
import pytest

from flipkart_filler.allowed_values import load_allowed_values
from flipkart_filler.mapper import ValueMapper

ROOT_DIR = Path(__file__).parent.parent
TEMPLATE_PATH = ROOT_DIR / "templates" / "Flipkart_TShirt_Template.xlsm"
CONFIG_DIR = ROOT_DIR / "config"


@pytest.fixture(scope="module")
def mapper():
    allowed_dict = load_allowed_values(TEMPLATE_PATH)
    return ValueMapper(
        mappings_path=CONFIG_DIR / "mappings.yaml",
        defaults_path=CONFIG_DIR / "defaults.yaml",
        allowed_values=allowed_dict,
    )


def test_sleeve_mapping(mapper):
    val, issue = mapper.map_attribute("sleeve", "Short Sleeve")
    assert issue is None
    assert val == "Half Sleeve"


def test_ideal_for_unisex_default(mapper):
    val, issue = mapper.map_attribute("ideal_for", "Men and Women")
    assert issue is None
    assert val == "Women"


def test_color_mapping(mapper):
    val, issue = mapper.map_attribute("color", "Cream")
    assert issue is None
    assert val == "Beige"


def test_pattern_canonical_casing(mapper):
    val, issue = mapper.map_attribute("pattern", "graphic print")
    assert issue is None
    assert val == "Graphic Print"


def test_unknown_color_suggestions(mapper):
    val, issue = mapper.map_attribute("color", "Lavender2")
    assert val is None
    assert issue is not None
    assert issue.level == "ERROR"
    assert len(issue.suggestions) > 0
    assert "Lavender2" in issue.message
