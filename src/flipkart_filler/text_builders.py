"""Deterministic text builders for Description, Search Keywords,
Key Features, and Fabric Care. No LLM calls.
"""

import re
from typing import Dict, List, Optional, Tuple
from .models import ProductInput, ValidationIssue


def parse_key_features(features: List[str]) -> Dict[str, str]:
    """Parses list of 'Label: value' strings into a dictionary of {label: value}."""
    parsed: Dict[str, str] = {}
    for feat in features:
        if ":" in feat:
            label, val = feat.split(":", 1)
            parsed[label.strip().title()] = val.strip()
    return parsed


def build_description(
    product: ProductInput,
    mapped_values: Optional[Dict[str, str]] = None,
) -> Tuple[str, Optional[ValidationIssue]]:
    """Constructs the description for Column BM.
    Exact layout, blank lines as shown, '\n' line breaks.
    Max 10000 chars. Truncates at sentence boundary with warning if exceeded.
    """
    parsed = parse_key_features(product.key_features)

    # Allowed labels to include in Key Features block
    allowed_labels = ["Design", "Fit", "Neck", "Sleeve", "Fabric", "Style"]
    feature_lines = []
    for label in allowed_labels:
        if label in parsed and parsed[label]:
            feature_lines.append(parsed[label])

    # Determine occasion
    occasion = product.occasion
    if not occasion and "Occasion" in parsed:
        occasion = parsed["Occasion"]
    if not occasion:
        occasion = "Casual"

    # Style: {fit_type}
    fit_val = product.fit_type
    color_val = product.color
    pattern_val = product.pattern
    neck_val = product.neck_type
    sleeve_val = product.sleeve_type

    sections = [
        product.product_title.strip(),
        "",
        product.product_description.strip(),
        "",
        "Key Features:",
        "",
        "\n".join(feature_lines),
        "",
        f"Style: {fit_val}",
        f"Color: {color_val}",
        f"Pattern: {pattern_val}",
        f"Neck: {neck_val}",
        f"Sleeve: {sleeve_val}",
        f"Occasion: {occasion}",
        "Print Placement: Front Only",
    ]

    desc = "\n".join(sections)
    # Replace stray double spaces on each line
    desc = re.sub(r"[ \t]+", " ", desc)

    warning = None
    if len(desc) > 10000:
        # Truncate at sentence boundary
        truncated = desc[:9950]
        last_period = max(truncated.rfind("."), truncated.rfind("\n"))
        if last_period > 8000:
            desc = desc[: last_period + 1]
        else:
            desc = desc[:9997] + "..."
        warning = ValidationIssue(
            level="WARNING",
            field="Description",
            message=f"Description exceeded 10,000 characters and was truncated to {len(desc)} characters.",
        )

    return desc, warning


def build_search_keywords(product: ProductInput) -> str:
    """::-joined, 4-8 unique terms, each <= 40 chars, from:
    pattern, fit_type (+ " Fit"), style words from the "Style:" feature, "T-Shirt", occasion.
    Example: "Graphic Print::Oversized::Casual::Streetwear".
    """
    parsed = parse_key_features(product.key_features)
    terms: List[str] = []

    def add_term(term: str) -> None:
        t = " ".join(term.strip().split())
        if not t:
            return
        if len(t) > 40:
            t = t[:40].strip()
        # Case-insensitive deduplication
        if not any(t.lower() == existing.lower() for existing in terms):
            terms.append(t)

    # 1. Pattern
    if product.pattern:
        add_term(product.pattern)

    # 2. Fit type (+ " Fit" or standalone)
    if product.fit_type:
        add_term(product.fit_type)
        if "fit" not in product.fit_type.lower():
            add_term(f"{product.fit_type} Fit")

    # 3. Style words
    style_text = parsed.get("Style", "")
    if style_text:
        for word in re.split(r"[,/]", style_text):
            add_term(word)

    # 4. T-Shirt
    add_term("T-Shirt")

    # 5. Occasion words
    occ_text = product.occasion or parsed.get("Occasion", "")
    if occ_text:
        for word in re.split(r"[,/]", occ_text):
            add_term(word)

    # Ensure 4-8 terms
    if len(terms) > 8:
        terms = terms[:8]
    elif len(terms) < 4:
        # Pad with general apparel terms if needed
        for fallback in ["Casual Wear", "Graphic Tee", "Summer Wear", "Comfort Wear"]:
            if len(terms) >= 4:
                break
            add_term(fallback)

    return "::".join(terms[:8])


