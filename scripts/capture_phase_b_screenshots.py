import time
from pathlib import Path
from playwright.sync_api import sync_playwright

EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
BASE_DIR = Path(r"D:\ALL_USER_DATA\SheetFillingAutomation\flipkart-tshirt-filler")
OUTPUT_DIR = BASE_DIR / "docs" / "ui-fix" / "phase-b"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def capture_bench():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=EDGE_PATH, headless=True)

        # 1. Desktop Light (1440px)
        ctx = browser.new_context(viewport={"width": 1440, "height": 1100})
        page = ctx.new_page()
        page.goto("http://localhost:3000/?bench=1")
        page.wait_for_timeout(1500)

        # Ensure light mode
        page.evaluate("""() => {
            localStorage.setItem('sheetfill_theme_preference', 'light');
            document.documentElement.classList.remove('dark');
        }""")
        page.reload()
        page.wait_for_timeout(1000)

        # Trigger toast so toast is visible in capture
        page.locator('button:has-text("Trigger Success Toast")').click()
        page.wait_for_timeout(500)

        page.screenshot(path=str(OUTPUT_DIR / "bench-light-1440.png"))
        print("Captured bench-light-1440.png")

        # Open modal in Light Mode
        page.locator('button:has-text("Open Modal Dialog")').click()
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUTPUT_DIR / "bench-modal-light-1440.png"))
        print("Captured bench-modal-light-1440.png")

        # Close modal
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)

        # 2. Mobile Light (390px)
        page.set_viewport_size({"width": 390, "height": 900})
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUTPUT_DIR / "bench-light-390.png"))
        print("Captured bench-light-390.png")

        # 3. Switch to Dark Mode (Desktop 1440px)
        page.set_viewport_size({"width": 1440, "height": 1100})
        page.evaluate("""() => {
            localStorage.setItem('sheetfill_theme_preference', 'dark');
            document.documentElement.classList.add('dark');
        }""")
        page.reload()
        page.wait_for_timeout(1000)

        # Trigger toast in dark mode
        page.locator('button:has-text("Trigger Success Toast")').click()
        page.wait_for_timeout(500)

        page.screenshot(path=str(OUTPUT_DIR / "bench-dark-1440.png"))
        print("Captured bench-dark-1440.png")

        # Open modal in Dark Mode
        page.locator('button:has-text("Open Modal Dialog")').click()
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUTPUT_DIR / "bench-modal-dark-1440.png"))
        print("Captured bench-modal-dark-1440.png")

        # Close modal
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)

        # 4. Mobile Dark (390px)
        page.set_viewport_size({"width": 390, "height": 900})
        page.wait_for_timeout(500)
        page.screenshot(path=str(OUTPUT_DIR / "bench-dark-390.png"))
        print("Captured bench-dark-390.png")

        ctx.close()
        browser.close()
        print("All Phase B test bench screenshots captured successfully!")

if __name__ == "__main__":
    capture_bench()
