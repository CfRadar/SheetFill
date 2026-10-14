import json
import time
from pathlib import Path
import httpx
from playwright.sync_api import sync_playwright

EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
BASE_DIR = Path(r"D:\ALL_USER_DATA\SheetFillingAutomation\flipkart-tshirt-filler")
OUTPUT_DIR = BASE_DIR / "docs" / "ui-fix" / "phase-d"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
FIXTURE_XLS = BASE_DIR / "tests" / "fixtures" / "1_before.xls"

def setup_session():
    # 1. Login subscriber
    sub_user = "demo_subscriber"
    sub_pass = "TestSub123!"
    sub_res = httpx.post("http://127.0.0.1:8000/api/auth/login", json={
        "username": sub_user,
        "password": sub_pass,
        "device_id": "test_subscriber_phase_d"
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

    # 2. Upload 1_before.xls to get real 8-design session
    with open(FIXTURE_XLS, "rb") as f:
        upload_res = httpx.post(
            "http://127.0.0.1:8000/api/sheets/analyze",
            headers={"Authorization": f"Bearer {sub_token}"},
            files={"file": ("1_before.xls", f, "application/vnd.ms-excel")},
            timeout=30.0
        )
    sid = upload_res.json()["session_id"]
    return sub_token, user_obj, sid

def capture_workspace():
    sub_token, user_obj, sid = setup_session()
    print(f"Session established: {sid}")

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=EDGE_PATH, headless=True)

        # -------------------------------------------------------------
        # 1. Light Mode across 1440, 1024, 390
        # -------------------------------------------------------------
        ctx_light = browser.new_context(viewport={"width": 1440, "height": 950})
        p_light = ctx_light.new_page()
        p_light.goto("http://localhost:3000")
        p_light.evaluate(f"""() => {{
            sessionStorage.setItem('fk_auth_token', '{sub_token}');
            sessionStorage.setItem('fk_auth_user', JSON.stringify({json.dumps(user_obj)}));
            localStorage.setItem('sheetfill_theme_preference', 'light');
            document.documentElement.classList.remove('dark');
        }}""")
        p_light.goto(f"http://localhost:3000/?sid={sid}")
        p_light.wait_for_timeout(2000)

        # 1440px Light
        p_light.screenshot(path=str(OUTPUT_DIR / "workspace-light-1440.png"))
        print("Captured workspace-light-1440.png")

        # 1024px Light
        p_light.set_viewport_size({"width": 1024, "height": 800})
        p_light.wait_for_timeout(800)
        p_light.screenshot(path=str(OUTPUT_DIR / "workspace-light-1024.png"))
        print("Captured workspace-light-1024.png")

        # 390px Mobile Light
        p_light.set_viewport_size({"width": 390, "height": 844})
        p_light.wait_for_timeout(800)
        p_light.screenshot(path=str(OUTPUT_DIR / "workspace-light-390.png"))
        print("Captured workspace-light-390.png")

        # 390px Mobile Light with Drawer open
        drawer_btn = p_light.locator('button:has-text("Designs")').first
        if drawer_btn.is_visible():
            drawer_btn.click()
            p_light.wait_for_timeout(600)
            p_light.screenshot(path=str(OUTPUT_DIR / "workspace-drawer-light-390.png"))
            print("Captured workspace-drawer-light-390.png")

        ctx_light.close()

        # -------------------------------------------------------------
        # 2. Dark Mode across 1440, 1024, 390
        # -------------------------------------------------------------
        ctx_dark = browser.new_context(viewport={"width": 1440, "height": 950})
        p_dark = ctx_dark.new_page()
        p_dark.goto("http://localhost:3000")
        p_dark.evaluate(f"""() => {{
            sessionStorage.setItem('fk_auth_token', '{sub_token}');
            sessionStorage.setItem('fk_auth_user', JSON.stringify({json.dumps(user_obj)}));
            localStorage.setItem('sheetfill_theme_preference', 'dark');
            document.documentElement.classList.add('dark');
        }}""")
        p_dark.goto(f"http://localhost:3000/?sid={sid}")
        p_dark.wait_for_timeout(2000)

        # 1440px Dark
        p_dark.screenshot(path=str(OUTPUT_DIR / "workspace-dark-1440.png"))
        print("Captured workspace-dark-1440.png")

        # 1024px Dark
        p_dark.set_viewport_size({"width": 1024, "height": 800})
        p_dark.wait_for_timeout(800)
        p_dark.screenshot(path=str(OUTPUT_DIR / "workspace-dark-1024.png"))
        print("Captured workspace-dark-1024.png")

        # 390px Mobile Dark
        p_dark.set_viewport_size({"width": 390, "height": 844})
        p_dark.wait_for_timeout(800)
        p_dark.screenshot(path=str(OUTPUT_DIR / "workspace-dark-390.png"))
        print("Captured workspace-dark-390.png")

        # 390px Mobile Dark with Drawer open
        drawer_btn_dark = p_dark.locator('button:has-text("Designs")').first
        if drawer_btn_dark.is_visible():
            drawer_btn_dark.click()
            p_dark.wait_for_timeout(600)
            p_dark.screenshot(path=str(OUTPUT_DIR / "workspace-drawer-dark-390.png"))
            print("Captured workspace-drawer-dark-390.png")

        ctx_dark.close()
        browser.close()
        print("All Phase D workspace screenshots captured successfully!")

if __name__ == "__main__":
    capture_workspace()
