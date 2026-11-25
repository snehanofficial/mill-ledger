# Phase 9 Audit Report: Motion, Animation, Feedback Patterns & Latency

- **Audit Date**: 2026-11-19
- **Auditor**: Principal Accessibility Specialist, Performance Engineer & UX Auditor
- **Target Standards**:
  - W3C WCAG 2.2 Success Criterion 2.3.1 Three Flashes or Below Threshold (Level A)
  - W3C WCAG 2.2 Success Criterion 2.2.2 Pause, Stop, Hide (Level A)
  - W3C WCAG 2.2 Success Criterion 2.3.3 Animation from Interactions (Level AAA, treated as mandatory here)
  - W3C WCAG 2.2 Success Criterion 1.4.1 Use of Color (Level A)
  - W3C WCAG 2.2 Success Criterion 4.1.3 Status Messages (Level AA)
  - W3C WCAG 2.2 Success Criterion 2.4.3 Focus Order (Level A)
  - Apple Human Interface Guidelines: Motion (Make motion optional, purposeful, non-distracting)
  - Google Core Web Vitals: Interaction to Next Paint (INP < 200ms) & Cumulative Layout Shift (CLS < 0.1)
  - NN/g Usability Heuristics: Visibility of system status, response latency <= 300ms for UI controls
- **Evaluation Environment**:
  - Runtime: Linux x86_64
  - Headless Browser: Chromium 133.0 / Playwright 1.51.0
  - Dev Server: Node.js 22.22.1 / Vite 6.3.0 / Express 5.3.0
  - Client URL: `http://127.0.0.1:4173` / Server URL: `http://127.0.0.1:4000`
- **Evidence Directory**: `/audit/evidence/motion/`
  - Automated Playwright Spec: `audit/tests/phase-09-motion-audit.spec.ts`
  - Computed Styles Artifact: `audit/evidence/motion/metrics/reduced-motion-computed-styles.json`
  - Flashing & Auto-Moving Artifact: `audit/evidence/motion/metrics/flashing-and-automoving-audit.json`
  - Layout Thrashing & CLS Artifact: `audit/evidence/motion/metrics/cls-and-layout-thrashing.json`
  - INP Latency Report: `audit/evidence/motion/metrics/inp-interaction-latency.json`
  - Entrance Durations Report: `audit/evidence/motion/metrics/entrance-animation-durations.json`
  - Feedback Patterns Report: `audit/evidence/motion/metrics/feedback-patterns-audit.json`
  - Route Transitions Report: `audit/evidence/motion/metrics/route-transition-audit.json`
  - AI Slop Motion Scan Report: `audit/evidence/motion/metrics/ai-slop-motion-scan.json`

---

## 1. Executive Summary & Audit Methodology

Motion in user interfaces must communicate state, orient the user across spatial transitions, and confirm completed operations; it must **never block, delay, or cause vestibular harm**. 

Phase 9 conducted a rigorous code-level inventory and live browser instrumentation across the entire MillLedger client application (`client/src`). The audit verified:
1. **Full Motion Inventory**: Every CSS transition, `@keyframes` declaration, Tailwind utility, and third-party motion behavior was extracted and categorized by UX purpose, duration, easing, animated properties, and trigger.
2. **Reduced Motion Emulation**: Tested via Playwright CDP emulation (`reducedMotion: "reduce"`). Verified whether `index.css` sets `transition-duration: 0.01ms` and `animation-iteration-count: 1` to halt non-essential animations.
3. **Flashing & Auto-Moving Content**: Analyzed animation cycle frequencies against WCAG 2.3.1 (< 3.0 Hz threshold) and evaluated continuous pulsing/spinning elements against WCAG 2.2.2 (Pause, Stop, Hide).
4. **Layout-Thrashing Properties & CLS**: Profiled all animated properties. Identified where `width` and `height` trigger layout reflows vs compositor-only `transform` and `opacity`. Monitored Cumulative Layout Shift (CLS) during transitions.
5. **Interaction Latency (INP)**: Measured user interaction delays across top critical workflows against the Google Core Web Vitals 200ms threshold.
6. **Task Delay Heuristic**: Evaluated whether interactive controls impose entrance delays exceeding 300ms.
7. **Feedback Patterns**: Tested button states (hover, pressed, focus-visible, disabled, loading), optimistic updates with rollback, outbox sync states (text + icon), and toast notifications (`role="status"`, duration, hover/focus pause, and persistent retrieval).
8. **SPA Route Transitions**: Evaluated focus management, scroll position reset, and blank screen flashes.
9. **AI Slop Motion Filter**: Scanned all routes for generic AI tropes (parallax, floating blobs, animated gradients, bouncing icons, meaningless counters).

