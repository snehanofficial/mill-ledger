# MillLedger — Complete User Journey & UX Blueprint

**Document purpose:** Target experience specification for reorganising the existing MillLedger application around real user work, not a new feature backlog.
  
**Primary authority:** `Problem_Statement_Winter_Internship_Application_2026.md`, `docs/product-requirements.md`, `docs/business-rules.md`, `docs/authorization-matrix.md`, `docs/ui-ux-spec.md`, `docs/data-model.md`, `docs/benchmark.md`, current role navigation and route configuration.

---

## 0. Product and scope guard

MillLedger is an operational ledger and workflow application for a small packaged-food manufacturer. Its job is to take a business event once, at the point it happens, and carry that event through stock, production, costing, sales, finance and audit.

The approved problem statement describes a snack manufacturer with field salesmen, a factory admin/billing desk, a production floor, an external accountant/auditor and an owner. This blueprint follows that food-manufacturing scope. Do not silently substitute a different manufacturing domain or import unrelated furniture-business assumptions.

This is an experience redesign, not a reason to expand the product into a generic ERP. Preserve the existing P0 business requirements, data invariants, permission policies and benchmark. Do not add features just to make the navigation appear comprehensive.

### Product promise

> Every person knows what they need to do next. Every action updates the right business records once. Every important number can be traced back to its source.

### Intended user feeling

- **Clear:** the page explains the user's current responsibility and the next safe action.
- **Trustworthy:** quantities, prices, stock and tax calculations are visible before consequential posting.
- **Calm:** the interface does not overwhelm users with every module, chart, tab and action at once.
- **Fast:** frequent work is short, predictable and keyboard/touch friendly.
- **Recoverable:** drafts, unsent offline work, validation errors and failed requests never silently destroy user input.
- **Traceable:** every posted transaction has a detail view, source links and a readable activity history.

MillLedger should feel like a practical factory operations system, not a generic SaaS admin template or a collection of unrelated CRUD screens.

---

## 1. The operating model users must experience

There are two connected operational cycles.

### 1.1 Sales and fulfilment cycle

`Customer → Salesman order → Admin review → Approval/reservation → GST invoice → Dispatch → Payment allocation → Customer outstanding`

The customer order is the start of the commercial process. Approval reserves available stock. Invoice posting creates the immutable tax document and receivable. Dispatch records the physical movement and is the event that deducts finished-goods stock. A payment is recorded once and allocated against one or more invoices.

### 1.2 Procurement and production cycle

`Supplier → Purchase receipt → Raw/packaging stock → BOM production run → Actual consumption and output → Finished-goods stock → Cost and variance`

The production run uses the exact BOM/recipe version captured when the run is created. It records planned quantities and actuals, including issued, consumed, returned, damaged/scrapped, rejected and good output as distinct facts. Posting the run atomically deducts materials and adds finished goods.

### 1.3 Where they meet

Both cycles meet at finished-goods stock. They both feed the stock ledger and monthly reports. The owner sees the resulting business picture; the accountant/auditor can trace each report amount to a posted source record.

### 1.4 The application must not collapse these distinctions

- Order approval is not invoicing.
- Invoice posting is not dispatch.
- Dispatch is not payment collection.
- Material issue is not necessarily material consumption.
- Damage/scrap is not good output.
- On-hand stock is not available-to-promise stock.
- A locally queued offline order is not a server-accepted order and has no server reservation.
- A dashboard estimate is not the same thing as a posted financial figure.

These distinctions are business rules, not merely labels in the UI.

---

## 2. Information architecture: organise around work

### 2.1 Recommended navigation groups

Use a small number of role-filtered destinations. The same domain can have different actions for different roles, but do not create a different information architecture for every user.

| Navigation group | What belongs here | What it helps the user complete |
|---|---|---|
| **Home / Work queue** | Role-specific landing page, pending tasks, exceptions, recent activity | Decide what needs attention now |
| **Sales & fulfilment** | Orders, invoice queue, dispatch queue, customers | Convert accepted demand into fulfilled orders |
| **Production** | Today's runs, new run, run history, recipe/BOM reference | Convert materials into saleable finished goods |
| **Materials & stock** | Purchase receipts, stock summary, item ledger, suppliers | Receive and control material stock |
| **Finance** | Payments, customer receivables, customer ledger | Record collections and understand money due |
| **Reports & audit** | Sales, GST, purchase, stock, production, collections, ageing, audit, exports | Reconcile and inspect the business |
| **Masters & settings** | Products/variants, BOM versions, customers, suppliers, price lists, tax/company setup, users/permissions | Maintain reference data and configuration |

Do not show all seven groups to every role. Salesmen should see only their own sales workspace. Production should see production and stock tasks, not finance controls. Accountants should not see write actions. Owners should get visibility without becoming an implicit superuser.

### 2.2 Role-specific navigation

**Salesman — mobile-first**

1. Home / My work
2. New order
3. My orders
4. My customers
5. More: product catalogue, own sales summary, help, sync/outbox, profile

Use a bottom navigation bar on a phone. Do not expose the factory's full sidebar.

**Factory Admin — desktop-first**

1. Work queue
2. Sales & fulfilment: Order inbox, Orders, Invoices, Dispatch
3. Materials & stock: Purchases/receipts, Stock, Suppliers
4. Production overview (only if this admin is expected to coordinate or inspect runs)
5. Finance: Payments, Receivables
6. Masters: Customers, Products & price lists, Suppliers, tax/company setup
7. Reports & audit
8. Settings / access management

The admin's primary landing view is a work queue, not a row of generic KPI cards.

**Production Supervisor — tablet-first**

1. Today's runs
2. New production run
3. Material receipts/issues (only permitted operations)
4. Stock / material availability
5. Run history
6. Production reports
7. More: product/recipe reference, sync/language/help

Do not surface invoice, payment, receivables or customer-finance navigation.

**Accountant / Auditor — read-only desktop**

1. Reporting home
2. Sales register and invoice records
3. GST outward summary
4. Purchase register
5. Stock summary and stock ledger
6. Production and costing report
7. Collections and receivables ageing
8. Audit trail and exports

No create, edit, approve, post, reverse, dispatch, allocate or delete actions. Drill-down is allowed only to read records within the accountant's authorised scope.

**Owner — responsive overview**

1. Business overview
2. Exceptions / needs attention
3. Sales and fulfilment visibility
4. Production and stock visibility
5. Cost and margin visibility
6. Receivables visibility
7. Reports and audit
8. Settings only where explicitly permitted