def build_key_features(product: ProductInput) -> str:
    """::-joined short phrases (<= 40 chars each, max 6):
    take the value after "Label:" of Design, Fit, Neck, Sleeve, Fabric, Style,
    shorten, dedupe. Do NOT include Care, Gender or Occasion.
    """
    parsed = parse_key_features(product.key_features)
    allowed_labels = ["Design", "Fit", "Neck", "Sleeve", "Fabric", "Style"]
    phrases: List[str] = []

    def clean_phrase(text: str) -> str:
        s = " ".join(text.strip().split())
        if len(s) > 40:
            # Shorten to 40 chars at word boundary
            s = s[:40].rsplit(" ", 1)[0]
        return s

    for label in allowed_labels:
        if label in parsed and parsed[label]:
            phrase = clean_phrase(parsed[label])
            if phrase and not any(phrase.lower() == p.lower() for p in phrases):
                phrases.append(phrase)
                if len(phrases) >= 6:
                    break

    # If key_features was missing any of them, fallback to product direct attributes
    if len(phrases) < 4:
        for attr_val in [
            product.pattern,
            f"{product.fit_type} Fit" if "fit" not in product.fit_type.lower() else product.fit_type,
            product.neck_type,
            product.sleeve_type,
            product.material,
        ]:
            if attr_val:
                phrase = clean_phrase(attr_val)
                if phrase and not any(phrase.lower() == p.lower() for p in phrases):
                    phrases.append(phrase)
                    if len(phrases) >= 6:
                        break

    return "::".join(phrases[:6])


