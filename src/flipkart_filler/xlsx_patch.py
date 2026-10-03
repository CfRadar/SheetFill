"""Surgical OOXML patcher for Flipkart T-Shirt listing workbook.
Patches ONLY the resolved t_shirt worksheet (sheet3.xml) in-memory using lxml,
keeping all macros, form controls, and other 33 zip members 100% byte-identical.
"""

from pathlib import Path
import re
from typing import Dict, List, Optional, Set, Tuple, Union
import zipfile
import lxml.etree as ET

from .models import RowRecord, ValidationIssue
from .rows import NUMERIC_COLUMNS

MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
RELS_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
PKG_RELS_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
XML_NS = "http://www.w3.org/XML/1998/namespace"

NS_MAP = {
    "s": MAIN_NS,
    "r": PKG_RELS_NS,
}


def col_name_to_index(col: str) -> int:
    """Converts Excel column letters (e.g. 'A', 'Z', 'AA', 'BP') to 1-based column index."""
    idx = 0
    for char in col.upper():
        if "A" <= char <= "Z":
            idx = idx * 26 + (ord(char) - ord("A") + 1)
    return idx


def index_to_col_name(n: int) -> str:
    """Converts 1-based column index to Excel column letters."""
    name = []
    while n > 0:
        n, remainder = divmod(n - 1, 26)
        name.append(chr(65 + remainder))
    return "".join(reversed(name))


def resolve_sheet_path(zip_file: zipfile.ZipFile, sheet_name: str = "t_shirt") -> str:
    """Dynamically resolves the zip member path of a worksheet from xl/workbook.xml
    and xl/_rels/workbook.xml.rels instead of assuming 'sheet3.xml'.
    """
    if "xl/workbook.xml" not in zip_file.namelist():
        raise FileNotFoundError("xl/workbook.xml not found in workbook archive")

    wb_xml = zip_file.read("xl/workbook.xml")
    wb_tree = ET.fromstring(wb_xml)

    sheet_r_id = None
    for sheet_el in wb_tree.findall(".//s:sheet", NS_MAP):
        if sheet_el.attrib.get("name") == sheet_name:
            sheet_r_id = sheet_el.attrib.get(f"{{{PKG_RELS_NS}}}id")
            break

    if not sheet_r_id:
        raise ValueError(f"Sheet '{sheet_name}' not found in xl/workbook.xml")

    rels_path = "xl/_rels/workbook.xml.rels"
    if rels_path not in zip_file.namelist():
        raise FileNotFoundError(f"{rels_path} not found in workbook archive")

    rels_xml = zip_file.read(rels_path)
    rels_tree = ET.fromstring(rels_xml)

    target = None
    for rel_el in rels_tree:
        if rel_el.attrib.get("Id") == sheet_r_id:
            target = rel_el.attrib.get("Target")
            break

    if not target:
        raise ValueError(f"Relationship Id '{sheet_r_id}' not found in {rels_path}")

    target = target.lstrip("/")
    if not target.startswith("xl/"):
        target = f"xl/{target}"

    return target


def _get_cell_value(c_el: ET.Element) -> str:
    """Extracts text or numeric value from a cell element."""
    val_el = c_el.find(f"{{{MAIN_NS}}}v")
    if val_el is not None and val_el.text:
        return val_el.text.strip()
    is_el = c_el.find(f"{{{MAIN_NS}}}is")
    if is_el is not None:
        t_el = is_el.find(f"{{{MAIN_NS}}}t")
        if t_el is not None and t_el.text:
            return t_el.text.strip()
    return ""