---

## 2. Animation & Transition Inventory Table

The codebase inventory encompasses 18 distinct motion implementations across 7 categories. Every animation was executed and evaluated under both standard and `prefers-reduced-motion: reduce` conditions in Chromium 133.

| ID | Component / File Location | Purpose | Trigger | Properties Animated | Duration | Easing | Standard Behavior | Reduced-Motion Behavior | Result | Finding Ref |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **M-01** | `index.css:201` Collapsible Open | Orientation | Accordion trigger click | `height` (0 to content height) | 160ms | `cubic-bezier(0.2, 0, 0, 1)` | Expands height smoothly | `animation: none` (instant) | **VERIFIED-PASS** | [F-063](findings/F-063.md) |
| **M-02** | `index.css:208` Collapsible Close | Orientation | Accordion trigger click | `height` (content height to 0) | 120ms | `cubic-bezier(0.4, 0, 1, 1)` | Collapses height smoothly | `animation: none` (instant) | **VERIFIED-PASS** | [F-063](findings/F-063.md) |
| **M-03** | `sidebar.tsx:285` Sidebar Shell | Orientation | Sidebar toggle click | `width` (expanded to icon rail) | 220ms | `cubic-bezier(0.2, 0, 0, 1)` | Animates layout width | `transition-none` (instant) | **VERIFIED-PASS** | [F-063](findings/F-063.md) |
| **M-04** | `sidebar.tsx:246` Mobile Sheet Drawer | Orientation | Mobile menu button click | `transform` (`translateX`) | 220ms | ease-in-out | Slides in from left | `transition-none` (instant) | **VERIFIED-PASS** | None |
| **M-05** | `sidebar.tsx:390` Collapsible Chevron | Feedback | Submenu disclosure toggle | `transform` (`rotate(90deg)`) | 200ms | ease | Rotates chevron 90deg | `1e-05s` (instant) | **VERIFIED-PASS** | None |
| **M-06** | `button.tsx:8` Button Active Scale | Feedback | Pointer / Key down | `transform` (`scale(0.985)`) | Instant | Active pseudo | Visual tactile compression | Scale applied (instant) | **VERIFIED-PASS** | None |
| **M-07** | `button.tsx:8` Button Hover / Focus | Feedback | Hover / Focus enter | `background-color`, `border-color` | 150ms | ease | Color transition | `1e-05s` (instant) | **VERIFIED-PASS** | [F-064](findings/F-064.md) |
| **M-08** | `switch.tsx:21` Switch Thumb | Feedback | Click / Space toggle | `transform` (`translateX(16px)`) | 150ms | ease | Thumb slides across track | `1e-05s` (instant) | **VERIFIED-PASS** | None |
| **M-09** | `dialog.tsx:28` Dialog Overlay | Orientation | Dialog trigger open | `opacity` (0 to 1) | 200ms | ease | Black 50% backdrop fade | `1e-05s` (instant) | **VERIFIED-PASS** | None |
| **M-10** | `dialog.tsx:32` Dialog Content | Orientation | Dialog trigger open | `opacity`, `transform` (`scale(0.95 to 1)`) | 200ms | ease | Zoom-in fade entrance | `1e-05s` (instant) | **VERIFIED-PASS** | None |
| **M-11** | `alert-dialog.tsx:25` Alert Overlay | Orientation | Consequential action trigger | `opacity` (0 to 1) | 200ms | ease | Black 50% backdrop fade | `1e-05s` (instant) | **VERIFIED-PASS** | None |
| **M-12** | `alert-dialog.tsx:29` Alert Content | Orientation | Consequential action trigger | `opacity`, `transform` (`scale(0.95 to 1)`) | 200ms | ease | Zoom-in fade entrance | `1e-05s` (instant) | **VERIFIED-PASS** | None |
| **M-13** | `purchases-page.tsx:314` Purchases Modal | Orientation | "Record Receipt" click | `opacity`, `transform` (`scale(0.95 to 1)`) | 150ms | ease | Zoom-in fade entrance | `1e-05s` (instant) | **VERIFIED-PASS** | None |
| **M-14** | `tooltip.tsx:40` Tooltip Popover | Orientation | Hover / Focus enter | `opacity`, `transform` (`scale(0.95 to 1)`) | 150ms | ease | Zoom-in fade entrance | `1e-05s` (instant) | **VERIFIED-PASS** | None |
| **M-15** | `spinner.tsx:13` Refresh Spinners | Status | Query fetch / Mutation pending | `transform` (`rotate(360deg)`) | 1000ms | linear | Continuous 1 Hz spin | `1e-05s`, 1 iteration (halts) | **VERIFIED-PASS** | None |
| **M-16** | `skeleton.tsx:8` Skeleton Shimmer | Status | Loading data | `opacity` (1 to 0.5 to 1) | 2000ms | `cubic-bezier(0.4, 0, 0.6, 1)` | Continuous 0.5 Hz pulse | `1e-05s`, 1 iteration (halts) | **VERIFIED-FAIL** | [F-062](findings/F-062.md) |
| **M-17** | `orders-page.tsx:578` Outbox Sync Badge | Status | Device outbox sync active | `opacity` (1 to 0.5 to 1) | 2000ms | `cubic-bezier(0.4, 0, 0.6, 1)` | Continuous 0.5 Hz pulse | `1e-05s`, 1 iteration (halts) | **VERIFIED-FAIL** | [F-062](findings/F-062.md) |
| **M-18** | `sonner.tsx:1` Sonner Toast Popups | Feedback | Mutation success / error | `transform` (`translateY`, scale), `opacity` | ~350ms | ease-out | Slide-up stack entrance | Suppressed via CSS rule | **VERIFIED-FAIL** | [F-065](findings/F-065.md) |

