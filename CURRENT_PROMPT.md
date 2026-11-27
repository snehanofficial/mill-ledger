# Mill Ledger — Complete End-to-End Implementation, Remediation & Verification

## ROLE

Act as a Principal Software Architect, Senior Full-Stack Engineer, Manufacturing ERP Domain Specialist, Database Engineer, Security Engineer, and QA Automation Lead.

You are responsible for bringing the existing **Mill Ledger** application to a fully functional, production-quality state.

This is an existing project. Some functionality has already been implemented, but several workflows are incomplete, disconnected, logically incorrect, or inadequately tested.

Your responsibility is to **audit, verify, repair, implement, and validate every required business flow sequentially**.

Do not merely produce a plan, checklist, audit report, mockup, or recommendations. Execute the work in the repository.

---

# 1. PRIMARY OBJECTIVE

Implement and verify the complete Mill Ledger application using the following process:

1. Discover every requirement from the official project documentation.
2. Inspect the actual repository and identify the current implementation.
3. Verify existing functionality rather than assuming it works.
4. Classify every requirement as:
   - `PASS` — fully implemented and verified.
   - `PARTIAL` — exists but has missing functionality or incomplete integration.
   - `BROKEN` — exists but behaves incorrectly or violates business logic.
   - `MISSING` — not implemented.
   - `BLOCKED` — cannot be completed because of a genuine external dependency or unresolved requirement.
5. For `PASS`, preserve the implementation and move to the next requirement.
6. For `PARTIAL`, `BROKEN`, or `MISSING`, investigate and complete the implementation.
7. Verify the completed implementation through backend tests, database-level checks, and actual browser-based UI interactions.
8. Test cross-device, role-based, concurrency, offline, and business-rule edge cases.
9. Update the implementation tracker with evidence.
10. Automatically proceed to the next requirement.

**Continue until every requirement has been verified or a genuine blocker is documented. Do not stop after the initial audit or implementation plan.**

---

# 2. PROJECT DOCUMENTATION IS THE SOURCE OF TRUTH

Project directory:

`/home/snehan/projects/web/mill-ledger`

Before modifying anything, inspect:

- `Problem_Statement_Winter_Internship_Application_2026.md`
- `MASTER_PROJECT_PLAN.md`
- `docs/business-rules.md`
- `docs/assumptions.md`
- `docs/index.md`
- `AGENTS.md`, if present.
- All referenced architecture, database, API, implementation, testing, and feature documents.
- Existing implementation trackers and TODO/FIXME records.

Read the complete relevant content, not just introductory sections.

Inspect the actual codebase as well:

- Frontend routes, components, layouts, forms, hooks, state management, and API clients.
- Backend routes, services, controllers, validation, and authorization.
- Database schemas, constraints, indexes, migrations, and relations.
- Background jobs, synchronization logic, and integrations.
- Existing tests, test fixtures, and seed data.
- Environment configuration and development scripts.

### Requirement reconciliation

The official problem statement and documented business rules take precedence over assumptions or undocumented behavior.

The previously derived workflow specification should be used as an implementation checklist, but verify every important calculation and requirement against the original documents.

When documents disagree:

1. Identify the conflicting statements.
2. Locate the authoritative requirement.
3. Check the existing business rules and architecture.
4. Resolve the conflict using the documented source of truth.
5. Record the decision and its consequences.

Never silently invent business rules, statuses, calculations, or permissions.

---

# 3. NON-NEGOTIABLE IMPLEMENTATION RULES

## 3.1 Preserve existing working functionality

Do not rewrite the entire application simply because parts of it are poorly organized.

- Understand existing architecture before making changes.
- Preserve working modules.
- Reuse existing components and services where appropriate.
- Fix root causes rather than adding workarounds.
- Avoid duplicate implementations of the same business operation.
- Do not introduce unnecessary libraries or architectural complexity.
- Follow existing project conventions unless they create a demonstrable problem.

Before changes, inspect Git status and existing modifications. Never overwrite unrelated user work.

## 3.2 Complete vertical functionality

Every business feature must work across all relevant layers:

`Database → Backend validation → Authorization → Business service → API → Frontend API integration → UI interaction → Persisted result → Audit trail`

A feature is not complete when only some of these layers exist.

For every applicable operation, verify:

- Database persistence.
- Correct server-side validation.
- Correct business calculations.
- Server-side authorization.
- Correct success and failure responses.
- Correct frontend integration.
- Correct UI state after the operation.
- Correct audit and stock/financial records.
- Correct behavior after page refresh and across devices.

## 3.3 No fake functionality

Never use:

- Hardcoded UI values pretending to be live data.
- Mock APIs in production application flows.
- Fake success notifications.
- Buttons without working actions.
- Forms that do not persist data.
- Placeholder CRUD operations.
- Client-only authorization.
- In-memory substitutes for persistent business operations.
- Silent fallbacks that conceal server errors.
- Fake offline synchronization.
- Artificially passing tests by weakening assertions.

