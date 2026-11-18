# MillLedger — Enterprise-Grade Codebase Audit, Security Assessment & Production Readiness Review

**Document Reference:** `MLA-PRR-2026-M11`  
**Assessment Date:** November 18, 2026  
**Repository Branch:** `main` (`ee98f99`)  
**Auditing Body:** Principal Engineering Review Board (Architecture, Full-Stack, AppSec, Database, DevOps, QA, Accessibility, Design, Performance)  
**Target Release Gate:** Production Readiness & General Availability (GA)

---

## Executive Summary

An exhaustive, multi-disciplinary codebase audit and empirical security assessment of the MillLedger repository was performed following the completion of Milestone 11. While the project exhibits rigorous domain adherence to the benchmark specifications in [benchmark.md](/docs/benchmark.md) (passing all 18 numerical oracle assertions and 61 backend automated tests), **the application is currently NOT READY for production deployment**.

The audit identified critical architectural, security, functional, and operational blockers that must be resolved prior to commercial release:

1. **Authentication Lockout & Missing Trusted Origins (P0):** The backend Better Auth configuration completely omits `trustedOrigins`, causing all cross-origin requests from the client (e.g. `http://localhost:5173`) to `POST /api/auth/sign-in/email` to be rejected with HTTP 403 `{"message":"Invalid origin","code":"INVALID_ORIGIN"}`. Furthermore, the frontend `/auth/login` route renders an empty placeholder card with zero input fields, zero password controls, and zero submission logic. In production builds (`import.meta.env.DEV === false`), unauthenticated users are permanently trapped on this non-functional login screen.
2. **Missing Multi-Tenant Isolation & BOLA (P0):** In the Prisma schema, the `User` model lacks an `organizationId` foreign key and `@mill-ledger/shared`'s `UserContext` omits tenant identity. API controllers resolve `organizationId` from client query parameters or request bodies without verifying user tenancy, exposing an unmitigated Broken Object Level Authorization (BOLA) vulnerability across organizations.
3. **Broken Landing Page (404 Route Conflict) (P0):** In `server/src/app.ts`, `app.use("/api/v1/dashboard", reportingRouter)` was mounted where `reportingRouter` defined `get("/dashboard")`, exposing `/api/v1/dashboard/dashboard`. Consequently, the frontend dashboard request to `/api/v1/dashboard?organizationId=MILL` fails with HTTP 404 on initial load.
4. **Missing Database Migration Ledger & Unenforced DB Constraints (P0):** The `server/prisma/migrations/` directory is entirely absent. The database was provisioned via non-deterministic `prisma db push`. Essential integrity constraints (`CHECK (current_stock >= 0)`, `CHECK (taxable_amount >= 0)`) do not exist in the database engine.
5. **Insecure Default Secret Fallback (P1):** `server/src/config/env.ts` silently falls back to `"mill-ledger-development-secret-123456"` when `BETTER_AUTH_SECRET` is unset, violating fail-loud requirements and risking session forgery in production.
6. **Dead Shell Sign-Out Control (P1):** `<AuthenticatedShell>` is instantiated in `AuthenticatedLayout` without passing `onSignOut`. Clicking "Sign out" in the user dropdown executes a no-op, preventing users from terminating sessions.
7. **Monolithic Bundle & Zero Route-Level Code Splitting (P1):** Every application portal is statically imported in `client/src/app.tsx`, producing a single 984.61 kB minified JavaScript chunk and triggering Vite bundle warnings.
8. **Catastrophic N+1 Balance Aggregation (P1):** `getInventoryBalances` executes two sequential SQL queries per SKU inside an unbatched loop (1,001 SQL queries for 500 items), while `getStockSummaryReport` streams all historical stock movements into Node.js heap memory.
9. **Fake Statistics & Placeholder Views (P1/P2):** Core business domains including Purchases, Customers, Exports, and Settings render placeholder components containing hardcoded AI-slop metrics ("1,429 orders", "68.4% yield") rather than live database records.
10. **Disconnected E2E Testing Suite (P2):** Playwright runs Vite dev server in isolation without launching the Express/PostgreSQL backend. All API requests during E2E testing fail with `ECONNREFUSED 127.0.0.1:4000`, falling back to a client-side mock admin user.

### Overall Production-Readiness Verdict

> **VERDICT: NOT READY**  
> Critical release blockers exist across authentication, tenant authorization, database migrations, and operational readiness. Remediation must follow the prioritized roadmap detailed in Section 24.

---

## Clickable Table of Contents

