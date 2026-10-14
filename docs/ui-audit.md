# Frontend UI Audit & Transformation Specification

This document provides a comprehensive audit of all controls, the component tree, and a before/after screen mapping for the redesign of the Flipkart Sheet Filler application.

---

## 1. Feature Inventory of Current UI Controls

| Screen / Component | Control | Action / Purpose | Owning File | Redesign Destination |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | Role Tabs | Switch between "Subscriber Login" and "Owner / Admin" | `LoginPage.tsx` | **Removed** (unified single login form) |
| **Auth** | Username Input | Enters username for auth | `LoginPage.tsx` | HeroUI `Input` (unified) |
| **Auth** | Password Input | Enters password for auth | `LoginPage.tsx` | HeroUI `Input` (type password) |
| **Auth** | Show/Hide Toggle | Toggles password visibility | `LoginPage.tsx` | HeroUI `Input` `endContent` button |
| **Auth** | Sign in Button | Submits credentials | `LoginPage.tsx` | HeroUI `Button` with `isLoading` |
| **Auth** | Session Replaced Banner | Displays warning when session kicked elsewhere | `LoginPage.tsx` | HeroUI `Alert` (amber, conditional only) |
| **Auth** | Error Banner | Displays invalid credentials or server errors | `LoginPage.tsx` | HeroUI `Alert` or inline field error |
| **Cold Start** | Wake-up Progress | Displays 50s countdown while Render wakes | `ServerWakeScreen.tsx` | Non-blocking inline card progress on `LoginPage` |
| **Header** | Logo & Title | Brand display | `App.tsx` | `AppShell.tsx` |
| **Header** | Subtitle | "Zero-corruption surgical .xls generator" | `App.tsx` | **Removed** |
| **Header** | Prompt Dropdown | Menu of pre-written ChatGPT/Gemini prompts | `PromptDropdown.tsx` | HeroUI `Dropdown` in action bar |
| **Header** | "New Sheet" Button | Resets session to upload screen | `App.tsx` | HeroUI `Button` with confirm `Modal` |
| **Upload** | Drag & Drop Zone | Accepts `.xls`, `.xlsm`, `.xlsx` files | `UploadStep.tsx` | HeroUI `Card` + centered Dropzone |
| **Upload** | File Browser Trigger | Native file dialog | `UploadStep.tsx` | HeroUI `Button` |
| **Upload** | Error Banner | Rejection message for invalid files | `UploadStep.tsx` | HeroUI `Alert` inline |
| **Summary Bar** | File Name & Badges | Displays original filename & count | `SummaryBar.tsx` | Sticky Toolbar Chip |
| **Summary Bar** | Ready / Needs JSON Chips | Summary counts of design statuses | `SummaryBar.tsx` | `Progress` bar ("3 of 8 ready") |
| **Summary Bar** | Add Slots Input/Btn | Adds additional empty design slots | `SummaryBar.tsx` | `Add design` Popover with number input |
| **Summary Bar** | Generate .xls Button | Triggers backend workbook generation | `SummaryBar.tsx` | Primary HeroUI `Button` (toolbar) |
| **Generate Bar** | Mode Switch / Radio | `all_or_nothing` vs `ready_only` | `GenerateBar.tsx` | HeroUI `Switch` / Toolbar setting |
| **Generate Bar** | Floating Generate Btn | Redundant trigger for generation | `GenerateBar.tsx` | Consolidated into single sticky Toolbar button |
| **Design List** | Card Stack | Long vertical list of design cards | `App.tsx` / `DesignCard.tsx` | Master-Detail left sidebar (320px) |
| **Design Card** | Status Badge | Displays Ready, Needs JSON, or Invalid | `DesignCard.tsx` | HeroUI `StatusChip` (color + icon) |
| **Design Card** | Delete Design Button | Removes design slot from session | `DesignCard.tsx` | Contextual action button / icon |
| **Design Card** | Size Toggle Chips | Multi-select toggle for S, M, L, XL, etc. | `DesignCard.tsx` | HeroUI `CheckboxGroup` (chip presentation) |
| **Design Card** | JSON Textarea | Monospace input for Flipkart product JSON | `JsonEditor.tsx` | HeroUI `Textarea` (primary editor section) |
| **Design Card** | Skeleton Generator Btn | Fills default JSON skeleton | `JsonEditor.tsx` | HeroUI `Button` ("Fill template skeleton") |
| **Design Card** | Paste Clipboard Btn | Reads text directly from OS clipboard | `JsonEditor.tsx` | HeroUI `Button` ("Paste") |
| **Design Card** | Format / Repair Btn | Sanitizes trailing commas, smart quotes | `JsonEditor.tsx` | HeroUI `Button` ("Repair & format") |
| **Design Card** | Next Design Button | Saves and advances to next design card | `DesignCard.tsx` | HeroUI `Button` + `Ctrl+Enter` shortcut |
| **Design Card** | Brand & HSN Section | Inputs for Brand, Manufacturer, HSN | `BrandMetaEditor.tsx` | Collapsed row + HeroUI `Modal` / Accordion |
| **Design Card** | Apply to All Switch | Copies Brand/HSN across all designs | `BrandMetaEditor.tsx` | HeroUI `Switch` ("Apply to all designs") |
| **Design Card** | Image URLs Section | Inputs for AU..BA image links | `ImageLinksEditor.tsx` | Collapsed row + HeroUI `Modal` |
| **Design Card** | Preview Rows Toggle | Opens table showing generated Excel rows | `RowsPreview.tsx` | Collapsible section / Drawer preview |
| **Bulk Paste** | "Paste all JSON" Trigger | Opens bulk assignment modal | `SummaryBar.tsx` | Secondary HeroUI `Button` in toolbar |
| **Bulk Paste** | Raw JSON Textarea | Accepts array of product JSONs | `BulkPasteDialog.tsx` | HeroUI `Textarea` inside `Modal` |
| **Bulk Paste** | Match Review List | Displays fuzzy matched pairs | `BulkPasteDialog.tsx` | HeroUI `Table` / Match review rows |
| **Bulk Paste** | Confirm Matches Btn | Commits assignments to session | `BulkPasteDialog.tsx` | Primary HeroUI `Button` |
| **Report** | Generation Summary Modal | Displays SKUs generated and download link | `ReportPanel.tsx` | HeroUI `Modal` + Toast notification |
| **Admin** | Navigation Tabs | Switches between Overview, Users, Activity | `AdminDashboard.tsx` | HeroUI `Tabs` (`underlined`, primary) |
| **Admin** | Metric Stat Cards | Displays total, active, expiring, online | `AdminDashboard.tsx` | HeroUI `Card` with `Skeleton` |
| **Admin** | Refresh Metrics Btn | Re-fetches statistics | `AdminDashboard.tsx` | HeroUI `Button` (icon only) |
| **Admin** | User Search Input | Filters users by username/notes | `AdminDashboard.tsx` | HeroUI `Input` with search icon |
| **Admin** | User Status Select | Filters by active, expired, disabled | `AdminDashboard.tsx` | HeroUI `Select` |
| **Admin** | "Create user" Button | Opens subscriber provisioning modal | `AdminDashboard.tsx` | Primary HeroUI `Button` |
| **Admin** | Create User Modal | Form for new subscriber creation | `AdminDashboard.tsx` | HeroUI `Modal` with duration `Select` |
| **Admin** | Copy Credentials Btn | Copies formatted login info to clipboard | `AdminDashboard.tsx` | HeroUI `Snippet` / `Button` + Toast |
| **Admin** | User Table Actions | Dropdown for extend, password, logout, delete | `AdminDashboard.tsx` | HeroUI `Dropdown` with `DropdownMenu` |
| **Admin** | Activity Log Filter | Filters audit events by event type | `AdminDashboard.tsx` | HeroUI `Select` / `Input` |
| **Admin** | Activity Table | Paginated list of audit events | `AdminDashboard.tsx` | HeroUI `Table` with `Pagination` |

