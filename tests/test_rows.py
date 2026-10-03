"""Tests for 4-row generator per product design."""

from pathlib import Path
import pytest

from flipkart_filler.allowed_values import load_allowed_values
from flipkart_filler.json_loader import load_products_from_path
from flipkart_filler.mapper import ValueMapper
from flipkart_filler.rows import build_product_rows

ROOT_DIR = Path(__file__).parent.parent
TEMPLATE_PATH = ROOT_DIR / "templates" / "Flipkart_TShirt_Template.xlsm"
CONFIG_DIR = ROOT_DIR / "config"
FIXTURES_DIR = ROOT_DIR / "tests" / "fixtures"


@pytest.fixture(scope="module")
def mapper():
    allowed_dict = load_allowed_values(TEMPLATE_PATH)
    return ValueMapper(
        mappings_path=CONFIG_DIR / "mappings.yaml",
        defaults_path=CONFIG_DIR / "defaults.yaml",
        allowed_values=allowed_dict,
    )


def test_moonlight_row_generation(mapper):
    products = load_products_from_path(FIXTURES_DIR / "moonlight.json")
    moonlight = products[0]

    existing_skus = set()
    rows, issues = build_product_rows(moonlight, mapper, existing_skus)

    errors = [i for i in issues if i.level == "ERROR"]
    assert len(errors) == 0
    assert len(rows) == 4

    sizes = ["S", "M", "L", "XL"]
    for idx, r in enumerate(rows):
        expected_size = sizes[idx]
        assert r.size == expected_size
        assert r.sku == f"moonlight_os_{expected_size}"
        assert r.get("G") == f"moonlight_os_{expected_size}"
        assert r.get("AQ") == "MOONLIGHT-OVERSIZED-01"
        assert r.get("AS") == "Beige"
        assert r.get("AT") == "Cream"
        assert r.get("AL") == "Half Sleeve"
        assert r.get("AK") == "Women"
        assert r.get("BD") == "Front Panel"
        assert r.get("H") == "group 1"
        assert r.get("J") == "Active"
        assert r.get("K") == 1999
        assert r.get("L") == 749
        assert r.get("Y") == f"moonlight_os_{expected_size}"
