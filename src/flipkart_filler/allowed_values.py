"""Dynamic reader of allowed values from the workbook template.
Never hardcodes allowed values - inspects the Index sheet, data validations,
and dropdown sheets at runtime.
"""

from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Union
import openpyxl
from openpyxl.utils import get_column_letter
import rapidfuzz.process


_ALLOWED_CACHE: Dict[str, Dict[str, List[str]]] = {}


def load_allowed_values(template_path: Union[str, Path]) -> Dict[str, List[str]]:
    """Inspects the template workbook and builds a dictionary mapping
    attribute names and column letters to their canonical allowed string values.
    """
    key_str = str(template_path)
    if key_str in _ALLOWED_CACHE:
        return {k: list(v) for k, v in _ALLOWED_CACHE[key_str].items()}

    wb = openpyxl.load_workbook(template_path, data_only=True)
    allowed: Dict[str, List[str]] = {}

    def add_values(key: str, vals: List[str]) -> None:
        clean_vals = [str(v).strip() for v in vals if v is not None and str(v).strip()]
        if not clean_vals:
            return
        # Deduplicate while preserving order
        seen = set()
        deduped = []
        for v in clean_vals:
            if v not in seen:
                seen.add(v)
                deduped.append(v)
        allowed[key] = deduped
        allowed[key.lower()] = deduped
        # Standardize key aliases
        alias_map = {
            "type": ["neck", "neck type", "neck_type", "type (neck)", "ah"],
            "pattern": ["pattern", "ai"],
            "fabric": ["material", "fabric", "aj"],
            "ideal for": ["ideal_for", "ideal for", "ak"],
            "sleeve": ["sleeve_type", "sleeve", "al"],
            "occasion": ["occasion", "am"],
            "pack of": ["pack_of", "pack of", "an"],
            "fit": ["fit_type", "fit", "ao"],
            "suitable for": ["suitable_for", "suitable for", "ap"],
            "brand size": ["brand_size", "brand size", "size", "sizes", "ar"],
            "color": ["color", "as"],
            "sport type": ["sport_type", "sport type", "bc"],
            "detail placement": ["detail_placement", "detail placement", "bd"],
            "print coverage": ["print_coverage", "print coverage", "be"],
            "tee length": ["tee_length", "tee length", "bf"],
            "reversible": ["reversible", "bg"],
            "fabric care": ["fabric_care", "fabric care", "bh"],
            "surface styling": ["surface_styling", "surface styling", "bj"],
            "sleeve details": ["sleeve_details", "sleeve details", "bk"],
            "country of origin": ["country_of_origin", "country of origin", "aa"],
            "tax code": ["tax_code", "tax code", "ae"],
        }
        for std_key, aliases in alias_map.items():
            if key.lower() == std_key:
                for alias in aliases:
                    allowed[alias] = deduped

    # 1. Read Index sheet
    if "Index" in wb.sheetnames:
        idx = wb["Index"]
        # Columns D (4) to W (23)
        for col_idx in range(4, 25):
            h_r2 = idx.cell(row=2, column=col_idx).value
            h_r3 = idx.cell(row=3, column=col_idx).value

            # Special case for column F (Allowed Type -> Neck types)
            if col_idx == 6 and h_r3 and "Allowed Type" in str(h_r3):
                vals = []
                for r in range(4, 300):
                    v = idx.cell(row=r, column=col_idx).value
                    if v is None or str(v).strip() == "":
                        break
                    vals.append(str(v).strip())
                add_values("Type", vals)
                continue

            if h_r2:
                attr_name = str(h_r2).strip()
                vals = []
                for r in range(3, 500):
                    v = idx.cell(row=r, column=col_idx).value
                    if v is None or str(v).strip() == "":
                        break
                    vals.append(str(v).strip())
                add_values(attr_name, vals)

    # 2. Read DropDownValues sheets
    if "DropDownValuesForColumn26" in wb.sheetnames:
        ws26 = wb["DropDownValuesForColumn26"]
        vals = [
            ws26.cell(row=r, column=1).value
            for r in range(1, 400)
            if ws26.cell(row=r, column=1).value is not None
        ]
        add_values("Country of Origin", vals)

    if "DropDownValuesForColumn30" in wb.sheetnames:
        ws30 = wb["DropDownValuesForColumn30"]
        vals = [
            ws30.cell(row=r, column=1).value
            for r in range(1, 100)
            if ws30.cell(row=r, column=1).value is not None
        ]
        add_values("Tax Code", vals)

    # 3. Read data validations on t_shirt
    if "t_shirt" in wb.sheetnames:
        ws = wb["t_shirt"]
        if hasattr(ws, "data_validations"):
            for dv in ws.data_validations.dataValidation:
                if dv.type == "list" and dv.formula1:
                    formula = dv.formula1.strip('"').strip("'")
                    if "," in formula and not formula.startswith("="):
                        items = [x.strip() for x in formula.split(",") if x.strip()]
                        for sq in str(dv.sqref).split():
                            col_letter = "".join(filter(str.isalpha, sq.split(":")[0]))
                            if col_letter:
                                add_values(col_letter, items)

    wb.close()
    _ALLOWED_CACHE[key_str] = allowed
    return {k: list(v) for k, v in allowed.items()}


