# Phase 7: User Experience, Usability Heuristics & Multi-Viewport Interface Audit

**Audit Phase**: Phase 7 — User Experience, Usability Heuristics, Design Systems & Mobile Accessibility  
**Target Codebase**: MillLedger Client (`client/src`) & Express API (`server/src`)  
**Operating Environment**: Linux, Node.js v22.22.1, Vite 6, Tailwind CSS 4, React 19, Better Auth, PostgreSQL  
**Audit Mode**: AUDIT ONLY (Strict adherence to GEMINI.md Master Rulebook)  
**Execution Timestamp**: 2026-11-19T21:12:00+05:30  
**Evidence Artifacts**:
- `audit/evidence/screenshots/` (1,060 automated viewport screenshots)
- `audit/evidence/screenshots-index.json` (Structured metadata index of all 1,060 captures)
- `audit/evidence/css-tokens-analysis.json` (Compiled CSS token and design system metrics)
- `audit/evidence/role-ui-route-matrix.csv` (100-row direct access and navigation parity matrix)

---

## 1. Executive Summary & Verification Methodology

Under Phase 7 of the Master Rulebook, the MillLedger frontend was executed in a headless browser environment driven by automated Playwright test harnesses. Every client route was systematically captured across **all 5 authenticated user roles** plus unauthenticated public access, at **5 distinct viewport widths** (320px, 390px, 768px, 1024px, 1440px), in **both supported languages** (English `en` and Tamil `ta`).

A total of **1,060 screenshots** were captured and cataloged in `/audit/evidence/screenshots/`. Every screen was evaluated using two industry-standard design frameworks:
1. **Nielsen Norman Group (NN/g) 10 Usability Heuristics** (numbered H1 through H10).
2. **Apple Human Interface Guidelines (HIG)** adapted for responsive web applications (labeled "adapted").

### High-Level Verdict: VERIFIED-FAIL (Multiple P1 & P2 Deficiencies)
While MillLedger features a clean, dignified visual foundation based on its "Pine & Paper" palette (Geist Variable typography, no gratuitous AI gradients, functional desktop tables), the application exhibits serious interaction and architecture failures:
- **P1 Ordering Screen Defect (F-042)**: The `/orders/new` screen is an unfunctional placeholder card. Order creation inside `/orders` was built as a desktop `<select>` dropdown without product tiles, images, or quantity steppers.
- **P1 Regional Language Parity Failure (F-043)**: Over 95% of the application remains in English when Tamil is selected; translation helpers are absent from all internal business pages.
- **P2 Touch Target Violations (F-044)**: 100% of routes on 320px viewports have critical interactive buttons smaller than 44x44px.
- **P2 Incomplete Diagnostic Feedback (F-045)**: Skeleton loading is absent across all pages (spinner-only); API error states omit backend Request IDs.
- **P2 Ephemeral URL State (F-046)**: Zero usage of `useSearchParams`; all filters and tabs reset on refresh or sharing.
- **P2 Mobile Table Clutter (F-047)**: Tables do not transform into mobile cards and headers do not stick during vertical scrolling.
- **P2 Missing Destructive Confirmations (F-048)**: Permanent dispatch stock deductions occur without consequential warnings.
- **P2 Zero In-App Documentation (F-049)**: No onboarding, no doc links, and zero tooltips for domain jargon (BOM, ATP, FIFO, Variance).
- **P3 Token Sprawl & Dead Dark Mode (F-050)**: 95 distinct colors in compiled CSS and unfunctional `dark:` classes.

---

## 2. Multi-Viewport & Multi-Language Screenshot Matrix Index

All screenshots were generated via `audit/tests/phase-07-ux-audit.spec.ts` against the live local Vite server (`http://127.0.0.1:4173`).

### Capture Parameters
- **Roles Evaluated**: `PUBLIC` (unauthenticated login), `ADMIN`, `SALESMAN`, `PRODUCTION`, `ACCOUNTANT`, `OWNER`.
- **Viewports Evaluated**:
  1. `320px` (320x640) — Small mobile / low-end Android / KaiOS handhelds.
  2. `390px` (390x844) — Standard modern smartphone (iPhone 12/13/14).
  3. `768px` (768x1024) — Tablet portrait (iPad Mini, factory floor clipboards).
  4. `1024px` (1024x768) — Tablet landscape / compact laptop.
  5. `1440px` (1440x900) — Standard desktop workstation.
- **Languages Evaluated**: English (`en`) and Tamil (`ta`).
- **Total Captured**: Exactly **1,060 PNG files** (75 MB total).

### Structured Screenshot Summary by Role & Viewport

