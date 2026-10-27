"""End-to-end and unit tests for the Sweatshirt sheet filling pipeline."""

import os
from pathlib import Path
import pytest
from starlette.testclient import TestClient
import xlrd

from app.main import app
from app.services.builder import build_design_rows, get_default_mapper
from app.services.design_detector import DetectedDesign, detect_designs
from app.services.sheet_reader import read_tshirt_sheet
from app.services.writer import rebuild_tshirt_workbook

SWEATSHIRT_SAMPLE = Path(__file__).resolve().parent.parent.parent / "C_sweatshirt_810b72b2a99846d1_2510-1554FK_REQXKQO6QIEHF.xls"
TEMPLATE_SWEAT = Path(__file__).resolve().parent.parent / "templates" / "Flipkart_Sweatshirt_Template.xls"


def test_sweatshirt_sheet_reader_and_detection():
    """Verify that sweatshirt sheet is detected as 79 columns with correct slots and stubs."""
    assert SWEATSHIRT_SAMPLE.exists(), f"Sample file not found at {SWEATSHIRT_SAMPLE}"
    assert TEMPLATE_SWEAT.exists(), f"Template not found at {TEMPLATE_SWEAT}"

    raw = read_tshirt_sheet(str(SWEATSHIRT_SAMPLE))
    assert raw.sheet_name == "sweatshirt"
    assert raw.product_type == "sweatshirt"
    assert len(raw.headers) == 79
    assert "Main Image URL" in raw.headers["AX"]
    assert "Other Image URL 4" in raw.headers["BB"]
    assert "Palette Image URL" in raw.headers["BC"]
    assert raw.headers["CA"] == "Supplier Image"

    res = detect_designs(raw)
    assert len(res.designs) >= 1
    d = res.designs[0]
    assert d.base == "sweatblack_os"
    # Should have extracted 4 images from AX..BA
    assert len(d.image_urls) >= 5
    assert d.image_urls[0] is not None and "http" in d.image_urls[0]
    assert d.image_urls[1] is not None and "http" in d.image_urls[1]
    assert d.image_urls[2] is not None and "http" in d.image_urls[2]
    assert d.image_urls[3] is not None and "http" in d.image_urls[3]


def test_sweatshirt_row_building_and_writer(tmp_path):
    """Verify building 79-column sweatshirt rows and generating a non-corrupt .xls workbook."""
    raw = read_tshirt_sheet(str(SWEATSHIRT_SAMPLE))
    res = detect_designs(raw)
    d = res.designs[0]

    mapper = get_default_mapper(str(TEMPLATE_SWEAT), product_type="sweatshirt")
    json_data = {
        "product_title": "Men Graphic Print Hooded Sweatshirt",
        "product_description": "Stay warm and stylish in this premium fleece hooded sweatshirt. Designed with graphic print, full sleeves, and ribbed cuffs for maximum comfort.",
        "key_features": [
            "Fabric: Premium Warm Fleece",
            "Fit: Modern Streetwear Fit",
            "Neck: Attached Hood with Drawstrings",
            "Sleeve: Full Sleeves with Cuffed Hems",
            "Design: Front Panel Graphic Print",
            "Closure: Slip-on No Closure",
            "Color: Solid Black Shade",
            "Gender: Men",
            "Occasion: Casual Winter Wear",
            "Care: Machine wash cold inside out",
        ],
        "material": "Fleece",
        "pattern": "Graphic Print",
        "sleeve_type": "Full Sleeve",
        "neck_type": "Hooded Neck",
        "closure": "No Closure",
        "hooded": "Yes",
        "ideal_for": "Men",
        "color": "Black",
        "brand_color": "Black",
        "style_code": "MEN-SWEAT-BLK-01",
        "mrp": 2499,
        "selling_price": 999,
        "occasion": "Casual",
    }

    meta = {
        "brand": "Roadster",
        "manufacturer": "Apparel Corp",
        "packer": "Packer India",
        "hsn": "6102",
    }

    b_res = build_design_rows(
        design=d,
        json_data=json_data,
        mapper=mapper,
        existing_skus_in_session=set(),
        meta_override=meta,
        design_index=1,
        product_type="sweatshirt",
    )

    assert b_res.status == "ready"
    assert len(b_res.rows) == 4
    for r in b_res.rows:
        assert r.cells["AH"] == 1  # Pack of
        assert r.cells["AI"] == "Fleece"  # Fabric
        assert r.cells["AJ"] == "Graphic Print"  # Pattern
        assert r.cells["AK"] == "No"  # Reversible
        assert r.cells["AL"] == "Full Sleeve"  # Sleeve
        assert r.cells["AM"] == "Men"  # Ideal For
        assert r.cells["AO"] == "Yes"  # Hooded
        assert r.cells["AP"] == "No Closure"  # Closure
        assert r.cells["AQ"] == "Hooded Neck"  # Neck
        assert r.cells["AR"] == "Western Wear"  # Suitable For
        assert r.cells["AT"] == "Regular"  # Brand Size - Measuring Unit
        assert r.cells["AU"] == "MEN-SWEAT-BLK-01"  # Style Code
        assert r.cells["AV"] == "Black"  # Color
        assert r.cells["AW"] == "Black"  # Brand Color
        assert r.cells["AX"] == d.image_urls[0]  # Main Image in AX!
        assert r.cells["BL"] == "1 Sweatshirt"  # Items Included
        assert r.cells["BR"] == "None"  # Surface Styling (valid sweatshirt value)
        assert r.cells["BT"] == "Heavy Winter"  # Winter Type
        assert r.cells["BW"]  # Description in BW!

    # Rebuild workbook
    out_xls = tmp_path / "sweatshirt_output.xls"
    ready_map = {d.id: b_res.rows}
    out_file, report = rebuild_tshirt_workbook(
        master_template_path=str(TEMPLATE_SWEAT),
        output_path=str(out_xls),
        designs=res.designs,
        ready_rows_map=ready_map,
        mode="ready_only",
        product_type="sweatshirt",
    )

    assert os.path.exists(out_file)
    with open(out_file, "rb") as f:
        magic = f.read(8)
    assert magic.startswith(b"\xd0\xcf\x11\xe0")

    # Re-read and verify integrity
    wb = xlrd.open_workbook(out_file)
    assert "sweatshirt" in wb.sheet_names()
    sh = wb.sheet_by_name("sweatshirt")
    assert sh.ncols == 79
    # Check row 5 (0-indexed 4)
    assert sh.cell_value(4, 33) == 1  # Col AH (33) = Pack of
    assert sh.cell_value(4, 34) == "Fleece"  # Col AI (34) = Fabric
    assert sh.cell_value(4, 35) == "Graphic Print"  # Col AJ (35) = Pattern
    assert sh.cell_value(4, 40) == "Yes"  # Col AO (40) = Hooded
    assert sh.cell_value(4, 41) == "No Closure"  # Col AP (41) = Closure
    assert sh.cell_value(4, 42) == "Hooded Neck"  # Col AQ (42) = Neck
    assert sh.cell_value(4, 45) == "Regular"  # Col AT (45) = Measuring Unit
    assert sh.cell_value(4, 49) == d.image_urls[0]  # Col AX (49) = Main Image
    assert sh.cell_value(4, 69) == "None"  # Col BR (69) = Surface Styling


