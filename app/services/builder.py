"""Builder service for merging JSON, stub values, and defaults into RowRecords."""

from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple
from pydantic import BaseModel, Field

from app.services.design_detector import DetectedDesign
from flipkart_filler.allowed_values import load_allowed_values
from flipkart_filler.mapper import ValueMapper
from flipkart_filler.models import ProductInput, RowRecord, ValidationIssue
from flipkart_filler.text_builders import (
    build_description,
    build_fabric_care,
    build_key_features,
    build_search_keywords,
)

IMAGE_COLS = ["AU", "AV", "AW", "AX", "AY", "AZ", "BA"]


def get_default_mapper(template_path: Optional[str] = None) -> ValueMapper:
    """Creates a configured ValueMapper using default config paths and the master template."""
    base_dir = Path(__file__).resolve().parent.parent.parent
    if not template_path:
        template_path = str(base_dir / "templates" / "Flipkart_TShirt_Template.xlsm")
    mappings_path = str(base_dir / "config" / "mappings.yaml")
    defaults_path = str(base_dir / "config" / "defaults.yaml")
    allowed = load_allowed_values(template_path)
    return ValueMapper(mappings_path=mappings_path, defaults_path=defaults_path, allowed_values=allowed)


class BuildResult(BaseModel):
    """Result of building preview rows for a design."""

    design_id: str
    status: str  # "valid" | "invalid" | "blocked" | "needs_json"
    rows: List[RowRecord] = Field(default_factory=list)
    errors: List[ValidationIssue] = Field(default_factory=list)
    warnings: List[ValidationIssue] = Field(default_factory=list)


