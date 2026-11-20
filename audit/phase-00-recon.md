# Phase 0 Reconnaissance Report: MillLedger Baseline & Scratch Execution

**Date**: 2026-11-19  
**Target Environment**: Linux x86_64, Node v22.22.1, pnpm 12.18.0, PostgreSQL 18.6  
**Auditor**: Principal Engineer & Application Security Reviewer  
**Audit Mode**: AUDIT ONLY (Read-only observation; zero modifications outside `/audit/**`)  

---

## 1. Quick Start Execution from Scratch

We executed the README Quick Start step by step on a fresh, isolated throwaway database (`mill_ledger_audit_throwaway`) to prove whether the project runs cleanly from scratch without tribal knowledge.

### Step-by-Step Execution Log

| README Step | Exact Command Run | Result | Duration | Discrepancy / Undocumented Action Required |
|-------------|-------------------|--------|----------|---------------------------------------------|
| **1. Install dependencies** | `pnpm install` | **PASS** | 0.031s | None. Dependencies resolved and linked cleanly. |
| **2. Configure environment** | `cp server/.env.example server/.env` | **FAIL** | 0.005s | `cp: cannot stat 'server/.env.example': No such file or directory`. The file is actually located in workspace root `./.env.example`. (Logged as **F-002**) |
| **3a. Run migrations** | `DATABASE_URL=... pnpm --filter @mill-ledger/server prisma migrate deploy` | **PASS** | 1.252s | Both baseline migrations (`20261118000000_init_baseline` and `20261118000001_constraints_and_sequences`) applied successfully. |
| **3b. Seed benchmark data** | `DATABASE_URL=... pnpm --filter @mill-ledger/server prisma db seed` | **SILENT FAIL** | 0.817s | Command exited code 0 but printed `⚠️ No seed command configured` and inserted **0 rows** into the database. (Logged as **F-003**) |
| **3b (Workaround)** | `DATABASE_URL=... pnpm --filter @mill-ledger/server run db:seed` | **PASS** | 1.739s | Undocumented script invoked `tsx prisma/seed.ts` directly, successfully seeding 8 users, facilities, and benchmark stock. |
| **4. Start dev servers** | `pnpm dev` | **PASS** | ~0.25s startup | Vite server started on `http://localhost:5173`. Backend Express server started on port **4000**, contradicting README claim of port 3000. |

**Total execution time from clean clone to active servers**: ~4.1 seconds.

---

## 2. Prerequisites Verification

We compared README claims against system tools, `package.json`, and the npm registry:

1. **Node.js 22+**:
   - Runtime: `node --version` -> `v22.22.1` (**VERIFIED-PASS**).
   - Package Engines: Neither root `package.json` nor any workspace `package.json` contains an `"engines"` field. The constraint is documented only in prose.
2. **pnpm 12+**:
   - Runtime: `pnpm --version` -> `12.18.0` (**VERIFIED-PASS**).
   - Package Manager Specification: Root `package.json` specifies `"packageManager": "pnpm@12.18.0"`.
   - Registry Availability: `pnpm view pnpm version` reports `12.21.0` on the npm registry.

---

## 3. Raw Test Suite & Tooling Command Results

Every required verification command was run in THIS session, and raw logs were persisted to `audit/evidence/`:

```
┌──────────────────┬──────────────┬────────────────────────────────────────────────────────┐
│ Command          │ Exit Code    │ Evidence File & Key Metric                             │
├──────────────────┼──────────────┼────────────────────────────────────────────────────────┤
│ pnpm typecheck   │ 0 (PASS)     │ audit/evidence/06-typecheck.txt (3/3 workspaces clean) │
│ pnpm lint        │ 0 (PASS)     │ audit/evidence/07-lint.txt (0 errors, 0 warnings)      │
│ pnpm test        │ 0 (PASS)     │ audit/evidence/08-test.txt (20 files, 95/95 passed)   │
│ pnpm benchmark   │ 0 (PASS)     │ audit/evidence/09-benchmark.txt (18/18 exact targets)  │
│ pnpm test:e2e    │ 1 (FAIL)     │ audit/evidence/10-test-e2e.txt (25 passed, 1 failed)   │
│ pnpm audit       │ 0 (PASS)     │ audit/evidence/11-audit.txt (1 High, 3 Moderate)       │
│ pnpm build       │ 0 (PASS)     │ audit/evidence/12-build.txt (Total bundle built clean) │
└──────────────────┴──────────────┴────────────────────────────────────────────────────────┘
```

### Detailed Command Analysis

#### 1. Vitest Test Suite (`pnpm test`)
- 20 test files, 95 tests passed in 17.75s.
- Runtime observation: Deprecation warning emitted by `pg` driver during transaction execution:
  `(node:36756) DeprecationWarning: Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0.`

