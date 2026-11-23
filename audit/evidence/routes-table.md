# Express Routes Inventory

Total Runtime Route Endpoints: 81
Total Static Route Endpoints: 81

## Route Reconciliation Diff
- Routes in Runtime only: None (0)
- Routes in Static only: None (0)

## Architectural Observation: Router Aliasing
Multiple routers are mounted at 2 or 3 distinct prefixes in `server/src/app.ts`:
- `salesRouter` is mounted at `/api/v1/sales`, `/api/v1/orders`, and `/api/v1/dispatches` (yielding duplicate paths such as `/api/v1/dispatches/dispatches` and `/api/v1/orders/customers`).
- `productionRouter` is mounted at `/api/v1/production` and `/api/v1/production-runs`.
- `inventoryRouter` is mounted at `/api/v1/inventory` and `/api/v1/purchase-receipts`.
- `financeRouter` is mounted at `/api/v1/finance` and `/api/v1/invoices`.
- `reportingRouter` is mounted at `/api/v1/reports` and `/api/v1/dashboard`.
- `healthRouter` is mounted at `/api/v1/health` and `/api/health`.

## Complete Route Table (Runtime Observed)

| Method | Full Path | Middleware Chain | Handler / Source File |
|--------|-----------|------------------|-----------------------|
| **GET** | `/api/v1/me` | `requireAuth` | `server/src/modules/auth/auth.routes.ts` |
| **GET** | `/api/v1/health` | `None` | `server/src/modules/health/health.routes.ts` |
| **GET** | `/api/v1/sales/customers` | `requireAuth -> <anonymous>` | `server/src/modules/sales/sales.routes.ts` |
| **GET** | `/api/v1/sales/products` | `requireAuth -> <anonymous>` | `server/src/modules/sales/sales.routes.ts` |
| **GET** | `/api/v1/sales/orders` | `requireAuth -> <anonymous>` | `server/src/modules/sales/sales.routes.ts` |
| **GET** | `/api/v1/sales/orders/:id` | `requireAuth -> <anonymous>` | `server/src/modules/sales/sales.routes.ts` |
| **POST** | `/api/v1/sales/orders` | `requireAuth -> <anonymous>` | `server/src/modules/sales/sales.routes.ts` |
| **PUT** | `/api/v1/sales/orders/:id` | `requireAuth -> <anonymous>` | `server/src/modules/sales/sales.routes.ts` |
| **POST** | `/api/v1/sales/orders/:id/approve` | `requireAuth -> <anonymous>` | `server/src/modules/sales/sales.routes.ts` |
| **POST** | `/api/v1/sales/orders/:id/reject` | `requireAuth -> <anonymous>` | `server/src/modules/sales/sales.routes.ts` |
| **POST** | `/api/v1/sales/dispatches` | `requireAuth -> <anonymous>` | `server/src/modules/sales/sales.routes.ts` |
| **GET** | `/api/v1/sales/dispatches` | `requireAuth -> <anonymous>` | `server/src/modules/sales/sales.routes.ts` |
| **GET** | `/api/v1/orders/customers` | `requireAuth -> <anonymous>` | `server/src/modules/sales/sales.routes.ts` |
| **GET** | `/api/v1/orders/products` | `requireAuth -> <anonymous>` | `server/src/modules/sales/sales.routes.ts` |
| **GET** | `/api/v1/orders/orders` | `requireAuth -> <anonymous>` | `server/src/modules/sales/sales.routes.ts` |
| **GET** | `/api/v1/orders/orders/:id` | `requireAuth -> <anonymous>` | `server/src/modules/sales/sales.routes.ts` |
| **POST** | `/api/v1/orders/orders` | `requireAuth -> <anonymous>` | `server/src/modules/sales/sales.routes.ts` |
| **PUT** | `/api/v1/orders/orders/:id` | `requireAuth -> <anonymous>` | `server/src/modules/sales/sales.routes.ts` |
| **POST** | `/api/v1/orders/orders/:id/approve` | `requireAuth -> <anonymous>` | `server/src/modules/sales/sales.routes.ts` |
| **POST** | `/api/v1/orders/orders/:id/reject` | `requireAuth -> <anonymous>` | `server/src/modules/sales/sales.routes.ts` |
| **POST** | `/api/v1/orders/dispatches` | `requireAuth -> <anonymous>` | `server/src/modules/sales/sales.routes.ts` |
| **GET** | `/api/v1/orders/dispatches` | `requireAuth -> <anonymous>` | `server/src/modules/sales/sales.routes.ts` |
| **GET** | `/api/v1/dispatches/customers` | `requireAuth -> <anonymous>` | `server/src/modules/sales/sales.routes.ts` |
| **GET** | `/api/v1/dispatches/products` | `requireAuth -> <anonymous>` | `server/src/modules/sales/sales.routes.ts` |
| **GET** | `/api/v1/dispatches/orders` | `requireAuth -> <anonymous>` | `server/src/modules/sales/sales.routes.ts` |
| **GET** | `/api/v1/dispatches/orders/:id` | `requireAuth -> <anonymous>` | `server/src/modules/sales/sales.routes.ts` |
| **POST** | `/api/v1/dispatches/orders` | `requireAuth -> <anonymous>` | `server/src/modules/sales/sales.routes.ts` |
| **PUT** | `/api/v1/dispatches/orders/:id` | `requireAuth -> <anonymous>` | `server/src/modules/sales/sales.routes.ts` |
| **POST** | `/api/v1/dispatches/orders/:id/approve` | `requireAuth -> <anonymous>` | `server/src/modules/sales/sales.routes.ts` |
| **POST** | `/api/v1/dispatches/orders/:id/reject` | `requireAuth -> <anonymous>` | `server/src/modules/sales/sales.routes.ts` |
| **POST** | `/api/v1/dispatches/dispatches` | `requireAuth -> <anonymous>` | `server/src/modules/sales/sales.routes.ts` |
| **GET** | `/api/v1/dispatches/dispatches` | `requireAuth -> <anonymous>` | `server/src/modules/sales/sales.routes.ts` |
| **GET** | `/api/v1/production` | `requireAuth -> <anonymous>` | `server/src/modules/production/production.routes.ts` |
| **GET** | `/api/v1/production/recipes` | `requireAuth -> <anonymous>` | `server/src/modules/production/production.routes.ts` |
| **GET** | `/api/v1/production/:id` | `requireAuth -> <anonymous>` | `server/src/modules/production/production.routes.ts` |
| **POST** | `/api/v1/production/draft` | `requireAuth -> <anonymous>` | `server/src/modules/production/production.routes.ts` |
| **POST** | `/api/v1/production` | `requireAuth -> <anonymous>` | `server/src/modules/production/production.routes.ts` |
| **POST** | `/api/v1/production/:id/post` | `requireAuth -> <anonymous>` | `server/src/modules/production/production.routes.ts` |
| **POST** | `/api/v1/production/:id/reverse` | `requireAuth -> <anonymous>` | `server/src/modules/production/production.routes.ts` |
| **GET** | `/api/v1/production-runs` | `requireAuth -> <anonymous>` | `server/src/modules/production/production.routes.ts` |
| **GET** | `/api/v1/production-runs/recipes` | `requireAuth -> <anonymous>` | `server/src/modules/production/production.routes.ts` |
| **GET** | `/api/v1/production-runs/:id` | `requireAuth -> <anonymous>` | `server/src/modules/production/production.routes.ts` |
| **POST** | `/api/v1/production-runs/draft` | `requireAuth -> <anonymous>` | `server/src/modules/production/production.routes.ts` |
| **POST** | `/api/v1/production-runs` | `requireAuth -> <anonymous>` | `server/src/modules/production/production.routes.ts` |
| **POST** | `/api/v1/production-runs/:id/post` | `requireAuth -> <anonymous>` | `server/src/modules/production/production.routes.ts` |
| **POST** | `/api/v1/production-runs/:id/reverse` | `requireAuth -> <anonymous>` | `server/src/modules/production/production.routes.ts` |
| **POST** | `/api/v1/inventory/purchase-receipts` | `requireAuth -> <anonymous>` | `server/src/modules/inventory/inventory.routes.ts` |
| **GET** | `/api/v1/inventory/purchase-receipts` | `requireAuth -> <anonymous>` | `server/src/modules/inventory/inventory.routes.ts` |
| **GET** | `/api/v1/inventory/suppliers` | `requireAuth -> <anonymous>` | `server/src/modules/inventory/inventory.routes.ts` |
| **GET** | `/api/v1/inventory/balances` | `requireAuth -> <anonymous>` | `server/src/modules/inventory/inventory.routes.ts` |
| **GET** | `/api/v1/inventory/items/:id/ledger` | `requireAuth -> <anonymous>` | `server/src/modules/inventory/inventory.routes.ts` |
| **POST** | `/api/v1/purchase-receipts/purchase-receipts` | `requireAuth -> <anonymous>` | `server/src/modules/inventory/inventory.routes.ts` |
| **GET** | `/api/v1/purchase-receipts/purchase-receipts` | `requireAuth -> <anonymous>` | `server/src/modules/inventory/inventory.routes.ts` |
| **GET** | `/api/v1/purchase-receipts/suppliers` | `requireAuth -> <anonymous>` | `server/src/modules/inventory/inventory.routes.ts` |
| **GET** | `/api/v1/purchase-receipts/balances` | `requireAuth -> <anonymous>` | `server/src/modules/inventory/inventory.routes.ts` |
| **GET** | `/api/v1/purchase-receipts/items/:id/ledger` | `requireAuth -> <anonymous>` | `server/src/modules/inventory/inventory.routes.ts` |
| **GET** | `/api/v1/finance/invoices` | `requireAuth -> <anonymous>` | `server/src/modules/finance/finance.routes.ts` |
| **GET** | `/api/v1/finance/invoices/:id` | `requireAuth -> <anonymous>` | `server/src/modules/finance/finance.routes.ts` |
| **POST** | `/api/v1/finance/invoices` | `requireAuth -> <anonymous>` | `server/src/modules/finance/finance.routes.ts` |
| **POST** | `/api/v1/finance/invoices/:id/credit-note` | `requireAuth -> <anonymous>` | `server/src/modules/finance/finance.routes.ts` |
| **GET** | `/api/v1/invoices/invoices` | `requireAuth -> <anonymous>` | `server/src/modules/finance/finance.routes.ts` |
| **GET** | `/api/v1/invoices/invoices/:id` | `requireAuth -> <anonymous>` | `server/src/modules/finance/finance.routes.ts` |
| **POST** | `/api/v1/invoices/invoices` | `requireAuth -> <anonymous>` | `server/src/modules/finance/finance.routes.ts` |
| **POST** | `/api/v1/invoices/invoices/:id/credit-note` | `requireAuth -> <anonymous>` | `server/src/modules/finance/finance.routes.ts` |
| **GET** | `/api/v1/payments` | `requireAuth -> <anonymous>` | `server/src/modules/finance/payment.routes.ts` |
| **GET** | `/api/v1/payments/receivables/summary` | `requireAuth -> <anonymous>` | `server/src/modules/finance/payment.routes.ts` |
| **GET** | `/api/v1/payments/ledger/:customerId` | `requireAuth -> <anonymous>` | `server/src/modules/finance/payment.routes.ts` |
| **GET** | `/api/v1/payments/:id` | `requireAuth -> <anonymous>` | `server/src/modules/finance/payment.routes.ts` |
| **POST** | `/api/v1/payments` | `requireAuth -> <anonymous>` | `server/src/modules/finance/payment.routes.ts` |
| **GET** | `/api/v1/reports` | `requireAuth -> <anonymous>` | `server/src/modules/reporting/reporting.routes.ts` |
| **GET** | `/api/v1/reports/dashboard` | `requireAuth -> <anonymous>` | `server/src/modules/reporting/reporting.routes.ts` |
| **GET** | `/api/v1/reports/audit` | `requireAuth -> <anonymous>` | `server/src/modules/reporting/reporting.routes.ts` |
| **GET** | `/api/v1/reports/:report/export` | `requireAuth -> <anonymous>` | `server/src/modules/reporting/reporting.routes.ts` |
| **GET** | `/api/v1/reports/:report` | `requireAuth -> <anonymous>` | `server/src/modules/reporting/reporting.routes.ts` |
| **GET** | `/api/v1/dashboard` | `requireAuth -> <anonymous>` | `server/src/modules/reporting/reporting.routes.ts` |
| **GET** | `/api/v1/dashboard/dashboard` | `requireAuth -> <anonymous>` | `server/src/modules/reporting/reporting.routes.ts` |
| **GET** | `/api/v1/dashboard/audit` | `requireAuth -> <anonymous>` | `server/src/modules/reporting/reporting.routes.ts` |
| **GET** | `/api/v1/dashboard/:report/export` | `requireAuth -> <anonymous>` | `server/src/modules/reporting/reporting.routes.ts` |
| **GET** | `/api/v1/dashboard/:report` | `requireAuth -> <anonymous>` | `server/src/modules/reporting/reporting.routes.ts` |
| **GET** | `/api/health` | `None` | `server/src/modules/health/health.routes.ts` |
| **ALL** | `/api/auth/*` | `None` | `server/src/lib/auth.ts` |