Owner is a decision-maker, not automatically a superuser. Do not grant transactional powers just because the role is named OWNER.

### 2.3 Navigation labels must describe business language

Prefer:
- “Today's runs” over “Production module”.
- “Purchase receipts” or “Receive materials” over vague “Inventory actions”.
- “Ready to dispatch” over a generic “Dispatch management”.
- “Customer balances” over an unexplained “Receivables”.
- “My orders” for a salesman and “Order inbox” for an admin.

Use a stable domain name in headings and URLs, but use task language in the visible interface.

---

## 3. Shared application shell and interaction contract

Every role should recognise the same basic structure even though their navigation differs.

### 3.1 Persistent shell

**Desktop**
- Left navigation with role-visible groups, clear active item, expandable group labels and accessible collapse behavior.
- Stable header height; reserve space for sync/network, notifications and account controls so status changes do not shift the page.
- Breadcrumbs for nested records. Breadcrumbs must lead to the parent list and preserve its search/filter context.
- A clear page title and one-sentence purpose at the beginning of the content area.
- Main content has a readable maximum width; dense tables may use the available width.

**Mobile**
- Salesman uses bottom navigation and a compact header.
- Production uses touch-first navigation and large numeric controls.
- Admin/owner/accountant pages reflow to a single column without ordinary horizontal page scrolling at 320 CSS px.
- Avoid a desktop sidebar compressed into a tiny unusable rail on small devices.

### 3.2 Page anatomy

Use the same structure across list and workspace pages:

1. **Page identity:** title, purpose, breadcrumb if nested.
2. **Primary action:** one visually dominant action for the page's main job.
3. **Context:** counts or operational summary relevant to the task, not decorative KPI cards.
4. **Find and filter:** search and filters grouped into one consistent toolbar.
5. **Main work area:** queue, table, form or report.
6. **Secondary actions:** placed next to the relevant record or in a clearly named action menu.
7. **Status and feedback:** readable status, freshness, offline or error context.

The primary action should change when a record changes state. Example: `Review order` → `Create invoice` → `Prepare dispatch` → `View fulfilment`; do not leave the same generic `Manage` action throughout.

### 3.3 List-to-detail is the default interaction

- Clicking a table row or its named record link opens a dedicated detail route.
- The detail page becomes the single source of context for that record: current state, progress, parties, line items, amounts, stock effects, linked documents and activity history.
- Put the next valid action in the detail page header.
- Preserve list filters and scroll position when the user returns.
- Do not make the user open several unrelated modals to understand one order, production run, invoice or receipt.

### 3.4 When to use a page, drawer or dialog

**Dedicated page:** use for multi-step or consequential work, including a new order, order review, new production run, purchase receipt, invoice review, customer ledger, report detail and record detail.

**Side panel/drawer:** use for a contextual peek at a short record summary where the user should remain in the list. It must not become the only place where a complex workflow can be completed.

**Dialog:** use only for a short decision, concise confirmation, or a small edit that needs no more than a few fields. Good examples: confirm posting after reviewing the impact, enter a short rejection reason, confirm a reversal, or edit one simple contact field.

**Never:** open a dialog from a dialog, put a whole multi-step form inside a modal, or hide the only path to a critical task in an overflow menu.

### 3.5 Tabs and sub-navigation

Tabs are for a small set of peer views of the same object or dataset. They are not a substitute for navigation.

Recommended treatment:
- Order lifecycle stages: use status filters/queue groupings, not separate nested tabs with hidden actions.
- Device outbox: expose through the persistent sync indicator / outbox panel, not as a second business tab inside Orders.
- Reports: give each major report a stable route; use a report index or secondary navigation. Tabs are acceptable only for truly peer views such as “By customer” and “By product” within Sales analysis.
- Payments and receivables: distinguish the payment transaction register from customer balances/ageing. Give them separate destinations or clearly named sections rather than ambiguous “Ledger / Receivables” tabs.
- A record detail page may use anchored sections or tabs only where the sections are stable peers and useful to deep-link.

### 3.6 Forms and data entry

- One logical task per form. Group fields in the order users know the information.
- Show unit on every quantity input and currency on every amount.
- Prefill reliable values from masters, price lists, BOM versions and prior selections; label defaults so users know they are defaults.
- Preserve draft input on validation errors, network failures and navigation warnings.
- Show inline errors beside fields and a concise summary at the top when there are multiple errors.
- Do not silently alter a user's entered quantity, rate or price.
- For overrides, show original value, new value and required reason.
- Use a review/impact step before posting important transactions.

### 3.7 Transaction lifecycle pattern

All consequential business actions should follow one recognisable lifecycle:

`Prepare → Review impact → Confirm / Post → View posted result`

Before posting, show:
- What is being posted and to which party/product/warehouse.
- The quantities and monetary values involved.
- The expected stock effect (on-hand, reserved, available-to-promise, or movement).
- Tax / costing / variance where applicable.
- Any warning, mismatch or policy restriction.
- Whether the action is reversible and the correct correction process.

The final button must say what it does: `Approve order`, `Post invoice`, `Post production run`, `Post receipt`, `Post dispatch`, `Record payment`.

### 3.8 Status language

Keep independent state dimensions independent. Do not compress them into one ambiguous badge.

- **Order:** Draft, Submitted, Under review, Approved, Rejected, Closed.
- **Fulfilment:** Unfulfilled, Partially fulfilled, Fulfilled.
- **Invoice:** Draft, Posted, Credited / cancelled by credit note.
- **Dispatch:** Draft, Posted, Cancelled/reversed through controlled correction.
- **Offline order:** Local draft, Queued, Syncing, Server accepted, Conflict, Failed.
- **Payment:** Received, Partly allocated, Fully allocated (derive from allocations).

Every status must include text; colour alone is never sufficient. Explain the next expected action for statuses that block progress.

### 3.9 Feedback, freshness and recovery

- A toast may confirm a transient interaction, but it is never the only proof of a posted server transaction.
- After posting, show a stable result page/record number and the resulting business effect.
- Show `Updated at` / `Data as of` when users are looking at balances or reports that may be stale.
- A failed request must explain what failed and the safe next action. Keep entered form state.
- For offline mode, state which information is cached, which actions are queued, and which require a connection.
- Use geometry-matched skeletons to avoid layout shift; preserve table/page structure while loading.

---

## 4. Detailed role journeys

# 4A. Salesman journey

### Job to be done

A salesman in the field needs to place a correct customer order quickly, even on a weak or unavailable network, and know whether the factory has received it and what happened next.

### Entry and home experience

