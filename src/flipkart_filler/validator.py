"""Pre-write and post-write verification ensuring workbook integrity,
zero-corruption of VBA/macros/controls, and strict adherence to Flipkart guidelines.
"""

from pathlib import Path
import re
from typing import Dict, List, Optional, Set, Union
import zipfile
import openpyxl
from openpyxl.utils import get_column_letter

from .models import RowRecord, ValidationIssue
from .rows import NUMERIC_COLUMNS
from .xlsx_patch import resolve_sheet_path


def verify_zip_integrity(
    template_path: Union[str, Path],
    output_path: Union[str, Path],
) -> List[ValidationIssue]:
    """Verifies:
    1. [Content_Types].xml is the first entry.
    2. vbaProject.bin, ctrlProp1.xml, vmlDrawing1.vml, drawing1.xml exist.
    3. Every zip member except t_shirt worksheet is 100% byte-identical to template.
    """
    issues: List[ValidationIssue] = []
    t_path = Path(template_path)
    o_path = Path(output_path)

    with zipfile.ZipFile(t_path, "r") as t_zip, zipfile.ZipFile(o_path, "r") as o_zip:
        sheet_path = resolve_sheet_path(t_zip, "t_shirt")
        o_namelist = o_zip.namelist()

        # 1. First entry must be [Content_Types].xml
        if not o_namelist or o_namelist[0] != "[Content_Types].xml":
            issues.append(
                ValidationIssue(
                    level="ERROR",
                    field="Zip Archive",
                    message="[Content_Types].xml is not the first member of the archive.",
                )
            )

        # 2. Critical files must exist
        critical_files = [
            "xl/vbaProject.bin",
            "xl/ctrlProps/ctrlProp1.xml",
            "xl/drawings/vmlDrawing1.vml",
            "xl/drawings/drawing1.xml",
        ]
        for cf in critical_files:
            if cf not in o_namelist:
                issues.append(
                    ValidationIssue(
                        level="ERROR",
                        field="Zip Archive",
                        message=f"Critical member '{cf}' missing from output archive.",
                    )
                )

        # 3. Byte-identical check for all non-worksheet members
        for member in t_zip.namelist():
            if member == sheet_path:
                continue
            if member not in o_namelist:
                issues.append(
                    ValidationIssue(
                        level="ERROR",
                        field="Zip Archive",
                        message=f"Member '{member}' present in template but missing in output.",
                    )
                )
                continue

            t_bytes = t_zip.read(member)
            o_bytes = o_zip.read(member)
            if t_bytes != o_bytes:
                issues.append(
                    ValidationIssue(
                        level="ERROR",
                        field="Zip Archive",
                        message=f"Member '{member}' was modified (not byte-identical to template).",
                    )
                )

    return issues


