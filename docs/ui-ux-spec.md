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

## Component foundation

The reusable UI foundation lives in `client/src/components/ui/`. Components compose shadcn/Radix primitives and the existing Radix, Lucide, Tailwind, and Sonner dependencies. Domain-specific behavior is intentionally absent.

### Inventory

- Actions and forms: `Button`, `Input`, `Textarea`, `Label`, `Field`, `Checkbox`, `RadioGroup`, `Switch`, `Select`, `DatePicker`, and `ConfirmationDialog`
- Surfaces: `Card`, `Dialog`, `AlertDialog`, `Sheet`, `Drawer`, `DropdownMenu`, `Popover`, `Tooltip`, and `Command`
- Navigation and data: `Table`, `Pagination`, `Tabs`, `Breadcrumb`, `StatusIndicator`, `DataList`, `DataItem`, and `Metric`
- Feedback: `Alert`, `Toaster`, `Badge`, `Skeleton`, `Spinner`, `Empty`, `LoadingState`, `SkeletonTable`, and `ErrorState`

### Usage conventions

- Consume semantic CSS variables for color, typography, spacing, radius, border, elevation, and motion. Do not add component-local hex values.
- Compose a `FieldGroup` and `Field` for forms. Every control must have a visible label, an associated description or error, and a 44px minimum target.
- Use `AlertDialog` for consequential actions and `Dialog` only for blocking decisions that cannot safely continue in the current context.
- Use `Sonner` toasts for transient confirmation. Never use a toast as the only record of a server-side result or field validation error.
- Use text plus icon or shape for every status. Numeric table columns remain right-aligned and use tabular figures with visible units.
- Keep loading, empty and error states in the same layout as the affected content. Loading text must identify what is loading; error text must identify what failed and the next safe action.
- Preserve keyboard focus, visible 3px focus rings, Escape-to-close behavior, and reduced-motion behavior in every component.

The routed inventory is available at `/` and `/components` through the client router. It demonstrates variants, interaction states, overlays, feedback, tables and responsive reflow.
