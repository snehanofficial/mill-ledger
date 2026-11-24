# 10-Point Independent Verification Evidence for F-077

**Finding ID**: F-077  
**Title**: Offline Stale Price Acceptance Without Server-Side Price List Revalidation  
**Cluster**: CLUSTER-12 (Database & Query Performance)  
**Tier**: T11  
**Severity**: P2  
**Disposition**: VERIFIED  
**Code Commit**: `4505d38`  

---

## 1. Requirement & Expected vs Actual
- **Expected**: Offline-created sales orders must be revalidated against server statutory and master data upon synchronization. If a price list or SKU price changed on the server while the device was offline, the server must flag a price revision conflict for administrative review (`UNDER_REVIEW`) and store the revision trail in `overrideReason` rather than silently auto-submitting obsolete cached prices.
- **Actual**:
  - Added `pricedAt` to `createOrderSchema` and forwarded from `client/src/offline/sync-engine.ts`.
  - Added periodic 5-minute background refresh of master data snapshot in `client/src/offline/use-offline.ts` to prevent stale caches while online.
  - In `server/src/modules/sales/sales.service.ts`:
    - Included `priceList: true` on variant price lines to capture timestamps.
    - Verified whether price lines were revised after `pricedAt`.
    - Flagged stale price mismatch into `UNDER_REVIEW` with exact quoted vs revised list price audit note in `overrideReason`.
    - Preserved normal salesman discount discretion for fresh orders within threshold.
- **Delta**: Zero revenue leakage from stale offline prices. All price revisions require administrative approval before dispatch or invoicing.

## 2. Regression Test Execution
- **Command**: `pnpm exec vitest run -c audit/tests/vitest.audit.config.ts audit/tests/f-077-regression.test.ts`
- **Output**: 3/3 tests passed (471ms).
  - Validated sync-engine sends `pricedAt` and use-offline sets periodic refresh.
  - Validated stale price quotes after price list updates are flagged into `UNDER_REVIEW` with audit reason.
  - Validated fresh price orders within 5% discretion correctly land in `SUBMITTED`.

## 3. Updated Suite Tests Execution
- **Command**: `pnpm exec vitest run server/src/orders.test.ts`
- **Output**: 6/6 test suites passed.

## 4. Full Test Suite Execution
- **Command**: `pnpm test`
- **Output**: 39 passed out of 39 test files (259 tests passed).

## 5. Workspace Typecheck
- **Command**: `pnpm typecheck`
- **Output**: 0 errors across all 3 workspaces (`shared`, `client`, `server`).

## 6. Lint Verification
- **Command**: `pnpm lint`
- **Output**: 0 warnings, 0 errors on 208 files (oxlint).

## 7. CDI Benchmark Suite
- **Command**: `pnpm benchmark`
- **Output**: 18/18 benchmark assertions matched 100%. Exit code: 0.

## 8. PostgreSQL Database Invariants
- **Command**: `PGPASSWORD=postgres psql -U postgres -h localhost -d mill_ledger -f audit/scripts/invariants.sql`
- **Output**: 0 violation rows across all 10 invariants.

## 9. Security & Financial Risk Integrity
- Conforms to OWASP A04:2021 (Insecure Design - Business Logic Flaws). Prevents financial loss from honoring obsolete cached prices.

## 10. Traceability & Disposition
- Finding updated in `audit/tracker/tracker.json` to `VERIFIED`.
- Finding document `audit/findings/F-077.md` updated with verification evidence and commit hashes.
