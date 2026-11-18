# MLD-009 — Replace Placeholder Views with Live Procurement & Master Data

## Metadata
- Task ID: `MLD-009`
- Related audit findings: `P1-FUNC-02`
- Priority: P1 (High)
- Category: Functional / Core
- Status: `DONE`
- Dependencies: `MLD-001`
- Owner: AI Agent
- Created: November 18, 2026
- Last updated: November 18, 2026

## 1. Description
Several core business routes rendered non-functional placeholder wireframes from `client/src/pages/placeholder-pages.tsx`:
- `/purchases` (`PurchasesPage`): Displayed static cards with dummy numbers ("14 mandi lots", "₹18,40,000") and no ability to record incoming paddy/flour mandi purchase receipts.
- `/customers` (`CustomersPage`): Static wireframe without the ability to view real master customer data.

## 2. Evidence
- Original audit finding: `P1-FUNC-02`.
- Files:
  - [client/src/pages/purchases-page.tsx](/client/src/pages/purchases-page.tsx)
  - [client/src/pages/customers-page.tsx](/client/src/pages/customers-page.tsx)
  - [server/src/modules/inventory/inventory.routes.ts](/server/src/modules/inventory/inventory.routes.ts)
  - [server/src/modules/inventory/inventory.service.ts](/server/src/modules/inventory/inventory.service.ts)

## 3. Expected Outcome
1. `/purchases` provides a live procurement interface showing existing purchase receipts and a dialog to record new raw material / mandi purchase receipts (vendor, item, quantity, unit price, receipt number, notes).
2. Submitting a purchase receipt calls `POST /api/v1/inventory/purchase-receipts` and updates inventory balances automatically.
3. `/customers` provides a live customer directory with accounts, state tax jurisdictions, and sales assignments.
4. Replace fake statistics and dummy tables with real data fetched from the API.

## 4. Scope
- **Included changes:**
  - Created dedicated `client/src/pages/purchases-page.tsx` with live data table, filters, and "+ Record Purchase Receipt" dialog.
  - Added `GET /inventory/purchase-receipts` and `GET /inventory/suppliers` endpoints in `inventory.routes.ts` and `inventory.service.ts`.
  - Created dedicated `client/src/pages/customers-page.tsx` with real account master listings.
  - Connected `PurchasesPage` and `CustomersPage` into lazy-loaded routes in `client/src/app.tsx`.
- **Excluded changes:**
  - Complex custom vendor portal or third-party EDI integration.
- **Affected modules:** `client/src/pages/purchases-page.tsx`, `client/src/pages/customers-page.tsx`, `client/src/app.tsx`, `server/src/modules/inventory/`.

## 5. Dependencies
- `MLD-001` (Authenticated session to query inventory endpoints).

## 6. Implementation Plan
1. Implemented backend `getPurchaseReceipts` and `getSuppliers` in `inventory.service.ts` and mapped routes.
2. Built `PurchasesPage` using Pine & Paper design tokens (`table`, `button`, `dialog`, `badge`, tabular nums).
3. Connected live queries and mutation with automatic cache invalidation (`purchase-receipts`, `inventory-balances`).
4. Built `CustomersPage` fetching real live customer accounts via `/sales/customers`.

## 7. Definition of Done
- [x] Navigating to `/purchases` loads live purchase receipts from backend API.
- [x] User can open "Record Purchase" dialog, select vendor and raw material, and submit.
- [x] Submitted purchase increases item inventory balance and recalculates WAC.
- [x] Empty state displays clean guidance when no purchases exist (no fake wireframe stats).

## 8. Verification Evidence
- Built client cleanly via `pnpm --filter client build`:
  - `purchases-page-BW6Uy1q3.js`: 10.55 kB.
  - `customers-page-DnARzcsi.js`: 4.15 kB.
- `pnpm typecheck` passed with 0 errors across all 3 packages.
- All 17 Vitest test suites (73 tests) and benchmark test assertions passed.