| Role | Routes Captured | Languages | Viewports | Screenshots Generated | Storage Directory |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **PUBLIC** | 1 (`/auth/login`) | `en`, `ta` | 320, 390, 768, 1024, 1440 | 10 | `audit/evidence/screenshots/PUBLIC/` |
| **ADMIN** | 21 routes | `en`, `ta` | 320, 390, 768, 1024, 1440 | 210 | `audit/evidence/screenshots/ADMIN/` |
| **SALESMAN** | 21 routes | `en`, `ta` | 320, 390, 768, 1024, 1440 | 210 | `audit/evidence/screenshots/SALESMAN/` |
| **PRODUCTION**| 21 routes | `en`, `ta` | 320, 390, 768, 1024, 1440 | 210 | `audit/evidence/screenshots/PRODUCTION/` |
| **ACCOUNTANT**| 21 routes | `en`, `ta` | 320, 390, 768, 1024, 1440 | 210 | `audit/evidence/screenshots/ACCOUNTANT/` |
| **OWNER** | 21 routes | `en`, `ta` | 320, 390, 768, 1024, 1440 | 210 | `audit/evidence/screenshots/OWNER/` |
| **TOTAL** | **22 unique routes** | **2** | **5** | **1,060** | `audit/evidence/screenshots/` |

Full JSON manifest with byte sizes, titles, and bounding box counts is saved at `audit/evidence/screenshots-index.json`.

---

## 3. NN/g 10 Usability Heuristics Scorecard

Each of Jakob Nielsen's 10 usability heuristics was scored based on direct UI observation and code inspection.

| Heuristic | Evaluation & Status | Finding Ref | Score |
| :--- | :--- | :--- | :--- |
| **H1: Visibility of system status** | **PARTIALLY MET**. Real-time online/offline indicator in sticky header and outbox sheet provides excellent connection feedback. However, all data-fetching states render centered spinners rather than skeleton layouts, causing Cumulative Layout Shift (CLS). Long report exports lack progress indicators. | F-045 | 3 / 5 |
| **H2: Match between system and real world** | **VERIFIED-FAIL**. Food mill vocabulary (Murukku 200g, Flour kg, Oil L, physical on-hand, ATP) matches reality well in English. However, Tamil localization is non-existent on operational screens despite Tamil being the primary language of mill floor staff in Tamil Nadu. Tax acronyms (CGST/SGST) lack explanation. | F-043 | 2 / 5 |
| **H3: User control and freedom** | **VERIFIED-FAIL**. No undo mechanism for posted dispatches or approved orders. Destructive actions lack reversal paths. Furthermore, filter and tab states are not stored in the URL, breaking browser "Back" navigation and causing user frustration. Long forms lack unsaved-changes warnings. | F-046, F-048 | 2 / 5 |
| **H4: Consistency and standards** | **PARTIALLY MET**. Typography and basic table primitives follow standard conventions. However, navigation access is severely inconsistent: roles have permissions for routes that are hidden from their sidebar navigation (e.g. Salesman cannot see `/orders` on desktop sidebar). Skeletons and confirmation dialogs exist in library but are unused on real pages. | F-040, F-045 | 3 / 5 |
| **H5: Error prevention** | **PARTIALLY MET**. Real-time stock shortage warning alerts salesmen if an order quantity exceeds physical availability. However, high-impact irreversible operations (such as vehicle dispatch and order rejection) lack confirmation dialogs stating business consequences. No inline validation on `onBlur`. | F-048 | 3 / 5 |
| **H6: Recognition rather than recall** | **VERIFIED-FAIL**. Ordering screen fails to provide visual product tiles or images, forcing salesmen to recall SKUs from a dense dropdown. Global search (Cmd+K) only searches static menu links; it cannot search orders, customers, batches, or invoices. Customer balances are not visible during order booking. | F-042 | 2 / 5 |
| **H7: Flexibility and efficiency of use** | **PARTIALLY MET**. Keyboard shortcuts (`⌘K` for search, `⌘B` for sidebar toggle) are implemented for desktop power users. However, tables lack bulk selection/actions (cannot approve multiple orders at once). Mobile viewports lack thumb-reachable action zones. | F-044, F-047 | 3 / 5 |
| **H8: Aesthetic and minimalist design** | **PARTIALLY MET**. Visual aesthetic is dignified, muted, and free of generic AI slop gradients. However, data tables suffer severe visual clutter on mobile viewports: up to 11 desktop columns are crammed into narrow phones, forcing tedious horizontal panning. CSS token analysis reveals 95 distinct colors. | F-047, F-050 | 3 / 5 |
| **H9: Help users recognize, diagnose, and recover from errors** | **VERIFIED-FAIL**. Error states show generic messages ("Failed to load sales orders"). Crucially, UI errors omit the server Request ID (`x-request-id`), preventing users from quoting a traceable reference when contacting support. Forms display errors only in transient toasts without field-level error pointers. | F-045 | 2 / 5 |
| **H10: Help and documentation** | **VERIFIED-FAIL**. Zero links to user documentation or operational manuals. Zero first-run onboarding guides. Zero tooltips explaining complex domain acronyms (BOM, ATP, FIFO, Yield variance). | F-049 | 1 / 5 |

