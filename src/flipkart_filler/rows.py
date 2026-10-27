"""Builds 4 RowRecord objects (S/M/L/XL) per product for the t_shirt sheet."""

import re
from typing import Any, Dict, List, Optional, Set, Tuple

from .mapper import ValueMapper
from .models import ProductInput, RowRecord, ValidationIssue
from .text_builders import (
    build_description,
    build_fabric_care,
    build_key_features,
    build_search_keywords,
)

NUMERIC_COLUMNS: Set[str] = {"K", "L", "O", "P", "R", "S", "T", "U", "V", "W", "X", "Z", "AN"}
SWEAT_NUMERIC_COLUMNS: Set[str] = {"K", "L", "O", "P", "R", "S", "T", "U", "V", "W", "X", "Z", "AH"}


def determine_sku_base(product: ProductInput, source_sheet_data: Optional[Dict[str, Any]] = None) -> str:
    """Computes sku_base: sheet stub base if available, else JSON sku_base if provided, else
    lower(style_code.split('-')[0]) + '_os' when fit is Oversized,
    else lower(style_code.split('-')[0]).
    """
    if source_sheet_data and source_sheet_data.get("sku_base"):
        return str(source_sheet_data["sku_base"]).strip()

    if product.sku_base:
        return product.sku_base.strip()

    prefix = product.style_code.split("-")[0].strip().lower()
    fit_lower = (product.fit_type or "").lower()
    if "oversized" in fit_lower or "relaxed" in fit_lower:
        return f"{prefix}_os"
    return prefix


def get_size_measuring_unit(size_val: str, ideal_for_val: str, user_unit: Optional[str] = None) -> str:
    """Computes the Flipkart size measuring unit (qualifier) for sweatshirt Column AT.
    Rules:
    - If explicit qualifier is given (and not just empty brackets/string), use it.
    - If size is purely numeric (e.g. 32, 34, 36), qualifier is 'Number'.
    - If Ideal For is baby/kids (Baby Boys, Baby Girls, Boys, Girls), qualifier is 'Kids'.
    - Otherwise (Men, Women, Couple, etc.) for alpha sizes (S, M, L, XL, etc.), qualifier is 'Regular'.
    """
    if user_unit and str(user_unit).strip():
        cleaned = str(user_unit).strip().strip("[]").strip()
        if cleaned:
            return cleaned

    s = str(size_val).strip()
    if s.isdigit():
        return "Number"

    ideal_lower = str(ideal_for_val).strip().lower()
    if any(k in ideal_lower for k in ["baby", "boy", "girl", "kid"]):
        return "Kids"

    return "Regular"


