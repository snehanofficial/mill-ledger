# Data Model

## Source of truth

PostgreSQL is authoritative. Prisma manages ordinary models and migrations; concurrency-sensitive locking and reports may use reviewed parameterized SQL.

## Schema rules

- Use foreign keys, unique constraints, check constraints, and indexes for enforceable invariants.
- Keep documents, stock movements, reservations, and balance projections separate.
- Store stock quantities in a normalized base unit for each inventory item.
- Use `NUMERIC/DECIMAL` for quantities and money.
- Serialize decimal API values as strings.
- Snapshot product, customer, price, tax, and party details on posted financial documents.
- Archive master records rather than deleting records referenced by transactions.
- Keep order, fulfilment, invoice, dispatch, and payment states separate.
- Every stock movement points to a resolvable source document.

## Entity groups

### Identity and authorization

- organizations, facilities, warehouses
- users and Better Auth-managed session/account tables
- roles, permissions, role_permissions, user_roles
- salesman_customer_assignments
- optional user_devices

### Parties and masters

- customers and customer addresses/tax registrations
- suppliers and supplier addresses
- products and product variants
- inventory items and units of measure
- unit conversions and item-specific pack conversions
- price lists, price-list lines, and customer overrides
- HSN codes and effective-dated tax categories/rates
- invoice sequences and company tax profiles

### BOM and production

- recipes and recipe versions
- recipe components
- production specifications
- production packaging lines
- variance policies
- production runs and material/output/cost/variance lines
- linked production reversals

### Purchases and inventory

- purchase receipts and receipt lines
- stock documents and inventory transactions
- append-only stock movements
- inventory balances and stock reservations
- inventory adjustments, lots, cost layers, and valuation projections

### Sales, fulfilment, and finance

- sales orders and order lines/events/approvals
- sales invoices and invoice lines/tax lines
- credit notes
- dispatches and dispatch lines
- sales returns and return lines
- payments and payment allocations

### Audit and synchronization

- audit_logs
- idempotency_records
- sync_devices
- export_jobs
- file_objects

## Precision

Recommended starting precision:

- Stock quantity: `NUMERIC(18,6)`
- Unit cost/rate: `NUMERIC(18,6)` or sufficient precision
- Posted invoice money: `NUMERIC(18,2)` after documented rounding
- Discrete count units may use integer quantities where appropriate

Use exact decimal arithmetic for all intermediate calculations. Never use JavaScript floating-point arithmetic for quantities or money.

## Important constraints

- Unique: organization plus customer code; organization plus SKU; financial-year/series plus invoice number.
- Unique: idempotency key within actor/operation scope.
- Check: entered quantities are positive where entered as positive amounts; movement deltas may be signed.
- Check: payment allocations do not exceed receipt amounts or invoice balances unless unallocated receipt behavior is explicit.
- Check: reservations do not exceed available stock at approval time.
- Index stock movements by item, warehouse, and posted timestamp.
- Index orders by status/submission/salesman and invoices by FY/customer/date.

## Ledger relationships

`stock_document -> inventory_transaction -> stock_movement(s)`. Each movement resolves to an inventory item and source line, with optional warehouse and lot.

The on-hand projection may be updated with the transaction for fast display, but it must reconcile against a deterministic ledger sum:

```text
opening + sum(posted movement deltas) = closing
```

## Weighted-average valuation

A purchase recalculates the moving average in the posting transaction. An issue snapshots the current unit cost and value on the issue movement. This prevents later receipts from changing the historical cost of a posted production run.

FIFO is a separate future implementation. Do not describe a simple weighted average as FIFO.
