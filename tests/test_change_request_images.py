"""Tests for CHANGE REQUEST: Images copied from uploaded sheet / source sheet, not from JSON."""

import json
from pathlib import Path
import shutil
import openpyxl
import pytest
from typer.testing import CliRunner
import xlrd
from starlette.testclient import TestClient

from app.main import app
from flipkart_filler.allowed_values import read_source_sheet_stubs
from flipkart_filler.cli import app as cli_app

runner = CliRunner(env={"PYTHONIOENCODING": "utf-8"})

ROOT_DIR = Path(__file__).resolve().parent.parent
WORKSPACE_DIR = ROOT_DIR.parent
SOURCE_XLS = WORKSPACE_DIR / "1.xls"
FINAL_XLSM = WORKSPACE_DIR / "2.xlsm"
TEMPLATE_PATH = ROOT_DIR / "templates" / "Flipkart_TShirt_Template.xlsm"
BATCH_JSON_PATH = ROOT_DIR / "tests" / "fixtures" / "batch_1_to_2.json"
CONFIG_DIR = ROOT_DIR / "config"

IMAGE_COLS = ["AU", "AV", "AW", "AX", "AY", "AZ", "BA"]


@pytest.fixture
def client():
    return TestClient(app)


def test_1_upload_and_8_jsons_match_stubs_and_final_xlsm(client, tmp_path):
    """1. Upload 1_before.xls + the 8 JSONs without images -> output rows 5-36:
    for each design, AU..BA on all 4 rows equal the stub's AU..BA from 1_before.xls
    (byte-for-byte string equality). Compare against 2_final.xlsm as well: equal.
    """
    assert SOURCE_XLS.exists(), f"Source file {SOURCE_XLS} not found"
    assert FINAL_XLSM.exists(), f"Final file {FINAL_XLSM} not found"
    assert BATCH_JSON_PATH.exists(), f"Batch JSON {BATCH_JSON_PATH} not found"

    # Step 1: Upload 1.xls
    with open(SOURCE_XLS, "rb") as f:
        res = client.post("/api/sheets/analyze", files={"file": ("1.xls", f, "application/vnd.ms-excel")})
    assert res.status_code == 200, res.text
    data = res.json()
    sid = data["session_id"]
    designs = data["designs"]
    assert len(designs) == 8

    # Step 2: Bulk assign 8 JSONs
    batch_text = BATCH_JSON_PATH.read_text(encoding="utf-8")
    assign_res = client.post(f"/api/sheets/{sid}/bulk-assign", json={"raw_text": batch_text})
    assert assign_res.status_code == 200, assign_res.text
    assign_data = assign_res.json()
    pairs = [
        {"design_id": item["design_id"], "json_index": item["json_index"], "parsed_json": item["parsed_json"]}
        for item in assign_data["assigned"]
    ]
    confirm_res = client.post(f"/api/sheets/{sid}/bulk-assign/confirm", json={"pairs": pairs})
    assert confirm_res.status_code == 200, confirm_res.text

    # Step 3: Generate workbook
    gen_res = client.post(f"/api/sheets/{sid}/generate", json={"mode": "all_or_nothing"})
    assert gen_res.status_code == 200, gen_res.text

    # Step 4: Download and inspect generated workbook
    down_res = client.get(f"/api/sheets/{sid}/download")
    assert down_res.status_code == 200
    gen_file = tmp_path / "output_test1.xlsm"
    gen_file.write_bytes(down_res.content)

    # Read 1.xls stubs
    wb1 = xlrd.open_workbook(str(SOURCE_XLS))
    ws1 = wb1.sheet_by_name("t_shirt")
    stubs_1 = {}
    for r in range(4, 12):
        base = ws1.cell_value(r, 6)
        stubs_1[base] = [ws1.cell_value(r, c) for c in range(46, 53)]

    # Read 2.xlsm rows
    wb2 = openpyxl.load_workbook(str(FINAL_XLSM), data_only=True, read_only=True)
    ws2 = wb2["t_shirt"]

    # Read generated workbook (.xls)
    wb_gen = xlrd.open_workbook(str(gen_file))
    ws_gen = wb_gen.sheet_by_name("t_shirt")

    # Compare rows 5..36 across all 8 designs
    for i in range(8):
        stub_r = 4 + i
        base_sku = ws1.cell_value(stub_r, 6)
        expected_stub_imgs = stubs_1[base_sku]

        for offset in range(4):
            r_idx = 5 + i * 4 + offset
            gen_sku = ws_gen.cell_value(r_idx - 1, 6)
            assert gen_sku.startswith(base_sku.split("_")[0]), f"Unexpected SKU at row {r_idx}: {gen_sku}"

            gen_imgs = [
                str(ws_gen.cell_value(r_idx - 1, openpyxl.utils.column_index_from_string(col) - 1) or "")
                for col in IMAGE_COLS
            ]
            final_imgs = [ws2[f"{col}{r_idx}"].value or "" for col in IMAGE_COLS]

            # Byte-for-byte string equality with 1.xls stub
            assert gen_imgs == expected_stub_imgs, (
                f"Row {r_idx} ({gen_sku}) AU..BA does not match stub! Got {gen_imgs} vs expected {expected_stub_imgs}"
            )
            # Equality with 2.xlsm
            assert gen_imgs == final_imgs, (
                f"Row {r_idx} ({gen_sku}) AU..BA does not match 2.xlsm! Got {gen_imgs} vs 2.xlsm {final_imgs}"
            )

    wb2.close()


