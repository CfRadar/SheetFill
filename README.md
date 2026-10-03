# Flipkart T-Shirt Listing Automation (`flipkart-tshirt-filler`)

A production-grade Python automation tool and local web application that populates the `t_shirt` worksheet of Flipkart listing workbooks (`.xlsm`) from product JSON payloads with **zero corruption** of binary macros, form controls, drawings, or validations.

---

## 1. Quickstart

### One-Click Startup
- **Windows:** Double-click or run `run.bat`
- **macOS / Linux:** Run `./run.sh`

The startup script will automatically:
1. Create a Python virtual environment (`.venv`) if not present.
2. Install all required dependencies (`requirements.txt`).
3. Compile the frontend production bundle (`frontend/dist/`) if missing.
4. Launch the local FastAPI server at `http://127.0.0.1:8000` and automatically open your default browser.

---

## 2. Web Application Workflow

The web app allows you to upload partially-filled or draft listing sheets, correlates designs with product JSONs, and generates complete `.xlsm` workbooks ready for the Flipkart Seller Portal.

### AI Vision Prompt (Top-Right Navbar)
- In the top-right corner of the interface, click the **Prompt** button to immediately copy the exact AI vision model prompt to your clipboard (with instant `Copied!` feedback).
- Click the dropdown arrow (`▼`) next to it to open a scrollable viewer to inspect the prompt rules, required allowed values, and output schema.
- Pass this prompt along with 6 photos of your T-shirt to ChatGPT, Claude, or Gemini to obtain the exact JSON.

### Step 1: Upload Sheet
- Upload draft `.xls`, `.xlsm`, or `.xlsx` files (up to 25 MB).
- The backend inspects row 1 headers against the Flipkart master template and extracts rows 5..500.

### Step 2: Design Detection & Management
- **Stubs vs. Expanded Sets:**
  - One-row stubs (e.g. `tintin_os`) where image URLs exist but product details are missing are detected as `"needs_json"`.
  - Finished 4-row sets (`tintin_os_S` .. `tintin_os_XL`) are detected as `"complete"`.
- **Card-Per-Design:**
  - **Image Links Editor:** View the 7 Flipkart image URLs (`AU`..`BA`) and product link (`D`) copied directly from your sheet stub. Read-only for sheet-derived designs with an "Unlock to edit" toggle; editable for manual slots. These links are identical across all size rows of the design.
  - **Size Selector:** Tick/untick allowed Brand Sizes (`S`, `M`, `L`, `XL`, etc.) to dynamically create N rows.
  - **Live JSON Editor:** Monospace textarea with debounced 500ms validation, formatting, and 1-click fuzzy suggestion acceptance.
  - **Row Preview Table:** Shows exact cells to be written with highlighted per-size fields.

### Step 3: Multi-Design Bulk Matcher
- Click **"Paste all JSON"** to paste a batch JSON array or concatenated objects.
- Multi-tier matching algorithm:
  1. Exact `sku_base == design.base`
  2. Normalized alphanumeric equality
  3. Suffix-stripped `_os` matching against `sku_base` or `style_code`
  4. RapidFuzz ratio $\ge 92$
  5. Leftover pairing by order (requires confirmation)

### Step 4: Zero-Corruption Rebuild & Download
- Rebuilds sequentially into the clean master template `templates/Flipkart_TShirt_Template.xlsm`.
- All 33 non-sheet zip archive members (`xl/vbaProject.bin`, `ctrlProps/ctrlProp1.xml`, `vmlDrawing1.vml`, etc.) remain 100% byte-identical.
- Download the generated `.xlsm` file directly from the report panel.

---

## 3. The Zero-Corruption Architecture

```
                    +-------------------------------------------------+
                    |        Frontend (React 18 + Vite + TS)          |
                    |  - UploadStep        - SummaryBar               |
                    |  - DesignCard        - ImageLinksEditor         |
                    |  - JsonEditor        - BulkPasteDialog          |
                    |  - RowsPreview       - ReportPanel              |
                    +------------------------+------------------------+
                                             | HTTP /api (Port 8000)
                                             v
                    +-------------------------------------------------+
                    |              FastAPI Application                |
                    |  - /api/sheets/*     - Static Mount (dist/)     |
                    +------------------------+------------------------+
                                             |
         +-----------------------------------+-----------------------------------+
         |                                   |                                   |
         v                                   v                                   v
+------------------+                +------------------+                +------------------+
| Services Layer   |                | Workspace Store  |                | Core Filler      |
| - sheet_reader   |                | - sessions/<sid>/|                |   (Reused)       |
| - design_detector|                |   - original     |                | - json_loader    |
| - bulk_matcher   |                |   - designs.json |                | - allowed_values |
| - builder        |                |   - jsons/<did>  |                | - mapper         |
| - writer         |                |   - output.xlsm  |                | - text_builders  |
+------------------+                +------------------+                | - xlsx_patch     |
                                                                        | - validator      |
                                                                        +------------------+
```

### Why Standard Libraries Fail:
Standard tools like `pandas`, `openpyxl` (write mode), or `xlsxwriter` rewrite the workbook package from scratch, stripping binary VBA macros (`vbaProject.bin`), dropping ActiveX control bindings (`ctrlProps/`), and breaking drawings.

