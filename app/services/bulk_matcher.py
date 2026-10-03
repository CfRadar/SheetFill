"""Bulk matcher service to match pasted batch JSON objects to detected designs."""

import json
import re
from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel, Field
from rapidfuzz import fuzz

from app.services.design_detector import DetectedDesign
from flipkart_filler.json_loader import tolerant_json_loads


class MatchAssignment(BaseModel):
    """Represents a matched JSON object to a design slot."""

    design_id: str
    json_index: int
    how: str  # "exact" | "normalized" | "suffix" | "fuzzy" | "order"
    parsed_json: Dict[str, Any]
    design_base: Optional[str] = None
    json_base: Optional[str] = None
    confidence: float = 1.0
    requires_confirmation: bool = False


class BulkMatchResult(BaseModel):
    """Result of the bulk matching process."""

    assigned: List[MatchAssignment] = Field(default_factory=list)
    unmatched_json: List[Dict[str, Any]] = Field(default_factory=list)
    unmatched_designs: List[str] = Field(default_factory=list)


def _normalize_name(s: Optional[str]) -> str:
    """Lowercase, trim, collapse spaces/underscores/hyphens."""
    if not s:
        return ""
    norm = re.sub(r"[\s_\-]+", " ", str(s).lower()).strip()
    return norm


def _strip_os_suffix(s: Optional[str]) -> str:
    """Strips trailing '_os' or ' os' from a string."""
    if not s:
        return ""
    return re.sub(r"[_ ]os$", "", str(s).strip(), flags=re.IGNORECASE).strip()


def parse_batch_json(raw_text: str) -> List[Dict[str, Any]]:
    """Tolerantly parses a batch of JSONs: array or multiple concatenated objects."""
    text = raw_text.strip()
    if not text:
        return []

    # First attempt: parse directly via tolerant_json_loads
    try:
        data = tolerant_json_loads(text)
        if isinstance(data, list):
            return [item for item in data if isinstance(item, dict)]
        if isinstance(data, dict):
            return [data]
    except Exception:
        pass

    # If top-level array parsing fails or string contains multiple concatenated objects
    # Try regex splitting on }{ or parsing chunks
    items: List[Dict[str, Any]] = []
    
    # Try to find all JSON object blocks { ... }
    # Using stack-based curly braces scanner
    start_idx = None
    depth = 0
    in_string = False
    escape = False

    for i, ch in enumerate(text):
        if escape:
            escape = False
            continue
        if ch == "\\":
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if not in_string:
            if ch == "{":
                if depth == 0:
                    start_idx = i
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0 and start_idx is not None:
                    obj_str = text[start_idx : i + 1]
                    try:
                        parsed = tolerant_json_loads(obj_str)
                        if isinstance(parsed, dict):
                            items.append(parsed)
                    except Exception:
                        pass
                    start_idx = None

    if items:
        return items

    # Fallback to single tolerant load attempt to raise exact error
    parsed = tolerant_json_loads(text)
    if isinstance(parsed, list):
        return [item for item in parsed if isinstance(item, dict)]
    if isinstance(parsed, dict):
        return [parsed]
    return []


