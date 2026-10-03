"""Tests for builder service covering Section 5 rules."""

import json
from pathlib import Path
import pytest

from app.services.builder import build_design_rows, get_default_mapper
from app.services.design_detector import detect_designs
from app.services.sheet_reader import read_tshirt_sheet

FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture
def mapper():
    template_path = FIXTURES_DIR / "blank_template.xlsm"
    return get_default_mapper(str(template_path))


@pytest.fixture
def moonlight_design():
    sheet = read_tshirt_sheet(str(FIXTURES_DIR / "1_before.xls"))
    res = detect_designs(sheet)
    return res.designs[0]


@pytest.fixture
def sample_json():
    path = FIXTURES_DIR / "moonlight.json"
    return json.loads(path.read_text(encoding="utf-8"))


def test_same_across_sizes(mapper, moonlight_design, sample_json):
    existing_skus = set()
    b_res = build_design_rows(moonlight_design, sample_json, mapper, existing_skus)
    assert b_res.status == "ready"
    assert len(b_res.rows) == 4

    rows = b_res.rows

    # Section 5 Design-level columns
    design_level_cols = [
        "H", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X",
        "Z", "AA", "AB", "AE", "AG", "AH", "AI", "AJ", "AK", "AL", "AM", "AN", "AO", "AP",
        "AQ", "AS", "AT", "AU", "AV", "AW", "AX", "AY", "AZ", "BA", "BE", "BF", "BG",
        "BH", "BJ", "BK", "BM", "BN", "BO"
    ]

    for col in design_level_cols:
        val0 = rows[0].get(col)
        for r in rows[1:]:
            assert r.get(col) == val0, f"Column {col} differs between sizes: {val0} != {r.get(col)}"

    # Per-size columns must differ or match size
    sizes = ["S", "M", "L", "XL"]
    for i, size in enumerate(sizes):
        assert rows[i].get("AR") == size
        assert rows[i].get("G") == f"{moonlight_design.base}_{size}"
        assert rows[i].get("Y") == f"{moonlight_design.base}_{size}"

    # Detail placement BD written on S only by default
    assert rows[0].get("BD") is not None
    assert rows[1].get("BD") is None
    assert rows[2].get("BD") is None
    assert rows[3].get("BD") is None


def test_detail_placement_all(mapper, moonlight_design, sample_json):
    sample_json["detail_placement_rows"] = "all"
    sample_json["detail_placement"] = "Front Panel"
    existing_skus = set()
    b_res = build_design_rows(moonlight_design, sample_json, mapper, existing_skus)
    assert b_res.status == "ready"
    for r in b_res.rows:
        assert r.get("BD") == "Front Panel"


def test_stub_base_wins_over_json_base(mapper, moonlight_design, sample_json):
    sample_json["sku_base"] = "different_base_from_json"
    existing_skus = set()
    b_res = build_design_rows(moonlight_design, sample_json, mapper, existing_skus)
    assert b_res.status == "ready"
    # Stub base must win
    assert b_res.rows[0].sku == f"{moonlight_design.base}_S"
    assert any("differs from sheet base" in w.message for w in b_res.warnings)


def test_duplicate_sku_blocked(mapper, moonlight_design, sample_json):
    existing_skus = {f"{moonlight_design.base}_S"}
    b_res = build_design_rows(moonlight_design, sample_json, mapper, existing_skus)
    assert b_res.status == "blocked"
    assert any("Duplicate Seller SKU ID" in e.message for e in b_res.errors)