### Our Surgical Approach:
1. **Master Template as Source of Truth:** Generation always starts from `templates/Flipkart_TShirt_Template.xlsm`.
2. **Read-Only Data Extraction:** Input sheets (`.xls` via `xlrd`, `.xlsm` via read-only `openpyxl`) are only used as data sources.
3. **In-Memory XML Patching (`lxml`):** Clears target cells in rows 5..500 and patches only the `t_shirt` worksheet XML. All strings are written as `inlineStr` (`<is><t>...</t></is>`), leaving `xl/sharedStrings.xml` 100% untouched.
4. **Preserved Styles & Controls:** Retains existing cell style indices (`s="..."`), data validations, and drawing relationships.

---

## 4. Detection Logic Rules

Data rows are inspected in rows 5..500 of sheet `t_shirt`:
- **`EMPTY_ROW`:** No non-empty cells in columns G..BP (ignoring C, A/B/D/E/F/I).
- **`SIZE_ROW`:** Column G matches regex `^(.*)_(XXS|XS|S|M|L|XL|XXL|3XL|4XL|5XL|Free)$`.
- **`STUB_ROW`:** Column G is non-empty and not a `SIZE_ROW`.
- **`ORPHAN_ROW`:** Column G is empty, but other data cells exist in G..BP.

**Design Grouping:**
- Consecutive `SIZE_ROW`s sharing the same base form an **expanded design** (status `"complete"` if K, L, BM are filled; otherwise `"partial"`).
- Each `STUB_ROW` forms a single-row design with status `"needs_json"`.
- Capacity is 496 rows = 124 designs of 4 sizes.

---

## 5. Value Precedence & Same-Across-Sizes Rule

Every design expands to its size rows (`len(sizes)`).

### Same-Across-Sizes Rule:
- **Design-Level Columns (Identical across all rows of a design):**
  `D`, `H`, `J`, `K`, `L`, `M`, `N`, `O`, `P`, `Q`, `R`, `S`, `T`, `U`, `V`, `W`, `X`, `Z`, `AA`, `AB`, `AE`, `AG`, `AH`, `AI`, `AJ`, `AK`, `AL`, `AM`, `AN`, `AO`, `AP`, `AQ`, `AS`, `AT`, `AU..BA` (7 image URLs), `BB`, `BC`, `BE`, `BF`, `BG`, `BH`, `BI`, `BJ`, `BK`, `BL`, `BM`, `BN`, `BO`, `BP`.
- **Per-Size Columns (The only fields that differ):**
  - `G`: Seller SKU ID = `{sku_base}_{size}`
  - `AR`: Brand Size = `{size}`
  - `Y`: HSN (set to row SKU when `hsn_mode: "sku"`)
- **Special Column `BD` (Detail Placement):**
  Written only on the sizes configured in `detail_placement_rows` (default `["S"]` to match the master template; use `"all"` for all rows).

### Value Precedence (Highest to Lowest):
- **Image URLs & Links (`AU`..`BA`, `BB`, `BI`, `BP`, `D`):**
  1. Manual UI edit (only if unlocked or manual slot)
  2. Uploaded sheet stub value (exact text from stub row)
  3. Blank (JSON is NOT a source; any `images` key in JSON is ignored with a warning)
- **Product Details & Attributes:**
  1. JSON override keys (`description_override`, `search_keywords`, etc.)
  2. JSON mapped fields (`material`, `pattern`, `neck_type`, `color`, etc.)
  3. Existing values from the uploaded sheet stub
  4. Defaults from `config/defaults.yaml`

---

## 6. CLI Usage

You can also run the filler tool from the command line:

```bash
# Fill a design into a new workbook, copying image URLs from in-progress sheet
python -m flipkart_filler fill --json input/moonlight.json --source-sheet 1.xls

# Dry-run validation
python -m flipkart_filler fill --json input/moonlight.json --source-sheet 1.xls --dry-run

# Check/verify generated workbook
python -m flipkart_filler check --workbook output/moonlight_sample.xlsm

# List allowed values for an attribute
python -m flipkart_filler show-allowed --attribute "Pattern"
```

---

## 7. Troubleshooting Guide

| Issue / Prompt | Cause | Resolution |
| :--- | :--- | :--- |
| **Excel Repair Prompt on Open** | Corrupted macros, broken drawings, or altered XML parts. | Ensure workbooks are built using `rebuild_tshirt_workbook` (surgical patch). Never save with standard openpyxl/pandas. |
| **"Duplicate Seller SKU ID"** | The generated SKU `{base}_{size}` clashes with another row. | Ensure `sku_base` is unique across designs or check for duplicate size rows in the sheet. |
| **"Value not in allowed list"** | The attribute does not match Flipkart allowed dropdown values. | The UI provides top-3 RapidFuzz suggestions with 1-click application. Canonical casing is enforced. |
| **"No free rows / Capacity exceeded"** | Total data rows exceed 496 (124 designs $\times$ 4 sizes). | Keep total designs within the 124-design capacity limit of the Flipkart template. |
| **Missing Image URLs Warning** | AU..BA columns are empty in the sheet or no `--source-sheet` passed. | Pass `--source-sheet <path>` in CLI or enter links in UI manual slot / unlock to edit. |
| **ModuleNotFoundError: No module named 'app'** | Project root is not on Python path. | Activate `.venv` and run `pip install -e .`, or use `run.bat` / `run.sh`. |

---

> [!TIP]
> **Next Step in Excel:**
> Open the generated `.xlsm` file in Microsoft Excel, navigate to the `t_shirt` sheet, press **Ctrl+Shift+S** (Fast Validate) to run the template's built-in validation macro, and then upload to the Flipkart Seller Portal.