**Default workspace:** the current `/orders` destination may remain the salesman landing route, but its visible identity should be `My work` or `My orders`, not an all-company order-management screen.

Top of page:
- Greeting and connectivity/sync state.
- One dominant `New order` action.
- Small useful counts: drafts, awaiting factory review, approved, dispatched.
- `Continue draft` when one exists.
- A short “Needs attention” list for conflicts or failed syncs.
- Recent orders below.

Do not show factory-wide KPIs, all-customer balances or other salesmen's orders.

### Journey S-01: create and submit a customer order

1. Tap `New order`.
2. Choose from assigned customers; show recent/favourite customers first and support search by name/code/phone.
3. Customer context appears: name, delivery location/state, any applicable customer-specific price list or payment note. Do not expose unrelated sensitive financial data.
4. Search/select products. Show pack size clearly (for example, Murukku 200 g), SKU, effective price and unit.
5. Enter quantity with large numeric controls. Add another product without losing the current cart.
6. Show a compact running order summary: items, quantities, unit price, discounts if allowed, taxable total and estimated tax/total.
7. `Review order` shows customer, delivery details, line items, prices, totals and notes.
8. `Submit order` saves once. The salesman receives a stable order number and clear state.
9. Navigate to the order detail/status view. Show what the factory will do next.

**Primary action:** `New order` on the home page; `Submit order` on the review step.

**Speed target:** a normal repeat order with a known customer/product should take under 60 seconds. Support recent products, remembered customer selection where safe, numeric-first input and minimal mandatory fields.

### Journey S-02: save a draft and resume later

- `Save draft` is distinct from `Submit order`.
- Drafts are editable only by their owner and only while still in Draft.
- On return, the salesman can continue or discard a draft with clear confirmation.
- Draft state is local or server-persisted according to connectivity; label the source accurately.

### Journey S-03: offline capture and sync

- If offline, the salesman can create and save the order locally.
- Show `Saved on this device — waiting to sync`, not `Submitted` or `Approved`.
- Display pending count in the persistent sync indicator.
- When online, sync automatically and allow manual retry.
- Idempotent replay must prevent duplicate server orders.
- If a conflict occurs (for example, product/customer is unavailable or server-side price/stock facts changed), explain the exact conflict and give a safe resolution path. Preserve the original local order.
- Do not show server-side stock reservation until the server confirms acceptance/approval.

### Journey S-04: track orders and customer-wise sales

`My orders` lists only the logged-in salesman's records. Search by order number/customer, filter by order status and date, and open a detail page.

Order detail should show:
- Order number, submitted timestamp, customer and delivery location.
- Order lines, original quoted quantities/prices and totals.
- Current order status and fulfilment status separately.
- Factory decision and rejection reason, if any.
- Invoice and dispatch references when created.
- Activity timeline and sync history where applicable.
- Next step: wait for review, contact admin, or view invoice/dispatch status.

The salesman cannot approve, post invoices, dispatch, edit posted orders or allocate payments.

### Salesman page inventory

| Page | Main content | Primary action |
|---|---|---|
| My work / My orders | Counts, drafts, order activity, sync issues | New order |
| New order | Customer, product selection, quantities, price and cart | Review order |
| Review order | Final customer and commercial summary | Submit order |
| Order detail | Lifecycle, decision, invoice/dispatch references, timeline | State-dependent; usually none while waiting |
| My customers | Assigned customers and quick contact context | Create order for this customer |
| My sales summary | Own customer-wise/product-wise sales, if retained | Open filtered order list |
| Device outbox | Queued, syncing, conflict and failed local records | Retry / resolve |

---

# 4B. Factory Admin journey

### Job to be done

The factory admin is the operational coordinator. They turn incoming demand into approved commitments, invoices, dispatches and collections while keeping stock and commercial records correct.

### Entry and home experience: the work queue

**Default workspace:** `/dashboard` for ADMIN, presented as `Work queue` or `Today's operations`.

The page should answer, in this order:

1. What needs my action now?
2. What is waiting on another person/process?
3. What could block today's work?
4. What has recently changed?

Recommended sections:

- **Needs action:** submitted orders awaiting review; approved orders awaiting invoice; invoiced orders awaiting dispatch; payments that need allocation; purchase/stock exceptions.
- **Stock exceptions:** shortages, low raw material, reservations and material mismatch.
- **Today's movement:** new orders, posted invoices, dispatches, received payments and production postings.
- **Business snapshot:** sales, collections, receivables and stock value with a clear time period and freshness label.

Each work item links directly to its source record and offers one next action. Do not make a dashboard card the only way to access an important task.

### Journey A-01: review and decide an incoming order

1. Open `Order inbox` from the work queue.
2. See submitted orders in a queue grouped by `Needs review`, `Shortage`, `Approved`, `Rejected` or other relevant states. Use status filters rather than hiding actions behind tabs.
3. Open an order detail/review page.
4. Inspect customer, salesperson, delivery state, requested date/notes, item lines, current price list and tax context.
5. Inspect stock per line: on-hand, reserved, available-to-promise (ATP), requested quantity and exact shortage.
6. If quantity/price is changed, preserve the original quote, show the approved value alongside it and require a reason.
7. Confirm whether all lines can be approved. If stock is short, show the exact shortage and the valid choices. Never silently approve more than available stock.
8. Choose `Approve order` or `Reject order` with a required reason for rejection.
9. On successful approval, show the reservation result and next action: `Create invoice`.

**Primary action:** `Review order` from the queue; `Approve order` / `Reject order` on the review workspace.

Approval is a business decision and reservation event. Do not combine it with invoice posting or dispatch.

### Journey A-02: create and post a GST invoice

1. From the approved order detail, select `Create invoice`.
2. Open a dedicated invoice preparation page, prefilled from the approved order.
3. Show customer billing identity, GSTIN, place of supply, HSN, product snapshots, quantities, unit prices, discounts, taxable value and tax breakdown.
4. Resolve any missing statutory/master data before posting. Explain which field is missing and where it can be corrected.
5. Show whether CGST/SGST or IGST applies and why, based on configured tax policy and place-of-supply facts.
6. Review invoice totals and financial-year numbering preview.
7. Select `Post invoice`.
8. After posting, show the immutable invoice number, totals, due/outstanding amount, download PDF and share actions.
9. The invoice detail page links back to its order and forward to dispatch.

**Primary action:** `Create invoice` from an approved order; `Post invoice` on the invoice review step.

Posted invoices are not editable or deletable through normal UI paths. Financial correction uses a credit note/correction document.

