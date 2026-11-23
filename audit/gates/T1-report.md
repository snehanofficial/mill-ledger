# Tier T1 Gatekeeper Audit Report

**Date**: November 22, 2026  
**Role**: GATEKEEPER  
**Tier**: T1 (Domain Invariants, Concurrency, Immutability & Calculations)  
**Target Reference**: [`audit/runs/010-gate-T1.prompt.md`](file:///home/snehan/projects/web/mill-ledger/audit/runs/010-gate-T1.prompt.md)  
**Verdict**: **FAIL**  
**Verdict File**: [`audit/gates/T1.json`](file:///home/snehan/projects/web/mill-ledger/audit/gates/T1.json)  

---

## 1. Tracker Integrity & Status Inventory

Per Gate requirement 1:
> *"The tier passes only if every P0/P1/P2 item is VERIFIED or has an owner-approved WONT-FIX. P3 may carry over with a recorded reason."*

### Tracker Validator Output
Command executed: `node audit/tracker/check-tracker.mjs`
```text
✅ Tracker validation PASSED: 106 work items cleanly verified.
```

### Tier T1 Work Items Inventory (11 items)

| ID | Title | Severity | Cluster | Status | Meets Exit Gate Criteria? |
|---|---|---|---|---|---|
| **F-097** | Architectural Inconsistency: Zero Centralized Currency & Date Formatters across 7 Financial Surfaces | P2 | CLUSTER-01 | `VERIFIED` | **YES** (Verified in commit `fb80f3d`) |
| **F-009** | Application database role retains full UPDATE and DELETE privileges on stock movements and posted invoices without database triggers or rules | P1 | CLUSTER-03 | `FIXED-UNVERIFIED` | **NO** (Not independently verified) |
| **F-010** | Invoice tax and totals calculated with unrounded JS float math produce 1-2 paise rounding drift in 46.4% of invoices | P1 | CLUSTER-01 | `OPEN` | **NO** (Unresolved) |
| **F-036** | Dashboard Sales Revenue Silently Drops Invoices Without Lines (SQL vs API Mismatch) | P0 | CLUSTER-01 | `OPEN` | **NO** (Unresolved) |
| **F-007** | Missing row-level lock in sales order approval allows concurrent orders to exceed ATP stock by over 100% | P0 | CLUSTER-02 | `OPEN` | **NO** (Unresolved) |
| **F-008** | Non-atomic `count()` based dispatch sequence generation causes unique constraint crashes on concurrent dispatches | P0 | CLUSTER-02 | `OPEN` | **NO** (Unresolved) |
| **F-015** | Idempotency pre-query race condition causes concurrent duplicate submissions to crash with unhandled 500 unique constraint error | P2 | CLUSTER-02 | `OPEN` | **NO** (Unresolved) |
| **F-011** | `financeService.getFinancialYear()` relies on Node process timezone, misclassifying April 1st morning invoices into previous financial year on UTC servers | P1 | CLUSTER-03 | `FIXED-UNVERIFIED` | **NO** (Not independently verified) |
| **F-013** | Backend lacks payment bounce/reversal methods and debit note data structures required for double-entry correction | P1 | CLUSTER-03 | `OPEN` | **NO** (Unresolved) |
| **F-014** | Statutory GST rates are read from static `product.taxRate` columns; the dedicated `TaxRate` master table is never queried | P2 | CLUSTER-03 | `OPEN` | **NO** (Unresolved) |
| **F-016** | Packaging capacity mismatch warning is hardcoded to specific SKU and multiplier, and is never persisted to database | P2 | CLUSTER-03 | `OPEN` | **NO** (Unresolved) |

**Integrity Result**: **FAIL**. 10 of 11 items in Tier T1 are P0/P1/P2 items that are neither `VERIFIED` nor owner-approved `WONT-FIX`.

---

## 2. Clean-Room Run from Branch Tip

| Pipeline Step | Command | Result | Evidence |
|---|---|---|---|
| **Typecheck** | `pnpm -r run typecheck` | **PASS** (0 errors) | [`audit/runs/gate-T1-checks.log:1-8`](file:///home/snehan/projects/web/mill-ledger/audit/runs/gate-T1-checks.log#L1-L8) |
| **Linter** | `oxlint .` | **PASS** (0 errors, 14 warnings in untracked backup files) | [`audit/runs/gate-T1-checks.log:9-142`](file:///home/snehan/projects/web/mill-ledger/audit/runs/gate-T1-checks.log#L9-L142) |
| **Unit & Integration** | `vitest run --exclude '**/e2e/**'` | **PASS** (23 files, 123 tests passed) | [`audit/runs/gate-T1-checks.log:143-322`](file:///home/snehan/projects/web/mill-ledger/audit/runs/gate-T1-checks.log#L143-L322) |
| **Production Build** | `pnpm -r run build` | **PASS** (Client & Server dist generated) | [`audit/runs/gate-T1-checks.log:323-373`](file:///home/snehan/projects/web/mill-ledger/audit/runs/gate-T1-checks.log#L323-L373) |
| **End-to-End** | `playwright test` | **PASS** (25 passed, 1 skipped) | [`audit/runs/gate-T1-checks.log:374-411`](file:///home/snehan/projects/web/mill-ledger/audit/runs/gate-T1-checks.log#L374-L411) |
| **CDI Benchmark** | `pnpm --filter @mill-ledger/server benchmark` | **PASS** (18/18 numerical assertions 100% matched) | [`audit/runs/gate-T1-checks.log:412-460`](file:///home/snehan/projects/web/mill-ledger/audit/runs/gate-T1-checks.log#L412-L460) |
| **Invariants SQL** | `psql "$DATABASE_URL" -f audit/scripts/invariants.sql` | **PASS** (0 violation rows across all 10 invariants) | Executed against `mill_ledger` live database |
| **Tracker Check** | `node audit/tracker/check-tracker.mjs` | **PASS** (106 work items verified) | Clean exit 0 |

---

## 3. Re-run Earlier Phase Checks (Phase 2 Domain Checks)

Original audit scripts from Phase 2 were executed against the live test database:

### 3.1 Concurrency Tests: Approve & Dispatch (`audit/scripts/verify-concurrency-approve-dispatch.ts`)
- **Observed Behavior**:
  - Across 10 iterations of 30 parallel requests: 10-11 sales orders approved concurrently against only 50 available stock units.
  - Total units reserved: 100-110 units (Expected $\le$ 50 units).
  - Status: `oversold = true` across all 10 iterations.
  - Parallel dispatches crashed with: `Unique constraint failed on the constraint: dispatch_organizationId_dispatchNumber_key`.
- **Finding Confirmation**: Reproduces **F-007** (P0) and **F-008** (P0).
- **Result**: **FAIL**

### 3.2 Concurrency Tests: Purchases & Production (`audit/scripts/verify-concurrency-purchases-production.ts`)
- **Observed Behavior**:
  - Parallel purchase receipts and production runs on same item executed.
  - Final Stock: 200 (Expected: 200). Final WAC: 45 (Expected: 45).
  - Stock match: `true`, Cost match: `true`.
- **Result**: **PASS**

### 3.3 Database Immutability (`audit/scripts/verify-immutability.ts`)
- **Observed Behavior**:
  - `UPDATE stock_movement`: Refused by trigger (`P0001: Stock movements are immutable: UPDATE on stock_movement is prohibited`).
  - `DELETE stock_movement`: Refused by trigger (`P0001: Stock movements are immutable: DELETE on stock_movement is prohibited`).
  - `UPDATE sales_invoice`: Refused by trigger (`P0001: Posted sales invoice financial and identification fields are immutable`).
- **Result**: **PASS** (Fix committed in `ba71207`, awaiting independent verification).

### 3.4 Scale & Ledger Reconciliation on 100k+ Movements (`audit/scripts/verify-reports-and-scale.ts`)
- **Observed Behavior**:
  - Inserted 100,000 movements in 10 batches of 10,000 in 14.27s.
  - SQL ledger reconciliation query executed across 100,000 movements in 15ms.
  - Sum of movement quantities: 100,000 (Expected: 100,000). Reconciliation exact match: `true`.
  - Sales Register, Stock Summary, Collections, Receivables all matched SQL aggregations.
- **Result**: **PASS**

---

## 4. Metric Comparison vs. `/audit/baseline`

| Check / Metric | Baseline Metric | Current Metric | Delta / Status |
|---|---|---|---|
| **Typecheck** | Exit 0 (0 errors) | Exit 0 (0 errors) | Unchanged (PASS) |
| **Linter** | 2 warnings in `orchestrate.mjs` | 14 warnings (12 from `.backup-remediation-baseline/`) | Clean in main codebase; 0 errors |
| **Unit / Integration Tests** | 23 files, 123 tests passing | 23 files, 123 tests passing | Unchanged (PASS) |
| **E2E Browser Tests** | 25 passed, 1 failed (`app-shell.spec.ts:251:3`) | 25 passed, 1 skipped, 0 failed | **IMPROVED** (+1 pass) |
| **Production Build** | Client dist: 1271 KiB precache | Client dist: 1271.39 KiB precache | Unchanged (PASS) |
| **CDI Benchmark** | 18/18 matched (100%) | 18/18 matched (100%) | Unchanged (PASS) |
| **Invariants SQL** | 0 violation rows | 0 violation rows on baseline state | Unchanged (PASS) |

No metric has degraded compared to the baseline.

---

## 5. Documentation & README Drift Check

The following discrepancies between repository documentation and actual implementation were identified:

1. **Port Configuration**:
   - `README.md` line 40 states: *"The frontend runs at http://localhost:5173 and the backend API runs at http://localhost:3000."*
   - Reality: Server defaults to port 4000 in `.env`, `.env.example`, and `server/src/index.ts`.
2. **Row Locks & Concurrency**:
   - `README.md` line 9 claims: *"PostgreSQL enforces foreign keys, row locks, and ledger immutability."*
   - Reality: Row-level locking on sales order approval is missing, allowing concurrent orders to oversell stock by over 100% (F-007).
3. **Double Selling Prevention**:
   - `README.md` line 118 claims: *"Strict stock reservation preventing double selling."*
   - Reality: Under concurrent submission, reservations exceed current physical stock (F-007).
4. **Idempotent Outbox Handling**:
   - `README.md` line 125 claims: *"Offline Order Capture with Sync Engine: Dexie IndexedDB client side queue with idempotent server replay, conflict detection, and retry mechanics."*
   - Reality: Concurrent duplicate submission produces an unhandled 500 error due to unique constraint race condition instead of returning the cached transaction (F-015).
5. **Packaging Mismatch Alert**:
   - `README.md` line 127 claims: *"Non blocking Packaging Mismatch Warning: Real time notification when carton pack size capacity... differs from production good output."*
   - Reality: Hardcoded to specific SKU multiplier on client side only; not persisted to database or configurable (F-016).
6. **Statutory Tax Rates**:
   - `README.md` line 119 claims: *"Indian GST statutory calculation: CGST, SGST, IGST with inter state and intra state logic."*
   - Reality: Dynamic `TaxRate` master table is never queried; rates are hardcoded/read from static product column (F-014), and unrounded float arithmetic causes 1-2 paise drift in invoices (F-010).

---

## 6. Gatekeeper Verdict and Required Actions

### Verdict: **FAIL**

### Summary of Failed Checks
1. `tracker-integrity-unverified-p0-p1-p2`: 10 of 11 items in Tier T1 remain unverified.
2. `concurrency-sales-order-oversold-f007`: Replicated critical race condition in sales order approval.
3. `concurrency-dispatch-collision-f008`: Replicated collision in non-atomic dispatch counter.
4. `database-immutability-unverified-f009`: F-009 awaits formal independent verification.
5. `financial-year-timezone-unverified-f011`: F-011 awaits formal independent verification.

### Items Requiring Remediation / Verification
- **F-007** (P0): Implement `SELECT ... FOR UPDATE` row-level locks on stock reservation approval.
- **F-008** (P0): Replace `count()` sequence generation with atomic database sequence or lock.
- **F-036** (P0): Fix dashboard SQL query to include sales invoices without line items.
- **F-009** (P1): Run independent verification for PostgreSQL immutability triggers.
- **F-010** (P1): Implement exact decimal arithmetic for invoice GST tax calculations.
- **F-011** (P1): Run independent verification for IST financial year determination.
- **F-013** (P1): Add payment bounce/reversal methods and debit note support.
- **F-014** (P2): Wire statutory GST calculations to `TaxRate` master table.
- **F-015** (P2): Implement atomic idempotency key checking with `ON CONFLICT` handling.
- **F-016** (P2): Persist and make packaging capacity mismatch warning dynamic.
