# MLD-006 — Server-Side ABAC Entity Retrieval & Inactive User Check

## Metadata
- Task ID: `MLD-006`
- Related audit findings: `P1-SEC-02`
- Priority: P1 (High)
- Category: Security / Authorization
- Status: `DONE`
- Dependencies: None
- Owner: AI Agent
- Created: November 18, 2026
- Last updated: November 18, 2026

## 1. Description
1. In `server/src/middleware/auth.middleware.ts:62`, `evaluateAbac` is called with:
   `resourceAttributes: req.body as Record<string, unknown>`.
   When a user updates an order via `PUT /api/v1/sales/orders/:id`, the ABAC policy checks whether `resourceAttributes?.creatorId === user.id`. Because `req.body` is supplied by the client, a salesman can spoof `creatorId` in the request body to bypass ownership verification on an order they did not create.
2. In `auth.middleware.ts`, `requireAuth` populates `req.user.isActive`, but never checks `if (!req.user.isActive) throw new AppError("Forbidden: User account is inactive", 403)`. If an endpoint omits `authorize()`, inactive users continue to execute authenticated requests.

## 2. Evidence
- Original audit finding: `P1-SEC-02`.
- Files:
  - [server/src/middleware/auth.middleware.ts:26-37, 58-63](/server/src/middleware/auth.middleware.ts#L26-L37)
  - [server/src/policies/abac.ts:21-62](/server/src/policies/abac.ts#L21-L62)

## 3. Expected Outcome
1. `requireAuth` rejects requests from inactive users with HTTP 403 Forbidden on all protected routes.
2. For resource mutation endpoints, ABAC policies evaluate attributes retrieved from the persistent database entity, never trusting client-supplied `req.body` properties for authorization decisions.

## 4. Scope
- **Included changes:**
  - Add active status check to `requireAuth` in `server/src/middleware/auth.middleware.ts`.
  - Refactor ABAC checks on updates to inspect the database record inside service methods or route handlers.
  - Add negative integration tests for inactive users and forged `creatorId`.
- **Excluded changes:**
  - UI account status indicators.
- **Affected modules:** `server/src/middleware/auth.middleware.ts`, `server/src/modules/sales/sales.service.ts`.

## 5. Dependencies
- None. Ready for immediate execution.

## 6. Implementation Plan
1. In `requireAuth`:
   ```typescript
   if (!req.user.isActive) {
     throw new AppError("Forbidden: Account is inactive", 403);
   }
   ```
2. In `updateDraftOrder` ([sales.service.ts](/server/src/modules/sales/sales.service.ts)): retrieve existing order and verify `existing.salesmanId === user.id` if `user.role === "SALESMAN"`. Reject if status is not `DRAFT`.
3. Add unit and integration tests verifying inactive user rejection and ownership enforcement.

## 7. Definition of Done
- [x] Inactive user with valid session receives HTTP 403 Forbidden.
- [x] Salesman attempting to update another salesman's order via forged `creatorId` in `req.body` receives HTTP 403 Forbidden.
- [x] All existing authorization tests pass.
- [x] Typecheck passes.

## 8. Verification Plan
- Command 1: Run `server/src/policies/abac.test.ts` and `server/src/auth.integration.test.ts`.
- Command 2: Submit update request with spoofed `creatorId` -> Rejection confirmed.

## 9. Risks and Rollback
- Low risk. Purely tightens authorization boundaries.

## 10. Completion Evidence
- Added inactive user check in [server/src/middleware/auth.middleware.ts](/server/src/middleware/auth.middleware.ts) `requireAuth`: rejects inactive users with HTTP 403 Forbidden `User account is inactive`.
- Refactored [server/src/modules/sales/sales.routes.ts](/server/src/modules/sales/sales.routes.ts) `PUT /orders/:id`: removed error-swallowing `.catch(() => null)` fallback, verifying persistent database ownership via `salesService.getSalesOrderById` before executing updates.
- Added normalized uppercase enum parsing in [server/src/modules/sales/sales.service.ts](/server/src/modules/sales/sales.service.ts).
- Added comprehensive integration tests in [server/src/auth.integration.test.ts](/server/src/auth.integration.test.ts):
  - Inactive user with genuine signed session cookie is rejected with HTTP 403 Forbidden.
  - Salesman attempting to update another salesman's draft order via forged `creatorId` in body is rejected with HTTP 403 Forbidden.
  - Salesman updating their own order succeeds with HTTP 200.
- Executed `pnpm vitest run server/src/auth.integration.test.ts`: 7/7 tests passed.
- Executed `pnpm vitest run server/src/policies/abac.test.ts`: 13/13 tests passed.
- `pnpm typecheck` passed (0 errors across all workspaces).

## 11. Completion Review
- DoD satisfied: All 4 criteria satisfied.
- Remaining limitations: None.
- Related findings resolved: `P1-SEC-02`
- Final status: `DONE`
