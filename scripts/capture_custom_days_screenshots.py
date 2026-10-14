import json
import time
from pathlib import Path
import httpx
from playwright.sync_api import sync_playwright

EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
BASE_DIR = Path(r"D:\ALL_USER_DATA\SheetFillingAutomation\flipkart-tshirt-filler")
OUTPUT_DIR = BASE_DIR / "docs" / "ui-fix" / "phase-f"

def setup_admin_session():
    res = httpx.post("http://127.0.0.1:8000/api/auth/login", json={
        "username": "CfRadar",
        "password": "True@190_$",
        "device_id": "test_admin_custom_days"
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
    admin_token, admin_user = setup_admin_session()

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=EDGE_PATH, headless=True)
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()

        page.goto("http://localhost:3000")
        page.evaluate(f"""() => {{
            sessionStorage.setItem('fk_auth_token', '{admin_token}');
            sessionStorage.setItem('fk_auth_user', JSON.stringify({json.dumps(admin_user)}));
            localStorage.setItem('sheetfill_theme_preference', 'dark');
            document.documentElement.classList.add('dark');
        }}""")
        page.goto("http://localhost:3000")
        page.wait_for_timeout(2000)

        # 1. Click Create User to capture custom days input
        create_btn = page.locator('button:has-text("Create user")')
        if create_btn.count() > 0:
            create_btn.first.click()
            page.wait_for_timeout(800)
            # Fill 45 in custom days
            custom_input = page.locator('input[aria-label="Custom access duration in days"]')
            if custom_input.count() > 0:
                custom_input.fill("45")
                page.wait_for_timeout(300)
            page.screenshot(path=str(OUTPUT_DIR / "admin-create-custom-days-dark.png"))
            print("Captured admin-create-custom-days-dark.png")
            page.locator('button:has-text("Cancel")').first.click()
            page.wait_for_timeout(500)

        # 2. Switch to Users tab
        user_tab = page.locator('[role="tab"]:has-text("Users")')
        if user_tab.count() > 0:
            user_tab.first.click()
            page.wait_for_timeout(1500)

            # Wait for rows to appear
            action_btn = page.locator('button[aria-label="Subscriber actions"]').first
            action_btn.wait_for(state="visible", timeout=5000)
            action_btn.click()
            page.wait_for_timeout(500)

            # Click "Add custom days..."
            custom_opt = page.locator('text="Add custom days..."')
            if custom_opt.count() > 0:
                custom_opt.click()
                page.wait_for_timeout(800)

                # Fill 60 days
                extend_input = page.locator('input[aria-label="Custom days to extend"]')
                if extend_input.count() > 0:
                    extend_input.fill("60")
                    page.wait_for_timeout(300)

                page.screenshot(path=str(OUTPUT_DIR / "admin-extend-custom-days-dark.png"))
                print("Captured admin-extend-custom-days-dark.png")

        ctx.close()
        browser.close()

if __name__ == "__main__":
    main()