def test_2_cuteretro_os_az_blank_exactly_one_warning(client):
    """2. cuteretro_os: AZ is blank on all 4 rows, exactly one WARNING for it."""
    # Analyze 1.xls
    with open(SOURCE_XLS, "rb") as f:
        res = client.post("/api/sheets/analyze", files={"file": ("1.xls", f, "application/vnd.ms-excel")})
    assert res.status_code == 200
    sid = res.json()["session_id"]
    designs = res.json()["designs"]

    # Find cuteretro_os design
    cr_design = next((d for d in designs if d.get("base") == "cuteretro_os"), None)
    assert cr_design is not None

    # Load cuteretro_os JSON from batch
    batch = json.loads(BATCH_JSON_PATH.read_text(encoding="utf-8"))
    cr_json = next((item for item in batch if item.get("sku_base") == "cuteretro_os"), None)
    assert cr_json is not None

    # Put JSON
    put_res = client.put(f"/api/sheets/{sid}/designs/{cr_design['id']}/json", json={"raw_text": json.dumps(cr_json)})
    assert put_res.status_code == 200, put_res.text
    put_data = put_res.json()

    # Verify AZ is blank on all preview rows
    for r in put_data["preview_rows"]:
        assert r["cells"].get("AZ") is None or r["cells"].get("AZ") == ""

    # Verify exactly one WARNING for cuteretro_os image slot AZ empty in sheet
    az_warnings = [
        w for w in put_data["warnings"]
        if "image slot AZ empty in sheet" in w["message"] and "cuteretro_os" in w["message"]
    ]
    assert len(az_warnings) == 1, f"Expected exactly 1 AZ warning, got: {put_data['warnings']}"


def test_3_leftover_images_in_json_ignored_with_warning(client):
    """3. JSON with a leftover 'images' array -> warning 'ignored', sheet links unchanged."""
    with open(SOURCE_XLS, "rb") as f:
        res = client.post("/api/sheets/analyze", files={"file": ("1.xls", f, "application/vnd.ms-excel")})
    sid = res.json()["session_id"]
    target_d = res.json()["designs"][0]  # tintin_os
    original_sheet_images = target_d["image_urls"]

    # Prepare JSON with leftover images
    batch = json.loads(BATCH_JSON_PATH.read_text(encoding="utf-8"))
    tintin_json = dict(batch[0])
    tintin_json["images"] = [
        "https://fake.url/leftover1.jpg",
        "https://fake.url/leftover2.jpg",
    ]

    put_res = client.put(f"/api/sheets/{sid}/designs/{target_d['id']}/json", json={"raw_text": json.dumps(tintin_json)})
    assert put_res.status_code == 200
    put_data = put_res.json()

    # Warning must state images in JSON ignored; links are taken from the sheet
    ignored_warnings = [
        w for w in put_data["warnings"]
        if "images in JSON ignored; links are taken from the sheet" in w["message"]
    ]
    assert len(ignored_warnings) == 1

    # Verify sheet links are unchanged and fake URLs are never written
    for r in put_data["preview_rows"]:
        for c in IMAGE_COLS:
            val = r["cells"].get(c)
            assert val != "https://fake.url/leftover1.jpg"
            assert val != "https://fake.url/leftover2.jpg"
        assert r["cells"].get("AU") == original_sheet_images[0]


