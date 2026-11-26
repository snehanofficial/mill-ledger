# Frontend Navigation & Route Map

**Date:** 2026-11-27  
**Purpose:** Canonical role-specific information architecture and URL map aligned with `MILLLEDGER_USER_JOURNEY_UX_BLUEPRINT.md` and `docs/authorization-matrix.md`.

## Default Landing Routes by Role

| Role | Default Route | Workspace Identity |
|---|---|---|
| `SALESMAN` | `/orders` | My Work & Orders (mobile-first) |
| `ADMIN` | `/dashboard` | Work Queue (desktop-first) |
| `PRODUCTION` | `/production/today` | Today's Production Runs (tablet-first) |
| `ACCOUNTANT` | `/reports` | Reporting Home (read-only desktop) |
| `OWNER` | `/dashboard` | Business Overview (responsive oversight) |

## Canonical Route Inventory & Permissions

| Route | Title / Purpose | Allowed Roles | Notes |
|---|---|---|---|
| `/dashboard` | Admin Work Queue / Owner Business Overview | `ADMIN`, `OWNER` | Role-distinct rendering |
| `/orders` | Salesman My Work / Admin Order Inbox / Read-only Orders | `ADMIN`, `SALESMAN`, `ACCOUNTANT`, `OWNER` | Preserves URL filters |
| `/orders/new` | Create / Edit Draft Sales Order | `ADMIN`, `SALESMAN` | Supports `?draftId=` |
| `/orders/:orderId` | Order Detail & Admin Review / Approval | `ADMIN`, `SALESMAN`, `ACCOUNTANT`, `OWNER` | ABAC: Salesman own-only |
| `/invoices` | Invoice Register & Eligible Orders | `ADMIN`, `ACCOUNTANT`, `OWNER` | |
| `/invoices/new` | Invoice Preparation & Posting | `ADMIN` | Prefills from `?orderId=` |
| `/invoices/:invoiceId` | Immutable Invoice Detail, PDF, Share, Credit Note | `ADMIN`, `ACCOUNTANT`, `OWNER` | |
| `/dispatch` | Dispatch Queue & Posted Dispatches | `ADMIN`, `OWNER` | |
| `/dispatch/new` | Dispatch Preparation & Stock Impact Preview | `ADMIN` | Prefills from `?orderId=` |
| `/dispatch/:dispatchId` | Dispatch Detail & Sales Return | `ADMIN`, `OWNER` | |
| `/payments` | Payment Register | `ADMIN`, `ACCOUNTANT`, `OWNER` | |
| `/payments/new` | Record Payment & Allocate | `ADMIN` | Prefills `?customerId=` / `?invoiceId=` |
| `/payments/:paymentId` | Payment Detail, Allocations & Bounce | `ADMIN`, `ACCOUNTANT`, `OWNER` | |
| `/receivables` | Customer Balances & Ageing | `ADMIN`, `ACCOUNTANT`, `OWNER` | Separated from Payments |
| `/receivables/:customerId` | Customer Ledger & Ageing Detail | `ADMIN`, `ACCOUNTANT`, `OWNER` | |
| `/production/today` | Today's Production Runs & Readiness | `ADMIN`, `PRODUCTION`, `OWNER` | |
| `/production/new` | BOM-Based Production Run Entry & Review | `ADMIN`, `PRODUCTION` | |
| `/production/history` | Production Run History | `ADMIN`, `PRODUCTION`, `OWNER` | |
| `/production/runs/:runId` | Production Run Detail, Variance, Costing, Reversal | `ADMIN`, `PRODUCTION`, `OWNER` | |
| `/production/recipes` | Recipe / BOM Reference & Versioning | `ADMIN`, `PRODUCTION`, `OWNER` | Admin-only write |
| `/stock` | Stock Overview (On-Hand, Reserved, ATP, Valuation) | `ADMIN`, `PRODUCTION`, `ACCOUNTANT`, `OWNER` | |
| `/stock/:itemId/ledger` | Item Stock Ledger & Source Links | `ADMIN`, `PRODUCTION`, `ACCOUNTANT`, `OWNER` | |
| `/purchases` | Purchase Receipts & Debit Notes | `ADMIN`, `PRODUCTION`, `ACCOUNTANT`, `OWNER` | |
| `/purchases/new` | New Purchase Receipt Workflow | `ADMIN`, `PRODUCTION` | |
| `/purchases/:receiptId` | Receipt Detail, Valuation & Reversal / Debit Note | `ADMIN`, `PRODUCTION`, `ACCOUNTANT`, `OWNER` | |
| `/suppliers` | Supplier Directory | `ADMIN`, `PRODUCTION`, `ACCOUNTANT`, `OWNER` | |
| `/suppliers/:supplierId` | Supplier Detail & Receipt History | `ADMIN`, `PRODUCTION`, `ACCOUNTANT`, `OWNER` | |
| `/customers` | Customer Directory (Salesman: assigned only) | `ADMIN`, `SALESMAN`, `ACCOUNTANT`, `OWNER` | |
| `/customers/:customerId` | Customer Profile, Assignments & Summary | `ADMIN`, `SALESMAN`, `ACCOUNTANT`, `OWNER` | |
| `/products` | Product Catalog, Pack Sizes & Price Lists | `ADMIN`, `SALESMAN`, `PRODUCTION`, `ACCOUNTANT`, `OWNER` | |
| `/reports` | Reporting Home Index | `ADMIN`, `ACCOUNTANT`, `OWNER` | |
| `/reports/sales` | Sales Register, Customer-wise & Product-wise Sales | `ADMIN`, `SALESMAN`, `ACCOUNTANT`, `OWNER` | |
| `/reports/gst` | GST Outward Summary | `ADMIN`, `ACCOUNTANT`, `OWNER` | |
| `/reports/stock` | Stock Valuation & Stock Ledger Report | `ADMIN`, `SALESMAN`, `PRODUCTION`, `ACCOUNTANT`, `OWNER` | |
| `/reports/production` | Production & Costing Report | `ADMIN`, `PRODUCTION`, `ACCOUNTANT`, `OWNER` | |
| `/reports/receivables` | Receivables & Ageing Report | `ADMIN`, `ACCOUNTANT`, `OWNER` | |
| `/reports/audit` | Audit Trail | `ADMIN`, `ACCOUNTANT`, `OWNER` | |
| `/exports` | Export History & Ad-hoc Generator | `ADMIN`, `ACCOUNTANT`, `OWNER` | Under Reports & Audit |
| `/settings` | Organization, Tax, Facilities, Warehouses, Users | `ADMIN`, `OWNER` | Owner read-only |