---

## 3. Browser Verification Findings & Deep Analysis

### 3.1 Reduced-Motion Verification (WCAG 2.3.3 AAA & Apple HIG)
- **Tested How**: Playwright CDP `page.emulateMedia({ reducedMotion: "reduce" })` followed by DOM evaluation of `window.getComputedStyle()`.
- **Baseline vs Reduced Evidence**:
  - Baseline: `spinner.animationDuration: "1s"`, `pulse.animationDuration: "2s"`, `button.transitionDuration: "0.15s"`.
  - Reduced Motion:
    - `htmlScrollBehavior`: `"auto"` (eliminates smooth scrolling disorientation).
    - `spinnerAnimationDuration`: `"1e-05s"` (`0.01ms`), `animationIterationCount: "1"`.
    - `pulseAnimationDuration`: `"1e-05s"` (`0.01ms`), `animationIterationCount: "1"`.
    - `collapsibleAnimationDuration`: `"1e-05s"` (`0.01ms`) with explicit override `[data-radix-collapsible-content] { animation: none; }`.
    - `buttonTransitionDuration`: `"1e-05s"` (`0.01ms`).
- **Result**: **VERIFIED-PASS**. The global reset rule in `client/src/index.css:214-228` forcefully crushes all animation and transition durations to 0.01ms and locks iterations to 1, fulfilling WCAG 2.3.3 and Apple HIG requirements.

### 3.2 Flashing Rates & Auto-Moving Content (WCAG 2.3.1 & WCAG 2.2.2)
1. **WCAG 2.3.1 Three Flashes or Below Threshold (Level A)**:
   - **Requirement**: No visual element flashes more than 3 times per second (3.0 Hz).
   - **Observed**:
     - `animate-spin` rotates at 1 cycle per 1000ms = **1.0 Hz** (< 3.0 Hz).
     - `animate-pulse` cycles opacity between 1.0 and 0.5 over 2000ms = **0.5 Hz** (< 3.0 Hz).
     - Zero strobe, high-contrast flash, or rapid blinking elements exist in the application.
   - **Result**: **VERIFIED-PASS**.
2. **WCAG 2.2.2 Pause, Stop, Hide (Level A)**:
   - **Requirement**: Any moving, blinking, or scrolling content starting automatically and lasting longer than 5 seconds must provide a user mechanism to pause, stop, or hide it.
   - **Observed**:
     - `orders-page.tsx:578` and `device-outbox-sheet.tsx:204` apply `animate-pulse` to `Syncing...` badges. When outbox syncing takes more than 5 seconds (e.g. processing large batches or re-trying conflicts over 2G/3G networks), the badge pulses continuously.
     - `skeleton.tsx:8` pulses continuously during slow API responses.
     - **Neither component provides a pause, stop, or hide control**.
   - **Result**: **VERIFIED-FAIL** ([F-062](findings/F-062.md)).