def test_4_cli_source_sheet_flag(tmp_path):
    """4. CLI without --source-sheet -> image cells blank + warning; with --source-sheet -> links copied."""
    json_path = ROOT_DIR / "tests" / "fixtures" / "moonlight.json"
    template_copy1 = tmp_path / "cli_no_source.xlsm"
    shutil.copyfile(TEMPLATE_PATH, template_copy1)

    # 4a: Run CLI without --source-sheet
    result_without = runner.invoke(
        cli_app,
        [
            "fill",
            "--json", str(json_path),
            "--template", str(TEMPLATE_PATH),
            "--append-to", str(template_copy1),
            "--config", str(CONFIG_DIR),
        ],
    )
    assert result_without.exit_code == 0
    assert "WARNING" in result_without.output
    assert "Image columns AU..BA will remain blank" in result_without.output or "No --source-sheet" in result_without.output

    # Check that image cells in output are blank
    wb_out1 = openpyxl.load_workbook(str(template_copy1), data_only=True, read_only=True)
    ws_out1 = wb_out1["t_shirt"]
    for r in range(37, 41):
        for col in IMAGE_COLS:
            assert ws_out1[f"{col}{r}"].value is None or ws_out1[f"{col}{r}"].value == ""
    wb_out1.close()

    # 4b: Run CLI with --source-sheet containing moonlight_os stub
    custom_source = tmp_path / "custom_source.xlsx"
    wb_src = openpyxl.Workbook()
    ws_src = wb_src.active
    ws_src.title = "t_shirt"
    # Row 5 stub for moonlight_os
    ws_src["G5"] = "moonlight_os"
    ws_src["AU5"] = "https://fkmpimages.flixcart.com/moonlight_main.jpg"
    ws_src["AV5"] = "https://fkmpimages.flixcart.com/moonlight_other1.jpg"
    ws_src["AW5"] = "https://fkmpimages.flixcart.com/moonlight_other2.jpg"
    wb_src.save(str(custom_source))
    wb_src.close()

    template_copy2 = tmp_path / "cli_with_source.xlsm"
    shutil.copyfile(TEMPLATE_PATH, template_copy2)

    result_with = runner.invoke(
        cli_app,
        [
            "fill",
            "--json", str(json_path),
            "--template", str(TEMPLATE_PATH),
            "--append-to", str(template_copy2),
            "--source-sheet", str(custom_source),
            "--config", str(CONFIG_DIR),
        ],
    )
    assert result_with.exit_code == 0, f"CLI with source failed: {result_with.output}"

    # Verify that links were copied from custom_source to rows 37..40
    wb_out2 = openpyxl.load_workbook(str(template_copy2), data_only=True, read_only=True)
    ws_out2 = wb_out2["t_shirt"]
    for r in range(37, 41):
        assert ws_out2[f"AU{r}"].value == "https://fkmpimages.flixcart.com/moonlight_main.jpg"
        assert ws_out2[f"AV{r}"].value == "https://fkmpimages.flixcart.com/moonlight_other1.jpg"
        assert ws_out2[f"AW{r}"].value == "https://fkmpimages.flixcart.com/moonlight_other2.jpg"
        assert ws_out2[f"AX{r}"].value is None or ws_out2[f"AX{r}"].value == ""
    wb_out2.close()

    # Also verify that read_source_sheet_stubs correctly reads all 8 designs from 1.xls
    stubs_from_1 = read_source_sheet_stubs(SOURCE_XLS)
    assert "tintin_os" in stubs_from_1
    assert "cuteretro_os" in stubs_from_1
    assert stubs_from_1["tintin_os"]["AU"].startswith("https://")
    assert stubs_from_1["cuteretro_os"]["AU"].startswith("https://")
    assert "AZ" not in stubs_from_1["cuteretro_os"] or stubs_from_1["cuteretro_os"]["AZ"] == ""


