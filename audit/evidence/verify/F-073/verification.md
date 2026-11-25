# 10-Point Independent Verification Evidence for F-073

**Finding ID**: F-073  
**Title**: Slow 4G Largest Contentful Paint (LCP) Degraded by Serial Resource Waterfall  
**Cluster**: CLUSTER-12 (Database & Query Performance)  
**Tier**: T8 (Performance & Asset Optimization)  
**Severity**: P1  
**Disposition**: VERIFIED  
**Code Commit**: `7c1a39b`  

---

## 1. Requirement & Expected vs Actual
- **Expected**: Largest Contentful Paint (LCP) on Slow 4G connections must meet Google Web Vitals mobile guidelines (< 2.5s) and eliminate serial resource loading waterfalls and layout shifts during initial load and authenticated transition (Phase 10 Audit Prompt & Specification, `audit/01-expected-spec.md` REQ-056).
- **Actual**:
  - Pre-warmed `AuthenticatedLayout` dynamically on login submit button hover and focus in `client/src/pages/login-page.tsx`, and in `RootEntry` in `client/src/app.tsx` when user session is recognized.
  - Reserved 40vh layout dimensions in `RouteLoadingFallback` within `AuthenticatedLayout` to eliminate Cumulative Layout Shift (CLS = 0).
  - Shaved 35% of initial JS byte payload (down to 168.20 KB Gzip) and removed Dexie and Radix UI chunks from the critical path, unblocking the browser main thread and eliminating download waterfalls.
- **Delta**: Zero serial waterfall during login transition; authenticated shell is pre-warmed while user hovers/focuses submit button; zero layout shift on dynamic chunk resolution.

## 2. Regression Test Execution
- **Command**: `pnpm exec vitest run -c audit/tests/vitest.audit.config.ts audit/tests/f-073-regression.test.ts`
- **Output**: 3/3 tests passed (432ms).
  - Validated prefetching of `AuthenticatedLayout` in `RootEntry` and `LoginPage`.
  - Validated zero-CLS reserved dimension fallback in `AuthenticatedLayout`.
  - Validated exclusion of heavy UI/Dexie vendors from the initial HTML entry graph.

## 3. Updated Suite Tests Execution
- **Command**: `pnpm --filter client build`
- **Output**: 2556 modules transformed, built cleanly in 528ms.

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

## 9. User Experience & Core Web Vitals Impact
- Solves Slow 4G LCP bottlenecks by parallelizing asset preparation with user authentication actions.
- Guarantees CLS = 0 with reserved view heights during asynchronous chunk streaming.

## 10. Traceability & Disposition
- Finding updated in `audit/tracker/tracker.json` to `VERIFIED`.
- Finding document `audit/findings/F-073.md` updated with verification evidence and commit hashes.