### 3.3 Layout-Thrashing Properties & Cumulative Layout Shift (CLS)
- **Requirement**: Animate only GPU-composited properties (`transform` and `opacity`) where possible. Avoid animating `width`, `height`, `top`, `left`, `margin`, or `padding`. Ensure CLS remains under 0.1.
- **Observed CLS**:
  - Live PerformanceObserver trace during sidebar toggle, modal opening, and toast display measured `cumulativeLayoutShift: 0.000` (PASS, budget < 0.1).
- **Observed Reflow Hazards**:
  - `client/src/components/ui/sidebar.tsx:285` animates `width` (`transition-[width] duration-220 ease-[cubic-bezier(0.2,0,0,1)]`). Because the sidebar is an inline flex column adjacent to `#main-content`, expanding or collapsing the sidebar forces browser layout recalculation and reflows all data tables and flex cards on every frame.
  - `client/src/index.css:201` animates `height` directly on `[data-radix-collapsible-content]` from `0` to `--radix-collapsible-content-height`.
- **Result**: **VERIFIED-FAIL** ([F-063](findings/F-063.md)).

### 3.4 Interaction Latency (INP < 200 ms)
- **Tested How**: Programmatic Event Timing measurement in Chromium 133 using `performance.now()`, event dispatch, and double `requestAnimationFrame` post-paint resolution.
- **Evaluated Workflows**: Top 9 high-frequency interactive operations:

| # | User Interaction | Measured Latency | Budget (< 200ms) | Status | Evidence File |
| :---: | :--- | :---: | :---: | :---: | :--- |
| **1** | Language Switcher Toggle (EN <-> TA) | 137.22 ms | < 200 ms | **VERIFIED-PASS** | `inp-interaction-latency.json` |
| **2** | Sidebar Collapse / Expand Toggle | 104.06 ms | < 200 ms | **VERIFIED-PASS** | `inp-interaction-latency.json` |
| **3** | Header Notifications Sheet Open | 121.65 ms | < 200 ms | **VERIFIED-PASS** | `inp-interaction-latency.json` |
| **4** | Global Search Command Palette Open | 160.64 ms | < 200 ms | **VERIFIED-PASS** | `inp-interaction-latency.json` |
| **5** | Header Outbox Sync Sheet Open | 155.41 ms | < 200 ms | **VERIFIED-PASS** | `inp-interaction-latency.json` |
| **6** | Orders Page Tab Switch (Stream -> Outbox) | 93.60 ms | < 200 ms | **VERIFIED-PASS** | `inp-interaction-latency.json` |
| **7** | Open New Sales Order Modal | 113.55 ms | < 200 ms | **VERIFIED-PASS** | `inp-interaction-latency.json` |
| **8** | Showcase Dialog Modal Open | 108.80 ms | < 200 ms | **VERIFIED-PASS** | `inp-interaction-latency.json` |
| **9** | Navigation to Invoices Page | 119.54 ms | < 200 ms | **VERIFIED-PASS** | `inp-interaction-latency.json` |

- **Result**: **VERIFIED-PASS**. All tested user operations respond and paint within 93ms to 161ms, fully complying with Google Core Web Vitals INP requirements (< 200 ms).

### 3.5 Entrance Animation Duration Heuristic (<= 300 ms)
- **Heuristic**: No entrance animation on frequently used interactive controls (modals, dropdowns, menus) should exceed roughly 300 ms.
- **Observed Durations**:
  - `Dialog` / `AlertDialog` Content: 200 ms (PASS).
  - `Dialog` / `AlertDialog` Overlay: 200 ms (PASS).
  - `Purchases` Receipt Modal: 150 ms (PASS).
  - `Collapsible` Expansion: 160 ms (PASS).
  - `Collapsible` Collapse: 120 ms (PASS).
  - `Sidebar` Width Transition: 220 ms (PASS).
  - `Tooltip` Entrance: 150 ms (PASS).
  - `Sonner` Toast Entrance: ~350 ms (Peripheral notification; non-blocking).
- **Result**: **VERIFIED-PASS**. All modal dialogs and interactive overlays enter within 150ms to 200ms, well below the 300ms heuristic threshold.

---

## 4. Feedback Patterns & Interaction Affordances