---

## 4. Apple Human Interface Guidelines (Adapted for Web) Assessment

All evaluations are labeled "adapted" per prompt instructions.

| Apple HIG Principle (Adapted) | Status | Observed Behavior & Evidence |
| :--- | :--- | :--- |
| **Clarity (adapted)** | **MET** | Geist Variable typography is sharp and legible; Lucide icons are purposeful and uncluttered; semantic color is applied appropriately to status badges (emerald for approved, amber for pending/shortage, red for rejected). |
| **Deference (adapted)** | **MET** | The interface respects the content: muted backgrounds (`#fcfdfc`), subtle borders (`#e4e4e7`), and minimal chrome competition allow ledger and stock numbers to remain the focal point. |
| **Depth (adapted)** | **MET** | Modal sheets (Radix Dialog/Sheet) employ crisp backdrop blur (`backdrop-blur-xs`) and clean elevation shadows (`--shadow-modal: 0 16px 36px rgba(0,0,0,0.16)`) to establish visual hierarchy during modal tasks. |
| **Consistent navigation patterns (adapted)** | **PARTIALLY MET** | Desktop features a collapsible sidebar rail with directed hover tooltips. Mobile features a bottom navigation bar (`MobileBottomNav`). However, navigation consistency breaks down across roles: menu items disappear or mismatch route permissions (Finding F-040). |
| **Minimum 44x44 px touch targets (adapted)** | **VIOLATED** | **100% of routes on 320px/390px viewports violate this principle**. Header language toggle is 32px height; search trigger is 32px; avatar is 32px; table inline action buttons ("Approve", "Reject") are styled with `h-8` (32px). See Finding F-044. |
| **Thumb-reachable primary actions on phones (adapted)** | **VIOLATED** | On mobile viewports, primary call-to-action buttons ("Create order", "New dispatch", "Record payment") are positioned at the top right of the viewport (the least reachable zone for one-handed thumb reach) rather than floating bottom action sheets or sticky bottom bars. |
| **System-like controls and semantic color (adapted)** | **MET** | Uses native `<select>` dropdowns and system input controls; semantic color tokens (`--success`, `--warning`, `--destructive`, `--info`) communicate ledger status reliably. |
| **Text that scales with user font settings (adapted)** | **PARTIALLY MET** | Font sizes use relative Tailwind rem units (`text-sm`, `text-xs`). However, fixed-height header (`h-16`) and mobile bottom nav (`h-14`) risk text clipping or layout overlap if user OS font scaling is set to 150%+. |
| **Sensible defaults (adapted)** | **MET** | Forms pre-select active customers, auto-populate current dates, and compute standard BOM batch ratios by default. |
| **Designing for real device context (adapted)** | **PARTIALLY MET** | - *Factory tablet in glare*: High-contrast light theme works decently, but complete lack of dark mode or high-contrast theme limits readability in variable lighting.<br>- *Salesman one-handed phone*: Bottom nav is helpful, but wide horizontal tables and tiny dropdowns create high operational friction.<br>- *Accountant on desktop*: Tabular density is good, but missing sticky headers and lost URL filter state degrade auditing workflows. |

---

## 5. Detailed Review Across the 10 Required Checks

### Check 1: Information Architecture
- **Role-Based Navigation**: Inconsistent. The desktop sidebar hides `/orders` from `SALESMAN`, `/production` from `PRODUCTION`, and `/reports` from all scoped roles, even though these roles have full API permissions for those endpoints.
- **Task Depth**:
  - Salesman creating order: 2 taps on mobile (Bottom nav -> "Create first order").
  - Dispatching an order: 2 clicks on desktop (Sidebar -> "New dispatch").
  - Invoicing: **IMPOSSIBLE from UI** (Finding F-037; missing button).
- **Labels & Terminology**: Uses domain terms ("Intra-state", "CGST", "Murukku"), but fails to explain them in context.
- **Breadcrumbs**: Implemented via `useBreadcrumbs()`, but truncated or hidden on mobile screens (`md:inline-flex`).
- **Global Search**: Command dialog (`⌘K`) exists, but only filters static page links. It does **not** search domain entities (orders, customers, invoices, batches).
- **Recently Used**: Completely absent.
- **Page Anatomy**: Page headers consistently display title, status badge, and primary action button. However, `/orders/new`, `/exports`, and `/settings` violate anatomy by rendering static placeholder cards.

