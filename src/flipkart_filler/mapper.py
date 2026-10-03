"""Maps product JSON fields to Flipkart-compliant canonical values
using mappings.yaml, defaults.yaml, and live allowed lists.
"""

from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
import yaml

from .allowed_values import get_canonical_value, suggest_values
from .models import ValidationIssue


class ValueMapper:
    """Handles mapping and validation of product attributes against allowed lists."""

    def __init__(
        self,
        mappings_path: Union[str, Path],
        defaults_path: Union[str, Path],
        allowed_values: Dict[str, List[str]],
    ):
        with open(mappings_path, "r", encoding="utf-8") as f:
            self.mappings: Dict[str, Any] = yaml.safe_load(f) or {}

        with open(defaults_path, "r", encoding="utf-8") as f:
            self.defaults: Dict[str, Any] = yaml.safe_load(f) or {}

        self.allowed_values = allowed_values

    def map_attribute(
        self,
        category: str,
        value: str,
        allow_multi: bool = False,
    ) -> Tuple[Optional[str], Optional[ValidationIssue]]:
        """Maps an input attribute value to canonical Flipkart allowed value.
        If allow_multi=True, handles multi-values separated by '/' or '::' or ','.
        Returns (canonical_string, issue_or_none).
        """
        if not value or not str(value).strip():
            return None, ValidationIssue(
                level="ERROR",
                field=category,
                message=f"Missing required attribute '{category}'",
            )

        val_str = str(value).strip()

        # Handle multi-value if applicable
        if allow_multi and any(sep in val_str for sep in ["::", "/", ","]):
            raw_parts = [
                p.strip() for p in val_str.replace("::", "/").replace(",", "/").split("/") if p.strip()
            ]
            mapped_parts = []
            for part in raw_parts:
                part_canonical, issue = self._map_single(category, part)
                if issue:
                    return None, issue
                if part_canonical and part_canonical not in mapped_parts:
                    mapped_parts.append(part_canonical)
            return "::".join(mapped_parts), None

        return self._map_single(category, val_str)

    def _map_single(
        self,
        category: str,
        val: str,
    ) -> Tuple[Optional[str], Optional[ValidationIssue]]:
        raw = val.strip()
        lower_raw = raw.lower()

        # Check explicit mappings from config
        category_map = self.mappings.get(category.lower(), {})
        mapped = category_map.get(lower_raw)

        if mapped:
            # Handle placeholder like <ideal_for_unisex_default>
            if "<ideal_for_unisex_default>" in mapped:
                fallback = self.defaults.get("ideal_for_unisex_default", "Women")
                mapped = mapped.replace("<ideal_for_unisex_default>", fallback)
            candidate = mapped
        else:
            candidate = raw

        # Check against live allowed values from workbook
        canonical = get_canonical_value(category, candidate, self.allowed_values)
        if canonical:
            return canonical, None

        # Check directly with raw value in allowed list
        canonical = get_canonical_value(category, raw, self.allowed_values)
        if canonical:
            return canonical, None

        # If not found, compute suggestions
        suggestions = suggest_values(category, candidate, self.allowed_values, limit=3)
        issue = ValidationIssue(
            level="ERROR",
            field=category,
            message=(
                f"Value '{val}' for attribute '{category}' is not in allowed list. "
                f"Did you mean: {', '.join(suggestions) if suggestions else 'None'}?"
            ),
            suggestions=suggestions,
        )
        return None, issue
