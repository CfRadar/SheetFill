"""Design detector service for classifying rows and grouping into designs."""

import math
import re
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from app.services.sheet_reader import RawRow, RawSheet

SIZE_REGEX = re.compile(r"^(.*)_(XXS|XS|S|M|L|XL|XXL|3XL|4XL|5XL|Free)$", re.IGNORECASE)
IMAGE_COLS = ["AU", "AV", "AW", "AX", "AY", "AZ", "BA"]

PRODUCT_CONFIGS: Dict[str, Dict[str, Any]] = {
    "t_shirt": {
        "image_cols": ["AU", "AV", "AW", "AX", "AY", "AZ", "BA"],
        "palette_col": "BB",
        "video_col": "BI",
        "supplier_col": "BP",
        "product_link_col": "D",
        "desc_col": "BM",
        "required_cols": ["K", "L", "BM"],
    },
    "sweatshirt": {
        "image_cols": ["AX", "AY", "AZ", "BA", "BB"],
        "palette_col": "BC",
        "video_col": "BM",
        "supplier_col": "CA",
        "product_link_col": "D",
        "desc_col": "BW",
        "required_cols": ["K", "L", "BW"],
    },
}


class DetectedDesign(BaseModel):
    """Represents a detected product design from the worksheet."""

    id: str  # d1, d2, ...
    kind: str  # "expanded" | "stub"
    status: str  # "complete" | "partial" | "needs_json"
    base: Optional[str] = None  # Seller SKU base (e.g. tintin_os) or None for orphans
    sheet_rows: List[int] = Field(default_factory=list)  # [5, 6, 7, 8]
    sizes_found: List[str] = Field(default_factory=list)  # ["S", "M", "L", "XL"]
    image_urls: List[Optional[str]] = Field(default_factory=lambda: [None] * 7)  # AU..BA
    main_image_url: Optional[str] = None
    palette_url: Optional[str] = None  # Col BB
    video_url: Optional[str] = None  # Col BI
    supplier_image: Optional[str] = None  # Col BP
    product_link: Optional[str] = None  # Col D
    is_manual_slot: bool = False
    existing_values: Dict[str, Any] = Field(default_factory=dict)  # Col -> value (from first row, G excluded)
    missing_required: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)


class DetectionSummary(BaseModel):
    """Aggregate statistics for detected designs in the sheet."""

    total: int
    needs_json: int
    partial: int
    complete: int
    free_rows: int
    room_for_new_designs: int
    capacity_designs: int = 124


class DetectionResult(BaseModel):
    """Overall outcome of analyzing a t_shirt sheet."""

    summary: DetectionSummary
    designs: List[DetectedDesign]
    last_data_row: int


def _is_cell_filled(val: Any) -> bool:
    return val is not None and str(val).strip() != ""


def _row_has_data_in_g_to_bp(row: RawRow) -> bool:
    """Checks if any cell in G..BP (ignoring I) is non-empty."""
    for col, val in row.cells.items():
        if col in ["A", "B", "C", "D", "E", "F", "I"]:
            continue
        if _is_cell_filled(val):
            return True
    return False