Every action displayed in the UI must perform its actual intended operation.

## 3.4 Data integrity and historical correctness

- Posted business transactions must be immutable.
- Correct posted transactions through linked reversals, adjustments, returns, or credit notes.
- Never hard-delete master records referenced by posted transactions.
- Preserve transaction snapshots of names, prices, taxes, HSN, UOM, and other relevant historical values.
- Use proper database transactions for multi-record operations.
- Prevent negative inventory and double reservations.
- Enforce idempotency for retryable posting and synchronization operations.
- Do not trust client-supplied prices, totals, authorization decisions, stock balances, or tax calculations.

---

# 4. IMPLEMENTATION WORKFLOW — FOLLOW SEQUENTIALLY

For every individual feature and business flow, execute the following cycle.

### Step A — Understand

Document the expected behavior from the official requirement.

Identify:

- User roles involved.
- Preconditions.
- Inputs and validation.
- State transitions.
- Database entities.
- Backend endpoints and services.
- Frontend screens and interactions.
- Business calculations.
- Success and failure outcomes.
- Related audit, inventory, and financial effects.

### Step B — Inspect

Search the codebase for the existing implementation.

Trace the full flow from the UI to the database and back.

Do not mark a feature complete merely because matching filenames, routes, tables, or components exist.

### Step C — Verify existing behavior

Before changing an existing feature:

1. Start the application.
2. Access the actual screen through the browser.
3. Perform the intended operation.
4. Verify the API request and response.
5. Verify the persisted database state.
6. Check related records and calculations.
7. Test invalid inputs and unauthorized access.
8. Check whether the UI correctly reflects the result.

### Step D — Remediate

If anything is missing or incorrect:

- Identify the underlying cause.
- Form a small implementation plan.
- Implement the complete vertical slice.
- Add or update migrations safely.
- Add necessary server-side validations and constraints.
- Connect the API to the actual UI.
- Implement loading, error, success, empty, and confirmation states.
- Add relevant automated tests.

### Step E — Verify

Run:

- Unit tests.
- Backend integration tests.
- Database and transaction tests.
- API authorization tests.
- Browser-based end-to-end tests.
- Relevant regression tests.
- Cross-device and multi-session tests.

Do not mark the feature complete until its expected behavior has been demonstrated.

### Step F — Record and continue

Update the tracker with:

- Requirement ID.
- Previous status.
- Final status.
- Files changed.
- API/database changes.
- Tests executed.
- Browser verification evidence.
- Remaining limitations, if any.

Then immediately move to the next requirement.

**Do not wait for manual approval between ordinary implementation tasks. Do not repeatedly ask whether to continue.**

---

# 5. COMPLETE FEATURE AND BUSINESS-FLOW SCOPE

Audit and complete every applicable requirement below. Also discover additional requirements from the official documents rather than treating this checklist as exhaustive.

## MODULE 1 — Authentication, Users and Access Control

Verify complete authentication and session handling.

### User management

Implement and test:

- Create users.
- View users.
- Update user details.
- Assign and change roles.
- Activate and deactivate accounts.
- Manage facility and organization scope.
- View user activity where required.
- Handle account and session invalidation.
- Protect shared-device sessions.

### Required roles

- `SALESMAN`
- `ADMIN`
- `PRODUCTION`
- `ACCOUNTANT`
- `OWNER`

### Authorization

Implement server-side RBAC and ABAC.

Verify that:

- Salesmen can only access their authorized customers and orders.
- Production users can access permitted production operations.
- Administrators can perform authorized operational functions.
- Accountants have strictly read-only access.
- Owners have the appropriate organization-level visibility.
- Users cannot bypass restrictions through direct API requests.
- Organization and facility boundaries are enforced.
- Deactivated users cannot continue operating through stale sessions.
- Shared-device logout does not expose previous user data.

Test every relevant role against both permitted and forbidden operations.

## MODULE 2 — Salesman and Customer Assignments

Implement complete assignment management.

Support:

- Assign customer to salesman.
- Change assignment.
- Unassign customer.
- Effective start and end dates.
- Assignment history.
- Validation of overlapping or invalid assignment periods.
- Authorization based on the effective assignment period.

Verify that mobile customer lists and offline synchronization only contain currently authorized customers.

Historical orders must remain accessible according to their authorization rules even after an assignment changes.

## MODULE 3 — Suppliers and Customers

Implement complete CRUD for both entities.

### Suppliers

Include:

- Supplier code.
- Name.
- Phone.
- Address.
- State code.
- GSTIN.
- Active status.

### Customers

Include:

- Customer code.
- Name.
- Customer kind: `RETAILER` or `DISTRIBUTOR`.
- Phone.
- Billing address.
- Delivery address.
- State code.
- Optional GSTIN.
- Active status.

