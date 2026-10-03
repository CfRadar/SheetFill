"""Tests for surgical OOXML patch integrity, non-corruption of VBA, and validation count."""

from pathlib import Path
import pytest

from flipkart_filler.allowed_values import load_allowed_values
from flipkart_filler.json_loader import load_products_from_path
from flipkart_filler.mapper import ValueMapper
from flipkart_filler.rows import build_product_rows
from flipkart_filler.validator import verify_workbook_content, verify_zip_integrity
from flipkart_filler.xlsx_patch import create_patched_workbook

ROOT_DIR = Path(__file__).parent.parent
TEMPLATE_PATH = ROOT_DIR / "templates" / "Flipkart_TShirt_Template.xlsm"
CONFIG_DIR = ROOT_DIR / "config"
FIXTURES_DIR = ROOT_DIR / "tests" / "fixtures"


def test_xlsx_patch_integrity(tmp_path):
    output_xlsm = tmp_path / "test_out.xlsm"
    allowed_dict = load_allowed_values(TEMPLATE_PATH)
    mapper = ValueMapper(
        mappings_path=CONFIG_DIR / "mappings.yaml",
        defaults_path=CONFIG_DIR / "defaults.yaml",
        allowed_values=allowed_dict,
    )

    product = load_products_from_path(FIXTURES_DIR / "moonlight.json")[0]
    existing_skus = set()
    rows, _ = build_product_rows(product, mapper, existing_skus)

    start_row, end_row, issues = create_patched_workbook(
        source_workbook_path=TEMPLATE_PATH,
        output_workbook_path=output_xlsm,
        rows=rows,
    )

    assert start_row == 37
    assert end_row == 40
    assert len([i for i in issues if i.level == "ERROR"]) == 0

    # 1. Zip Integrity: all 33 non-sheet3 parts byte-identical
    zip_issues = verify_zip_integrity(TEMPLATE_PATH, output_xlsm)
    assert len(zip_issues) == 0

    # 2. Content integrity: rows 1-4 identical, validations count = 34
    content_issues = verify_workbook_content(
        output_xlsm,
        TEMPLATE_PATH,
        expected_rows=rows,
        start_row=start_row,
        allowed_values=allowed_dict,
    )
    errors = [i for i in content_issues if i.level == "ERROR"]
    assert len(errors) == 0
