import { test, expect } from "@playwright/test";
import path from "path";

test("Full Flipkart T-Shirt Listing UI flow", async ({ page }) => {
  // 1. Open app
  await page.goto("http://127.0.0.1:8000");
  await expect(page.locator("text=Upload Flipkart T-Shirt Workbook")).toBeVisible();

  // 2. Upload draft 1_before.xls
  const fixturePath = path.resolve(__dirname, "../fixtures/1_before.xls");
  await page.setInputFiles('input[type="file"]', fixturePath);

  // 3. Verify detection summary
  await expect(page.locator("text=8 designs found")).toBeVisible({ timeout: 15000 });
  await expect(page.locator("text=8 need JSON")).toBeVisible();

  // 4. Open bulk dialog and paste batch JSON
  await page.click("text=Paste all JSON");
  const batchPath = path.resolve(__dirname, "../fixtures/batch_1_to_2.json");
  const fs = await import("fs");
  const batchJson = fs.readFileSync(batchPath, "utf-8");

  await page.fill('[data-testid="bulk-json-textarea"]', batchJson);
  await page.click("text=Match JSONs to Designs");

  // 5. Confirm matches
  await expect(page.locator("text=Matching Results (8 matched")).toBeVisible();
  await page.click("text=Confirm & Save All");

  // 6. Verify cards updated to Ready
  await expect(page.locator("text=8 of 8 ready")).toBeVisible({ timeout: 10000 });

  // 7. Generate .xlsm
  await page.click("button:has-text('Generate .xlsm')");
  await expect(page.locator("text=Workbook Generated Successfully")).toBeVisible({ timeout: 15000 });

  // 8. Download workbook
  const downloadPromise = page.waitForEvent("download");
  await page.click("text=Download .xlsm");
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain(".xlsm");
});