Verify:

- Unique codes.
- Correct GSTIN and state-code validation.
- Required field validation.
- Duplicate handling.
- Search, filtering, sorting, pagination.
- Create, view, edit, deactivate, and restore where allowed.
- Referenced transaction history remains intact.

## MODULE 4 — Inventory Items, Units and Conversions

Implement complete inventory master management.

Item categories:

- `RAW`
- `PACKAGING`
- `FINISHED`
- Optional `WIP` if required by the specification.

Verify:

- Item creation and editing.
- Categories and status.
- Base UOM configuration.
- Dimensional validation.
- Explicit item-specific conversions.
- Accurate quantity normalization.
- Precision and rounding rules.
- Invalid conversion rejection.

For example:

- kg ↔ g.
- L ↔ ml.
- Pack-specific carton-to-packet conversions.

Do not apply pack-specific conversions globally to unrelated inventory items.

## MODULE 5 — Products, Variants and Price Lists

Implement:

- Product family CRUD.
- Product variant/SKU CRUD.
- Finished inventory item association.
- HSN code.
- Effective-dated tax category.
- Versioned price lists.
- Effective date ranges.
- Customer-specific price overrides where supported.
- Price history.
- Search and filtering.

Verify:

- Each sellable variant maps correctly to finished inventory.
- Expired price lists cannot accidentally override current prices.
- Effective dates are respected.
- Historical orders and invoices retain their original prices.
- New prices do not mutate posted transactions.
- Concurrent price changes do not corrupt order calculations.

## MODULE 6 — Recipes, BOM and Production Specifications

Keep ingredient formulation separate from packaging configuration.

### Recipes

Implement:

- Recipe CRUD.
- Recipe versions.
- Ingredient lines.
- Quantities and UOM.
- Version activation and archival.

### Production specifications

Implement:

- Variant-specific production specifications.
- Recipe-version association.
- Production batch quantities.
- Packaging lines.
- Expected yield.
- Carton and packet relationships.

Verify that:

- A production run locks the relevant recipe and specification versions.
- Updating a recipe does not change existing production runs.
- Multiple product variants can reuse an appropriate recipe without duplicating ingredient formulations.
- Invalid or inactive versions cannot be used for new production.

## MODULE 7 — Purchase Receipts and Raw Material Inward

Implement the complete purchase receipt workflow.

Required operations:

1. Select supplier.
2. Select inventory item.
3. Enter receipt quantity.
4. Select UOM.
5. Enter unit rate.
6. Enter supplier reference.
7. Enter receipt date.
8. Validate input.
9. Preview relevant totals.
10. Post receipt.
11. Verify inventory and costing changes.

### Posting requirements

The posting operation must atomically:

- Create the purchase receipt record.
- Normalize quantity to base UOM.
- Append positive stock movements.
- Update inventory balances.
- Recalculate moving weighted-average cost.
- Create audit records.

Formula:

`New Average Cost = ((Old Quantity × Old Average Cost) + (Received Quantity × Receipt Rate)) / (Old Quantity + Received Quantity)`

Verify zero-stock and zero-quantity cases, precision, invalid values, concurrent receipts, duplicate submission, and idempotent retries.

Posted receipts cannot be silently edited or deleted. Corrections must use appropriate reversals or adjustments.

## MODULE 8 — Production Run Lifecycle

Implement the complete state machine:

`DRAFT → READY_TO_POST → POSTED`

### Production setup

- Select product variant.
- Select valid production specification.
- Lock the applicable recipe and specification versions.
- Enter production batch details.
- Calculate planned ingredient requirements.
- Calculate planned packaging requirements.

### Stock availability

Show:

- Required quantity.
- Available stock.
- Planned issue quantity.
- Shortage quantity.

Prevent posting when required stock is unavailable.

### Actual production entry

Support distinct quantities for:

- Issued.
- Consumed.
- Returned unused.
- Damaged or scrapped.
- Good output.
- Rejected output.

Never mix these quantities into one generic field.

### Packaging reconciliation

Track actual packaging consumption and packaging capacity.

If packaging capacity does not match the good output, display a meaningful warning and follow the documented business policy.

### Variance calculations

Compare planned and actual quantities.

`Variance % = ((Actual − Planned) / Planned) × 100`

Support tolerances and meaningful warnings.

Test:

- Yield variance.
- Ingredient consumption variance.
- Packaging variance.
- Zero planned quantity.
- Excess consumption.
- Rejected output.
- Damaged material.
- Returned unused stock.

### Costing

Include:

- Material cost.
- Packaging cost.
- Direct labour.
- Gas and power.
- Other permitted overheads.
- Total production cost.
- Actual good output.
- Cost per good packet.
- Variance and gross contribution.

Cost per packet must use actual good output, not planned output.

### Atomic production posting

One database transaction must:

- Deduct consumed materials.
- Deduct damaged/scrapped materials where applicable.
- Return unused issued materials.
- Add finished-goods output.
- Record rejected output appropriately.
- Record stock movements.
- Update inventory projections.
- Store cost and variance snapshots.
- Create the audit record.

Prevent duplicate production posting.

Corrections must use a linked production-run reversal or other documented correction mechanism.

## MODULE 9 — Salesman Mobile Ordering and Offline Synchronization

Verify the complete real mobile workflow.

### Order creation

Salesman should be able to:

- Select an assigned customer.
- View authorized product variants.
- View cached prices and availability information where permitted.
- Add and remove order items.
- Edit quantities.
- View order totals.
- Save a draft.
- Submit the order.
- View order status and reasons for rejection/conflict.

### Offline support

Use the project's existing offline architecture.

The local order must have:

- Client-generated UUID.
- Idempotency key.
- Local creation metadata.
- Clearly defined synchronization state.

Example:

`LOCAL_DRAFT → QUEUED → SERVER_ACCEPTED`

Conflict and failure states must be explicit.

Never display an offline queued order as server-accepted, approved, or stock-reserved.

### Synchronization

Verify:

- Automatic synchronization on appropriate app lifecycle events.
- Manual retry.
- Reconnect handling.
- Interrupted synchronization.
- Duplicate delivery.
- Multiple queued orders.
- Server restart during sync.
- Price changes while offline.
- Customer reassignment.
- Inactive customer or product.
- Unauthorized order submission.
- Server-side authoritative price validation.
- Conflict resolution with an actionable reason.

The server must remain the source of truth.

A client must never independently declare an order approved or stock reserved.

## MODULE 10 — Admin Order Review, Approval and Reservations

Implement the complete workflow:

`DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED | REJECTED → CLOSED`

Support the documented additional states for partial fulfilment and backorders.

### Admin review

Show:

- Original salesman quote.
- Current applicable price.
- Customer.
- Salesman.
- Ordered variants.
- Requested quantities.
- Available stock.
- Active reservations.
- Available-to-promise quantity.
- Differences between quoted and revised values.

If an administrator changes quantity or price:

- Preserve the original quote.
- Record the updated value.
- Require a valid reason.
- Record the actor and timestamp.

### Approval

Approval must atomically verify available inventory and create stock reservations.

Prevent concurrent administrators from reserving the same stock.

### Shortage handling

Support the documented policies:

- Hold/backorder.
- Reject with mandatory reason.
- Explicit partial approval.

Never silently approve the full requested quantity when only part of it is available.

Never allow negative stock or reservation totals beyond available stock.

Verify stale approval screens, concurrent approvals, duplicate clicks, expired reservations, rejection, reopening where permitted, and cancellation.

## MODULE 11 — GST Invoicing and Credit Notes

Implement complete invoicing.

Workflow:

`DRAFT → POSTED → CREDITED`

### Invoice generation

Invoices must be generated from eligible approved orders.

Include all required snapshot information:

- Invoice number.
- Financial year.
- Customer information.
- Billing and delivery details.
- GSTIN where applicable.
- HSN.
- Product details.
- Quantity.
- Unit price.
- Discounts, if permitted.
- Taxable amount.
- Tax rate.
- CGST/SGST or IGST.
- Rounding.
- Grand total.

### Tax calculation

For the documented Tamil Nadu factory example:

Intra-state supply:

- CGST: 2.5%.
- SGST: 2.5%.

Inter-state supply:

- IGST: 5%.

Implement tax selection using the documented Place of Supply rules and applicable tax configuration. Do not hardcode all customers to Tamil Nadu.

Verify taxable amount, tax rounding, line-level versus invoice-level rounding, zero values, invalid GST data, and effective tax rates.

### Financial-year numbering

Verify:

- Unique consecutive numbering under concurrency.
- Correct financial-year boundaries.
- No accidental duplicate numbers.
- No changes to already posted invoice identifiers.

### PDF and delivery

Generate a correct downloadable, printable invoice PDF.

Test:

- Layout and page breaks.
- All line items.
- Customer and supplier details.
- Tax breakup.
- Totals.
- Long names and addresses.
- Large invoices.
- Mobile PDF viewing.

Implement supported sharing/delivery mechanisms, such as WhatsApp sharing links or email integration, only where the project requirements and available integrations support them.

### Credit notes

Posted invoices must never be edited or deleted.

Implement linked credit notes and the documented return/correction workflow.

Verify partial and full credit notes, cumulative credited quantities and values, tax reversal, and outstanding balance recalculation.

## MODULE 12 — Dispatch and Fulfilment

Implement separate dispatch management.

Workflow:

`DRAFT → POSTED`

Fulfilment status:

`UNFULFILLED → PARTIALLY_FULFILLED → FULFILLED`

Support:

- Create dispatch.
- Select approved order.
- Select items and quantities.
- Partial dispatch.
- Multiple dispatches against one order.
- Dispatch history.
- Delivery details.
- Posting and appropriate status updates.

Atomic posting must:

- Create the dispatch record.
- Deduct finished-goods stock.
- Create negative stock movements.
- Release the matching reservations.
- Update fulfilled and remaining quantities.
- Update order fulfilment status.
- Create audit records.

Prevent dispatch quantities beyond the authorized unfulfilled order quantity or available reservation.

Verify repeated dispatches, partial dispatches, cancellation rules, and concurrent dispatch attempts.

## MODULE 13 — Payments, Allocations and Receivables

Implement:

- Payment recording.
- Payment date.
- Payment mode.
- Reference number.
- Customer association.
- Multiple invoice allocations.
- Partial payments.
- Unallocated advances.
- Payment allocation history.
- Appropriate reversal/correction operations.

Outstanding must be derived:

`Outstanding = Posted Invoices − Credit Notes − Allocated Payments`

Implement receivables ageing using the documented date basis and buckets.

Verify:

- Partial payment.
- Full payment.
- Advance payment.
- Multiple invoice allocation.
- Over-allocation prevention.
- Payment reversal.
- Credit note after payment.
- Duplicate payment submission.
- Correct customer balance.
- Correct ageing after allocations and reversals.

Never allow manual editing of derived outstanding balances.

## MODULE 14 — Stock Ledger and Inventory Reconciliation

The stock ledger is a core source of transactional history.

Every relevant stock operation must create an immutable movement linked to its source document.

Cover:

- Purchase receipts.
- Production issues.
- Production returns.
- Damaged or scrapped materials.
- Rejected production output where applicable.
- Finished-goods production.
- Dispatches.
- Customer returns.
- Approved adjustments.
- Reversals.

Validate:

`Inventory Balance = Sum of All Applicable Stock Movements`

Verify:

- Item-wise balances.
- Location/facility scope where applicable.
- Movement direction.
- UOM normalization.
- Reference-document traceability.
- Correct transaction ordering.
- Reconciliation after reversals.
- No duplicate movements.
- No missing movements.
- No negative stock unless explicitly permitted by documented policy.

Inventory balances are projections. Never allow manual editing to conceal discrepancies in the ledger.

Add reconciliation detection and an appropriate correction process.

## MODULE 15 — Audit Trail

Implement append-only audit logs for all important business actions.

Capture the required information:

- Actor.
- Timestamp.
- Action.
- Entity type and ID.
- Request or correlation ID.
- Reason.
- Before and after summaries where applicable.

Cover:

- Master-data changes.
- Assignments.
- Authorization-sensitive actions.
- Posting.
- Approval and rejection.
- Price overrides.
- Production adjustments.
- Reversals.
- Credit notes.
- Payments.
- Exports.
- Other significant business changes.

Verify that:

- Users cannot modify or delete historical audit logs through ordinary application APIs.
- Audit records are created atomically with relevant business operations.
- Failed operations do not create misleading success audit entries.
- Sensitive credentials and secrets are never recorded.
- The audit interface respects access permissions.

## MODULE 16 — Accountant, Owner and Operational Reports

Implement and verify all reports required by the official specification.

At minimum, audit:

1. Sales Register.
2. Customer-wise Sales.
3. Product-wise Sales.
4. GST Outward Summary.
5. Purchase Register.
6. Stock Summary.
7. Stock Ledger.
8. Production Report.
9. Material Variance Report.
10. Production Costing Report.
11. Collections Report.
12. Receivables Ageing.

Every report must:

- Use real persisted data.
- Apply date filters correctly.
- Apply organization and role restrictions.
- Support pagination or appropriate large-data handling.
- Calculate totals consistently with source transactions.
- Handle empty periods.
- Handle invalid filter combinations.
- Use a clearly defined reporting date basis.

### Export

Implement the required CSV, XLSX, and PDF exports.

Test exported content against the visible report and underlying database records.

Where Tally-compatible export is part of the specification or accepted scope, implement the appropriate XML/Excel output from posted transactions. Tally must not become a dependency for ordinary daily operations.

## MODULE 17 — Owner Cockpit and Operational Dashboards

Ensure dashboards display meaningful, accurate information derived from persisted business records.

Verify:

- Inventory status.
- Production activity.
- Production cost and variance.
- Order activity.
- Dispatch fulfilment.
- Revenue and collections.
- Outstanding receivables.
- Relevant alerts and shortages.

Every displayed total must reconcile with its underlying report.

Do not use random demo figures or independently calculated frontend values.

---

# 6. MANDATORY END-TO-END BENCHMARK SCENARIO

Run the exact benchmark sequence from section 5 of the official problem statement.

Do not merely test isolated calculations. Execute the complete business journey through the actual application wherever possible.