def build_design_rows(
    design: DetectedDesign,
    json_data: Optional[Dict[str, Any]],
    mapper: ValueMapper,
    existing_skus_in_session: Set[str],
    custom_sizes: Optional[List[str]] = None,
    image_edits: Optional[List[Optional[str]]] = None,
    product_link_edit: Optional[str] = None,
    existing_urls_by_design: Optional[Dict[str, str]] = None,
) -> BuildResult:
    """Builds size rows for a single design adhering strictly to Section 5 rules."""
    errors: List[ValidationIssue] = []
    warnings: List[ValidationIssue] = []

    if not json_data:
        return BuildResult(
            design_id=design.id,
            status="needs_json",
            rows=[],
            errors=[],
            warnings=[],
        )

    # 1. Determine sku_base
    stub_base = design.base.strip() if design.base else None
    json_base = (json_data.get("sku_base") or "").strip() or None

    if stub_base:
        sku_base = stub_base
        if json_base and json_base != stub_base:
            warnings.append(
                ValidationIssue(
                    level="WARNING",
                    field="sku_base",
                    message=f"JSON sku_base '{json_base}' differs from sheet base '{stub_base}'. Kept sheet base '{stub_base}'.",
                )
            )
    else:
        # Orphan or manual slot without stub_base in sheet
        if not json_base:
            import re
            style_code = (json_data.get("style_code") or "").strip()
            title = (json_data.get("product_title") or "").strip()
            if style_code:
                prefix = re.sub(r"[^a-zA-Z0-9_]", "", style_code.split("-")[0].strip().lower())
                json_base = f"{prefix}_os" if prefix else None
            elif title:
                m = re.search(r"–\s*([^–]+?)\s*(?:Graphic Print|T-Shirt|$)", title, flags=re.IGNORECASE)
                if m:
                    cand = re.sub(r"[^a-zA-Z0-9_]", "_", m.group(1).strip().lower()).strip("_")
                    json_base = f"{cand}_os" if not cand.endswith("_os") else cand

        if not json_base:
            errors.append(
                ValidationIssue(
                    level="ERROR",
                    field="sku_base",
                    message="sku_base is not in sheet; please specify sku_base, style_code, or product_title.",
                )
            )
            return BuildResult(
                design_id=design.id,
                status="blocked",
                rows=[],
                errors=errors,
                warnings=warnings,
            )
        sku_base = json_base

    # 2. Determine sizes
    defaults = mapper.defaults
    allowed_sizes = mapper.allowed_values.get("brand size", ["S", "M", "L", "XL"])
    sizes = custom_sizes or design.sizes_found or json_data.get("sizes") or defaults.get("sizes", ["S", "M", "L", "XL"])

    # Validate sizes against allowed
    valid_sizes = []
    for s in sizes:
        s_clean = s.strip()
        matched = False
        for allowed in allowed_sizes:
            if s_clean.lower() == allowed.lower():
                valid_sizes.append(allowed)
                matched = True
                break
        if not matched:
            errors.append(
                ValidationIssue(
                    level="ERROR",
                    field="Brand Size",
                    message=f"Size '{s_clean}' is not an allowed Brand Size.",
                    suggestions=allowed_sizes[:5],
                )
            )
    if errors:
        return BuildResult(
            design_id=design.id,
            status="invalid",
            rows=[],
            errors=errors,
            warnings=warnings,
        )

    sizes = valid_sizes

    # 3. Check SKU length and uniqueness
    candidate_skus = [f"{sku_base}_{size}" for size in sizes]
    for sku in candidate_skus:
        if len(sku) > 64:
            errors.append(
                ValidationIssue(
                    level="ERROR",
                    field="Seller SKU ID",
                    message=f"Seller SKU ID '{sku}' exceeds maximum 64 characters ({len(sku)} chars).",
                )
            )
        if sku in existing_skus_in_session:
            errors.append(
                ValidationIssue(
                    level="ERROR",
                    field="Seller SKU ID",
                    message=f"Duplicate Seller SKU ID '{sku}' clashes with an existing design row.",
                )
            )

    if any(e.field == "Seller SKU ID" and "Duplicate" in e.message for e in errors):
        return BuildResult(
            design_id=design.id,
            status="blocked",
            rows=[],
            errors=errors,
            warnings=warnings,
        )
    if errors:
        return BuildResult(
            design_id=design.id,
            status="invalid",
            rows=[],
            errors=errors,
            warnings=warnings,
        )

    # 4. Resolve 7 Image URLs (AU..BA) with Precedence:
    # 1. manual UI edit (only if unlocked or manual slot), 2. sheet stub value, 3. nothing (blank). JSON is not a source.
    if json_data.get("images"):
        warnings.append(
            ValidationIssue(
                level="WARNING",
                field="images",
                message="images in JSON ignored; links are taken from the sheet",
            )
        )

    final_images: List[Optional[str]] = [None] * 7
    stub_images = design.image_urls or [None] * 7

    for i in range(7):
        col = IMAGE_COLS[i]
        ui_val = image_edits[i] if (image_edits and i < len(image_edits)) else None
        stub_val = stub_images[i] if i < len(stub_images) else None

        if ui_val is not None and str(ui_val) != "":
            final_images[i] = str(ui_val)
        elif stub_val is not None and str(stub_val) != "":
            # Exact text from stub row, no trimming of URL body, no re-encoding
            final_images[i] = str(stub_val)
        else:
            final_images[i] = None
            if not design.is_manual_slot:
                warnings.append(
                    ValidationIssue(
                        level="WARNING",
                        field=col,
                        message=f"{sku_base}: image slot {col} empty in sheet",
                    )
                )

    # Validate image URLs (every copied link must start with https://, else WARNING, still copied unchanged)
    for i, url in enumerate(final_images):
        if url:
            if not url.startswith("https://"):
                warnings.append(
                    ValidationIssue(
                        level="WARNING",
                        field=IMAGE_COLS[i],
                        message=f"Image URL in slot {IMAGE_COLS[i]} does not start with 'https://': {url}",
                    )
                )

    # Warn if the same URL is used by two different designs
    if existing_urls_by_design is not None:
        for url in final_images:
            if url:
                if url in existing_urls_by_design and existing_urls_by_design[url] != design.id:
                    warnings.append(
                        ValidationIssue(
                            level="WARNING",
                            field="images",
                            message=f"Image URL '{url}' is also used by design '{existing_urls_by_design[url]}'.",
                        )
                    )
                else:
                    existing_urls_by_design[url] = design.id

    # Flipkart Product Link (Col D): manual UI edit > stub > None
    final_product_link = None
    if product_link_edit is not None and str(product_link_edit) != "":
        final_product_link = str(product_link_edit)
    elif design.product_link and str(design.product_link) != "":
        final_product_link = str(design.product_link)
    elif design.existing_values.get("D"):
        final_product_link = str(design.existing_values["D"])

    # Extra stub columns if non-empty: BB (Palette), BI (Video), BP (Supplier Image)
    final_palette_url = design.palette_url or design.existing_values.get("BB")
    final_video_url = design.video_url or design.existing_values.get("BI")
    final_supplier_image = design.supplier_image or design.existing_values.get("BP")

    # 5. Map attributes using ValueMapper
    # Map neck
    neck_input = json_data.get("neck_type") or design.existing_values.get("AH") or "Round Neck"
    mapped_neck, neck_issue = mapper.map_attribute("neck", neck_input)
    if neck_issue:
        if neck_issue.level == "ERROR":
            errors.append(neck_issue)
        else:
            warnings.append(neck_issue)

    # Map pattern
    pattern_input = json_data.get("pattern") or design.existing_values.get("AI") or "Graphic Print"
    mapped_pattern, pattern_issue = mapper.map_attribute("pattern", pattern_input, allow_multi=True)
    if pattern_issue:
        if pattern_issue.level == "ERROR":
            errors.append(pattern_issue)
        else:
            warnings.append(pattern_issue)

    # Map fabric
    fabric_input = json_data.get("material") or design.existing_values.get("AJ") or "Cotton Blend"
    mapped_fabric, fabric_issue = mapper.map_attribute("fabric", fabric_input)
    if fabric_issue:
        if fabric_issue.level == "ERROR":
            errors.append(fabric_issue)
        else:
            warnings.append(fabric_issue)

    # Map ideal_for
    ideal_input = json_data.get("ideal_for") or design.existing_values.get("AK") or "Men"
    mapped_ideal, ideal_issue = mapper.map_attribute("ideal_for", ideal_input)
    if ideal_issue:
        if ideal_issue.level == "ERROR":
            errors.append(ideal_issue)
        else:
            warnings.append(ideal_issue)

    # Map sleeve
    sleeve_input = json_data.get("sleeve_type") or design.existing_values.get("AL") or "Half Sleeve"
    mapped_sleeve, sleeve_issue = mapper.map_attribute("sleeve", sleeve_input)
    if sleeve_issue:
        if sleeve_issue.level == "ERROR":
            errors.append(sleeve_issue)
        else:
            warnings.append(sleeve_issue)

    # Map occasion
    occ_input = json_data.get("occasion") or design.existing_values.get("AM") or "Casual"
    mapped_occ, occ_issue = mapper.map_attribute("occasion", occ_input)
    if occ_issue:
        mapped_occ = "Casual"
        warnings.append(
            ValidationIssue(
                level="WARNING",
                field="occasion",
                message=f"Occasion '{occ_input}' could not be mapped. Defaulted to 'Casual'.",
            )
        )

    # Map fit
    fit_input = json_data.get("fit_type") or design.existing_values.get("AO") or "Regular"
    mapped_fit, fit_issue = mapper.map_attribute("fit", fit_input)
    if fit_issue:
        if fit_issue.level == "ERROR":
            errors.append(fit_issue)
        else:
            warnings.append(fit_issue)

    # Map color
    color_input = json_data.get("color") or design.existing_values.get("AS") or "Black"
    mapped_color, color_issue = mapper.map_attribute("color", color_input, allow_multi=True)
    if color_issue:
        if color_issue.level == "ERROR":
            errors.append(color_issue)
        else:
            warnings.append(color_issue)

    # 6. Text blocks: Description, Fabric Care, Keywords, Key Features
    # Check for direct overrides first
    desc_val = json_data.get("description_override") or json_data.get("product_description") or design.existing_values.get("BM")
    if desc_val:
        desc_val = str(desc_val).strip()
        if len(desc_val) > 10000:
            errors.append(
                ValidationIssue(
                    level="ERROR",
                    field="Description",
                    message="Description exceeds maximum 10,000 characters.",
                )
            )
    else:
        # Build using text_builders
        prod_obj = ProductInput(
            product_title=json_data.get("product_title", ""),
            product_description=json_data.get("product_description", ""),
            key_features=json_data.get("key_features", []),
            material=fabric_input,
            pattern=pattern_input,
            sleeve_type=sleeve_input,
            neck_type=neck_input,
            fit_type=fit_input,
            ideal_for=ideal_input,
            color=color_input,
            style_code=str(json_data.get("style_code", "")),
        )
        desc_val, desc_w = build_description(prod_obj)
        if desc_w:
            warnings.append(desc_w)

    # Key Features
    kf_sheet = json_data.get("key_features_sheet")
    if kf_sheet:
        key_features_str = str(kf_sheet).strip()
    else:
        kf_input = json_data.get("key_features")
        if isinstance(kf_input, list):
            key_features_str = "::".join([str(k).strip() for k in kf_input if str(k).strip()])
        elif isinstance(kf_input, str):
            key_features_str = kf_input.strip()
        elif design.existing_values.get("BO"):
            key_features_str = str(design.existing_values["BO"]).strip()
        else:
            key_features_str = ""

    # Search Keywords
    sk_input = json_data.get("search_keywords")
    if isinstance(sk_input, list):
        search_keywords_str = "::".join([str(k).strip() for k in sk_input if str(k).strip()])
    elif isinstance(sk_input, str):
        search_keywords_str = sk_input.strip()
    elif design.existing_values.get("BN"):
        search_keywords_str = str(design.existing_values["BN"]).strip()
    else:
        search_keywords_str = ""

    # Fabric Care
    care_input = json_data.get("fabric_care") or design.existing_values.get("BH")
    if care_input:
        fabric_care_str = str(care_input).strip()
    else:
        allowed_care = mapper.allowed_values.get("fabric care", [])
        prod_obj = ProductInput(
            product_title=json_data.get("product_title", ""),
            product_description=json_data.get("product_description", ""),
            key_features=json_data.get("key_features", []),
            material=fabric_input,
            pattern=pattern_input,
            sleeve_type=sleeve_input,
            neck_type=neck_input,
            fit_type=fit_input,
            ideal_for=ideal_input,
            color=color_input,
            style_code=str(json_data.get("style_code", "")),
        )
        fabric_care_str = build_fabric_care(prod_obj, allowed_care_values=allowed_care)

    # Brand Color (Col AT)
    bc_input = json_data.get("brand_color") or design.existing_values.get("AT") or color_input
    brand_color_val = str(bc_input).strip()
    if len(brand_color_val) > 128:
        brand_color_val = brand_color_val[:128].strip()
        warnings.append(
            ValidationIssue(
                level="WARNING",
                field="brand_color",
                message="Brand Color was truncated to 128 characters.",
            )
        )

    # Detail Placement (Col BD) rule:
    # default ["S"], or "all", or list of sizes
    dp_val = json_data.get("detail_placement") or design.existing_values.get("BD") or defaults.get("detail_placement", "Front Panel")
    dp_rows = json_data.get("detail_placement_rows", ["S"])

    # Stylings and details from JSON or existing stub
    surface_styling_val = (
        json_data.get("surface_styling")
        or design.existing_values.get("BJ")
        or ("Typography" if "typography" in desc_val.lower() else "None")
    )
    print_coverage_val = json_data.get("print_coverage") or design.existing_values.get("BE") or defaults.get("print_coverage", "Chest")
    tee_length_val = json_data.get("tee_length") or design.existing_values.get("BF") or defaults.get("tee_length", "Medium")
    sleeve_details_val = json_data.get("sleeve_details") or design.existing_values.get("BK") or defaults.get("sleeve_details", "No Details")

    # If errors found, return status invalid
    if errors:
        return BuildResult(
            design_id=design.id,
            status="invalid",
            rows=[],
            errors=errors,
            warnings=warnings,
        )

    # 7. Construct RowRecords
    rows: List[RowRecord] = []
    handling = defaults.get("handling_fees", {})
    pkg = defaults.get("package_cm", {})
    hsn_mode = defaults.get("hsn_mode", "sku")

    mrp_val = float(
        json_data.get("mrp")
        if json_data.get("mrp") is not None
        else design.existing_values.get("K", defaults.get("mrp", 1999))
    )
    sp_val = float(
        json_data.get("selling_price")
        if json_data.get("selling_price") is not None
        else design.existing_values.get("L", defaults.get("selling_price", 749))
    )

    for size in sizes:
        sku = f"{sku_base}_{size}"
        hsn_val = sku if hsn_mode == "sku" else str(defaults.get("hsn_fixed", ""))

        # Detail Placement logic
        if dp_rows == "all" or (isinstance(dp_rows, list) and size in dp_rows):
            cur_dp = dp_val
        else:
            cur_dp = None

        cells: Dict[str, Any] = {
            "G": sku,
            "H": str(design.existing_values.get("H", defaults.get("group_id", "group 1"))),
            "J": str(design.existing_values.get("J", defaults.get("listing_status", "Active"))),
            "K": mrp_val,
            "L": sp_val,
            "M": str(design.existing_values.get("M", defaults.get("fulfilment_by", "Seller"))),
            "N": str(design.existing_values.get("N", defaults.get("procurement_type", "instock"))),
            "O": int(design.existing_values.get("O", defaults.get("procurement_sla_days", 2))),
            "P": int(design.existing_values.get("P", defaults.get("stock", 2000))),
            "Q": str(design.existing_values.get("Q", defaults.get("shipping_provider", "Flipkart"))),
            "R": float(design.existing_values.get("R", handling.get("local", 0))),
            "S": float(design.existing_values.get("S", handling.get("zonal", 0))),
            "T": float(design.existing_values.get("T", handling.get("national", 0))),
            "U": float(design.existing_values.get("U", pkg.get("length", 25))),
            "V": float(design.existing_values.get("V", pkg.get("breadth", 20))),
            "W": float(design.existing_values.get("W", pkg.get("height", 3))),
            "X": float(design.existing_values.get("X", defaults.get("weight_kg", 0.222))),
            "Y": hsn_val,
            "Z": float(design.existing_values.get("Z", defaults.get("luxury_cess", 0))),
            "AA": str(design.existing_values.get("AA", defaults.get("country_of_origin", "India"))),
            "AB": str(design.existing_values.get("AB", defaults.get("manufacturer", "fashion continental"))),
            "AE": str(design.existing_values.get("AE", defaults.get("tax_code", "GST_APPAREL"))),
            "AG": str(design.existing_values.get("AG", defaults.get("brand", "fashion continental"))),
            "AH": mapped_neck,
            "AI": mapped_pattern,
            "AJ": mapped_fabric,
            "AK": mapped_ideal,
            "AL": mapped_sleeve,
            "AM": mapped_occ,
            "AN": int(design.existing_values.get("AN", defaults.get("pack_of", 1))),
            "AO": mapped_fit,
            "AP": str(design.existing_values.get("AP", defaults.get("suitable_for", "Western Wear"))),
            "AQ": str(json_data.get("style_code") or design.existing_values.get("AQ") or ""),
            "AR": size,
            "AS": mapped_color,
            "AT": brand_color_val,
            "BE": str(print_coverage_val),
            "BF": str(tee_length_val),
            "BG": str(design.existing_values.get("BG", defaults.get("reversible", "No"))),
            "BH": fabric_care_str,
            "BJ": str(surface_styling_val),
            "BK": str(sleeve_details_val),
            "BM": desc_val,
            "BN": search_keywords_str,
            "BO": key_features_str,
        }

        if cur_dp:
            cells["BD"] = cur_dp

        if final_product_link:
            cells["D"] = final_product_link

        if final_palette_url:
            cells["BB"] = str(final_palette_url)

        if final_video_url:
            cells["BI"] = str(final_video_url)

        if final_supplier_image:
            cells["BP"] = str(final_supplier_image)

        for img_idx, col in enumerate(IMAGE_COLS):
            if img_idx < len(final_images) and final_images[img_idx]:
                cells[col] = final_images[img_idx]

        rows.append(RowRecord(size=size, sku=sku, cells=cells))

    # Add candidate SKUs to existing session SKUs
    for r in rows:
        existing_skus_in_session.add(r.sku)

    return BuildResult(
        design_id=design.id,
        status="ready",
        rows=rows,
        errors=[],
        warnings=warnings,
    )