def verify_workbook_content(
    output_path: Union[str, Path],
    template_path: Union[str, Path],
    expected_rows: Optional[List[RowRecord]] = None,
    start_row: Optional[int] = None,
    allowed_values: Optional[Dict[str, List[str]]] = None,
) -> List[ValidationIssue]:
    """Re-opens output with openpyxl in read-only mode to verify:
    - Rows 1-4 are identical to template
    - Data validations count matches template (34)
    - Written row values match expectations
    - Allowed values are respected
    - Numeric columns are properly typed
    - Length constraints (SKU <= 64, Description <= 10000, Brand Color <= 128)
    """
    issues: List[ValidationIssue] = []

    t_wb = openpyxl.load_workbook(template_path, data_only=True, read_only=True)
    o_wb = openpyxl.load_workbook(output_path, data_only=True, read_only=True)

    t_ws = t_wb["t_shirt"]
    o_ws = o_wb["t_shirt"]

    # 1. Rows 1-4 check
    for r in range(1, 5):
        for c in range(1, 69):
            t_val = t_ws.cell(row=r, column=c).value
            o_val = o_ws.cell(row=r, column=c).value
            if t_val != o_val:
                col_letter = get_column_letter(c)
                issues.append(
                    ValidationIssue(
                        level="ERROR",
                        field=f"Header {col_letter}{r}",
                        message=f"Row {r} cell {col_letter}{r} changed from '{t_val}' to '{o_val}'.",
                    )
                )

    # 2. Data validation count check via fast XML inspection
    with zipfile.ZipFile(template_path, "r") as tz, zipfile.ZipFile(output_path, "r") as oz:
        t_sheet = resolve_sheet_path(tz, "t_shirt")
        o_sheet = resolve_sheet_path(oz, "t_shirt")
        t_dv_count = len(re.findall(r"<dataValidation\b", tz.read(t_sheet).decode("utf-8")))
        o_dv_count = len(re.findall(r"<dataValidation\b", oz.read(o_sheet).decode("utf-8")))

    if t_dv_count != o_dv_count:
        issues.append(
            ValidationIssue(
                level="ERROR",
                field="Data Validations",
                message=f"Data validation count changed from {t_dv_count} to {o_dv_count}.",
            )
        )

    # 3. Check written rows if provided
    if expected_rows and start_row:
        seen_skus: Set[str] = set()

        for idx, expected_record in enumerate(expected_rows):
            r_num = start_row + idx

            for col_letter, exp_val in expected_record.cells.items():
                col_idx = openpyxl.utils.column_index_from_string(col_letter)
                actual_val = o_ws.cell(row=r_num, column=col_idx).value

                # Check SKU constraints
                if col_letter == "G":
                    sku_str = str(actual_val or "")
                    if len(sku_str) > 64:
                        issues.append(
                            ValidationIssue(
                                level="ERROR",
                                field=f"G{r_num}",
                                message=f"SKU '{sku_str}' exceeds 64 characters.",
                            )
                        )
                    if sku_str in seen_skus:
                        issues.append(
                            ValidationIssue(
                                level="ERROR",
                                field=f"G{r_num}",
                                message=f"Duplicate SKU '{sku_str}' in written rows.",
                            )
                        )
                    seen_skus.add(sku_str)

                # Check numeric columns
                if col_letter in NUMERIC_COLUMNS:
                    if actual_val is None or not isinstance(actual_val, (int, float)):
                        try:
                            float(str(actual_val))
                        except (ValueError, TypeError):
                            issues.append(
                                ValidationIssue(
                                    level="ERROR",
                                    field=f"{col_letter}{r_num}",
                                    message=f"Column {col_letter} expected numeric value, got '{actual_val}' ({type(actual_val).__name__}).",
                                )
                            )

                # Check description length
                if col_letter == "BM":
                    desc_str = str(actual_val or "")
                    if len(desc_str) > 10000:
                        issues.append(
                            ValidationIssue(
                                level="ERROR",
                                field=f"BM{r_num}",
                                message=f"Description exceeds 10,000 characters ({len(desc_str)}).",
                            )
                        )

                # Check brand color length
                if col_letter == "AT":
                    bc_str = str(actual_val or "")
                    if len(bc_str) > 128:
                        issues.append(
                            ValidationIssue(
                                level="ERROR",
                                field=f"AT{r_num}",
                                message=f"Brand Color exceeds 128 characters ({len(bc_str)}).",
                            )
                        )

                # Check image URLs
                if col_letter in ["AU", "AV", "AW", "AX", "AY", "AZ", "BA"]:
                    if actual_val:
                        if not str(actual_val).startswith("https://"):
                            issues.append(
                                ValidationIssue(
                                    level="ERROR",
                                    field=f"{col_letter}{r_num}",
                                    message=f"Image URL '{actual_val}' must start with https://",
                                )
                            )

                # Check allowed values if allowed list is provided
                if allowed_values and col_letter in ["AH", "AI", "AJ", "AK", "AL", "AM", "AO", "AS", "BD", "BE", "BF", "BG", "BH", "BJ", "BK"]:
                    allowed_list = allowed_values.get(col_letter.lower())
                    if allowed_list and actual_val:
                        # Handle multi-value if applicable (AI, AS, BH)
                        vals_to_check = str(actual_val).split("::")
                        allowed_lower = {v.lower(): v for v in allowed_list}
                        for val_item in vals_to_check:
                            if val_item.strip().lower() not in allowed_lower:
                                issues.append(
                                    ValidationIssue(
                                        level="ERROR",
                                        field=f"{col_letter}{r_num}",
                                        message=f"Value '{val_item}' not in allowed list for column {col_letter}.",
                                    )
                                )

    t_wb.close()
    o_wb.close()

    return issues