def test_5_manual_slot_editable_written_to_all_rows(client, tmp_path):
    """5. Manual slot (blank template, 'Add designs'): image inputs editable;
    values typed there are written to all size rows.
    """
    # Create session with blank template
    with open(TEMPLATE_PATH, "rb") as f:
        res = client.post("/api/sheets/analyze", files={"file": ("blank.xlsm", f, "application/vnd.ms-excel")})
    sid = res.json()["session_id"]

    # Add 1 manual slot
    add_res = client.post(f"/api/sheets/{sid}/add-slots", json={"count": 1})
    assert add_res.status_code == 200
    new_design = add_res.json()["designs"][-1]
    assert new_design["is_manual_slot"] is True

    # Manual edit of images (without unlock=true, must succeed because is_manual_slot is True)
    custom_urls = [
        "https://myshop.com/manual_main.jpg",
        "https://myshop.com/manual_1.jpg",
        "https://myshop.com/manual_2.jpg",
        None, None, None, None,
    ]
    img_res = client.put(
        f"/api/sheets/{sid}/designs/{new_design['id']}/images",
        json={"urls": custom_urls, "product_link": "https://flipkart.com/p/manual"},
    )
    assert img_res.status_code == 200

    # Provide JSON for manual design
    manual_json = {
        "sku_base": "manual_brand_os",
        "product_title": "Manual Test Tee",
        "product_description": "A test tee added manually without a sheet stub.",
        "key_features": ["Soft fabric", "Relaxed fit"],
        "material": "Cotton Blend",
        "pattern": "Solid",
        "sleeve_type": "Half Sleeve",
        "neck_type": "Round Neck",
        "fit_type": "Oversized",
        "ideal_for": "Men",
        "color": "Black",
        "style_code": "MANUAL-001",
    }
    put_res = client.put(f"/api/sheets/{sid}/designs/{new_design['id']}/json", json={"raw_text": json.dumps(manual_json)})
    assert put_res.status_code == 200
    rows = put_res.json()["preview_rows"]

    # All size rows must have the manually entered image URLs and product link
    for r in rows:
        assert r["cells"]["AU"] == "https://myshop.com/manual_main.jpg"
        assert r["cells"]["AV"] == "https://myshop.com/manual_1.jpg"
        assert r["cells"]["AW"] == "https://myshop.com/manual_2.jpg"
        assert r["cells"].get("AX") is None
        assert r["cells"]["D"] == "https://flipkart.com/p/manual"


def test_6_ui_sheet_derived_design_locked_and_read_only(client):
    """6. UI: for a sheet-derived design the 7 fields are read-only and show the sheet's URLs.
    PUT /designs/{did}/images rejected (HTTP 409) unless unlock=true.
    GET .../json-template has no image keys.
    """
    with open(SOURCE_XLS, "rb") as f:
        res = client.post("/api/sheets/analyze", files={"file": ("1.xls", f, "application/vnd.ms-excel")})
    sid = res.json()["session_id"]
    sheet_design = res.json()["designs"][0]

    assert sheet_design["is_manual_slot"] is False
    assert len(sheet_design["image_urls"]) == 7
    assert sheet_design["image_urls"][0].startswith("https://")

    # Attempt to edit images without unlock -> rejected with HTTP 409
    attempt_res = client.put(
        f"/api/sheets/{sid}/designs/{sheet_design['id']}/images",
        json={"urls": ["https://hacked.com/img1.jpg"]},
    )
    assert attempt_res.status_code == 409
    assert "SHEET_IMAGES_LOCKED" in attempt_res.text

    # With unlock=true in query or body -> accepted
    unlock_res = client.put(
        f"/api/sheets/{sid}/designs/{sheet_design['id']}/images?unlock=true",
        json={"urls": ["https://allowed.com/img1.jpg", None, None, None, None, None, None]},
    )
    assert unlock_res.status_code == 200

    # Verify GET json-template endpoint has NO image keys
    tpl_res = client.get(f"/api/sheets/{sid}/designs/{sheet_design['id']}/json-template")
    assert tpl_res.status_code == 200
    tpl_data = tpl_res.json()
    assert "images" not in tpl_data
    assert "image_urls" not in tpl_data
