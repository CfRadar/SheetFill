# SheetFill Visual & UX Design Direction

**Project**: SheetFill (`cfradar/sheetfill`)  
**Document**: Design Direction Specification  
**Author**: Antigravity Technical Architecture Agent  
**Date**: October 18, 2026  
**Status**: Ready for User Review & Approval  

---

## 1. Executive Summary & Design Vision

SheetFill is an operational productivity workbench for e-commerce apparel sellers and catalog operations teams. Catalog managers spend multiple hours a day processing dozens of designs across Flipkart, Amazon, Myntra, and Meesho.

### The Problem With the Current UI
- **Excessive Card Boxes**: Every control, form section, and preview sits inside an identical bordered white/dark card, destroying visual hierarchy and creating cognitive fatigue.
- **Micro-Text & Low Contrast**: 10px–11px grey-on-grey text (`#8A91A5` on `#FFFFFF`) fails WCAG AA readability standards.
- **Badge Bloat**: Countless noisy pills ("360 days left", "MULTI-AGENT AI", "APPLIED ACROSS ALL T-SHIRTS", "2 LLM calls", "FLIPKAF") fight for attention.
- **Crowded Navigation**: Nav tabs squeezed into a tight pill next to the logo, and toolbars overloaded with 7 competing buttons.
- **State Loss on Tab Switch**: Switching between Sheet Filler and Keyword Agent unmounts components, kills active background SSE streams, and wipes uncommitted user entries.

### The New Direction: Calm, Spacious, Tactile & Native
Taking inspiration from industry-defining tools (Linear, Vercel, Stripe, Apple VisionOS, Raycast, and Notion), SheetFill is shifting to a **spacious, warm-neutral, command-grade workbench**:
1. **Hierarchy Through Space & Typography**: Replace boxed cards with 8pt-spaced semantic groupings, soft tonal shifts, and clear type scale.
2. **Generous Breathing Room & Hero Focus**: The upload dropzone is a bold, magnetic hero. Form fields breathe with 16px/24px padding.
3. **Restrained Liquid Glass**: Frosted specular glassmorphism (`backdrop-blur-xl`, `border-white/10`) reserved strictly for the 56px sticky top bar, command menus, and floating actions.
4. **Single-Accent Indigo**: Deep, saturated indigo (`#4F46E5` / `#6366F1`) solely for the primary interaction path and active selections.
5. **Indestructible State**: Zero work is ever lost. All inputs, design edits, and running AI pipelines persist across tabs and browser restarts via IndexedDB.

---

## 2. Reference Study & Extracted Principles

| Reference Product | Visual & Interaction Strengths | What Makes It Feel Premium | Extracted SheetFill Principles |
| :--- | :--- | :--- | :--- |
| **Linear** (`linear.app`) | Restraint, hairline borders (`border-white/10`), obsidian dark mode, tight typography, keyboard shortcuts. | Crisp precision, zero superfluous decoration, instantaneous interaction feedback, command palette (`⌘K`). | Hairline 1px borders, subtle hover glows, centralized command bar, dark mode depth (`#0B0F19` canvas, `#141721` surface). |
| **Vercel** (`vercel.com`) | Monochromatic Swiss minimalism, strict grid rhythm, high contrast, Geist Mono technical accents. | Uncompromising typography, clean whitespace, data presented with quiet confidence, absence of marketing clutter. | Pure semantic typography (Inter + JetBrains Mono), tight tables, high-contrast text (>7:1 ratio), muted secondary badges. |
| **Stripe** (`stripe.com`) | High data density that remains calm, soft layered shadows, flawless empty states, fluid tables. | Micro-rounded containers (`rounded-xl`), soft colored drop shadows, legible status pills, beautiful syntax blocks. | Collapsible catalog defaults, clean tabular numeral layout, subtle status dots instead of noisy status badges. |
| **Apple VisionOS** (`apple.com/visionos`) | Spatial depth, frosted glass materials, specular lighting, generous whitespace, circular pill controls. | Translucent surfaces that pick up context without blurring into illegibility, physical spring physics. | Glassmorphic sticky top bar, specular top highlights (`border-t border-white/20`), gentle spring physics on selectors. |
| **Raycast & Arc** (`raycast.com`) | Refined command toolbars, keyboard shortcut badges (`↩`, `⌘K`), snappy micro-interactions. | Tactile responsiveness, single dominant action, secondary tools neatly folded into contextual submenus. | Consolidated Magnet CTA (`Generate .xlsm`), secondary tools grouped in clean dropdown / command palette. |
| **Notion & Things 3** (`notion.so`) | Warm paper-like surfaces, human and calm aesthetic, zero visual noise, organic hierarchy. | Neutral tones that soothe eye strain during long working sessions, clean form rows without heavy borders. | Warm canvas palette (`#F8F9FA` light / `#121316` dark), borderless filled inputs with floating labels, decluttered copy. |

