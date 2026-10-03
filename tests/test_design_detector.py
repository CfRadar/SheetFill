"""Tests for design_detector service covering all Section 4 requirements."""

from pathlib import Path
import pytest

from app.services.design_detector import detect_designs
from app.services.sheet_reader import RawRow, RawSheet, read_tshirt_sheet

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def test_detector_1_before():
    sheet = read_tshirt_sheet(str(FIXTURES_DIR / "1_before.xls"))
    res = detect_designs(sheet)

    assert res.summary.total == 8
    assert res.summary.needs_json == 8
    assert res.summary.partial == 0
    assert res.summary.complete == 0

    expected_bases = [
        "tintin_os",
        "caribbean girl_os",
        "shark_os",
        "cuteretro_os",
        "cutebook_os",
        "rocket_os",
        "puzzle_os",
        "crab_os",
    ]
    actual_bases = [d.base for d in res.designs]
    assert actual_bases == expected_bases

    for i, d in enumerate(res.designs):
        assert d.sheet_rows == [5 + i]

    # cuteretro_os has only 6 image URLs (AZ empty)
    cuteretro = res.designs[3]
    assert cuteretro.base == "cuteretro_os"
    filled_images = [u for u in cuteretro.image_urls if u]
    assert len(filled_images) == 6
    assert cuteretro.image_urls[5] is None  # AZ empty

    # Other 7 designs have 7 images
    for i, d in enumerate(res.designs):
        if i != 3:
            assert len([u for u in d.image_urls if u]) == 7


def test_detector_2_final():
    sheet = read_tshirt_sheet(str(FIXTURES_DIR / "2_final.xlsm"))
    res = detect_designs(sheet)

    assert res.summary.total == 8
    assert res.summary.complete == 8
    assert res.summary.needs_json == 0

    expected_rows = [
        [5, 6, 7, 8],
        [9, 10, 11, 12],
        [13, 14, 15, 16],
        [17, 18, 19, 20],
        [21, 22, 23, 24],
        [25, 26, 27, 28],
        [29, 30, 31, 32],
        [33, 34, 35, 36],
    ]
    actual_rows = [d.sheet_rows for d in res.designs]
    assert actual_rows == expected_rows


def test_detector_mixed_sheet():
    s_final = read_tshirt_sheet(str(FIXTURES_DIR / "2_final.xlsm"))
    s_before = read_tshirt_sheet(str(FIXTURES_DIR / "1_before.xls"))

    # First 5 designs of 2_final (rows 5..24) + 3 stub rows from 1_before (rows 5..7 remapped to 25..27)
    mixed_rows = list(s_final.rows[:20])
    for r in s_before.rows[:3]:
        new_cells = dict(r.cells)
        mixed_rows.append(RawRow(row_index=len(mixed_rows) + 5, cells=new_cells))

    mixed_sheet = RawSheet(headers=s_final.headers, rows=mixed_rows, total_rows_read=len(mixed_rows))
    res = detect_designs(mixed_sheet)

    assert res.summary.total == 8
    assert res.summary.complete == 5
    assert res.summary.needs_json == 3


def test_detector_blank_template():
    sheet = read_tshirt_sheet(str(FIXTURES_DIR / "blank_template.xlsm"))
    res = detect_designs(sheet)

    assert res.summary.total == 0
    assert res.summary.needs_json == 0
    assert res.summary.complete == 0
    assert res.summary.free_rows == 496
    assert res.summary.room_for_new_designs == 124
    assert res.summary.capacity_designs == 124
