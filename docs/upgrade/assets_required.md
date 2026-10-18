# SheetFill Asset Inventory & Logo Specification

This document details the visual branding, logo discovery findings, and full asset inventory for the SheetFill application.

---

## 1. Project Logo Discovery & Findings

### Discovery Process
A recursive file search was conducted across `flipkart-tshirt-filler/frontend/`, `templates/`, `docs/`, and `.agent/` for standard logo and icon formats (`.svg`, `.png`, `.ico`, `.webp`).

### Findings
1. **No Static Logo File Exists in Frontend**:
   - `frontend/public/` does not exist.
   - `index.html` has no `<link rel="icon">` declared.
   - `AppShell.tsx` renders an inline CSS square with a Lucide SVG icon:
     ```tsx
     <div className="w-8 h-8 rounded-[8px] bg-primary flex items-center justify-center font-bold text-xs text-white shadow-xs shrink-0">
       <Sparkles className="w-4 h-4" />
     </div>
     ```
2. **Prototype Visual Artifact Found**:
   - A generated hero graphic exists in `frontend/assets/Fast Document Sparkle Icon.png` (1024x1024 PNG, 1,034,334 bytes).
3. **Requirement**:
   - Create `frontend/public/` and deploy a dedicated scalable vector logo (`logo.svg`) and favicon (`favicon.ico`) featuring the modern liquid-glass SheetFill branding mark (a frosted spreadsheet grid merging with an AI sparkle).

---

## 2. Complete Asset Requirements Matrix

| Asset Name | Target File Path | Purpose / Description | Expected Dimensions | Format | Usage Location | Status | Action Required |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Primary Logo** | `frontend/public/logo.svg` | Main brand mark for navbar and login | 32x32 / 64x64 | SVG | `AppShell.tsx`, `LoginPage.tsx` | **Missing** | Generate SVG vector asset with liquid-glass gradient mark |
| **Browser Favicon** | `frontend/public/favicon.ico` | Browser tab identifier | 32x32 | ICO / PNG | `index.html` | **Missing** | Create multi-size ICO (16x16, 32x32) from logo |
| **Apple Touch Icon** | `frontend/public/apple-touch-icon.png` | iOS mobile bookmark icon | 180x180 | PNG | `index.html` | **Missing** | Generate high-res rounded touch icon |
| **Empty Sheet Visual** | `frontend/src/assets/empty-sheet.svg` | Zero detected designs state illustration | 280x180 | SVG | `EmptyState.tsx` | **Missing** (currently raw Lucide icon) | Create subtle frosted glass vector illustration |
| **No-Keywords Visual** | `frontend/src/assets/empty-keywords.svg` | Empty search state illustration | 280x180 | SVG | `KeywordAgentPage.tsx` | **Missing** | Create minimalist glass radar vector |
| **Flipkart Master Template** | `templates/Flipkart_TShirt_Template.xlsm` | Zero-corruption master listing workbook | N/A | XLSM (Binary Zip) | Backend rebuild engine (`writer.py`) | **Present** (527,144 bytes) | Verified intact; preserve all 33 non-sheet parts |
| **Hero Feature Splash** | `frontend/assets/Fast Document Sparkle Icon.png` | High-res marketing/login visual | 1024x1024 | PNG | `LoginPage.tsx` hero card | **Present** (1,034,334 bytes) | Compress to WebP (< 80 KB) for fast web delivery |
| **Platform Logos** | `frontend/src/assets/platforms/*.svg` | Amazon, Flipkart, Myntra, Meesho logos | 20x20 | SVG | `PlatformPicker.tsx`, `ResultsPanel.tsx` | **Missing** (currently plain text chips) | Add clean monochrome SVG platform marks |

---

## 3. Asset Optimization & Delivery Specifications

1. **Vector First**: All logos, icons, and state graphics must be clean SVGs to eliminate pixelation on Retina/HiDPI displays and guarantee bundle sizes under 10 KB.
2. **WebP Compression**: Convert `Fast Document Sparkle Icon.png` to `hero-splash.webp` using quality 80 compression:
   - Original: `1,034 KB`
   - Target WebP: `< 75 KB` (92% bandwidth reduction)
3. **Public Directory Setup**:
   Ensure `frontend/public/` is tracked in Git with:
   - `favicon.ico`
   - `logo.svg`
   - `apple-touch-icon.png`
   - `robots.txt`