- [Executive Summary](#executive-summary)
- [1. Audit Methodology and Scope](#1-audit-methodology-and-scope)
- [2. Skills Inventory and Application](#2-skills-inventory-and-application)
- [3. Technology and Dependency Inventory](#3-technology-and-dependency-inventory)
- [4. System Architecture and Data Flows](#4-system-architecture-and-data-flows)
- [5. Requirements and Milestone Traceability](#5-requirements-and-milestone-traceability)
- [6. Functional and End-to-End Workflow Audit](#6-functional-and-end-to-end-workflow-audit)
- [7. Business Logic and Financial Integrity](#7-business-logic-and-financial-integrity)
- [8. Security and OWASP Assessment](#8-security-and-owasp-assessment)
- [9. Deny-by-Default Authorization Assessment](#9-deny-by-default-authorization-assessment)
- [10. UI/UX and Visual Design Assessment](#10-uiux-and-visual-design-assessment)
- [11. Motion, Interaction and Feedback Assessment](#11-motion-interaction-and-feedback-assessment)
- [12. Accessibility and WCAG 2.2 Assessment](#12-accessibility-and-wcag-22-assessment)
- [13. Lazy Loading and Asset Optimization](#13-lazy-loading-and-asset-optimization)
- [14. Image Formats, Content Hashing and Caching](#14-image-formats-content-hashing-and-caching)
- [15. CLS, LCP and Core Web Vitals Assessment](#15-cls-lcp-and-core-web-vitals-assessment)
- [16. Frontend Performance](#16-frontend-performance)
- [17. Backend, API and Database Scalability](#17-backend-api-and-database-scalability)
- [18. Offline-First and PWA Reliability](#18-offline-first-and-pwa-reliability)
- [19. Testing and Automation Quality](#19-testing-and-automation-quality)
- [20. Deployment and Operational Reliability](#20-deployment-and-operational-reliability)
- [21. Architecture and Maintainability](#21-architecture-and-maintainability)
- [22. Consolidated Findings Register](#22-consolidated-findings-register)
- [23. Risk Analysis and Dependency Mapping](#23-risk-analysis-and-dependency-mapping)
- [24. Prioritized Remediation Roadmap](#24-prioritized-remediation-roadmap)
- [25. Production Go-Live Checklist](#25-production-go-live-checklist)
- [26. Final Production-Readiness Verdict](#26-final-production-readiness-verdict)
- [Appendices](#appendices)

---

## 1. Audit Methodology and Scope

The audit was conducted strictly against the real codebase without modifying source files or dependencies. Every finding is substantiated by executed terminal commands, live browser DevTools inspection, HTTP requests, or source code analysis.

### Operational Scope

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         MILLLEDGER MONOREPO                              │
│                                                                          │
│  client/                server/                 shared/                  │
│  ├─ React 19 SPA        ├─ Express 5 API        ├─ Zod Schemas           │
│  ├─ Vite 6 & Tailwind 4 ├─ Better Auth 1.7      ├─ Type Contracts        │
│  ├─ TanStack Query v5   ├─ Prisma 7.10          └─ Shared Enums          │
│  └─ Dexie.js (PWA)      └─ PostgreSQL (pg)                               │
└──────────────────────────────────────────────────────────────────────────┘
```

The review covered:
- Complete source code under `client/src`, `server/src`, `shared/src`, and `server/prisma`.
- Dependency manifests (`package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`).
- Specifications in `docs/` and root historical documentation (`MASTER_PROJECT_PLAN.md`).
- Live running services on `localhost:4000` (API) and `localhost:5173` (Vite client).
- Headless Chrome DevTools instrumentation, PerformanceObserver APIs, and Lighthouse 12.x audits.

---

## 2. Skills Inventory and Application

Pursuant to Phase 0, all project-local and globally installed agent skills were discovered and their authoritative guidance loaded prior to inspecting the implementation.

| Skill Name | Skill Location | Audit Focus Area & Applied Guidance |
|---|---|---|
| `antislop` | `~/.gemini/config/skills/antislop/SKILL.md` | Core anti-slop rules, purpose gate, liveliness test, removal of generic AI motifs. |
| `antislop-ui` | `~/.gemini/config/skills/antislop-ui/SKILL.md` | Color palette restraint, shadow/glass dosaging, component border radii. |
| `antislop-human` | `~/.gemini/config/skills/antislop-human/SKILL.md` | WCAG contrast ratio calculations (4.5:1 / 3.0:1), non-text boundary ratios. |
| `antislop-code` | `~/.gemini/config/skills/antislop-code/SKILL.md` | Comment hygiene and code structure verification. |
| `better-auth-best-practices` | `.agents/skills/better-auth-best-practices/` | Setup workflow, session rotation, adapter wiring, env configuration. |
| `better-auth-security-best-practices` | `.agents/skills/better-auth-security-best-practices/` | Secret entropy (32+ chars), rate limiting storage, CSRF `trustedOrigins`. |
| `security-best-practices` | `.agents/skills/security-best-practices/` | OWASP Top 10, Express/React security, prototype pollution, headers, input validation. |
| `postgresql-best-practices` | `.agents/skills/postgresql-best-practices/` | Indexing concurrency, transaction boundaries, row locking, sequence safety. |
| `prisma-client-api` | `.agents/skills/prisma-client-api/` | Interactive transactions, aggregate performance, relation loads, raw SQL safety. |
| `vercel-react-best-practices` | `.agents/skills/vercel-react-best-practices/` | Eliminating async waterfalls, bundle size optimization, dynamic code splitting. |
| `web-design-guidelines` | `.agents/skills/web-design-guidelines/` | Web interface guidelines, touch targets, accessibility semantics. |
| `playwright-best-practices` | `.agents/skills/playwright-best-practices/` | Browser test reliability, webServer orchestration, network interception. |
| `vitest` | `.agents/skills/vitest/` | Unit test coverage, assertion validity, mocking hygiene. |
| `typescript-strict` | `.agents/skills/typescript-strict/` | Type soundness, avoiding unsafe assertions, `any` elimination. |
| `verification-before-completion` | `.agents/skills/verification-before-completion/` | Evidence-first reporting, executing commands before asserting behavior. |

*Unavailable Skills:* None requested or needed outside the loaded catalog.

---

## 3. Technology and Dependency Inventory

The application utilizes pnpm workspaces across three packages. The table below reflects resolved versions from `pnpm-lock.yaml`:

| Package / Domain | Declared Framework | Resolved Version | Audit Evaluation |
|---|---|---|---|
| Runtime | Node.js | v22.13.10 | Compliant with project standard (Node 22 LTS). |
| Package Manager | pnpm | 12.18.0 | Workspace boundaries well-formed; lockfile committed. |
| Frontend Framework | React | 19.3.1 | React 19 modern runtime; functional hooks utilized. |
| Client Bundler | Vite | 8.3.8 | Rolldown engine; code splitting warning triggered. |
| UI Styling | Tailwind CSS | 4.0.9 | Modern CSS theme integration via `@theme inline`. |
| Component Primitives | Radix UI / Shadcn | 1.8.1 / 4.23.0 | Accessible primitives used for shell dialogs/tooltips. |
| Server Framework | Express | 5.0.1 | Express 5 with native promise support in route handlers. |
| Authentication | Better Auth | 1.7.25 | Modern auth library; misconfigured in `auth.ts`. |
| ORM | Prisma Client | 7.10.1 | Adapter-pg utilized; migrations missing. |
| Database Driver | `pg` / `@prisma/adapter-pg` | 8.13.3 / 7.10.1 | Emits query concurrency deprecation warnings. |
| Client State & Cache | TanStack Query | 5.67.1 | Query deduplication and caching configured. |
| Local IndexedDB | Dexie.js | 4.0.11 | Offline schema configured; lacks multi-tab locks. |

---

## 4. System Architecture and Data Flows

### Architecture Topology

```
[ User Browser / PWA ]
        │
        ▼ (HTTPS / WSS)
[ React 19 Client SPA ] ───(Offline Cache)───► [ Dexie.js IndexedDB ]
        │
        ▼ (REST /api/v1 via Axios)
[ Express 5 Middleware Pipeline ]
        ├─ Helmet (Security Headers)
        ├─ CORS (Configured Origin)
        ├─ Better Auth Handler (/api/auth)
        └─ Auth Middleware (requireAuth, authorize, evaluateAbac)
        │
        ▼
[ Domain Controllers & Services ]
  (SalesService, ProductionService, InventoryService, FinanceService, ReportingService)
        │
        ▼ (Prisma 7.10 Client + @prisma/adapter-pg)
[ PostgreSQL 16 Database ]
  (Tables, Unique Constraints, Append-Only StockMovement Ledger)
```

### End-to-End Data Flow Invariant Check

1. **Purchases to Stock Ledger:** `PurchaseReceipt` creates `StockMovement` (type `PURCHASE_RECEIPT`), updates `currentStock` and recalculates `weightedAverageCost`.
2. **Production Consumption:** `ProductionRun` decrements raw materials via `StockMovement` (type `PRODUCTION_CONSUMPTION`) and increments finished goods via `PRODUCTION_OUTPUT`.
3. **Sales Reservation & Dispatch:** Order approval creates `StockReservation` (`ACTIVE`). Dispatch releases reservation (`RELEASED`), decrements physical stock, and creates `StockMovement` (`DISPATCH`).
4. **Invoicing & Payments:** `SalesInvoice` captures place-of-supply GST snapshots. `Payment` records collection and allocates against invoice outstanding balances.

---

## 5. Requirements and Milestone Traceability

The implementation was audited against Milestones 0 through 11:

| Req ID | Planned Milestone | Expected Deliverable | Actual Implementation Status | Evidence / Code Location | Gap / Defect Severity |
|---|---|---|---|---|---|
| REQ-M0 | M0 | Workspaces, TypeScript, Linting, Toolchain | **Complete & Verified** | [package.json](/package.json), [pnpm-workspace.yaml](/pnpm-workspace.yaml) | Zero compiler errors on `pnpm typecheck`. Passed. |
| REQ-M1 | M1 | Better Auth, RBAC, ABAC, Session Security | **Partially Implemented (Broken)** | [auth.ts:6-29](/server/src/lib/auth.ts#L6-L29), [auth.middleware.ts:12-37](/server/src/middleware/auth.middleware.ts#L12-L37) | **P0:** Missing `trustedOrigins` blocks CORS login. No login UI form. |
| REQ-M2 | M2 | Master Data, BOM Recipes, Opening Stock | **Complete & Verified** | [seed.ts:97-240](/server/src/db/seed.ts#L97-L240), [masters.test.ts](/server/src/masters.test.ts) | 7 unit tests pass. Benchmark fixtures seed properly. |
| REQ-M3 | M3 | Mandi Purchases, WAC Inventory Costing | **Partially Implemented** | [inventory.service.ts:134-165](/server/src/modules/inventory/inventory.service.ts#L134-L165), [placeholder-pages.tsx:178](/client/src/pages/placeholder-pages.tsx#L178) | **P1:** Frontend `/purchases` is a static placeholder wireframe. |
| REQ-M4 | M4 | Production Run, Variances, Cost Allocation | **Implemented (Bespoke)** | [production.service.ts:260-490](/server/src/modules/production/production.service.ts#L260-L490), [production-page.tsx:80-140](/client/src/pages/production-page.tsx#L80-L140) | **P1:** UI form hardcoded exclusively for 5 Murukku benchmark SKUs. |
| REQ-M5 | M5 | Sales Orders, Shortage Analysis, Reservations | **Implemented (Bespoke)** | [sales.service.ts:88-270](/server/src/modules/sales/sales.service.ts#L88-L270), [orders-page.tsx:150-180](/client/src/pages/orders-page.tsx#L150-L180) | **P1:** Order creation modal hardcoded to Retailer A/Distributor B. |
| REQ-M6 | M6 | Sales Invoices, GST Snapshots, Dispatches | **Complete & Verified (Backend)** | [finance.service.ts:38-160](/server/src/modules/finance/finance.service.ts#L38-L160), [dispatch.service.ts:34-210](/server/src/modules/sales/dispatch.service.ts#L34-L210) | **P1:** Invoice number sequence uses unsafe `count() + 1`. |
| REQ-M7 | M7 | Payment Collections, FIFO Allocations, Ledger | **Complete & Verified (Backend)** | [payment.service.ts:30-220](/server/src/modules/finance/payment.service.ts#L30-L220), [payments-page.tsx](/client/src/pages/payments-page.tsx) | Backend tests pass; UI disabled by 401 unauthenticated state. |
| REQ-M8 | M8 | Executive Dashboard, Audit Logs, GST Reports | **Partially Implemented (Broken)** | [reporting.routes.ts:14-29](/server/src/modules/reporting/reporting.routes.ts#L14-L29), [app.ts:47](/server/src/app.ts#L47) | **P0:** `/api/v1/dashboard` endpoint throws 404 on load. |
| REQ-M9 | M9 | Offline-First PWA, Outbox, Exactly-Once Sync | **Implemented (Defective)** | [sync-engine.ts:10-200](/client/src/offline/sync-engine.ts#L10-L200), [db.ts:64-79](/client/src/offline/db.ts#L64-L79) | **P1:** Multi-tab race condition; missing Web Locks API. |
| REQ-M10 | M10 | Responsive Layouts, Navigation, Tamil I18n | **Complete & Verified** | [authenticated-shell.tsx](/client/src/components/shell/authenticated-shell.tsx), [i18n.tsx](/client/src/lib/i18n.tsx) | Passed. Bottom sheet and Tamil toggle function properly. |
| REQ-M11 | M11 | Production Hardening, Benchmark Conformance | **Partially Implemented (Unready)** | [run-benchmark.ts](/server/src/scripts/run-benchmark.ts) | **P0/P1:** 0 migrations, no Docker, no CI/CD, 9 CVEs. |

---

## 6. Functional and End-to-End Workflow Audit

### 6.1 Authentication & Administration
- **Sign-In:** Completely broken from frontend origin (`http://localhost:5173`) due to missing `trustedOrigins` in `server/src/lib/auth.ts`.
- **Login UI:** `client/src/pages/placeholder-pages.tsx:331-344` contains no form fields.
- **Sign-Out:** Clicking user sign-out triggers `undefined()` in `AuthenticatedLayout`.
- **User Management:** No UI exists for creating, inviting, or modifying user accounts.

### 6.2 Inventory & Stock Ledger
- **Balances:** Verified calculation in `inventory.service.ts` correctly sums append-only stock movements.
- **Direct Stock Overwrite:** Purchase receipts directly overwrite `currentStock: totalQty` rather than applying atomic increments.
- **Stock Management UI:** `client/src/pages/stock-page.tsx` is read-only. No UI exists for manual stock adjustments, write-offs, or inter-warehouse transfers.

### 6.3 Purchasing Workflow
- **PO & Goods Receipt:** Backend service `inventoryService.postPurchaseReceipt` passes unit tests and benchmark checks.
- **UI Availability:** The frontend route `/purchases` renders `PurchasesPage` from `placeholder-pages.tsx`, displaying wireframes and fake numbers with no capability to record receipts.

### 6.4 Production Workflow
- **Batch Posting:** `productionService.postProductionRun` properly computes yields, damages, and byproduct costs.
- **Bespoke Hardcoding:** `ProductionPage` in `client/src/pages/production-page.tsx:107-138` hardcodes lookup of the 5 benchmark item SKUs (`RM-FLOUR`, `RM-OIL`, `RM-SPICE`, `PKG-POUCH-200G`, `PKG-CARTON`). Selecting other BOM recipes is unsupported in the UI.

### 6.5 Sales, Dispatch & Invoicing
- **Orders:** `createSalesOrder` accurately calculates intra-state (CGST+SGST) vs inter-state (IGST) taxes and reserves inventory.
- **Dispatch:** `dispatchService.postDispatch` atomically releases reservations, creates negative `DISPATCH` stock movements, and marks orders fulfilled.
- **Invoice Numbering:** `financeService.createInvoiceFromOrder` relies on `tx.salesInvoice.count() + 1`, failing under concurrency.

### 6.6 Payments & Receivables
- **Allocation:** FIFO allocation across open invoices in `paymentService.recordPayment` accurately computes outstanding balances.
- **Customer Ledger:** Customer ledger statements reconcile debit invoices, credit notes, and payment credits.

---

## 7. Business Logic and Financial Integrity

### Exact Mathematical Verification

The benchmark execution (`pnpm benchmark`) verified 100% adherence to CDI requirements:
1. **Flour WAC:** `(100 kg × ₹42 + 60 kg × ₹45) / 160 kg = ₹43.125 / kg` (Exact match).
2. **Production Batch Cost:** Material (₹4,055) + Labor (₹1,200) + Utility (₹600) = `₹5,855.00` total, or `₹31.1436` per packet (Exact match).
3. **Retailer A Invoice:** 150 pkts × ₹50 = `₹7,500.00` taxable + 2.5% CGST (₹187.50) + 2.5% SGST (₹187.50) = `₹7,875.00` (Exact match).
4. **Distributor B Shortage:** 88 available pkts − 120 requested = `32 pkts shortage` flagged (Exact match).

### Critical Data Integrity Defects

1. **Floating-Point Precision Risks:** Throughout services, Prisma `Decimal` instances are cast via `Number(val)` for multiplication and division in JavaScript. While values currently match at two decimals, floating-point rounding errors (`0.1 + 0.2 === 0.30000000000000004`) pose cumulative ledger reconciliation risks under high transaction volumes.
2. **Unenforced Negative Stock Boundary:** PostgreSQL lacks a `CHECK (current_stock >= 0)` constraint. If concurrent production runs decrement stock before locks commit, inventory drops below zero.

---

## 8. Security and OWASP Assessment

Conducted against OWASP Top 10 (2021) and OWASP API Security Top 10 (2023):

```
┌────────────────────────────────────────────────────────────────────────┐
│                        OWASP ASSESSMENT SUMMARY                        │
│                                                                        │
│  API1: Broken Object Level Authorization (BOLA)       ──► FAIL (P0)    │
│  API2: Broken Authentication                          ──► FAIL (P0)    │
│  API3: Broken Object Property Level Authorization     ──► FAIL (P1)    │
│  API4: Unrestricted Resource Consumption (DoS)       ──► FAIL (P1)    │
│  API5: Broken Function Level Authorization            ──► PASS         │
│  API7: Server-Side Request Forgery (SSRF)             ──► PASS         │
│  API8: Security Misconfiguration (Default Secret)     ──► FAIL (P1)    │
│  A06: Vulnerable and Outdated Components (9 CVEs)     ──► FAIL (P2)    │
└────────────────────────────────────────────────────────────────────────┘
```

### Detailed Vulnerability Analysis

- **API1 / BOLA:** Tenant boundary violation. `User` is not scoped to an `organizationId`. Any authenticated user can access another organization's inventory, sales orders, invoices, and reports by modifying the `organizationId` parameter.
- **API2 / Broken Authentication:** Better Auth is configured without `trustedOrigins`. Furthermore, `env.BETTER_AUTH_SECRET` falls back to an insecure 16-character static default, allowing forgery of session tokens if the environment variable is not passed.
- **API4 / Resource Exhaustion:** `getStockSummaryReport` and `getOwnerDashboard` pull all historical stock movements into application memory without pagination or date boundaries.
- **A06 / Outdated Components:** `pnpm audit` reports 9 vulnerabilities (2 Critical: Tinypool prototype pollution to RCE GHSA-5gmw-xhrv-c9v3 / GHSA-3qgp-25wh-78vc; 2 High: `glob` command injection GHSA-3g3m-2fjr-6pw4).

---

## 9. Deny-by-Default Authorization Assessment

### Policy Architecture Inspection

Authorization is implemented via `requireAuth`, `hasRbacPermission` ([rbac.ts](/server/src/policies/rbac.ts)), and `evaluateAbac` ([abac.ts](/server/src/policies/abac.ts)).

### Vulnerabilities in Authorization Enforcement

1. **Client-Controlled ABAC Attributes:** In [auth.middleware.ts:62](/server/src/middleware/auth.middleware.ts#L62), `evaluateAbac` is passed `resourceAttributes: req.body as Record<string, unknown>`. For update requests, the policy checks whether `resourceAttributes?.creatorId === user.id`. Because `req.body` is supplied by the client, a malicious user can inject `creatorId: user.id` in the JSON payload to bypass ownership verification on an order they do not own.
2. **Deactivated Users Bypassing `requireAuth`:** `requireAuth` sets `req.user.isActive`, but never evaluates `if (!req.user.isActive) throw new AppError("Forbidden: Inactive user", 403)`. If an endpoint omits the downstream `authorize()` middleware, a deactivated employee continues to execute authenticated requests.
3. **Data Leakage in Reporting Scope:** In [reporting.routes.ts:203](/server/src/modules/reporting/reporting.routes.ts#L203), salesmen are explicitly blocked from `purchase, production, gst, audit`, but permitted to query `receivables` and `collections`. In `getReceivablesReport`, `params.salesmanId` is ignored, exposing all customer debts across the mill to any salesman.

---

## 10. UI/UX and Visual Design Assessment

### Design System Token Compliance

Evaluated against [docs/design/milledger-design-system.json](/docs/design/milledger-design-system.json):
- **Pine & Paper Palette:** Core action green (`#176b54`), neutral background (`#fcfdfc`), and muted borders (`#e4e4e7`) strictly reflect the design token specification.
- **Typography:** `@fontsource-variable/geist` is loaded; numeric data uses `tabular-nums lining-nums` via utility `.numeric`.

### Anti-Slop Audit Findings

1. **Generic Wireframe Metric Grids:** [client/src/pages/placeholder-pages.tsx:58-82](/client/src/pages/placeholder-pages.tsx#L58-L82) renders generic 4-card metric grids displaying fake statistics ("1,429 orders", "68.4% yield", "12 reviews") with arbitrary percentage badges, directly violating Anti-Slop Core Rule R-01 and R-21.
2. **Decorative Bar Charts:** Lines 100-110 render 24 hardcoded CSS bars with pseudo-data heights (`PLACEHOLDER_BARS = [34, 41, 38, ...]`) that convey no transactional meaning, violating Anti-Slop Rule R-07.
3. **Unused Theme Library:** `next-themes` is installed in `client/package.json`, but `ThemeProvider` is not configured and `.dark` variables are absent in `index.css`.

---

## 11. Motion, Interaction and Feedback Assessment

- **Reduced Motion:** Fully honored via `@media (prefers-reduced-motion: reduce)` in [client/src/index.css:273-285](/client/src/index.css#L273-L285).
- **Navigation Transitions:** Radix Collapsible animated with deterministic cubic-bezier curves (160ms open, 120ms close).
- **Feedback Hygiene:** Contextual empty, loading, and error states are implemented via `<LoadingState>`, `<EmptyState>`, and `<ErrorState>`. However, toasts (`sonner`) are occasionally used as the sole confirmation for offline queueing rather than persistent inline status badges.

---

## 12. Accessibility and WCAG 2.2 Assessment

Empirical accessibility testing was performed using Lighthouse 12.x and headless Chrome accessibility trees:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      ACCESSIBILITY AUDIT SCORES                        │
│                                                                        │
│  Lighthouse Accessibility Score: 96 / 100                              │
│  WCAG 2.2 AA Conformance Target: PARTIAL CONFORMANCE                   │
└────────────────────────────────────────────────────────────────────────┘
```

### Confirmed Accessibility Barriers

1. **SC 1.4.3 Contrast (Minimum) — Text Elements (Score 0):**
   - `<kbd class="bg-muted text-muted-foreground">⌘B</kbd>`: Ratio **4.39:1** (foreground: `#71717a`, background: `#f4f4f5`). Fails 4.5:1 requirement.
   - `<kbd class="bg-muted text-muted-foreground">⌘K</kbd>`: Ratio **4.39:1**. Fails 4.5:1 requirement.
   - Button "New sales order" (`bg-[#009966]` with white text): Ratio **3.65:1**. Fails 4.5:1 requirement.
2. **SC 1.4.11 Non-Text Contrast — UI Components:**
   - Input and control borders (`#d4d4d8` on white background): Ratio **1.48:1**. Fails 3.0:1 threshold for user interface component boundaries.
3. **SC 2.5.3 Label in Name (Score 0):** Mismatched visible labels and programmatic `aria-label` names detected on 5 controls:
   - Visible text `"தமிழ்"` on language switch button has `aria-label="Change language to Tamil"`.
   - Visible brand text `"MillLedger Production unit"` has `aria-label="MillLedger home"`.
   - Sidebar collapse button visible text `"Collapse to icons ⌘B"` has `aria-label="Collapse to icons"`.
4. **SC 2.5.8 Target Size (Minimum):** Button variant `size="sm"` (`h-8`, 32px height) falls below the preferred 44×44px touch target on mobile viewports.

---

## 13. Lazy Loading and Asset Optimization

### Bundle Analysis

Running `pnpm build` produces the following chunk distribution:

```
dist/assets/index-BFqLoHnM.css        64.26 kB │ gzip:  11.45 kB
dist/assets/index-BXd_62_o.js        984.61 kB │ gzip: 270.82 kB
(!) Some chunks are larger than 500 kB after minification.
```

### Architectural Findings

- **Zero Route Splitting:** In [client/src/app.tsx:1-32](/client/src/app.tsx#L1-L32), all routes (`StockPage`, `ProductionPage`, `OrdersPage`, `InvoicesPage`, `DispatchPage`, `PaymentsPage`, `DashboardPage`, `ReportsPage`, `ShowcasePage`) are statically imported.
- **Heavy Chunk Overhead:** 984.61 kB of uncompressed JavaScript is downloaded, parsed, and executed on the initial visit, even for a user visiting only `/auth/login` or a floor worker recording a single production run.
- **Remediation:** Introduce `React.lazy()` and Suspense boundaries for all portal pages and chart modules.

---

## 14. Image Formats, Content Hashing and Caching

### Static Asset Audit

- **Empty Public Directory:** `client/public/` contains zero files.
- **Missing PWA Icons:** `client/vite.config.ts:22-33` defines `/pwa-192x192.png` and `/pwa-512x512.png`. Because these files do not exist on disk, Vite serves the HTML fallback `index.html` (Content-Type: `text/html`) with HTTP 200 for image URLs.
- **Missing Favicon:** `client/index.html:10` references `/favicon.svg`, which also returns `index.html` text.
- **Font Caching:** Geist Variable font subsets (`.woff2`) are bundled with content hashes (`geist-latin-wght-normal-BgDaEnEv.woff2`) and cached immutably.

---

## 15. CLS, LCP and Core Web Vitals Assessment

Performance metrics were collected via Chrome DevTools PerformanceObserver instrumentation on a dedicated local test runner:

| Route / Viewport | Metric | Measured Value | Standard Target | Internal Ambition | Assessment |
|---|---|---|---|---|---|
| `/dashboard` (Desktop) | **CLS** | `0.000003` | ≤ 0.1 | 0.00 | **Excellent (Pass)** |
| `/dashboard` (Desktop) | **LCP** | `1,192 ms` | ≤ 2,500 ms | ≤ 1,200 ms | **Good (Pass)** |
| `/dashboard` (Desktop) | **TTFB** | `7.2 ms` | ≤ 800 ms | ≤ 200 ms | **Excellent (Pass)** |
| `/orders` (Desktop) | **CLS** | `0.000127` | ≤ 0.1 | 0.00 | **Excellent (Pass)** |
| `/orders` (Desktop) | **LCP** | `924 ms` | ≤ 2,500 ms | ≤ 1,200 ms | **Excellent (Pass)** |
| `/orders` (Desktop) | **TTFB** | `6.4 ms` | ≤ 800 ms | ≤ 200 ms | **Excellent (Pass)** |
| `/dashboard` (Mobile) | **CLS** | `0.000008` | ≤ 0.1 | 0.00 | **Excellent (Pass)** |
| `/dashboard` (Mobile) | **LCP** | `1,048 ms` | ≤ 2,500 ms | ≤ 1,200 ms | **Good (Pass)** |

### Layout Shift Source Analysis

- **Stable Shell Geometry:** The persistent application shell maintains fixed dimensions (header: exactly 64px, sidebar: 248px expanded, 72px collapsed). `scrollbar-gutter: stable` in `index.css` completely eliminates scrollbar-induced horizontal shifts.
- **LCP Candidates:** Identified as text headings and description paragraphs (e.g. `<p class="text-sm text-muted-foreground">Salesman mobile orders...</p>`).

---

## 16. Frontend Performance

- **TanStack Query Setup:** Configured with `staleTime: 30000` and `retry: 1`, preventing request storms on window focus.
- **Virtualization Deficit:** Data tables in `OrdersPage`, `InvoicesPage`, and `StockPage` render all rows directly to the DOM without virtualization. Under large production datasets (e.g. 2,000 invoices), table rendering will induce frame drops.
- **Fast Refresh Warnings:** Oxlint reports 7 component export warnings in `i18n.tsx`, `badge.tsx`, `button.tsx`, and `sidebar.tsx` that prevent fine-grained React fast refresh.

---

## 17. Backend, API and Database Scalability

### Database Query Optimization Findings

1. **N+1 Balance Queries:** In `inventory.service.ts:219-259`, `getInventoryBalances` executes two sequential SQL queries per SKU inside a JavaScript `for...of` loop:
   ```typescript
   // Executes 2 * N queries
   const movementAgg = await prisma.stockMovement.aggregate({ where: { inventoryItemId: item.id } });
   const reservationAgg = await prisma.stockReservation.aggregate({ where: { inventoryItemId: item.id } });
   ```
   For 500 items, this triggers 1,001 SQL queries. Must be rewritten as a single grouped SQL query.
2. **In-Memory Heap Aggregation:** `reporting.service.ts:409-445` loads the entire `stockMovements` relation into Node.js heap memory to calculate `reduce((sum, m) => sum + Number(m.quantity), 0)`.
3. **Missing Foreign Key Indexes:** Prisma schema lacks composite indexes on `stock_movement(inventory_item_id, warehouse_id)` and `stock_reservation(inventory_item_id, status)`.

---

## 18. Offline-First and PWA Reliability

### Outbox & Synchronization Verification

- **IndexedDB Schema:** [client/src/offline/db.ts](/client/src/offline/db.ts) configures tables for `customers`, `products`, `outbox`, and `meta`.
- **Idempotency Keys:** Every offline order receives a client UUID and `idempotencyKey: "idem-offline-local-ord-..."`.

### Synchronization Concurrency Defects

1. **Multi-Tab Race Condition:** In `client/src/offline/sync-engine.ts:10`, `isSyncing` is a module-scoped in-memory boolean variable. If a user opens two browser tabs, both tabs execute `processOutbox()` concurrently upon network restoration.
2. **Server 500 on Idempotency Collisions:** When two identical requests arrive simultaneously before the first transaction commits, PostgreSQL throws a `P2002` unique constraint violation. Because `P2002` is not caught by `sales.service.ts`, the second request crashes with HTTP 500.

---

## 19. Testing and Automation Quality

### Test Suite Execution Evidence

1. **Vitest Unit & Integration Tests:** 14 test files executed; **61 tests passed** in 14.23s.
   - *Severe Disparity:* 60 tests belong to `server/src/`; only **1 test** (`client/src/lib/utils.test.ts`) tests the entire frontend.
2. **Playwright E2E Tests:** 16 tests passed in 20.3s.
   - *Critical Defect:* Playwright's `webServer` executes `vite` dev server only. The Express backend is not running, resulting in 100% of API calls failing with `ECONNREFUSED 127.0.0.1:4000`. Tests solely verify fallback client shell behavior.
3. **Benchmark Test Runner:** Executed `pnpm benchmark` in 2.1s; all 18 assertions matched oracle values.

---

## 20. Deployment and Operational Reliability

- **Missing Containerization:** No Dockerfile or `docker-compose.yml` exists in the repository.
- **Missing CI/CD Workflows:** The `.github/` directory is entirely absent. No automated pull-request validation or deployment gates are configured.
- **Health Check Endpoint:** `GET /api/v1/health` and `GET /api/health` return HTTP 200 `{ status: "ok" }`. However, it does not ping the PostgreSQL database to verify connectivity.
- **Backup & Disaster Recovery:** Undocumented. No automated database dump or PITR restore scripts exist.

---

## 21. Architecture and Maintainability

- **TypeScript Safety:** `pnpm typecheck` passed with 0 errors across all three packages.
- **Code Organization:** Follows kebab-case naming and modular boundaries (`modules/inventory`, `modules/sales`, `modules/production`, `modules/finance`, `modules/reporting`).
- **Oxford Linter Warnings:** `oxlint .` found 7 warnings relating to React Fast Refresh component exports and ref access during render in `sidebar.tsx`.

---

## 22. Consolidated Findings Register

### Finding Index

| ID | Title | Category | Priority | Confidence | Affected Surface |
|---|---|---|---|---|---|
| **P0-SEC-01** | Frontend Auth Rejection (Missing Trusted Origins) & Empty Login UI | Security / Auth | P0 | Confirmed | `server/src/lib/auth.ts`, `client/src/pages/placeholder-pages.tsx` |
| **P0-SEC-02** | Missing Multi-Tenant Isolation & Cross-Organization BOLA | Security / Auth | P0 | Confirmed | `schema.prisma`, `auth.middleware.ts`, all services |
| **P0-FUNC-01** | Broken Overview Dashboard Route (404 Routing Conflict) | Functional | P0 | Confirmed | `server/src/app.ts`, `reporting.routes.ts` |
| **P0-DATA-01** | Absent Database Migrations & Unenforced Schema Constraints | Database / Integrity | P0 | Confirmed | `server/prisma/migrations/`, `schema.prisma` |
| **P1-SEC-01** | Insecure Default Auth Secret in Production Environment | Security / Config | P1 | Confirmed | `server/src/config/env.ts` |
| **P1-SEC-02** | Client-Controlled ABAC Resource Attributes & Unchecked Inactive Users | Security / Auth | P1 | Confirmed | `auth.middleware.ts`, `policies/abac.ts` |
| **P1-SEC-03** | Salesman Information Disclosure via Receivables / Collections Reports | Security / Privacy | P1 | Confirmed | `reporting.routes.ts`, `reporting.service.ts` |
| **P1-FUNC-01** | Dead Sign-Out Button in Authenticated Shell | Functional / UX | P1 | Confirmed | `client/src/layouts/authenticated-layout.tsx` |
| **P1-FUNC-02** | Extensive Placeholder Screens for Core Business Domains | Functional | P1 | Confirmed | `client/src/pages/placeholder-pages.tsx` |
| **P1-DATA-02** | Bespoke Hardcoded Benchmark Logic in Frontend Forms | Business Logic | P1 | Confirmed | `orders-page.tsx`, `production-page.tsx` |
| **P1-DATA-03** | Direct Stock Overwrites & Race Conditions in Inventory Balances | Data Integrity | P1 | Confirmed | `inventory.service.ts`, `production.service.ts` |
| **P1-DATA-04** | Fragile Invoice Sequence Generation via Table Count | Data Integrity | P1 | Confirmed | `finance.service.ts` |
| **P1-PERF-01** | N+1 Aggregate Queries & Unbounded In-Memory Movement Loading | Performance / Scalability | P1 | Confirmed | `inventory.service.ts`, `reporting.service.ts` |
| **P1-PERF-02** | Monolithic Frontend Bundle & Zero Route-Level Code Splitting | Performance / Bundle | P1 | Confirmed | `client/src/app.tsx`, `client/dist/` |
| **P1-PWA-01** | Multi-Tab Race Condition in Offline Outbox Sync | Offline / PWA | P1 | Confirmed | `client/src/offline/sync-engine.ts` |
| **P2-PWA-02** | Missing Static PWA Manifest Assets & HTML Fallback | PWA / Assets | P2 | Confirmed | `client/public/`, `client/vite.config.ts` |
| **P2-A11Y-01** | WCAG 2.2 AA Contrast & Label-in-Name Accessibility Failures | Accessibility | P2 | Confirmed | `kbd.tsx`, `sidebar.tsx`, `button.tsx` |
| **P2-TEST-01** | Near-Zero Client Unit Tests & Disconnected Playwright E2E Suite | QA / Testing | P2 | Confirmed | `client/src/`, `playwright.config.ts` |
| **P2-SEC-04** | Unpatched Dependency Vulnerabilities (Prototype Pollution & RCE) | Security / Deps | P2 | Confirmed | `package.json`, `pnpm audit` |
| **P2-DEVOPS-01**| Complete Absence of CI/CD Workflows & Container Manifests | DevOps / Reliability | P2 | Confirmed | Repository root |
| **P2-UX-01** | AI Design Slop & Fake Statistics in Placeholder Components | UI / UX | P2 | Confirmed | `client/src/pages/placeholder-pages.tsx` |
| **P3-CODE-01** | Floating-Point Financial Arithmetic & Fast Refresh Linter Warnings | Maintainability | P3 | Confirmed | `shared/`, `client/src/lib/i18n.tsx` |

---

### Detailed Findings Register

#### [P0-SEC-01] Frontend Auth Rejection (Missing Trusted Origins) & Empty Login UI
- **Category:** Application Security / Authentication
- **Priority:** P0 (Critical Release Blocker)
- **Confidence:** Confirmed
- **Affected Route & Modules:** `POST /api/auth/sign-in/email`, `/auth/login`, `server/src/lib/auth.ts`, `client/src/pages/placeholder-pages.tsx`
- **Exact Code Locations:**
  - [server/src/lib/auth.ts:6-29](/server/src/lib/auth.ts#L6-L29)
  - [client/src/pages/placeholder-pages.tsx:331-344](/client/src/pages/placeholder-pages.tsx#L331-L344)
  - [client/src/hooks/use-current-user.ts:58-69](/client/src/hooks/use-current-user.ts#L58-L69)
- **Evidence:** Executing `curl -i -X POST http://localhost:4000/api/auth/sign-in/email -H "Origin: http://localhost:5173" -d '{"email":"admin@millledger.local","password":"AdminPassword123!"}'` returns HTTP 403 Forbidden with `{"message":"Invalid origin","code":"INVALID_ORIGIN"}`. Inspecting `LoginPage` reveals:
  ```tsx
  export function LoginPage() {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xs">
          <h1 className="text-xl font-semibold text-foreground">Sign in to MillLedger</h1>
          <p className="mt-1 text-xs text-muted-foreground">Enter your credentials to access the production unit.</p>
        </div>
      </div>
    );
  }
  ```
- **Reproduction Steps:**
  1. Build client for production: `pnpm --filter client build`.
  2. Launch browser at `http://localhost:5173/`.
  3. `useCurrentUser` detects unauthenticated state and redirects to `/auth/login`.
  4. User is presented with a non-interactive card.
- **Expected Behavior:** Better Auth permits requests from configured client origins. `/auth/login` renders an accessible login form with email/password validation and session establishment.
- **Actual Behavior:** Cross-origin auth requests are rejected by Better Auth. No login form exists.
- **Root Cause:** Omission of `trustedOrigins: [env.CORS_ORIGIN]` in Better Auth server configuration; failure to implement the login view.
- **Impact:** 100% of real users are permanently locked out of production environments.
- **Recommended Remediation:**
  1. Add `trustedOrigins: [env.CORS_ORIGIN, env.BETTER_AUTH_URL]` to `betterAuth({...})` in `server/src/lib/auth.ts`.
  2. Implement a complete `LoginPage` component with React Hook Form, Zod schema validation, Better Auth client `signIn.email` integration, and accessible error alerts.
- **Acceptance Criteria:** A user can submit valid credentials on `/auth/login`, receive a session cookie, and redirect to `/dashboard`.

---

#### [P0-SEC-02] Missing Multi-Tenant Isolation & Cross-Organization BOLA
- **Category:** Application Security / Authorization
- **Priority:** P0 (Critical Release Blocker)
- **Confidence:** Confirmed
- **Affected Route & Modules:** All API routes (`/sales/*`, `/inventory/*`, `/production/*`, `/finance/*`, `/reports/*`)
- **Exact Code Locations:**
  - [server/prisma/schema.prisma:9-25](/server/prisma/schema.prisma#L9-L25)
  - [server/src/middleware/auth.middleware.ts:26-31](/server/src/middleware/auth.middleware.ts#L26-L31)
  - [server/src/modules/sales/sales.service.ts:39-47](/server/src/modules/sales/sales.service.ts#L39-L47)
- **Evidence:** The Prisma schema defines `User` without `organizationId`:
  ```prisma
  model User {
    id        String   @id @default(cuid())
    email     String   @unique
    role      String   @default("SALESMAN")
    isActive  Boolean  @default(true)
    // No organizationId relation
  }
  ```
  In `sales.service.ts`:
  ```typescript
  private async resolveOrgId(orgIdOrCode?: string): Promise<string> {
    if (!orgIdOrCode) return "MILL";
    const org = await prisma.organization.findFirst({ where: { OR: [{ id: orgIdOrCode }, { code: orgIdOrCode }] } });
    return org ? org.id : orgIdOrCode;
  }
  ```
- **Reproduction Steps:** Authenticate as User A belonging to Org 1. Submit `GET /api/v1/inventory/balances?organizationId=ORG_2_ID`. The API returns Org 2's inventory balances.
- **Expected Behavior:** Users belong strictly to one or more organizations via membership records. Server-side middleware validates that `req.user.organizationId` matches the requested resource.
- **Actual Behavior:** Any authenticated user can read or modify data belonging to any tenant by passing an arbitrary `organizationId` parameter.
- **Root Cause:** Monolithic schema design omitted tenant keys on `User` and session contexts.
- **Impact:** Total breach of tenant data confidentiality and cross-organization tampering.
- **Recommended Remediation:**
  1. Add `organizationId String` (or `OrganizationMember` junction table) to `model User` in `schema.prisma`.
  2. Include `organizationId` in Better Auth session payload and `UserContext`.
  3. Enforce tenant check in `requireAuth` and scoping queries.

---

#### [P0-FUNC-01] Broken Overview Dashboard Route (404 Routing Conflict)
- **Category:** Functional / Routing
- **Priority:** P0 (Critical Release Blocker)
- **Confidence:** Confirmed
- **Affected Route & Modules:** `GET /api/v1/dashboard`, `client/src/pages/dashboard-page.tsx:82`
- **Exact Code Locations:**
  - [server/src/app.ts:47](/server/src/app.ts#L47)
  - [server/src/modules/reporting/reporting.routes.ts:14-29](/server/src/modules/reporting/reporting.routes.ts#L14-L29)
  - [client/src/pages/dashboard-page.tsx:82](/client/src/pages/dashboard-page.tsx#L82)
- **Evidence:** Executing `curl -i http://localhost:4000/api/v1/dashboard?organizationId=MILL` returns HTTP 404 Not Found (`Cannot GET /api/v1/dashboard`), while `curl -i http://localhost:4000/api/v1/dashboard/dashboard?organizationId=MILL` returns HTTP 401. Live browser snapshot captured:
  `uid=1_34 "Failed to load overview data" uid=1_35 "Request failed with status code 404"`.
  Screenshot archived at [docs/audits/production-readiness/evidence/dashboard-404.png](/docs/audits/production-readiness/evidence/dashboard-404.png).
- **Reproduction Steps:** Navigate browser to `http://localhost:5173/dashboard`. The UI immediately displays an error card: "Failed to load overview data. Request failed with status code 404".
- **Expected Behavior:** `GET /api/v1/dashboard?organizationId=MILL` returns executive overview metrics.
- **Actual Behavior:** Endpoint returns HTTP 404 due to redundant sub-path routing.
- **Root Cause:** In `server/src/app.ts`, `app.use("/api/v1/dashboard", reportingRouter)` was mounted where `reportingRouter` defined `reportingRouter.get("/dashboard", ...)`.
- **Impact:** Main home landing screen is completely broken for all roles.
- **Recommended Remediation:** Change `reportingRouter.get("/dashboard", ...)` to `reportingRouter.get("/", ...)` or mount `reportingRouter` solely under `/api/v1/reports` and update client query URL to `/reports/dashboard`.

---

#### [P0-DATA-01] Absent Database Migrations & Unenforced Schema Constraints
- **Category:** Database Engineering / Data Integrity
- **Priority:** P0 (Critical Release Blocker)
- **Confidence:** Confirmed
- **Affected Route & Modules:** `server/prisma/`, PostgreSQL database schema
- **Exact Code Locations:**
  - [server/prisma/](/server/prisma/)
  - [server/prisma/schema.prisma:244-270](/server/prisma/schema.prisma#L244-L270)
- **Evidence:** Running `ls server/prisma/migrations/` confirms the folder does not exist. No SQL migration ledger (`_prisma_migrations`) exists. Database was synchronized exclusively via `prisma db push`.
- **Reproduction Steps:** Attempting to run `prisma migrate deploy` in a production CI/CD environment fails immediately because no migration history exists.
- **Expected Behavior:** Reproducible, version-controlled SQL migration scripts under `prisma/migrations` enforcing check constraints.
- **Actual Behavior:** Zero migrations committed. Schema pushed directly to local Postgres instance.
- **Root Cause:** Relying on prototyping workflow (`prisma db push`) throughout milestones.
- **Impact:** Inability to perform deterministic production deployments, rollbacks, or zero-downtime schema updates; inability to declare native PostgreSQL `CHECK` constraints.
- **Recommended Remediation:** Initialize baseline migration using `prisma migrate dev --name init_baseline`, verify SQL, and commit migrations to version control.

---

#### [P1-SEC-01] Insecure Default Auth Secret in Production Environment
- **Category:** Application Security / Configuration
- **Priority:** P1 (High)
- **Confidence:** Confirmed
- **Affected Route & Modules:** `server/src/config/env.ts:17-20`
- **Exact Code Locations:**
  - [server/src/config/env.ts:17-20](/server/src/config/env.ts#L17-L20)
- **Evidence:**
  ```typescript
  BETTER_AUTH_SECRET: z
    .string()
    .min(16)
    .default("mill-ledger-development-secret-123456"),
  ```
- **Impact:** If an operator omits `BETTER_AUTH_SECRET` in production, the application boots silently with the public repository secret, allowing attackers to forge HMAC signatures on auth cookies.
- **Recommended Remediation:** Update Zod schema to require `min(32)` without a default value when `NODE_ENV === "production"`, failing loudly on startup.

---

#### [P1-SEC-02] Client-Controlled ABAC Resource Attributes & Unchecked Inactive Users
- **Category:** Application Security / Authorization
- **Priority:** P1 (High)
- **Confidence:** Confirmed
- **Affected Route & Modules:** `server/src/middleware/auth.middleware.ts`, `server/src/policies/abac.ts`
- **Exact Code Locations:**
  - [server/src/middleware/auth.middleware.ts:26-31, 58-63](/server/src/middleware/auth.middleware.ts#L26-L31)
  - [server/src/policies/abac.ts:21-62](/server/src/policies/abac.ts#L21-L62)
- **Evidence:** `evaluateAbac` is called with:
  ```typescript
  const isAbacAllowed = evaluateAbac({
    user: req.user,
    resource,
    action,
    resourceAttributes: req.body as Record<string, unknown>,
  });
  ```
- **Impact:** An attacker can forge `creatorId` in the JSON request body to bypass ABAC ownership checks. Deactivated users whose `isActive` is `false` are not rejected by `requireAuth` if `authorize` is omitted.
- **Recommended Remediation:** Ensure `requireAuth` rejects requests where `!req.user.isActive`. For ABAC rules, retrieve the existing entity from the database within the transaction before evaluating policy rules.

---

#### [P1-SEC-03] Salesman Information Disclosure via Receivables / Collections Reports
- **Category:** Application Security / Data Privacy
- **Priority:** P1 (High)
- **Confidence:** Confirmed
- **Affected Route & Modules:** `GET /api/v1/reports/receivables`, `server/src/modules/reporting/reporting.service.ts:690-780`
- **Exact Code Locations:**
  - [server/src/modules/reporting/reporting.routes.ts:203-217](/server/src/modules/reporting/reporting.routes.ts#L203-L217)
  - [server/src/modules/reporting/reporting.service.ts:690-780](/server/src/modules/reporting/reporting.service.ts#L690-L780)
- **Evidence:** The salesman exclusion list in `reporting.routes.ts` blocks `["purchase", "production", "gst", "audit"]`, allowing `receivables`. In `getReceivablesReport`, all customers in the tenant are retrieved without checking `assignedSalesmanId`.
- **Impact:** Salesmen can inspect debts, open balances, credit terms, and turnover of competitors' clients across the firm.
- **Recommended Remediation:** Add `"receivables"` and `"collections"` to the salesman restricted report list, or filter customers by `assignedSalesmanId`.

---

#### [P1-FUNC-01] Dead Sign-Out Button in Authenticated Shell
- **Category:** Functional / UX
- **Priority:** P1 (High)
- **Confidence:** Confirmed
- **Affected Route & Modules:** `client/src/layouts/authenticated-layout.tsx:36-40`, `client/src/components/shell/authenticated-shell.tsx:1053`
- **Exact Code Locations:**
  - [client/src/layouts/authenticated-layout.tsx:36-40](/client/src/layouts/authenticated-layout.tsx#L36-L40)
  - [client/src/components/shell/authenticated-shell.tsx:1053-1059](/client/src/components/shell/authenticated-shell.tsx#L1053-L1059)
- **Evidence:** `AuthenticatedLayout` renders `<AuthenticatedShell user={user} notificationCount={0}>` without providing `onSignOut`. In `authenticated-shell.tsx`, `handleSafeSignOut` executes `onSignOut?.()`.
- **Impact:** Users are unable to log out of the web client.
- **Recommended Remediation:** Wire `onSignOut` to call Better Auth client `signOut()` and navigate to `/auth/login`.

---

#### [P1-FUNC-02] Extensive Placeholder Screens for Core Business Domains
- **Category:** Functional / Completeness
- **Priority:** P1 (High)
- **Confidence:** Confirmed
- **Affected Route & Modules:** `/purchases`, `/customers`, `/exports`, `/settings`, `/orders/new`
- **Exact Code Locations:**
  - [client/src/pages/placeholder-pages.tsx:1-357](/client/src/pages/placeholder-pages.tsx#L1-L357)
  - [client/src/app.tsx:101-105, 130-134, 174-177](/client/src/app.tsx#L101-L105)
- **Evidence:** `PurchasesPage` and `CustomersPage` render wireframe cards and hardcoded charts. Live snapshot verified on `/purchases`: `uid=3_34 "1,429" uid=3_37 "68.4%"`.
- **Impact:** Fundamental operational requirements (raw paddy procurement, mandi intake, customer master creation) cannot be performed in the client interface.
- **Recommended Remediation:** Replace placeholder screens with functional portals connected to API endpoints.

---

#### [P1-DATA-02] Bespoke Hardcoded Benchmark Logic in Frontend Forms
- **Category:** Business Logic / Maintainability
- **Priority:** P1 (High)
- **Confidence:** Confirmed
- **Affected Route & Modules:** `client/src/pages/orders-page.tsx`, `client/src/pages/production-page.tsx`
- **Exact Code Locations:**
  - [client/src/pages/orders-page.tsx:150-175](/client/src/pages/orders-page.tsx#L150-L175)
  - [client/src/pages/production-page.tsx:80-140](/client/src/pages/production-page.tsx#L80-L140)
- **Evidence:** `OrdersPage` contains hardcoded selections:
  ```typescript
  customerId: isRetailerA ? "CUST-RET-A" : "CUST-DIST-B",
  productVariantId: "VAR-MURUKKU-200G",
  unitPrice: 50.0,
  ```
  `ProductionPage` contains:
  ```typescript
  const flourItem = items.find((i) => i.sku === "RM-FLOUR");
  const oilItem = items.find((i) => i.sku === "RM-OIL");
  // Hardcoded 5 benchmark items
  ```
- **Impact:** The frontend acts as a hardcoded benchmark test harness rather than a general-purpose ERP interface.
- **Recommended Remediation:** Refactor modals to dynamic select inputs fetching active customers, product variants, and BOM recipes from API endpoints.

---

#### [P1-DATA-03] Direct Stock Overwrites & Race Conditions in Inventory Balances
- **Category:** Data Integrity / Concurrency
- **Priority:** P1 (High)
- **Confidence:** Confirmed
- **Affected Route & Modules:** `server/src/modules/inventory/inventory.service.ts`, `server/src/modules/production/production.service.ts`
- **Exact Code Locations:**
  - [server/src/modules/inventory/inventory.service.ts:149-155](/server/src/modules/inventory/inventory.service.ts#L149-L155)
  - [server/src/modules/production/production.service.ts:285-302, 444-450](/server/src/modules/production/production.service.ts#L285-L302)
- **Evidence:** In `inventory.service.ts`:
  ```typescript
  await tx.inventoryItem.update({
    where: { id: item.id },
    data: { currentStock: totalQty, weightedAverageCost: newWeightedAverageCost },
  });
  ```
  If two receipts post concurrently, `totalQty` overwrites the intermediate state without row locking.
- **Impact:** Lost updates on physical inventory balances during concurrent intake or production.
- **Recommended Remediation:** Use PostgreSQL row-level locks (`SELECT ... FOR UPDATE`) or atomic Prisma `{ increment: qty }` statements combined with version numbers.

---

#### [P1-DATA-04] Fragile Invoice Sequence Generation via Table Count
- **Category:** Data Integrity / Financial Compliance
- **Priority:** P1 (High)
- **Confidence:** Confirmed
- **Affected Route & Modules:** `server/src/modules/finance/finance.service.ts:82-89`
- **Exact Code Locations:**
  - [server/src/modules/finance/finance.service.ts:82-89](/server/src/modules/finance/finance.service.ts#L82-L89)
- **Evidence:**
  ```typescript
  const existingInvoicesCount = await tx.salesInvoice.count({
    where: { organizationId: order.organizationId, financialYear: fy },
  });
  const invoiceNumber = `INV-${fy}-${(existingInvoicesCount + 1).toString().padStart(4, "0")}`;
  ```
- **Impact:** Under concurrent invoice generation, two transactions receive identical count values, colliding on `@@unique([organizationId, invoiceNumber])` and crashing one transaction. If an invoice is deleted, sequence numbers collide.
- **Recommended Remediation:** Implement a dedicated `DocumentSequence` table with row-level locks or native PostgreSQL sequences.

---

#### [P1-PERF-01] N+1 Aggregate Queries & Unbounded In-Memory Movement Loading
- **Category:** Performance / Database Scalability
- **Priority:** P1 (High)
- **Confidence:** Confirmed
- **Affected Route & Modules:** `GET /inventory/balances`, `GET /reports/stock`, `GET /dashboard`
- **Exact Code Locations:**
  - [server/src/modules/inventory/inventory.service.ts:219-259](/server/src/modules/inventory/inventory.service.ts#L219-L259)
  - [server/src/modules/reporting/reporting.service.ts:409-445](/server/src/modules/reporting/reporting.service.ts#L409-L445)
- **Evidence:** In `inventory.service.ts`:
  ```typescript
  for (const item of items) {
    const movementAgg = await prisma.stockMovement.aggregate({...});
    const reservationAgg = await prisma.stockReservation.aggregate({...});
  }
  ```
  In `reporting.service.ts:413`:
  ```typescript
  include: { stockMovements: true } // Loads entire historical movement table into heap
  ```
- **Impact:** Severe database saturation and Node.js process out-of-memory (OOM) crashes under production data volumes.
- **Recommended Remediation:** Replace loop aggregates with a single `prisma.$queryRaw` using `GROUP BY inventory_item_id`.

---

#### [P1-PERF-02] Monolithic Frontend Bundle & Zero Route-Level Code Splitting
- **Category:** Frontend Performance / Core Web Vitals
- **Priority:** P1 (High)
- **Confidence:** Confirmed
- **Affected Route & Modules:** `client/src/app.tsx`, `client/dist/`
- **Exact Code Locations:**
  - [client/src/app.tsx:1-32](/client/src/app.tsx#L1-L32)
- **Evidence:** Vite production build output emits a single 984.61 kB JavaScript bundle (`dist/assets/index-BXd_62_o.js`) with zero route chunks.
- **Impact:** Unnecessary bandwidth consumption, delayed initial JavaScript evaluation, and degraded mobile Core Web Vitals (LCP/INP) on cellular networks.
- **Recommended Remediation:** Migrate static page imports in `app.tsx` to `React.lazy(() => import(...))` paired with `<Suspense>`.

---

#### [P1-PWA-01] Multi-Tab Race Condition in Offline Outbox Sync
- **Category:** Offline-First / PWA
- **Priority:** P1 (High)
- **Confidence:** Confirmed
- **Affected Route & Modules:** `client/src/offline/sync-engine.ts:10-12, 144-152`
- **Exact Code Locations:**
  - [client/src/offline/sync-engine.ts:10-12, 144-152](/client/src/offline/sync-engine.ts#L10-L12)
- **Evidence:** `isSyncing` is a module-scoped boolean in window memory. If multiple browser tabs are open, both trigger `processOutbox(userId)` simultaneously upon network reconnection.
- **Impact:** Duplicate concurrent HTTP submissions of queued orders.
- **Recommended Remediation:** Wrap queue processing in the Web Locks API: `navigator.locks.request('mill_ledger_outbox_sync', async () => { ... })`.

---

#### [P2-PWA-02] Missing Static PWA Manifest Assets & HTML Fallback
- **Category:** PWA / Static Assets
- **Priority:** P2 (Medium)
- **Confidence:** Confirmed
- **Affected Route & Modules:** `client/public/`, `client/vite.config.ts:22-33`
- **Exact Code Locations:**
  - [client/public/](/client/public/)
  - [client/vite.config.ts:22-33](/client/vite.config.ts#L22-L33)
- **Evidence:** Requests for `/pwa-192x192.png`, `/pwa-512x512.png`, and `/favicon.svg` return HTML text (`index.html`) with HTTP 200 due to Vite SPA fallback.
- **Impact:** Browser PWA installation fails icon parsing; bookmarks display broken icons.
- **Recommended Remediation:** Add required PNG/SVG icons to `client/public/`.

---

#### [P2-A11Y-01] WCAG 2.2 AA Contrast & Label-in-Name Accessibility Failures
- **Category:** Accessibility / WCAG
- **Priority:** P2 (Medium)
- **Confidence:** Confirmed
- **Affected Route & Modules:** `client/src/components/ui/kbd.tsx`, `client/src/components/ui/button.tsx`
- **Exact Code Locations:**
  - [client/src/components/ui/kbd.tsx](/client/src/components/ui/kbd.tsx)
  - [client/src/components/ui/button.tsx:26](/client/src/components/ui/button.tsx#L26)
- **Evidence:** Automated Lighthouse audit report (`/tmp/chrome-devtools-mcp-5e1ORa/report.json`) detected:
  - `<kbd>` contrast: 4.39:1 (fails SC 1.4.3 minimum 4.5:1).
  - Button "New sales order" contrast: 3.65:1 (fails 4.5:1).
  - 5 buttons violate SC 2.5.3 (Label in Name) due to mismatched `aria-label` vs visible text.
- **Impact:** Low-vision users and speech-to-text navigation users experience barriers.
- **Recommended Remediation:** Adjust kbd foreground color to `#52525b` (ratio 5.7:1); align accessible names with visible button text.

---

#### [P2-TEST-01] Near-Zero Client Unit Tests & Disconnected Playwright E2E Suite
- **Category:** QA / Test Automation
- **Priority:** P2 (Medium)
- **Confidence:** Confirmed
- **Affected Route & Modules:** `client/src/`, `playwright.config.ts:12-16`
- **Exact Code Locations:**
  - [client/src/lib/utils.test.ts](/client/src/lib/utils.test.ts)
  - [playwright.config.ts:12-16](/playwright.config.ts#L12-L16)
- **Evidence:** `client/` contains only 1 test file. Playwright test execution produced dozens of `[WebServer] Error: connect ECONNREFUSED 127.0.0.1:4000` because the backend server is never spawned during E2E runs.
- **Impact:** Front-end component logic, form validation, and full-stack integration workflows lack automated test coverage.
- **Recommended Remediation:** Configure Playwright `webServer` to launch both client and server or use `pnpm dev`. Write Vitest component tests for key modals.

---

#### [P2-SEC-04] Unpatched Dependency Vulnerabilities (Prototype Pollution & RCE)
- **Category:** Security / Dependencies
- **Priority:** P2 (Medium)
- **Confidence:** Confirmed
- **Affected Route & Modules:** `package.json`, `pnpm-lock.yaml`
- **Exact Code Locations:**
  - [package.json](/package.json)
  - Raw audit log: [docs/audits/production-readiness/evidence/pnpm-audit.txt](/docs/audits/production-readiness/evidence/pnpm-audit.txt)
- **Evidence:** `pnpm audit` identifies 9 vulnerabilities (2 Critical: Tinypool RCE GHSA-5gmw-xhrv-c9v3 / GHSA-3qgp-25wh-78vc; 2 High: `glob` command injection GHSA-3g3m-2fjr-6pw4; 5 Moderate).
- **Impact:** Prototype pollution gadget in test execution; command injection risks in build pipelines.
- **Recommended Remediation:** Upgrade `vitest` to `>=3.0.8` and `vite-plugin-pwa` to patch transitive dependencies.

---

#### [P2-DEVOPS-01] Complete Absence of CI/CD Workflows & Container Manifests
- **Category:** DevOps / Production Operations
- **Priority:** P2 (Medium)
- **Confidence:** Confirmed
- **Affected Route & Modules:** Repository root
- **Evidence:** Directory search reveals no `.github/` folder, no Dockerfile, and no docker-compose configurations.
- **Impact:** Deployments cannot be repeated reliably across environments; code merges lack automated quality gates.
- **Recommended Remediation:** Add GitHub Actions CI workflow executing `lint`, `typecheck`, `test`, and `build`. Provide production Dockerfiles for client and server.

---

#### [P2-UX-01] AI Design Slop & Fake Statistics in Placeholder Components
- **Category:** UI / UX Design
- **Priority:** P2 (Medium)
- **Confidence:** Confirmed
- **Affected Route & Modules:** `client/src/pages/placeholder-pages.tsx:14-45, 57-111`
- **Exact Code Locations:**
  - [client/src/pages/placeholder-pages.tsx:14-45](/client/src/pages/placeholder-pages.tsx#L14-L45)
- **Evidence:** Renders repetitive 4-card metric grids with static numbers ("1,429 orders", "68.4% yield") and 24 decorative height bars without transactional data.
- **Impact:** Devalues the professional Pine & Paper visual identity and misleads operators.
- **Recommended Remediation:** Remove placeholder wireframe stats. Display clean, empty-state guidance directing users to record transactions.

---

#### [P3-CODE-01] Floating-Point Financial Arithmetic & Fast Refresh Linter Warnings
- **Category:** Maintainability / Code Quality
- **Priority:** P3 (Low)
- **Confidence:** Confirmed
- **Affected Route & Modules:** `client/src/lib/i18n.tsx`, `client/src/components/ui/sidebar.tsx`
- **Exact Code Locations:**
  - [client/src/lib/i18n.tsx:18, 126](/client/src/lib/i18n.tsx#L18)
  - [client/src/components/ui/sidebar.tsx:556](/client/src/components/ui/sidebar.tsx#L556)
- **Evidence:** `oxlint .` outputs 7 warnings regarding component-only exports and render-time ref access in `sidebar.tsx`.
- **Impact:** Sub-optimal React Fast Refresh performance in development.
- **Recommended Remediation:** Split non-component constants from component files; avoid reading ref values during render.

---

## 23. Risk Analysis and Dependency Mapping

```
┌────────────────────────────────────────────────────────────────────────┐
│                        RISK MATRIX (SEVERITY VS LIKELIHOOD)           │
│                                                                        │
│   High Impact   │   P1-DATA-03 (Stock Race)    P0-SEC-01 (Auth Out)   │
│                 │   P1-PERF-01 (N+1 Query)     P0-SEC-02 (BOLA Multi) │
│                 │   P1-FUNC-01 (Sign-Out Dead) P0-FUNC-01 (404 Route) │
│                 ├──────────────────────────────────────────────────────┤
│   Medium Impact │   P1-SEC-03 (Data Leak)      P1-DATA-04 (Inv Seq)   │
│                 │   P2-A11Y-01 (Contrast)      P1-PERF-02 (Bundle)    │
│                 │   P2-TEST-01 (E2E Proxy)     P1-PWA-01 (MultiTab)   │
│                 ├──────────────────────────────────────────────────────┤
│   Low Impact    │   P3-CODE-01 (Oxlint)        P2-UX-01 (AI Slop)     │
│                 └──────────────────────────────────────────────────────┘
│                        Low Likelihood               High Likelihood    │
└────────────────────────────────────────────────────────────────────────┘
```

### Blast Radius & Cross-Finding Dependencies

1. **Authentication Resolution Unblocks End-to-End Testing:** Resolving `P0-SEC-01` (`trustedOrigins` and `LoginPage`) is a prerequisite for authenticating Playwright tests in `P2-TEST-01`.
2. **Schema Migrations Precede Concurrency Fixes:** Resolving `P0-DATA-01` (initializing Prisma migrations) is required to declare the PostgreSQL constraints needed for `P1-DATA-03` (`CHECK (current_stock >= 0)`).
3. **Tenant Context Enforces Scoping:** Adding `organizationId` to `UserContext` in `P0-SEC-02` enables clean resolution of salesman report leakage in `P1-SEC-03`.

---

## 24. Prioritized Remediation Roadmap

The remediation plan is sequenced across four logical phases to ensure release blockers are resolved without regression:

```
[ Phase 1: Security & Route Blockers ] ──► [ Phase 2: Data Integrity & DB Migrations ]
                   │                                          │
                   ▼                                          ▼
[ Phase 3: Workflows & Accessibility ]  ──► [ Phase 4: Performance & Operations ]
```

### Phase 1 — Immediate Release Blockers & Security Hardening
- **Step 1.1:** Add `trustedOrigins: [env.CORS_ORIGIN, env.BETTER_AUTH_URL]` to `server/src/lib/auth.ts` (`P0-SEC-01`).
- **Step 1.2:** Build a fully functional `LoginPage` component with email/password form controls and error alerts (`P0-SEC-01`).
- **Step 1.3:** Fix route mounting in `server/src/app.ts` so `reportingRouter` responds directly to `/api/v1/dashboard` (`P0-FUNC-01`).
- **Step 1.4:** Enforce fail-loud validation on `BETTER_AUTH_SECRET` in `server/src/config/env.ts` for production (`P1-SEC-01`).
- **Step 1.5:** Wire `onSignOut` handler in `AuthenticatedLayout` to Better Auth client `signOut()` (`P1-FUNC-01`).

### Phase 2 — Multi-Tenancy & Data Integrity
- **Step 2.1:** Add `organizationId` foreign key to `model User` in `schema.prisma` and update `UserContext` (`P0-SEC-02`).
- **Step 2.2:** Initialize baseline migration ledger via `npx prisma migrate dev --name init_baseline` (`P0-DATA-01`).
- **Step 2.3:** Add database `CHECK (current_stock >= 0)` constraint and use row-level locks or atomic increments on stock updates (`P1-DATA-03`).
- **Step 2.4:** Replace `salesInvoice.count() + 1` with a dedicated `DocumentSequence` counter table (`P1-DATA-04`).
- **Step 2.5:** Update `evaluateAbac` to retrieve the database entity instead of trusting `req.body` (`P1-SEC-02`).

### Phase 3 — Functional Workflows & Accessibility
- **Step 3.1:** Implement live `PurchasesPage` and `CustomersPage` views connected to API endpoints (`P1-FUNC-02`).
- **Step 3.2:** Refactor `OrdersPage` and `ProductionPage` modals to dynamically query items and BOM recipes (`P1-DATA-02`).
- **Step 3.3:** Correct WCAG contrast ratios in `kbd.tsx` and button variants; fix `aria-label` name mismatches (`P2-A11Y-01`).
- **Step 3.4:** Restrict salesman scope for receivables and collections reports in `reporting.routes.ts` (`P1-SEC-03`).
- **Step 3.5:** Implement Web Locks API in `client/src/offline/sync-engine.ts` to prevent multi-tab outbox collisions (`P1-PWA-01`).

### Phase 4 — Scalability, Performance & Operations
- **Step 4.1:** Rewrite N+1 inventory balance loop into a single grouped SQL query (`P1-PERF-01`).
- **Step 4.2:** Implement `React.lazy()` route splitting across all portal pages in `client/src/app.tsx` (`P1-PERF-02`).
- **Step 4.3:** Add PWA manifest icons and favicon to `client/public/` (`P2-PWA-02`).
- **Step 4.4:** Upgrade `vitest` and `glob` dependencies to resolve 9 reported CVEs (`P2-SEC-04`).
- **Step 4.5:** Update Playwright config to spawn both backend and frontend servers; write frontend component tests (`P2-TEST-01`).
- **Step 4.6:** Create GitHub Actions CI workflow and Dockerfile manifests (`P2-DEVOPS-01`).

---

## 25. Production Go-Live Checklist

This checklist defines mandatory release gates required prior to promoting MillLedger to General Availability:

- [ ] **Gate 1 (Auth):** `POST /api/auth/sign-in/email` accepts credentials from `localhost:5173` without origin errors.
- [ ] **Gate 2 (UI Login):** Production build displays accessible login screen; user can log in and out successfully.
- [ ] **Gate 3 (Multi-Tenancy):** Requests with mismatched `organizationId` return HTTP 403 Forbidden.
- [ ] **Gate 4 (Overview):** `GET /api/v1/dashboard` returns HTTP 200 and renders KPI cards without 404 errors.
- [ ] **Gate 5 (DB Migrations):** `prisma migrate deploy` executes cleanly on clean Postgres instance without `db push`.
- [ ] **Gate 6 (Stock Safety):** Attempting to decrement stock below 0 throws a database check constraint violation.
- [ ] **Gate 7 (Bundle Budget):** Route code splitting implemented; initial JavaScript chunk size is under 300 kB minified.
- [ ] **Gate 8 (Accessibility):** Lighthouse Accessibility score is 100 with zero contrast or label-name mismatch warnings.
- [ ] **Gate 9 (E2E Integration):** Playwright executes against live backend API with zero `ECONNREFUSED` proxy errors.
- [ ] **Gate 10 (Security):** `pnpm audit` returns 0 critical and 0 high vulnerabilities.

---

## 26. Final Production-Readiness Verdict

```
┌────────────────────────────────────────────────────────────────────────┐
│                   FINAL AUDIT PRODUCTION VERDICT                       │
│                                                                        │
│                      [  NOT READY  ]                                   │
│                                                                        │
│  The MillLedger codebase contains 4 P0 Critical Blockers, 9 P1 High    │
│  Risks, 8 P2 Medium Defects, and 1 P3 Finding. While domain benchmark  │
│  mathematics and backend calculation engines are sound, commercial     │
│  release is prevented by complete front-end authentication failure,    │
│  multi-tenant BOLA vulnerabilities, broken landing route, absent       │
│  database migrations, and disconnected end-to-end testing gates.       │
└────────────────────────────────────────────────────────────────────────┘
```

### Metrics Summary

- **Total Findings:** 22
  - **P0 (Critical Blockers):** 4
  - **P1 (High Priority):** 9
  - **P2 (Medium Priority):** 8
  - **P3 (Low Priority):** 1
- **Automated Tests:** 61/61 backend unit/integration tests passed; 1/1 client test passed; 16/16 Playwright tests passed (disconnected proxy).
- **Core Web Vitals:** CLS: `0.0001` (Pass), LCP: `924ms` (Pass), TTFB: `6.4ms` (Pass).
- **Accessibility:** Lighthouse score 96/100 (Failed SC 1.4.3 Contrast, SC 2.5.3 Label in Name).
- **Security Audit:** 9 dependency vulnerabilities (2 Critical, 2 High, 5 Moderate). BOLA present in multi-tenant boundaries.

---

## Appendices

### Appendix A — Test Execution Evidence

#### 1. Vitest Test Execution Summary
```
$ vitest run --exclude '**/e2e/**'
Test Files  14 passed (14)
Tests       61 passed (61)
Duration    14.23s
```
Passed suites: `server/src/invoice-dispatch.test.ts`, `server/src/payments.test.ts`, `server/src/reports.test.ts`, `server/src/production.test.ts`, `server/src/purchases.test.ts`, `server/src/auth.integration.test.ts`, `server/src/masters.test.ts`, `server/src/app.test.ts`, `server/src/middleware/auth.middleware.test.ts`, `server/src/policies/rbac.test.ts`, `server/src/policies/abac.test.ts`, `client/src/lib/utils.test.ts`.

#### 2. CDI Benchmark Oracle Execution Summary
```
$ pnpm --filter @mill-ledger/server benchmark
[PASS] Flour weighted average cost after purchase     | Exp: ₹43.125 / kg   | Act: ₹43.125 / kg
[PASS] Production total run cost                      | Exp: ₹5,855.00      | Act: ₹5855.00
[PASS] Cost per good packet (₹5,855 / 188)            | Exp: ≈ ₹31.14       | Act: ₹31.14
[PASS] Finished Murukku stock after run (50 + 188)    | Exp: 238 packets    | Act: 238 packets
[PASS] Taxable invoice amount (150 pkts × ₹50)        | Exp: ₹7,500.00      | Act: ₹7500.00
[PASS] Finished stock on hand after dispatch          | Exp: 88 packets     | Act: 88 packets
[PASS] Distributor B stock shortage                   | Exp: 32 packets     | Act: 32 packets
[PASS] Retailer A invoice outstanding                 | Exp: ₹3,875.00      | Act: ₹3875.00
SUCCESS: All 18 benchmark assertions matched 100%!
```
Raw log archived at [docs/audits/production-readiness/evidence/benchmark-output.txt](/docs/audits/production-readiness/evidence/benchmark-output.txt).

---

### Appendix B — Relevant Visual Screenshots

1. **Dashboard 404 Route Conflict:**  
   ![Dashboard 404 Error](/home/snehan/projects/web/mill-ledger/docs/audits/production-readiness/evidence/dashboard-404.png)  
   *File path:* [docs/audits/production-readiness/evidence/dashboard-404.png](/docs/audits/production-readiness/evidence/dashboard-404.png)
2. **Mobile Navigation Shell (375×667 Viewport):**  
   ![Mobile Navigation Shell](/home/snehan/projects/web/mill-ledger/docs/audits/production-readiness/evidence/mobile-overview.png)  
   *File path:* [docs/audits/production-readiness/evidence/mobile-overview.png](/docs/audits/production-readiness/evidence/mobile-overview.png)

---

### Appendix C — Performance Measurements

Measured via Chrome DevTools PerformanceObserver API (`http://localhost:5173`):
- **Desktop Dashboard:** CLS: `0.000003`, LCP: `1192ms`, TTFB: `7.2ms`, DOMContentLoaded: `331.6ms`.
- **Desktop Orders:** CLS: `0.000127`, LCP: `924ms`, TTFB: `6.4ms`, DOMContentLoaded: `576.5ms`.
- **Mobile Dashboard (375px):** CLS: `0.000008`, LCP: `1048ms`, TTFB: `6.8ms`.
- **Lighthouse JSON Report:** Archived at [docs/audits/production-readiness/evidence/lighthouse-report.json](/docs/audits/production-readiness/evidence/lighthouse-report.json).

---

### Appendix D — Security Assessment Matrix

| Vulnerability Vector | Severity | Finding Reference | Remediation Status |
|---|---|---|---|
| Better Auth Invalid Origin (CORS 403) | P0 | `P0-SEC-01` | Open |
| Cross-Tenant BOLA Isolation Failure | P0 | `P0-SEC-02` | Open |
| Insecure Production Auth Secret Fallback | P1 | `P1-SEC-01` | Open |
| Client-Forged ABAC Attributes | P1 | `P1-SEC-02` | Open |
| Salesman Receivables Data Leak | P1 | `P1-SEC-03` | Open |
| Tinypool Prototype Pollution to RCE (CVE-2024-48999) | P2 | `P2-SEC-04` | Open |
| Glob Command Injection (GHSA-3g3m-2fjr-6pw4) | P2 | `P2-SEC-04` | Open |

---

### Appendix E — Requirements Coverage Matrix

| Milestone | Stated Capabilities | Real Implementation Coverage | Residual Gap |
|---|---|---|---|
| M1 | Multi-role auth, session expiration | Backend Better Auth implemented; frontend login and trusted origins missing | Auth flow non-functional |
| M2 | Master data, BOM recipes, opening stock | 100% verified against benchmark fixtures | None |
| M3 | Mandi intake, purchase bills, WAC | Service layer verified; frontend view is a placeholder | UI intake missing |
| M4 | Production run, yield/material variances | Service layer verified; UI hardcoded to benchmark items | Generic BOM selection missing |
| M5 | Sales order approval, stock reservations | Service layer verified; UI hardcoded to benchmark customers | Generic order entry missing |
| M6 | Tax invoices, dispatches, credit notes | 100% verified in service layer; invoice numbering sequence fragile | Sequence concurrency risk |
| M7 | Payment receipting, FIFO allocations | 100% verified in service layer | UI disabled by 401 state |
| M8 | Executive dashboard, GST/audit reporting | Reports verified; dashboard route throws 404 | 404 routing error |
| M9 | Offline-first Dexie outbox | Outbox queuing implemented; multi-tab mutex missing | Tab sync race condition |
| M10 | Mobile responsive layouts, Tamil I18n | Responsive shell and Tamil translation dictionary verified | None |
| M11 | Production readiness & hardening | Benchmark passes; migrations, Docker, and CI/CD missing | Deployment tooling missing |

---

### Appendix F — Skills Inventory

Loaded and inspected during Phase 0:
- `antislop` (`~/.gemini/config/skills/antislop/SKILL.md`)
- `antislop-ui` (`~/.gemini/config/skills/antislop-ui/SKILL.md`)
- `antislop-human` (`~/.gemini/config/skills/antislop-human/SKILL.md`)
- `antislop-code` (`~/.gemini/config/skills/antislop-code/SKILL.md`)
- `better-auth-best-practices` (`.agents/skills/better-auth-best-practices/SKILL.md`)
- `better-auth-security-best-practices` (`.agents/skills/better-auth-security-best-practices/SKILL.md`)
- `security-best-practices` (`.agents/skills/security-best-practices/SKILL.md`)
- `postgresql-best-practices` (`.agents/skills/postgresql-best-practices/SKILL.md`)
- `prisma-client-api` (`.agents/skills/prisma-client-api/SKILL.md`)
- `vercel-react-best-practices` (`.agents/skills/vercel-react-best-practices/SKILL.md`)
- `web-design-guidelines` (`.agents/skills/web-design-guidelines/SKILL.md`)
- `playwright-best-practices` (`.agents/skills/playwright-best-practices/SKILL.md`)
- `vitest` (`.agents/skills/vitest/SKILL.md`)
- `typescript-strict` (`.agents/skills/typescript-strict/SKILL.md`)
- `verification-before-completion` (`.agents/skills/verification-before-completion/SKILL.md`)

---

### Appendix G — Unverified Areas

1. **Real-World PostgreSQL Entra/Cloud Managed Scaling:** Tested locally on PostgreSQL 16; behavior under Azure PostgreSQL Flexible Server connection pool limits (PgBouncer) remains unmeasured in this local environment.
2. **Production Backup Restoration:** Database backup PITR was not exercised because no cloud backup repository is configured in the local workspace.
3. **Real-User Monitoring (RUM) Field Core Web Vitals:** Measurements reflect laboratory conditions on headless Chrome; real-user mobile network latency (4G/3G in rural Tamil Nadu mandis) remains unverified.

---

### Appendix H — Glossary

- **ATP:** Available to Promise (`onHand - activeStockReservations`).
- **BOLA:** Broken Object Level Authorization (OWASP API Security Top 10 #1).
- **BOM:** Bill of Materials (recipe formula for production).
- **CLS:** Cumulative Layout Shift (Core Web Vital).
- **FIFO:** First In, First Out (allocation method for matching customer payments against oldest outstanding invoices).
- **HSN:** Harmonized System of Nomenclature (statutory 8-digit Indian GST tax code).
- **LCP:** Largest Contentful Paint (Core Web Vital).
- **PWA:** Progressive Web Application (offline caching via service workers and Web App Manifest).
- **WAC:** Weighted Average Cost (moving average inventory valuation formula).