def match_bulk_json(
    raw_text: str,
    designs: List[DetectedDesign],
) -> BulkMatchResult:
    """Matches parsed JSON objects to designs following Section 7 rules."""
    json_objects = parse_batch_json(raw_text)
    if not json_objects:
        return BulkMatchResult(
            assigned=[],
            unmatched_json=[],
            unmatched_designs=[d.id for d in designs],
        )

    available_designs = {d.id: d for d in designs}
    matched_json_indices = set()
    assignments: List[MatchAssignment] = []

    # Step B: 4-stage matching per JSON object
    for j_idx, jobj in enumerate(json_objects):
        sku_base = jobj.get("sku_base")
        style_code = jobj.get("style_code")
        title = jobj.get("product_title")

        best_match_id: Optional[str] = None
        match_how: Optional[str] = None
        confidence: float = 1.0

        # Stage 1: Exact sku_base == design.base
        if sku_base:
            for did, d in available_designs.items():
                if d.base and d.base == sku_base:
                    best_match_id = did
                    match_how = "exact"
                    break

        # Stage 2: Normalized equality
        if not best_match_id and (sku_base or style_code):
            norm_sku = _normalize_name(sku_base)
            norm_style = _normalize_name(style_code)
            for did, d in available_designs.items():
                if d.base:
                    norm_base = _normalize_name(d.base)
                    if (norm_sku and norm_base == norm_sku) or (norm_style and norm_base == norm_style):
                        best_match_id = did
                        match_how = "normalized"
                        break

        # Stage 3: design.base without trailing "_os" equals normalized sku_base or style_code
        if not best_match_id and (sku_base or style_code):
            norm_sku = _normalize_name(sku_base)
            norm_style = _normalize_name(style_code)
            for did, d in available_designs.items():
                if d.base:
                    base_stripped = _normalize_name(_strip_os_suffix(d.base))
                    sku_stripped = _normalize_name(_strip_os_suffix(sku_base)) if sku_base else ""
                    if (sku_stripped and base_stripped == sku_stripped) or (norm_style and base_stripped == norm_style):
                        best_match_id = did
                        match_how = "suffix"
                        break

        # Stage 4: Rapidfuzz ratio >= 92 between normalized names, only if unique
        if not best_match_id and sku_base:
            norm_sku = _normalize_name(sku_base)
            scores: List[Tuple[str, float]] = []
            for did, d in available_designs.items():
                if d.base:
                    norm_base = _normalize_name(d.base)
                    score = fuzz.ratio(norm_sku, norm_base)
                    if score >= 92:
                        scores.append((did, score))
            if len(scores) == 1:
                best_match_id = scores[0][0]
                match_how = "fuzzy"
                confidence = round(scores[0][1] / 100.0, 2)

        # Stage 4.5: Match against product_title if sku_base is absent
        if not best_match_id and title:
            norm_title = _normalize_name(title)
            for did, d in available_designs.items():
                if d.base:
                    base_stripped = _normalize_name(_strip_os_suffix(d.base))
                    if base_stripped and (base_stripped in norm_title or norm_title in base_stripped):
                        best_match_id = did
                        match_how = "title"
                        confidence = 0.95
                        break

        if best_match_id and match_how:
            d = available_designs.pop(best_match_id)
            matched_json_indices.add(j_idx)
            assignments.append(
                MatchAssignment(
                    design_id=d.id,
                    json_index=j_idx,
                    how=match_how,
                    parsed_json=jobj,
                    design_base=d.base,
                    json_base=sku_base,
                    confidence=confidence,
                    requires_confirmation=(match_how == "fuzzy"),
                )
            )

    # Step C: Leftovers - pairing by order if counts match
    unmatched_json_list = [
        {"json_index": i, "parsed_json": obj}
        for i, obj in enumerate(json_objects)
        if i not in matched_json_indices
    ]
    unmatched_design_ids = list(available_designs.keys())

    if unmatched_json_list and len(unmatched_json_list) == len(unmatched_design_ids):
        # Propose pairing by sheet order
        for item, did in zip(unmatched_json_list, unmatched_design_ids):
            d = available_designs[did]
            assignments.append(
                MatchAssignment(
                    design_id=did,
                    json_index=item["json_index"],
                    how="order",
                    parsed_json=item["parsed_json"],
                    design_base=d.base,
                    json_base=item["parsed_json"].get("sku_base"),
                    confidence=0.5,
                    requires_confirmation=True,
                )
            )
        unmatched_json_list = []
        unmatched_design_ids = []

    return BulkMatchResult(
        assigned=assignments,
        unmatched_json=unmatched_json_list,
        unmatched_designs=unmatched_design_ids,
    )
