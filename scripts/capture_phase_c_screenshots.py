import time
from pathlib import Path
from playwright.sync_api import sync_playwright

EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
BASE_DIR = Path(r"D:\ALL_USER_DATA\SheetFillingAutomation\flipkart-tshirt-filler")
OUTPUT_DIR = BASE_DIR / "docs" / "ui-fix" / "phase-c"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def capture_login():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=EDGE_PATH, headless=True)

        # -------------------------------------------------------------
        # 1. Light Mode (1440px & 390px)
        # -------------------------------------------------------------
        ctx_light = browser.new_context(viewport={"width": 1440, "height": 900})
        p_light = ctx_light.new_page()
        p_light.goto("http://localhost:3000")
        p_light.evaluate("""() => {
            sessionStorage.clear();
            localStorage.setItem('sheetfill_theme_preference', 'light');
            document.documentElement.classList.remove('dark');
        }""")
        p_light.reload()
        p_light.wait_for_timeout(1000)

        # 1440px Light clean state
        p_light.screenshot(path=str(OUTPUT_DIR / "login-light-1440.png"))
        print("Captured login-light-1440.png")

        # Trigger error alert (empty submission or invalid credentials)
        p_light.locator('button[type="submit"]').click()
        p_light.wait_for_timeout(400)
        p_light.screenshot(path=str(OUTPUT_DIR / "login-error-light-1440.png"))
        print("Captured login-error-light-1440.png")

        # 390px Mobile Light
        p_light.set_viewport_size({"width": 390, "height": 844})
        p_light.wait_for_timeout(500)
        p_light.screenshot(path=str(OUTPUT_DIR / "login-light-390.png"))
        print("Captured login-light-390.png")
        ctx_light.close()

        # -------------------------------------------------------------
        # 2. Dark Mode (1440px & 390px)
        # -------------------------------------------------------------
        ctx_dark = browser.new_context(viewport={"width": 1440, "height": 900})
        p_dark = ctx_dark.new_page()
        p_dark.goto("http://localhost:3000")
        p_dark.evaluate("""() => {
            sessionStorage.clear();
            localStorage.setItem('sheetfill_theme_preference', 'dark');
            document.documentElement.classList.add('dark');
        }""")
        p_dark.reload()
        p_dark.wait_for_timeout(1000)

        # 1440px Dark clean state
        p_dark.screenshot(path=str(OUTPUT_DIR / "login-dark-1440.png"))
        print("Captured login-dark-1440.png")

        # Trigger error alert in dark mode
        p_dark.locator('button[type="submit"]').click()
        p_dark.wait_for_timeout(400)
        p_dark.screenshot(path=str(OUTPUT_DIR / "login-error-dark-1440.png"))
        print("Captured login-error-dark-1440.png")

        # 390px Mobile Dark
        p_dark.set_viewport_size({"width": 390, "height": 844})
        p_dark.wait_for_timeout(500)
        p_dark.screenshot(path=str(OUTPUT_DIR / "login-dark-390.png"))
        print("Captured login-dark-390.png")
        ctx_dark.close()

        browser.close()
        print("All Phase C login screenshots captured successfully!")

if __name__ == "__main__":
    capture_login()
