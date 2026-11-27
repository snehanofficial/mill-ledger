# Reporting and Audit

## Report catalogue

- Sales register: invoice, customer, SKU, quantity, taxable value, tax, total
- Customer/product sales
- GST outward summary shaped for reconciliation, not filing
- Purchase register
- Stock summary and stock ledger
- Production report with BOM, actuals, variances, waste, and cost
- Collection report
- Receivables and ageing
- Audit report

## Correctness rules

- Use posted records only unless a report explicitly defines another scope.
- Keep invoice, receipt, dispatch, and payment dates distinct.
- Use one explicit opening/closing-stock cutoff and timezone.
- Order simultaneous movements deterministically by timestamp plus stable sequence/ID.
- The on-screen report and export use the same filters and source query.
- Include report title, filters, generated-at, data-as-of, and row/source IDs where practical.
- Large exports may use private, expiring export jobs.
- Never hide adjustments, credit notes, unallocated payments, or reversals.

## Audit coverage

Log user/role/permission changes, master changes, price/BOM changes, purchase posting/reversal, production creation/edit/post/reversal, order submission/edit/decision/reservation, invoice posting/credit note, dispatch/return, payment/allocation, inventory adjustment, and report/export access.

An audit record contains actor, time, action, entity, reason where required, and request/correlation ID. Avoid storing unnecessary sensitive data in before/after snapshots.

## Contextual Entity 360° Timelines

Each major entity detail page (`Product`, `SalesOrder`, `SalesInvoice`, `Payment`, `Customer`, `Recipe`) embeds a unified chronological timeline backed by `/api/v1/timeline/:entityType/:entityId`. Related-record events are resolved via authoritative foreign keys, deduplicated, labeled with their originating entity and relationship path, and gated by the viewer's RBAC/ABAC permissions.

## Owner dashboard

Show reconciled operational summaries and explicit data-as-of timestamps. Every metric links to a filtered source view. Do not fabricate trends or forecasts without enough history.
