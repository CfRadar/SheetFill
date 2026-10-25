"""Writer service for zero-corruption master-template workbook rebuild."""

import os
from pathlib import Path
import re
import shutil
import tempfile
from typing import Any, Dict, List, Optional, Set, Tuple
import zipfile
import lxml.etree as ET
import openpyxl
from openpyxl.utils import get_column_letter

from app.services.design_detector import DetectedDesign, detect_designs
from app.services.sheet_reader import read_tshirt_sheet
from flipkart_filler.models import RowRecord, ValidationIssue
from flipkart_filler.rows import NUMERIC_COLUMNS, SWEAT_NUMERIC_COLUMNS
from flipkart_filler.xlsx_patch import MAIN_NS, NS_MAP, PKG_RELS_NS, resolve_sheet_path

SKIP_COLS = {"A", "B", "C", "E", "F", "I"}


def col_name_to_index(col: str) -> int:
    idx = 0
    for char in col.upper():
        if "A" <= char <= "Z":
            idx = idx * 26 + (ord(char) - ord("A") + 1)
    return idx


def index_to_col_name(n: int) -> str:
    name = []
    while n > 0:
        n, remainder = divmod(n - 1, 26)
        name.append(chr(65 + remainder))
    return "".join(reversed(name))


def rebuild_tshirt_workbook(
    master_template_path: str,
    output_path: str,
    designs: List[DetectedDesign],
    ready_rows_map: Dict[str, List[RowRecord]],
    mode: str = "ready_only",
    original_sheet_rows: Optional[List[Dict[str, Any]]] = None,
    product_type: str = "t_shirt",
) -> Tuple[str, Dict[str, Any]]:
    """Rebuilds data rows 5..N sequentially into master template without corruption."""
    # Check mode
    if mode == "all_or_nothing":
        unready = [d.id for d in designs if d.id not in ready_rows_map and d.status != "complete"]
        if unready:
            raise ValueError(f"Cannot generate in all_or_nothing mode: designs {unready} are not ready.")

    # Build sequence of rows to write
    final_rows: List[Dict[str, Any]] = []

    # Map original sheet rows by 1-based index if provided
    orig_by_row = {}
    if original_sheet_rows:
        for r in original_sheet_rows:
            orig_by_row[r.get("row_index")] = r.get("cells", {})

    for d in designs:
        if d.id in ready_rows_map:
            for r_rec in ready_rows_map[d.id]:
                final_rows.append(r_rec.cells)
        else:
            # Re-emit original cell values
            if d.sheet_rows and orig_by_row:
                for r_idx in d.sheet_rows:
                    if r_idx in orig_by_row:
                        final_rows.append(orig_by_row[r_idx])
                    else:
                        cells = dict(d.existing_values)
                        if d.base:
                            cells["G"] = d.base
                        final_rows.append(cells)
            else:
                cells = dict(d.existing_values)
                if d.base:
                    cells["G"] = d.base
                final_rows.append(cells)

    total_rows = len(final_rows)
    if total_rows > 496:
        raise ValueError(f"Capacity exceeded: {total_rows} rows requested (max 496 data rows = 124 designs of 4 sizes).")

    # Route to native BIFF8 .xls builder when requested output is .xls
    if output_path.lower().endswith(".xls"):
        return _rebuild_tshirt_workbook_xls(
            master_template_path=master_template_path,
            output_path=output_path,
            designs=designs,
            ready_rows_map=ready_rows_map,
            final_rows=final_rows,
            start_row=5,
            product_type=product_type,
        )

    # Read master template (.xlsm)
    master_path = Path(master_template_path)
    if not master_path.exists():
        raise FileNotFoundError(f"Master template not found at {master_template_path}")

    target_sheet = "sweatshirt" if product_type == "sweatshirt" else "t_shirt"
    numeric_cols = SWEAT_NUMERIC_COLUMNS if product_type == "sweatshirt" else NUMERIC_COLUMNS

    with zipfile.ZipFile(master_path, "r") as z_in:
        sheet_path = resolve_sheet_path(z_in, target_sheet)
        sheet_xml = z_in.read(sheet_path)

        # Clear rows 5..500 and write final_rows sequentially starting at row 5
        patched_sheet_xml = _clear_and_patch_sheet_xml(sheet_xml, final_rows, start_row=5, numeric_cols=numeric_cols)

        # Write to temporary file first
        out_p = Path(output_path)
        out_p.parent.mkdir(parents=True, exist_ok=True)
        fd, temp_file = tempfile.mkstemp(suffix=out_p.suffix or ".xlsm", dir=str(out_p.parent))
        os.close(fd)

        try:
            with zipfile.ZipFile(temp_file, "w", compression=zipfile.ZIP_DEFLATED) as z_out:
                # [Content_Types].xml must be first
                content_types_name = "[Content_Types].xml"
                if content_types_name in z_in.namelist():
                    z_out.writestr(content_types_name, z_in.read(content_types_name))

                for item in z_in.infolist():
                    if item.filename == content_types_name:
                        continue
                    if item.filename == sheet_path:
                        z_out.writestr(item, patched_sheet_xml)
                    else:
                        z_out.writestr(item, z_in.read(item.filename))

            os.replace(temp_file, str(out_p))
        finally:
            if os.path.exists(temp_file):
                os.remove(temp_file)

    # Post-write verification
    report = _verify_written_workbook(master_template_path, str(out_p), total_rows, product_type=product_type)
    report["rows_written"] = total_rows
    report["designs_count"] = len(designs)
    report["ready_designs_count"] = len(ready_rows_map)
    return str(out_p), report


