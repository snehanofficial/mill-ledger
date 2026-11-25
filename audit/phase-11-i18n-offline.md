# Phase 11 Audit Report: Internationalization (i18n), Tamil Localization & Offline Outbox Synchronization

- **Audit Date**: 2026-11-19
- **Auditor**: Principal Accessibility Specialist, Systems Auditor & Application Security Reviewer
- **Target Standards & Specifications**:
  - `Problem_Statement_Winter_Internship_Application_2026.md`:
    - Section 6 ("Tamil language interface for floor staff")
    - Section 5 ("Salesman offline order capture and synchronization")
  - MillLedger Implementation Authority & Specifications:
    - [`docs/offline-sync.md`](file:///home/snehan/projects/web/mill-ledger/docs/offline-sync.md) (PWA cache, Dexie IndexedDB, and exactly-once sync)
    - [`docs/business-rules.md`](file:///home/snehan/projects/web/mill-ledger/docs/business-rules.md) (BR-021 Stock Allocation & Conflict Triage)
    - [`audit/01-expected-spec.md`](file:///home/snehan/projects/web/mill-ledger/audit/01-expected-spec.md) (REQ-050, REQ-051, REQ-052, REQ-053)
  - Accessibility & Internationalization Standards:
    - WCAG 2.2 SC 3.1.1 Language of Page (Level A)
    - WCAG 2.2 SC 3.1.2 Language of Parts (Level AA)
    - W3C Internationalization Best Practices: Numbers, Currencies, Dates & Unicode Collation (UTS #10)
    - Nielsen Norman Group Heuristics #3 (User Control and Freedom) & #5 (Error Prevention)
  - Security & Privacy Standards:
    - OWASP Top 10:2021 A01:2021 (Broken Access Control) & A02:2021 (Cryptographic Failures)
    - OWASP ASVS v4.0.3 Sec 3.5.3, 8.3, 11.1.4
    - Digital Personal Data Protection Act (DPDP Act 2023, India) Sec 8
- **Evaluation Environment**:
  - Operating System: Linux x86_64
  - Runtime: Node.js v22.22.1 / PostgreSQL 16 (Local throwaway database `mill_ledger_audit_throwaway`)
  - Server Mode: Vite 6 Client (`http://127.0.0.1:4173`) + Express 5 API (`http://127.0.0.1:4000`)
  - Browser Automation: Playwright v1.65.1 (Chromium headless with real network throttling & CDP offline emulation)
- **Saved Evidence Artifacts**:
  - AST / Regex String Inventory: [`audit/evidence/i18n-string-inventory.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/i18n-string-inventory.json)
  - Tamil Route Visual Audit & Node Counts: [`audit/evidence/i18n/tamil-localization-audit.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/i18n/tamil-localization-audit.json)
  - 14 Route Screenshots in Tamil (`audit/evidence/i18n/`):
    - Login: [`audit/evidence/i18n/route-login-ta.png`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/i18n/route-login-ta.png)
    - Dashboard: [`audit/evidence/i18n/route-dashboard-ta.png`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/i18n/route-dashboard-ta.png)
    - Orders List: [`audit/evidence/i18n/route-orders-ta.png`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/i18n/route-orders-ta.png)
    - New Order: [`audit/evidence/i18n/route-orders-new-ta.png`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/i18n/route-orders-new-ta.png)
    - Stock Balances: [`audit/evidence/i18n/route-stock-ta.png`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/i18n/route-stock-ta.png)
    - Production Today: [`audit/evidence/i18n/route-production-today-ta.png`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/i18n/route-production-today-ta.png)
    - Invoices: [`audit/evidence/i18n/route-invoices-ta.png`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/i18n/route-invoices-ta.png)
    - Dispatch: [`audit/evidence/i18n/route-dispatch-ta.png`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/i18n/route-dispatch-ta.png)
    - Payments: [`audit/evidence/i18n/route-payments-ta.png`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/i18n/route-payments-ta.png)
    - Customers: [`audit/evidence/i18n/route-customers-ta.png`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/i18n/route-customers-ta.png)
    - Reports (Sales): [`audit/evidence/i18n/route-reports-sales-ta.png`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/i18n/route-reports-sales-ta.png)
    - Reports (Stock): [`audit/evidence/i18n/route-reports-stock-ta.png`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/i18n/route-reports-stock-ta.png)
    - Reports (GST): [`audit/evidence/i18n/route-reports-gst-ta.png`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/i18n/route-reports-gst-ta.png)
    - Outbox Drawer: [`audit/evidence/i18n/outbox-sheet-ta.png`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/i18n/outbox-sheet-ta.png)
  - Offline Sync Scenario Results (`audit/evidence/offline/`):
    - Scenario 1 (Replay & Persistence): [`audit/evidence/offline/scenario-1-result.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/offline/scenario-1-result.json)
    - Scenario 2 (Stock Shortage Conflict): [`audit/evidence/offline/scenario-2-stock-conflict.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/offline/scenario-2-stock-conflict.json)
    - Scenario 3 (Session Expired / 401): [`audit/evidence/offline/scenario-3-session-expired.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/offline/scenario-3-session-expired.json)
    - Scenario 4 (Idempotency Key Verification): [`audit/evidence/offline/scenario-4-idempotency.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/offline/scenario-4-idempotency.json)
    - Scenario 5 (Server Rejects Mid-Queue): [`audit/evidence/offline/scenario-5-mid-queue.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/offline/scenario-5-mid-queue.json)
    - Scenario 6 (Corrupt Queue Entry): [`audit/evidence/offline/scenario-6-corrupt-entry.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/offline/scenario-6-corrupt-entry.json)
    - Scenario 7 (Storage Quota): [`audit/evidence/offline/scenario-7-quota.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/offline/scenario-7-quota.json)
    - Scenario 8 (Two Tabs Web Locks Mutex): [`audit/evidence/offline/scenario-8-two-tabs-mutex.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/offline/scenario-8-two-tabs-mutex.json)
    - UI Outbox Discard & Retry Audit: [`audit/evidence/offline/ui-outbox-discard-audit.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/offline/ui-outbox-discard-audit.json)
    - UI Outbox Screenshot: [`audit/evidence/offline/outbox-sheet-ui.png`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/offline/outbox-sheet-ui.png)
  - Dexie Logout Security Proof: [`audit/evidence/dexie-logout-audit.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/dexie-logout-audit.json)

---

## 1. Executive Summary

Phase 11 conducted an empirical, multi-tier audit of the internationalization (i18n) layer and the client-side offline outbox synchronization engine (Dexie IndexedDB) in MillLedger.

### Key Audit Findings:
1. **Cosmetic Bilingual Interface with 99.5% Untranslated English (F-080, P1)**: While the application claims full bilingual support toggled on the shell for floor staff, an AST code scan revealed **755 user-visible strings** (674 JSX text nodes, 15 placeholders, 21 aria-labels, 32 titles, 13 toasts) completely hardcoded in English. The translation function `t(...)` is called **only 4 times** across the entire project (restricted to mobile bottom navigation links). On every core operational page (`/production/today`, `/orders`, `/stock`, `/invoices`), **over 90% to 99.8% of DOM text nodes remain in English**.
2. **Immediate Destructive Outbox Order Discard Without Confirmation (F-081, P1)**: Clicking "Discard" on a pending or conflicted offline order in the Device Outbox immediately executes `offlineDb.outbox.delete(orderId)` with **zero confirmation dialog** (no `AlertDialog`, modal, or browser confirm). An accidental single tap permanently destroys uncommitted distributor orders without recovery.
3. **Corrupt Queue Entry Head-of-Line Blocking Halts Outbox Sync (F-082, P1)**: When an outbox record contains malformed data or missing lines, a JavaScript runtime `TypeError` is caught and misclassified as a `NETWORK_ERROR`. The sync engine resets the status to `"queued"` and breaks the loop. Because orders are processed in strict chronological order, **the corrupt order permanently deadlocks the queue**, blocking all subsequent valid orders from ever synchronizing to the server.
4. **Silent Server Acceptance of Insufficient Stock Offline Orders (F-083, P1)**: Under REQ-052 and Owner Decision #9, offline orders with stock shortages must be placed into an explicit `CONFLICT` queue for manual triage. In reality, the server accepts orders exceeding available stock (tested with 99,999 packets against 0 stock) as `SUBMITTED`, returning HTTP 201. The client marks the order as `synced` with a green badge, hiding inventory shortages from the salesman.
5. **Cleartext Customer PII Persists in IndexedDB Across Logout and User Switch (F-084, P2)**: The logout handler purges only the in-memory React Query cache. Customer names, phone numbers, delivery addresses, and GSTINs remain permanently stored in cleartext in IndexedDB `mill_ledger_offline_db` across sessions and account switches.
6. **Total Absence of Indic/Tamil Number Formatting, Date Localization, and Collation (F-085, P2)**: Over 60 financial displays use raw `.toFixed(2)` without Indian numbering grouping (Lakhs/Crores `1,00,000.00`). Dates are hardcoded to `"en-IN"`, and collation sorting for Tamil text is nonexistent.
7. **Missing Pre-Hydration HTML Lang Attribute Causing FOUC (F-086, P2)**: `index.html` hardcodes `<html lang="en">`. The `lang` attribute is updated only in React `useEffect` after mount, causing a Flash of Untranslated Content and screen reader pronunciation mismatches. Language preferences are stored in global `localStorage` rather than per user.
8. **Absence of Persistent Storage Request Permitting Silent Eviction (F-087, P2)**: The PWA never requests `navigator.storage.persist()`, leaving the offline outbox vulnerable to silent OS storage eviction under disk pressure.

---

## 2. Section A: Internationalization (i18n) & Bilingual UI Audit

### 2.1 AST String Inventory Analysis

An AST analysis script ([`audit/scripts/inventory-untranslated-strings.ts`](file:///home/snehan/projects/web/mill-ledger/audit/scripts/inventory-untranslated-strings.ts)) parsed all TypeScript and TSX files under `client/src/`.

```
============================================================
CLIENT USER-VISIBLE STRING INVENTORY SUMMARY
============================================================
Total User-Visible JSX Text Nodes : 674
Total Input/Textarea Placeholders :  15
Total Accessible aria-labels      :  21
Total HTML Tooltip Titles         :  32
Total User-Facing Toasts          :  13
------------------------------------------------------------
Total User-Facing Client Strings  : 755
Total Calls to Translation t(...) :   4 (0.53% coverage)
Untranslated Strings              : 751 (99.47% unlocalized)
============================================================
```

#### Location of Translation Function Calls
The function `t(key, fallback)` is called in exactly one file:
- [`client/src/components/shell/authenticated-shell.tsx:981-996`](file:///home/snehan/projects/web/mill-ledger/client/src/components/shell/authenticated-shell.tsx#L981-L996):
  1. `t("nav.home", "Home")`
  2. `t("nav.orders", "Orders")`
  3. `t("nav.stock", "Stock")`
  4. `t("nav.more", "More")`

Every other component—including every page, modal, table header, form label, validation error, empty state, and toast notification—hardcodes raw English strings.

---

### 2.2 Route-by-Route Tamil Execution & DOM Verification

Using Playwright with `localStorage.setItem("mill_ledger_lang", "ta")`, every application route was rendered, evaluated via DOM TreeWalker, and screenshotted:

| Route Path | Page Title / Purpose | Total DOM Text Nodes | Tamil Text Nodes | English Text Nodes | % Tamil | Evidence Screenshot | Status |
|:---|:---|:---:|:---:|:---:|:---:|:---|:---:|
| `/auth/login` | Terminal Sign In | 18 | 1 | 17 | **5.5%** | [`route-login-ta.png`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/i18n/route-login-ta.png) | **VERIFIED-FAIL** |
| `/dashboard` | Owner & Admin KPI View | 81 | 5 | 76 | **6.2%** | [`route-dashboard-ta.png`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/i18n/route-dashboard-ta.png) | **VERIFIED-FAIL** |
| `/orders` | Order Ledger Grid | 3,238 | 5 | 3,233 | **0.15%** | [`route-orders-ta.png`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/i18n/route-orders-ta.png) | **VERIFIED-FAIL** |
| `/orders/new` | Order Capture Form | 47 | 5 | 42 | **10.6%** | [`route-orders-new-ta.png`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/i18n/route-orders-new-ta.png) | **VERIFIED-FAIL** |
| `/stock` | Inventory Balances & Shortages | 47 | 5 | 42 | **10.6%** | [`route-stock-ta.png`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/i18n/route-stock-ta.png) | **VERIFIED-FAIL** |
| `/production/today` | Factory Floor Daily Runs | 56 | 5 | 51 | **8.9%** | [`route-production-today-ta.png`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/i18n/route-production-today-ta.png) | **VERIFIED-FAIL** |
| `/invoices` | Sales Tax Invoices & Credit Notes | 48 | 5 | 43 | **10.4%** | [`route-invoices-ta.png`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/i18n/route-invoices-ta.png) | **VERIFIED-FAIL** |
| `/dispatch` | Logistics & Vehicle Packing Notes | 52 | 5 | 47 | **9.6%** | [`route-dispatch-ta.png`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/i18n/route-dispatch-ta.png) | **VERIFIED-FAIL** |
| `/payments` | Collections & Customer Aging | 99 | 5 | 94 | **5.1%** | [`route-payments-ta.png`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/i18n/route-payments-ta.png) | **VERIFIED-FAIL** |
| `/customers` | Directory & Ledger Balances | 72 | 5 | 67 | **6.9%** | [`route-customers-ta.png`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/i18n/route-customers-ta.png) | **VERIFIED-FAIL** |
| `/reports/sales` | Taxable Turnover & Summary | 70 | 5 | 65 | **7.1%** | [`route-reports-sales-ta.png`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/i18n/route-reports-sales-ta.png) | **VERIFIED-FAIL** |
| `/reports/stock` | Valuation & Weighted Avg Cost | 153 | 5 | 148 | **3.3%** | [`route-reports-stock-ta.png`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/i18n/route-reports-stock-ta.png) | **VERIFIED-FAIL** |
| `/reports/gst` | GSTR-1 Outward Supplies Matrix | 66 | 5 | 61 | **7.6%** | [`route-reports-gst-ta.png`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/i18n/route-reports-gst-ta.png) | **VERIFIED-FAIL** |
| Outbox Drawer | Local Dexie Command Queue | 24 | 0 | 24 | **0.0%** | [`outbox-sheet-ta.png`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/i18n/outbox-sheet-ta.png) | **VERIFIED-FAIL** |

#### The Constant "5 Tamil Nodes" Phenomenon
Across all 13 authenticated routes, exactly 5 Tamil text nodes were rendered in the entire document tree:
1. `"முதன்மை பகுதிக்குச் செல்லவும்"` (Hidden accessibility skip link in `authenticated-shell.tsx:850`)
2. `"முகப்பு"` (Mobile navigation Home in `authenticated-shell.tsx:981`)
3. `"விற்பனை ஆணைகள்"` (Mobile navigation Orders in `authenticated-shell.tsx:986`)
4. `"சரக்கு இருப்பு"` (Mobile navigation Stock in `authenticated-shell.tsx:991`)
5. `"மேலும்"` (Mobile navigation More in `authenticated-shell.tsx:996`)

The primary desktop sidebar navigation ("Overview", "Operations", "Inventory", "Production", "Reports"), top breadcrumbs, table columns, form inputs, modal dialogs, status badges, and action buttons remained 100% in English.

---

### 2.3 Dictionary & Linguistic Limitations

1. **Dictionary Coverage**:
   - [`client/src/lib/i18n-dictionary.ts`](file:///home/snehan/projects/web/mill-ledger/client/src/lib/i18n-dictionary.ts) defines only **33 translation keys**.
   - Over 150 essential business terms (e.g. `raw_material`, `packaging`, `variance`, `batch_number`, `yield_percentage`, `damaged_pouch`, `credit_note`, `outstanding_balance`) are completely absent from the dictionary.
2. **String Concatenation & Agglutinative Grammar Violations**:
   - The application relies on English Subject-Verb-Object (SVO) string concatenation:
     - `client/src/components/shell/device-outbox-sheet.tsx:237`: `<span>Total ({totalItems} pkts)</span>`
     - `client/src/components/shell/device-outbox-sheet.tsx:89`: `{conflictCount} conflict{conflictCount > 1 ? "s" : ""}`
     - `client/src/components/shell/device-outbox-sheet.tsx:211`: `Synced: {ord.serverOrderNumber ?? "Accepted"}`
   - Tamil is an agglutinative Subject-Object-Verb (SOV) language requiring postpositional case markers (வேற்றுமை உருபுகள்: -ஐ, -ஆல், -க்கு, -இல்). String concatenation of English numbers and suffixes directly breaks Tamil syntax and semantic comprehension.
3. **Absence of Pluralization Logic**:
   - The dictionary provides zero plural support (no `zero`, `one`, `other` ICU category selectors). Hardcoded ternary operators (`conflictCount > 1 ? "s" : ""`) append English suffix `-s` onto Tamil numerals.
4. **Text Expansion & Layout Collision**:
   - Tamil script expands horizontal character counts by 40% to 440%:
     - "Retry" (5 chars) → "மீண்டும் முயற்சி செய்" (22 chars, **+340% expansion**)
     - "Orders" (6 chars) → "விற்பனை ஆணைகள்" (15 chars, **+150% expansion**)
     - "Taxable" (7 chars) → "வரிக்குரிய மதிப்பு" (18 chars, **+157% expansion**)
     - "Waiting to sync" (15 chars) → "ஒத்திசைக்க காத்திருக்கிறது" (25 chars, **+66% expansion**)
   - In [`client/src/components/shell/device-outbox-sheet.tsx:258`](file:///home/snehan/projects/web/mill-ledger/client/src/components/shell/device-outbox-sheet.tsx#L258), the retry button uses fixed sizing `className="h-6 px-2 text-2xs"`. Rendering 22 characters of Tamil text forces horizontal overflow and text clipping.
5. **Tamil Font Loading & Line-Height Clipping**:
   - As documented in finding **F-079**, [`client/src/index.css`](file:///home/snehan/projects/web/mill-ledger/client/src/index.css#L1) loads `@fontsource-variable/geist` with Cyrillic and Vietnamese subsets, but bundles **zero Tamil web fonts** (e.g. Noto Sans Tamil).
   - Tamil vowels and combined matras (e.g. ொ, ோ, ௌ, ி, ீ, ு, ூ) extend significantly above the ascender line and below the descender line. Tight line heights (`leading-none`, `leading-tight`, `h-6`) clip the upper vowel signs (கொம்பு) and lower u-karam hooks.
6. **Pre-Hydration FOUC & User Scoping**:
   - [`client/index.html:2`](file:///home/snehan/projects/web/mill-ledger/client/index.html#L2) sets `<html lang="en">`.
   - The `lang` attribute is updated asynchronously in `useEffect` ([`client/src/lib/i18n.tsx:108`](file:///home/snehan/projects/web/mill-ledger/client/src/lib/i18n.tsx#L108)), creating a Flash of Untranslated Content (FOUC).
   - Preferences are stored in global `localStorage.setItem("mill_ledger_lang")` without user-scoping, bleeding state between distinct user accounts on the same workstation.

---

## 3. Section B: Offline Synchronization (Dexie Outbox Engine) Audit

The offline sync engine ([`client/src/offline/`](file:///home/snehan/projects/web/mill-ledger/client/src/offline/)) was tested across 8 real network emulation scenarios in Playwright with Chrome DevTools Protocol network throttling and disconnects.

```
====================================================================================================
OFFLINE SYNC & DEXIE OUTBOX SCENARIO RESULTS (E2E PLAYWRIGHT EMULATION)
====================================================================================================
Scenario 1: Offline Creation, Restart, Reconnect, Double Replay : VERIFIED-PASS (Idempotent 1-order)
Scenario 2: Stock Changed Meanwhile (Insufficient Stock at Sync): VERIFIED-FAIL (Silent acceptance)
Scenario 3: Session Expired During Replay (HTTP 401)            : VERIFIED-PASS (Loop broke safely)
Scenario 4: Duplicate Client IDs / Idempotency Key Replay       : VERIFIED-PASS (HTTP 201 deduplicated)
Scenario 5: Server Rejects Mid-Queue (403 Authorization)        : VERIFIED-PASS (Order 2 quarantined)
Scenario 6: Corrupt Queue Entry (Malformed Items / Lines)       : VERIFIED-FAIL (Permanent queue deadlock)
Scenario 7: Storage Quota & Eviction Resilience                : VERIFIED-FAIL (No persist() request)
Scenario 8: Two Tabs Concurrently Processing Outbox             : VERIFIED-PASS (Web Locks Mutex passed)
----------------------------------------------------------------------------------------------------
UI Outbox Sheet: Pending Count & Item Status Badges             : VERIFIED-PASS (Badges render)
UI Outbox Sheet: Discard Confirmation Dialog                    : VERIFIED-FAIL (Zero confirmation)
UI Outbox Sheet: Data Recovery / Trash Bin                      : VERIFIED-FAIL (Hard delete)
Client Storage Privacy: IndexedDB Purged on Logout / User Switch : VERIFIED-FAIL (PII persisted)
====================================================================================================
```

---

### 3.1 Scenario Analysis & Empirical Observations

#### Scenario 1: Offline Creation, Restart, Reconnect, Double Replay
- **Protocol**: Salesman disconnects (`setOffline(true)`), queues order for Retailer A (5 pkts Murukku, ₹250), restarts browser context, verifies IndexedDB persistence, reconnects network, and triggers `processOutbox()` twice in succession.
- **Observed Behavior**:
  - Offline order correctly written to Dexie `outbox` table with status `"queued"` ([`scenario-1-result.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/offline/scenario-1-result.json)).
  - Order persisted across browser context restart.
  - On reconnect, first sync run processed 1 order and marked status `"synced"` with `serverOrderId: "cmwnvrwh60000hkab0plq3n4f"`.
  - Second replay run executed idempotently (`{ processed: 0, succeeded: 0, conflicts: 0 }`).
- **Verdict**: **VERIFIED-PASS**.

---

#### Scenario 2: Stock Changed Meanwhile (Server Stock Insufficient at Sync Time)
- **Protocol**: Salesman queues offline order for 99,999 packets of Murukku (far exceeding current factory unreserved stock of 50 packets). Client reconnects and synchronizes outbox.
- **Expected (REQ-052 / Owner Decision #9)**: Server must detect stock shortage, set order status to `CONFLICT`, refrain from reserving inventory, and route order into the Admin Conflict Queue. Outbox must show amber/red `Conflict` status.
- **Observed Behavior** ([`scenario-2-stock-conflict.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/offline/scenario-2-stock-conflict.json)):
  - Server responded with HTTP 201 Created and order status `SUBMITTED`.
  - Client sync engine marked local outbox order as `status: "synced"` with `serverOrderId: "cmwnvryo80002hkabdgy1od6r"`.
  - The salesman UI displayed a green checkmark indicating successful order booking, silently hiding the complete absence of inventory from both salesman and customer.
- **Verdict**: **VERIFIED-FAIL (F-083)**.

---

#### Scenario 3: Session Expired During Replay (HTTP 401 Unauthorized)
- **Protocol**: Salesman queues offline order. Session cookie is cleared to simulate expired auth token. Sync loop triggers.
- **Observed Behavior** ([`scenario-3-session-expired.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/offline/scenario-3-session-expired.json)):
  - API returned `HTTP 401 Unauthorized: Session required`.
  - Sync engine caught 401, updated order to `attempts: 1`, `lastErrorCode: "HTTP_401"`, and executed `break`.
  - Outbox status remained `"queued"`, preventing order destruction or corruption.
  - **Limitation**: No re-authentication toast or modal was presented to prompt the salesman to sign back in.
- **Verdict**: **VERIFIED-PASS** (Resilience verified; lack of UX re-auth alert noted).

---

#### Scenario 4: Duplicate Client IDs / Idempotency Key Verification
- **Protocol**: Client submits identical `POST /api/v1/sales/orders` twice with `idempotencyKey: "idem-dup-..."`.
- **Observed Behavior** ([`scenario-4-idempotency.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/offline/scenario-4-idempotency.json)):
  - Request 1 returned HTTP 201 with `order.id = "cmwnvs1en0004hkabh4bgzi1z"`.
  - Request 2 returned HTTP 201 with identical `order.id = "cmwnvs1en0004hkabh4bgzi1z"`.
  - Database count confirmed exactly 1 order record created.
- **Verdict**: **VERIFIED-PASS**.

---

#### Scenario 5: Server Rejects Mid-Queue (403 Authorization Conflict)
- **Protocol**: Outbox populated with 3 orders: Order 1 (valid Retailer A), Order 2 (unassigned customer Distributor B, forbidden for Salesman 1), Order 3 (valid Retailer A). Sync loop executes.
- **Observed Behavior** ([`scenario-5-mid-queue.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/offline/scenario-5-mid-queue.json)):
  - Order 1: `status = "synced"`
  - Order 2: Server returned HTTP 403 (`Salesman is not assigned to customer Distributor B`). Engine marked `status = "conflict"`, recorded error message, and continued the loop without aborting.
  - Order 3: `status = "synced"`
  - Summary: `{ processed: 3, succeeded: 2, conflicts: 1 }`.
- **Verdict**: **VERIFIED-PASS**.

---

#### Scenario 6: Corrupt Queue Entry (Malformed Items / Missing Array)
- **Protocol**: Insert an invalid outbox record where `items` is `undefined` (simulating storage corruption or schema migration error). Run `processOutbox()`.
- **Observed Behavior** ([`scenario-6-corrupt-entry.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/offline/scenario-6-corrupt-entry.json)):
  - `sync-engine.ts:208` threw `TypeError: Cannot read properties of undefined (reading 'map')`.
  - Catch block checked `err.response?.status`, which is undefined for client runtime exceptions.
  - Fell through to `else` branch, resetting the corrupt order status to `"queued"` with `lastErrorCode: "NETWORK_ERROR"`, and executed `break`.
  - **Head-of-Line Blocking**: On every subsequent sync attempt, the loop selects this corrupt record first and immediately terminates, permanently freezing all valid offline orders behind it.
- **Verdict**: **VERIFIED-FAIL (F-082)**.

---

#### Scenario 7: Storage Quota & Eviction Resilience
- **Protocol**: Query `navigator.storage.estimate()` and inspect whether persistent storage is requested.
- **Observed Behavior** ([`scenario-7-quota.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/offline/scenario-7-quota.json)):
  - Browser reports 10 GB quota available (`hasPersistentStorageApi: true`).
  - Search across codebase confirms `navigator.storage.persist()` is **never called**.
  - Mobile browsers operating in default best-effort mode will silently evict the database under low-disk conditions.
- **Verdict**: **VERIFIED-FAIL (F-087)**.

---

#### Scenario 8: Two Tabs Concurrently Processing Outbox (Web Locks Mutex)
- **Protocol**: Open two browser tabs logged in as same salesman. Populate outbox. Trigger `processOutbox()` concurrently from both tabs via `Promise.all`.
- **Observed Behavior** ([`scenario-8-two-tabs-mutex.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/offline/scenario-8-two-tabs-mutex.json)):
  - Tab 1 acquired `navigator.locks.request("mill-ledger-outbox-sync", { ifAvailable: true })` and processed 1 order (`{ processed: 1, succeeded: 1 }`).
  - Tab 2 encountered locked mutex and immediately exited cleanly (`{ processed: 0, succeeded: 0 }`).
  - Zero duplicate order submissions or race conditions occurred.
- **Verdict**: **VERIFIED-PASS**.

---

### 3.2 UI Evaluation: Device Outbox Sheet

Evaluated in Playwright ([`ui-outbox-discard-audit.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/offline/ui-outbox-discard-audit.json)):

1. **Pending Count Badge**: Rendered in shell header sync button and outbox header (**VERIFIED-PASS**).
2. **Per-Item State Badges**: Distinct visual badges for `"Waiting to sync"`, `"Syncing..."`, `"Synced: SO-XXXX"`, and `"Conflict: HTTP_403"` (**VERIFIED-PASS**).
3. **Manual Retry Button**: "Retry" button renders for conflict orders and re-queues them into `"queued"` status (**VERIFIED-PASS**).
4. **Discard Confirmation**: Clicking "Discard" directly invokes `removeOrder(ord.id)` without confirmation dialog. Modal count = 0, native dialog = false (**VERIFIED-FAIL - F-081**).
5. **Data Recovery**: Discarded records are immediately hard-deleted from IndexedDB via `outbox.delete(id)`. No undo, trash bin, or recovery mechanism exists (**VERIFIED-FAIL - F-081**).
6. **Conflict Explanation**: Plain language error messages from server (e.g. "Salesman is not assigned to customer Retailer A") render in an alert box with an `AlertTriangleIcon` (**VERIFIED-PASS**).

---

### 3.3 Privacy & Data Retention: IndexedDB Inspection

Evaluated in Playwright ([`audit/evidence/dexie-logout-audit.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/dexie-logout-audit.json)):

1. **Stored Tables in IndexedDB**:
   - `customers`: Customer ID, business code, full legal name, state, GSTIN, mobile phone number, delivery address, organization ID.
   - `products`: Product ID, SKU, product name, default selling price, GST tax rate, unit of measure, HSN code.
   - `outbox`: Client UUID, idempotency keys, customer names/states, item lines, quoted unit prices, delivery notes.
   - `meta`: Master data sync timestamps.
2. **Persistence on Logout**:
   - `handleSignOut()` in [`authenticated-layout.tsx:68`](file:///home/snehan/projects/web/mill-ledger/client/src/layouts/authenticated-layout.tsx#L68) clears only `queryClient`.
   - Dexie tables `customers`, `products`, `outbox`, and `meta` remain 100% intact after logout (**VERIFIED-FAIL - F-084**).
3. **Persistence on User Switch**:
   - Logging into another account on the same browser leaves previous customer records accessible in IndexedDB until `refreshMasterDataSnapshot()` completes. Any offline orders left in `outbox` from previous users remain stored in the browser (**VERIFIED-FAIL - F-084**).

---

## 4. Findings Register (Phase 11)

| Finding ID | Severity | Category | Title | Standard Reference | Status |
|:---|:---:|:---|:---|:---|:---:|
| **F-080** | **P1** | i18n / Accessibility | Untranslated User Interface Across 100% of Application Routes (755 Hardcoded Strings vs 4 Translated Navigation Items) | WCAG 2.2 SC 3.1.2, REQ-053 | **OPEN** |
| **F-081** | **P1** | Data Integrity / UX | Immediate Destructive Outbox Order Discard Without Confirmation Dialog and Irrevocable Data Loss | NN/g #5, REQ-052 | **OPEN** |
| **F-082** | **P1** | Offline Sync | Corrupt Outbox Queue Entry Head-of-Line Blocking Halts All Subsequent Offline Order Synchronization | ISO 25010, REQ-050 | **OPEN** |
| **F-083** | **P1** | Inventory Invariants | Silent Server Acceptance of Insufficient Stock Offline Orders Violating Explicit Conflict Queue Requirement | REQ-052, BR-021 | **OPEN** |
| **F-084** | **P2** | Privacy / Security | Plaintext Sensitive Customer PII and Outbox Orders Persist in IndexedDB Across User Logout and Account Switches | OWASP A01/A02, DPDP Act Sec 8 | **OPEN** |
| **F-085** | **P2** | Localization / Math | Complete Absence of Indic/Tamil Number Formatting, Date Localization, and Collation (Sorting) | W3C i18n, RBI Lakh/Crore | **OPEN** |
| **F-086** | **P2** | Accessibility | Missing Pre-Hydration HTML Lang Synchronization and Non-User-Scoped Language Preference Causing FOUC | WCAG 2.2 SC 3.1.1 | **OPEN** |
| **F-087** | **P2** | PWA Architecture | Absence of Persistent Storage Request Permitting Silent Browser Eviction of Offline Outbox Queue | W3C Storage API, REQ-050 | **OPEN** |

---

## 5. Traceability Matrix & Requirements Status

| Requirement ID | Specification Statement | Verification Method | Observed Result | Status |
|:---|:---|:---|:---|:---:|
| **REQ-050** | Offline Outbox Storage in Client IndexedDB (Dexie) | Playwright offline emulation | Outbox creates queued records in IndexedDB offline; persists across browser exit. | **VERIFIED-PASS** |
| **REQ-051** | Idempotent Server Sync Replay with Idempotency Key | API & Playwright double replay | Exact same order ID returned on duplicate submissions; 1 record in DB. | **VERIFIED-PASS** |
| **REQ-052** | Sync State Tracking and Explicit Conflict Queue Triage | Playwright stock & auth tests | Outbox tracks queued/syncing/synced/conflict; BUT stock shortages are accepted as SUBMITTED instead of CONFLICT, and discard lacks confirmation. | **VERIFIED-FAIL** |
| **REQ-053** | Bilingual UI Language Toggle (Tamil / English) | AST scan & Playwright visual audit | Language toggle present in header; BUT 755 strings remain in English; only 4 mobile links translated. | **VERIFIED-FAIL** |