def build_product_rows(
    product: ProductInput,
    mapper: ValueMapper,
    existing_skus: Set[str],
    source_sheet_data: Optional[Dict[str, Any]] = None,
    product_index: Optional[int] = None,
    product_type: str = "t_shirt",
) -> Tuple[List[RowRecord], List[ValidationIssue]]:
    """Generates 4 rows (one per size) for a product, validating attributes and constraints.
    Returns (list_of_4_RowRecords, list_of_issues).
    """
    issues: List[ValidationIssue] = []

    # 1. Map attributes to canonical Flipkart values
    mapped_neck, neck_issue = mapper.map_attribute("neck", product.neck_type)
    if neck_issue:
        issues.append(neck_issue)

    mapped_pattern, pattern_issue = mapper.map_attribute("pattern", product.pattern, allow_multi=True)
    if pattern_issue:
        issues.append(pattern_issue)

    mapped_fabric, fabric_issue = mapper.map_attribute("fabric", product.material)
    if fabric_issue:
        issues.append(fabric_issue)

    mapped_ideal_for, ideal_issue = mapper.map_attribute("ideal_for", product.ideal_for)
    if ideal_issue:
        issues.append(ideal_issue)

    mapped_sleeve, sleeve_issue = mapper.map_attribute("sleeve", product.sleeve_type)
    if sleeve_issue:
        issues.append(sleeve_issue)

    occ_input = product.occasion or "Casual"
    mapped_occ, occ_issue = mapper.map_attribute("occasion", occ_input)
    if occ_issue:
        # Fallback to Casual if occasion mapping fails
        mapped_occ = "Casual"
        issues.append(
            ValidationIssue(
                level="WARNING",
                field="occasion",
                message=f"Occasion '{occ_input}' could not be mapped. Defaulted to 'Casual'.",
            )
        )

    if product_type == "sweatshirt":
        mapped_fit = product.fit_type or "Regular"
    else:
        mapped_fit, fit_issue = mapper.map_attribute("fit", product.fit_type)
        if fit_issue:
            issues.append(fit_issue)

    mapped_color, color_issue = mapper.map_attribute("color", product.color, allow_multi=True)
    if color_issue:
        issues.append(color_issue)

    # If critical mappings failed with ERROR, abort row creation
    critical_errors = [i for i in issues if i.level == "ERROR"]
    if critical_errors:
        return [], issues

    # 2. Build text blocks
    allowed_care = mapper.allowed_values.get("fabric care", [])
    fabric_care = build_fabric_care(product, allowed_care_values=allowed_care)
    description, desc_warn = build_description(product)
    if desc_warn:
        issues.append(desc_warn)
    search_keywords = build_search_keywords(product)
    key_features = build_key_features(product)

    # 3. Determine placements & styling
    desc_lower = product.product_description.lower()
    if "back print only" in desc_lower or "back only" in desc_lower:
        detail_placement = "Back Panel"
    else:
        detail_placement = mapper.defaults.get("detail_placement", "Front Panel")

    full_text = (
        product.product_description + " " + " ".join(product.key_features) + " " + product.pattern
    ).lower()

    allowed_surface = mapper.allowed_values.get("surface styling", [])
    if not allowed_surface:
        if product_type == "sweatshirt":
            allowed_surface = [
                "Applique", "Bow", "Braids", "Button Flap Pocket", "Crochets & Schiffily",
                "Cut-Outs", "Fringed", "Knots", "Laces", "None", "Pockets", "Ruffled",
                "Sequined", "Tie-Ups"
            ]
        else:
            allowed_surface = [
                "Applique", "Beads & Stones", "Bow", "Braids", "Brand Logo", "Buttons",
                "Crochets & Schiffily", "Cut-Outs", "Cut-work", "Epaulettes", "Eyelets",
                "Fringed", "Knots", "Laces", "Mesh", "Metal Embellishment", "None",
                "Patch Work", "Pearl", "Perforation", "Piping Details", "Pocket Flap",
                "Pockets", "Pompom", "Ruffled", "Sequins", "Shimmer", "Side Stripe",
                "Statement Logo", "Tassels", "Thread Work", "Tie-Ups", "Twill Tape",
                "Typography", "Zipper Details"
            ]

    raw_surface = getattr(product, "surface_styling", None)
    if not raw_surface and source_sheet_data:
        raw_surface = source_sheet_data.get("BR") if product_type == "sweatshirt" else source_sheet_data.get("BJ")

    if raw_surface:
        raw_surface_str = str(raw_surface).strip()
        matched_surface = next((v for v in allowed_surface if v.lower() == raw_surface_str.lower()), None)
        surface_styling = matched_surface or "None"
    else:
        if product_type == "sweatshirt":
            surface_styling = "None"
        else:
            if any(k in full_text for k in ["typography", "lettering", "text print", "slogan"]) and any(v.lower() == "typography" for v in allowed_surface):
                surface_styling = "Typography"
            else:
                surface_styling = "None"

    # 4. Check images & source sheet images
    if product.images:
        issues.append(
            ValidationIssue(
                level="WARNING",
                field="images",
                message="images in JSON ignored; links are taken from the sheet",
            )
        )

    # 5. Check Brand Color
    brand_color_val = (product.brand_color or product.color).strip()
    if len(brand_color_val) > 128:
        brand_color_val = brand_color_val[:128].strip()
        issues.append(
            ValidationIssue(
                level="WARNING",
                field="brand_color",
                message="Brand Color was truncated to 128 characters.",
            )
        )

    sku_base = determine_sku_base(product, source_sheet_data=source_sheet_data)
    sizes = product.sizes or mapper.defaults.get("sizes", ["S", "M", "L", "XL"])

    # Validate / extract source sheet images
    if product_type == "sweatshirt":
        img_cols = ["AX", "AY", "AZ", "BA", "BB"]
        extra_stub_cols = ["BC", "BM", "CA", "D"]
    else:
        img_cols = ["AU", "AV", "AW", "AX", "AY", "AZ", "BA"]
        extra_stub_cols = ["BB", "BI", "BP", "D"]
    final_sheet_cells: Dict[str, str] = {}

    if source_sheet_data is None:
        issues.append(
            ValidationIssue(
                level="WARNING",
                field="images",
                message=f"No source sheet provided. Image columns will remain blank for {sku_base}.",
            )
        )
    else:
        for col in img_cols:
            raw_val = source_sheet_data.get(col)
            if raw_val is None or str(raw_val) == "":
                issues.append(
                    ValidationIssue(
                        level="WARNING",
                        field=col,
                        message=f"{sku_base}: image slot {col} empty in sheet",
                    )
                )
            else:
                val_str = str(raw_val)
                if not val_str.startswith("https://"):
                    issues.append(
                        ValidationIssue(
                            level="WARNING",
                            field=col,
                            message=f"Image URL in slot {col} does not start with 'https://': {val_str}",
                        )
                    )
                final_sheet_cells[col] = val_str

        # Extra columns from stub if non-empty
        for extra_col in extra_stub_cols:
            extra_val = source_sheet_data.get(extra_col)
            if extra_val is not None and str(extra_val) != "":
                final_sheet_cells[extra_col] = str(extra_val)

    rows: List[RowRecord] = []
    defaults = mapper.defaults

    for size in sizes:
        sku = f"{sku_base}_{size}"
        if len(sku) > 64:
            issues.append(
                ValidationIssue(
                    level="ERROR",
                    field="Seller SKU ID",
                    message=f"Seller SKU ID '{sku}' exceeds maximum 64 characters ({len(sku)} chars).",
                )
            )

        if sku in existing_skus:
            issues.append(
                ValidationIssue(
                    level="ERROR",
                    field="Seller SKU ID",
                    message=f"Duplicate Seller SKU ID '{sku}' already exists in sheet or batch.",
                )
            )
        existing_skus.add(sku)

        # Determine HSN
        hsn_mode = defaults.get("hsn_mode", "sku")
        if hsn_mode == "sku":
            hsn_val = sku
        else:
            hsn_val = str(defaults.get("hsn_fixed", ""))

        mrp_val = float(product.mrp if product.mrp is not None else defaults.get("mrp", 1999))
        sp_val = float(
            product.selling_price
            if product.selling_price is not None
            else defaults.get("selling_price", 749)
        )

        handling = defaults.get("handling_fees", {})
        pkg = defaults.get("package_cm", {})

        group_val = str(defaults.get("group_id", f"group {product_index}" if product_index else "group 1"))
        mfg_val = str(defaults.get("manufacturer", "fashion continental"))
        packer_val = str(defaults.get("packer", mfg_val))
        brand_val = str(defaults.get("brand", "fashion continental"))

        if product_type == "sweatshirt":
            cells: Dict[str, Any] = {
                "G": sku,
                "H": group_val,
                "J": str(defaults.get("listing_status", "Active")),
                "K": mrp_val,
                "L": sp_val,
                "M": str(defaults.get("fulfilment_by", "Seller")),
                "N": str(defaults.get("procurement_type", "instock")),
                "O": int(defaults.get("procurement_sla_days", 2)),
                "P": int(defaults.get("stock", 2000)),
                "Q": str(defaults.get("shipping_provider", "Flipkart")),
                "R": float(handling.get("local", 0)),
                "S": float(handling.get("zonal", 0)),
                "T": float(handling.get("national", 0)),
                "U": float(pkg.get("length", 30)),
                "V": float(pkg.get("breadth", 25)),
                "W": float(pkg.get("height", 4)),
                "X": float(defaults.get("weight_kg", 0.45)),
                "Y": hsn_val,
                "Z": float(defaults.get("luxury_cess", 0)),
                "AA": str(defaults.get("country_of_origin", "India")),
                "AB": mfg_val,
                "AC": packer_val,
                "AE": str(defaults.get("tax_code", "GST_APPAREL")),
                "AG": brand_val,
                "AH": int(defaults.get("pack_of", 1)),
                "AI": mapped_fabric,
                "AJ": mapped_pattern,
                "AK": str(defaults.get("reversible", "No")),
                "AL": mapped_sleeve,
                "AM": mapped_ideal_for,
                "AN": fabric_care,
                "AO": str(defaults.get("hooded", "No")),
                "AP": str(defaults.get("closure", "No Closure")),
                "AQ": mapped_neck,
                "AR": str(defaults.get("suitable_for", "Western Wear")),
                "AS": size,
                "AT": get_size_measuring_unit(
                    size,
                    mapped_ideal_for,
                    getattr(product, "size_measuring_unit", None) or (source_sheet_data.get("AT") if source_sheet_data else ""),
                ),
                "AU": str(product.style_code or "").strip() or sku_base,
                "AV": mapped_color,
                "AW": brand_color_val,
                "BD": str(defaults.get("character", "None")),
                "BE": "",
                "BF": mapped_pattern,
                "BG": detail_placement,
                "BH": "",
                "BI": "",
                "BJ": mapped_occ,
                "BK": "",
                "BL": str(defaults.get("items_included", "1 Sweatshirt")),
                "BQ": "",
                "BR": surface_styling,
                "BS": str(defaults.get("sleeve_details", "Cuffed")),
                "BT": str(defaults.get("winter_type", "Heavy Winter")),
                "BW": description,
                "BX": search_keywords,
                "BY": key_features,
            }
        else:
            cells: Dict[str, Any] = {
                "G": sku,
                "H": group_val,
                "J": str(defaults.get("listing_status", "Active")),
                "K": mrp_val,
                "L": sp_val,
                "M": str(defaults.get("fulfilment_by", "Seller")),
                "N": str(defaults.get("procurement_type", "instock")),
                "O": int(defaults.get("procurement_sla_days", 2)),
                "P": int(defaults.get("stock", 2000)),
                "Q": str(defaults.get("shipping_provider", "Flipkart")),
                "R": float(handling.get("local", 0)),
                "S": float(handling.get("zonal", 0)),
                "T": float(handling.get("national", 0)),
                "U": float(pkg.get("length", 25)),
                "V": float(pkg.get("breadth", 20)),
                "W": float(pkg.get("height", 3)),
                "X": float(defaults.get("weight_kg", 0.222)),
                "Y": hsn_val,
                "Z": float(defaults.get("luxury_cess", 0)),
                "AA": str(defaults.get("country_of_origin", "India")),
                "AB": mfg_val,
                "AC": packer_val,
                "AE": str(defaults.get("tax_code", "GST_APPAREL")),
                # AF empty
                "AG": brand_val,
                "AH": mapped_neck,
                "AI": mapped_pattern,
                "AJ": mapped_fabric,
                "AK": mapped_ideal_for,
                "AL": mapped_sleeve,
                "AM": mapped_occ,
                "AN": int(defaults.get("pack_of", 1)),
                "AO": mapped_fit,
                "AP": str(defaults.get("suitable_for", "Western Wear")),
                "AQ": str(product.style_code or "").strip() or sku_base,
                "AR": size,
                "AS": mapped_color,
                "AT": brand_color_val,
                # AU..BA: images
                "BD": detail_placement,
                "BE": str(defaults.get("print_coverage", "Chest")),
                "BF": str(defaults.get("tee_length", "Medium")),
                "BG": str(defaults.get("reversible", "No")),
                "BH": fabric_care,
                # BI empty
                "BJ": surface_styling,
                "BK": str(defaults.get("sleeve_details", "No Details")),
                # BL empty
                "BM": description,
                "BN": search_keywords,
                "BO": key_features,
                # BP empty
            }

        # Populate images and extra stub cells
        for c_key, c_val in final_sheet_cells.items():
            cells[c_key] = c_val

        record = RowRecord(size=size, sku=sku, cells=cells)
        rows.append(record)

    return rows, issues