### Journey A-03: dispatch an invoiced order

1. Open `Ready to dispatch` from the work queue or Sales & fulfilment navigation.
2. Select an eligible order/invoice and inspect its remaining unfulfilled quantity.
3. Enter dispatch quantities per line. Support partial dispatch explicitly.
4. Enter practical delivery details when required: dispatch date, vehicle, driver/contact, notes.
5. Review the effect: reserved quantity released, physical finished stock deducted, remaining fulfilment quantity and new stock balance.
6. Select `Post dispatch`.
7. Show dispatch number, dispatched quantities, resulting stock movement and updated fulfilment state.
8. If the delivery is partial, state exactly what remains and whether another dispatch is expected.

**Primary action:** `Prepare dispatch` on an eligible invoice/order; `Post dispatch` after impact review.

Returns are a separate, traceable flow linked to the dispatch. Do not erase or edit the posted dispatch.

### Journey A-04: record a customer payment

1. Open `Payments` or `Collections`.
2. Choose the customer; show their open invoices and current derived outstanding.
3. Enter received amount, date, payment mode, reference/transaction number and notes.
4. Allocate the amount to one or more open invoices, with an oldest-first suggestion where configured.
5. If the received amount exceeds the selected invoice balances, show the unallocated remainder explicitly. Do not discard it or silently allocate beyond a balance.
6. Review the customer, receipt amount, allocations and unallocated amount.
7. Select `Record payment`.
8. Show payment receipt number and updated invoice/customer balances.
9. Link to the customer's ledger and the invoices affected.

**Primary action:** `Record payment`.

Outstanding is derived from invoices, credit notes and payment allocations; it is never an independently editable customer field.

### Journey A-05: receive raw material / packaging

1. Open `Purchase receipts` / `Receive materials`.
2. Choose supplier and destination warehouse.
3. Enter supplier invoice/reference and receipt date.
4. Add material lines: inventory item, entered quantity, unit, rate and any line reference.
5. Normalize units and show the base-unit equivalent. Validate positive quantities and permitted units.
6. Review supplier, lines, total receipt value and the expected stock/weighted-average-cost effect.
7. Select `Post receipt`.
8. Show receipt number, new stock balances and ledger links.
9. If a duplicate supplier document is suspected, block or warn according to the configured duplicate policy.

This is a receipt event, not a direct stock edit. A correction must be a linked reversal, return or adjustment document.

### Journey A-06: resolve operational exceptions

Give exceptions a dedicated queue rather than scattering warnings across pages. Each exception should state:
- What happened.
- Which transaction/item/customer is affected.
- The business impact.
- Whether work is blocked or can continue.
- The authorised next action.
- The source record.

Examples: insufficient finished goods, production yield variance, consumption variance, packaging mismatch, supplier receipt duplication, failed offline order sync and unallocated customer payment.

### Admin page inventory

| Page | Purpose | Primary action |
|---|---|---|
| Work queue | Prioritised operational work and exceptions | Continue highest-priority task |
| Order inbox | Review submitted orders | Review order |
| Order review/detail | Verify commercial data and ATP | Approve / Reject |
| Invoice queue/list | Find approved orders and posted invoices | Create invoice / Open invoice |
| Invoice preparation | Validate tax and snapshot values | Post invoice |
| Invoice detail | PDF, sharing, amount due, order and dispatch links | Prepare dispatch |
| Dispatch queue | Orders awaiting physical fulfilment | Prepare dispatch |
| Dispatch preparation | Quantities, driver/vehicle and stock effect | Post dispatch |
| Dispatch detail | Posted dispatch and movements | Record return, if applicable |
| Purchase receipts | Supplier material receipts | Receive materials |
| Receipt detail | Receipt lines, valuation and stock movements | View ledger / controlled correction |
| Payments | Collection register and receipt workflow | Record payment |
| Customer balances | Customer-wise outstanding and ageing | Open customer ledger |

---

# 4C. Production Supervisor journey

### Job to be done

The production supervisor needs to know what to produce, what materials are available, what the approved recipe expects, what was actually used, how much good product was produced, and where yield/consumption differs from plan.

The floor interface must prioritise quantities, units, legibility and safe posting over decorative dashboards.

### Entry and home experience: Today's runs

**Default workspace:** `/production/today`.

Top of page:
- Production date/shift or current work period, if shifts are configured.
- Dominant `Start production run` action.
- Planned/queued runs and recently posted runs.
- Material shortage warnings relevant to the planned work.
- Unreviewed variance or failed posting exceptions.

Each run row should display product/pack size, recipe version, planned batches, expected good output, material readiness and current state.

Do not require the supervisor to navigate to a separate product page, inventory page and recipe page just to start a known production run.

### Journey P-01: prepare and post a production run

1. Select `Start production run`.
2. Choose finished product / pack size.
3. Choose the effective approved BOM/recipe version. Historical runs must keep the exact version captured at creation.
4. Enter batch count or intended production quantity.
5. The system calculates the planned component quantities and expected good output. Each quantity includes its unit.
6. Show available raw and packaging stock. Highlight insufficient material before the supervisor starts recording.
7. Record material issued to the run. Distinguish issue from actual consumption.
8. Record material actually consumed and unused material returned. Record damaged/scrapped packaging separately.
9. Record good finished output and rejected output separately. The units must match the product/pack configuration.
10. Record direct labour and utilities/other direct run costs where required.
11. Show planned vs actual comparison for each ingredient and packaging item, good output, reject/scrap, yield percentage, consumption variance and estimated run cost.
12. Explain every tolerance breach in plain language. Example: `Oil used 10.5 L against 10.0 L planned (+5%). Outside the configured tolerance.`
13. Show a complete posting preview: raw/packaging stock deductions, returns, damage, finished-goods increase and cost snapshots.
14. Select `Post production run`.
15. On success, show the run number, final good output, updated stock balances, cost per good packet and variance flags.

**Primary action:** `Start production run`; final transaction action `Post production run`.

The post operation must be atomic. If any material or finished-stock write fails, the entire operation rolls back.

### Journey P-02: review a posted production run

The run detail page should show:
- Run number, product, batch count, recipe version and production date.
- Planned and actual quantities, with units.
- Issued, consumed, returned, damaged, rejected and good-output quantities as separate rows.
- Yield and consumption variance, tolerance and flag explanation.
- Direct labour and utilities, materials valuation, total run cost and cost per good packet.
- Resulting stock movements and links to the stock ledger.
- Created by, posted by, timestamps and activity history.
- A controlled correction/reversal path if the run is wrong.