def read_existing_skus(workbook_path: Union[str, Path]) -> Set[str]:
    """Reads all existing Seller SKU IDs from column G (rows 5..500) of t_shirt."""
    wb = openpyxl.load_workbook(workbook_path, data_only=True, read_only=True)
    skus: Set[str] = set()
    try:
        if "t_shirt" not in wb.sheetnames:
            return skus

        ws = wb["t_shirt"]
        # Column G is column 7
        for row in range(5, 501):
            val = ws.cell(row=row, column=7).value
            if val is not None:
                s_val = str(val).strip()
                if s_val:
                    skus.add(s_val)
    finally:
        wb.close()
    return skus


def _normalize_base(s: Optional[str]) -> str:
    if not s:
        return ""
    import re
    return re.sub(r"[\s_\-]+", "", str(s).lower()).strip()


def read_source_sheet_stubs(source_sheet_path: Union[str, Path]) -> Dict[str, Dict[str, Any]]:
    """Reads design stub rows from an in-progress workbook (.xls, .xlsm, .xlsx)
    and returns a mapping from sku_base (and normalized variants) to column dictionaries
    containing AU..BA, BB, BI, BP, D.
    """
    path = Path(source_sheet_path)
    if not path.exists():
        return {}

    stubs: Dict[str, Dict[str, Any]] = {}
    ext = path.suffix.lower()

    cols_of_interest = {
        "D": 3,
        "G": 6,
        "AU": 46,
        "AV": 47,
        "AW": 48,
        "AX": 49,
        "AY": 50,
        "AZ": 51,
        "BA": 52,
        "BB": 53,
        "BI": 60,
        "BP": 67,
    }

    import re
    size_pattern = re.compile(r"^(.*)_(XXS|XS|S|M|L|XL|XXL|3XL|4XL|5XL|Free)$", re.IGNORECASE)

    def process_row_values(get_val_fn, max_rows):
        for r in range(4, max_rows):
            sku_val = get_val_fn(r, 6)
            if not sku_val:
                continue
            sku_str = str(sku_val).strip()
            if not sku_str:
                continue

            match = size_pattern.match(sku_str)
            base = match.group(1).strip() if match else sku_str

            if base in stubs:
                continue

            row_data = {"sku_base": base}
            for col_name, c_idx in cols_of_interest.items():
                if col_name == "G":
                    continue
                v = get_val_fn(r, c_idx)
                if v is not None and str(v) != "":
                    row_data[col_name] = str(v)

            stubs[base] = row_data
            norm = _normalize_base(base)
            if norm and norm not in stubs:
                stubs[norm] = row_data

    if ext == ".xls":
        import xlrd
        wb = xlrd.open_workbook(str(path))
        if "t_shirt" in wb.sheet_names():
            ws = wb.sheet_by_name("t_shirt")
            process_row_values(
                lambda r, c: ws.cell_value(r, c) if r < ws.nrows and c < ws.ncols else "",
                ws.nrows,
            )
    else:
        wb = openpyxl.load_workbook(str(path), data_only=True, read_only=True)
        if "t_shirt" in wb.sheetnames:
            ws = wb["t_shirt"]
            process_row_values(
                lambda r, c: ws.cell(row=r + 1, column=c + 1).value,
                501,
            )
        wb.close()

    return stubs


def find_stub_for_sku_base(
    stubs: Dict[str, Dict[str, Any]], sku_base: str
) -> Optional[Dict[str, Any]]:
    """Matches a SKU base to its stub row data: exact, then case-insensitive, then normalized."""
    if not sku_base:
        return None
    if sku_base in stubs:
        return stubs[sku_base]
    for k, v in stubs.items():
        if k.lower() == sku_base.lower():
            return v
    norm = _normalize_base(sku_base)
    if norm in stubs:
        return stubs[norm]
    for k, v in stubs.items():
        if _normalize_base(k) == norm:
            return v
    return None


def get_canonical_value(
    attribute_name: str,
    candidate: str,
    allowed_dict: Dict[str, List[str]],
) -> Optional[str]:
    """Matches a candidate string case-insensitively against the allowed list for an attribute.
    Returns the canonical casing if found, else None.
    """
    key = attribute_name.lower().strip()
    allowed_list = allowed_dict.get(key)
    if not allowed_list:
        return None

    target = candidate.lower().strip()
    for item in allowed_list:
        if item.lower().strip() == target:
            return item
    return None


def suggest_values(
    attribute_name: str,
    candidate: str,
    allowed_dict: Dict[str, List[str]],
    limit: int = 3,
) -> List[str]:
    """Uses rapidfuzz to generate top matching suggestions for an unknown value.
    Never auto-picks; returns suggestions with scores.
    """
    key = attribute_name.lower().strip()
    allowed_list = allowed_dict.get(key)
    if not allowed_list:
        return []

    results = rapidfuzz.process.extract(
        candidate,
        allowed_list,
        scorer=rapidfuzz.fuzz.token_sort_ratio,
        limit=limit,
    )
    return [match for match, score, _ in results]
