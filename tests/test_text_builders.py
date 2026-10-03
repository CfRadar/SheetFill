"""Tests for deterministic text builders (Description, Keywords, Key Features, Fabric Care)."""

from pathlib import Path
import pytest

from flipkart_filler.allowed_values import load_allowed_values
from flipkart_filler.json_loader import load_products_from_path
from flipkart_filler.text_builders import (
    build_description,
    build_fabric_care,
    build_key_features,
    build_search_keywords,
)

FIXTURES_DIR = Path(__file__).parent / "fixtures"
TEMPLATE_PATH = Path(__file__).parent.parent / "templates" / "Flipkart_TShirt_Template.xlsm"


@pytest.fixture(scope="module")
def moonlight_product():
    return load_products_from_path(FIXTURES_DIR / "moonlight.json")[0]


def test_description_layout(moonlight_product):
    desc, warn = build_description(moonlight_product)
    assert warn is None
    assert desc.startswith(moonlight_product.product_title)
    assert "Key Features:\n" in desc
    assert "Style: Oversized" in desc
    assert "Color: Cream" in desc
    assert "Pattern: Graphic Print" in desc
    assert "Neck: Round Neck" in desc
    assert "Sleeve: Short Sleeve" in desc
    assert "Print Placement: Front Only" in desc
    assert "  " not in desc  # No double spaces
    assert len(desc) <= 10000


def test_search_keywords(moonlight_product):
    keywords = build_search_keywords(moonlight_product)
    terms = keywords.split("::")
    assert 4 <= len(terms) <= 8
    for term in terms:
        assert len(term) <= 40
    assert "Graphic Print" in terms
    assert "T-Shirt" in terms


def test_key_features(moonlight_product):
    features = build_key_features(moonlight_product)
    items = features.split("::")
    assert len(items) <= 6
    for item in items:
        assert len(item) <= 40
        # Should not include Gender, Care, or Occasion
        assert "Unisex" not in item
        assert "Wash" not in item


def test_fabric_care_mapping(moonlight_product):
    allowed_dict = load_allowed_values(TEMPLATE_PATH)
    care_str = build_fabric_care(moonlight_product, allowed_care_values=allowed_dict.get("fabric care"))
    care_items = care_str.split("::")

    assert "Regular Machine Wash" in care_items
    assert "Wash with like colors" in care_items
    assert "Do not Iron on print/embroidery/embellishment" in care_items
    assert "Reverse and dry" in care_items
