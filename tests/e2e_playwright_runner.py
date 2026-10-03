"""Playwright E2E automation script testing UI flow and capturing artifacts."""

import os
from pathlib import Path
import time
import openpyxl
from playwright.sync_api import sync_playwright

ARTIFACTS_DIR = Path(r"C:\Users\anura\.gemini\antigravity-ide\brain\cb55b0eb-6bf7-43d8-8e96-2bc5420b775d")
FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"


def run_e2e():
    print("Launching Playwright using system Edge browser...")
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=EDGE_PATH,
            headless=True,
        )
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        # Step 1: Navigate to http://127.0.0.1:8000
        print("Navigating to http://127.0.0.1:8000...")
        page.goto("http://127.0.0.1:8000")
        page.wait_for_selector("text=Upload Flipkart T-Shirt Workbook")

        # Screenshot 1: Empty state
        sc1 = ARTIFACTS_DIR / "screenshot_1_empty_state.png"
        page.screenshot(path=str(sc1))
        print("Captured Screenshot 1 (Empty state):", sc1)

        # Step 2: Upload 1_before.xls
        xls_file = FIXTURES_DIR / "1_before.xls"
        print(f"Uploading {xls_file}...")
        file_input = page.locator('input[type="file"]')
        file_input.set_input_files(str(xls_file))

        # Wait for analysis and designs to render
        page.wait_for_selector("text=8 designs found", timeout=15000)
        time.sleep(1)

        # Screenshot 2: 8 designs detected
        sc2 = ARTIFACTS_DIR / "screenshot_2_8_designs_detected.png"
        page.screenshot(path=str(sc2))
        print("Captured Screenshot 2 (8 designs detected):", sc2)

        # Step 3: Open Bulk Paste Dialog
        print("Opening Bulk Paste Dialog...")
        page.click("text=Paste all JSON")
        page.wait_for_selector("text=Paste All Product JSONs")

        # Step 4: Paste batch JSON and match
        batch_json_path = FIXTURES_DIR / "batch_1_to_2.json"
        batch_json_text = batch_json_path.read_text(encoding="utf-8")
        page.fill('[data-testid="bulk-json-textarea"]', batch_json_text)

        print("Clicking Match JSONs to Designs...")
        page.click("text=Match JSONs to Designs")
        page.wait_for_selector("text=Matching Results (8 matched", timeout=10000)

        # Screenshot 3: Bulk match dialog
        sc3 = ARTIFACTS_DIR / "screenshot_3_bulk_match_dialog.png"
        page.screenshot(path=str(sc3))
        print("Captured Screenshot 3 (Bulk match dialog):", sc3)

        # Step 5: Confirm & Save All
        print("Clicking Confirm & Save All...")
        page.click("text=Confirm & Save All")

        # Wait for dialog to close and badges to update to Ready
        page.wait_for_selector("text=Matching Results", state="detached")
        time.sleep(2)

        # Screenshot 4: All ready
        sc4 = ARTIFACTS_DIR / "screenshot_4_all_ready.png"
        page.screenshot(path=str(sc4))
        print("Captured Screenshot 4 (All ready):", sc4)

        # Step 6: Generate .xlsm
        print("Clicking Generate .xlsm...")
        page.locator("button:has-text('Generate .xlsm')").last.click()

        # Wait for report panel to render on page
        page.wait_for_selector("text=Workbook Generated Successfully", timeout=15000)
        time.sleep(1)

        # Screenshot 5: Report + download
        sc5 = ARTIFACTS_DIR / "screenshot_5_report_download.png"
        page.screenshot(path=str(sc5))
        print("Captured Screenshot 5 (Report + download):", sc5)

        # Download workbook via the Download .xlsm button in ReportPanel
        print("Clicking Download .xlsm in ReportPanel...")
        with page.expect_download() as download_info:
            page.locator("text=Download .xlsm").click()

        download = download_info.value
        downloaded_path = FIXTURES_DIR.parent.parent / "output" / "playwright_downloaded.xlsm"
        download.save_as(str(downloaded_path))
        print("Workbook downloaded to:", downloaded_path)

        # Step 7: Mobile Viewport (390x844)
        print("Resizing to mobile viewport (390x844)...")
        page.set_viewport_size({"width": 390, "height": 844})
        time.sleep(1)

        # Screenshot 6: Mobile viewport
        sc6 = ARTIFACTS_DIR / "screenshot_6_mobile_390px.png"
        page.screenshot(path=str(sc6))
        print("Captured Screenshot 6 (Mobile 390px):", sc6)

        browser.close()

        # Step 8: Verify downloaded file has 32 size rows
        print("Verifying downloaded workbook structure...")
        wb = openpyxl.load_workbook(str(downloaded_path), data_only=True)
        sh = wb["t_shirt"]
        row_count = 0
        for r in range(5, 37):
            sku = sh.cell(r, 7).value
            if sku and str(sku).strip():
                row_count += 1
        print(f"Verified {row_count} size rows in downloaded workbook.")
        assert row_count == 32, f"Expected 32 size rows, got {row_count}"
        print("All E2E checks PASSED successfully!")


if __name__ == "__main__":
    run_e2e()