### 4.1 Button Interaction States
- **Normal State**: High-contrast typography, distinct background and border definitions.
- **Hover State**: Distinct color shift (`hover:bg-primary-hover` / `hover:bg-accent`).
- **Focus-Visible State**: High-contrast focus ring (`focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`).
- **Pressed State**: Physical depression simulation via `active:scale-[0.985]` and `active:bg-primary-pressed`.
- **Disabled State**:
  - `button.tsx:8` applies `disabled:pointer-events-none disabled:opacity-50`.
  - While `index.css:186` specifies `button:disabled { cursor: not-allowed; }`, the presence of `pointer-events: none` suppresses all cursor calculations, leaving the pointer as a default arrow.
  - Tooltips attached to disabled buttons cannot receive hover or focus.
  - **Result**: **VERIFIED-FAIL** ([F-064](findings/F-064.md)).
- **Loading State**: Displays inline `<Spinner className="size-4" />` with disabled click behavior.

### 4.2 Optimistic Updates with Rollback
- **Requirement**: Mutations must optimistically update the UI, cleanly rollback on failure, and present an explicit visible error.
- **Observed**:
  - Across all 6 operational pages (`invoices-page.tsx`, `orders-page.tsx`, `dispatch-page.tsx`, `production-page.tsx`, `purchases-page.tsx`, `payments-page.tsx`), **zero `useMutation` hooks define `onMutate` rollback handlers**.
  - All operations block synchronously while awaiting server responses, showing spinning icons on buttons. If the server call fails or times out, an error toast is emitted, but no optimistic state was rendered or rolled back.
  - **Result**: **VERIFIED-FAIL** ([F-067](findings/F-067.md)).

### 4.3 Outbox Sync Status Indicators (Text AND Icon)
- **Requirement**: Sync states (`queued`, `syncing`, `synced`, `conflict`, `failed`) must communicate status using both text AND icon, not color alone (WCAG 1.4.1).
- **Observed**:
  - In `authenticated-shell.tsx:180-215`, the header sync indicator provides both text and Lucide icons (`WifiOffIcon`, `RefreshCwIcon`, `CheckCircleIcon`, `AlertCircleIcon`).
  - In `orders-page.tsx:567-595` and `device-outbox-sheet.tsx:195-225`, local outbox order badges render text badges (`Waiting to sync`, `Syncing...`, `Synced`, `Conflict`) **without any icon**.
  - **Result**: **VERIFIED-FAIL** ([F-066](findings/F-066.md)).

### 4.4 Toast Notifications & Activity Persistence
- **Requirement**: Toasts must expose `role="status"`, adequate duration, pause on hover or focus, and provide a persistent place to retrieve messages again.
- **Observed**:
  - In `sonner.tsx`, rendered toast elements lack `role="status"` and `aria-live="polite"`. Screen readers do not announce toast appearances.
  - Toasts pause when hovered by mouse, but **do not pause on keyboard focus**.
  - The Notifications drawer in `authenticated-shell.tsx:1240-1265` is hardcoded to a static empty state ("No notifications"). Emitted `toast` events are never stored or logged into the notifications sheet. Once a toast auto-dismisses after 4 seconds, the message is permanently lost.
  - **Result**: **VERIFIED-FAIL** ([F-065](findings/F-065.md)).

---

## 5. Page and Route Transitions

### 5.1 Focus Management on Route Navigation (WCAG 2.4.3 & 1.3.2)
- **Requirement**: Focus management is maintained across client-side router page transitions.
- **Observed**:
  - In `authenticated-shell.tsx:1182`, `<main id="main-content">` defines `tabIndex={-1}`.
  - However, no navigation listener or effect shifts focus to `#main-content` or the page `<h1>` when `location.pathname` changes.
  - Live Playwright trace in `route-transition-audit.json`:
    - After navigating from `/orders` to `/stock` via the sidebar navigation, `document.activeElement` remains the clicked `<a href="/stock">` link in the sidebar DOM.
    - Subsequent `Tab` presses navigate through remaining sidebar navigation links rather than entering the newly mounted page view.
- **Result**: **VERIFIED-FAIL** ([F-068](findings/F-068.md)).

### 5.2 Scroll Position Handling
- **Requirement**: Vertical scroll position must reset to top on route change or restore previous position on back/forward navigation.
- **Observed**:
  - The application lacks `<ScrollRestoration />` in `app.tsx`.
  - Furthermore, scrolling occurs inside an internal `overflow-y: auto` container (`<main id="main-content">`) rather than `window`. Navigating between long pages leaves `#main-content` pre-scrolled down.