def find_next_free_row_block(
    sheet_tree: ET.Element,
    num_rows: int = 4,
    max_row: int = 500,
) -> Tuple[int, List[ValidationIssue]]:
    """Finds the first row r >= 5 such that rows r..r+num_rows-1 have an empty Column G,
    and NO row > r has an existing SKU in Column G.
    Returns (start_row, issues).
    """
    issues: List[ValidationIssue] = []

    # Map existing row elements and find occupied G cells
    occupied_sku_rows: Set[int] = set()
    row_elements: Dict[int, ET.Element] = {}

    for row_el in sheet_tree.findall(".//s:row", NS_MAP):
        try:
            r_num = int(row_el.attrib.get("r", 0))
        except ValueError:
            continue
        row_elements[r_num] = row_el

        # Find cell G{r_num}
        c_g = row_el.find(f"{{{MAIN_NS}}}c[@r='G{r_num}']")
        if c_g is not None:
            val = _get_cell_value(c_g)
            if val:
                occupied_sku_rows.add(r_num)

    highest_sku_row = max(occupied_sku_rows) if occupied_sku_rows else 4
    candidate_start = max(5, ((highest_sku_row - 5) // num_rows + 1) * num_rows + 5)

    while candidate_start + num_rows - 1 <= max_row:
        block_rows = range(candidate_start, candidate_start + num_rows)
        # Verify no rows in this block or below have an SKU
        if not any(r in occupied_sku_rows for r in block_rows):
            # Check for stray values in columns A..BP without G SKU
            has_stray = False
            for r_num in block_rows:
                if r_num in row_elements:
                    r_el = row_elements[r_num]
                    for c_el in r_el.findall(f"{{{MAIN_NS}}}c"):
                        if _get_cell_value(c_el):
                            has_stray = True
                            break
            if has_stray:
                issues.append(
                    ValidationIssue(
                        level="WARNING",
                        field="Sheet Structure",
                        message=(
                            f"Stray values found in rows {candidate_start}..{candidate_start + num_rows - 1} "
                            f"without an SKU. Values in columns A..BP will be cleared before writing."
                        ),
                    )
                )
            return candidate_start, issues

        candidate_start += num_rows

    raise ValueError(
        f"Cannot find a free {num_rows}-row block in t_shirt sheet up to row {max_row}."
    )


def patch_sheet_xml(
    sheet_xml_bytes: bytes,
    rows: List[RowRecord],
    start_row: int,
) -> Tuple[bytes, List[ValidationIssue]]:
    """Surgically patches target cells in the t_shirt sheet XML with lxml:
    - Sets numeric values in <v>
    - Sets strings in <is><t xml:space='preserve'>...</t></is> (inlineStr)
    - Retains existing style attribute s='...'
    - Preserves column ordering within rows
    - Leaves all other nodes untouched.
    """
    issues: List[ValidationIssue] = []
    root = ET.fromstring(sheet_xml_bytes)
    sheet_data = root.find(f"{{{MAIN_NS}}}sheetData")
    if sheet_data is None:
        raise ValueError("sheetData node not found in worksheet XML")

    # Map existing row elements
    existing_rows: Dict[int, ET.Element] = {}
    for r_el in sheet_data.findall(f"{{{MAIN_NS}}}row"):
        try:
            r_num = int(r_el.attrib.get("r", 0))
            existing_rows[r_num] = r_el
        except ValueError:
            pass

    cols_to_skip = {"A", "B", "C", "D", "E", "F", "I"}

    for idx, record in enumerate(rows):
        current_r = start_row + idx
        record.row_index = current_r

        if current_r in existing_rows:
            row_el = existing_rows[current_r]
        else:
            # Create row element and insert in numerical order
            row_el = ET.Element(f"{{{MAIN_NS}}}row", attrib={"r": str(current_r)})
            # Find insertion point
            inserted = False
            for existing_r_num in sorted(existing_rows.keys()):
                if existing_r_num > current_r:
                    existing_rows[existing_r_num].addprevious(row_el)
                    inserted = True
                    break
            if not inserted:
                sheet_data.append(row_el)
            existing_rows[current_r] = row_el

        # Map existing cells in this row
        existing_cells: Dict[str, ET.Element] = {}
        for c in row_el.findall(f"{{{MAIN_NS}}}c"):
            ref = c.attrib.get("r")
            if ref:
                col_letter = "".join(filter(str.isalpha, ref))
                existing_cells[col_letter] = c

        # Patch target cells
        for col_letter, val in record.cells.items():
            if col_letter in cols_to_skip or val is None:
                continue

            cell_ref = f"{col_letter}{current_r}"
            if col_letter in existing_cells:
                c_elem = existing_cells[col_letter]
            else:
                c_elem = ET.Element(f"{{{MAIN_NS}}}c", attrib={"r": cell_ref})
                existing_cells[col_letter] = c_elem

            # Clear any previous children (e.g. old <v> or <is>)
            for ch in list(c_elem):
                c_elem.remove(ch)

            # Cell typing: numeric vs inlineStr
            if col_letter in NUMERIC_COLUMNS:
                c_elem.attrib.pop("t", None)
                v_el = ET.SubElement(c_elem, f"{{{MAIN_NS}}}v")
                if isinstance(val, (int, float)):
                    if isinstance(val, float) and val.is_integer() and col_letter in {"O", "P", "AN"}:
                        v_el.text = str(int(val))
                    else:
                        v_el.text = str(val)
                else:
                    v_el.text = str(val)
            else:
                c_elem.attrib["t"] = "inlineStr"
                is_el = ET.SubElement(c_elem, f"{{{MAIN_NS}}}is")
                t_el = ET.SubElement(is_el, f"{{{MAIN_NS}}}t")
                t_el.attrib[f"{{{XML_NS}}}space"] = "preserve"
                t_el.text = str(val)

        # Re-attach all cells in sorted column order
        for c in list(row_el.findall(f"{{{MAIN_NS}}}c")):
            row_el.remove(c)

        for col_letter in sorted(existing_cells.keys(), key=col_name_to_index):
            row_el.append(existing_cells[col_letter])

    patched_bytes = ET.tostring(
        root,
        xml_declaration=True,
        encoding="UTF-8",
        standalone="yes",
    )
    return patched_bytes, issues


def create_patched_workbook(
    source_workbook_path: Union[str, Path],
    output_workbook_path: Union[str, Path],
    rows: List[RowRecord],
) -> Tuple[int, int, List[ValidationIssue]]:
    """Copies source workbook to output workbook, patching only the t_shirt sheet.
    Maintains [Content_Types].xml first and keeps all other 33 parts byte-identical.
    Returns (start_row, end_row, issues).
    """
    source_path = Path(source_workbook_path)
    output_path = Path(output_workbook_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Write to a temporary file first to support safe in-place replacement
    temp_output_path = output_path.with_name(f"{output_path.stem}.tmp_{id(output_path)}.xlsm")

    with zipfile.ZipFile(source_path, "r") as src_zip:
        sheet_path = resolve_sheet_path(src_zip, "t_shirt")
        sheet_xml = src_zip.read(sheet_path)
        sheet_tree = ET.fromstring(sheet_xml)

        start_row, free_issues = find_next_free_row_block(sheet_tree, num_rows=len(rows))
        patched_sheet_bytes, patch_issues = patch_sheet_xml(sheet_xml, rows, start_row)

        all_issues = free_issues + patch_issues

        # Create output zip
        # Ensure [Content_Types].xml is the very first entry
        namelist = src_zip.namelist()
        ordered_names = ["[Content_Types].xml"] + [n for n in namelist if n != "[Content_Types].xml"]

        with zipfile.ZipFile(
            temp_output_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6
        ) as dst_zip:
            for member_name in ordered_names:
                if member_name == sheet_path:
                    # Write patched sheet XML
                    dst_zip.writestr(member_name, patched_sheet_bytes)
                else:
                    # Write raw exact bytes from source
                    raw_data = src_zip.read(member_name)
                    dst_zip.writestr(member_name, raw_data)

    # Atomically replace destination file
    import os
    if os.path.exists(output_path):
        os.replace(temp_output_path, output_path)
    else:
        temp_output_path.rename(output_path)

    end_row = start_row + len(rows) - 1
    return start_row, end_row, all_issues
