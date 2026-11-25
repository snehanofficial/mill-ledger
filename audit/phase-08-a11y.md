# Phase 8 Audit Report: Accessibility (WCAG 2.2 Level AA)

- **Audit Date**: 2026-11-19
- **Auditor**: Principal Accessibility Specialist & Application Security Reviewer
- **Target Standard**: W3C Web Content Accessibility Guidelines (WCAG) 2.2 Level AA
- **Evaluation Environment**:
  - Runtime: Linux x86_64 (`USER's OS version is linux`)
  - Headless Browser: Chromium 133.0 / Playwright 1.51.0
  - Dev Server: Node.js 22.22.1 / Vite 6.3.0 / Express 5.3.0
  - Resolution Benchmarks: 320x640, 390x844, 768x1024, 1024x768, 1280x800, 1440x900
  - Languages Evaluated: English (`en`), Tamil (`ta`)
  - Evaluated Roles: `PUBLIC`, `ADMIN`, `SALESMAN`, `PRODUCTION`, `ACCOUNTANT`, `OWNER`
- **Evidence Directory**: `/audit/evidence/a11y/`

---

## 1. Executive Summary & Audit Methodology

Automated scanners (axe-core, Lighthouse, eslint/oxlint jsx-a11y) detect only 20% to 35% of WCAG success criteria failures. To establish true compliance under the MASTER RULEBOOK, Phase 8 combined automated matrix scanning across **138 role/route/language combinations** with deep programmatic and manual inspections of DOM trees, keyboard focus traversal, ARIA state bindings, touch targets, reflow boundaries, and color contrast.

### Automated Test Artifacts Recorded
1. **axe-core 4.10.2 via Playwright**:
   - 138 independent full-page scans covering all permitted routes for 6 roles in both `en` and `ta`.
   - Raw JSON artifacts: `/audit/evidence/a11y/raw-axe/${role}_${lang}_${slug}.json`.
   - Consolidated summary: `/audit/evidence/a11y/axe-summary/consolidated-axe-findings.json`.
2. **Google Lighthouse 13.6.0 (Accessibility Category)**:
   - Headless Chrome audit on `/auth/login`.
   - Raw JSON artifact: `/audit/evidence/a11y/lighthouse/login-accessibility.json`.
   - Score: **98/100**, flagging `label-content-name-mismatch` (SC 2.5.3) and `landmark-one-main` (SC 1.3.1).
3. **AST Linting (oxlint jsx-a11y plugin)**:
   - Full static AST check against all 72 client source files (`client/src`).
   - Raw reports: `/audit/evidence/a11y/oxlint-jsx-a11y.json` and `.txt`.
   - Triage: 0 AST violations found, as raw JSX uses valid attributes on elements; all critical semantic and behavioral failures occur at runtime through component composition and dynamic layout logic.

---

## 2. Criterion-by-Criterion Compliance Matrix (WCAG 2.2 Level AA)