Use the documented opening balances, rates, transactions, dates, and quantities.

Expected results from the current benchmark specification:

| Item | Expected result |
|---|---:|
| Flour | 100 + 60 − 40 = 120 kg |
| Flour weighted-average cost | ₹43.125/kg |
| Oil | 30 − 10.5 = 19.5 L |
| Oil consumption variance | +5% |
| Spice mix | 5 − 1.2 = 3.8 kg |
| Pouches | 500 − 188 − 6 = 306 pieces |
| Damaged pouches | 6 pieces |
| Cartons | 30 − 9 = 21 pieces |
| Finished goods before dispatch | 50 + 188 = 238 packets |
| Finished goods after dispatch | 88 packets |
| Production good output | 188 packets |
| Yield variance | −6% |
| Packaging capacity mismatch | 8 packets, warning |
| Total production material/packaging cost | ₹4,055 |
| Overheads | ₹1,800 |
| Total run cost | ₹5,855 |
| Cost per good packet | ₹31.14 |
| Gross contribution per packet | ₹18.86 |
| Retailer A taxable amount | ₹7,500 |
| CGST | ₹187.50 |
| SGST | ₹187.50 |
| Retailer A invoice total | ₹7,875 |
| Retailer A payment | ₹4,000 |
| Retailer A outstanding | ₹3,875 |
| Distributor B requested quantity | 120 packets |
| Distributor B available stock | 88 packets |
| Distributor B shortage | 32 packets |

The benchmark must demonstrate the entire chain:

Purchase receipts → stock updates → production → variance and costing → finished-goods inventory → salesman order → admin approval → reservation → invoice → dispatch → payment → outstanding → reports.

Also verify that the accountant and owner views reconcile with the same transactions.

**Important:** Cross-check every expected value against the original official scenario. If the source documents contain a discrepancy, do not force an incorrect value into the application. Record the discrepancy, resolve it according to the official requirements, and document the verified expected result.

Use isolated test data and repeatable fixtures. Never corrupt or reset actual user data to execute the benchmark.

---

# 7. BACKEND AND DATABASE EDGE-CASE VERIFICATION

Do not limit verification to happy-path tests.

For every important endpoint and business transaction, test:

### Validation

- Missing fields.
- Null values.
- Empty strings.
- Wrong types.
- Negative quantities.
- Zero quantities.
- Very large quantities.
- Decimal precision.
- Invalid dates.
- Invalid UOM combinations.
- Inactive master records.
- Invalid state transitions.
- Duplicate codes.
- Invalid foreign references.
- Invalid monetary values.

### Authorization

- Unauthenticated request.
- Wrong role.
- Wrong customer assignment.
- Wrong organization.
- Wrong facility.
- Direct endpoint access bypassing the UI.
- Deactivated user.
- Expired or invalid session.
- Access to another user's records.

### Transaction integrity

- Duplicate submission.
- Request retry.
- Network timeout.
- Partial failure.
- Database transaction rollback.
- Concurrent requests.
- Stale reads.
- Simultaneous approvals.
- Simultaneous dispatches.
- Simultaneous receipts.
- Duplicate payment allocations.
- Duplicate offline synchronization.

### Financial and stock correctness

- Never allow unexplained negative balances.
- Prevent duplicate stock movements.
- Prevent duplicate reservation creation.
- Prevent double payment allocation.
- Ensure totals reconcile.
- Ensure reversals restore the correct state.
- Ensure historical snapshots remain unchanged.
- Verify rounding at each relevant calculation boundary.

Use database constraints and transaction isolation where appropriate instead of relying entirely on application-level checks.

---

# 8. ACTUAL BROWSER-BASED UI VERIFICATION

This is mandatory.

Use the available browser automation/browser interaction tools to operate the running application as a real user.

Do not claim browser verification based only on component inspection, screenshots of static pages, API tests, or successful compilation.

For every major flow:

1. Open the relevant route.
2. Log in as the correct role.
3. Navigate through the normal user journey.
4. Fill real forms.
5. Submit real operations.
6. Verify loading and response states.
7. Inspect the resulting records.
8. Refresh the page.
9. Navigate away and return.
10. Confirm persisted data and status.
11. Check related views from other authorized roles.

Test both successful and unsuccessful interactions.

### Mandatory UI states

Every applicable screen must have correct:

- Initial state.
- Loading state.
- Empty state.
- Success state.
- Validation errors.
- Server errors.
- Permission-denied state.
- Network-error state.
- Retry state.
- Confirmation state.
- Disabled state.
- Long-data state.
- Pagination and filtering state.

Forms must provide field-level errors and meaningful feedback.

Dangerous actions must have appropriate confirmation and clear consequences.

Prevent accidental duplicate submissions.

No dead buttons, broken navigation, blank screens, browser console errors, unhandled exceptions, or misleading notifications.

---

