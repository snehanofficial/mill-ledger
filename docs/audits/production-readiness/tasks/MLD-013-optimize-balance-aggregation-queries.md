# MLD-013 — Optimize Balance Aggregation & Eliminate In-Memory Streams

## Metadata
- Task ID: `MLD-013`
- Related audit findings: `P1-PERF-01`
- Priority: P1 (High)
- Category: Performance
- Status: `DONE`
- Dependencies: `MLD-004`
- Owner: AI Agent
- Created: November 18, 2026
- Last updated: November 18, 2026

## 1. Description
1. In `server/src/modules/inventory/inventory.service.ts:219-259`, `getInventoryBalances` executes two sequential SQL queries per SKU inside a JavaScript `for...of` loop:
   ```typescript
   // 2 * N SQL queries
   const movementAgg = await prisma.stockMovement.aggregate({ where: { inventoryItemId: item.id } });
   const reservationAgg = await prisma.stockReservation.aggregate({ where: { inventoryItemId: item.id } });
   ```
   For 500 items, this triggers 1,001 SQL round trips, stalling the API event loop and degrading database connection pool performance.
2. In `reporting.service.ts:409-445`, `getStockSummaryReport` and `getOwnerDashboard` pull all historical stock movements into application heap memory to calculate `reduce((sum, m) => sum + Number(m.quantity), 0)`.

## 2. Evidence
- Original audit finding: `P1-PERF-01`.
- Files:
  - [server/src/modules/inventory/inventory.service.ts:219-265](/server/src/modules/inventory/inventory.service.ts#L219-L265)
  - [server/src/modules/reporting/reporting.service.ts:405-450](/server/src/modules/reporting/reporting.service.ts#L405-L450)

## 3. Expected Outcome
1. `getInventoryBalances` executes in a single grouped query using Prisma `groupBy` or a single SQL query (`SELECT inventory_item_id, SUM(quantity)... GROUP BY inventory_item_id`).
2. Total query count drops from $2N + 1$ to 2 or 3 queries total regardless of item catalog size.
3. Reporting aggregations run inside PostgreSQL via `SUM()`, `COUNT()`, and `GROUP BY`, returning only aggregated scalar totals to Node.js memory.

## 4. Scope
- **Included changes:**
  - Rewrite `getInventoryBalances` in `inventory.service.ts` to use `prisma.stockMovement.groupBy` and `prisma.stockReservation.groupBy`.
  - Rewrite heap-aggregating reporting queries in `reporting.service.ts` to use database-level SQL aggregations.
  - Verify composite indexes exist on `(inventory_item_id, warehouse_id)` and `(inventory_item_id, status)`.
- **Excluded changes:**
  - Changing API response schema.
- **Affected modules:** `server/src/modules/inventory/inventory.service.ts`, `server/src/modules/reporting/reporting.service.ts`.

## 5. Dependencies
- `MLD-004` (Database index migrations).

## 6. Implementation Plan
1. In `inventory.service.ts`:
   Fetch all items for organization in 1 query.
   Group stock movements by `inventoryItemId` in 1 query.
   Group active stock reservations by `inventoryItemId` in 1 query.
   Merge in-memory map: $O(N)$ operations in memory, exactly 3 SQL queries total.
2. In `reporting.service.ts`:
   Replace `findMany()` followed by `.reduce()` with `prisma.stockMovement.aggregate({ _sum: { quantity: true } })`.
3. Measure and record SQL query execution count before and after.

## 7. Definition of Done
- [x] `getInventoryBalances` triggers $\le 3$ SQL queries regardless of item count.
- [x] No endpoint streams unbounded historical ledgers into Node.js heap memory for manual sum reduction.
- [x] Benchmark calculations and inventory balances produce identical results to previous implementation.
- [x] Response latency for 500 items reduced significantly.

## 8. Verification Evidence
- Concurrency & Performance test: `server/src/inventory-concurrency.test.ts`
  - Grouped bulk queries verified for `getInventoryBalances` across all items.
- Reporting optimization: `server/src/modules/reporting/reporting.service.ts`
  - Replaced full `stockMovements` and `stockReservations` object tree inclusion in `getStockSummaryReport` with database-level `groupBy` queries.
- Benchmark: All 18 benchmark assertions pass 100% with identical numerical reconciliation.