| Success Criterion | Level | Tested How | Evaluated Routes | Result | Finding Ref |
| :--- | :---: | :--- | :--- | :---: | :--- |
| **1.1.1 Non-text Content** | A | DOM evaluation & axe-core | All 21 routes, all roles | **VERIFIED-PASS** | None (Zero `<img>` tags; decorative SVGs have `aria-hidden="true"`) |
| **1.2.1 Audio-only and Video-only (Prerecorded)** | A | Asset inspection | All routes | **NOT-APPLICABLE** | Justification: App contains no prerecorded audio or video |
| **1.2.2 Captions (Prerecorded)** | A | Asset inspection | All routes | **NOT-APPLICABLE** | Justification: App contains no multimedia video tracks |
| **1.2.3 Audio Description or Media Alternative** | A | Asset inspection | All routes | **NOT-APPLICABLE** | Justification: No synchronized media present |
| **1.2.4 Captions (Live)** | AA | Feature inspection | All routes | **NOT-APPLICABLE** | Justification: No live streaming media present |
| **1.2.5 Audio Description (Prerecorded)** | AA | Asset inspection | All routes | **NOT-APPLICABLE** | Justification: No prerecorded video present |
| **1.3.1 Info and Relationships** | A | DOM tree, axe-core, script | All operational routes & modals | **VERIFIED-FAIL** | [F-051](findings/F-051.md), [F-052](findings/F-052.md) |
| **1.3.2 Meaningful Sequence** | A | DOM order traversal | All routes | **VERIFIED-PASS** | None (DOM order matches visual layout flow) |
| **1.3.3 Sensory Characteristics** | A | UI inspection | All routes | **VERIFIED-PASS** | None (No instructions rely solely on shape, size, or sound) |
| **1.3.4 Orientation** | AA | Viewport swap (320x640 vs 640x320) | All routes | **VERIFIED-PASS** | None (Layout reflows freely without locking orientation) |
| **1.3.5 Identify Input Purpose** | AA | DOM attribute audit | `/auth/login` | **VERIFIED-PASS** | None (`email`, `current-password` autocomplete present) |
| **1.4.1 Use of Color** | A | Visual inspection & badges | Orders, stock, payments, invoices | **VERIFIED-PASS** | None (Status badges combine text labels + distinct icons) |
| **1.4.2 Audio Control** | A | Audio node check | All routes | **NOT-APPLICABLE** | Justification: No audio auto-plays in the application |
| **1.4.3 Contrast (Minimum)** | AA | Color math evaluation | `/orders`, `/showcase`, all routes | **VERIFIED-FAIL** | [F-056](findings/F-056.md) (`text-muted-foreground/60` yields 2.93:1) |
| **1.4.4 Resize Text** | AA | Browser 200% font zoom | Dashboard, orders, stock, invoices | **VERIFIED-PASS** | None (UI reflows cleanly without truncating or overlapping) |
| **1.4.5 Images of Text** | AA | DOM tree inspection | All routes | **VERIFIED-PASS** | None (All typography rendered as live vector/DOM text) |
| **1.4.10 Reflow** | AA | 320 CSS px viewport test | `/orders`, `/stock`, `/invoices` | **VERIFIED-PASS** | None (`document.documentElement.scrollWidth === 320`) |
| **1.4.11 Non-text Contrast** | AA | Ring & border color math | Form controls, buttons, shell | **VERIFIED-PASS** | None (`--ring: #176b54` has 5.8:1 contrast against white) |
| **1.4.12 Text Spacing** | AA | WCAG text spacing CSS injection | Dashboard, orders, production | **VERIFIED-PASS** | None (No clipping under line-height 1.5, letter 0.12em) |
| **1.4.13 Content on Hover or Focus** | AA | Tooltip trigger & escape check | App shell icon rail & toolbars | **VERIFIED-PASS** | None (Radix tooltips dismiss on Esc, remain hoverable) |
| **2.1.1 Keyboard** | A | Tab navigation sweep | All routes | **VERIFIED-PASS** | None (All primary interactive buttons and links reachable) |
| **2.1.2 No Keyboard Trap** | A | Playwright modal tab loop | Custom modal dialogs (10 instances) | **VERIFIED-FAIL** | [F-051](findings/F-051.md) (Focus leaks out of modals to background) |
| **2.1.4 Character Key Shortcuts** | A | Keydown listener audit | App shell & shortcuts | **VERIFIED-PASS** | None (All shortcuts require Cmd/Ctrl modifier: ⌘K, ⌘B) |
| **2.2.1 Timing Adjustable** | A | Session expiry simulation | Authenticated shell | **VERIFIED-FAIL** | [F-057](findings/F-057.md) (Abrupt 401 redirect with no warning/extend) |
| **2.2.2 Pause, Stop, Hide** | A | Spinner/animation inspection | Shell & forms | **VERIFIED-PASS** | None (Animations tied directly to async request lifecycles) |
| **2.3.1 Three Flashes or Below Threshold** | A | Visual inspection | All routes | **VERIFIED-PASS** | None (Zero strobing or flashing elements exist) |
| **2.4.1 Bypass Blocks** | A | DOM evaluation & tab check | `/auth/login`, App Shell | **VERIFIED-FAIL** | [F-061](findings/F-061.md) (No skip on login; duplicate skips in shell) |
| **2.4.2 Page Titled** | A | SPA route navigation check | All 21 routes | **VERIFIED-FAIL** | [F-053](findings/F-053.md) (Static document.title on all SPA routes) |
| **2.4.3 Focus Order** | A | Modal open focus check | Core modals & forms | **VERIFIED-FAIL** | [F-051](findings/F-051.md) (Focus does not enter modal upon launch) |
| **2.4.4 Link Purpose (In Context)** | A | Anchor text audit | Sidebar, tables, breadcrumbs | **VERIFIED-PASS** | None (All links have clear contextual or aria-label text) |
| **2.4.5 Multiple Ways** | AA | IA inspection | All routes | **VERIFIED-PASS** | None (Dual navigation: Sidebar hierarchy + ⌘K palette) |
| **2.4.6 Headings and Labels** | AA | Heading level traversal | `/dashboard`, `/orders` | **VERIFIED-FAIL** | [F-052](findings/F-052.md) (Headings skip levels h1->h3; no htmlFor) |
| **2.4.7 Focus Visible** | AA | Focus ring style inspection | Buttons, links, inputs | **VERIFIED-PASS** | None (`focus-visible:ring-2` present across components) |
| **2.4.11 Focus Not Obscured (Minimum)** | AA | Sticky header bounding rect | `/orders`, `/invoices` | **VERIFIED-PASS** | None (Focused controls clear 64px sticky header) |
| **2.5.1 Pointer Gestures** | A | Interaction inspection | All routes | **VERIFIED-PASS** | None (No multi-touch, pinch, or complex gestures required) |
| **2.5.2 Pointer Cancellation** | A | Event listener audit | All buttons & mutations | **VERIFIED-PASS** | None (Actions trigger on click/up, allowing cancellation) |
| **2.5.3 Label in Name** | A | Lighthouse audit & DOM check | `/auth/login` language switcher | **VERIFIED-FAIL** | [F-054](findings/F-054.md) (Visible "தமிழ்" missing from aria-label) |
| **2.5.7 Dragging Movements** | AA | Interaction inspection | All routes | **NOT-APPLICABLE** | Justification: No drag-and-drop operations exist in the app |
| **2.5.8 Target Size (Minimum)** | AA | Bounding rect measurement | `SidebarRail`, tables | **VERIFIED-FAIL** | [F-055](findings/F-055.md) (Sidebar rail is 16px wide; 21 buttons <44px) |
| **3.1.1 Language of Page** | A | DOM attribute verification | Login, Shell in en and ta | **VERIFIED-PASS** | None (`<html lang="en">` and `<html lang="ta">` sync correctly) |
| **3.1.2 Language of Parts** | AA | Inline text fragment check | Login, demo cards, terms | **VERIFIED-FAIL** | [F-060](findings/F-060.md) (Tamil phrases in en mode lack lang="ta") |
| **3.2.1 On Focus** | A | Focus event inspection | Inputs, selects | **VERIFIED-PASS** | None (Focusing inputs does not trigger navigation or submit) |
| **3.2.2 On Input** | A | Change event inspection | Forms | **VERIFIED-PASS** | None (Input changes do not trigger automatic submission) |
| **3.2.3 Consistent Navigation** | AA | Layout structure check | All authenticated routes | **VERIFIED-PASS** | None (Sidebar and header order identical across views) |
| **3.2.4 Consistent Identification** | AA | Icon and button audit | All routes | **VERIFIED-PASS** | None (Standardized icons for actions across all tables) |
| **3.2.6 Consistent Help** | AA | Shell inspection | App Shell | **VERIFIED-FAIL** | Cross-ref [F-049](findings/F-049.md) (Zero help/support controls in shell) |
| **3.3.1 Error Identification** | A | Form validation test | Orders, payments, production | **VERIFIED-FAIL** | [F-052](findings/F-052.md), [F-059](findings/F-059.md) (No aria-invalid/describedby) |
| **3.3.2 Labels or Instructions** | A | Form control audit | All operational forms | **VERIFIED-FAIL** | [F-052](findings/F-052.md) (Labels detached from input IDs) |
| **3.3.3 Error Suggestion** | AA | Error banner inspection | Login, orders | **VERIFIED-PASS** | None (Validation messages provide clear corrective advice) |
| **3.3.4 Error Prevention (Legal, Financial, Data)** | AA | Financial mutation inspection | Invoices (Credit note), Payments | **VERIFIED-FAIL** | [F-058](findings/F-058.md) (Irreversible financial posting on single click) |
| **3.3.7 Redundant Entry** | AA | Order entry workflow | `/orders/new`, `/orders` | **VERIFIED-PASS** | None (Customer state and pricing auto-populate from DB) |
| **3.3.8 Accessible Authentication (Minimum)** | AA | Login flow analysis | `/auth/login` | **VERIFIED-PASS** | None (No cognitive puzzle test; paste password supported) |
| **4.1.2 Name, Role, Value** | A | Accessibility tree snapshot | Modals, tables, form controls | **VERIFIED-FAIL** | [F-051](findings/F-051.md), [F-052](findings/F-052.md) (Raw divs lack dialog role) |
| **4.1.3 Status Messages** | AA | DOM mutation & role check | Orders shortage, payment error | **VERIFIED-FAIL** | [F-059](findings/F-059.md) (Shortage banners in plain div without live/alert) |

