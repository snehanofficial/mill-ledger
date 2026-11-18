# MLD-007 — Restrict Salesman Scope in Receivables Reports

## Metadata
- Task ID: `MLD-007`
- Related audit findings: `P1-SEC-03`
- Priority: P1 (High)
- Category: Security / Privacy
- Status: `DONE`
- Dependencies: `MLD-002`
- Owner: AI Agent
- Created: November 18, 2026
- Last updated: November 18, 2026

## 1. Description
In `server/src/modules/reporting/reporting.routes.ts:203`, salesmen are permitted to query `receivables` and `collections` endpoints. However, in `reporting.service.ts` (`getReceivablesReport`), the query does not enforce salesman scoping (`params.salesmanId`), exposing company-wide customer receivables, credit terms, and debt aging to any salesman. Salesmen must only see receivables from customers or orders assigned to them, while OWNER and ACCOUNTANT see organization-wide receivables.

## 2. Evidence
- Original audit finding: `P1-SEC-03`.
- Files:
  - [server/src/modules/reporting/reporting.routes.ts:190-210](/server/src/modules/reporting/reporting.routes.ts#L190-L210)
  - [server/src/modules/reporting/reporting.service.ts:310-365](/server/src/modules/reporting/reporting.service.ts#L310-L365)

## 3. Expected Outcome
1. If the requesting user has the `SALESMAN` role, `getReceivablesReport` automatically constrains the query to customer invoices originated by that salesman (`salesmanId === user.id`).
2. If `user.role` is `OWNER` or `ACCOUNTANT`, organization-wide receivables are returned unless a specific `salesmanId` filter is explicitly provided.
3. Salesmen cannot inspect or query receivables belonging to other salesmen.

## 4. Scope
- **Included changes:**
  - Pass authenticated `user` context from `reporting.routes.ts` into `reportingService.getReceivablesReport`.
  - In `reporting.service.ts`, apply `where: { ...where, salesmanId: user.id }` when `user.role === "SALESMAN"`.
  - Add unit and integration tests verifying salesman-scoped receivables and owner organization-wide receivables.
- **Excluded changes:**
  - Changes to other report endpoints (stock, production, GST).
- **Affected modules:** `server/src/modules/reporting/reporting.routes.ts`, `server/src/modules/reporting/reporting.service.ts`.

## 5. Dependencies
- `MLD-002` (Multi-tenant isolation and user context scoping).

## 6. Implementation Plan
1. In `reporting.routes.ts`: pass `req.user` to `reportingService.getReceivablesReport(query, req.user)`.
2. In `reporting.service.ts`:
   ```typescript
   const salesmanFilter = user.role === "SALESMAN" ? { salesmanId: user.id } : (query.salesmanId ? { salesmanId: query.salesmanId } : {});
   ```
3. Filter customer ledger and outstanding invoice balances by salesman assignment when role is `SALESMAN`.
4. Add integration test verifying salesman receives only their customers' receivables while accountant receives all.

## 7. Definition of Done
- [x] Salesman querying `/api/v1/reports/receivables` receives only receivables for their assigned accounts.
- [x] Salesman attempting to query another salesman's `salesmanId` is blocked or forced to their own ID.
- [x] Owner and Accountant receive complete receivables report.
- [x] All reporting tests pass.

## 8. Verification Evidence
- Integration tests: `server/src/reports.test.ts`
  - Salesman 1 receives only Retailer A (`CUST-RET-A`) and not Distributor B (`CUST-DIST-B`).
  - Salesman attempting to pass `?salesmanId=spoofed-id` is forced to `req.user.id` on server side and receives only assigned customers.
  - Owner receives all customers across organization.
- Benchmark: All 18 benchmark assertions pass 100%.