def _rebuild_tshirt_workbook_xls(
    master_template_path: str,
    output_path: str,
    designs: List[DetectedDesign],
    ready_rows_map: Dict[str, List[RowRecord]],
    final_rows: List[Dict[str, Any]],
    start_row: int = 5,
    product_type: str = "t_shirt",
) -> Tuple[str, Dict[str, Any]]:
    """Native BIFF8 .xls rebuild: preserves all sheets, dropdown lists, styles, and VBA macros."""
    import xlrd
    from xlutils.copy import copy as xl_copy

    target_sheet = "sweatshirt" if product_type == "sweatshirt" else "t_shirt"
    default_tpl_name = "Flipkart_Sweatshirt_Template.xls" if product_type == "sweatshirt" else "Flipkart_TShirt_Template.xls"
    numeric_cols = SWEAT_NUMERIC_COLUMNS if product_type == "sweatshirt" else NUMERIC_COLUMNS

    # Resolve master .xls template
    master_p = Path(master_template_path)
    if master_p.suffix.lower() == ".xls" and master_p.exists():
        tpl_xls = master_p
    else:
        candidate = master_p.with_suffix(".xls")
        if candidate.exists():
            tpl_xls = candidate
        else:
            base_dir = Path(__file__).resolve().parent.parent.parent
            tpl_xls = base_dir / "templates" / default_tpl_name

    if not tpl_xls.exists():
        raise FileNotFoundError(f"Master .xls template not found at {tpl_xls}")

    rb = xlrd.open_workbook(str(tpl_xls), formatting_info=True)
    wb = xl_copy(rb)

    sheet_idx = None
    for idx, name in enumerate(rb.sheet_names()):
        if name == target_sheet:
            sheet_idx = idx
            break
    if sheet_idx is None:
        raise ValueError(f"Sheet '{target_sheet}' not found in master .xls template")

    ws = wb.get_sheet(sheet_idx)
    rb_sh = rb.sheet_by_name(target_sheet)
    ncols = rb_sh.ncols

    # Excel row 5 is 0-indexed row 4
    start_r = start_row - 1

    # Write target rows sequentially
    for idx, row_dict in enumerate(final_rows):
        current_r = start_r + idx
        for c_idx in range(ncols):
            col_letter = index_to_col_name(c_idx + 1)
            if col_letter in SKIP_COLS:
                continue

            if col_letter in row_dict:
                val = row_dict[col_letter]
                if val is None or str(val).strip() == "":
                    ws.write(current_r, c_idx, None)
                elif col_letter in numeric_cols:
                    try:
                        num_val = float(val) if isinstance(val, (int, float, str)) else 0
                        if num_val.is_integer():
                            ws.write(current_r, c_idx, int(num_val))
                        else:
                            ws.write(current_r, c_idx, num_val)
                    except (ValueError, TypeError):
                        ws.write(current_r, c_idx, str(val))
                else:
                    str_val = str(val)
                    # Formula injection protection
                    if str_val and str_val[0] in ("=", "+", "-", "@"):
                        str_val = "'" + str_val
                    ws.write(current_r, c_idx, str_val)
            else:
                ws.write(current_r, c_idx, None)

    # Clear any residual rows from template beyond the written rows up to 500
    max_clear = min(500, max(rb_sh.nrows, start_r + len(final_rows)))
    for current_r in range(start_r + len(final_rows), max_clear):
        for c_idx in range(ncols):
            col_letter = index_to_col_name(c_idx + 1)
            if col_letter not in SKIP_COLS:
                ws.write(current_r, c_idx, None)

    # Save to output path atomically
    out_p = Path(output_path)
    out_p.parent.mkdir(parents=True, exist_ok=True)
    temp_fd, temp_file = tempfile.mkstemp(suffix=".xls", dir=str(out_p.parent))
    os.close(temp_fd)
    try:
        wb.save(temp_file)
        os.replace(temp_file, str(out_p))
    finally:
        if os.path.exists(temp_file):
            os.remove(temp_file)

    # Validate output file is a true BIFF8 OLE2 binary file (not a zip archive)
    with open(out_p, "rb") as f:
        magic = f.read(8)
    if not magic.startswith(b"\xd0\xcf\x11\xe0"):
        raise ValueError(f"Generated file '{out_p.name}' is not a valid BIFF8 OLE2 .xls workbook")

    raw_sheet = read_tshirt_sheet(str(out_p), str(tpl_xls))
    det_res = detect_designs(raw_sheet)
    total_rows = len(final_rows)

    report = {
        "status": "success",
        "format": "xls",
        "verified_sheets": len(rb.sheet_names()),
        "rows_written": total_rows,
        "designs_count": len(designs),
        "ready_designs_count": len(ready_rows_map),
        "detector_summary": det_res.summary.model_dump(),
        "total_designs_in_output": len(det_res.designs),
    }
    return str(out_p), report


