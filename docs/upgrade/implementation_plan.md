# SheetFill Full Visual & UX Refinement & State Persistence Implementation Plan

**Project**: SheetFill (`cfradar/sheetfill`)  
**Target Environment**: React 18 + Vite + HeroUI + TailwindCSS + Zustand + IndexedDB / FastAPI + MongoDB  
**Author**: Antigravity Technical Architecture Agent  
**Date**: October 18, 2026  
**Status**: Ready for User Review (Strict Planning Mode — Zero Application Code Modified)  

---

## 1. Executive Summary & Goals

### High-Level Goals
1. **Calm, Spacious & Native UX**: Transform the workbench into a premium, tactile tool inspired by Linear, Vercel, Stripe, Apple VisionOS, Raycast, and Notion.
   - Eliminate boxed-card visual noise; establish hierarchy through 8pt spacing and crisp typography.
   - Set a minimum 13px body font size with WCAG AA contrast (>4.5:1).
   - Execute the 5-question "Text-to-Delete" decluttering test across every screen, stripping 150+ redundant words and badges.
2. **State Persistence Across Tabs & Refreshes**:
   - Zero work loss when toggling between **Sheet Filler** and **Keyword Agent**.
   - Modular slices (`sheetFiller` and `keywordAgent`) stored in a global Zustand store persisted to **IndexedDB**.
   - Keyword Agent background SSE stream runs independently in the store/service layer, accompanied by a live pulsating status dot on the tab.
   - Isolated "Reset" actions per tab with undo confirmation, plus a global "Reset All Workspaces" in the avatar menu.
3. **Refined Core Views**:
   - **Hero Dropzone**: Centered 440px hero with soft aurora gradient and Antigravity physics.
   - **Sheet Workspace**: Consolidated 1-action Magnet toolbar (`Generate .xlsm`), collapsible catalog defaults, true monospace code editor with line numbers, larger thumbnails, and uniform size pills.
   - **Keyword Agent**: Single-column clean form with color swatches, 4-stage horizontal pipeline with live connector and skeleton loaders, and single-viewport bento results dashboard.

---

## 2. File-by-File Change Plan

| Phase | Target File | Nature of Change | Key Changes & Specifications |
| :--- | :--- | :--- | :--- |
| **Phase 1: Persistence** | `frontend/src/store/idbStorage.ts` | **Create** | Asynchronous, zero-dependency IndexedDB storage engine implementing Zustand's `StateStorage` interface. |
| **Phase 1: Persistence** | `frontend/src/store.ts` | **Refactor** | Restructure into modular slices: `sheetFiller`, `keywordAgent`, and `activeSection`. Integrate `persist` middleware with `idbStorage`, schema versioning (`version: 1`), and `migrate` function. |
| **Phase 1: Persistence** | `frontend/src/features/keyword-agent/service/sseManager.ts` | **Create** | Module-level singleton managing the SSE streaming connection lifecycle outside React components. |
| **Phase 1: Persistence** | `frontend/src/auth/AuthGate.tsx` | **Refactor** | Maintain persistent views for `Sheet Filler` and `Keyword Agent` to prevent unmounting and preserve scroll/input state. |
| **Phase 1: Persistence** | `frontend/src/store/storePersistence.test.ts` | **Create** | Vitest automated suite verifying tab switching, refresh rehydration, isolated resets, and background streams. |
| **Phase 2: Navigation** | `frontend/src/ui/AppShell.tsx` | **Refactor** | 56px frosted glass top bar: vector logo on left, centered segmented tab switcher with sliding spring pill, live pulsating green dot on `Keyword Agent` during runs, avatar menu folding "360 days left", theme toggle, and "Reset All Workspaces" action. |
| **Phase 2: Navigation** | `frontend/src/index.css` | **Refactor** | Update semantic tokens for warm-neutral light (`#F8F9FA`) and obsidian dark (`#0E1015`), minimum 13px text, and WCAG AA contrast. |
| **Phase 3: Upload** | `frontend/src/components/UploadStep.tsx` | **Refactor** | Centered 440px hero dropzone with soft ambient aurora gradient, single headline ("Upload Flipkart Listing Sheet"), and quiet single-line capability badge. |
| **Phase 4: Workspace** | `frontend/src/workspace/StickyToolbar.tsx` | **Refactor** | Consolidated Magnet CTA (`Generate .xlsm`), slim progress element (`14 of 16 ready`), "Paste all JSON", and "More" dropdown. |
| **Phase 4: Workspace** | `frontend/src/components/GlobalBrandBar.tsx` | **Refactor** | Collapsible summary row (`Catalog Defaults: Brand · Packer · MRP · HSN`), borderless filled inputs with floating labels, tooltips for column hints. |
| **Phase 4: Workspace** | `frontend/src/components/JsonEditor.tsx` | **Refactor** | Genuine code-editor ergonomics: JetBrains Mono monospace, line numbers gutter, editor toolbar, and inline empty state with "Paste JSON" CTA. |
| **Phase 4: Workspace** | `frontend/src/workspace/DesignListSidebar.tsx` | **Refactor** | Larger preview thumbnails, 6px clean status dots, and sticky filter tabs (`All` / `Needs Info` / `Ready`). |
| **Phase 4: Workspace** | `frontend/src/workspace/DesignEditor.tsx` | **Refactor** | Uniform size selector pill group with spring animations and quiet counter (`4 rows will be generated`). |
| **Phase 5: Keyword Agent**| `frontend/src/features/keyword-agent/components/BriefForm.tsx` | **Refactor** | Single column with 24px vertical breathing room, consistent aligned selector groups, color swatches for colors, deleted redundant headings. |
| **Phase 5: Keyword Agent**| `frontend/src/features/keyword-agent/components/ProgressSteps.tsx` | **Refactor** | 4-stage horizontal stepper with live animated connector line, skeleton loaders, and collapsible streaming activity terminal. |
| **Phase 5: Keyword Agent**| `frontend/src/features/keyword-agent/components/ResultsPanel.tsx` | **Refactor** | Single-viewport 100vh bento grid with no nested scrollbars, Platform Treemap, Rating distribution bar (Bayesian score + 5★-1★ stacked bars), competitor listings, and slide-in `CompetitorDrawer`. |
| **Phase 6: QA** | Multi-Viewport Visual QA | **Validation** | Verify in browser at 1440px, 1024px, and 390px in both light and dark mode. Ensure zero horizontal scroll, Lighthouse 90+ performance, and 95+ accessibility. |

