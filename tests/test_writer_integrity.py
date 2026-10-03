"""Tests for writer service and OOXML zip integrity."""

import json
from pathlib import Path
import zipfile
import pytest

from app.services.builder import build_design_rows, get_default_mapper
from app.services.design_detector import detect_designs
from app.services.sheet_reader import read_tshirt_sheet
from app.services.writer import rebuild_tshirt_workbook
from flipkart_filler.xlsx_patch import resolve_sheet_path

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def test_writer_preserves_macros_and_drawings(tmp_path):
    template_path = str(FIXTURES_DIR / "blank_template.xlsm")
    sheet = read_tshirt_sheet(str(FIXTURES_DIR / "1_before.xls"))
    res = detect_designs(sheet)

    batch_path = FIXTURES_DIR / "batch_1_to_2.json"
    items = json.loads(batch_path.read_text(encoding="utf-8"))

    mapper = get_default_mapper(template_path)
    ready_rows = {}
    existing_skus = set()
    for d, it in zip(res.designs, items):
        b_res = build_design_rows(d, it, mapper, existing_skus)
        ready_rows[d.id] = b_res.rows

    out_file = str(tmp_path / "output_test.xlsm")
    out_path, report = rebuild_tshirt_workbook(
        master_template_path=template_path,
        output_path=out_file,
        designs=res.designs,
        ready_rows_map=ready_rows,
    )

    assert Path(out_path).exists()
    assert report["status"] == "success"
    assert report["verified_identical_parts"] == 33

    # Direct zip verification
    with zipfile.ZipFile(template_path, "r") as z_tpl, zipfile.ZipFile(out_path, "r") as z_out:
        assert "xl/vbaProject.bin" in z_out.namelist()
        assert "xl/ctrlProps/ctrlProp1.xml" in z_out.namelist()
        assert "xl/drawings/vmlDrawing1.vml" in z_out.namelist()

        # Check byte identity of VBA macro
        assert z_tpl.read("xl/vbaProject.bin") == z_out.read("xl/vbaProject.bin")
        # Check byte identity of sharedStrings
        assert z_tpl.read("xl/sharedStrings.xml") == z_out.read("xl/sharedStrings.xml")

        # Verify only sheet3.xml was modified
        sheet_path = resolve_sheet_path(z_tpl, "t_shirt")
        for member in z_tpl.namelist():
            if member == sheet_path:
                continue
            assert z_tpl.read(member) == z_out.read(member), f"Member {member} was altered!"