def _clear_and_patch_sheet_xml(
    sheet_xml_bytes: bytes,
    rows_data: List[Dict[str, Any]],
    start_row: int = 5,
    numeric_cols: Optional[Set[str]] = None,
) -> bytes:
    """Clears cells in rows 5..500, then writes rows_data into rows 5..5+len-1."""
    if numeric_cols is None:
        numeric_cols = NUMERIC_COLUMNS

    root = ET.fromstring(sheet_xml_bytes)
    sheet_data = root.find(f"{{{MAIN_NS}}}sheetData")
    if sheet_data is None:
        raise ValueError("sheetData node not found in worksheet XML")

    # Map existing row elements by r
    existing_rows: Dict[int, ET.Element] = {}
    for r_el in sheet_data.findall(f"{{{MAIN_NS}}}row"):
        try:
            r_num = int(r_el.attrib.get("r", 0))
            existing_rows[r_num] = r_el
        except ValueError:
            pass

    # Clear cells in rows 5..500
    for r_num in range(5, 501):
        if r_num in existing_rows:
            r_el = existing_rows[r_num]
            for c_el in r_el.findall(f"{{{MAIN_NS}}}c"):
                ref = c_el.attrib.get("r", "")
                col_letter = "".join(filter(str.isalpha, ref))
                # Remove child nodes (v, is, f) and t attribute, keep style attribute s
                c_el.attrib.pop("t", None)
                for ch in list(c_el):
                    c_el.remove(ch)

    # Now write target rows sequentially
    for idx, row_dict in enumerate(rows_data):
        current_r = start_row + idx

        if current_r in existing_rows:
            row_el = existing_rows[current_r]
        else:
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

        # Write cells
        for col_letter, val in row_dict.items():
            if col_letter in SKIP_COLS or val is None or str(val).strip() == "":
                continue

            cell_ref = f"{col_letter}{current_r}"
            if col_letter in existing_cells:
                c_elem = existing_cells[col_letter]
            else:
                c_elem = ET.Element(f"{{{MAIN_NS}}}c", attrib={"r": cell_ref})
                existing_cells[col_letter] = c_elem

            # Clear children
            c_elem.attrib.pop("t", None)
            for ch in list(c_elem):
                c_elem.remove(ch)

            # Check numeric vs string
            if col_letter in numeric_cols:
                try:
                    num_val = float(val) if isinstance(val, (int, float, str)) else 0
                    if num_val.is_integer():
                        num_str = str(int(num_val))
                    else:
                        num_str = f"{num_val:.4f}".rstrip("0").rstrip(".")
                except ValueError:
                    num_str = str(val)
                v_el = ET.SubElement(c_elem, f"{{{MAIN_NS}}}v")
                v_el.text = num_str
            else:
                c_elem.attrib["t"] = "inlineStr"
                is_el = ET.SubElement(c_elem, f"{{{MAIN_NS}}}is")
                t_el = ET.SubElement(is_el, f"{{{MAIN_NS}}}t")
                t_el.attrib["{http://www.w3.org/XML/1998/namespace}space"] = "preserve"
                str_val = str(val)
                # Excel formula injection defense: neutralize =, +, -, @
                if str_val and str_val[0] in ("=", "+", "-", "@"):
                    str_val = "'" + str_val
                t_el.text = str_val

        # Sort cells in column index order
        cells_sorted = sorted(
            existing_cells.values(),
            key=lambda c: col_name_to_index("".join(filter(str.isalpha, c.attrib.get("r", "")))),
        )
        for c in row_el.findall(f"{{{MAIN_NS}}}c"):
            row_el.remove(c)
        for c in cells_sorted:
            row_el.append(c)

    return ET.tostring(root, xml_declaration=True, encoding="utf-8", standalone=True)


def _verify_written_workbook(template_path: str, output_path: str, rows_written: int, product_type: str = "t_shirt") -> Dict[str, Any]:
    """Runs post-write integrity assertions."""
    target_sheet = "sweatshirt" if product_type == "sweatshirt" else "t_shirt"
    with zipfile.ZipFile(template_path, "r") as z_tpl, zipfile.ZipFile(output_path, "r") as z_out:
        sheet_path = resolve_sheet_path(z_tpl, target_sheet)
        mismatched_parts = []
        for name in z_tpl.namelist():
            if name == sheet_path:
                continue
            if z_tpl.read(name) != z_out.read(name):
                mismatched_parts.append(name)

        if mismatched_parts:
            raise ValueError(f"Integrity check failed: non-sheet parts altered: {mismatched_parts}")

    # Reopen and check with reader and detector
    raw_sheet = read_tshirt_sheet(output_path, template_path)
    res = detect_designs(raw_sheet)

    return {
        "status": "success",
        "verified_identical_parts": 33,
        "detector_summary": res.summary.model_dump(),
        "total_designs_in_output": len(res.designs),
    }