client = TestClient(app)


def test_sweatshirt_api_flow():
    """Test API endpoints for sweatshirt sheet upload, template, json assignment, and generation."""
    with open(SWEATSHIRT_SAMPLE, "rb") as f:
        resp = client.post(
            "/api/sheets/analyze",
            files={"file": ("sample_sweat.xls", f, "application/vnd.ms-excel")},
        )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["product_type"] == "sweatshirt"
    assert data["sheet_name"] == "sweatshirt"
    sid = data["session_id"]
    did = data["designs"][0]["id"]

    # Template
    tpl_resp = client.get(f"/api/sheets/{sid}/designs/{did}/json-template")
    assert tpl_resp.status_code == 200
    tpl_data = tpl_resp.json()
    assert tpl_data["hooded"] in ("Yes", "No")
    assert tpl_data["closure"] == "No Closure"
    assert "Neck" in tpl_data["neck_type"]

    # Put JSON
    put_resp = client.put(
        f"/api/sheets/{sid}/designs/{did}/json",
        json={
            "raw_text": """{
                "product_title": "Men Graphic Print Hooded Sweatshirt",
                "product_description": "Cozy warm fleece winter sweatshirt for men with front graphic print.",
                "key_features": ["Fabric: Fleece", "Fit: Regular", "Neck: Hooded Neck", "Gender: Men"],
                "material": "Fleece",
                "pattern": "Graphic Print",
                "sleeve_type": "Full Sleeve",
                "neck_type": "Hooded Neck",
                "closure": "No Closure",
                "hooded": "Yes",
                "ideal_for": "Men",
                "color": "Black",
                "brand_color": "Black",
                "style_code": "MEN-SWEAT-BLK-01",
                "mrp": 2499,
                "selling_price": 999,
                "occasion": "Casual"
            }"""
        },
    )
    assert put_resp.status_code == 200
    pdata = put_resp.json()
    assert pdata["status"] == "ready"
    assert len(pdata["preview_rows"]) == 4

    # Generate .xls
    gen_resp = client.post(
        f"/api/sheets/{sid}/generate",
        json={"mode": "ready_only"},
    )
    assert gen_resp.status_code == 200
    gdata = gen_resp.json()
    assert gdata["filename"].endswith(".xls")

    # Download .xls
    dl_resp = client.get(f"/api/sheets/{sid}/download")
    assert dl_resp.status_code == 200
    assert dl_resp.content.startswith(b"\xd0\xcf\x11\xe0")


