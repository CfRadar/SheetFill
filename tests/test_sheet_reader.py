"""Tests for sheet_reader service."""

from pathlib import Path
import pytest

from app.services.sheet_reader import read_tshirt_sheet

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def test_read_xls_success():
    xls_path = FIXTURES_DIR / "1_before.xls"
    sheet = read_tshirt_sheet(str(xls_path))
    assert sheet.total_rows_read >= 8
    assert "Seller SKU ID" in sheet.headers.values()
    # Check first row
    first_row = sheet.rows[0]
    assert first_row.row_index == 5
    assert first_row.get("G") == "tintin_os"


def test_read_xlsm_success():
    xlsm_path = FIXTURES_DIR / "2_final.xlsm"
    sheet = read_tshirt_sheet(str(xlsm_path))
    assert sheet.total_rows_read >= 32
    first_row = sheet.rows[0]
    assert first_row.row_index == 5
    assert first_row.get("G") == "tintin_os_S"


def test_read_missing_file():
    with pytest.raises(FileNotFoundError):
        read_tshirt_sheet("non_existent_file.xlsx")


def test_read_unsupported_format(tmp_path):
    txt_file = tmp_path / "test.txt"
    txt_file.write_text("hello")
    with pytest.raises(ValueError, match="Unsupported file format"):
        read_tshirt_sheet(str(txt_file))
