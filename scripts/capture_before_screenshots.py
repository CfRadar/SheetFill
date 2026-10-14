import json
import time
from pathlib import Path
import httpx
from playwright.sync_api import sync_playwright

EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
BASE_DIR = Path(r"D:\ALL_USER_DATA\SheetFillingAutomation\flipkart-tshirt-filler")
OUTPUT_DIR = BASE_DIR / "docs" / "ui-fix" / "before"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
FIXTURE_XLS = BASE_DIR / "tests" / "fixtures" / "1_before.xls"

def setup_user_and_sheet():
    # 1. Login as admin to get token
    res = httpx.post("http://127.0.0.1:8000/api/auth/login", json={
        "username": "CfRadar",
        "password": "True@190_$",
        "device_id": "test_device_setup"
    }, timeout=30.0)
    admin_token = res.json()["token"]

    # 2. Create or verify subscriber
    sub_user = "demo_subscriber"
    sub_pass = "TestSub123!"
    try:
        httpx.post(
            "http://127.0.0.1:8000/api/admin/users",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "username": sub_user,
                "password": sub_pass,
                "display_name": "Demo Seller Surat",
                "duration_days": 30
            },
            timeout=30.0
        )
    except Exception as e:
        pass

    # 3. Login as subscriber to get subscriber token
    sub_res = httpx.post("http://127.0.0.1:8000/api/auth/login", json={
        "username": sub_user,
        "password": sub_pass,
        "device_id": "test_subscriber_device"
    }, timeout=30.0)
    sub_data = sub_res.json()
    sub_token = sub_data["token"]
    sub_user = {
        "id": "demo_sub_id",
        "username": sub_data.get("username", "demo_subscriber"),
        "display_name": sub_data.get("display_name", "Demo Seller Surat"),
        "role": sub_data.get("role", "user"),
        "days_left": sub_data.get("days_left", 30)
    }

    # 4. Upload 1_before.xls as subscriber
    with open(FIXTURE_XLS, "rb") as f:
        upload_res = httpx.post(
            "http://127.0.0.1:8000/api/sheets/analyze",
            headers={"Authorization": f"Bearer {sub_token}"},
            files={"file": ("1_before.xls", f, "application/vnd.ms-excel")},
            timeout=30.0
        )
    session_data = upload_res.json()
    sid = session_data["session_id"]
    return sub_token, sub_user, sid

def capture_all():
    sub_token, sub_user, sid = setup_user_and_sheet()
    print(f"Setup complete: sid={sid}")

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=EDGE_PATH, headless=True)

        # -------------------------------------------------------------
        # 1. Login Screen (1440px and 390px)
        # -------------------------------------------------------------
        ctx_login = browser.new_context(viewport={"width": 1440, "height": 900})
        p_login = ctx_login.new_page()
        p_login.goto("http://localhost:3000")
        p_login.wait_for_timeout(1000)
        p_login.screenshot(path=str(OUTPUT_DIR / "login-1440.png"))
        print("Captured login-1440.png")

        p_login.set_viewport_size({"width": 390, "height": 844})
        p_login.wait_for_timeout(500)
        p_login.screenshot(path=str(OUTPUT_DIR / "login-390.png"))
        print("Captured login-390.png")
        ctx_login.close()

        # -------------------------------------------------------------
        # 2. Admin Portal (1440px and 390px)
        # -------------------------------------------------------------
        ctx_admin = browser.new_context(viewport={"width": 1440, "height": 900})
        p_admin = ctx_admin.new_page()
        p_admin.goto("http://localhost:3000")
        p_admin.fill('input[type="text"]', "CfRadar")
        p_admin.fill('input[type="password"]', "True@190_$")
        p_admin.click('button[type="submit"]')
        p_admin.wait_for_timeout(2500)

        # Admin Overview 1440px
        p_admin.screenshot(path=str(OUTPUT_DIR / "admin-overview-1440.png"))
        print("Captured admin-overview-1440.png")

        # Admin Overview 390px
        p_admin.set_viewport_size({"width": 390, "height": 844})
        p_admin.wait_for_timeout(600)
        p_admin.screenshot(path=str(OUTPUT_DIR / "admin-overview-390.png"))
        print("Captured admin-overview-390.png")

        # Admin Users 1440px
        p_admin.set_viewport_size({"width": 1440, "height": 900})
        users_tab = p_admin.locator('button:has-text("Users"), [role="tab"]:has-text("Users")').first
        if users_tab.is_visible():
            users_tab.click()
            p_admin.wait_for_timeout(1500)
            p_admin.screenshot(path=str(OUTPUT_DIR / "admin-users-1440.png"))
            print("Captured admin-users-1440.png")

            # Admin Users 390px
            p_admin.set_viewport_size({"width": 390, "height": 844})
            p_admin.wait_for_timeout(600)
            p_admin.screenshot(path=str(OUTPUT_DIR / "admin-users-390.png"))
            print("Captured admin-users-390.png")

        ctx_admin.close()

        # -------------------------------------------------------------
        # 3. Workspace Screen with Active Session (1440px and 390px)
        # -------------------------------------------------------------
        ctx_sub = browser.new_context(viewport={"width": 1440, "height": 900})
        # Set auth token in localStorage/sessionStorage
        p_sub = ctx_sub.new_page()
        p_sub.goto("http://localhost:3000")
        p_sub.evaluate(f"""() => {{
            sessionStorage.setItem('fk_auth_token', '{sub_token}');
            sessionStorage.setItem('fk_auth_user', JSON.stringify({json.dumps(sub_user)}));
        }}""")
        p_sub.goto(f"http://localhost:3000/?sid={sid}")
        p_sub.wait_for_timeout(2500)

        p_sub.screenshot(path=str(OUTPUT_DIR / "workspace-1440.png"))
        print("Captured workspace-1440.png")

        p_sub.set_viewport_size({"width": 390, "height": 844})
        p_sub.wait_for_timeout(800)
        p_sub.screenshot(path=str(OUTPUT_DIR / "workspace-390.png"))
        print("Captured workspace-390.png")

        ctx_sub.close()
        browser.close()
        print("All screenshots successfully captured!")

if __name__ == "__main__":
    capture_all()