A posted run must not have an ordinary `Edit` button. Corrections preserve the original history.

### Journey P-03: receive materials, if authorised

If the production supervisor has the specific purchase-receipt permission, expose `Receive materials` within the production/materials workspace. The action follows the same dedicated receipt workflow as the admin journey. Do not give production users supplier-payment or finance permissions merely because they can record a physical receipt.

### Journey P-04: check stock and the material ledger

The stock view for production should default to raw materials and packaging. It should answer:
- What quantity is physically on hand?
- What is reserved/committed, if applicable?
- What can be used for production?
- What is the unit?
- What recent receipt, issue, production consumption or adjustment changed the balance?

Every balance opens the item ledger. A stock number without a movement history is not sufficient.

### Production page inventory

| Page | Purpose | Primary action |
|---|---|---|
| Today's runs | Planned, ready, in-progress and recently posted work | Start production run |
| New run | BOM-based actual production capture | Review production impact |
| Production review | Variance, stock and costing preview | Post production run |
| Run detail/history | Full production record and audit trail | Open stock ledger / controlled correction |
| Materials & stock | Raw and packaging availability | View item ledger |
| Recipe/BOM reference | Read current recipe/version and units | View recipe; changes only for authorised master-data users |

---

# 4D. Accountant / Auditor journey

### Job to be done

The accountant or auditor needs to reconcile a selected period using posted source records and reproducible exports. This persona is read-only by policy.

### Entry and home experience: reporting home

**Recommended default destination:** `/reports/sales` or a dedicated `/reports` index, rather than `/invoices` as the only entry point. The invoice register remains one report/source view.

At the beginning of every report show:
- Report title and short definition.
- Period and selected filters.
- `Generated at` and `Data as of` timestamps.
- Scope/permissions applied.
- Whether the view contains posted transactions only.
- Export choices for CSV, XLSX and PDF when supported.

### Journey F-01: reconcile a month

1. Open Reports.
2. Select the financial/reporting period (default may be the current month, but it must be explicit).
3. Review the report index grouped by business area.
4. Open each required report: Sales register, GST outward summary, Purchase register, Stock summary/ledger, Production and variance, Collections, Receivables ageing, Audit trail.
5. Apply date and entity filters. Keep filters visible and reusable.
6. Inspect the report total and supporting rows.
7. Drill into a row to inspect the source invoice, receipt, dispatch, run, payment or movement.
8. Return to the report without losing filters.
9. Export the same filtered dataset shown on screen.
10. Record/download the generated export and verify its period and generated-at metadata.

### Report catalogue and expected content

| Report | Must answer | Drill-down target |
|---|---|---|
| Sales register | Invoice/date/customer/SKU/qty/taxable value/tax/total | Posted invoice |
| Customer-wise sales | Sales and invoice value by customer | Customer and invoices |
| Product-wise sales | Quantity and value by SKU/pack size | Product and invoice lines |
| GST outward summary | Taxable value and applicable tax components by period/rate/place of supply | Posted invoice and tax lines |
| Purchase register | Supplier, receipt, item, quantity, rate and value | Posted purchase receipt |
| Stock summary/valuation | Opening, receipts, issues, adjustments, closing and valuation | Item ledger |
| Stock ledger | Every movement with signed quantity, unit, source and running balance | Source document |
| Production & costing | BOM version, planned/actual consumption, output, damage, variance, direct costs and cost/good packet | Production run |
| Collections | Payment date, customer, mode, amount and allocations | Payment receipt and invoices |
| Receivables & ageing | Customer/invoice balances by ageing bucket | Customer ledger/invoice |
| Audit trail | Actor, timestamp, action, entity, reason and correlation reference | Source record where permitted |

### Journey F-02: investigate a discrepancy

- Start from the report total or exception.
- Drill to the source row.
- Inspect the linked stock movement, invoice line, receipt, production run or payment allocation.
- Follow the chain in both directions where possible: source document → ledger movement → current balance/report.
- The interface must preserve filter context and clearly distinguish posted, reversed and credited entries.

### Journey F-03: export and hand over

- Choose format from the current report, not a disconnected exports page that makes the user rebuild all filters.
- Export must use the same scoped query as the on-screen report.
- Include report name, period, filters, generated-at, data-as-of and source IDs where practical.
- Do not hide reversals, credit notes, adjustments, unallocated payments or other reconciling items.

**Primary action:** `Export report` from the report currently being inspected.

The Export History page may remain for previous asynchronous exports, but should be secondary under Reports & audit rather than a parallel primary navigation domain unless users have a real queue of export jobs to manage.

---

# 4E. Owner journey

### Job to be done

The owner needs a reliable, current view of business health and exceptions, with the ability to move from a metric to the underlying records. They are not expected to enter every transaction.

### Entry and home experience: business overview

**Default workspace:** `/dashboard` for OWNER.

The page should tell the owner:
- What has happened today / in the selected period?
- What is at risk or needs a decision?
- Is the factory producing close to plan?
- Is finished stock sufficient for accepted orders?
- What is the approximate cost and margin per packet?
- How much money is outstanding and overdue?

Recommended page hierarchy:

1. **Business period and freshness:** date range, `Data as of`, last successful refresh.
2. **Operational summary:** orders received/approved/dispatched, production output, stock position.
3. **Needs attention:** shortages, production variance, overdue receivables, dispatch backlog, failed syncs.
4. **Cost and margin:** cost per good packet, selling price/margin by product, with valuation method and limitations available.
5. **Receivables:** total due and ageing buckets with customer drill-down.
6. **Recent events:** posted transactions and exceptions in chronological order.

Avoid decorative card sprawl. Choose the few figures that drive decisions, then provide compact tables/lists for the underlying work.

### Journey O-01: investigate a business exception

1. Owner opens `Needs attention`.
2. Selects one exception, for example a production yield variance or finished-stock shortage.
3. Opens the source run/order and inspects the actual numbers and operational impact.
4. Follows related records: production run, stock movement, order, invoice or payment.
5. Uses authorised communication/escalation outside the posting controls if an action belongs to Admin or Production.

### Journey O-02: understand margin and cash position

1. Select the reporting period.
2. Inspect sales, collections, estimated/recorded costs and outstanding receivables.
3. Open product-level cost per good packet and its underlying run costs.
4. Open receivables ageing and inspect customers/invoices contributing to overdue amounts.
5. Export or open the relevant report if needed.

Every metric must be labelled correctly. Do not imply that a partial operational costing model is a fully accrued statutory P&L. Do not show trends without sufficient historical data.

