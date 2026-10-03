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


def build_fabric_care(
    product: ProductInput,
    allowed_care_values: Optional[List[str]] = None,
) -> str:
    """'Regular Machine Wash' by default. Add:
    'wash with similar/like colors'       -> 'Wash with like colors'
    'avoid/do not iron over/on the print' -> 'Do not Iron on print/embroidery/embellishment'
    'inside out'                          -> 'Reverse and dry'
    'do not bleach'                       -> 'Do not bleach'
    Join with '::'. All added values must match canonical values in allowed list.
    """
    care_items: List[str] = ["Regular Machine Wash"]

    # Gather care-related texts
    parsed = parse_key_features(product.key_features)
    care_text = ""
    for k, v in parsed.items():
        if "care" in k.lower():
            care_text += " " + v
    care_text += " " + product.product_description
    care_lower = care_text.lower()

    mapping_rules = [
        (r"(?:similar|like)\s+colors", "Wash with like colors"),
        (
            r"(?:avoid|do\s+not)\s+iron.*?(?:print|design|embroidery)",
            "Do not Iron on print/embroidery/embellishment",
        ),
        (r"inside\s+out", "Reverse and dry"),
        (r"do\s+not\s+bleach", "Do not bleach"),
    ]

    for pattern, canonical in mapping_rules:
        if re.search(pattern, care_lower):
            if canonical not in care_items:
                care_items.append(canonical)

    # Filter/canonicalize against allowed values if provided
    if allowed_care_values:
        canonical_map = {v.lower(): v for v in allowed_care_values}
        final_items = []
        for item in care_items:
            if item.lower() in canonical_map:
                final_items.append(canonical_map[item.lower()])
            elif item in care_items[:1]:  # keep default if allowed
                final_items.append(item)
        if final_items:
            return "::".join(final_items)

    return "::".join(care_items)