def detect_designs(raw_sheet: RawSheet) -> DetectionResult:
    """Groups rows into designs and computes statuses and metrics.
    
    Data area = rows 5..500.
    """
    classified_rows: List[Dict[str, Any]] = []
    last_non_empty_row = 4

    for row in raw_sheet.rows:
        if row.row_index < 5 or row.row_index > 500:
            continue

        sku_val = row.get("G")
        sku_str = str(sku_val).strip() if sku_val is not None else ""

        has_data = _row_has_data_in_g_to_bp(row)
        if has_data:
            last_non_empty_row = max(last_non_empty_row, row.row_index)

        if not has_data and not sku_str:
            row_type = "EMPTY_ROW"
            base = None
            size = None
        elif sku_str:
            match = SIZE_REGEX.match(sku_str)
            if match:
                row_type = "SIZE_ROW"
                base = match.group(1).strip()
                size = match.group(2).upper()
                if size == "FREE":
                    size = "Free"
            else:
                row_type = "STUB_ROW"
                base = sku_str
                size = None
        else:
            # sku_str is empty but has data in G..BP
            row_type = "ORPHAN_ROW"
            base = None
            size = None

        classified_rows.append({
            "row": row,
            "type": row_type,
            "base": base,
            "size": size,
        })

    # Group into designs
    designs: List[DetectedDesign] = []
    design_counter = 1
    current_expanded_base: Optional[str] = None
    current_expanded_rows: List[Dict[str, Any]] = []

    p_type = getattr(raw_sheet, "product_type", "t_shirt")
    cfg = PRODUCT_CONFIGS.get(p_type, PRODUCT_CONFIGS["t_shirt"])
    cfg_img_cols = cfg["image_cols"]
    cfg_palette_col = cfg["palette_col"]
    cfg_video_col = cfg["video_col"]
    cfg_supplier_col = cfg["supplier_col"]
    cfg_required_cols = cfg["required_cols"]

    def flush_expanded() -> None:
        nonlocal current_expanded_base, current_expanded_rows, design_counter
        if not current_expanded_rows:
            return

        first_row = current_expanded_rows[0]["row"]
        sheet_rows = [item["row"].row_index for item in current_expanded_rows]
        sizes = [item["size"] for item in current_expanded_rows if item["size"]]

        # Check status: complete if every row has required columns non-empty
        missing_cols = set()
        for item in current_expanded_rows:
            r = item["row"]
            for req_c in cfg_required_cols:
                if not _is_cell_filled(r.get(req_c)):
                    missing_cols.add(req_c)

        status = "complete" if not missing_cols else "partial"

        # Image URLs from first row (padded to 7 slots)
        raw_images = [str(first_row.get(col)) if _is_cell_filled(first_row.get(col)) else None for col in cfg_img_cols]
        image_urls = (raw_images + [None] * 7)[:7]
        main_img = next((img for img in image_urls if img), None)
        palette_url = str(first_row.get(cfg_palette_col)) if _is_cell_filled(first_row.get(cfg_palette_col)) else None
        video_url = str(first_row.get(cfg_video_col)) if _is_cell_filled(first_row.get(cfg_video_col)) else None
        supplier_image = str(first_row.get(cfg_supplier_col)) if _is_cell_filled(first_row.get(cfg_supplier_col)) else None
        prod_link = str(first_row.get("D")) if _is_cell_filled(first_row.get("D")) else None

        # Existing values from first row (excluding G)
        existing_vals = {}
        for col, val in first_row.cells.items():
            if col not in ["A", "B", "C", "D", "E", "F", "G", "I"] and _is_cell_filled(val):
                existing_vals[col] = val

        designs.append(DetectedDesign(
            id=f"d{design_counter}",
            kind="expanded",
            status=status,
            base=current_expanded_base,
            sheet_rows=sheet_rows,
            sizes_found=sizes,
            image_urls=image_urls,
            main_image_url=main_img,
            palette_url=palette_url,
            video_url=video_url,
            supplier_image=supplier_image,
            product_link=prod_link,
            is_manual_slot=False,
            existing_values=existing_vals,
            missing_required=sorted(list(missing_cols)),
            warnings=[],
        ))
        design_counter += 1
        current_expanded_base = None
        current_expanded_rows = []

    seen_bases: set = set()

    for item in classified_rows:
        rtype = item["type"]
        if rtype == "EMPTY_ROW":
            flush_expanded()
            continue

        if rtype == "SIZE_ROW":
            base = item["base"]
            if current_expanded_base is not None and base == current_expanded_base:
                current_expanded_rows.append(item)
            else:
                flush_expanded()
                warnings = []
                if base in seen_bases:
                    warnings.append(f"SIZE_ROW with base '{base}' is non-contiguous with previous occurrences.")
                seen_bases.add(base)
                current_expanded_base = base
                current_expanded_rows = [item]

        elif rtype in ["STUB_ROW", "ORPHAN_ROW"]:
            flush_expanded()
            row = item["row"]
            base = item["base"]
            if base:
                seen_bases.add(base)

            # Image URLs from stub row (padded to 7 slots)
            raw_images = [str(row.get(col)) if _is_cell_filled(row.get(col)) else None for col in cfg_img_cols]
            image_urls = (raw_images + [None] * 7)[:7]
            main_img = next((img for img in image_urls if img), None)
            palette_url = str(row.get(cfg_palette_col)) if _is_cell_filled(row.get(cfg_palette_col)) else None
            video_url = str(row.get(cfg_video_col)) if _is_cell_filled(row.get(cfg_video_col)) else None
            supplier_image = str(row.get(cfg_supplier_col)) if _is_cell_filled(row.get(cfg_supplier_col)) else None
            prod_link = str(row.get("D")) if _is_cell_filled(row.get("D")) else None

            existing_vals = {}
            for col, val in row.cells.items():
                if col not in ["A", "B", "C", "D", "E", "F", "G", "I"] and _is_cell_filled(val):
                    existing_vals[col] = val

            designs.append(DetectedDesign(
                id=f"d{design_counter}",
                kind="stub",
                status="needs_json",
                base=base,
                sheet_rows=[row.row_index],
                sizes_found=[],
                image_urls=image_urls,
                main_image_url=main_img,
                palette_url=palette_url,
                video_url=video_url,
                supplier_image=supplier_image,
                product_link=prod_link,
                is_manual_slot=False,
                existing_values=existing_vals,
                missing_required=sorted(list(cfg_required_cols)),
                warnings=[],
            ))
            design_counter += 1

    flush_expanded()

    # Calculate summary
    total = len(designs)
    needs_json = sum(1 for d in designs if d.status == "needs_json")
    partial = sum(1 for d in designs if d.status == "partial")
    complete = sum(1 for d in designs if d.status == "complete")

    free_rows = 500 - last_non_empty_row
    room_for_new_designs = math.floor(free_rows / 4)

    return DetectionResult(
        summary=DetectionSummary(
            total=total,
            needs_json=needs_json,
            partial=partial,
            complete=complete,
            free_rows=free_rows,
            room_for_new_designs=room_for_new_designs,
            capacity_designs=124,
        ),
        designs=designs,
        last_data_row=last_non_empty_row,
    )
