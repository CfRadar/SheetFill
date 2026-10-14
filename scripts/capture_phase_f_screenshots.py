import json
import time
from pathlib import Path
import httpx
from playwright.sync_api import sync_playwright

EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
BASE_DIR = Path(r"D:\ALL_USER_DATA\SheetFillingAutomation\flipkart-tshirt-filler")
OUTPUT_DIR = BASE_DIR / "docs" / "ui-fix" / "phase-f"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
FIXTURE_XLS = BASE_DIR / "tests" / "fixtures" / "1_before.xls"

def setup_subscriber_session():
    sub_user = "demo_subscriber"
    sub_pass = "TestSub123!"
    sub_res = httpx.post("http://127.0.0.1:8000/api/auth/login", json={
        "username": sub_user,
        "password": sub_pass,
        "device_id": "test_subscriber_phase_f"
    }, timeout=30.0)
    sub_data = sub_res.json()
    sub_token = sub_data["token"]
    user_obj = {
        "id": "demo_sub_id",
        "username": sub_data.get("username", "demo_subscriber"),
        "display_name": sub_data.get("display_name", "Demo Subscriber"),
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

def setup_admin_session():
    res = httpx.post("http://127.0.0.1:8000/api/auth/login", json={
        "username": "CfRadar",
        "password": "True@190_$",
        "device_id": "test_admin_phase_f"
    }, timeout=30.0)
    data = res.json()
    admin_token = data["token"]
    admin_user = {
        "id": "admin_id",
        "username": "CfRadar",
        "display_name": "Application Owner",
        "role": "admin",
        "days_left": 999,
        "is_active": True,
    }
    return admin_token, admin_user

def main():
    print("Setting up sessions...")
    sub_token, sub_user, sid = setup_subscriber_session()
    admin_token, admin_user = setup_admin_session()

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=EDGE_PATH, headless=True)

        # -------------------------------------------------------------
        # 1. BulkPasteDialog Modal in Workspace (Light & Dark, 1440px)
        # -------------------------------------------------------------
        for theme in ["light", "dark"]:
            ctx = browser.new_context(viewport={"width": 1440, "height": 900})
            page = ctx.new_page()
            page.goto("http://localhost:3000")
            page.evaluate(f"""() => {{
                sessionStorage.setItem('fk_auth_token', '{sub_token}');
                sessionStorage.setItem('fk_auth_user', JSON.stringify({json.dumps(sub_user)}));
                localStorage.setItem('sheetfill_theme_preference', '{theme}');
                if ('{theme}' === 'dark') {{
                    document.documentElement.classList.add('dark');
                }} else {{
                    document.documentElement.classList.remove('dark');
                }}
            }}""")
            page.goto(f"http://localhost:3000/?sid={sid}")
            page.wait_for_timeout(2000)

            # Click Paste all JSON button
            btn = page.locator('button:has-text("Paste all JSON")')
            if btn.count() > 0:
                btn.first.click()
                page.wait_for_timeout(800)
                page.screenshot(path=str(OUTPUT_DIR / f"bulk-paste-modal-{theme}.png"))
                print(f"Captured bulk-paste-modal-{theme}.png")
            ctx.close()

        # -------------------------------------------------------------
        # 2. Admin Dashboard Overview & Create Modal (Light & Dark)
        # -------------------------------------------------------------
        for theme in ["light", "dark"]:
            # 1440px Desktop Overview
            ctx = browser.new_context(viewport={"width": 1440, "height": 900})
            page = ctx.new_page()
            page.goto("http://localhost:3000")
            page.evaluate(f"""() => {{
                sessionStorage.setItem('fk_auth_token', '{admin_token}');
                sessionStorage.setItem('fk_auth_user', JSON.stringify({json.dumps(admin_user)}));
                localStorage.setItem('sheetfill_theme_preference', '{theme}');
                if ('{theme}' === 'dark') {{
                    document.documentElement.classList.add('dark');
                }} else {{
                    document.documentElement.classList.remove('dark');
                }}
            }}""")
            page.goto("http://localhost:3000")
            page.wait_for_timeout(2000)

            page.screenshot(path=str(OUTPUT_DIR / f"admin-overview-1440-{theme}.png"))
            print(f"Captured admin-overview-1440-{theme}.png")

            # Click Create User button to capture modal
            create_btn = page.locator('button:has-text("Create user")')
            if create_btn.count() > 0:
                create_btn.first.click()
                page.wait_for_timeout(800)
                page.screenshot(path=str(OUTPUT_DIR / f"admin-create-modal-{theme}.png"))
                print(f"Captured admin-create-modal-{theme}.png")

                # Close modal
                close_btn = page.locator('button:has-text("Cancel")')
                if close_btn.count() > 0:
                    close_btn.first.click()
                    page.wait_for_timeout(400)

            # Switch to Users Tab
            user_tab = page.locator('div[role="tab"]:has-text("Users")')
            if user_tab.count() > 0:
                user_tab.first.click()
                page.wait_for_timeout(1000)
                page.screenshot(path=str(OUTPUT_DIR / f"admin-users-1440-{theme}.png"))
                print(f"Captured admin-users-1440-{theme}.png")

            ctx.close()

            # 390px Mobile Overview
            ctx_mobile = browser.new_context(viewport={"width": 390, "height": 844})
            page_mobile = ctx_mobile.new_page()
            page_mobile.goto("http://localhost:3000")
            page_mobile.evaluate(f"""() => {{
                sessionStorage.setItem('fk_auth_token', '{admin_token}');
                sessionStorage.setItem('fk_auth_user', JSON.stringify({json.dumps(admin_user)}));
                localStorage.setItem('sheetfill_theme_preference', '{theme}');
                if ('{theme}' === 'dark') {{
                    document.documentElement.classList.add('dark');
                }} else {{
                    document.documentElement.classList.remove('dark');
                }}
            }}""")
            page_mobile.goto("http://localhost:3000")
            page_mobile.wait_for_timeout(2000)
            page_mobile.screenshot(path=str(OUTPUT_DIR / f"admin-overview-390-{theme}.png"))
            print(f"Captured admin-overview-390-{theme}.png")
            ctx_mobile.close()

        browser.close()

if __name__ == "__main__":
    main()
