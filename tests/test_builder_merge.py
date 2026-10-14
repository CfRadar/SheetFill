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
        "Z", "AA", "AB", "AC", "AE", "AG", "AH", "AI", "AJ", "AK", "AL", "AM", "AN", "AO", "AP",
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
        assert rows[i].get("Y") == "61091000"


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


def test_meta_override_brand_manufacturer_packer_hsn(mapper, moonlight_design, sample_json):
    existing_skus = set()
    meta = {
        "brand": "Custom Brand Apparel",
        "manufacturer": "Custom Textiles Pvt Ltd, Surat",
        "packer": "Custom Packers Logistics, Surat",
        "hsn": "61099010",
    }
    b_res = build_design_rows(
        moonlight_design, sample_json, mapper, existing_skus, meta_override=meta
    )
    assert b_res.status == "ready"
    for r in b_res.rows:
        assert r.get("AG") == "Custom Brand Apparel"
        assert r.get("AB") == "Custom Textiles Pvt Ltd, Surat"
        assert r.get("AC") == "Custom Packers Logistics, Surat"
        assert r.get("Y") == "61099010"


def test_group_id_assignment(mapper, moonlight_design, sample_json):
    # When design.id is d1
    b_res1 = build_design_rows(moonlight_design, sample_json, mapper, set(), design_index=1)
    assert b_res1.status == "ready"
    for r in b_res1.rows:
        assert r.get("H") == "group 1"

    # When design_index is 2
    b_res2 = build_design_rows(moonlight_design, sample_json, mapper, set(), design_index=2)
    assert b_res2.status == "ready"
    for r in b_res2.rows:
        assert r.get("H") == "group 2"

    # When custom group_id is provided in meta
    b_res3 = build_design_rows(
        moonlight_design, sample_json, mapper, set(), meta_override={"group_id": "group 5"}
    )
    assert b_res3.status == "ready"
    for r in b_res3.rows:
        assert r.get("H") == "group 5"


