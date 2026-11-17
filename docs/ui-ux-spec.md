# UI and UX Specification

## Product direction

Use a calm, light-first, high-readability operational interface. Data-heavy screens use accessible tables and focused review panels, not dashboard-card sprawl. Status text always accompanies color.

## Role workspaces

### Salesman

Bottom navigation on small phones: Home, New Order, Orders, Customers, More. Include customer/product search, numeric quantity entry, local draft/sync status, and own-order history.

The normal order flow is Home -> New Order -> assigned customer -> products -> review -> save/submit. A normal order should be achievable in under 60 seconds with seeded/recent data.

### Factory admin

Desktop navigation: Overview, Order Inbox, Orders, Invoices, Dispatch, Masters, Purchases, Payments, Reports, Settings. Use dense filterable tables and split review panels.

Approval, invoice, and dispatch are distinct actions. Stock coverage shows on-hand, reserved, and available-to-promise. Shortage decisions are explicit.

### Production supervisor

Tablet navigation: Today's Runs, New Run, Receipts/Issues, Run History, Inventory. Prefill planned quantities from the captured BOM, show units on every row, and distinguish issue, consumption, return, damage, good output, and reject.

Before posting, show a complete impact preview. Posting and correction remain server-authoritative.

### Accountant/auditor

Desktop read-only navigation for sales, GST, purchases, stock, production, collections, receivables, exports, and audit. Every report shows period, filters, generated-at, and data-as-of metadata. Every total drills down to source records.

### Owner

Responsive summary with submitted/approved/dispatched orders, stock exceptions, variance alerts, cost/margin, receivables, recent events, and freshness timestamps. Do not invent trends from insufficient history.

## Responsive behavior

- 320-390 px: single column, bottom navigation, large primary actions, no ordinary horizontal page scroll.
- Tablet: touch-first controls and split/run review layouts where useful.
- Desktop: persistent navigation, keyboard-operable dense tables, and constrained content width.

## WCAG 2.2 AA targets

- Semantic landmarks, heading order, labels, and table relationships
- Visible keyboard focus and no keyboard traps
- Associated field instructions and error text
- Text/control/focus contrast
- Status not represented by color alone
- Reflow at 320 CSS pixels
- 44-48 px primary touch targets
- Reduced-motion support
- Screen-reader announcements for sync, submit, post, and validation
- Dialog focus management and return focus
- Manual desktop screen-reader and Android accessibility checks

## States

Every transaction screen supports loading, empty, validation error, server error, success, stale data, offline, sync conflict, and unavailable capability states where applicable.

## Tamil

Build i18n keys from the start. Review floor terms with a Tamil-speaking reviewer. Keep quantities, units, SKU values, and error meanings consistent across languages.
