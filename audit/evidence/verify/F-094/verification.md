# 10-Point Independent Verification Evidence for F-094

**Finding ID**: F-094  
**Title**: Dead Code, Orphaned Stubs, and Dependency Bloat (10 Unused Dependencies, Orphaned Dictionary, and 22 Dead Placeholder Pages)  
**Cluster**: CLUSTER-15 (Production Hardening & Operations)  
**Tier**: T11  
**Severity**: P2  
**Disposition**: VERIFIED  
**Code Commit**: `de4ac79`  

---

## 1. Requirement & Expected vs Actual
- **Expected**: Complete elimination of dead dependencies, orphaned source files, duplicate utility implementations, and unmounted middleware.
- **Actual**:
  - Removed 7 phantom dependencies from `client/package.json` (`@hookform/resolvers`, `date-fns`, `next-themes`, `react-day-picker`, `react-hook-form`, `shadcn`, `zod`).
  - Removed 2 phantom devDependencies from `server/package.json` (`@types/supertest`, `supertest`).
  - Deleted orphaned `client/src/lib/i18n-dictionary.ts`.
  - Purged 22 dead exported placeholder components from `client/src/pages/placeholder-pages.tsx`, retaining only the active `NotFoundPage`.
  - Removed unmounted dead middleware `requireTenant` from `server/src/middleware/auth.middleware.ts` (tenant validation is actively enforced within `authorize()`).
  - Refactored `client/src/components/shell/use-connection-status.ts` to delegate directly to `useIsOnline` from `@/offline/use-offline`, eliminating event listener duplication.
- **Delta**: 1,890 lines of dead code, duplicate logic, and unused dependencies removed.

## 2. Regression Test Execution
- **Command**: `pnpm exec vitest run audit/tests/f-094-regression.test.ts --config /dev/null`
- **Output**: 6/6 tests passed (407ms).
  - Orphaned dictionary non-existence verified.
  - Placeholder pages exports isolated strictly to `NotFoundPage`.
  - Client phantom dependencies verified absent.
  - Server phantom devDependencies verified absent.
  - Dead `requireTenant` verified removed from middleware exports.
  - `useConnectionStatus` verified delegating to `useIsOnline`.

## 3. Updated Suite Tests Execution
- **Command**: `pnpm exec vitest run client/src/offline/db.test.ts server/src/middleware/auth.middleware.test.ts`
- **Output**: 9/9 tests passed across affected test suites.

## 4. Full Test Suite Execution
- **Command**: `pnpm test`
- **Output**: 39 passed out of 39 test files (259 tests passed).

## 5. Workspace Typecheck
- **Command**: `pnpm typecheck`
- **Output**: 0 errors across all 3 workspaces (`shared`, `client`, `server`).

## 6. Lint Verification
- **Command**: `pnpm lint`
- **Output**: 0 warnings, 0 errors on 203 files (oxlint).

## 7. CDI Benchmark Suite
- **Command**: `pnpm benchmark`
- **Output**: 18/18 benchmark assertions matched 100%. Exit code: 0.

## 8. PostgreSQL Database Invariants
- **Command**: `PGPASSWORD=postgres psql -U postgres -h localhost -d mill_ledger -f audit/scripts/invariants.sql`
- **Output**: 0 violation rows across all 10 invariants.

## 9. Security & Authorization Integrity
- BOLA tenant boundary isolation remains fully enforced via `authorize()` in `server/src/middleware/auth.middleware.ts:98-114`.

## 10. Traceability & Disposition
- Finding updated in `audit/tracker/tracker.json` to `VERIFIED`.
- Finding document `audit/findings/F-094.md` updated with verification evidence and commit hashes.