---

## 3. Detailed Manual Inspection Findings Across Key Routes

### 1. Keyboard Only
- **Reachability**: All primary sidebar items, top header controls, and table rows are keyboard focusable.
- **Trap Violation (2.1.2)**: Verified in `audit/evidence/a11y/snapshots/raw_modal_verification.json`. When the "New sales order" modal is opened on `/orders`, focus remains on the triggering button outside the modal. Tabbing 20 times continuously leaks focus through background navigation links and table rows. The modal does NOT dismiss on `Escape`.
- **Focus Obscured (2.4.11)**: Tested programmatically on `/orders` with elements focused inside `#main-content`. The 64px sticky header has `scroll-pt-16` padding applied, ensuring focused controls are not hidden behind the header bar.
- **Shortcuts (2.1.4)**: Verified in `authenticated-shell.tsx:723` and `sidebar.tsx:162`. Global shortcuts use `event.metaKey || event.ctrlKey` (⌘K for command palette, ⌘B for sidebar toggle). No single-character shortcuts exist.

### 2. Screen Reader & Semantics
- **Host OS Environment Limitation (Rule E10 & E3)**:
  - The audit execution host is Linux x86_64.
  - Native Windows NVDA + Firefox and macOS/iOS VoiceOver audio speech output cannot be executed natively.
  - **Status**: `UNVERIFIED for native Windows NVDA and macOS VoiceOver acoustic output; VERIFIED programmatically via Chrome CDP Accessibility Tree, DOM object inspection, and Playwright`.
  - Manual verification steps are detailed in Section 5.
