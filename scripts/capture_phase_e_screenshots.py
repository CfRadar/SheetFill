import json
import time
from pathlib import Path
import httpx
from playwright.sync_api import sync_playwright

EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
BASE_DIR = Path(r"D:\ALL_USER_DATA\SheetFillingAutomation\flipkart-tshirt-filler")
OUTPUT_DIR = BASE_DIR / "docs" / "ui-fix" / "phase-e"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
FIXTURE_XLS = BASE_DIR / "tests" / "fixtures" / "1_before.xls"

VALID_JSON = {
    "product_title": "Women’s Premium Oversized Printed T-Shirt",
    "product_description": "Add a stylish retro touch to your everyday wardrobe with this premium black oversized printed T-shirt. Designed with a relaxed silhouette and a bold retro cartoon-inspired graphic print, this T-shirt combines comfort with a modern streetwear aesthetic. The soft, breathable fabric and oversized fit make it suitable for casual outings, college wear, travel, and everyday styling.",
    "key_features": [
        "Premium-quality fabric",
        "Stylish oversized / relaxed fit",
        "Bold high-definition front graphic print",
        "Classic round crew neck",
        "3/4 sleeves",
        "Soft and comfortable feel",
        "Breathable and lightweight construction",
        "Durable print with vibrant detailing",
        "Easy to wash and maintain",
        "Suitable for casual, streetwear and everyday looks"
    ],
    "material": "Cotton Blend",
    "pattern": "Graphic Print",
    "sleeve_type": "3/4 Sleeve",
    "neck_type": "Round Neck",
    "fit_type": "Oversized",
    "ideal_for": "Women",
    "color": "Black",
    "brand_color": "Black",
    "occasion": "Casual",
    "style_code": "TSH-001",
    "search_keywords": "Graphic Print::Cartoon::Oversized::Casual",
    "key_features_sheet": "Graphic Print::Oversized Fit::Premium Cotton Fabric::Skin-Friendly Fabric",
    "fabric_care": "Regular Machine Wash",
    "surface_styling": "Typography",
    "tee_length": "Medium",
    "print_coverage": "Chest",
    "sleeve_details": "No Details",
    "detail_placement": "Front Panel",
    "detail_placement_rows": ["S", "M", "L", "XL"]
}

def setup_session():
    sub_user = "demo_subscriber"
    sub_pass = "TestSub123!"
    sub_res = httpx.post("http://127.0.0.1:8000/api/auth/login", json={
        "username": sub_user,
        "password": sub_pass,
        "device_id": "test_subscriber_phase_e"
    }, timeout=30.0)
    sub_data = sub_res.json()
    sub_token = sub_data["token"]
    user_obj = {
        "id": "demo_sub_id",
        "username": sub_data.get("username", "demo_subscriber"),
        "display_name": sub_data.get("display_name", "Demo Seller Surat"),
        "role": sub_data.get("role", "user"),
        "days_left": sub_data.get("days_left", 30)
    }

    with open(FIXTURE_XLS, "rb") as f:
        upload_res = httpx.post(
            "http://127.0.0.1:8000/api/sheets/analyze",
            headers={"Authorization": f"Bearer {sub_token}"},
            files={"file": ("1_before.xls", f, "application/vnd.ms-excel")},
            timeout=30.0
        )
    sid = upload_res.json()["session_id"]
    return sub_token, user_obj, sid

def capture_editor_states():
    sub_token, user_obj, sid = setup_session()
    print(f"Session established: {sid}")

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=EDGE_PATH, headless=True)

        # -------------------------------------------------------------
        # 1. EMPTY JSON STATE (Light & Warm Dark)
        # -------------------------------------------------------------
        ctx = browser.new_context(viewport={"width": 1440, "height": 1050})
        page = ctx.new_page()
        page.goto("http://localhost:3000")
        page.evaluate(f"""() => {{
            sessionStorage.setItem('fk_auth_token', '{sub_token}');
            sessionStorage.setItem('fk_auth_user', JSON.stringify({json.dumps(user_obj)}));
            localStorage.setItem('sheetfill_theme_preference', 'light');
            document.documentElement.classList.remove('dark');
        }}""")
        page.goto(f"http://localhost:3000/?sid={sid}")
        page.wait_for_timeout(2000)

        page.screenshot(path=str(OUTPUT_DIR / "editor-empty-json-light.png"))
        print("Captured editor-empty-json-light.png")

        # Switch to warm dark
        page.evaluate("""() => {
            localStorage.setItem('sheetfill_theme_preference', 'dark');
            document.documentElement.classList.add('dark');
        }""")
        page.wait_for_timeout(400)
        page.screenshot(path=str(OUTPUT_DIR / "editor-empty-json-dark.png"))
        print("Captured editor-empty-json-dark.png")

        # -------------------------------------------------------------
        # 2. INVALID JSON STATE (with errors & suggestions)
        # -------------------------------------------------------------
        textarea = page.locator("textarea").first
        textarea.fill('{\n  "product_title": "Too short",\n  "material": "Unknown Fabric",\n  "sleeve_type": "short"\n}')
        page.wait_for_timeout(1000)

        page.screenshot(path=str(OUTPUT_DIR / "editor-invalid-json-dark.png"))
        print("Captured editor-invalid-json-dark.png")

        page.evaluate("""() => {
            localStorage.setItem('sheetfill_theme_preference', 'light');
            document.documentElement.classList.remove('dark');
        }""")
        page.wait_for_timeout(400)
        page.screenshot(path=str(OUTPUT_DIR / "editor-invalid-json-light.png"))
        print("Captured editor-invalid-json-light.png")

        # -------------------------------------------------------------
        # 3. VALID JSON STATE (with live valid chip & preview rows)
        # -------------------------------------------------------------
        textarea.fill(json.dumps(VALID_JSON, indent=2))
        page.wait_for_timeout(1500)

        page.screenshot(path=str(OUTPUT_DIR / "editor-valid-json-light.png"))
        print("Captured editor-valid-json-light.png")

        page.evaluate("""() => {
            localStorage.setItem('sheetfill_theme_preference', 'dark');
            document.documentElement.classList.add('dark');
        }""")
        page.wait_for_timeout(400)
        page.screenshot(path=str(OUTPUT_DIR / "editor-valid-json-dark.png"))
        print("Captured editor-valid-json-dark.png")

        # -------------------------------------------------------------
        # 4. ALL READY STATE (Bulk assign all 8 designs)
        # -------------------------------------------------------------
        # Send bulk assign to backend so all 8 are ready
        valid_items = [VALID_JSON] * 8
        httpx.post(
            f"http://127.0.0.1:8000/api/sheets/{sid}/bulk-json",
            headers={"Authorization": f"Bearer {sub_token}"},
            json={"items": valid_items, "auto_apply_high_confidence": True},
            timeout=30.0
        )
        page.reload()
        page.wait_for_timeout(2000)

        page.screenshot(path=str(OUTPUT_DIR / "editor-all-ready-dark.png"))
        print("Captured editor-all-ready-dark.png")

        page.evaluate("""() => {
            localStorage.setItem('sheetfill_theme_preference', 'light');
            document.documentElement.classList.remove('dark');
        }""")
        page.wait_for_timeout(400)
        page.screenshot(path=str(OUTPUT_DIR / "editor-all-ready-light.png"))
        print("Captured editor-all-ready-light.png")

        ctx.close()
        browser.close()
        print("All Phase E design editor screenshots captured successfully!")

if __name__ == "__main__":
    capture_editor_states()
