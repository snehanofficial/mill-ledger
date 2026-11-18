# MLD-003 — Resolve `/api/v1/dashboard` Route Conflict and 404 Error

## Metadata
- Task ID: `MLD-003`
- Related audit findings: `P0-FUNC-01`
- Priority: P0 (Critical Release Blocker)
- Category: Functional / Routing
- Status: `DONE`
- Dependencies: None
- Owner: AI Agent
- Created: November 18, 2026
- Last updated: November 18, 2026

## 1. Description
In `server/src/app.ts`, `reportingRouter` is mounted at both `/api/v1/reports` and `/api/v1/dashboard`:
```typescript
app.use("/api/v1/reports", reportingRouter);
app.use("/api/v1/dashboard", reportingRouter);
```
Inside `server/src/modules/reporting/reporting.routes.ts`, the dashboard route is declared as:
```typescript
reportingRouter.get("/dashboard", requireAuth, authorize("report", "read"), ...);
```
Mounting `reportingRouter` at `/api/v1/dashboard` causes Express to route the handler to `/api/v1/dashboard/dashboard`. When the frontend loads `/dashboard`, `dashboard-page.tsx:82` requests `GET /api/v1/dashboard?organizationId=MILL`, resulting in an immediate **HTTP 404 Not Found**. The overview screen fails to display for all users.

## 2. Evidence
- Original audit finding: `P0-FUNC-01`.
- Files:
  - [server/src/app.ts:47](/server/src/app.ts#L47)
  - [server/src/modules/reporting/reporting.routes.ts:14-29](/server/src/modules/reporting/reporting.routes.ts#L14-L29)
  - [client/src/pages/dashboard-page.tsx:82](/client/src/pages/dashboard-page.tsx#L82)
- Reproduction:
  - `curl -i http://localhost:4000/api/v1/dashboard?organizationId=MILL` returns HTTP 404 (`Cannot GET /api/v1/dashboard`).
  - Browser displays: `"Failed to load overview data. Request failed with status code 404"`. Screenshot archived at `docs/audits/production-readiness/evidence/dashboard-404.png`.

## 3. Expected Outcome
1. `GET /api/v1/dashboard?organizationId=MILL` routes cleanly to the executive dashboard controller.
2. `GET /api/v1/reports/dashboard?organizationId=MILL` also remains supported for backward compatibility.
3. `/dashboard` UI loads operational metrics without 404 errors.

## 4. Scope
- **Included changes:**
  - Adjust route declarations in `server/src/modules/reporting/reporting.routes.ts` or mount paths in `server/src/app.ts` so both `/api/v1/dashboard` and `/api/v1/reports/dashboard` are served.
  - Verify frontend `/dashboard` page query succeeds.
- **Excluded changes:**
  - Dashboard UI redesign (handled in Wave 4).
- **Affected modules:** `server/src/app.ts`, `server/src/modules/reporting/reporting.routes.ts`.

## 5. Dependencies
- None. Ready for immediate execution.

## 6. Implementation Plan
1. In `server/src/modules/reporting/reporting.routes.ts`, register both `/dashboard` and `/` on `reportingRouter` or create a dedicated dashboard route alias.
2. Verify `curl http://localhost:4000/api/v1/dashboard?organizationId=MILL` returns HTTP 401 (when unauthenticated) or HTTP 200 (with session).
3. Test live browser rendering of `http://localhost:5173/dashboard`.

## 7. Definition of Done
- [x] `GET /api/v1/dashboard?organizationId=MILL` responds to authenticated requests with HTTP 200 and metrics payload.
- [x] `GET /api/v1/reports/dashboard` continues to function.
- [x] Frontend dashboard view displays metrics without 404 error alert.
- [x] Regression test added to `server/src/reports.test.ts`.
- [x] Typecheck passes.

## 8. Verification Plan
- Command 1: `curl -i http://localhost:4000/api/v1/dashboard?organizationId=MILL` -> Must NOT return 404.
- Command 2: Execute `pnpm vitest run server/src/reports.test.ts` -> All report tests pass.

## 9. Risks and Rollback
- Risk: Route conflicts with `/:report` parameter in `reportingRouter`.
- Mitigation: Mounted `["/", "/dashboard"]` before parameterized `/:report` route.

## 10. Completion Evidence
- Executed `pnpm vitest run server/src/reports.test.ts`:
  - Verified `GET /api/v1/dashboard?organizationId=MILL` returns HTTP 200 with `totalRevenue: 7875`.
  - Verified `GET /api/v1/reports/dashboard` returns HTTP 200 with `totalRevenue: 7875`.
  - Both assertions passed cleanly in 939ms.
- Executed `pnpm typecheck`: 0 errors across shared, client, and server packages.

## 11. Completion Review
- DoD satisfied: All 5 criteria satisfied.
- Remaining limitations: None.
- Related findings resolved: `P0-FUNC-01`
- Final status: `DONE`