**Primary action:** open the most important exception or drill into a metric; the owner does not receive transaction-posting buttons by default.

---

## 5. End-to-end cross-role hand-offs

The user experience must connect roles without forcing one role to perform another role's work.

| Stage | Responsible role | What they do | System hand-off / next owner |
|---|---|---|---|
| Customer demand | Salesman | Creates and submits order | Admin order inbox |
| Commercial review | Admin | Checks customer, price, quantity, tax context and ATP; approves/rejects | Approved order and stock reservation, or rejection back to salesman |
| Billing | Admin | Posts GST invoice from approved order | Posted invoice and receivable; dispatch queue |
| Physical fulfilment | Admin | Posts actual dispatch quantity | Finished stock deducted; fulfilment status updated |
| Collection | Admin | Records payment and allocation | Customer/invoice outstanding recalculated; accountant/owner visibility updated |
| Material receipt | Admin or specifically authorised Production user | Posts supplier receipt | Raw/packaging stock and valuation updated; production availability refreshed |
| Production | Production Supervisor | Posts BOM-based actual run | Raw/packaging movements, finished stock receipt, cost and variance updated |
| Reconciliation | Accountant/Auditor | Reviews period reports and source records | Export-ready evidence; no transaction mutation |
| Oversight | Owner | Reviews business outcomes and exceptions | Escalation to role authorised to act |

### The system's responsibility at each hand-off

- Notify/indicate the next responsible queue.
- Preserve the source record and all relevant context.
- Show the event that has occurred and the event that has not yet occurred.
- Avoid asking the next user to re-enter data already captured.
- Keep each posted event immutable and traceable.

---

## 6. Target page map and route implications

The following is the target page hierarchy. Keep existing routes where they are sound; add detail routes where the current UX relies on dialogs for deep work.

| Target destination | Existing route to retain/use | Suggested additions or adjustments |
|---|---|---|
| Role work queue | `/dashboard` for ADMIN/OWNER | Make dashboard role-aware only where permissions allow; keep owner and admin views distinct |
| Salesman home / My orders | `/orders` | Treat this as the seller's workspace; remove factory-wide presentation |
| New order | `/orders/new` | Dedicated page; never rely on a modal embedded in the list page |
| Order detail/review | `/orders` list currently | Add `/orders/:orderId` for status, review and source history |
| Invoice register | `/invoices` | Separate creation/review from immutable posted detail |
| Invoice detail | `/invoices` currently | Add `/invoices/:invoiceId` |
| Dispatch queue | `/dispatch` | Add `/dispatch/:dispatchId` and a dedicated dispatch preparation route if needed |
| Production today | `/production/today` | Keep as production home |
| New production run | `/production/new` | Dedicated wizard/workspace and distinct review-before-post step |
| Production history | `/production/history` | Add `/production/runs/:runId` detail |
| Purchases/receipts | `/purchases` | Add `/purchases/:receiptId`; move create receipt to dedicated page/drawer based on complexity (prefer page) |
| Stock overview | `/stock` | Item row opens `/stock/:itemId/ledger` or an equivalent deep-linked ledger view |
| Customers | `/customers` | Add `/customers/:customerId` with profile, assigned-salesman scope and permitted ledger summary |
| Products | `/products` | Add product/variant detail containing pack size, current price and BOM reference/version where authorised |
| Suppliers | `/suppliers` | Add `/suppliers/:supplierId` with receipt history; no finance write access for production role |
| Payments | `/payments` | Keep payment register and record-payment flow distinct from receivables analysis |
| Receivables | Current payment/report sections | Give customer balances/ageing a stable route such as `/receivables` or `/reports/receivables` |
| Reports | `/reports/*` | Keep each major report deep-linkable; add a report index if needed |
| Export history | `/exports` | Demote under Reports & audit; report exports should start from the report being viewed |
| Settings | `/settings` | Group setup by company/tax, users/roles, price rules and operational policies; permission-gate each section |

The route additions above are experience recommendations, not a claim that those routes already exist. Update route guards, breadcrumbs, deep links and tests together when implementing them.

---

## 7. Page-level primary action contract

A user should not have to guess which button represents the main action.

| Page / state | Primary action | Secondary actions |
|---|---|---|
| Salesman home | New order | Continue draft; view an order |
| New order | Review order | Save draft; cancel |
| Order review (salesman) | Submit order | Save draft; go back to edit |
| Order inbox | Review submitted order | Filter; refresh |
| Submitted order detail (admin) | Approve order | Reject; adjust quantity/price with reason |
| Approved order detail | Create invoice | View reservation; view customer |
| Invoice preparation | Post invoice | Return to order; correct missing master data |
| Posted invoice detail | Prepare dispatch | Download PDF; share; view order/payment history |
| Dispatch preparation | Post dispatch | Save draft; revise quantities |
| Posted dispatch detail | View fulfilment / record return | Download/print dispatch record |
| Purchase receipts | Receive materials | Search; view receipt |
| Purchase receipt review | Post receipt | Save draft; cancel |
| Today's production runs | Start production run | Open run; view material exception |
| Production run preparation | Review production impact | Save draft; return to edit |
| Production run review | Post production run | Return to edit |
| Posted production run | View stock impact | Open ledger; controlled correction |
| Stock overview | View item ledger | Filter; export |
| Payment register | Record payment | View receipt; allocate unallocated balance |
| Customer balances | Open customer ledger | Filter by ageing |
| Report page | Export current report | Change date/entity filters; drill down |
| Owner overview | Open highest-priority exception | Change period; open source report |

There must be only one visually dominant primary action per page state. If two actions are equally important, the page should present the user with a decision first, not two competing filled buttons.

---

## 8. Detail page structure: a reusable pattern

Every important record needs a consistent detail workspace.

### Header
- Record type and human-readable reference number.
- Current status and any separate fulfilment/financial state.
- Party/product/date context.
- One valid next action, based on role and record state.
- Breadcrumb back to the list, preserving filters.

### Main content
1. **Summary:** what this record represents and its current result.
2. **Lines / contents:** items, quantities, UOM, rate, tax/cost where relevant.
3. **Business impact:** stock, receivables, costing or variance effects.
4. **Linked records:** source/derived documents and related entities.
5. **Activity history:** who did what, when, and why.
6. **Documents:** PDF/attachments/export where relevant.

### Action area
- Only show actions the current user is authorised to perform in this state.
- Hide impossible actions; explain unavailable actions when the user needs to understand why.
- Posted records have no ordinary edit/delete action.
- Correction actions create linked history, never rewrite the original record.