# 9. MULTI-DEVICE AND RESPONSIVE VERIFICATION

Test the actual application in multiple browser viewports and independent user sessions.

### Minimum viewport matrix

| Device class | Example viewport |
|---|---|
| Small mobile | 360 × 800 |
| Standard mobile | 390 × 844 |
| Large mobile | 430 × 932 |
| Tablet | 768 × 1024 |
| Small laptop | 1280 × 800 |
| Desktop | 1440 × 900 |

Also test portrait and landscape where relevant.

### Role/device scenarios

- Salesman using mobile.
- Administrator using desktop.
- Production supervisor using tablet.
- Accountant using desktop.
- Owner using desktop and mobile.
- Same user accessing the application in multiple sessions where applicable.

### Cross-device consistency

Verify that:

- An order submitted on mobile appears correctly in the admin interface.
- An admin approval is reflected in the salesman's view.
- Production posting updates inventory across relevant views.
- Dispatch changes the correct fulfilment status everywhere.
- Payments update the outstanding balance consistently.
- Changes survive refresh and session changes.
- Offline changes do not create false server-side statuses.
- A user cannot see another user's private cached information after logout or account switching.

Test simultaneous sessions, stale page data, concurrent edits, and race conditions.

### UI/UX quality requirements

Follow the project's UX requirements and use established usability/accessibility principles.

- Responsive layouts without accidental horizontal overflow.
- Persistent space for scrollbars to avoid layout shifts where appropriate.
- Stable form layouts when validation messages appear.
- Consistent spacing, typography, and design tokens.
- Clear visual hierarchy.
- Accessible form labels and errors.
- Keyboard navigation.
- Visible focus indicators.
- Semantic controls.
- WCAG 2.2 AA as the accessibility target.
- Minimum 44px touch targets where appropriate.
- Readable tables on small screens.
- Mobile-friendly action placement.
- Appropriate confirmation for irreversible operations.
- Helpful empty states instead of misleading blank screens.
- No unnecessary animations or distracting decoration.
- No layout shifts when data, errors, or notifications appear.

Use browser inspection to identify actual clipping, overflow, inaccessible controls, broken responsive tables, misaligned forms, and inconsistent interaction states.

Fix observed problems rather than merely reporting them.

---

# 10. AUTOMATED TESTING STRATEGY

Build on the project's existing testing architecture.

Do not introduce redundant testing frameworks without a clear reason.

Maintain distinct testing layers:

### Unit tests

Test isolated:

- Business calculations.
- Tax calculations.
- UOM conversions.
- Weighted-average costing.
- Variance calculations.
- Reservation calculations.
- Outstanding and ageing calculations.
- State transition rules.
- Validation functions.

### Integration tests

Test:

- Database persistence.
- Transaction atomicity.
- API-to-service integration.
- Authorization.
- Posting and reversal.
- Stock ledger updates.
- Financial allocation.
- Idempotency.
- Concurrency-sensitive operations.

### Browser end-to-end tests

Test actual business journeys and role-based behavior.

### Regression tests

Whenever a defect is found:

1. Reproduce it.
2. Add a test that fails before the fix.
3. Implement the correction.
4. Confirm that the new test passes.
5. Run related regression tests.

A successful build or typecheck alone does not establish correctness.

Do not weaken assertions or remove failing tests simply to achieve a green test suite.

---

# 11. SECURITY, PRIVACY AND OPERATIONAL RELIABILITY

Verify:

- Server-side authorization for every protected operation.
- Organization and facility isolation.
- Safe session management.
- Secure handling of secrets.
- Strict input validation.
- Safe file upload/download handling.
- Protection against mass assignment.
- Correct error handling.
- No sensitive information in logs.
- No unprotected financial or inventory endpoints.
- No unauthorized access through guessed resource IDs.
- Appropriate CSRF/CORS protections for the actual authentication architecture.
- Database indexes and constraints for critical queries.
- Safe pagination and query limits.
- No N+1 query problems on major operational screens.
- No accidental data loss during migrations.
- No uncontrolled background job duplication.

The application must not crash because of an ordinary invalid input, network interruption, missing optional data, or unexpected server response.

Handle failures gracefully on both client and server.

---

# 12. PERFORMANCE AND STABILITY

Inspect actual application behavior.

Verify:

- Pages load with appropriate loading states.
- Lists and tables do not fetch unbounded records.
- Large datasets use pagination or appropriate filtering.
- Search and filtering remain responsive.
- Repeated navigation does not leak state or duplicate requests unnecessarily.
- Mobile screens remain usable on slower connections.
- Offline workflows remain consistent.
- API failures do not corrupt client state.
- Server failures do not leave transactions partially posted.
- Long-running reports and exports do not freeze the UI.

Use evidence from browser/network inspection and backend profiling where needed.

Avoid arbitrary optimization without measurements or a demonstrated problem.