---

## 2. Current Component Tree vs. Redesigned Tree

### Current Component Tree
```
main.tsx
└── AuthGate.tsx
    ├── [Loading] ServerWakeScreen.tsx (blocking full-screen overlay)
    ├── [Unauthenticated] LoginPage.tsx
    │   ├── Tabs ("Subscriber Login" | "Owner / Admin")
    │   └── Form (Inputs, banners, buttons)
    ├── [Admin Role] AdminDashboard.tsx
    │   ├── Header (Dark bar with title, open app btn, logout)
    │   ├── Overview Tab (6 cards, banner)
    │   ├── Users Tab (Search, filter, table, modals)
    │   └── Activity Tab (Table, filters)
    └── [Subscriber Role] App.tsx
        ├── Header (Dark bar with FK logo, title, subtitle, prompt dropdown, new sheet)
        ├── UploadStep.tsx (if no session)
        └── Workspace (if session active)
            ├── SummaryBar.tsx (file chip, counts, add slots, generate button)
            ├── Long scroll of DesignCard.tsx (stacked vertically)
            │   ├── Size chips
            │   ├── JsonEditor.tsx
            │   ├── BrandMetaEditor.tsx
            │   ├── ImageLinksEditor.tsx
            │   └── RowsPreview.tsx
            ├── GenerateBar.tsx (floating bottom bar)
            ├── BulkPasteDialog.tsx (modal)
            └── ReportPanel.tsx (modal)
```