#### 2. Playwright E2E Suite (`pnpm test:e2e`) - **VERIFIED-FAIL** (F-001)
- 25 passed, 1 failed out of 26 browser specs.
- Failure occurred in `e2e/app-shell.spec.ts:251:3`: `MillLedger Application Shell > keyboard accessibility: skip-to-main content link and focus`.
- **Root Cause**: Playwright strict mode violation. `getByRole('link', { name: 'Skip to main content' })` matched two identical links on the page:
  1. `<a href="#main-content" ...>` in `AuthenticatedShell` ([client/src/components/shell/authenticated-shell.tsx#L1080](file:///home/snehan/projects/web/mill-ledger/client/src/components/shell/authenticated-shell.tsx#L1080))
  2. `<a href="#main-content" ...>` in `Header` ([client/src/components/shell/authenticated-shell.tsx#L845](file:///home/snehan/projects/web/mill-ledger/client/src/components/shell/authenticated-shell.tsx#L845))

#### 3. Security Audit (`pnpm audit`) - **ADVISORY** (F-006)
- Found 1 High vulnerability: `zod` <4.6.6 (GHSA-mrhx-c7xc-m3w5: Zod can exhaust memory while validating oversized constrained collections).
- Found 3 Moderate vulnerabilities: `vitest` / `@vitest/mocker` (GHSA-82fw-gwwq-j7x9, GHSA-qxg6-89mg-rqv8).

#### 4. Frontend Bundle Distribution (`pnpm build`)
- Largest production vendor chunks:
  - `dist/assets/index-BzFjHkL7.js`: 328.97 kB (gzip: 103.46 kB)
  - `dist/assets/vendor-react-ChpnLT_r.js`: 302.16 kB (gzip: 95.40 kB)
  - `dist/assets/vendor-ui-CzUsY5oe.js`: 155.27 kB (gzip: 48.34 kB)
  - `dist/assets/showcase-page-CQu1VOK8.js`: 60.42 kB (gzip: 15.95 kB)
  - `dist/assets/index-Dj0XqGw5.css`: 68.09 kB (gzip: 12.88 kB)
- PWA Service Worker generated with 38 precached assets (1217.85 KiB).

---

## 4. Benchmark Authenticity Verification (Anti-Rigging Test)

To ensure the benchmark runner is not a hardcoded "theater" script that always passes:

### 1. Static Scan for Hardcoded Constants
We scanned `server/src/modules/`, `client/src/`, and `shared/src/` for hardcoded target numbers from Section 5 (`43.125`, `5855`, `31.14`, `7875`, `187.5`).
- **Result**: **0 hardcoded constants found in business logic modules**. All calculations in services are computed dynamically using Decimal arithmetic.

### 2. Mutation Experiment in Scratch Workspace
In `audit/scratch/mill-ledger-copy/server/src/modules/inventory/inventory.service.ts`, we deliberately mutated the moving weighted average formula:
```ts
// Mutated: set new weighted average directly to purchaseRate (45.0) instead of calculating weighted average
const newWeightedAverageCost = purchaseRate;
```
We then executed the benchmark runner against this mutated code.

**Raw Mutation Output** ([audit/evidence/13-benchmark-broken-test.txt](file:///home/snehan/projects/web/mill-ledger/audit/evidence/13-benchmark-broken-test.txt)):
```
==========================================================
 Benchmark Acceptance Summary Results
==========================================================
[FAIL] Flour weighted average cost after purchase     | Exp: ₹43.125 / kg   | Act: ₹45.000 / kg
[FAIL] Production total run cost                      | Exp: ₹5,855.00      | Act: ₹5930.00
[FAIL] Cost per good packet (₹5,855 / 188)            | Exp: ≈ ₹31.14       | Act: ₹31.54
[PASS] Yield variance (-6% flagged)                   | Exp: true           | Act: true
...
==========================================================
 FAILURE: One or more benchmark assertions failed.
 Exit code: 1
```

**Conclusion**: The benchmark runner is genuine, dynamic, and rigorously checks computed ledger balances. When domain math is broken, the runner immediately catches the error and exits with code 1.

---

## 5. Phase 0 Findings Summary

| Finding ID | Title | Severity | Category | Status |
|------------|-------|----------|----------|--------|
| **[F-001](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-001.md)** | Duplicate "Skip to main content" links break Playwright E2E and keyboard a11y | **P1** | Accessibility / Tests | OPEN |
| **[F-002](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-002.md)** | README Quick Start references nonexistent template path and incorrect port 3000 | **P2** | Documentation Drift | OPEN |
| **[F-003](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-003.md)** | README command `prisma db seed` fails silently with 0 records inserted | **P1** | Core Onboarding / CLI | OPEN |
| **[F-004](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-004.md)** | Seed script lacks production guard, allowing test account injection into live databases | **P0** | Security / Auth | OPEN |
| **[F-005](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-005.md)** | Dead / Unused package `cn@0.5.2` declared in client dependencies | **P3** | Dependency Hygiene | OPEN |
| **[F-006](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-006.md)** | High-severity memory exhaustion advisory GHSA-mrhx-c7xc-m3w5 in Zod <4.6.6 | **P2** | Supply Chain Security | OPEN |