---

## 3. Design Tokens & Color Palettes

### 3.1 Color Tokens (Semantic & Warm-Neutral)

```css
/* Light Mode (Warm Minimalist Workbench) */
:root {
  --bg-canvas: #F8F9FA;         /* Warm paper base */
  --bg-surface: #FFFFFF;        /* Elevated card / sidebar */
  --bg-subtle: #F1F3F5;         /* Subtle grouping containers */
  --bg-hover: #E9ECEF;          /* Hover states */
  --border-hairline: #E2E4E8;   /* 1px subtle hairline border */
  --border-focus: #4F46E5;      /* High-contrast focus ring */
  
  --text-primary: #111827;      /* High-contrast text (14:1) */
  --text-secondary: #4B5563;    /* Readable secondary body (6.5:1) */
  --text-muted: #6B7280;        /* Muted captions (4.8:1 WCAG AA) */
  
  --brand-primary: #4F46E5;     /* Saturated Indigo */
  --brand-hover: #4338CA;       /* Deep Indigo */
  --brand-subtle: #EEF2FF;      /* Indigo tint background */
  
  --status-success: #059669;    /* Verified / Ready */
  --status-warning: #D97706;    /* Needs Info */
  --status-danger: #DC2626;     /* Error / Missing */
}

/* Dark Mode (Obsidian Precision) */
.dark {
  --bg-canvas: #0E1015;         /* Deep obsidian canvas */
  --bg-surface: #151821;        /* Elevated work surface */
  --bg-subtle: #1C202B;         /* Grouping & code containers */
  --bg-hover: #242937;          /* Hover states */
  --border-hairline: #282D3D;   /* 1px hairline border */
  --border-focus: #6366F1;      /* Bright indigo focus */
  
  --text-primary: #F9FAFB;      /* Crisp text (16:1) */
  --text-secondary: #D1D5DB;    /* Secondary text (9.5:1) */
  --text-muted: #9CA3AF;        /* Captions (5.8:1 WCAG AA) */
  
  --brand-primary: #6366F1;     /* Vibrant Indigo */
  --brand-hover: #4F46E5;       /* Hover Indigo */
  --brand-subtle: rgba(99, 102, 241, 0.14);
  
  --status-success: #10B981;    /* Ready / Valid */
  --status-warning: #F59E0B;    /* In progress */
  --status-danger: #EF4444;     /* Error */
}
```

### 3.2 Typography Scale & Font Pairing
- **Primary UI Font**: `Inter`, `-apple-system`, `BlinkMacSystemFont`, `sans-serif`.
  - Feature settings: `'cv02', 'cv03', 'cv04', 'cv11'` (clean tabular figures & rounded glyphs).
- **Code & Technical Font**: `JetBrains Mono`, `ui-monospace`, `monospace`.
  - Used for: Product JSON, SKUs, HSN codes, row indexes, and pricing numbers.

| Token | Size | Line Height | Weight | Usage |
| :--- | :--- | :--- | :--- | :--- |
| `text-2xl` | 24px | 32px | 700 (Bold) | Hero dropzone title, modal headers |
| `text-xl` | 20px | 28px | 600 (Semibold) | Section headers, workspace title |
| `text-lg` | 18px | 26px | 600 (Semibold) | Card group titles, preview headings |
| `text-base` | 16px | 24px | 500 (Medium) | Primary input labels, prominent buttons |
| `text-sm` | 14px | 20px | 400 / 500 | Default body text, form fields, descriptions |
| `text-xs` | 13px | 18px | 500 (Medium) | Secondary labels, table data, toolbars (**minimum body size**) |
| `text-[11px]`| 11px | 14px | 600 (Semibold) | Micro badges, status pills, shortcuts (strictly uppercase/tabular) |

---

## 4. Spacing, Radii & Grid System