- **Result**: **VERIFIED-FAIL** ([F-069](findings/F-069.md)).

### 5.3 Blank Screen Flash Prevention
- **Requirement**: No blank white flashes during dynamic code-split route transitions.
- **Observed**:
  - `AuthenticatedLayout` provides `<AuthenticatedShellSkeleton>` and `<RouteLoadingFallback>` with identical structural dimensions to the authenticated shell, eliminating CLS and blank flashes during lazy route chunk loading.
- **Result**: **VERIFIED-PASS**.

---

## 6. AI Slop Motion Scan

Per Anti-Slop Guidelines, the client codebase was audited for ungrounded AI aesthetic cliches:
1. **Parallax Scrolling**: None found (`hasParallax: false`).
2. **Floating Blobs / Organic Shapes**: None found (`hasFloatingBlobs: false`).
3. **Animated Background Gradients**: None found (`hasGradientAnimation: false`).
4. **Bouncing Icons (`animate-bounce`)**: None found (`hasBouncingIcons: false`).
5. **Meaningless Count-Up Numbers / Tickers**: None found (`hasCountUpTickers: false`).

**Conclusion**: The application's motion design is sober, utilitarian, and strictly food-manufacturing domain oriented. Zero AI slop animations are present.

---

## 7. Phase 9 Findings Summary Table

| Finding ID | Title | Severity | Category | Standards Violated | Status |
| :--- | :--- | :---: | :--- | :--- | :---: |
| [**F-062**](findings/F-062.md) | Continuous Pulsing Sync Badges and Skeletons Lack Pause/Stop/Hide Controls | P2 | Accessibility / Motion | WCAG 2.2 SC 2.2.2 (Level A) | **OPEN** |
| [**F-063**](findings/F-063.md) | Width and Height Animated in Sidebar Transition and Collapsible Triggering Reflow | P2 | Performance / Layout | Web Vitals, NN/g Latency | **OPEN** |
| [**F-064**](findings/F-064.md) | Disabled Buttons Set `pointer-events: none`, Suppressing `cursor: not-allowed` | P2 | Feedback / Affordance | WCAG 4.1.2, Anti-Slop R-39 | **OPEN** |
| [**F-065**](findings/F-065.md) | Sonner Toasts Missing `role="status"`, Pause on Focus, and Persistent Store | P1 | Accessibility / Feedback | WCAG 4.1.3, 2.2.1, 1.4.13 | **OPEN** |
| [**F-066**](findings/F-066.md) | Outbox Sync Status Badges Display Text Without Status Icons | P2 | Accessibility / Visual | WCAG 1.4.1 (Level A) | **OPEN** |
| [**F-067**](findings/F-067.md) | Missing Optimistic Mutations with Rollback Handlers Across Server Workflows | P2 | Architecture / Latency | TanStack Query v5, NN/g | **OPEN** |
| [**F-068**](findings/F-068.md) | Route Transitions Fail to Reset Focus to `<main>` or `<h1>` | P1 | Accessibility / SPA Routing | WCAG 2.4.3, 1.3.2, WAI-ARIA APG | **OPEN** |
| [**F-069**](findings/F-069.md) | Missing Scroll Restoration on Route Navigation in `<main>` Container | P2 | Usability / Routing | React Router DOM Spec, NN/g | **OPEN** |

---

## 8. Verified Pass Summary

The following criteria and motion characteristics are **VERIFIED-PASS**:
1. **WCAG 2.3.3 Animation from Interactions (Level AAA)**: Fully satisfied via `@media (prefers-reduced-motion: reduce)` in `index.css`.
2. **WCAG 2.3.1 Three Flashes or Below Threshold (Level A)**: Fully satisfied (all animations operate at 0.5 Hz - 1.0 Hz, well below 3.0 Hz).
3. **Interaction to Next Paint (INP < 200 ms)**: Fully satisfied (all 9 measured interactions completed between 93ms and 161ms).
4. **Cumulative Layout Shift from Motion (CLS < 0.1)**: Fully satisfied (measured `0.000` shift during dialog, toast, and drawer activations).
5. **Entrance Animation Duration (< 300 ms)**: Fully satisfied across all dialogs, alerts, and sheet modals (150ms - 200ms).
6. **Absence of AI Slop Motion**: Fully satisfied (zero parallax, blobs, animated gradients, or meaningless count-up tickers).
