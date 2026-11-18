# MLD-011 — Eliminate Stock Overwrites & Enforce Non-Negative Balances

## Metadata
- Task ID: `MLD-011`
- Related audit findings: `P1-DATA-03`
- Priority: P1 (High)
- Category: Data Integrity
- Status: `DONE`
- Dependencies: `DEC-003`, `MLD-004`
- Owner: AI Agent
- Created: November 18, 2026
- Last updated: November 18, 2026

## 1. Description
In `server/src/modules/inventory/inventory.service.ts:162`, posting a purchase receipt calculates `const totalQty = currentQty + receivedQty` in Node.js memory and executes:
`await tx.inventoryItem.update({ where: { id }, data: { currentStock: totalQty } })`.
If two purchase receipts, dispatches, or production runs touch the same SKU concurrently, the second write overwrites the first, losing inventory changes. Furthermore, inventory decrement operations must be atomic and protected against negative balances via PostgreSQL database-level `CHECK (current_stock >= 0)`.

## 2. Evidence
- Original audit finding: `P1-DATA-03`.
- Architectural Decision: `DEC-003`.
- Files:
  - [server/src/modules/inventory/inventory.service.ts:155-168](/server/src/modules/inventory/inventory.service.ts#L155-L168)
  - [server/src/modules/production/production.service.ts:310-340](/server/src/modules/production/production.service.ts#L310-L340)
  - [server/src/modules/sales/dispatch.service.ts:70-95](/server/src/modules/sales/dispatch.service.ts#L70-L95)

## 3. Expected Outcome
1. Inventory balances are updated using atomic Prisma increment/decrement operations:
   `currentStock: { increment: receivedQty }` or `currentStock: { decrement: consumedQty }`.
2. For decrements, a row-level lock (`SELECT ... FOR UPDATE`) or conditional update guarantees that stock does not become negative before the transaction commits.
3. PostgreSQL enforces `CHECK (current_stock >= 0)` at the table level as a defense-in-depth safety rail.

## 4. Scope
- **Included changes:**
  - Replace in-memory `currentStock: totalQty` assignments with atomic `{ increment: qty }` and `{ decrement: qty }` in `inventory.service.ts`, `production.service.ts`, and `dispatch.service.ts`.
  - Add optimistic concurrency / row lock in dispatch and production consumption to prevent over-allocation.
  - Verify PostgreSQL `CHECK (current_stock >= 0)` constraint added in `MLD-004`.
  - Add concurrent transaction stress test.
- **Excluded changes:**
  - Redesigning stock movements ledger structure.
- **Affected modules:** `server/src/modules/inventory/`, `server/src/modules/production/`, `server/src/modules/sales/dispatch.service.ts`.

## 5. Dependencies
- `DEC-003` (Approved design for atomic stock increments and negative stock DB constraint).
- `MLD-004` (Prisma migration applying `CHECK (current_stock >= 0)`).

## 6. Implementation Plan
1. In `inventory.service.ts:postPurchaseReceipt`:
   Update `inventoryItem` with `data: { currentStock: { increment: quantity }, weightedAverageCost: newWac }`.
2. In `production.service.ts:postProductionRun`:
   Use `{ decrement: ingredient.actualQuantity }` inside the transaction with row locks for consumed raw materials, and `{ increment: batchOutputQty }` for finished goods.
3. In `dispatch.service.ts:postDispatch`:
   Ensure stock decrements use `{ decrement: dispatchQty }`. Catch negative stock check violations with a clean user-facing 409 error ("Insufficient physical stock available for dispatch").
4. Write concurrent Vitest test firing 10 simultaneous receipts and dispatches against a single SKU.

## 7. Definition of Done
- [x] No service assigns absolute `currentStock` values calculated outside SQL.
- [x] Concurrent receipt and dispatch operations calculate exact net balance without lost updates.
- [x] Attempting to decrement stock past zero throws HTTP 409 Conflict with descriptive message.
- [x] All benchmark inventory and cost tests pass.

## 8. Verification Evidence
- Unit & Concurrency test: `server/src/inventory-concurrency.test.ts`
  - 10 simultaneous receipts executed concurrently; net final balance verified strictly equal to initial + 10 * 5.
  - Decrement past 0 triggers PostgreSQL CHECK constraint `chk_current_stock_non_negative` (code 23514).
- Error middleware: `server/src/middleware/error.middleware.ts` catches constraint violations and returns HTTP 409 Conflict.
- Full Benchmark Acceptance Oracle: All 18 benchmark assertions pass 100%.