### Check 2: Screen States
- **Loading**: **Failed**. Every single page uses an inline spinning refresh icon (`<RefreshCwIcon className="animate-spin" />`). Zero pages use layout skeletons, causing Cumulative Layout Shift (CLS).
- **Empty States**: Mixed. `/orders` displays a good empty state with an icon, explanatory copy, and "Create first order" button. However, `/reports`, `/invoices`, and `/customers` render blank table headers or minimal 1-line text without clear next-step guidance.
- **Error States**: **Failed**. Generic error alerts ("Failed to load sales orders") do not extract or display the server's `requestId`. Users cannot reference a correlation ID when reporting problems.
- **Offline**: Functional. Header displays offline badge; `/orders` warns that stock is not reserved offline; `DeviceOutboxSheet` provides pending sync inspection.
- **Permission Denied**: **Failed**. Navigating to a forbidden route renders the full shell, but page queries fail with 403, rendering generic error alerts rather than a dedicated 403 Access Denied guard screen.
- **Success Feedback**: Sonner toast notifications trigger reliably on mutation success.

### Check 3: Forms
- **Labels & Units**: Visible `<label>` elements; units explicitly stated (kg, L, pkts, ₹).
- **Input Modes on Mobile**: **Failed**. Numeric inputs use `type="number"` but lack `inputMode="decimal"` or `inputMode="numeric"`. Mobile keyboards frequently omit decimal keys or present non-optimal layouts.
- **Validation Timing**: Validation occurs strictly upon submit button click. Zero real-time `onBlur` inline validation.
- **Error Placement**: Errors appear only in top-level modal alert banners or toast popups, not inline next to the offending input field.
- **Data Loss on Error**: Form state is kept in memory during validation errors, but clicking modal backdrop or hitting Escape instantly destroys all entered values.
- **Autosave / Drafts**: No draft autosave exists for web forms.
- **Unsaved Changes Guard**: Completely missing. Navigating away or clicking sidebar links during mid-form data entry silently discards all typed data without confirmation.
- **Formatting**: Uses Indian Rupee symbol `₹`, but some views use `toFixed(2)` instead of standard Indian lakh/crore digit grouping (`en-IN`). Dates occasionally appear as ISO `YYYY-MM-DD` rather than Indian standard `DD/MM/YYYY`.

### Check 4: Tables and Data Density
- **Sticky Headers**: **Failed**. `TableHead` lacks `sticky top-0`. Scrolling vertically causes column titles to disappear.
- **Column Priority on Mobile**: **Failed**. Mobile viewports (320px/390px) do not transform tables into cards or collapse low-priority columns. All 8–11 columns sit in an `overflow-x-auto` container, requiring wide horizontal panning.
- **URL Search Params**: **Failed**. Zero usage of `useSearchParams`. Filters and tab selections cannot be bookmarked or shared.
- **Bulk Actions**: Completely absent (no row checkboxes).
- **Row Actions**: Discoverable via inline table buttons, but increases horizontal scroll width on narrow viewports.
- **Tabular Figures**: Most monetary cells use `font-mono text-right`, but `stock-page.tsx` and `orders-page.tsx` omit `tabular-nums` on several quantity columns.

### Check 5: Destructive Actions & Reversals
- **Irreversible Operations**: Posting physical dispatches (`dispatch-page.tsx:541`) and rejecting orders occur immediately upon form submit.
- **Safety Primitives**: `ConfirmationDialog` exists in `components/ui/` but is **never used** in real production pages (only on `showcase-page.tsx`).
- **Reversal Paths**: No UI path exists to reverse a dispatched vehicle or issue a sales return credit note.

### Check 6: Ordering Screen with Product Tiles
- **Tiles & Images**: **Failed**. `/orders/new` is a dummy placeholder card. The order modal on `/orders` uses an HTML `<select>` dropdown with zero product images.
- **Quantity Stepper**: **Failed**. Uses a plain `<input type="number">` without large 44px plus/minus stepper buttons.
- **Running Total & Shortage**: Functional. Computes taxable, CGST, SGST, grand total, and displays an amber warning badge when order quantity exceeds ATP stock.
- **Rasterized Text**: Verified: no text is baked into images (WCAG 1.4.5 compliant).