---

# 13. IMPLEMENTATION TRACKER

Maintain a single authoritative tracker in the project's documentation.

Each individual requirement must include:

| Field | Description |
|---|---|
| ID | Unique requirement identifier |
| Module | Business module |
| Requirement | Expected behavior |
| Initial status | PASS / PARTIAL / BROKEN / MISSING / BLOCKED |
| Root cause | Explanation of any defect |
| Implementation | What was changed |
| Backend verification | Tests and results |
| Database verification | Persistence/integrity evidence |
| Browser verification | Actual UI verification |
| Device verification | Tested viewports/sessions |
| Regression verification | Related tests |
| Final status | PASS / BLOCKED |
| Evidence | Test names, routes, logs, or screenshots where available |

Maintain a separate list of:

- Critical defects.
- Security issues.
- Data-integrity issues.
- Deferred non-critical improvements.
- Genuine external blockers.

Do not mark a parent module as complete if any mandatory child requirement is incomplete.

---

# 14. DEFINITION OF DONE

A requirement can be marked `PASS` only when all applicable conditions are satisfied:

- The official requirement has been understood.
- Existing implementation has been inspected.
- The expected business behavior is correct.
- Database persistence is verified.
- Server-side validation is verified.
- Authorization is verified.
- API behavior is verified.
- The frontend uses the real backend functionality.
- Actual browser interaction succeeds.
- Error and empty states are correct.
- Relevant edge cases pass.
- Cross-device behavior is verified.
- Related regressions pass.
- Audit, stock, and financial records are correct where applicable.
- No known critical defect remains.

A feature must not be marked complete simply because its code exists.

A module must not be marked complete simply because its primary happy path works.

The overall application is complete only when every mandatory requirement has passed.

---

# 15. EXECUTION RULES — DO NOT STOP PREMATURELY

Follow this execution order:

1. Documentation and architecture audit.
2. Existing implementation inventory.
3. Authentication and authorization.
4. Master data and assignments.
5. Products, variants, prices, recipes, and BOM.
6. Purchase and inventory inward.
7. Production and costing.
8. Salesman mobile ordering and offline synchronization.
9. Admin order review, approval, and reservations.
10. GST invoicing and credit notes.
11. Dispatch and fulfilment.
12. Payments and receivables.
13. Stock ledger and reconciliation.
14. Audit logs.
15. Reports, exports, and dashboards.
16. Full benchmark scenario.
17. Cross-role, cross-device, security, concurrency, and regression testing.
18. Final full-application verification.

Adjust the order only when actual architectural dependencies require it. Document the reason.

### Critical execution instructions

- Do not stop after preparing the audit.
- Do not stop after identifying missing features.
- Do not ask for approval after each module.
- Do not skip a feature because a similar feature appears to exist.
- Do not rebuild already verified functionality unnecessarily.
- Do not mark untested behavior as complete.
- Do not replace browser verification with API tests.
- Do not replace backend tests with screenshots.
- Do not ignore failures in the browser console or network panel.
- Do not hide unresolved defects by changing the tracker status.
- Do not use fabricated data to claim real functionality.
- Do not perform destructive database operations without understanding their impact.
- Do not modify unrelated project functionality.
- Do not leave half-completed implementations when the next step is achievable.

When a browser tool or external dependency is unavailable, explicitly record the missing verification and continue with every other verification that is possible. Do not falsely claim it was performed.

When a genuine blocker occurs, isolate it, document the exact reason, and continue with independent requirements.

**Your job is to execute the entire remediation cycle in one continuous implementation pass, proceeding from one requirement to the next automatically.**

---

# 16. FINAL DELIVERY REPORT

After the implementation and verification pass, provide a factual report containing:

1. Overall completion percentage, based on individual requirements rather than broad module labels.
2. Requirements fully implemented and verified.
3. Requirements that were already working and preserved.
4. Requirements repaired.
5. Requirements newly implemented.
6. Critical business logic corrections.
7. Database migrations and schema changes.
8. API routes added or modified.
9. Frontend pages and workflows changed.
10. Automated test results, including passed and failed counts.
11. Browser-based verification results.
12. Device and viewport verification results.
13. Benchmark scenario results compared with expected values.
14. Security and authorization verification results.
15. Outstanding defects and genuine blockers.
16. Exact commands needed to start the application and execute the test suites.
17. Any environment variables or external dependencies still requiring configuration.

Include evidence for important claims. Distinguish between:

- Implemented.
- Automated-test verified.
- Browser verified.
- Cross-device verified.
- Not verified.

Never report 100% completion while mandatory requirements remain unverified.

## START NOW

Begin with repository and documentation inspection, followed by the implementation inventory.

Then execute the workflow sequentially.

**Do not return only an audit report or a proposed plan. Inspect, implement, test, verify, repair, and continue until the entire Mill Ledger application is complete.**