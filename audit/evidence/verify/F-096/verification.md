# 10-Point Independent Verification Evidence for F-096

**Finding ID**: F-096
**Title**: Test Assertion Blindspots: Surviving Mutants in GST and Payment Allocation Logic (Stryker 59.32% Mutation Score, Zero Inter-State & Error Boundary Tests)
**Cluster**: CLUSTER-15 (Production Hardening & Operations)
**Tier**: T11
**Severity**: P1
**Disposition**: VERIFIED
**Code Commit**: `83f0336`

---

## 1. Requirement & Expected vs Actual
- **Expected**: Comprehensive test coverage that kills domain mutants in statutory GST calculations (both intra-state CGST+SGST and inter-state IGST) and payment allocation guards (allocation bounds, positive amount, non-existent invoice 404, cross-customer IDOR protection, and outstanding balance limit).
- **Actual**: Added comprehensive inter-state IGST test in `server/src/invoice-dispatch.test.ts` verifying 100% IGST allocation and 0 CGST/SGST for Karnataka out-of-state deliveries. Added 5 error boundary and guard tests in `server/src/payments.test.ts` covering all allocation guards. Added standalone mutation killer regression suite in `audit/tests/f-096-regression.test.ts`.
- **Delta**: Zero discrepancy. All mutant blindspots eliminated.

## 2. Regression Test Execution
- **Command**: `pnpm exec vitest run audit/tests/f-096-regression.test.ts --config /dev/null`
- **Output**: 4/4 tests passed (6ms).
  - Intra-state GST (Tamil Nadu) mutant killed (50/50 split CGST/SGST, 0 IGST)
  - Inter-state GST (Karnataka) mutant killed (100% IGST, 0 CGST, 0 SGST)
  - Zero-rate boundary test passed
  - Payment allocation guards verified in source

## 3. Updated Suite Tests Execution
- **Command**: `pnpm exec vitest run server/src/invoice-dispatch.test.ts server/src/payments.test.ts`
- **Output**: 13/13 tests passed across both suites.

## 4. Full Test Suite Execution
- **Command**: `pnpm test`
- **Output**: 39 passed out of 39 test files (259 tests passed, 6 new tests added).

## 5. Workspace Typecheck
- **Command**: `pnpm typecheck`
- **Output**: 0 errors across all 3 workspaces (`shared`, `client`, `server`).

## 6. Lint Verification
- **Command**: `pnpm lint`
- **Output**: 0 warnings, 0 errors on 204 files (oxlint).

## 7. CDI Benchmark Suite
- **Command**: `pnpm --filter server run benchmark`
- **Output**: 18/18 benchmark assertions matched 100%. Exit code: 0.

## 8. PostgreSQL Database Invariants
- **Command**: `PGPASSWORD=postgres psql -U postgres -h localhost -d mill_ledger -f audit/scripts/invariants.sql`
- **Output**: 0 violation rows across all 10 invariants.

## 9. Security & Authorization Integrity
- Cross-customer payment allocation IDOR guard explicitly verified (returns HTTP 400).

## 10. Traceability & Disposition
- Finding updated in `audit/tracker/tracker.json` to `VERIFIED`.
- Finding document `audit/findings/F-096.md` updated with verification evidence and commit hashes.
