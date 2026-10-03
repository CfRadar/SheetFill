"""Tolerant JSON loading and repairing for Flipkart product payloads."""

import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Union

from .models import ProductInput


class JSONLoadError(Exception):
    """Raised when JSON parsing fails irreparably."""

    def __init__(self, message: str, line: int = 0, column: int = 0, file_path: str = ""):
        super().__init__(message)
        self.message = message
        self.line = line
        self.column = column
        self.file_path = file_path

    def __str__(self) -> str:
        loc = f" at line {self.line}, column {self.column}" if self.line > 0 else ""
        src = f" in {self.file_path}" if self.file_path else ""
        return f"JSON Error{src}{loc}: {self.message}"


def sanitize_json_text(text: str) -> str:
    """Repairs common formatting issues from chat pastes:
    1. Strips markdown code fences (```json ... ```).
    2. Extracts JSON block if surrounded by explanatory text.
    3. Replaces smart/curly quotes with standard ASCII quotes.
    4. Replaces broken escaped or unescaped parentheses in key_features like \\( ... \\) with [ ... ].
    5. Removes trailing commas before closing braces/brackets.
    """
    text = text.strip()

    # 1. Strip markdown fences like ```json ... ``` or ``` ... ```
    if text.startswith("```"):
        # Remove opening fence line
        text = re.sub(r"^```(?:json|JSON)?\s*", "", text)
        # Remove closing fence
        text = re.sub(r"\s*```$", "", text)
        text = text.strip()
    elif "```" in text:
        # Extract content between first pair of fences if present
        m = re.search(r"```(?:json|JSON)?\s*(.*?)\s*```", text, flags=re.DOTALL)
        if m:
            text = m.group(1).strip()

    # If text still contains non-JSON text at start/end, try to extract outer JSON object/array
    if not (text.startswith("{") or text.startswith("[")):
        first_brace = text.find("{")
        first_bracket = text.find("[")
        candidates = [idx for idx in [first_brace, first_bracket] if idx != -1]
        if candidates:
            start_pos = min(candidates)
            is_brace = (start_pos == first_brace)
            end_char = "}" if is_brace else "]"
            end_pos = text.rfind(end_char)
            if end_pos != -1 and end_pos > start_pos:
                text = text[start_pos : end_pos + 1].strip()

    # 2. Normalize smart quotes
    text = text.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")

    # 3. Repair array parentheses: any "key": \( ... \) or ( ... ) -> "key": [ ... ]
    # Handles key_features, detail_placement_rows, sizes, or any array formatted with parentheses
    text = re.sub(
        r'("[a-zA-Z0-9_]+"\s*:\s*)\\?\(\s*(.*?)\s*\\?\)(?=\s*[,}\]])',
        r"\1[\2]",
        text,
        flags=re.DOTALL,
    )
    text = re.sub(
        r'("key_features"\s*:\s*)\\?\(\s*(.*?)\s*\\?\)',
        r"\1[\2]",
        text,
        flags=re.DOTALL,
    )

    # 4. Remove trailing commas before } or ]
    text = re.sub(r",\s*([}\]])", r"\1", text)

    return text


def clean_string_values(obj: Any, is_description: bool = False) -> Any:
    """Recursively clean strings:
    - Strips leading/trailing whitespace.
    - Normalizes runs of spaces.
    - Preserves newlines inside product_description.
    """
    if isinstance(obj, str):
        s = obj.strip()
        if is_description:
            # Normalize horizontal spaces but keep newlines
            lines = [re.sub(r"[ \t]+", " ", line).strip() for line in s.splitlines()]
            return "\n".join(lines)
        else:
            return " ".join(s.split())
    elif isinstance(obj, dict):
        return {
            k: clean_string_values(
                v,
                is_description=(k in ["product_description", "description_override", "description", "BM"]),
            )
            for k, v in obj.items()
        }
    elif isinstance(obj, list):
        return [clean_string_values(item, is_description=is_description) for item in obj]
    return obj


def parse_single_json_content(content: str, file_path: str = "") -> List[Dict[str, Any]]:
    """Sanitize and parse JSON content into a list of raw dicts."""
    # First attempt direct parse without alteration
    try:
        data = json.loads(content)
        if isinstance(data, dict):
            return [clean_string_values(data)]
        elif isinstance(data, list):
            return [clean_string_values(item) for item in data]
    except Exception:
        pass

    repaired = sanitize_json_text(content)
    try:
        data = json.loads(repaired)
    except json.JSONDecodeError as err:
        raise JSONLoadError(
            message=err.msg,
            line=err.lineno,
            column=err.colno,
            file_path=file_path,
        ) from err

    if isinstance(data, dict):
        cleaned = clean_string_values(data)
        return [cleaned]
    elif isinstance(data, list):
        return [clean_string_values(item) for item in data]
    else:
        raise JSONLoadError(
            message=f"Root JSON must be an object or array, got {type(data).__name__}",
            file_path=file_path,
        )


def tolerant_json_loads(content: str) -> Union[Dict[str, Any], List[Any]]:
    """Tolerantly parses JSON content with auto-sanitization."""
    items = parse_single_json_content(content)
    if len(items) == 1 and not content.strip().startswith("["):
        return items[0]
    return items


def load_products_from_path(path: Union[str, Path]) -> List[ProductInput]:
    """Loads and validates ProductInput models from a file or folder.
    Supports single JSON, list of JSONs, or a directory of .json files.
    Handles UTF-8 with BOM automatically via utf-8-sig.
    """
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Input path does not exist: {path}")

    raw_items: List[Dict[str, Any]] = []

    if p.is_dir():
        json_files = sorted(p.glob("*.json"))
        if not json_files:
            raise ValueError(f"No .json files found in directory: {path}")
        for jf in json_files:
            content = jf.read_text(encoding="utf-8-sig")
            raw_items.extend(parse_single_json_content(content, file_path=str(jf)))
    else:
        content = p.read_text(encoding="utf-8-sig")
        raw_items.extend(parse_single_json_content(content, file_path=str(p)))

    products: List[ProductInput] = []
    for idx, item in enumerate(raw_items, start=1):
        try:
            products.append(ProductInput.model_validate(item))
        except Exception as e:
            raise ValueError(f"Validation failed for product #{idx}: {e}") from e

    return products