- **8pt Grid Multiples**: All paddings, margins, and gaps strictly use `4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`.
  - Controls & Inputs: `h-10` (40px) or `h-9` (36px).
  - Radii Scale:
    - Inner controls & buttons: `rounded-xl` (12px).
    - Work cards & editors: `rounded-2xl` (16px).
    - Top nav & floating bars: `rounded-2xl` (16px) or full pill (`rounded-full`).
- **Surface Elevation Hierarchy**:
  - `Level 0 (Canvas)`: Flat neutral background (`--bg-canvas`).
  - `Level 1 (Subtle Paneling)`: Grouping areas (`--bg-subtle`), 0px shadow, 1px hairline border.
  - `Level 2 (Work Cards)`: Surface layer (`--bg-surface`), `shadow-xs`, 1px hairline border.
  - `Level 3 (Sticky Nav & Modals)`: Liquid-glass layer (`backdrop-blur-xl`), `shadow-md`, `border-t border-white/20`.

---

## 5. Component Specifications & Redesigns

### 5.1 Top Navigation Bar (56px)
- **Left**: Clean vector logo (`/logo.svg`) + "SheetFill" wordmark.
- **Center**: Centered segmented tab switcher (`Sheet Filler` | `Keyword Agent`):
  - Sliding active pill background with spring physics (`framer-motion` layoutId).
  - Running job indicator: Subtle pulsating emerald dot on `Keyword Agent` when an AI pipeline is executing.
- **Right**:
  - Theme toggle (Sun / Moon icon with spring transition).
  - User avatar with dropdown menu containing:
    - Account profile & Subscription expiration info ("Expires in 360 days" cleanly folded inside).
    - Separator.
    - Global "Reset All Workspaces" action with confirmation dialog.
    - Log out action.

### 5.2 Upload Screen: Hero Dropzone
- **Layout**: Centered, expansive hero dropzone taking up 440px height.
- **Background**: Soft ambient aurora gradient mesh (smooth CSS radial wave, low CPU).
- **Copy**:
  - Headline: **"Upload Flipkart Listing Sheet"** (24px semibold).
  - Subtitle: **"Drop your .xlsm or .xls workbook to automatically extract and populate designs"** (14px neutral).
  - Single quiet line beneath: `Supports .xlsm & .xls · Macro-safe · Max 25 MB`.
- **Drag Interaction**: Dropzone subtly scales (`scale-[1.01]`), border illuminates with indigo glow, and Antigravity particles gently attract toward cursor.

### 5.3 Workspace: Sticky Toolbar & Catalog Defaults
- **Toolbar**: Consolidates 7 controls into **1 dominant action**:
  - Primary CTA: **"Generate .xlsm"** (High-contrast Indigo Magnet button with progress glow).
  - Left: Sheet filename chip + slim progress bar (`14 of 16 ready`).
  - Right: "Paste all JSON" flat button + "More Actions" dropdown (Add slots, Prompt settings, New sheet).
- **Catalog Defaults**:
  - Replaces heavy card with an elegant, collapsible summary row:
    - Folded state: `Catalog Defaults: Brand "UrbanStyle" · Packer "StyleCorp" · MRP ₹1,999 · ₹749 · HSN 61091000` + "Edit" chevron.
    - Expanded state: Clean grid of borderless filled inputs with floating labels; column hints moved into info tooltips.

### 5.4 Product JSON Code Editor
- **Container**: Elevated dark/light editor frame with genuine code-editor ergonomics.
- **Features**:
  - Monospace font (`JetBrains Mono`, 13px, line-height 1.6).
  - Left gutter with dynamic line numbers.
  - Embedded toolbar: Status chip, "Copy Template" button, "Format & Repair JSON" button.
  - Inline empty state: When empty, displays a clean dashed dropzone with a prominent **"Paste JSON"** button and quick-insert sample snippet.

### 5.5 Design Sidebar & Size Selector
- **Design List**:
  - Larger preview thumbnails with rounded corners.
  - Status represented by a clean 6px colored dot (Emerald = Ready, Amber = Pending, Red = Error) instead of bulky text pills.
  - Sticky filter tabs: `All (16)` | `Needs Info (2)` | `Ready (14)`.
- **Size Selector**:
  - Uniform horizontal pill group (`S`, `M`, `L`, `XL`, `XXL`).
  - Active sizes highlighted in solid Indigo with spring selection ring.
  - Quiet counter badge: `"4 rows will be generated"`.