### Check 7: Visual Quality ("No AI Slop") & Design Tokens
- **Slop Evaluation**:
  - Zero generic decorative AI gradients.
  - Zero stock illustration filler or arbitrary emoji icons.
  - No unexplained micro-animations.
  - Dignified Pine & Paper palette (`#176B54` primary).
- **Design Token Metrics (Compiled CSS Analysis via `analyze-css-tokens.ts`)**:
  - **Distinct Colors**: **95** (Token fragmentation: arbitrary Tailwind utility classes like `text-amber-700`, `bg-emerald-500/10` bypass `:root` CSS variables).
  - **Distinct Font Sizes**: **18** (Arbitrary text scaling values).
  - **Distinct Spacing Values**: **23**.
  - **Distinct Border Radii**: **12** (Inconsistent mixing of `rounded-panel`, `rounded-control`, `rounded-md`, `rounded-xl`, `rounded-lg`).
  - **Distinct Font Families**: **5**.
  - **Animations**: **7** (Standard CSS keyframe animations).

### Check 8: Dark Mode and Theming
- **Evaluation**: **Failed / Incomplete**.
  - `:root { color-scheme: light; }` is hardcoded in `index.css`.
  - Zero `.dark` CSS root variable override block exists.
  - Zero theme toggle switch exists in the UI.
  - UI components contain numerous dead `dark:...` utility classes that never trigger.

### Check 9: Content & Tamil Parity
- **Microcopy**: Clean, domain-appropriate English terminology.
- **Placeholders**: Placeholder text ("Module in Progress") observed on `/orders/new`, `/exports`, and `/settings`.
- **Tamil Parity**: **Failed**. Only 30 dictionary keys exist. All page titles, form inputs, table headers, and status badges remain 100% in English when Tamil language is selected.

### Check 10: Help and Documentation
- **Onboarding**: Zero first-run walkthroughs or workflow diagrams.
- **Jargon Tooltips**: Zero tooltips explaining domain acronyms (BOM, ATP, FIFO, Yield variance).
- **Documentation Link**: Zero links to external manuals or in-app help guides.

---

## 6. Summary of Phase 7 Findings

| Finding ID | Severity | Category | Title | Standard Reference |
| :--- | :--- | :--- | :--- | :--- |
| **F-042** | **P1** | UX / Interaction | Ordering Interface Missing Required Product Tiles, Visual Images, and Accessible Quantity Steppers | NN/g H6, Apple HIG adapted, WCAG 2.5.8 |
| **F-043** | **P1** | Localization | Pervasive Tamil Localization Failure Across Internal Business Routes Despite Language Selector | NN/g H2, Check 9 |
| **F-044** | **P2** | Accessibility | Touch Targets Below Minimum 44x44px Across Mobile Viewports | WCAG 2.2 SC 2.5.8, Apple HIG adapted |
| **F-045** | **P2** | System Feedback | Lack of Skeleton Loaders and Omission of Request IDs in UI Error States | NN/g H1, NN/g H9, Check 2 |
| **F-046** | **P2** | Information Arch | Ephemeral Filter, Sort, and Tab State Not Preserved in URL | NN/g H3, NN/g H4, Check 4 |
| **F-047** | **P2** | Responsive Layout | Absence of Sticky Table Headers and Card Transformation on Mobile Viewports | Apple HIG adapted, NN/g H8, Check 4 |
| **F-048** | **P2** | Error Prevention | Missing Confirmation Dialogs for Irreversible Operations (Dispatch, Order Rejection) | NN/g H5, Check 5 |
| **F-049** | **P2** | Help & Docs | Complete Absence of In-App Documentation, Onboarding Guidance, and Domain Jargon Tooltips | NN/g H10, Check 10 |
| **F-050** | **P3** | Visual Quality | Incomplete Dark Mode Infrastructure and Design Token Fragmentation in CSS Output | NN/g H8, Check 7, Check 8 |

---

## 7. Sign-Off & Verification Evidence

All evaluations and metrics presented above were produced by executing live Playwright test automation against running instances of the Vite frontend (`http://127.0.0.1:4173`) and Express backend (`http://127.0.0.1:4000`), in strict compliance with the **AUDIT ONLY** mandate of `GEMINI.md`.

- **Screenshot Artifacts Directory**: `/home/snehan/projects/web/mill-ledger/audit/evidence/screenshots/`
- **Metadata Index**: `/home/snehan/projects/web/mill-ledger/audit/evidence/screenshots-index.json`
- **CSS Token Analysis**: `/home/snehan/projects/web/mill-ledger/audit/evidence/css-tokens-analysis.json`
- **Finding Files**: `/home/snehan/projects/web/mill-ledger/audit/findings/F-042.md` through `F-050.md`