def test_sweatshirt_and_tshirt_qualifiers_and_surface_styling():
    """Verify that:
    1. Sweatshirt with Women / Men ideal_for gets 'Regular' qualifier in Col AT.
    2. Sweatshirt with Boys / Girls kidswear gets 'Kids' qualifier in Col AT.
    3. Sweatshirt with numeric size gets 'Number' qualifier in Col AT.
    4. Sweatshirt surface styling invalid values (like 'Typography' or 'Casual') fall back to 'None',
       matching Flipkart allowed values: [Applique, Bow, Braids, Button Flap Pocket, Crochets & Schiffily,
       Cut-Outs, Fringed, Knots, Laces, None, Pockets, Ruffled, Sequined, Tie-Ups].
    5. T-Shirt Col AR gets size directly without qualifier column, and Col BJ gets valid T-shirt surface styling.
    """
    mapper_sweat = get_default_mapper(str(TEMPLATE_SWEAT), product_type="sweatshirt")
    d_stub = DetectedDesign(
        id="d1",
        kind="stub",
        status="needs_json",
        sheet_rows=[5, 6, 7, 8],
        image_urls=["https://example.com/img1.jpg"],
        existing_values={"BJ": "Casual", "BR": ""},
    )

    # 1. Women adult sweatshirt -> Col AT must be "Regular", Col BR must be "None"
    json_women = {
        "product_title": "Women Cozy Fleece Sweatshirt",
        "product_description": "Stylish typography print warm fleece sweatshirt for women",
        "key_features": ["Soft fleece", "Warm"],
        "material": "Fleece",
        "pattern": "Solid",
        "sleeve_type": "Full Sleeve",
        "neck_type": "Round Neck",
        "fit_type": "Regular",
        "ideal_for": "Women",
        "color": "Pink",
        "style_code": "WMN-SWEAT-01",
        "surface_styling": "Typography",  # invalid in sweatshirt!
    }
    res_women = build_design_rows(
        design=d_stub,
        json_data=json_women,
        mapper=mapper_sweat,
        existing_skus_in_session=set(),
        custom_sizes=["S", "M", "L", "XL"],
        product_type="sweatshirt",
    )
    assert res_women.status == "ready"
    assert len(res_women.rows) == 4
    for r in res_women.rows:
        assert r.cells["AT"] == "Regular"  # Fixes Flipkart error 2 & 3: S:Regular
        assert r.cells["BR"] == "None"     # Typography sanitized to None (fixes error 1)

    # 2. Boys kidswear sweatshirt -> Col AT must be "Kids"
    json_boys = dict(json_women)
    json_boys["ideal_for"] = "Boys"
    json_boys["style_code"] = "BOY-SWEAT-01"
    res_boys = build_design_rows(
        design=d_stub,
        json_data=json_boys,
        mapper=mapper_sweat,
        existing_skus_in_session=set(),
        custom_sizes=["S", "M"],
        product_type="sweatshirt",
    )
    assert res_boys.status == "ready"
    for r in res_boys.rows:
        assert r.cells["AT"] == "Kids"

    # 3. Numeric size sweatshirt -> Col AT must be "Number"
    res_num = build_design_rows(
        design=d_stub,
        json_data=json_women,
        mapper=mapper_sweat,
        existing_skus_in_session=set(),
        custom_sizes=["32", "34"],
        product_type="sweatshirt",
    )
    assert res_num.status == "ready"
    for r in res_num.rows:
        assert r.cells["AT"] == "Number"

    # 4. T-shirt verification: Col AR has size, Col AT is brand color, Col BJ has surface styling
    mapper_tshirt = get_default_mapper(product_type="t_shirt")
    d_tshirt = DetectedDesign(
        id="d2",
        kind="stub",
        status="needs_json",
        sheet_rows=[5, 6, 7, 8],
        image_urls=["https://example.com/img1.jpg"],
        existing_values={"BJ": "Typography"},
    )
    json_tshirt = {
        "product_title": "Women Classic T-shirt",
        "product_description": "Graphic typography printed cotton t-shirt for women",
        "key_features": ["Pure Cotton"],
        "material": "Pure Cotton",
        "pattern": "Printed",
        "sleeve_type": "Half Sleeve",
        "neck_type": "Round Neck",
        "fit_type": "Regular",
        "ideal_for": "Women",
        "color": "Black",
        "brand_color": "Jet Black",
        "style_code": "WMN-TEE-01",
    }
    res_tee = build_design_rows(
        design=d_tshirt,
        json_data=json_tshirt,
        mapper=mapper_tshirt,
        existing_skus_in_session=set(),
        custom_sizes=["S", "M", "L", "XL"],
        product_type="t_shirt",
    )
    assert res_tee.status == "ready"
    for r in res_tee.rows:
        assert r.cells["AR"] in ["S", "M", "L", "XL"]
        assert r.cells["AT"] == "Jet Black"  # Brand Color in T-shirt
        assert r.cells["BJ"] == "Typography"  # Valid in T-shirt

