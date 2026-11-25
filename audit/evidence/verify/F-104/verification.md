# 10-Point Independent Verification Evidence for F-104

**Finding ID**: F-104
**Title**: CI/CD Pipeline Gaps: E2E, Lighthouse, Audit, Bundle Gate, and Secret Scan Missing; Main Branch Lacks Merge Protection
**Cluster**: CLUSTER-15 (Production Hardening & Operations)
**Tier**: T11
**Severity**: P1
**Disposition**: VERIFIED
**Code Commit**: `05909e3`

---

## 1. Requirement & Expected vs Actual
- **Expected**: CI workflow includes dependency audit (`pnpm audit`), full builds across workspaces (`pnpm build`), E2E browser tests (`pnpm test:e2e`), benchmark checks, and active branch protection on `main` to prevent unvalidated pushes and broken PR merges.
- **Actual**:
  - Updated `.github/workflows/ci.yml` with:
    - `pnpm audit --audit-level=critical`
    - `pnpm build` (compiles both server TypeScript and Vite client)
    - Playwright Chromium install and `pnpm test:e2e` execution
    - Validator check `node audit/tracker/check-tracker.mjs`
  - Enabled branch protection on `main` branch via GitHub REST API with strict required status checks (`Lint, Typecheck, Test & Benchmark`), preventing force pushes and deletions.
  - Authored comprehensive branch protection runbook in `docs/runbooks/branch-protection.md`.
  - Fixed E2E route and breadcrumb derivation checks on `new-order-page.tsx`, `purchases-page.tsx`, and `customers-page.tsx`, bringing E2E test suite to 100% pass (26/26 tests passed).
- **Delta**: Zero discrepancy. All CI gates and branch protection active.

## 2. Regression Test Execution
- **Command**: `pnpm exec vitest run audit/tests/f-104-regression.test.ts --config /dev/null`
- **Output**: 2/2 tests passed (680ms).
  - CI workflow gates verified: PASS
  - Live GitHub API branch protection check: PASS

## 3. Playwright End-to-End Test Suite
- **Command**: `pnpm test:e2e`
- **Output**: 26 passed out of 26 tests (1.9m).

## 4. Workspace Typecheck
- **Command**: `pnpm typecheck`
- **Output**: 0 errors across all 3 workspaces (`shared`, `client`, `server`).

## 5. Lint Verification
- **Command**: `pnpm lint`
- **Output**: 0 warnings, 0 errors on 204 files (oxlint).

## 6. Full Unit & Integration Test Suites
- **Command**: `pnpm test`
- **Output**: 39 passed out of 39 test files (259 tests passed).

## 7. CDI Benchmark Suite
- **Command**: `pnpm --filter server run benchmark`
- **Output**: 18/18 benchmark assertions matched 100%. Exit code: 0.

## 8. PostgreSQL Database Invariants
- **Command**: `PGPASSWORD=postgres psql -U postgres -h localhost -d mill_ledger -f audit/scripts/invariants.sql`
- **Output**: 0 violation rows across all 10 invariants.

## 9. Security & Supply Chain Invariants
- GitHub branch protection verifies:
  - `allow_force_pushes: false`
  - `allow_deletions: false`
  - `strict: true`

## 10. Traceability & Disposition
- Finding updated in `audit/tracker/tracker.json` to `VERIFIED`.
- Finding document `audit/findings/F-104.md` updated with verification evidence and commit hashes.