### Redesigned Component Tree
```
main.tsx
└── HeroUIProvider (with ThemeProvider)
    └── AuthGate.tsx
        ├── [Unauthenticated] LoginPage.tsx
        │   ├── HeroUI Card (Single unified sign-in form)
        │   └── Inline Wake Status (Non-blocking progress, only if waking)
        ├── [Authenticated] AppShell.tsx (Unified Top Bar)
        │   ├── Logo & "Sheet Filler"
        │   ├── Days Left Chip (dynamic color)
        │   ├── ThemeToggle (Light / Dark / System)
        │   └── UserMenu (Avatar, Display Name, Logout)
        │
        ├── [Admin View] AdminPortal.tsx
        │   ├── HeroUI Tabs (Overview | Users | Activity)
        │   ├── OverviewSection (6 Metric Cards + Skeletons, auto-refresh)
        │   ├── UsersSection (Search, Status Filter, Create Button, Table, Action Menus)
        │   │   ├── CreateUserModal (Duration presets, auto-password)
        │   │   └── ExtendAccessModal / ConfirmModals
        │   └── ActivitySection (Event filter, Table, Pagination)
        │
        └── [Subscriber View] Workspace.tsx
            ├── UploadCard.tsx (if no session active: single clean centered card)
            └── MasterDetailLayout.tsx (if session active)
                ├── StickyToolbar.tsx
                │   ├── File Chip ("1.xls") & Design Count
                │   ├── ProgressBar ("3 of 8 ready", animated)
                │   ├── Paste all JSON Button (Modal trigger)
                │   ├── Prompt Dropdown
                │   ├── Add Design Popover (Number input + Add)
                │   ├── New Sheet Button (with Unsaved Confirm Modal)
                │   └── Primary Generate .xls Button (with Tooltip & Loading)
                │
                ├── Left Column (320px Sticky Design Sidebar)
                │   ├── Tabs Filter (All | Needs JSON | Ready)
                │   └── DesignList (Thumbnail, Name, Row, Size summary, StatusChip, keyboard nav)
                │
                └── Right Column (Active Design Editor)
                    ├── EditorHeader (Thumbnail, Name, Row, StatusChip, Prev/Next buttons)
                    ├── SizeSelector (HeroUI Multi-select chips: S, M, L, XL, etc.)
                    ├── JsonEditorSection (Monospace textarea, Live validation chip, Paste, Repair, Next design)
                    ├── BrandMetaRow (Collapsed summary + Edit modal/accordion)
                    └── ImagesRow (Collapsed thumbnail strip + Edit modal)
```

---

## 3. Before & After Screen Mapping

### Screen 1: Login Screen
* **Before**:
  - Full-screen dark gradient background with decorative blur circles.
  - Two prominent tabs: "Subscriber Login" and "Owner / Admin".
  - Subtitle: "Zero-corruption listing automation system".
  - Warning banner: "Single active device session strictly enforced".
  - Blocking full-screen 50s Render wake screen if backend is sleeping.
* **After**:
  - Minimalist centered HeroUI `Card` on unified light/dark surface.
  - Single header: "Sign in". Single unified form for both subscribers and admin.
  - Clean `Username` and `Password` inputs with eye icon show/hide.
  - Primary full-width `Button` ("Sign in") with loading spinner.
  - Non-blocking inline wake indicator beneath the card ("Starting server... [progress bar]") only if backend is booting.
  - Footnote: "Need an account? Contact the owner."

### Screen 2: Upload Screen
* **Before**:
  - Generic dashed box with multiple paragraphs of text, technical column explanations, and mixed dark/light headers.
* **After**:
  - Centered HeroUI `Card` with large intuitive dropzone.
  - Primary text: "Drop your sheet here or browse", accepting `.xls` and `.xlsx`.
  - When a file is chosen, shows a file `Chip` and an animated `Progress` bar during analysis.
  - Smooth 200ms page fade into the workspace on completion.

### Screen 3: Workspace Layout
* **Before**:
  - A long vertical stack of up to 124 massive cards. The user must scroll hundreds of pixels per card.
  - Redundant top `SummaryBar` and bottom floating `GenerateBar`.
  - Mixed column letter labels ("Col Y", "Col AG", "Col AU..BA").
  - Technical helper text everywhere.
* **After**:
  - **Master-Detail Workspace**: Left sidebar (320px) lists all designs with quick filters (All, Needs JSON, Ready) and arrow key navigation.
  - Right panel focuses on the selected design.
  - **Progressive Disclosure**: Product JSON is primary and visible. Brand, HSN, and Images are collapsed into compact one-line summary rows.
  - Top sticky toolbar combines filename, progress bar ("3 of 8 ready"), actions, and the single primary `Generate .xls` button.
  - On mobile (<1024px), sidebar collapses into a drawer or horizontal carousel.

### Screen 4: Admin Portal
* **Before**:
  - Mixed dark header, large blue banner ("Need to create or renew subscriber access?"), "cached with 15s refresh" technical label.
  - "Open Sheet Filler App" button that fails because admin tokens cannot access subscriber routes.
  - Browser `alert()` and `confirm()` dialogs.
* **After**:
  - Clean `AppShell` with title "Admin".
  - Clean HeroUI `Tabs`: Overview, Users, Activity.
  - 6 Stat cards with `Skeleton` loaders and silent background refresh every 15s.
  - Users table with clean badge statuses, relative expiration ("in 29 days"), and a unified 3-dots action menu.
  - Create user modal with preset duration chips (7d, 30d, 90d, 365d) and formatted credentials snippet.
  - All alerts replaced with HeroUI `Modal` confirmations and non-blocking `Toast` notifications.