---

## 9. Specific UX rules for the hardest workflows

### 9.1 Stock visibility

Every stock surface must distinguish:
- **On hand:** physical ledger balance.
- **Reserved:** stock committed to active approved orders.
- **Available to promise:** `on hand - active reservations`.

Show units and data-as-of time. A shortage must show exact requested quantity, ATP quantity and shortage quantity. Never make stock appear available by looking only at on-hand balance.

### 9.2 Production variance

Use explicit planned and actual columns, not only red/green badges. For every material:
- Planned quantity and unit.
- Actual consumed quantity and unit.
- Variance quantity.
- Variance percentage.
- Tolerance and whether it is exceeded.

For yield:
- Expected good output.
- Actual good output.
- Yield variance quantity and percentage.
- Rejected and damaged counts separately.

Explain the comparison denominator using the approved benchmark convention. The UI must not calculate a plausible-looking percentage using a different denominator.

### 9.3 Purchase receipt and valuation

Show entered unit, normalized base-unit equivalent, quantity, rate and receipt value. Before posting, explain how the receipt changes on-hand quantity and moving weighted-average cost. The stock ledger remains the source of truth.

### 9.4 Invoice and tax

Show tax components and the reason for intra-state/inter-state treatment. Use immutable snapshots for posted documents. Make missing GSTIN, HSN, place of supply, invoice series or tax configuration a blocking, actionable validation error where required.

### 9.5 Collections and outstanding

Show invoice total, credit notes, payments allocated, remaining outstanding and ageing where relevant. A payment may be partly unallocated. Explain where the unallocated amount remains and how it can be allocated later.

### 9.6 Returns and reversals

Do not place a generic `Undo` action on posted records. Use named correction flows:
- invoice correction → credit note;
- dispatch correction/return → linked return or reversal record;
- purchase correction → linked return, reversal or adjustment;
- production correction → controlled run reversal/correction;
- stock adjustment → reasoned, authorised adjustment document.

The original transaction remains visible.

---

## 10. Accessibility, device and performance expectations

These are mandatory quality conditions for the target experience, not optional polish.

### Accessibility
- WCAG 2.2 AA target.
- Semantic landmarks and correct heading order.
- Visible labels for all controls; descriptions and errors programmatically associated.
- Keyboard-operable navigation, dialogs, tables and menus.
- Visible focus indicator with sufficient contrast.
- Status communicated using text plus icon/shape, never colour alone.
- 44–48 px primary touch targets, especially production and salesman controls.
- Dialog traps focus while open, closes with Escape when safe, and returns focus to the invoking control.
- Screen-reader announcements for submit, post, sync, conflict and validation outcomes.
- Respect reduced motion and user text scaling.

### Mobile and floor use
- Salesman order entry designed for a phone and one-handed use where practical.
- Production data entry designed for a tablet or shared floor device, with large numeric fields and clear units.
- No tiny icon-only critical actions.
- Do not require precision drag/drop or hover to reveal an action.
- Keep the most frequent task near the top of the page.

### Low-bandwidth and resilience
- Minimise unnecessary network calls and large page payloads.
- Keep route/page geometry stable while data loads.
- Show cached vs current data clearly.
- Preserve drafts and queued orders locally where supported.
- Provide predictable retry and conflict recovery.
- Do not optimistically show a server-side posting as complete before the server confirms it.

---

## 11. Benchmark golden journey: the acceptance walkthrough

The benchmark must be runnable from the UI in the same order as the business story. This is the best end-to-end proof that the product journeys connect.

1. Admin posts a purchase receipt for **60 kg flour at ₹45/kg**.
2. Production opens Today's runs and starts one **Murukku 200 g** batch using the captured BOM.
3. Production records **40 kg flour, 10.5 L oil, 1.2 kg spice**, and packaging actuals.
4. Production records **188 good packets**, **6 damaged pouches**, **9 cartons**, **₹1,200 labour** and **₹600 gas/power**.
5. The run review shows **−6% yield variance** and **+5% oil consumption variance**, then posts the complete stock/cost transaction.
6. Salesman A creates and submits an order for **150 packets** for Retailer A in Tamil Nadu.
7. Admin reviews the order with ATP, approves it and sees the reservation.
8. Admin posts the GST invoice with **₹7,500 taxable value, ₹187.50 CGST and ₹187.50 SGST**, total **₹7,875**.
9. Admin prepares and posts dispatch for 150 packets. Finished stock becomes **88 packets**.
10. Salesman B submits an order for **120 packets** for Distributor B in Karnataka. The system explains the **32-packet shortage** and does not silently approve or invoice unavailable stock.
11. Admin records **₹4,000** from Retailer A and allocates it to the invoice. Outstanding becomes **₹3,875**.
12. Accountant opens the selected month's reports and exports sales, GST, purchase, stock, production, collection and receivables evidence.
13. Owner opens the overview and can navigate from each key figure/exception to its underlying record.

### Required benchmark figures to remain visible and traceable

| Result | Expected |
|---|---:|
| Flour closing balance | 120 kg |
| Oil closing balance | 19.5 L |
| Spice mix closing balance | 3.8 kg |
| Pouches closing balance | 306 pieces |
| Cartons closing balance | 21 pieces |
| Finished stock after production | 238 packets |
| Finished stock after dispatch | 88 packets |
| Yield variance | −6%, flagged |
| Oil variance | +5%, flagged |
| Retailer A invoice total | ₹7,875 |
| Retailer A outstanding after payment | ₹3,875 |
| Distributor B shortage | 32 packets |
| Production run total cost | ₹5,855 |
| Cost per good packet | approximately ₹31.14 |

The UI may present a simplified journey, but it must not simplify away these business events or their ledger effects.

---

## 12. What to fix first: redesign sequence

Do not start by restyling every card or rewriting every page independently. Fix the shared navigation and end-to-end transaction flow first.

### Phase 1 — Establish the journey skeleton

1. Agree on the five role workspaces and their landing pages.
2. Replace the current feature-first navigation with the role-specific work-oriented navigation in Section 2.
3. Create a consistent list → detail → next action pattern.
4. Make orders, invoices, dispatches, production runs and purchase receipts have stable detail destinations.
5. Move complex forms out of modals into dedicated pages/workspaces.

**Exit gate:** every role can explain where to start, what to do, and where the next step is without being shown the navigation.

### Phase 2 — Fix the two operational loops

