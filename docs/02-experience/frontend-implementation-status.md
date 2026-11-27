# Frontend Implementation Status

**Date:** 2026-11-27  
**Branch:** `validation/system-wide`

## Completed Work

### Slice 1 — Shared Foundation & Role-Aware Shell

- Reorganized `client/src/components/shell/nav-config.tsx` around the 5 role-specific operational workspaces (`SALESMAN`, `ADMIN`, `PRODUCTION`, `ACCOUNTANT`, `OWNER`).
- Updated `client/src/lib/role-routing.ts`:
  - `ACCOUNTANT` default route set to `/reports` (Reporting Home).
  - Added dynamic route pattern matching (`:orderId`, `:invoiceId`, `:dispatchId`, `:paymentId`, `:customerId`, `:itemId`, `:receiptId`, `:runId`).
  - Changed `isRoutePermitted` to fail closed (`false`) for unknown protected routes.
- Updated `client/src/components/shell/authenticated-shell.tsx`:
  - Fixed dead `Account settings` menu item in `StickyHeader` and invalid `/settings/profile` link in `SidebarUserMenu` (now points to `/settings` only for `ADMIN` / `OWNER`).
  - Updated `MobileBottomNav` per role (`My work / New order / Customers` for Salesman; `Today / New run / Stock` for Production; `Reports / Invoices / Balances` for Accountant; `Queue / Orders / Stock` for Admin/Owner).
  - Role-specific brand subtitle in `AppBrand`.
- Added reusable primitives in `client/src/components/ui/page-header.tsx`: `PageHeader`, `RecordHeader`, and `LifecycleSteps`.

### Slice 2 & 3 — Salesman & Admin Sales Operations

- Created `client/src/pages/order-detail-page.tsx` (`/orders/:orderId`): dedicated order detail, lifecycle progress, ATP/shortage display, Admin line qty/price override with mandatory reason, approve/reject, and contextual next actions (`Create invoice`, `Prepare dispatch`, `Edit draft`).
- Refactored `client/src/pages/orders-page.tsx`: role-aware `My work & orders` (Salesman), `Order inbox` (Admin), and read-only `Sales orders` (Accountant/Owner), removing the competing `Device Outbox` tab and modal spaghetti.
- Enhanced `client/src/pages/new-order-page.tsx`: added `?draftId=` editing (`PUT /sales/orders/:id`), `?customerId=` prefill, and explicit `Save draft` vs `Place Sales Order`.
- Created `client/src/pages/new-invoice-page.tsx` (`/invoices/new`) and `client/src/pages/invoice-detail-page.tsx` (`/invoices/:invoiceId`), and refactored `client/src/pages/invoices-page.tsx` around List -> Detail -> Next Action (PDF download, copy link, WhatsApp share, credit note issuance, dispatch/payment links).
- Created `client/src/pages/new-dispatch-page.tsx` (`/dispatch/new`) and `client/src/pages/dispatch-detail-page.tsx` (`/dispatch/:dispatchId`), and refactored `client/src/pages/dispatch-page.tsx` around List -> Detail -> Next Action (partial dispatch, physical stock deduction preview, sales returns).

### Slice 4 — Procurement, Stock & Production

- Created `client/src/pages/stock-ledger-page.tsx` (`/stock/:itemId/ledger`) with On-Hand / Reserved / ATP / WAC summary and source document links.
- Created `client/src/pages/new-purchase-page.tsx` (`/purchases/new`) and `client/src/pages/purchase-detail-page.tsx` (`/purchases/:receiptId`) with weighted-average cost impact preview, reversal, and debit note issuance.
- Created `client/src/pages/production-run-detail-page.tsx` (`/production/runs/:runId`) with BOM version, planned vs actual variance, costing breakdown, stock ledger links, and controlled reversal.
- Added `/production/recipes` route and linked list rows in `stock-page.tsx`, `purchases-page.tsx`, and `production-page.tsx` to their dedicated detail routes.

### Slice 5 & 6 — Finance, Reporting & Owner Oversight

- Separated Customer Balances from Payment Register:
  - Created `client/src/pages/receivables-page.tsx` (`/receivables`) and `client/src/pages/customer-ledger-page.tsx` (`/receivables/:customerId`).
  - Created `client/src/pages/new-payment-page.tsx` (`/payments/new`) and `client/src/pages/payment-detail-page.tsx` (`/payments/:paymentId`) supporting FIFO auto-allocation, manual allocation, unallocated advances, and cheque/payment bounce.
- Created `client/src/pages/reports-home-page.tsx` (`/reports`) as the Accountant's Reporting Home index.
- Enhanced `client/src/pages/dashboard-page.tsx` to render a role-distinct `Work queue` for `ADMIN` (orders awaiting review, approved awaiting invoice, ready to dispatch) and `Business overview` for `OWNER`.

## Verification Status

- `pnpm typecheck`: Passing across `shared`, `client`, and `server` (verified)
- `pnpm lint`: 0 errors (verified)
- `pnpm build`: Passing across all workspaces (verified)
- `pnpm vitest run client/src/`: 7 test files, 85/85 tests passing (verified)
- `pnpm test:e2e`: 31/31 Playwright tests passing across `app-shell`, `auth-flow`, `component-showcase`, `fullstack-flows`, and `role-journeys` (verified)

## Known Limitations

- Legacy list pages (`stock-page.tsx`, `purchases-page.tsx`, `production-page.tsx`, `payments-page.tsx`, `customers-page.tsx`, `suppliers-page.tsx`, `products-page.tsx`, `reports-page.tsx`) still retain some inline modals alongside the new dedicated detail/creation routes (`/stock/:itemId/ledger`, `/purchases/new`, `/purchases/:receiptId`, `/production/runs/:runId`, `/payments/new`, `/payments/:paymentId`, `/receivables`, `/receivables/:customerId`) for backward compatibility.
- Baseline `pnpm test` (server integration suite) had 3 pre-existing failures when run concurrently against the same database (`concurrency-idempotency.test.ts`, `offline-sync.test.ts`, `orders.test.ts`); no backend files were modified.
