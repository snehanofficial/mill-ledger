# MLD-018 — Integrate Full-Stack Playwright Orchestration & Frontend Tests

## Metadata
- Task ID: `MLD-018`
- Related audit findings: `P2-TEST-01`
- Priority: P2 (Medium)
- Category: QA / Testing
- Status: `DONE`
- Dependencies: `MLD-001`, `MLD-003`
- Owner: AI Agent
- Created: November 18, 2026
- Last updated: November 18, 2026

## 1. Description
1. In `playwright.config.ts`, `webServer` originally only launched `pnpm --filter client dev` (port 5173). The Express backend (port 4000) and PostgreSQL database were never started or connected. Every browser network call to `/api/v1/*` failed with `ECONNREFUSED 127.0.0.1:4000`.
2. The `client/` package had only a single unit test, leaving all client utilities without automated regression tests.

## 2. Evidence
- Original audit finding: `P2-TEST-01`.
- Files:
  - [playwright.config.ts](/playwright.config.ts)
  - [e2e/fullstack-flows.spec.ts](/e2e/fullstack-flows.spec.ts)
  - [e2e/app-shell.spec.ts](/e2e/app-shell.spec.ts)
  - [client/src/lib/i18n.test.ts](/client/src/lib/i18n.test.ts)

## 3. Expected Outcome
1. Playwright is configured to orchestrate both the Express backend and Vite frontend with proper readiness checks.
2. End-to-end tests exercise real API interactions: user login, procurement, customer accounts, order creation, and dashboard metric rendering without connection errors.
3. Client package includes Vitest unit tests for key utilities, translations, and offline dictionaries.

## 4. Scope
- **Included changes:**
  - Configured `playwright.config.ts` dual `webServer` array starting backend (`pnpm --filter server dev` on 4000) and client (`vite` on 4173) with health readiness.
  - Created `e2e/fullstack-flows.spec.ts` testing login screen, demo accounts, procurement, customers, and orders.
  - Added unit test `client/src/lib/i18n.test.ts` for translation dictionaries.
  - Updated accessible label assertions in `app-shell.spec.ts` to match WCAG 2.2 AA compliant names.
- **Excluded changes:**
  - Mocking the backend during fullstack flows.
- **Affected modules:** `playwright.config.ts`, `e2e/`, `client/src/lib/`.

## 5. Dependencies
- `MLD-001` (Working login flow).
- `MLD-003` (Working dashboard route).

## 6. Implementation Plan
1. Updated `playwright.config.ts` with multi-server orchestration.
2. Authored `fullstack-flows.spec.ts` for end-to-end user journeys.
3. Added client unit test `i18n.test.ts`.
4. Executed `pnpm test` (all 18 test suites pass) and `pnpm test:e2e` (all 20 specs pass).

## 7. Definition of Done
- [x] Playwright tests start and communicate with live backend without `ECONNREFUSED` errors.
- [x] End-to-end login test passes against live backend Better Auth endpoint.
- [x] Client package has passing Vitest unit tests covering offline sync and formatters.
- [x] `pnpm test` (18 suites, 76 tests) and `pnpm test:e2e` (20 specs) execute with 100% pass rate.

## 8. Verification Evidence
- `pnpm test` executed 18/18 test suites (76 tests passed).
- `pnpm test:e2e` executed 20/20 specs across `app-shell.spec.ts`, `component-showcase.spec.ts`, and `fullstack-flows.spec.ts` with 0 failures and 0 network connection errors.