- **SPA Route Transitions (2.4.2)**: `document.title` remains fixed at `"MillLedger | Order-to-Audit System for a Small Food Manufacturer"` across every client-side route transition. Focus defaults to `BODY`. There is zero live-region announcement of the route change.
- **Landmarks**: `<main id="main-content">` and `<header>` are correctly defined inside the authenticated shell. However, `/auth/login` lacks a `<main>` landmark (flagged by Lighthouse `landmark-one-main`).
- **Heading Hierarchy**: `dashboard-page.tsx` renders `<h1>Overview</h1>` and immediately drops to `<h3>` on KPI widgets without an intervening `<h2>`.
- **Table Semantics**: `TableHead` correctly supplies `scope="col"`. `Table` container has `role="region"` and `aria-label="Data table"`. However, table columns lack `aria-sort` indicators.

### 3. Names and Roles (WAI-ARIA APG Patterns)
- **Modal Dialog Pattern**: Failed across 10 custom modal instances. None implement `role="dialog"` or `aria-modal="true"`.
- **Icon-Only Buttons**: In `orders-page.tsx:655`, the trash icon button inside table rows lacks an `aria-label` or inner text (`<Trash2Icon className="size-3" />`).
- **Combobox / Select**: Native `<select>` elements are used, but lack programmatic labels (no `id` / `htmlFor` binding).

