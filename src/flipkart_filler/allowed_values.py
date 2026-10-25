"""Dynamic reader of allowed values from the workbook template.
Never hardcodes allowed values - inspects the Index sheet, data validations,
and dropdown sheets at runtime.
"""

from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Union
import zipfile
import openpyxl
from openpyxl.utils import get_column_letter
import rapidfuzz.process
import xlrd


_ALLOWED_CACHE: Dict[str, Dict[str, List[str]]] = {}


def load_allowed_values(template_path: Union[str, Path]) -> Dict[str, List[str]]:
    """Inspects the template workbook and builds a dictionary mapping
    attribute names and column letters to their canonical allowed string values.
    """
    key_str = str(template_path)
    if key_str in _ALLOWED_CACHE:
        return {k: list(v) for k, v in _ALLOWED_CACHE[key_str].items()}

    t_path = Path(template_path)
    is_xls = t_path.suffix.lower() == ".xls" and not zipfile.is_zipfile(str(t_path))
    if not is_xls and t_path.suffix.lower() == ".xls":
        cand = t_path.with_suffix(".xlsm")
        if cand.exists():
            template_path = cand
        else:
            base_dir = Path(__file__).resolve().parent.parent.parent
            xlsm_cand = base_dir / "templates" / "Flipkart_TShirt_Template.xlsm"
            if xlsm_cand.exists():
                template_path = xlsm_cand

    allowed: Dict[str, List[str]] = {}
    is_sweatshirt = "sweat" in str(t_path).lower()

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
        if is_sweatshirt:
            alias_map = {
                "type": ["neck", "neck type", "neck_type", "type (neck)", "aq"],
                "neck": ["neck", "neck type", "neck_type", "type", "type (neck)", "aq"],
                "pattern": ["pattern", "aj"],
                "fabric": ["material", "fabric", "ai"],
                "ideal for": ["ideal_for", "ideal for", "am"],
                "sleeve": ["sleeve_type", "sleeve", "al"],
                "occasion": ["occasion", "bj"],
                "pack of": ["pack_of", "pack of", "ah"],
                "fit": ["fit_type", "fit"],
                "suitable for": ["suitable_for", "suitable for", "ar"],
                "brand size": ["brand_size", "brand size", "size", "sizes", "as"],
                "color": ["color", "av"],
                "sport type": ["sport_type", "sport type", "bq"],
                "detail placement": ["detail_placement", "detail placement", "bg"],
                "reversible": ["reversible", "ak"],
                "fabric care": ["fabric_care", "fabric care", "an"],
                "surface styling": ["surface_styling", "surface styling", "br"],
                "sleeve details": ["sleeve_details", "sleeve details", "bs"],
                "country of origin": ["country_of_origin", "country of origin", "aa"],
                "tax code": ["tax_code", "tax code", "ae"],
                "closure": ["closure", "ap"],
                "hooded": ["hooded", "ao"],
                "character": ["character", "bd"],
                "winter type": ["winter_type", "winter type", "bt"],
            }
        else:
            alias_map = {
                "type": ["neck", "neck type", "neck_type", "type (neck)", "ah"],
                "neck": ["neck", "neck type", "neck_type", "type", "type (neck)", "ah"],
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

    if is_xls:
        wb_xls = xlrd.open_workbook(str(t_path), formatting_info=False)
        if "Index" in wb_xls.sheet_names():
            idx_sh = wb_xls.sheet_by_name("Index")
            for c in range(idx_sh.ncols):
                h_r1 = str(idx_sh.cell_value(1, c)).strip()
                h_r2 = str(idx_sh.cell_value(2, c)).strip() if idx_sh.nrows > 2 else ""

                # Special case for column 5 (F) in T-Shirt template (Allowed Type -> Neck types)
                if c == 5 and "Allowed Type" in h_r2:
                    vals = [
                        str(idx_sh.cell_value(r, c)).strip()
                        for r in range(3, idx_sh.nrows)
                        if str(idx_sh.cell_value(r, c)).strip()
                    ]
                    add_values("Type", vals)
                    continue

                # Special case for column 13 in Sweatshirt template (Allowed Brand Size)
                if c == 13 and "Allowed Brand Size" in h_r2:
                    vals = [
                        str(idx_sh.cell_value(r, c)).strip()
                        for r in range(3, idx_sh.nrows)
                        if str(idx_sh.cell_value(r, c)).strip()
                    ]
                    add_values("Brand Size", vals)
                    continue

                # Skip column 3 in T-shirt if it's the Refiner_fit column masquerading as Type
                if c == 3 and not is_sweatshirt:
                    continue

                if not h_r1:
                    continue
                vals = [
                    str(idx_sh.cell_value(r, c)).strip()
                    for r in range(2, idx_sh.nrows)
                    if str(idx_sh.cell_value(r, c)).strip()
                ]
                add_values(h_r1, vals)

        if "DropDownValuesForColumn26" in wb_xls.sheet_names():
            sh26 = wb_xls.sheet_by_name("DropDownValuesForColumn26")
            vals = [str(sh26.cell_value(r, 0)).strip() for r in range(sh26.nrows) if str(sh26.cell_value(r, 0)).strip()]
            add_values("Country of Origin", vals)

        if "DropDownValuesForColumn30" in wb_xls.sheet_names():
            sh30 = wb_xls.sheet_by_name("DropDownValuesForColumn30")
            vals = [str(sh30.cell_value(r, 0)).strip() for r in range(sh30.nrows) if str(sh30.cell_value(r, 0)).strip()]
            add_values("Tax Code", vals)

        add_values("Hooded", ["Yes", "No"])
    else:
        wb = openpyxl.load_workbook(template_path, data_only=True)

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

        # 3. Read data validations on product sheets
        for sheet_cand in ("t_shirt", "sweatshirt"):
            if sheet_cand in wb.sheetnames:
                ws = wb[sheet_cand]
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
    """Reads all existing Seller SKU IDs from column G (rows 5..500) of product sheet."""
    import zipfile
    import xlrd

    w_path = Path(workbook_path)
    skus: Set[str] = set()

    if w_path.suffix.lower() == ".xls" and not zipfile.is_zipfile(w_path):
        wb = xlrd.open_workbook(str(w_path), formatting_info=False)
        sheet_name = next((s for s in wb.sheet_names() if s.lower() in ("t_shirt", "sweatshirt")), None)
        if not sheet_name:
            return skus
        sh = wb.sheet_by_name(sheet_name)
        for row in range(4, min(500, sh.nrows)):
            val = sh.cell_value(row, 6)
            if val is not None:
                s_val = str(val).strip()
                if s_val:
                    skus.add(s_val)
        return skus

    f_target = open(workbook_path, "rb") if str(workbook_path).lower().endswith(".xls") else workbook_path
    try:
        wb = openpyxl.load_workbook(f_target, data_only=True, read_only=False)
        try:
            sheet_name = next((s for s in wb.sheetnames if s.lower() in ("t_shirt", "sweatshirt")), None)
            if not sheet_name:
                return skus

            ws = wb[sheet_name]
            # Column G is column 7
            for row in range(5, 501):
                val = ws.cell(row=row, column=7).value
                if val is not None:
                    s_val = str(val).strip()
                    if s_val:
                        skus.add(s_val)
        finally:
            wb.close()
    finally:
        if hasattr(f_target, "close"):
            f_target.close()
    return skus


def _normalize_base(s: Optional[str]) -> str:
    if not s:
        return ""
    import re
    return re.sub(r"[\s_\-]+", "", str(s).lower()).strip()


def read_source_sheet_stubs(source_sheet_path: Union[str, Path]) -> Dict[str, Dict[str, Any]]:
    """Reads design stub rows from an in-progress workbook (.xls, .xlsm, .xlsx)
    and returns a mapping from sku_base (and normalized variants) to column dictionaries.
    """
    path = Path(source_sheet_path)
    if not path.exists():
        return {}

    stubs: Dict[str, Dict[str, Any]] = {}
    ext = path.suffix.lower()

    tshirt_cols = {
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

    sweat_cols = {
        "D": 3,
        "G": 6,
        "AX": 49,
        "AY": 50,
        "AZ": 51,
        "BA": 52,
        "BB": 53,
        "BC": 54,
        "BM": 64,
        "CA": 78,
    }

    import re
    size_pattern = re.compile(r"^(.*)_(XXS|XS|S|M|L|XL|XXL|3XL|4XL|5XL|Free)$", re.IGNORECASE)

    def process_row_values(get_val_fn, max_rows, cols_map):
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
            for col_name, c_idx in cols_map.items():
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
        s_name = next((s for s in wb.sheet_names() if s.lower() in ("t_shirt", "sweatshirt")), None)
        if s_name:
            ws = wb.sheet_by_name(s_name)
            cols = sweat_cols if "sweat" in s_name.lower() else tshirt_cols
            process_row_values(
                lambda r, c: ws.cell_value(r, c) if r < ws.nrows and c < ws.ncols else "",
                ws.nrows,
                cols,
            )
    else:
        wb = openpyxl.load_workbook(str(path), data_only=True, read_only=True)
        s_name = next((s for s in wb.sheetnames if s.lower() in ("t_shirt", "sweatshirt")), None)
        if s_name:
            ws = wb[s_name]
            cols = sweat_cols if "sweat" in s_name.lower() else tshirt_cols
            process_row_values(
                lambda r, c: ws.cell(row=r + 1, column=c + 1).value,
                501,
                cols,
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