def map_fabric_care_to_allowed(
    care_input: Optional[str] = None,
    allowed_care_values: Optional[List[str]] = None,
    context_text: str = "",
) -> str:
    """Deterministically maps any raw fabric care input or text description to Flipkart's allowed canonical values.
    
    Guarantees:
    - Every returned segment (joined by '::') strictly belongs to allowed_care_values.
    - Zero invalid/free-form strings can ever pass to QC.
    - Defaults to 'Regular Machine Wash' if no other valid care instruction is found.
    """
    default_allowed = [
        "Cold water wash only",
        "Do not Iron on print/embroidery/embellishment",
        "Do not bleach",
        "Do not dry clean",
        "Do not iron",
        "Do not steam iron",
        "Do not tumble dry",
        "Do not wring",
        "Dry clean only",
        "Dry flat",
        "Dry in shade",
        "First wash dry clean thereafter handwash",
        "Gentle Machine Wash",
        "Hand wash",
        "Machine wash as per tag",
        "Regular Machine Wash",
        "Reverse and dry",
        "Reverse and iron",
        "Slight color may bleed in all washes",
        "Slight color may bleed in first wash",
        "Slight shrinkage would be expectedSlight shrinkage would be expected",
        "Wash Separately",
        "Wash with like colors",
    ]
    allowed = allowed_care_values or default_allowed
    canonical_map = {v.lower().strip(): v for v in allowed}

    selected_items: List[str] = []
    combined = ""

    if care_input and str(care_input).strip():
        raw_str = str(care_input).strip()
        # Direct check on exact match or parts split by ::, ,, ;, /
        parts = [p.strip() for p in re.split(r"::|,|;|/", raw_str) if p.strip()]
        for p in parts:
            if p.lower() in canonical_map:
                canon = canonical_map[p.lower()]
                if canon not in selected_items:
                    selected_items.append(canon)
        combined = (raw_str + " " + context_text).lower()
    else:
        combined = context_text.lower()

    # Rule-based semantic extraction from combined text for any missing categories
    # 1. Base wash type
    has_wash_type = any(
        w in selected_items
        for w in [
            "Cold water wash only",
            "Hand wash",
            "Gentle Machine Wash",
            "Dry clean only",
            "Machine wash as per tag",
            "Regular Machine Wash",
            "First wash dry clean thereafter handwash",
        ]
    )
    if not has_wash_type:
        if "cold" in combined:
            selected_items.insert(0, "Cold water wash only")
        elif "hand wash" in combined or "handwash" in combined:
            selected_items.insert(0, "Hand wash")
        elif "gentle" in combined:
            selected_items.insert(0, "Gentle Machine Wash")
        elif "dry clean only" in combined:
            selected_items.insert(0, "Dry clean only")
        elif "machine wash as per tag" in combined:
            selected_items.insert(0, "Machine wash as per tag")
        else:
            selected_items.insert(0, "Regular Machine Wash")

    # 2. Ironing instructions
    has_iron = any("iron" in w.lower() for w in selected_items)
    if not has_iron:
        if (
            re.search(r"(?:do\s+not|avoid|never|no)\s+iron.*?(?:print|embroid|embellish)", combined)
            or "iron on print" in combined
            or "iron over print" in combined
        ):
            selected_items.append("Do not Iron on print/embroidery/embellishment")
        elif "do not steam iron" in combined:
            selected_items.append("Do not steam iron")
        elif re.search(r"(?:do\s+not|no)\s+iron", combined):
            selected_items.append("Do not iron")
        elif "reverse and iron" in combined:
            selected_items.append("Reverse and iron")

    # 3. Drying & reverse
    if "Reverse and dry" not in selected_items and ("inside out" in combined or "reverse" in combined):
        selected_items.append("Reverse and dry")
    if "Dry flat" not in selected_items and "dry flat" in combined:
        selected_items.append("Dry flat")
    if "Dry in shade" not in selected_items and "dry in shade" in combined:
        selected_items.append("Dry in shade")
    if "Do not tumble dry" not in selected_items and ("do not tumble dry" in combined or "no tumble dry" in combined):
        selected_items.append("Do not tumble dry")
    if "Do not wring" not in selected_items and ("do not wring" in combined or "no wring" in combined):
        selected_items.append("Do not wring")

    # 4. Bleach & colors
    if "Do not bleach" not in selected_items and ("do not bleach" in combined or "no bleach" in combined):
        selected_items.append("Do not bleach")
    if "Wash with like colors" not in selected_items and ("like color" in combined or "similar color" in combined):
        selected_items.append("Wash with like colors")
    if "Wash Separately" not in selected_items and "separately" in combined:
        selected_items.append("Wash Separately")
    if "bleed" in combined:
        bleed_val = "Slight color may bleed in first wash" if "first wash" in combined else "Slight color may bleed in all washes"
        if bleed_val not in selected_items:
            selected_items.append(bleed_val)

    # STRICT CANONICAL MEMBERSHIP GUARD:
    # Under no circumstances may an unapproved string be output
    valid_items = [it for it in selected_items if it in allowed]
    if not valid_items:
        fallback = "Regular Machine Wash" if "Regular Machine Wash" in allowed else (allowed[0] if allowed else "")
        valid_items = [fallback] if fallback else []

    return "::".join(valid_items)


def build_fabric_care(
    product: ProductInput,
    allowed_care_values: Optional[List[str]] = None,
    raw_care_input: Optional[str] = None,
) -> str:
    """'Regular Machine Wash' by default. Maps all care instructions into canonical Flipkart values.
    Join with '::'. All returned values strictly match canonical values in allowed list.
    """
    care_input = raw_care_input or getattr(product, "fabric_care", None)

    # Gather care-related texts from description and key features
    parsed = parse_key_features(product.key_features)
    care_text = ""
    for k, v in parsed.items():
        if "care" in k.lower():
            care_text += " " + v
    care_text += " " + product.product_description

    return map_fabric_care_to_allowed(
        care_input=care_input,
        allowed_care_values=allowed_care_values,
        context_text=care_text,
    )
