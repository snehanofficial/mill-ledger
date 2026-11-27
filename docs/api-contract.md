# API Contract

## Conventions

- REST API under `/api/v1`
- JSON request/response payloads
- Stable machine-readable error codes
- Zod validation for every external input
- ISO 8601 timestamps; UTC storage and context-aware display
- Decimal quantities and money serialized as strings
- Idempotency keys for retries and posting operations
- Request/correlation ID in logs and errors
- Pagination, filtering, and sorting for list endpoints

Do not trust client totals, permissions, tax values, or stock claims.

## Core routes

| Domain     | Route                                                | Purpose                                              |
| ---------- | ---------------------------------------------------- | ---------------------------------------------------- |
| Session    | `GET /api/v1/me`                                     | Current user, roles, facility, and workspace context |
| Masters    | `GET /api/v1/customers/assigned`                     | Salesman's assigned customers                        |
| Catalogue  | `GET /api/v1/products/catalog`                       | Active variants and effective price snapshot         |
| Purchases  | `POST /api/v1/purchase-receipts`                     | Post receipt and stock movement                      |
| Inventory  | `GET /api/v1/inventory/balances`                     | On-hand, reserved, and available quantities          |
| Inventory  | `GET /api/v1/inventory/items/:id/ledger`             | Source-linked stock movements                        |
| Production | `POST /api/v1/production-runs`                       | Create a draft run                                   |
| Production | `POST /api/v1/production-runs/:id/post`              | Atomically post production                           |
| Orders     | `POST /api/v1/orders`                                | Idempotent server order submission                   |
| Orders     | `GET /api/v1/orders/mine`                            | Salesman's own orders                                |
| Admin      | `POST /api/v1/orders/:id/approve`                    | Approve and reserve transactionally                  |
| Admin      | `POST /api/v1/orders/:id/reject`                     | Reject with reason                                   |
| Invoices   | `POST /api/v1/orders/:id/invoices`                   | Post invoice under tax and numbering rules           |
| Invoices   | `GET /api/v1/invoices/:id/pdf`                       | Retrieve authorized invoice PDF                      |
| Dispatch   | `POST /api/v1/dispatches`                            | Post dispatch and stock movement                     |
| Payments   | `POST /api/v1/payments`                              | Record receipt and allocations                       |
| Reports    | `GET /api/v1/reports/:report`                        | Filtered report rows                                 |
| Reports    | `POST /api/v1/reports/exports`                       | Generate authorized export                           |
| Sync       | `POST /api/v1/sync/orders` or idempotent order route | Submit queued order commands with per-item results   |

Use the single-order submission route before adding batch sync. Every batch item still requires its own idempotency key and result.

## Error envelope

Errors contain:

```text
code
message
fieldErrors[]
requestId
```

Use stable codes for authentication, authorization, validation, conflict, idempotency replay, insufficient stock, stale price, invalid state transition, and duplicate posting.

## Authorization and resource scope

Every protected route checks permission and resource scope. Frontend route visibility is not authorization.

## Idempotency

Idempotency records include key scope, actor, operation, request hash, response snapshot, status, and creation time. Replaying the same request returns the original committed result. A changed payload with the same key is a conflict.

## Posting operations

Purchase, production, approval/reservation, dispatch, invoice, payment, and reversal operations are database transactions. If an operation fails after a movement or audit write is attempted, the transaction must leave no partial business state.

## Unified Entity 360° Lifecycle Timeline

- `GET /api/v1/timeline/:entityType/:entityId` (authenticated; `entityType` in `product | order | invoice | payment | customer | recipe`; query params `filter=ALL|DIRECT|RELATED|FINANCIAL|OPERATIONAL`, `limit`, `offset`)
- Returns chronological (newest-first), relationship-aware events aggregated from `AuditLog` and pre-audit record baselines, filtered by tenant isolation, RBAC, and ABAC on both primary and related records.