---

## 3. Phased Implementation Roadmap

### Phase 1: State Persistence & IndexedDB Store (Days 1–2)
1. Build `frontend/src/store/idbStorage.ts` implementing Zustand `StateStorage`.
2. Refactor `frontend/src/store.ts` into typed slices (`sheetFiller`, `keywordAgent`).
3. Build `frontend/src/features/keyword-agent/service/sseManager.ts` to manage the background SSE streaming lifecycle.
4. Update `frontend/src/auth/AuthGate.tsx` to keep both views mounted or cleanly rehydrated.
5. Create `frontend/src/store/storePersistence.test.ts` and verify 100% test passing.

### Phase 2: Navigation & Design Tokens Polish (Day 2)
1. Update `frontend/src/index.css` and `frontend/tailwind.config.js` with warm-neutral tokens and minimum 13px type scale.
2. Refactor `frontend/src/ui/AppShell.tsx`:
   - Centered segmented tab switcher (`Sheet Filler` | `Keyword Agent`) with sliding spring pill indicator.
   - Pulsating live-status dot on `Keyword Agent` tab when run is active.
   - User avatar dropdown folding "360 days left", theme toggle, and "Reset All Workspaces".

### Phase 3: Hero Upload Dropzone (Day 3)
1. Refactor `frontend/src/components/UploadStep.tsx`:
   - Hero dropzone taking center stage (440px).
   - Soft ambient aurora gradient background (smooth CSS radial wave).
   - Antigravity particle drag-and-drop interaction.
   - Single quiet capability line: `Supports .xlsm & .xls · Macro-safe · Max 25 MB`.

### Phase 4: Sheet Filler Workspace Refinement (Days 3–4)
1. `StickyToolbar.tsx`:
   - Single high-contrast Magnet CTA: `Generate .xlsm`.
   - Slim progress indicator: `14 of 16 ready`.
   - Group secondary tools into clean dropdown menu.
2. `GlobalBrandBar.tsx`:
   - Collapsible summary row with inline expansion and borderless filled inputs.
3. `JsonEditor.tsx`:
   - Monospace font (`JetBrains Mono`), line numbers gutter, toolbar actions, and inline empty state CTA.
4. `DesignListSidebar.tsx` & `DesignEditor.tsx`:
   - Larger thumbnails, 6px status dots, sticky filter tabs, and uniform size pill selector.

### Phase 5: Keyword Agent Form & Bento Dashboard (Days 4–5)
1. `BriefForm.tsx`:
   - Clean single column, color swatches, and aligned selector groups.
2. `ProgressSteps.tsx`:
   - 4-stage horizontal stepper with live animated connector, skeleton loaders, and collapsible activity terminal.
3. `ResultsPanel.tsx`:
   - Strict single-viewport 100vh bento grid for desktop (≥1280px).
   - Platform Treemap, Rating distribution bar (Bayesian weighted score + 5★ to 1★ stacked bars), and slide-in `CompetitorDrawer`.

### Phase 6: Multi-Viewport Verification & Acceptance (Day 5)
1. Execute multi-viewport checks at **1440px**, **1024px**, and **390px** in both **Light Mode** and **Dark Mode**.
2. Run `npm run test`, `npx tsc --noEmit`, and `npm run build`.
3. Verify zero horizontal scroll at 390px, full keyboard accessibility, and WCAG AA contrast.

---

## 4. Verification Checklists & Quality Gates

- [ ] **Lighthouse Target**: Performance 90+, Accessibility 95+ on Upload and Workspace screens.
- [ ] **Viewport Target**: Zero layout shift and zero horizontal scroll at 390px.
- [ ] **Contrast Target**: All text elements exceed 4.5:1 contrast ratio.
- [ ] **State Retention Target**: Toggling tabs or refreshing the browser preserves 100% of inputs, designs, and AI research results.
- [ ] **Reset Safety Target**: Tab-specific reset clears only its respective slice; global reset requires confirmation.
- [ ] **Test Target**: All backend tests (90 tests) and frontend tests pass cleanly before commit.
