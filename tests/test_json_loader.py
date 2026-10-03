"""Tests for tolerant JSON loading, repairing, and validation."""

from pathlib import Path
import pytest

from flipkart_filler.json_loader import JSONLoadError, load_products_from_path, sanitize_json_text
from flipkart_filler.models import ProductInput

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def test_sanitize_smart_quotes():
    raw = '“product_title”: “Oversized ‘T-Shirt’”, “color”: “Black”'
    cleaned = sanitize_json_text(raw)
    assert '“' not in cleaned
    assert '”' not in cleaned
    assert '"product_title": "Oversized \'T-Shirt\'", "color": "Black"' == cleaned


def test_sanitize_broken_parens():
    raw = '''"key_features": \\(
        "Design: Graphic",
        "Color: Cream"
    \\)'''
    cleaned = sanitize_json_text(raw)
    assert "[" in cleaned
    assert "]" in cleaned
    assert "\\(" not in cleaned


def test_sanitize_trailing_commas():
    import json
    raw = '{"a": 1, "b": [2, 3, ], }'
    cleaned = sanitize_json_text(raw)
    assert json.loads(cleaned) == {"a": 1, "b": [2, 3]}


def test_load_valid_moonlight():
    products = load_products_from_path(FIXTURES_DIR / "moonlight.json")
    assert len(products) == 1
    p = products[0]
    assert p.product_title == "Unisex Oversized Moonlight Printed T-Shirt for Men and Women"
    assert p.style_code == "MOONLIGHT-OVERSIZED-01"
    assert p.color == "Cream"
    assert len(p.key_features) == 10


def test_load_moonlight_broken_parens():
    products = load_products_from_path(FIXTURES_DIR / "moonlight_broken_parens.json")
    assert len(products) == 1
    p = products[0]
    assert len(p.key_features) == 10
    assert p.style_code == "MOONLIGHT-OVERSIZED-01"


def test_load_batch_json():
    products = load_products_from_path(FIXTURES_DIR / "batch.json")
    assert len(products) == 2
    assert products[0].style_code == "MOONLIGHT-OVERSIZED-01"
    assert products[1].style_code == "SOLID-BLACK-02"


def test_load_missing_required_key(tmp_path):
    bad_json = tmp_path / "bad.json"
    bad_json.write_text('{"product_title": "Missing fields"}', encoding="utf-8")
    with pytest.raises(ValueError) as excinfo:
        load_products_from_path(bad_json)
    assert "Validation failed" in str(excinfo.value)


def test_load_utf8_bom(tmp_path):
    bom_json = tmp_path / "bom.json"
    content = (FIXTURES_DIR / "moonlight.json").read_text(encoding="utf-8")
    bom_json.write_bytes(b"\xef\xbb\xbf" + content.encode("utf-8"))
    products = load_products_from_path(bom_json)
    assert len(products) == 1
    assert products[0].style_code == "MOONLIGHT-OVERSIZED-01"
