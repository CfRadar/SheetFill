# SheetFill Asset Inventory & Status Specification

**Project**: SheetFill (`cfradar/sheetfill`)  
**Document**: Required Assets & Status Manifest  
**Author**: Antigravity Technical Architecture Agent  
**Date**: October 18, 2026  
**Status**: Ready for User Review & Approval  

---

## 1. Project Logo & Brand Mark Status

### Findings & Implementation
1. **Primary Vector Logo (`logo.svg`)**:
   - Location: `frontend/public/logo.svg`
   - Design: 64x64 scalable SVG featuring a rounded indigo liquid-glass surface (`#4F46E5` / `#6366F1`) with translucent grid lines and a 4-point AI starburst mark.
   - Status: **Present & Deployed** (Embedded in `AppShell.tsx` and declared in `index.html`).

2. **Browser Tab Favicon (`favicon.ico`)**:
   - Location: `frontend/public/favicon.ico`
   - Formats: Multi-size binary ICO (16x16 and 32x32 pixels).
   - Status: **Present & Deployed**.

3. **Apple Touch Icon (`apple-touch-icon.png`)**:
   - Location: `frontend/public/apple-touch-icon.png`
   - Dimension: 180x180 pixels for iOS Safari and mobile PWA bookmarking.
   - Status: **Present & Deployed**.

4. **Crawler Directives (`robots.txt`)**:
   - Location: `frontend/public/robots.txt`
   - Status: **Present & Deployed**.

---

## 2. Complete Asset Matrix

| Asset Name | Target File Path | Purpose / Description | Dimensions | Format | Usage Location | Status | Action Required |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Primary Logo** | `frontend/public/logo.svg` | Main brand mark for navbar, top bar, and login | 64x64 | SVG | `AppShell.tsx`, `LoginPage.tsx` | **Present** | Maintained in git |
| **Browser Favicon** | `frontend/public/favicon.ico` | Browser tab identifier icon | 16x16, 32x32 | ICO | `index.html` | **Present** | Maintained in git |
| **Apple Touch Icon** | `frontend/public/apple-touch-icon.png` | High-res mobile bookmark icon | 180x180 | PNG | `index.html` | **Present** | Maintained in git |
| **Search Crawler File** | `frontend/public/robots.txt` | Directs web crawlers | N/A | Plaintext | Public root | **Present** | Disallow internal API routes |
| **Flipkart Master Template** | `templates/Flipkart_TShirt_Template.xlsm` | Byte-for-byte master listing workbook | 527 KB | XLSM | Backend writer (`writer.py`) | **Present** | Verified intact; zero corruption |
| **Hero Login Visual** | `frontend/assets/Fast Document Sparkle Icon.png` | High-res marketing visual | 1024x1024 | PNG | `LoginPage.tsx` hero card | **Present** | Convert to WebP (< 80 KB) for production |
| **Amazon Vector Mark** | `frontend/src/assets/platforms/amazon.svg` | Amazon platform icon badge | 20x20 | SVG | `PlatformPicker.tsx`, `ResultsPanel.tsx` | **Ready to Add** | Clean monochrome vector SVG |
| **Flipkart Vector Mark** | `frontend/src/assets/platforms/flipkart.svg`| Flipkart platform icon badge | 20x20 | SVG | `PlatformPicker.tsx`, `ResultsPanel.tsx` | **Ready to Add** | Clean monochrome vector SVG |
| **Myntra Vector Mark** | `frontend/src/assets/platforms/myntra.svg` | Myntra platform icon badge | 20x20 | SVG | `PlatformPicker.tsx`, `ResultsPanel.tsx` | **Ready to Add** | Clean monochrome vector SVG |
| **Meesho Vector Mark** | `frontend/src/assets/platforms/meesho.svg` | Meesho platform icon badge | 20x20 | SVG | `PlatformPicker.tsx`, `ResultsPanel.tsx` | **Ready to Add** | Clean monochrome vector SVG |
| **Empty Sheet Illustration**| `frontend/src/assets/empty-sheet.svg` | Zero designs state illustration | 240x160 | SVG | `EmptyState.tsx` | **Ready to Add** | Frosted glass vector illustration |

---

## 3. Asset Optimization Standards

1. **Pure Vector SVGs**: All logos, marketplace icons, and empty state illustrations are SVGs to guarantee zero pixelation on Retina displays and zero bundle weight.
2. **Zero CDN Dependency**: All marketplace icons and brand assets are served locally from `frontend/` instead of external Google Favicon APIs, eliminating broken image placeholders and privacy leaks.
3. **Cache Policy**: `favicon.ico`, `logo.svg`, and `apple-touch-icon.png` in `frontend/public/` are served with immutable long-term caching headers (`Cache-Control: public, max-age=31536000, immutable`).
