# Business Rules

## Sales order workflow

The state dimension is separate from fulfilment and invoice state:

- Order: `DRAFT -> SUBMITTED -> UNDER_REVIEW -> APPROVED | REJECTED -> CLOSED`
- Fulfilment: `UNFULFILLED -> PARTIALLY_FULFILLED -> FULFILLED`
- Invoice: `DRAFT -> POSTED -> CREDITED/CANCELLED_BY_CREDIT_NOTE`
- Dispatch: `DRAFT -> POSTED`, with reversal only through a controlled correction

Offline states are local only: `LOCAL_DRAFT -> QUEUED -> SYNCING -> SERVER_ACCEPTED | CONFLICT | FAILED`. Do not show server acceptance or stock reservation until the server commits it.

## Purchase receipt

- A receipt increases raw-material or packaging stock exactly once.
- Normalize entered quantity to the inventory item's base unit.
- Preserve receipt quantity, UOM, rate, supplier reference, and posting cost.
- Recalculate weighted-average valuation in the same transaction.
- Prevent duplicate posting with an idempotency key and/or supplier-document policy.
- Correct a posted receipt through reversal, return, or adjustment documents.

## Production

A production run uses a captured production specification/BOM version. Later changes do not alter historical runs.

```text
planned_component_qty = bom_component_qty_per_batch x planned_batch_count
consumption_variance_qty = actual_consumed_qty - planned_component_qty
consumption_variance_pct = (actual_consumed_qty - planned_component_qty) / planned_component_qty x 100
yield_variance_qty = actual_good_output - expected_good_output
yield_variance_pct = (actual_good_output - expected_good_output) / expected_good_output x 100
```

The oil benchmark comparison uses 10 L as the denominator: 10.5 L is `+5%`. The yield comparison uses 200 packets as the denominator: 188 packets is `-6%`.

Keep these concepts distinct:

- issued or moved to the run
- consumed in the run
- returned unused
- damaged/scrapped
- good finished output
- rejected finished output

A posted run is one atomic transaction. Raw/packaging deductions, finished-goods receipt, cost/variance snapshots, and audit data must commit or roll back together.

## Inventory

```text
available_to_promise = on_hand - active_reservations
```

- Stock balances are projections; stock movements are the append-only source of truth.
- Normal operations may not create negative on-hand or negative available stock.
- Approval creates a reservation, dispatch releases it and creates negative finished-goods movement.
- Every movement has exactly one resolvable posted source line.
- Reversals create linked correction movements; they never erase history.
- Balance projections must reconcile to ledger totals.

## Order approval and fulfilment

- The original quote and the admin-approved price/quantity are both preserved.
- An admin quantity or price override requires a reason.
- Insufficient stock shows exact shortage and never silently over-dispatches.
- Partial approval or partial dispatch is represented explicitly; do not infer it from a boolean status.
- Two concurrent approvals must not reserve the same stock.

## Invoice and dispatch

- Tax is effective-dated and calculated from supplier/customer place-of-supply facts.
- Invoice lines and customer/supplier data are snapshots.
- The invoice number is unique within its financial-year/series.
- Invoice PDF data comes from the posted immutable invoice.
- Dispatch is separate from invoicing and is the event that reduces physical finished goods.
- Returns record stock disposition; financial correction uses credit notes, not invoice deletion.

The 5% tax rate and CGST/SGST benchmark are exercise assumptions, not a universal snack-product rule.

## Payment and receivables

- A payment can allocate to multiple invoices or remain partly/unallocated.
- Payment allocations must be transactional.
- Outstanding is derived from posted invoices plus credit notes less payment allocations. Do not maintain independently editable customer outstanding.

## Costing

The MVP uses weighted average for inventory valuation. Purchase receipts update the moving average inside the posting transaction. Production issues snapshot the then-current unit cost on the movement and run.

```text
new_average_cost =
  (old_qty x old_average_cost + received_qty x receipt_unit_cost) /
  (old_qty + received_qty)
issue_value = issued_qty x current_average_cost
```

Cost per good packet is the total allocated run cost divided by actual good output, not planned output. Opening finished-goods stock is not assigned an invented cost.

## Audit

Log actor, time, action, entity, reason where required, and request/correlation ID for master changes, postings, reversals, order decisions, invoice corrections, payments, exports, and sensitive access. Keep posted data immutable through normal application paths.