### 4. Images & Media
- Zero raster `<img>` tags exist in the client repository.
- Lucide SVG icons are used exclusively and are configured with `aria-hidden="true"`.
- No images of text are present.

### 5. Color and Contrast
- **Light Theme**:
  - Regular text (`#09090b` on `#fcfdfc`): 18.2:1 (Passes AAA).
  - Muted foreground (`#52525b` on `#fcfdfc`): 7.58:1 (Passes AA).
  - Opacity-modified text (`text-muted-foreground/60` on `#ffffff`): **2.93:1** (Fails AA, [F-056](findings/F-056.md)).
- **Dark Theme (F-050 Cross-Reference)**:
  - `:root` hardcodes `color-scheme: light`. Adding `.dark` class to `<html>` leaves the background `#fcfdfc` while badge styles switch to dark-mode text, worsening contrast.
- **Use of Color Alone**: Status badges in tables (`orders`, `stock`, `invoices`) combine text labels with distinct icons (`CheckCircleIcon`, `AlertTriangleIcon`), ensuring color is not the sole differentiator.

### 6. Reflow, Zoom, and Spacing
- **320 CSS px Reflow (1.4.10)**: Tested on `/orders`, `/invoices`, `/stock`, `/production/today`, and `/reports/sales`. `document.documentElement.scrollWidth` is strictly 320px. Tables scroll within horizontally scrollable containment boxes (`overflow-x-auto`).
- **200% Text Resize (1.4.4)**: Text scales cleanly in responsive viewports without truncation.
- **Text Spacing (1.4.12)**: Injected WCAG spacing overrides (`line-height: 1.5`, `letter-spacing: 0.12em`, `word-spacing: 0.16em`). All cards and tables maintain layout integrity without horizontal clipping.

### 7. Target Size
- **WCAG 2.5.8 Minimum (24x24px)**:
  - `SidebarRail` interactive button (`sidebar.tsx:707`) has bounding box **16px wide** (16x800px), violating the 24px requirement.
- **Apple HIG Minimum (< 44x44px)**:
  - 21 action buttons across tables measure under 44x44px (e.g. `h-6 px-2` action buttons measure 24x28px).

### 8. Forms & Error Prevention
- **Accessible Authentication (3.3.8)**: `/auth/login` uses standard input fields with full clipboard paste support; no CAPTCHA or cognitive puzzle tests.
- **Autocomplete (1.3.5)**: Present on login (`email`, `current-password`).
- **Error Prevention (3.3.4)**: Issuing GST Credit Notes and recording Customer Payments post directly to PostgreSQL without a review/confirmation dialogue.

### 9. Language
- Root `<html lang>` updates between `"en"` and `"ta"`.
- Multilingual fragments (such as `"தமிழ்"` on the language switcher button or English acronyms in Tamil mode) lack inline `lang` tags (SC 3.1.2).

### 10. Timing & Session Expiry
- Better Auth sessions terminate abruptly upon API 401, discarding all uncommitted form inputs without a 20-second warning or session extend dialogue.

### 11. Status Messages
- Shortage banners (`orders-page.tsx:995`) and payment errors (`payments-page.tsx:856`) lack `role="status"`, `role="alert"`, or `aria-live`.

### 12. Emulation Modes
- **prefers-reduced-motion: reduce**: CSS transitions and spinners respect reduced motion settings where media queries apply.
- **forced-colors: active**: Windows High Contrast emulation preserves system button borders and text contrast.

---

## 4. Summary of New Findings Filed in Phase 8