1. Salesman: New order → review → submit → track.
2. Admin: order inbox → review → approve/reserve → invoice → dispatch.
3. Production: Today's runs → select BOM → enter actuals → review impact → post → inspect run.
4. Admin/authorised receiver: supplier receipt → review valuation → post.
5. Admin: payment → allocate → customer balance.

**Exit gate:** one normal benchmark transaction can be completed without searching unrelated modules or opening a chain of nested modals.

### Phase 3 — Complete read-only oversight

1. Build the accountant report index and stable report routes.
2. Standardise period/filter/freshness metadata.
3. Ensure every report row drills to a source record.
4. Make exports reproduce the currently visible filtered result.
5. Build the owner's business overview around exceptions and traceable metrics.

**Exit gate:** a user can reconcile a monthly report without re-entering filters or guessing what a number represents.

### Phase 4 — System-wide interaction consistency

1. Standardise detail pages, breadcrumbs and action placement.
2. Standardise dialogs, drawers, confirmations and toast usage.
3. Standardise empty/loading/error/offline/stale/conflict states.
4. Verify keyboard, screen reader, touch target and mobile reflow behavior.
5. Test weak network and mid-form failures.

**Exit gate:** users encounter the same interaction patterns across all modules and can recover safely from failures.

### Phase 5 — Evidence-based verification

Run the complete benchmark through each relevant role. Also test:
- salesman offline order replay and duplicate prevention;
- stale ATP and concurrent approval attempts;
- quantity/price override with mandatory reason;
- partial dispatch and fulfilment remainder;
- duplicate purchase receipt protection;
- production variance and atomic rollback;
- payment with multiple allocations and unallocated remainder;
- invoice credit note / posted-record correction;
- report filters and export equality;
- denied routes and denied API actions for every role.

Do not declare a page complete merely because it renders or its API returns data. A journey is complete only when the actor can finish the task, see the result, follow its consequences and recover from expected failures.

---

## 13. Acceptance criteria for the complete experience

### Navigation and discoverability
- [ ] Each role lands in a workspace that reflects its primary responsibility.
- [ ] No role sees irrelevant transactional navigation.
- [ ] Every important workflow has an obvious starting point.
- [ ] A record detail clearly identifies the next valid action.
- [ ] Breadcrumbs and Back preserve list context.
- [ ] Cross-module hand-offs are linked from the source record.

### Sales
- [ ] A repeat salesman order takes under 60 seconds in normal online conditions.
- [ ] Customer, price list, UOM and tax context are clear before submission.
- [ ] Draft, queued, server-accepted and approved states cannot be confused.
- [ ] Offline order data survives retry/reload and does not duplicate on sync.
- [ ] Salesman access remains restricted to assigned customers and own orders.

### Admin
- [ ] Admin can work from one prioritised queue.
- [ ] Approval shows ATP and exact shortage.
- [ ] Any quantity/price override retains the original quote and requires a reason.
- [ ] Invoice posting and dispatch posting are distinct actions.
- [ ] Payment entry visibly allocates to invoice(s) and shows any unallocated remainder.

### Production
- [ ] New run captures a fixed BOM/recipe version.
- [ ] Planned/actual, issued/consumed/returned/damaged, good/rejected output are distinct.
- [ ] Variance formulas, denominator, units and tolerance are explicit.
- [ ] Posting preview predicts the resulting stock and cost impact.
- [ ] Posted run detail links to each resulting stock movement.

### Accountant / Auditor
- [ ] Read-only permissions apply in UI and API.
- [ ] All required reports have period/filter/freshness metadata.
- [ ] Every material total can be drilled to source records.
- [ ] Exported output uses the same role scope and filters as the on-screen report.

### Owner
- [ ] Key metrics are labelled by period and data freshness.
- [ ] Exceptions have source links and a responsible next actor.
- [ ] Estimated/partial costing is not represented as statutory net profit.
- [ ] Owner permissions do not bypass the permission model.

### Shared interaction quality
- [ ] Long forms use pages/workspaces, not nested modals.
- [ ] There is one dominant primary action per page state.
- [ ] Important status and errors are not communicated by colour/toast alone.
- [ ] No content is hidden behind inaccessible hover-only actions.
- [ ] Layout reflows at 320 CSS px without ordinary page-level horizontal scrolling.
- [ ] Keyboard, screen-reader, reduced-motion and touch behavior are verified.
- [ ] Server-side failures preserve user input and explain the next safe action.

---

## 14. Decisions and open questions to preserve

The following are not reasons to stop the UX redesign, but they must remain explicit and must not be silently invented by the UI implementation:

1. **Partial approval policy:** are partial line approvals allowed, or must an order be fully approved/rejected? The UI should support only the agreed business rule.
2. **Invoice/dispatch eligibility:** the golden benchmark posts invoice before dispatch. Confirm whether production operations always require a posted invoice before a dispatch can be posted.
3. **Production issue model:** confirm whether materials are first issued to a run and later actual consumption/returns are recorded, or whether the current run posting records consumption directly. Do not label the same quantity as both issue and consumption.
4. **Production planning:** the benchmark and core flow do not require a full MRP/scheduling planner. Show production readiness and material shortages without implying planning functionality that is not implemented.
5. **Purchase receiving permissions:** production may receive materials only when explicitly authorised; finance and supplier-payment access remain separate.
6. **Customer and supplier master ownership:** define which role may create/edit masters and whether an admin approval is required for new records.
7. **BOM/price changes:** define who can publish a new effective version and whether approval is required. Historical orders/runs/invoices must retain snapshots.
8. **Owner action grants:** any owner write permission must be explicit and reflected in both the navigation and server authorization policy.
9. **Accounting meaning:** cost per good packet is a production cost metric under the documented weighted-average/direct-cost model; do not imply full business net profit unless all relevant overheads, expenses and accounting policies are modelled.
10. **Operational language:** validate floor terminology and Tamil translations with an actual Tamil-speaking production user.

---

## 15. Source documents this blueprint must remain aligned with

- `Problem_Statement_Winter_Internship_Application_2026.md`
- `docs/product-requirements.md`
- `docs/business-rules.md`
- `docs/authorization-matrix.md`
- `docs/ui-ux-spec.md`
- `docs/data-model.md`
- `docs/benchmark.md`
- `docs/assumptions.md`
- `docs/reporting-audit.md`
- `client/src/components/shell/nav-config.tsx`
- `client/src/lib/role-routing.ts`

When implemented, update the authoritative docs and route/permission tests alongside the UI. This blueprint should guide the experience, while the business rules, authorization matrix and data model remain authoritative for transaction correctness and access control.
