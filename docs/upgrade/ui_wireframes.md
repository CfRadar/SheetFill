# SheetFill UI Redesign & Scraper Visualization Wireframes

This document provides complete visual architecture, ASCII wireframes, decluttering specifications, and React Bits integration maps for every page and component in the SheetFill application.

---

## 1. Global Visual Language: Liquid Glass & Physics

The upgraded visual language is **Liquid Glass (Glassmorphism 2.0)**:
- **Surface**: Ultra-thin frosted glass (`backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 border border-white/60 dark:border-white/10`).
- **Highlights**: 1px specular gradient top edge simulating physical refraction (`border-t border-white/40 dark:border-white/20`).
- **Depth**: Soft ambient diffusion shadows (`shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)]`).
- **Physics**: Tactile spring elasticity on interactive targets (buttons magnetically pull toward the cursor; cards tilt on hover).

### React Bits Integration Matrix

| Component | Category | Install Command | Where Used | Effect & Configuration |
| :--- | :--- | :--- | :--- | :--- |
| **`GlassSurface`** | Glass Surfaces | `npx @reactbits/cli add GlassSurface` | `DesignEditor.tsx`, `BriefForm.tsx`, `ReportPanel.tsx` | Dynamic refraction & backdrop blur for elevated cards |
| **`GlassIcons`** | Iconography | `npx @reactbits/cli add GlassIcons` | `StickyToolbar.tsx`, `PlatformPicker.tsx` | Translucent 3D-effect icon buttons with specular sheen |
| **`Magnet`** | Physics Interaction | `npx @reactbits/cli add Magnet` | "Generate Sheet", "Download", "Run Research" CTAs | Spring physics button snap that attracts to cursor hover |
| **`Antigravity`** | Kinetic Particles | `npx @reactbits/cli add Antigravity` | `UploadStep.tsx` (Empty Dropzone) | Microscopic floating particles reacting to cursor gravity |
| **`Aurora`** | Ambient Background | `npx @reactbits/cli add Aurora` | `AppShell.tsx` base canvas layer | Subtle chromatic wave background with zero CPU drain |
| **`SplitText`** | Typography | `npx @reactbits/cli add SplitText` | `LoginPage.tsx` headline, Section headers | Fluid staggered character reveal on mount |

---

## 2. Decluttering & Copy Removal Register

| Page / Component | Original Copy / Element Removed | Reason for Removal | Replacement / Upgraded Element |
| :--- | :--- | :--- | :--- |
| `UploadStep.tsx` | *"Upload your Flipkart T-shirt listing sheet here. Make sure it is in .xls or .xlsm format and contains design rows. Click to browse files from your computer or drag and drop."* (28 words) | Pure explanatory clutter. Standard drag-drop UI is universally understood. | *"Drop .xls or .xlsm here"* + subtle format badges |
| `GlobalBrandBar.tsx` | *"These brand, manufacturer and packer details will be automatically populated across all the detected product designs in your uploaded workbook."* (22 words) | Redundant with section title. Users know what global defaults do. | Clean header: **Global Brand Defaults** + *Applies to all designs* pill |
| `StickyToolbar.tsx` | Dual download buttons, duplicated status text ("X designs ready of Y total"). | Visual noise in sticky header. | Single high-contrast `Magnet` button + animated circular progress ring |
| `DesignEditor.tsx` | Multi-line instructions explaining how to paste JSON or enter image links. | Clutters active form fields. | Field placeholder text (`e.g. https://...`) and tooltip hints |
| `ReportPanel.tsx` | *"Zero-corruption master rebuild complete with 33 non-sheet parts 100% byte-identical."* | Overly technical internal jargon displayed to end-users. | Clean trust badge: `Verified 100% Intact` + direct action buttons |
| `BriefForm.tsx` | 34-word introductory paragraph explaining AI research capabilities. | Slows down power users. | Minimalist query input with pill suggestions (*Acid wash*, *Anime*, *Vintage*) |

---

## 3. Systematic Alignment & 8pt Grid Checklist

### Alignment Standards
- **Baseline Spacing Scale**: All padding, margin, and gap values MUST be multiples of 4px/8px (`4`, `8`, `12`, `16`, `24`, `32`, `48`).
- **Horizontal Margins**: `px-4 sm:px-6 lg:px-8` consistently across all pages.
- **Card Radius Hierarchy**: Inner controls: `rounded-lg` (8px); Outer containers: `rounded-2xl` (16px).
- **Icon Sizing Scale**: Micro: `14px` (`w-3.5 h-3.5`); Standard: `16px` (`w-4 h-4`); Hero: `24px` (`w-6 h-6`).

---

## 4. Page Redesigns & ASCII Wireframes