| Finding ID | Title | Severity | Category | Primary Standard |
| :--- | :--- | :---: | :--- | :--- |
| **[F-051](findings/F-051.md)** | Missing Accessible Name and APG Dialog Semantics on Core Modal Overlays | **P1** | Assistive Tech / Trap | WCAG 1.3.1, 2.1.2, 4.1.2 |
| **[F-052](findings/F-052.md)** | Unassociated Form Labels and Missing Accessible Names Across Operational Forms | **P1** | Form Semantics | WCAG 1.3.1, 3.3.2, 4.1.2 |
| **[F-053](findings/F-053.md)** | Static SPA Page Title and Absence of Route Transition Announcements | **P1** | Screen Reader / SPA | WCAG 2.4.2, 4.1.3 |
| **[F-054](findings/F-054.md)** | Label in Name Mismatch on Multilingual Language Switcher | **P2** | Speech Input | WCAG 2.5.3 |
| **[F-055](findings/F-055.md)** | Interactive Touch Targets Below WCAG 2.5.8 Minimum (24x24px) & Apple HIG | **P2** | Touch Sizing | WCAG 2.5.8, Apple HIG |
| **[F-056](findings/F-056.md)** | Inadequate Color Contrast on Muted Text and Subtle Status Indicators | **P2** | Visual Contrast | WCAG 1.4.3 |
| **[F-057](findings/F-057.md)** | Unwarned Session Expiry and Form Data Destruction Under Better Auth Timeout | **P1** | Timing / Data Loss | WCAG 2.2.1, 3.3.7 |
| **[F-058](findings/F-058.md)** | Absence of Confirmation and Review Steps on Irreversible Financial Transactions | **P1** | Error Prevention | WCAG 3.3.4 |
| **[F-059](findings/F-059.md)** | Dynamic Shortage Banners and Form Errors Lack ARIA Live Region / Status Role | **P2** | Dynamic Updates | WCAG 4.1.3, 3.3.1 |
| **[F-060](findings/F-060.md)** | Missing Language of Parts (`lang="ta"` / `lang="en"`) on Multilingual Text Fragments | **P3** | i18n / Speech | WCAG 3.1.2 |
| **[F-061](findings/F-061.md)** | Redundant Duplicate Skip Links in App Shell Header and Layout | **P3** | Keyboard Nav | WCAG 2.4.1, 2.4.3 |

---

## 5. Screen Reader Verification Guide for Human Testers (NVDA / VoiceOver)

Per Rule E3 and E10, native acoustic speech output on Windows and Apple operating systems cannot be executed in this Linux container. Human reviewers must execute the following protocol to verify physical speech output:

### Protocol 1: Windows 11 + NVDA (latest) + Google Chrome / Firefox
1. Start NVDA (`Ctrl + Alt + N`).
2. Open `http://localhost:4173/auth/login`.
3. Press `Tab` to reach the language button in the upper right corner.
   - **Observe**: NVDA announces "Switch language to Tamil button" rather than the visible Tamil glyphs "தமிழ்" (confirms [F-054](findings/F-054.md)).
4. Sign in as Admin.
5. Once `/dashboard` loads, observe NVDA speech output.
   - **Observe**: NVDA does not announce the new page title or main heading; it remains silent or announces "document" (confirms [F-053](findings/F-053.md)).
6. Navigate to `/orders` and activate "New sales order".
   - **Observe**: NVDA does NOT announce "Dialog" or "Modal window". Pressing `Escape` does not dismiss the modal (confirms [F-051](findings/F-051.md)).
7. Tab through the modal fields.
   - **Observe**: NVDA announces "Combobox collapsed" and "Edit text" without reading the visual labels "Customer" or "Order quantity" (confirms [F-052](findings/F-052.md)).

### Protocol 2: macOS / iOS + Apple VoiceOver + Safari
1. Enable VoiceOver (`Cmd + F5` on macOS, or Settings -> Accessibility -> VoiceOver on iOS).
2. Open Safari to `http://localhost:4173/orders`.
3. Swipe right or press `VO + Right Arrow` through the order stream.
4. Tap "New sales order".
5. Continue swiping right.
   - **Observe**: Focus leaves the visible white modal container and highlights table rows underneath the dark backdrop (confirms focus trap failure [F-051](findings/F-051.md)).