### 5.6 Keyword Agent: Form & Bento Results Dashboard
- **Form**:
  - Clean single column with 24px vertical breathing room.
  - Color swatches for color selection (Black, White, Navy, Olive, Maroon, etc.) alongside text.
  - Consistent aligned pill groups for T-shirt styles and target marketplaces.
- **In-Progress Pipeline View**:
  - 4-stage horizontal stepper (`Planner` → `Marketplace Scraper` → `Social Scraper` → `AI Analyst`).
  - Real-time animated progress connector line.
  - Collapsible streaming activity terminal for deep logs.
- **Single-Viewport Bento Results**:
  - Strict `h-[calc(100vh-140px)] overflow-hidden` grid on desktop (≥1280px).
  - Zero truncated labels: Full marketplace headers with official favicons.
  - Interactive Treemap for marketplace share.
  - Stacked horizontal rating distribution bar (5★ down to 1★).
  - Slide-in `CompetitorDrawer` for deep-dive inspections.

---

## 6. Motion & Physics Specification

### 6.1 React Bits Low-Level Components
Installed or embedded cleanly via low-level vanilla/Framer-Motion implementations:
1. `Magnet`: Interactive spring snap on primary buttons (`Generate .xlsm`, `Paste JSON`, `Start Research`). Pulls 4px towards mouse hover on desktop.
2. `Aurora`: Subtle ambient canvas gradient on the Upload screen background.
3. `Antigravity`: Kinetic particle physics reacting to file drag & drop.
4. `GlassSurface`: Frosted specular glass container on the top navbar, floating toolbar, and modal dialogs.
5. `SplitText`: Subtle letter fade-in for section hero titles.

### 6.2 Physics Curves & Accessibility
- **Standard Transition**: `cubic-bezier(0.16, 1, 0.3, 1)` (Apple/Linear ease-out spring), 200ms duration.
- **Micro-Scale**: `active:scale-[0.98]` on all clickable buttons.
- **Prefers Reduced Motion**: Automatically detected via CSS media query:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, ::before, ::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
      transform: none !important;
    }
  }
  ```
- **Low-Power Viewports (<768px)**: Canvas particle simulations and backdrop filters are disabled, falling back to static neutral backgrounds.

---

## 7. The "Text-to-Delete" Decluttering Manifest

| Current Screen | Redundant / Verbose Text to Remove | Reason for Removal | Clean Replacement |
| :--- | :--- | :--- | :--- |
| **Top Navbar** | "360 days left" green badge in top navbar | Clutters the top navigation; irrelevant during minute-to-minute editing | Moved inside user avatar menu: "Subscription: 360 days remaining" |
| **Top Navbar** | "FLIPKART SHEET FILLER" redundant title label | Brand logo already identifies the application | Modern vector logo + "SheetFill" wordmark |
| **Upload Screen** | "Drop your Flipkart Excel listing sheet or click to browse... Supports .xls, .xlsm, .xlsx (up to 25 MB)... 4 S-XL rows / design... Macro-safe preserve" | 4 overlapping badges and 3 sentences repeat the same concept | Single headline + subline: "Upload Flipkart Listing Sheet" / "Supports .xlsm & .xls · Macro-safe · Max 25 MB" |
| **Catalog Defaults** | "Catalog Defaults: Global values applied across all designs in this sheet. You can edit individual values per design below. (Col AG, Col AH...)" | 34 words of instructional filler explaining standard input fields | Collapsible row: "Catalog Defaults: Brand · Packer · MRP · HSN (Click to edit)" |
| **JSON Editor** | "Product Specification JSON" and "Product JSON" stacked together | Duplicate titles stacked on top of each other | Single clean title: "Product Specification JSON" |
| **JSON Editor** | "Paste raw JSON containing product_title, description, etc." | Standard code editor placeholder is self-evident | Empty state CTA button: "Paste JSON" |
| **Sticky Toolbar** | "Generate .xls", "Download .xls", "Paste all JSON", "Add slots", "New sheet", "Prompt" | 7 buttons crowding the top bar | 1 Primary Magnet CTA: "Generate .xlsm" + "More" dropdown menu |
| **Keyword Agent** | "Target Marketplaces" repeated twice in form and section | Repetitive heading | Single clean section: "Target Marketplaces" |
| **Keyword Agent** | "MULTI-AGENT AI", "2 LLM calls used", "RESEARCH READY" | Boastful badges adding visual clutter without utility | Quiet technical counter in results bar: "2 LLM calls" |