### Page 1: Upload Step (`UploadStep.tsx`)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Navbar: [Logo] SheetFill               [Section Switcher]      [Theme] [User│
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│               Flipkart Bulk Listing Automation                              │
│         Transform raw product JSONs into valid 4-size Excel listings        │
│                                                                             │
│      ┌───────────────────────────────────────────────────────────────┐      │
│      │ [Antigravity Canvas Particles in Background]                  │      │
│      │                                                               │      │
│      │                 ┌───────────────────────┐                     │      │
│      │                 │  [FileSpreadsheet]    │                     │      │
│      │                 └───────────────────────┘                     │      │
│      │                                                               │      │
│      │               Drop Flipkart .xls or .xlsm here                │      │
│      │                   or click to browse files                    │      │
│      │                                                               │      │
│      │           [ .XLS / .XLSM ]   [ Max 25 MB ]   [ 496 Rows ]     │      │
│      └───────────────────────────────────────────────────────────────┘      │
│                                                                             │
│               [or Start with Blank 8-Slot Template] (Text Link)             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Page 2: Workspace & Design Editor (`Workspace.tsx`)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Sticky Top Toolbar: [Slots: 8] [Progress: 6/8 Ready (75%)]  [+ Add Slot]    │
│                     [Bulk Paste JSON]            [Magnet: Generate Sheet]   │
├─────────────────────────────────────────────────────────────────────────────┤
│ Global Bar: Brand: [ UrbanTrend ] Manuf: [ Radhika Tex ] HSN: [ 610910 ]   │
├───────────────────────┬─────────────────────────────────────────────────────┤
│ Designs List (w-1/3)  │ Active Design Editor (w-2/3 Liquid Glass Card)      │
│ ┌───────────────────┐ │ ┌─────────────────────────────────────────────────┐ │
│ │ ● Design 1 [Ready]│ │ │ SKU: UT-OVR-BLK-01           Status: [Ready ✓]  │ │
│ │   UT-OVR-BLK-01   │ │ │ Title: Men Oversized Anime Printed Cotton Tee   │ │
│ ├───────────────────┤ │ ├─────────────────────────────────────────────────┤ │
│ │ ◐ Design 2 [Part.]│ │ │ Sizes: [x] S   [x] M   [x] L   [x] XL           │ │
│ │   UT-OVR-WHT-02   │ │ │ Images (4 Required):                            │ │
│ ├───────────────────┤ │ │ [ Front ]   [ Back ]   [ Detail ]   [ Tag ]     │ │
│ │ ○ Design 3 [Empty]│ │ ├─────────────────────────────────────────────────┤ │
│ │   No JSON pasted  │ │ │ [JSON Code Editor Drawer] [Paste Single JSON]   │ │
│ └───────────────────┘ │ └─────────────────────────────────────────────────┘ │
└───────────────────────┴─────────────────────────────────────────────────────┘
```

---

### Page 3: Single-Viewport Scraper Dashboard (`ResultsPanel.tsx`)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Header: Query: "oversized anime graphic tee"  Platforms: [All] [Flipkart]   │
│         [Live SSE Status: Idle]               [Export CSV] [Refine Brief]   │
├──────────────────────────────────────┬──────────────────────────────────────┤
│ Left Column: Recommendations & Titles│ Right Column: Hierarchy & Ratings    │
│ ┌──────────────────────────────────┐ │ ┌──────────────────────────────────┐ │
│ │ Tier 1: High Conviction (Score 90+)│ │ Platform Market Share Treemap    │ │
│ │  1. "oversized anime graphic tee"│ │ ┌────────────────┬───────────────┐ │ │
│ │     ★ 4.5 · 12,400 reviews · 94  │ │ │ Flipkart (54%) │ Amazon (28%)  │ │ │
│ │  2. "japanese streetwear tshirt" │ │ │                ├───────────────┤ │ │
│ │     ★ 4.3 · 8,200 reviews · 91   │ │ │                │ Myntra (18%)  │ │ │
│ ├──────────────────────────────────┤ │ └────────────────┴───────────────┘ │ │
│ │ Tier 2: Strong Opportunities     │ ├──────────────────────────────────┤ │
│ │  3. "vintage oversized tshirt"   │ │ Star Rating Distribution Spread  │ │
│ │     ★ 4.1 · 4,100 reviews · 83   │ │ 5★ [████████████████████] 62%    │ │
│ ├──────────────────────────────────┤ │ 4★ [████████] 22%                │ │
│ │ Composed Flipkart Titles (1-Click│ │ 3★ [██] 9%                       │ │
│ │  "Anime Printed Men Round Neck   │ │ 2★ [█] 4%                        │ │
│ │   Cotton Black Oversized T-Shirt"│ │ 1★ [█] 3%                        │ │
│ │   [ 68/80 Chars - Valid ] [Copy] │ │ Avg Star Rating: ★ 4.34 / 5.0    │ │
│ └──────────────────────────────────┘ │ └──────────────────────────────────┘ │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

### Zero-Scroll Drill-Down Interactions
1. **Treemap Cell Click**: Opens an instant, slide-in flyout drawer showing raw scraped competitor products.
2. **Title Card Click**: Opens an inline preview modal showing Flipkart character policy compliance checks.
3. **Responsive Mobile**: Switches automatically into 3 bottom-docked tabs (`Recommendations`, `Titles`, `Marketplace Analytics`).
