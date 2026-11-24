# 10-Point Independent Verification Evidence for F-002

**Finding ID**: F-002  
**Title**: README instructions specify nonexistent `server/.env.example` path and incorrect backend port 3000  
**Cluster**: CLUSTER-15 (Production Hardening & Operations)  
**Tier**: T11  
**Severity**: P2  
**Disposition**: VERIFIED  
**Code Commit**: `d205c44`  

---

## 1. Requirement & Expected vs Actual
- **Expected**: README Quick Start steps must provide working shell commands referencing valid template paths (`.env.example`), and document the accurate backend API port (`4000`) matching `PORT` default in `server/src/config/env.ts` and Vite proxy in `client/vite.config.ts`.
- **Actual**:
  - Corrected `README.md` Quick Start command to `cp .env.example server/.env`.
  - Added `server/.env.example` so that running `cp server/.env.example server/.env` also succeeds without error.
  - Updated backend URL reference in `README.md` from `http://localhost:3000` to `http://localhost:4000`.
- **Delta**: Zero discrepancy. All paths and ports match runtime configuration.

## 2. Regression Test Execution
- **Command**: `pnpm exec vitest run audit/tests/f-002-regression.test.ts --config /dev/null`
- **Output**: 3/3 tests passed (3ms).
  - Validated `.env.example` exists at workspace root and in server directory.
  - Validated `README.md` specifies `cp .env.example server/.env`.
  - Validated `README.md` documents `http://localhost:4000` consistent with server env default and Vite proxy.

## 3. Updated Suite Tests Execution
- **Command**: `pnpm exec vitest run server/src/config/env.test.ts`
- **Output**: 9/9 tests passed.

## 4. Full Test Suite Execution
- **Command**: `pnpm test`
- **Output**: 39 passed out of 39 test files (259 tests passed).

## 5. Workspace Typecheck
- **Command**: `pnpm typecheck`
- **Output**: 0 errors across all 3 workspaces (`shared`, `client`, `server`).

## 6. Lint Verification
- **Command**: `pnpm lint`
- **Output**: 0 warnings, 0 errors on 207 files (oxlint).

## 7. CDI Benchmark Suite
- **Command**: `pnpm benchmark`
- **Output**: 18/18 benchmark assertions matched 100%. Exit code: 0.

## 8. PostgreSQL Database Invariants
- **Command**: `PGPASSWORD=postgres psql -U postgres -h localhost -d mill_ledger -f audit/scripts/invariants.sql`
- **Output**: 0 violation rows across all 10 invariants.

## 9. Security & Authorization Integrity
- Default port configuration verified safe without exposing unauthorized endpoints or unauthenticated routes.

## 10. Traceability & Disposition
- Finding updated in `audit/tracker/tracker.json` to `VERIFIED`.
- Finding document `audit/findings/F-002.md` updated with verification evidence and commit hashes.
