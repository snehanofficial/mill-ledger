# MillLedger Expected Behavior Specification (Phase 1)

**Document ID**: `SPEC-01`  
**Date**: 2026-11-19  
**Status**: ACTIVE BASELINE  
**Standard Compliance**: GEMINI.md Rules E1-E11, antislop core rules  
**Sources Cited**:
- **S1**: README.md ("Implemented Scope", "Documented Assumptions", and Section 5 Benchmark Specification)
- **S2**: Owner Verbatim Requirements (Suppliers/masters UI, lazy loading & image hash, accessible images+text, API request log & super admin master permission, UI scope reachability, anti-slop/SEO/validation)
- **S3**: Industry Standards:
  - WCAG 2.2 Level AA (cited by Success Criterion ID, e.g., SC 1.1.1, SC 1.4.3, SC 2.1.1, SC 2.5.8)
  - OWASP Top 10:2021 (cited by Category ID, e.g., A01:2021, A03:2021, A09:2021)
  - OWASP API Security Top 10:2023 (cited by ID, e.g., API1:2023, API3:2023, API5:2023)
  - OWASP Application Security Verification Standard (ASVS) v4.0.3 Level 2 (cited by Requirement ID, e.g., V4.1.1, V5.1.1, V11.1.5)
  - Nielsen Norman Group (NN/g) 10 Usability Heuristics (cited by heuristic #1 through #10)
  - Apple Human Interface Guidelines (HIG) Web Principles (Feedback, Consistency, Direct Manipulation, Aesthetic Integrity, User Control)

---

## 1. Domain: Master Data Management

### REQ-001: Supplier Master Full Lifecycle Management in UI
- **Statement**: The system must provide a complete user interface for managing Supplier master records (view, create, edit, deactivate/archive), allowing factory administrators to maintain supplier details, GSTIN, contact information, and state of supply without requiring database seeding or direct SQL intervention.
- **Source**: S1 (README "Master records: suppliers"), S2 ("Suppliers and every other master entity must be fully manageable in the UI (not only seeded)"), S3 (OWASP ASVS v4.0.3 V4.1.2).
- **Testable Acceptance Criteria**:
  - Given an authenticated Admin user on the `/suppliers` or master management UI route:
  - When the user submits a new supplier form with valid fields (legal name, GSTIN, state, address, phone):
  - Then the system commits the record to `supplier` table, assigns an organization foreign key, and displays the supplier in the list.
  - When an unauthenticated user or user with role `SALESMAN` attempts to access supplier creation API `POST /api/v1/inventory/suppliers`:
  - Then the API returns HTTP 403 Forbidden.
- **Verification Method**: Integration test (API authorization and validation) and E2E test (Admin UI CRUD workflow).

### REQ-002: Customer Master Full Lifecycle Management in UI
- **Statement**: The system must provide a full UI for managing Customer master records, including legal name, customer type (Retailer or Distributor), GSTIN, billing/shipping addresses, state of supply, and salesman territory assignments.
- **Source**: S1 (README "Master records: customers"), S2 ("Suppliers and every other master entity must be fully manageable in the UI (not only seeded)"), S3 (OWASP ASVS v4.0.3 V4.1.2).
- **Testable Acceptance Criteria**:
  - Given an Admin on `/customers`:
  - When the user adds a new customer with State "Karnataka" and type "DISTRIBUTOR":
  - Then the record is persisted with an active status, and Salesman assigned to that region can select the customer.
  - When a customer record has associated posted sales orders:
  - Then physical hard deletion is prohibited; soft archiving or deactivation is permitted.
- **Verification Method**: Integration test and E2E test.

### REQ-003: Raw Material and Packaging Item Master Management in UI
- **Statement**: The system must provide a complete UI for managing raw material items (e.g., Flour, Oil, Spice mix) and packaging items (e.g., 200g pouches, cartons), including base UOM, item category, HSN code, and reorder levels.
- **Source**: S1 (README "Master records: raw materials, packaging"), S2 ("Suppliers and every other master entity must be fully manageable in the UI"), S3 (OWASP ASVS v4.0.3 V11.1.1).
- **Testable Acceptance Criteria**:
  - Given an Admin navigating to the inventory master management screen:
  - When the user creates an inventory item with category `RAW_MATERIAL` and base UOM `kg`:
  - Then the item is saved with initial stock 0.0 and moving weighted average rate 0.0, ready for purchase receipt intake.
- **Verification Method**: Integration test and E2E test.

### REQ-004: Finished Goods Product and SKU Master Management in UI
- **Statement**: The system must provide a full UI for managing Finished Goods products and their SKU variants (e.g., Murukku 200g), including selling price before tax, applicable GST rate category, packaging configuration (carton capacity), and active BOM assignment.
- **Source**: S1 (README "Master records: finished goods"), S2 ("Suppliers and every other master entity must be fully manageable in the UI"), S3 (OWASP ASVS v4.0.3 V11.1.1).
- **Testable Acceptance Criteria**:
  - Given an Admin user:
  - When creating a product SKU "Murukku 200g" with selling price 50.00 and pack size 200g:
  - Then the product is created in `product` and `product_variant` tables and appears in product catalogues for salesmen.
- **Verification Method**: Integration test and E2E test.

### REQ-005: Bill of Materials (BOM) Recipe Versioned Master Management in UI
- **Statement**: The system must provide a full UI for authoring, editing, and versioning Bill of Materials (BOM) recipes, specifying exact ingredient quantities per batch (e.g., Flour 40kg, Oil 10L, Spices 1.2kg), expected finished goods yield (200 packets), and packaging requirements (200 pouches, 10 cartons).
- **Source**: S1 (README "Master records: BOM recipes", "Versioned BOM with ingredients and packaging"), S2 ("Suppliers and every other master entity must be fully manageable in the UI"), S3 (OWASP ASVS v4.0.3 V11.1.1).
- **Testable Acceptance Criteria**:
  - Given an Admin or Production Supervisor creating a BOM recipe:
  - When specifying components with fractional decimals and an expected batch output:
  - Then the system validates that all referenced item IDs exist, stores exact decimal ratios, and locks historical versions from modification once used in a posted production run.
- **Verification Method**: Unit test (BOM validation schema) and E2E test (BOM creation UI).

### REQ-006: Price List and Rate Schedule Management in UI
- **Statement**: The system must provide a UI for defining and maintaining price lists and customer-specific rate schedules with effective start and end dates.
- **Source**: S1 (README "Customer selection and effective price-list pricing"), S2 ("Suppliers and every other master entity must be fully manageable in the UI"), S3 (OWASP ASVS v4.0.3 V11.1.1).
- **Testable Acceptance Criteria**:
  - Given an active price list:
  - When an order line is created for a product:
  - Then the line item price automatically resolves to the rate specified in the active price list matching the customer assignment.
- **Verification Method**: Unit test and integration test.

### REQ-007: Unit of Measure (UOM) and Conversion Management in UI
- **Statement**: The system must support and manage standard units of measure (`kg`, `g`, `litre`, `ml`, `piece`, `packet`, `carton`) and their conversion rules in the UI.
- **Source**: S1 (README "Support kg/g, litre/ml, pieces, packets, and item-specific cartons"), S2 ("Suppliers and every other master entity must be fully manageable in the UI"), S3 (OWASP ASVS v4.0.3 V5.1.1).
- **Testable Acceptance Criteria**:
  - When a transaction issues 500g of an item whose base unit is kg:
  - Then the inventory ledger deduction converts 500g to 0.500 kg exactly without float precision loss.
- **Verification Method**: Unit test.

### REQ-008: Facility and Warehouse Multi-Location Management in UI
- **Statement**: The system must allow administrators to configure facilities (factories, mill floors) and distinct warehouses (raw store, packing store, finished goods room).
- **Source**: S1 (README "Separate raw, packaging, WIP, and finished-stock balances"), S2 ("Suppliers and every other master entity must be fully manageable in the UI").
- **Testable Acceptance Criteria**:
  - When stock movements are created:
  - Then each movement is bound to a specific facility and warehouse ID, preventing unassigned or orphaned stock.
- **Verification Method**: Integration test.

---

## 2. Domain: Inventory and Stock Movement Ledger

### REQ-009: Non-Overwritable Append-Only Stock Movements
- **Statement**: Inventory balances must never be updated by arbitrary overwrites. Every change to physical stock must be recorded as an append-only transaction in the `stock_movement` ledger with movement type, quantity, timestamp, actor, and source document reference.
- **Source**: S1 (README "Stock movements... Direct stock overwrites are strictly disallowed"), S3 (OWASP ASVS v4.0.3 V11.1.5).
- **Testable Acceptance Criteria**:
  - Given any stock change operation (purchase, consumption, production output, dispatch):
  - When executed:
  - Then an immutable row is appended to `stock_movement`.
  - When a user or API attempts to directly issue a SQL update against `inventory_item.currentStock`:
  - Then database triggers or repository encapsulation enforce that balances equal the sum of movements.
- **Verification Method**: Unit test and database integration test.

### REQ-010: Purchase Receipt Intake and Immediate Stock Increase
- **Statement**: When a factory admin posts a Purchase Receipt for materials received from a supplier, raw material or packaging stock must increment in the specified warehouse by the exact received quantity.
- **Source**: S1 (README "Purchase receipts and supplier records", "Step 1: Record purchase of 60 kg flour at ₹45/kg"), S3 (OWASP ASVS v4.0.3 V11.1.1).
- **Testable Acceptance Criteria**:
  - Given opening stock of 100 kg Flour:
  - When a purchase receipt of 60 kg Flour at 45.00/kg is posted via `POST /api/v1/inventory/purchase-receipts`:
  - Then stock balance increases to 120 kg (or 160 kg prior to production consumption), and a `PURCHASE_RECEIPT` movement row is logged.
- **Verification Method**: Integration test and Benchmark Runner verification.

### REQ-011: Atomic Moving Weighted Average Valuation Recalculation
- **Statement**: Upon posting a purchase receipt, the unit cost of the affected inventory item must be atomically recalculated using the moving weighted average formula: `new_average_cost = (old_qty * old_cost + received_qty * receipt_cost) / (old_qty + received_qty)`.
- **Source**: S1 (README "Moving Weighted Average Valuation: Stock valuation uses a moving weighted average. Purchases update the unit cost atomically"), S1 (Benchmark: 100kg @ ₹42 + 60kg @ ₹45 -> ₹43.125/kg).
- **Testable Acceptance Criteria**:
  - Given 100 kg Flour at 42.000/kg (value 4,200.00):
  - When 60 kg Flour is purchased at 45.000/kg (value 2,700.00):
  - Then total quantity becomes 160 kg, total valuation becomes 6,900.00, and unit cost updates to exactly 43.125/kg.
- **Verification Method**: Unit test and Benchmark assertion test.

### REQ-012: Multi-Category Stock Separation
- **Statement**: The system must maintain segregated, independently queryable stock ledgers and balances for Raw Materials, Packaging Materials, Work-in-Progress (WIP), and Finished Goods.
- **Source**: S1 (README "Separate raw, packaging, WIP, and finished-stock balances").
- **Testable Acceptance Criteria**:
  - Given inventory queries for category `RAW_MATERIAL` vs `FINISHED_GOODS`:
  - When reporting balances:
  - Then raw materials display in kg/litres with weighted average cost, and finished goods display in packet counts with manufactured batch unit cost.
- **Verification Method**: Integration test and UI table verification.

### REQ-013: Complete Source Document Traceability for Every Ledger Entry
- **Statement**: Every row in the stock movement ledger must maintain a mandatory foreign reference to its triggering source document (Purchase Receipt ID, Production Run ID, Dispatch ID, or Credit Note ID).
- **Source**: S1 (README "Every stock movement resolves to a posted source document"), S3 (OWASP Top 10:2021 A09:2021, ASVS v4.0.3 V11.1.1).
- **Testable Acceptance Criteria**:
  - When querying any stock movement record:
  - Then `sourceDocumentType` and `sourceDocumentId` are non-null and resolve to a valid document in the database.
- **Verification Method**: Database constraint verification and integration test.

### REQ-014: Non-Negative Stock Balance Invariant Enforcement
- **Statement**: Normal stock movements must never permit physical on-hand stock or available-to-promise inventory to drop below zero.
- **Source**: S1 (README "chk_current_stock_non_negative", "Strict stock reservation"), S3 (OWASP ASVS v4.0.3 V11.1.5).
- **Testable Acceptance Criteria**:
  - When an operation attempts to issue or dispatch more stock than is currently physically available:
  - Then the database check constraint `chk_current_stock_non_negative` or domain service aborts the transaction with an HTTP 400 Insufficient Stock error.
- **Verification Method**: Concurrency unit test and database constraint integration test.

---

## 3. Domain: Bill of Materials (BOM) and Production Run Recording

### REQ-015: Production Run Actuals and Scrap/Damage Capture
- **Statement**: Production supervisors must be able to record actual raw material issues, actual finished good output, damaged packaging, and scrap per production run.
- **Source**: S1 (README "Production run recording: yields, damaged items, labor and utility costs, and batch costing").
- **Testable Acceptance Criteria**:
  - Given a production run for Murukku 200g:
  - When entering 40 kg flour, 10.5 L oil, 1.2 kg spice mix, 188 good packets, 6 damaged pouches, and 9 cartons:
  - Then all actual input and output values are persisted on the run.
- **Verification Method**: Integration test and E2E tablet test.

### REQ-016: Atomic Production Run Posting Transaction
- **Statement**: Posting a production run must execute within a single atomic database transaction: deduct raw material and packaging stocks, record finished goods addition, write consumption/yield metrics, and capture audit logs. If any step fails, the entire transaction rolls back.
- **Source**: S1 (README "Post production atomically with stock deductions and finished-goods receipt"), S3 (OWASP ASVS v4.0.3 V11.1.4, V11.1.5).
- **Testable Acceptance Criteria**:
  - When `POST /api/v1/production-runs/:id/post` is called:
  - Then:
    - Flour stock decreases by 40 kg.
    - Oil stock decreases by 10.5 L.
    - Spice mix stock decreases by 1.2 kg.
    - Pouch stock decreases by 194 pieces (188 good + 6 damaged).
    - Carton stock decreases by 9 pieces.
    - Finished goods stock increases by 188 packets.
  - If a database error occurs during output insertion, raw material deductions are not committed.
- **Verification Method**: Integration test and Benchmark Runner.

### REQ-017: Production Yield Variance Calculation and Flagging
- **Statement**: The system must automatically calculate yield variance as `(actual_good_output - expected_good_output) / expected_good_output * 100` and display an alert flag whenever variance exceeds tolerance (e.g. ±3%).
- **Source**: S1 (README "Yield variance (-6% flagged)", "Calculate yield and consumption variance against benchmark conventions").
- **Testable Acceptance Criteria**:
  - Given a standard expected yield of 200 packets:
  - When actual good output is 188 packets:
  - Then yield variance is computed as -6.0%, marked as an exception, and flagged with a visible alert indicator on both the production run view and owner dashboard.
- **Verification Method**: Unit test and Benchmark Runner.

### REQ-018: Raw Material Consumption Variance Calculation and Flagging
- **Statement**: The system must compare actual raw material consumption against planned BOM consumption, compute the percentage difference, and flag consumption exceeding standard tolerance.
- **Source**: S1 (README "Oil variance (+5% flagged)", "Planned vs actual consumption").
- **Testable Acceptance Criteria**:
  - Given planned oil consumption of 10.0 L:
  - When actual oil consumption is 10.5 L:
  - Then consumption variance is computed as +5.0% and flagged as an adverse material variance.
- **Verification Method**: Unit test and Benchmark Runner.

### REQ-019: Non-Blocking Packaging Mismatch Warning and Loose Stock Tracking
- **Statement**: When the carton packaging capacity (cartons used * pack size capacity) does not match good finished output, the system must record packed and unboxed (loose) quantities separately, display a real-time non-blocking warning informing the supervisor, and allow posting without automatically consuming an additional carton.
- **Source**: S1 (README "Non blocking Packaging Mismatch Warning"), S2 (Owner Decision 6: "Track loose stock: Allow production output to exceed available packaging capacity. Record packed and unboxed quantities separately. Do not automatically consume an additional carton or block production").
- **Testable Acceptance Criteria**:
  - Given 9 cartons consumed with capacity 20 packets/carton (total 180 packets capacity) and 188 good packets produced:
  - When the supervisor reviews and posts the production run:
  - Then the UI displays a non-blocking alert stating 8 packets exceed boxed carton capacity, records 180 packed packets and 8 loose unboxed packets separately in output records, and permits posting without requiring a 10th carton.
- **Verification Method**: Unit test and E2E test.

### REQ-020: Direct Overhead Allocation (Labour and Utilities)
- **Statement**: Production runs must support allocating direct labor and power/gas utility expenses directly to the batch run.
- **Source**: S1 (README "Labour, gas/power, and other direct run costs", "Add labour of ₹1,200 and gas/power of ₹600 for the run").
- **Testable Acceptance Criteria**:
  - Given direct material cost of 4,055.00:
  - When adding labor 1,200.00 and gas/power 600.00:
  - Then total production run cost is recorded as exactly 5,855.00.
- **Verification Method**: Unit test and Benchmark Runner.

### REQ-021: Cost Per Good Packet and FIFO Layer Costing
- **Statement**: The system must compute cost per good packet as `total_run_cost / actual_good_packets`, compute gross margin against selling price, and maintain FIFO inventory layers for finished goods where opening stock retains its recorded valuation (₹0 for opening benchmark stock) and new production retains its actual run cost (₹31.14) without blending costs across layers.
- **Source**: S1 (README "Cost per good packet (₹5,855 / 188) ≈ ₹31.14"), S2 (Owner Decision 7: "Opening Finished Goods Costing: FIFO. Use FIFO inventory costing. The 50 opening packets retain their recorded opening valuation (₹0 in the benchmark), while subsequent production is valued at its actual cost. Do not blend costs across inventory layers").
- **Testable Acceptance Criteria**:
  - Given total run cost of 5,855.00 and 188 good packets:
  - Then unit manufacturing cost is computed as 31.1436... rounded to 31.14 per packet.
  - When finished stock of 150 packets is dispatched for Retailer A (50 opening + 100 new):
  - Then the FIFO cost of goods sold accounts for 50 packets at 0.00 plus 100 packets at 31.14 (total COGS 3,114.00), leaving 88 packets valued at 31.14 in closing stock without cost blending.
- **Verification Method**: Unit test and Benchmark Runner.

### REQ-022: Production Run Reversal via Linked Correction Documents
- **Statement**: Posted production runs cannot be deleted; reversal must occur through a linked reversal document that restores raw materials and deducts finished goods.
- **Source**: S1 (README "Reversal only through a controlled correction", "Preserve immutable posted invoices and production records").
- **Testable Acceptance Criteria**:
  - When an admin reverses a posted run via `POST /api/v1/production-runs/:id/reverse`:
  - Then compensating stock movement entries are created referencing the reversal document, and the original run status transitions to `REVERSED`.
- **Verification Method**: Integration test.

---

## 4. Domain: Sales Order Workflow and Stock Reservation

### REQ-023: Salesman Mobile Field Order Capture
- **Statement**: Salesmen on mobile devices must be able to select an assigned customer, browse available products with clear images and labels, enter packet quantities, review totals, and submit sales orders.
- **Source**: S1 (README "Order to cash workflow: mobile sales order creation", "Under-one-minute normal order entry"), S2 ("Ordering and booking screens use images WITH text labels, and must be accessible").
- **Testable Acceptance Criteria**:
  - Given Salesman 1 logged in on a 360px viewport:
  - When selecting Retailer A and ordering 150 packets of Murukku 200g:
  - Then order is created in status `SUBMITTED` with taxable amount 7,500.00.
- **Verification Method**: E2E mobile test and Playwright browser test.

### REQ-024: Customer-Specific Price List and Threshold Discount Guard
- **Statement**: When adding line items to an order, base unit rates must resolve automatically from the customer's effective price list, preventing arbitrary client-side price tampering. Any discount applied against list price must follow the strict statutory threshold discount guard: discounts up to and including 5% are allowed at salesman discretion; discounts above 5% and up to 15% require explicit manager approval; discounts above 15% are rejected by the server.
- **Source**: S1 (README "Customer selection and effective price-list pricing"), S2 (Owner Decision OD-07: "Sales Order Unit Price Discount Bounds and Margin Policy"), S3 (OWASP ASVS v4.0.3 V11.1.1, V13.1.1).
> [!NOTE] Specification Refinement (20 November 2026 — Owner Decision OD-07):
> Salesmen may not freely override unit prices. Discounts against the customer's assigned price list are governed by:
> - Up to and including 5%: Salesman discretion.
> - Above 5% and up to and including 15%: Explicit Manager approval required (enforced via dedicated manager permission, not generic admin).
> - Above 15%: Rejected outright with HTTP 422 Unprocessable Entity.
> Discounts and unit prices are recalculated server-side using precise decimal arithmetic. Every discount application must immutably record the applied discount, requesting salesman, approving manager, approval timestamp, and reason. Modifying prices after approval mandates revalidation.
- **Testable Acceptance Criteria**:
  - When an order line is submitted with a spoofed rate below 85% of price list (discount > 15%):
  - Then the backend rejects the request with HTTP 422 Unprocessable Entity (`DISCOUNT_EXCEEDS_MAX_THRESHOLD`).
  - When an order line is submitted with a discount between 5.01% and 15.00%:
  - Then the order requires explicit approval from a user with `MANAGER` permission; approval cannot be granted by an unprivileged role.
  - When an order line is submitted with a discount <= 5.00%:
  - Then the discount is accepted under salesman discretion.
- **Verification Method**: Integration test (`discount-guard.test.ts`).

### REQ-025: Salesman Territory, Scope Enforcement, and Scoped Dispatch Visibility
- **Statement**: Salesmen must only see and create orders for customers assigned to their territory and must only access their own submitted orders. Salesmen may access dispatch information associated exclusively with their own submitted sales orders (`salesOrder.createdById === authenticatedUser.id`), projecting only delivery tracking details.
- **Source**: S1 (README "Salesman can read only own orders and assigned customers"), S2 (Owner Decision OD-03: "Multi-tier ABAC Scoping Matrix for Salesmen & Dispatches"), S3 (OWASP Top 10:2021 A01:2021, OWASP API Security Top 10:2023 API1:2023).
> [!NOTE] Specification Refinement (20 November 2026 — Owner Decision OD-03):
> Salesmen access to `GET /api/v1/sales/dispatches` and `GET /api/v1/sales/dispatches/:id` is strictly scoped to `salesOrder.createdById === authenticatedUser.id`. Company-wide dispatches, unrelated customer profiles, financial invoices, payments, and internal warehouse notes are omitted from the projection. Server-side ABAC is enforced across list and detail endpoints.
- **Testable Acceptance Criteria**:
  - Given Salesman 1 (Tamil Nadu territory) and Salesman 2 (Karnataka territory):
  - When Salesman 1 queries `GET /api/v1/sales/orders`:
  - Then only orders created by Salesman 1 are returned.
  - When Salesman 1 queries `GET /api/v1/sales/orders/:id` for an order belonging to Salesman 2:
  - Then the API returns HTTP 403 or 404.
  - When Salesman 1 queries `GET /api/v1/sales/dispatches`:
  - Then only dispatch records for orders created by Salesman 1 are returned, and payload contains only delivery tracking fields.
- **Verification Method**: Integration test (`sales-scope-abac.test.ts`).

### REQ-026: Available-to-Promise (ATP) Stock Visibility
- **Statement**: The order review screen must show physical on-hand stock, active reservations, and Available-to-Promise (`ATP = on_hand - reserved`).
- **Source**: S1 (README "Show on-hand, reserved, and available-to-promise stock", "Admin stock verification, ATP checking").
- **Testable Acceptance Criteria**:
  - Given physical finished goods of 238 packets and active reservations of 150 packets:
  - When reviewing a new incoming order:
  - Then on-hand displays as 238, reserved displays as 150, and available-to-promise displays as 88.
- **Verification Method**: Unit test and UI review panel test.

### REQ-027: Transactional Stock Reservation on Order Approval
- **Statement**: When an admin approves a sales order, the system must atomically reserve finished goods inventory, preventing concurrent orders from double-allocating the same stock.
- **Source**: S1 (README "Strict stock reservation preventing double selling", "Approval creates a reservation"), S3 (OWASP ASVS v4.0.3 V11.1.4, V11.1.5).
- **Testable Acceptance Criteria**:
  - Given available stock of 150 packets:
  - When Admin approves Order A (150 packets):
  - Then 150 packets are recorded in `stock_reservation` table and available stock drops to 0.
  - When another order attempts approval concurrently:
  - Then the second approval is rejected due to 0 available stock.
- **Verification Method**: Concurrency integration test.

### REQ-028: Admin Order Modification with Mandatory Reason
- **Statement**: When an administrator modifies approved quantities or unit prices on an order, a mandatory text reason must be recorded in the audit history.
- **Source**: S1 (README "Admin order review, quantity/price edit with reason, approve/reject").
- **Testable Acceptance Criteria**:
  - When an admin updates an order quantity without providing a reason:
  - Then the update is rejected with validation error "Reason is required for order modification".
- **Verification Method**: Integration test and form validation test.

### REQ-029: Explicit Stock Shortage Handling and Blocking Policy
- **Statement**: When inventory is insufficient to fulfill an order, the system must block approval with HTTP 400 Insufficient Stock and display an explicit shortage banner showing requested vs available units.
- **Source**: S1 (README "Distributor B Order Policy: When inventory is insufficient (88 available vs 120 requested), order is held in draft state with explicit shortage banner (32 packets short). Admin approval rejected with 400 Insufficient Stock").
- **Testable Acceptance Criteria**:
  - Given 88 available packets:
  - When Distributor B places an order for 120 packets:
  - Then the UI shows a shortage warning of 32 packets, and calling `POST /api/v1/sales/orders/:id/approve` responds with HTTP 400 and code `INSUFFICIENT_STOCK`.
- **Verification Method**: Integration test and Benchmark Runner.

### REQ-030: Sales Order Rejection Lifecycle
- **Statement**: Administrators must be able to reject orders with an explanatory rejection note, transitioning the order status to `REJECTED` and freeing any pending draft locks.
- **Source**: S1 (README "Admin order review... approve/reject").
- **Testable Acceptance Criteria**:
  - When `POST /api/v1/sales/orders/:id/reject` is submitted with `{ reason: "Credit limit exceeded" }`:
  - Then order status transitions to `REJECTED`, and the reason is visible to the submitting salesman.
- **Verification Method**: Integration test.

---

## 5. Domain: Order Fulfilment and Dispatch

### REQ-031: Dispatch Physical Stock Deduction
- **Statement**: Dispatching an approved order must be a distinct operational event that reduces physical on-hand finished goods stock in the warehouse.
- **Source**: S1 (README "Dispatch creates the physical stock deduction", "Step 5: Admin approves... and records dispatch").
- **Testable Acceptance Criteria**:
  - Given physical finished goods stock of 238 packets:
  - When a dispatch of 150 packets is posted for Retailer A:
  - Then physical stock is decremented to exactly 88 packets, and a `DISPATCH` stock movement is appended.
- **Verification Method**: Integration test and Benchmark Runner.

### REQ-032: Atomic Stock Reservation Release on Dispatch
- **Statement**: Posting a dispatch must atomically release the active stock reservation associated with the sales order line items.
- **Source**: S1 (README "dispatch releases reservation and creates negative finished-goods movement"), S3 (OWASP ASVS v4.0.3 V11.1.5).
- **Testable Acceptance Criteria**:
  - When dispatch posts:
  - Then reservation records for the order are marked `RELEASED` or deleted in the same transaction.
- **Verification Method**: Database transaction integration test.

### REQ-033: Explicit Partial Dispatch Support
- **Statement**: When an order is fulfilled in installments, the system must track fulfilled vs remaining quantities explicitly without inferring state from a single boolean flag.
- **Source**: S1 (README "Partial approval or partial dispatch is represented explicitly").
- **Testable Acceptance Criteria**:
  - When 80 packets of a 100-packet order are dispatched:
  - Then fulfillment status becomes `PARTIALLY_FULFILLED` with remaining quantity 20.
- **Verification Method**: Unit test and integration test.

---

## 6. Domain: Statutory Invoicing and Indian GST Compliance

### REQ-034: GST Statutory Calculation and Dynamic TaxRate Master Resolution
- **Statement**: The tax engine must resolve statutory GST rates dynamically from the authoritative `TaxRate` master table matched using HSN code and document effective date, computing components based on supplier facility state and customer place of supply: Intra-state (same state) splits tax equally into CGST and SGST (e.g. 2.5% + 2.5% for a 5% rate); Inter-state charges full IGST (5%).
- **Source**: S1 (README "Indian GST statutory calculation: CGST, SGST, IGST with inter state and intra state logic", "Benchmark: Retailer A TN -> ₹187.50 CGST + ₹187.50 SGST; Distributor B KA -> IGST applies"), S2 (Owner Decision OD-01: "Dynamic GST Rate Master Table vs Static Product Column").
> [!NOTE] Specification Refinement (20 November 2026 — Owner Decision OD-01):
> `TaxRate` is the authoritative source for statutory GST rates. The system must not silently fall back to `product.taxRate` when a matching rate is unavailable; invoice finalization must fail safely and report a tax configuration error. Posted invoice lines must preserve an immutable snapshot of applicable tax rate, HSN code, taxable value, tax breakdown, and rate reference. Overlapping effective dates for the same classification are forbidden. Historical posted invoices are never recalculated. The static `product.taxRate` dependency is deprecated and removed following verified data migration.
- **Testable Acceptance Criteria**:
  - Given supplier in Tamil Nadu and taxable amount of 7,500.00:
  - When billing Retailer A in Tamil Nadu:
    - CGST is computed as 187.50 (2.5%).
    - SGST is computed as 187.50 (2.5%).
    - IGST is computed as 0.00.
    - Total invoice amount is 7,875.00.
  - When billing Distributor B in Karnataka:
    - CGST is 0.00, SGST is 0.00, IGST is 5.0% on taxable value.
  - When finalized with an unconfigured or expired HSN tax rate:
    - Then invoice finalization fails safely with HTTP 422 `TAX_CONFIGURATION_ERROR` and blocks posting.
- **Verification Method**: Unit test and Benchmark Runner.

### REQ-035: Financial Year Sequential Invoice Numbering
- **Statement**: Invoices must be sequentially numbered within the current Indian Financial Year (e.g., `ML/2026-27/0001`) using an atomic document sequence counter that prevents gaps and duplicate numbers.
- **Source**: S1 (README "GST tax invoice with... FY numbering", "chk_invoice_taxable_amount_non_negative"), S3 (OWASP ASVS v4.0.3 V11.1.1).
- **Testable Acceptance Criteria**:
  - Under concurrent invoice posting:
  - Then every invoice receives a unique, monotonic sequence number within the FY prefix without collisions.
- **Verification Method**: Concurrency test (`sequence-concurrency.test.ts`).

### REQ-036: Posted Invoice Immutability and Data Snapshots
- **Statement**: Once posted, an invoice cannot be updated or deleted. Line items, customer address, GSTIN, and tax rates must be preserved as frozen immutable snapshots.
- **Source**: S1 (README "Preserve immutable posted invoices... use corrections or reversals", "Invoice lines and customer data are snapshots").
- **Testable Acceptance Criteria**:
  - When `PUT /api/v1/finance/invoices/:id` or `DELETE /api/v1/finance/invoices/:id` is requested on a posted invoice:
  - Then the server rejects the request with HTTP 405 Method Not Allowed or HTTP 400.
- **Verification Method**: Integration test.

### REQ-037: Statutory Credit Notes and Dedicated Supplier Debit Notes
- **Statement**: Correction or cancellation of a posted customer invoice must be executed via an official Credit Note referencing the original invoice, adjusting customer receivables accordingly. Deductions against suppliers (purchase returns, short delivery, damaged goods, quality rejections, and supplier price adjustments) must be executed using a dedicated `DebitNote` model distinct from customer credit notes.
- **Source**: S1 (README "Correct posted invoices by credit note; posted invoices are cancelled with a credit note, not deleted"), S2 (Owner Decision OD-06: "Payment Bounce and Debit Note Data Model Specification").
> [!NOTE] Specification Refinement (20 November 2026 — Owner Decision OD-06):
> Customer credit notes (AR) and supplier debit notes (AP) must remain separate document models with independent lifecycles, authorizations, and audit requirements. A debit note raised by Mill Ledger against a supplier links to the supplier and purchase invoice/receipt, recording item quantities, taxable values, tax breakdowns, and reasons. Supplier payables update via immutable compensating adjustments; physical stock movements occur only when physical stock is returned. Posted documents are immutable.
- **Testable Acceptance Criteria**:
  - When an admin issues a credit note via `POST /api/v1/finance/invoices/:id/credit-note`:
  - Then a `credit_note` record is created, the original invoice status transitions to `CREDITED`, and customer balance reflects the deduction.
  - When a debit note is raised against a supplier via `POST /api/v1/purchasing/debit-notes`:
  - Then a dedicated `debit_note` record is created, supplier payable balance is reduced, and a return stock movement is appended if physical stock was returned.
- **Verification Method**: Integration test (`debit-note.test.ts`, `credit-note.test.ts`).

### REQ-038: Statutory PDF Invoice Generation
- **Statement**: The system must generate compliant PDF invoices containing supplier GSTIN, customer GSTIN, HSN code, tax breakdown (taxable value, CGST, SGST, IGST), and total in words.
- **Source**: S1 (README "GST tax invoice as PDF", "Invoice can be downloaded as PDF and shared").
- **Testable Acceptance Criteria**:
  - When calling `GET /api/v1/finance/invoices/:id/pdf`:
  - Then a valid PDF binary is returned with Content-Type `application/pdf` containing all required statutory fields.
- **Verification Method**: Integration test and PDF content inspection.

---

## 7. Domain: Payments, Customer Receivables and Bounced Payment Lifecycle

### REQ-039: Transactional Payment Recording, FIFO Invoice Allocation and Bounced Payment Lifecycle
- **Statement**: Payments received from customers must be recorded transactionally and allocated against outstanding posted invoices using FIFO (oldest open invoice first) or explicit line-item allocation. When a cheque or NACH mandate bounces or chargeback occurs, the payment status transitions to `BOUNCED`, and allocations are transactionally reversed, restoring invoice outstanding amounts without deleting ledger history.
- **Source**: S1 (README "FIFO payment allocation against posted invoices", "Record a payment of ₹4,000 from Retailer A"), S2 (Owner Decision OD-06: "Payment Bounce and Debit Note Data Model Specification").
> [!NOTE] Specification Refinement (20 November 2026 — Owner Decision OD-06):
> Introduce `PaymentStatus.BOUNCED` for cheque/NACH dishonour and support chargeback reversals. Reversals must transactionally roll back original invoice allocations, restoring customer outstanding balances. Original payments and allocation histories must never be deleted or overwritten. Duplicate reversal operations are prevented via idempotency controls. Reversal reason, transaction reference, timestamp, and actor are immutably audited.
- **Testable Acceptance Criteria**:
  - Given Retailer A invoice of 7,875.00:
  - When a payment of 4,000.00 is posted via `POST /api/v1/payments`:
  - Then 4,000.00 is allocated to the invoice in `payment_allocation`, leaving an outstanding balance of exactly 3,875.00.
  - When the payment bounces and `POST /api/v1/payments/:id/bounce` is invoked:
  - Then payment status becomes `BOUNCED`, allocations are reversed, and the invoice outstanding balance is restored to 7,875.00.
- **Verification Method**: Unit test and Benchmark Runner.

### REQ-040: Dynamic Derived Customer Outstanding Ledger
- **Statement**: Customer outstanding balances must be derived dynamically from posted invoices minus credit notes minus allocated payments. Independently editable customer balance columns are strictly disallowed.
- **Source**: S1 (README "Retailer A invoice outstanding (₹7,875 - ₹4,000) = ₹3,875.00", "Outstanding is derived... Do not maintain independently editable customer outstanding").
- **Testable Acceptance Criteria**:
  - When querying customer outstanding balance:
  - Then the balance equals `sum(posted_invoices.totalAmount) - sum(credit_notes.amount) - sum(payments.allocatedAmount)`.
- **Verification Method**: Unit test and database balance reconciliation test.

### REQ-041: Customer Receivables Ageing Analysis
- **Statement**: The receivables module must group outstanding invoices into standard ageing buckets (0-30 days, 31-60 days, 61-90 days, 90+ days) based on invoice date or payment due date.
- **Source**: S1 (README "Reporting suite: customer receivables ageing").
- **Testable Acceptance Criteria**:
  - When viewing receivables report:
  - Then outstanding debts are broken down by customer and by age bracket with drill-down links to original invoices.
- **Verification Method**: Integration test.

---

## 8. Domain: Reporting Suite and Analytics

### REQ-042: Sales Register Report
- **Statement**: The system must provide a Sales Register report filterable by date range, customer, and product, showing invoice numbers, dates, taxable values, tax breakdowns, and total amounts.
- **Source**: S1 (README "Sales register total invoiced = ₹7,875.00", "Reporting suite: sales register").
- **Testable Acceptance Criteria**:
  - When generating the benchmark sales register:
  - Then total invoiced equals 7,875.00 across 1 invoice line.
- **Verification Method**: Integration test and Benchmark Runner.

### REQ-043: GST Outward Supplies Summary (GSTR-1 / GSTR-3B Format)
- **Statement**: The system must generate a GST summary report grouping supplies by B2B (with GSTIN), B2C (without GSTIN), tax rates (5%), and place of supply to facilitate GSTR-1 and GSTR-3B filing reconciliation.
- **Source**: S1 (README "GST outward summary shaped for reconciliation, not filing").
- **Testable Acceptance Criteria**:
  - When GST outward summary is requested for the benchmark period:
  - Then taxable value 7,500.00, CGST 187.50, and SGST 187.50 are displayed in the 5% tax bracket.
- **Verification Method**: Integration test.

### REQ-044: Purchase Register Report
- **Statement**: The system must provide a Purchase Register report listing all purchase receipts, supplier names, material quantities, rates, and total purchase expenditure.
- **Source**: S1 (README "Reporting suite: purchase register").
- **Testable Acceptance Criteria**:
  - When generating purchase register for the benchmark run:
  - Then the 60 kg Flour receipt at 45.00/kg (total 2,700.00) is reported.
- **Verification Method**: Integration test.

### REQ-045: Stock Summary and Stock Ledger Valuation Report
- **Statement**: The system must generate a comprehensive stock report showing opening balance, receipts, issues/consumption, dispatches, closing balances, and moving weighted average asset valuation.
- **Source**: S1 (README "Stock valuation report", "Closing balances: Flour 120kg, Oil 19.5L, Spice 3.8kg, Pouches 306, Cartons 21, FG 88").
- **Testable Acceptance Criteria**:
  - When the stock valuation report is executed following benchmark execution:
  - Then all 6 closing balances match the benchmark table exactly.
- **Verification Method**: Integration test and Benchmark Runner.

### REQ-046: Production Costing and Variance Report
- **Statement**: The system must provide a production run report detailing BOM standards, actual material consumption, scrap, overhead costs, calculated yield variance (-6%), oil variance (+5%), and net cost per good packet.
- **Source**: S1 (README "Production costing analysis", "Production report with planned vs actual").
- **Testable Acceptance Criteria**:
  - When the production report is rendered:
  - Then run cost 5,855.00, yield variance -6%, oil variance +5%, and cost per packet 31.14 are displayed.
- **Verification Method**: Integration test.

### REQ-047: Collections Register Report
- **Statement**: The system must provide a Collections Register report listing all payments received, payment modes, receipt dates, and allocation statuses.
- **Source**: S1 (README "Collections register total collected = ₹4,000.00", "Reporting suite: collections register").
- **Testable Acceptance Criteria**:
  - When the collections register is generated:
  - Then total collections display as 4,000.00.
- **Verification Method**: Integration test and Benchmark Runner.

### REQ-048: Executive Owner Operational Dashboard
- **Statement**: The owner dashboard must display real-time KPI cards for today's orders, current finished goods stock, critical inventory shortages, active variance alerts, and total receivables.
- **Source**: S1 (README "Owner dashboard", "See a summary: today's orders, stock levels, variance alerts, cost per packet, outstanding dues").
- **Testable Acceptance Criteria**:
  - Given an authenticated Owner:
  - When accessing `/dashboard`:
  - Then operational summaries, variance alerts (-6% yield), and outstanding dues (3,875.00) are rendered with data freshness timestamps.
- **Verification Method**: E2E browser test.

### REQ-049: Data Export Engine (CSV/Excel/PDF)
- **Statement**: Every report table must support one-click export to CSV and Excel formats, using the exact same filters and data source query as the on-screen view.
- **Source**: S1 (README "CSV exports", "Exportable to Excel/CSV and PDF").
- **Testable Acceptance Criteria**:
  - When `GET /api/v1/reports/:report/export?format=csv` is called:
  - Then the endpoint returns HTTP 200 with Content-Type `text/csv` matching the rows displayed on screen.
- **Verification Method**: Integration test.

---

## 9. Domain: Offline PWA Order Capture and Sync Engine

### REQ-050: Offline Outbox Storage in Client IndexedDB (Dexie)
- **Statement**: When a salesman creates an order without network connectivity, the order must be persisted in a client-side IndexedDB outbox table (`offline_orders`) with status `QUEUED` and client-generated UUID.
- **Source**: S1 (README "Dexie IndexedDB client side queue with idempotent server replay").
- **Testable Acceptance Criteria**:
  - Given the browser is offline (`navigator.onLine === false`):
  - When a salesman submits an order:
  - Then the order is saved locally in Dexie IndexedDB, a toast confirms "Order queued offline", and the order appears in the outbox list.
- **Verification Method**: Playwright offline mode test (`fullstack-flows.spec.ts`).

### REQ-051: Idempotent Server Sync Replay with Idempotency Key
- **Statement**: Queued offline orders must submit to the backend using an `Idempotency-Key` HTTP header. Replaying the same key must return the original committed order without creating duplicate orders or stock movements.
- **Source**: S1 (README "Idempotent server replay, conflict detection, and retry mechanics", "Idempotency records include key scope, actor, request hash..."), S3 (OWASP ASVS v4.0.3 V11.1.4).
- **Testable Acceptance Criteria**:
  - When the client replays `POST /api/v1/sales/orders` twice with the same `Idempotency-Key`:
  - Then the second response returns HTTP 200 with the original order ID and no duplicate database record is created.
- **Verification Method**: Integration test (`offline-sync.test.ts`).

### REQ-052: Sync State Tracking and Explicit Conflict Queue Triage (STOCK_SHORTAGE_CONFLICT)
- **Statement**: Offline orders must display explicit states (`LOCAL_DRAFT`, `QUEUED`, `SYNCING`, `SERVER_ACCEPTED`, `CONFLICT`, `FAILED`). When stock is insufficient at sync time, the server must atomically create the order in a dedicated `STOCK_SHORTAGE_CONFLICT` database state, reserving only available inventory, recording the exact remaining shortage, and routing the order into an explicit Conflict Queue for triage (adjust quantities, backorder, or cancel) without overbooking stock or splitting orders automatically.
- **Source**: S1 (README "Never present a local offline order as server-submitted or stock-reserved"), S2 (Owner Decision OD-04: "Offline Outbox Stock Shortage Conflict Queue Policy (REQ-052)").
> [!NOTE] Specification Refinement (20 November 2026 — Owner Decision OD-04):
> The server preserves the original offline order intent. Orders encountering shortages transition atomically to `STOCK_SHORTAGE_CONFLICT`. Available-to-promise inventory is computed using database row locking (`SELECT ... FOR UPDATE`) and transactional isolation. Only actually available quantities are reserved; negative inventory and overselling are strictly prevented. The order remains in `STOCK_SHORTAGE_CONFLICT` until authorized resolution. Conflict creation, resolution actor, timestamps, and inventory adjustments are fully audited. Notifications are emitted via transactional outbox only after database commit. Sync requests must be idempotent.
- **Testable Acceptance Criteria**:
  - In the Salesman UI:
  - Then queued orders display an amber badge "Queued Offline", syncing shows a spinner, and synced shows a green checkmark.
  - When an offline order synchronizes for an item whose available stock is less than requested:
  - Then the server sets order status to `STOCK_SHORTAGE_CONFLICT`, reserves available units, records exact remaining shortage, and surfaces the order in the Admin Conflict Queue.
  - Repeated sync requests with the same idempotency key return the existing conflict record without duplicate reservations.
- **Verification Method**: E2E browser test, offline sync integration test, and concurrency lock verification.

---

## 10. Domain: Bilingual Interface (Tamil and English)

### REQ-053: Bilingual UI Language Toggle (Tamil / English)
- **Statement**: The application shell must include a language toggle allowing floor staff to switch between English and Tamil (`ta`), translating operational terminology (runs, BOM, yield, damage, output, stock).
- **Source**: S1 (README "Tamil Language Interface: Full bilingual support toggled on the application shell for floor staff and operators").
- **Testable Acceptance Criteria**:
  - Given the user on `/production/today`:
  - When the language toggle is switched to Tamil:
  - Then headings, status badges, and action buttons render in Tamil script without layout clipping or text collisions.
- **Verification Method**: Client unit test (`i18n.test.ts`) and E2E visual test.

---

## 11. Domain: Owner Verbatim & System Capabilities

### REQ-054: Full Master Entity Management in UI and Secure Admin Bootstrap CLI
- **Statement**: All ten master entities (Suppliers, Customers, Raw Materials, Packaging Materials, Finished Goods SKUs, BOM Recipes, Facilities, Warehouses, Units of Measure, and Price Lists) must be fully manageable through the UI. The UI must support Create, View, Update, and Deactivate operations, while preventing hard deletion when historical transactions reference the record. Super admin initial account provisioning must occur strictly through an interactive CLI utility (`pnpm admin:bootstrap`), prohibiting hardcoded administrator passwords in version control, seed files, and environment configs.
- **Source**: S2 ("Suppliers and every other master entity must be fully manageable in the UI (not only seeded)"), S2 (Owner Decision 5: "Master Entity UI: All 10 entities"), S2 (Owner Decision OD-02: "Super Admin Bootstrap and First-Run Credential Policy").
> [!NOTE] Specification Refinement (20 November 2026 — Owner Decision OD-02):
> Interactive CLI `pnpm admin:bootstrap` is the sole authorized mechanism to provision the initial super administrator. Input passwords must be hidden in terminal. Passwords must be hashed using the application's secure hashing mechanism. The utility must refuse to run if an initial administrator already exists. Account creation is transactional and emits an audit event. Credentials and hashes must never be logged. Seed scripts are restricted to non-sensitive master data.
- **Testable Acceptance Criteria**:
  - In the web application:
  - Then an authorized administrator can navigate to dedicated management screens for all 10 master entities and perform Create, View, Update, and Deactivate operations directly in the browser.
  - When running `pnpm admin:bootstrap` on an unprovisioned database:
  - Then it securely prompts for email and password (masked), hashes credentials, and provisions the initial ADMIN.
  - When re-running `pnpm admin:bootstrap` on an already provisioned database:
  - Then it terminates with code 1 and message: "Initial administrator already exists".
- **Verification Method**: E2E test covering all 10 master entity screens and CLI integration test (`admin-bootstrap.test.ts`).

### REQ-055: High Performance Site with Route Lazy Loading (Owner Requirement)
- **Statement**: The frontend application must achieve very fast load times by lazy loading routes, chunking code bundles, and keeping initial JavaScript download minimal.
- **Source**: S2 ("Very fast site with lazy loading"), S3 (Core Web Vitals LCP < 2.5s, FID/INP < 200ms).
- **Testable Acceptance Criteria**:
  - In production build:
  - Then routes are wrapped in `React.lazy()` / dynamic imports with `<Suspense>` fallbacks, and the initial landing bundle is under 350 kB gzip.
- **Verification Method**: Static build analysis and Lighthouse audit.

### REQ-056: Mandatory Image Pipelines: Progressive ThumbHash for Products and SHA-256 for Proof-of-Delivery
- **Statement**: Asset images must use content-hashed filenames for immutable HTTP cache-busting, serve optimized modern formats (AVIF/WebP), and apply lazy loading (`loading="lazy"`) to images below the initial viewport fold. Product imagery must generate and store compact progressive ThumbHash placeholders during the upload pipeline, preserving intrinsic image dimensions to prevent layout shifts. Uploaded receipt and proof-of-delivery documents must generate and store server-side SHA-256 checksums for tenant-scoped deduplication and document integrity verification.
- **Source**: S2 ("Lazy load images below the fold. Use an image hash"), S2 (Owner Decision OD-05: "Image Hash Interpretation & Asset Optimization").
> [!WARNING] Specification Contradiction Resolved (20 November 2026 — Owner Decision OD-05):
> **Prior Baseline (Superseded)**: The original requirement stated: "BlurHash/ThumbHash placeholders are optional, not mandatory."
> **Updated Requirement**: Per Owner Decision OD-05, both mechanisms are approved and mandatory:
> 1. *Product Imagery*: Generate ThumbHash placeholders during upload pipeline; serve responsive AVIF/WebP renditions; preserve intrinsic aspect ratios to prevent CLS; above-the-fold LCP images must never be delayed by placeholder processing or lazy loading.
> 2. *Proof-of-Delivery & Receipts*: Compute SHA-256 checksums on the server upon upload; store checksums with document metadata in immutable audit records; enforce tenant-scoped deduplication; protect stored documents and audit records against tampering.
- **Testable Acceptance Criteria**:
  - In product catalog and order booking screens:
  - Then product image elements contain compact ThumbHash data URLs rendered as instant placeholders, and images load AVIF/WebP formats with intrinsic aspect ratio attributes (`aspect-ratio` or `width`/`height`).
  - When uploading receipt or proof-of-delivery documents:
  - Then the server computes SHA-256 checksum, stores it with document record, and blocks duplicate uploads within the same tenant.
- **Verification Method**: DOM inspection test, static asset manifest analysis, and document upload integration test.

### REQ-057: Accessible Field Sales Booking Screens with Co-Located Images and Text Labels
- **Statement**: Field-sales customer order booking screens must pair product variant images with clear, legible text labels (product name, SKU, pack size, price, unit) and comply fully with accessibility standards. Production batches and scheduling must use clear text-based identifiers.
- **Source**: S2 ("Ordering and booking screens use images WITH text labels, and must be accessible"), S2 (Owner Decision 4: "Booking Screens: Sales order booking. Treat booking as field-sales/customer order booking. Product images must always have readable text labels. Production batches and scheduling should use clear text-based identifiers"), S3 (WCAG 2.2 AA SC 1.1.1, SC 1.3.1).
- **Testable Acceptance Criteria**:
  - In sales order booking views:
  - Then every product entry contains a co-located visible text heading/label and an accessible image with descriptive `alt` text. No booking element may rely on an unlabelled thumbnail.
  - In production batch scheduling views:
  - Then batches display distinct textual identifiers (e.g. `BATCH-MUR-2026-001`).
- **Verification Method**: Playwright accessibility test (`@axe-core/playwright`) and DOM inspection.

### REQ-058: Hybrid API Request Logging and Auditable Metadata Storage
- **Statement**: The server must implement a hybrid request logging architecture: store searchable request metadata (timestamp, requestId, method, path, statusCode, durationMs, actorId, clientIp) in a PostgreSQL database table (`api_request_log`) with role-restricted access and configurable retention, while emitting structured JSON logs to stdout for external monitoring. Authentication secrets (passwords, session cookies, tokens, authorization headers) must never be retained or logged.
- **Source**: S2 ("API request log"), S2 (Owner Decision 8: "API Request Logging: Hybrid architecture. Store searchable request metadata in PostgreSQL for authorized admin access, and emit structured operational logs for external monitoring. Never retain passwords, session cookies, access tokens, or sensitive authentication headers. Use configurable retention and role-restricted access"), S3 (OWASP Top 10:2021 A09:2021).
- **Testable Acceptance Criteria**:
  - When an API request is processed:
  - Then a record is inserted into the request log table with response metadata and correlation ID `X-Request-Id`.
  - When request bodies contain fields `password`, `token`, `secret`, or headers `Cookie`/`Authorization`:
  - Then those values are masked or omitted in both database logs and stdout logs.
- **Verification Method**: Integration test and log sanitization test.

### REQ-059: Controlled Super Admin Permission with Immutable Ledger Invariant
- **Statement**: The authorization model must support a Super Admin role with master permission allowing cross-organization administration, master-data management, and system configuration through explicit, audited permissions. Under no circumstances may any role, including Super Admin, directly mutate or delete posted ledger records (invoices, stock movements, posted production runs); corrections must strictly require formal reversal entries or credit notes.
- **Source**: S2 ("Super admin with every permission plus a master permission"), S2 (Owner Decision 3: "Super Admin Permission: Controlled system-wide access. Allow cross-organization administration, master-data management, and system configuration through explicit permissions. All privileged actions must be audited. Never allow direct modification or deletion of posted ledger entries; corrections must use reversal entries"), S3 (OWASP ASVS v4.0.3 V4.1.1, V11.1.1, V11.1.5).
- **Testable Acceptance Criteria**:
  - When a user with `SUPER_ADMIN` and `master:all` permission performs administrative or cross-organization configuration:
  - Then access is granted and an entry is logged in `audit_log`.
  - When a Super Admin attempts a direct SQL/API update or deletion on a posted `sales_invoice` or `stock_movement`:
  - Then the request is rejected with HTTP 400/405, preserving ledger immutability.
- **Verification Method**: Security unit test (`rbac.test.ts`) and immutability integration test.

### REQ-060: Scope-to-UI Reachability Invariant (Owner Requirement)
- **Statement**: Every user must be able to reach every feature within their authorized scope directly from their own UI navigation (e.g. Salesman bottom navigation, Admin sidebar, Production supervisor floor navigation) without needing URL bookmarking or undocumented paths.
- **Source**: S2 ("Every user can reach every feature within their scope from their own UI"), S3 (NN/g #7 Flexibility and efficiency of use, Apple HIG: Navigation).
- **Testable Acceptance Criteria**:
  - For each defined role (`OWNER`, `ADMIN`, `PRODUCTION`, `SALESMAN`, `ACCOUNTANT`):
  - Then all authorized application pages are reachable via visible links or menus in the authenticated shell.
- **Verification Method**: Playwright crawler test across all role sessions.

### REQ-061: Anti-Slop UI Craftsmanship and Quality Locks (Owner Requirement)
- **Statement**: The frontend must adhere strictly to anti-slop principles: purposeful visual hierarchy, functional completeness (no dead buttons), minimum 44px tap targets, visible focus indicators, no generic AI marketing buzzwords, and working empty/loading/error states.
- **Source**: S2 ("No AI slop"), antislop skill rules R-01 through R-40.
- **Testable Acceptance Criteria**:
  - In all client pages:
  - Then every button has an active click handler, interactive elements show `cursor: pointer`, no em dashes exist in generated UI copy, and every data view supports loading, empty, and error states.
- **Verification Method**: Static grep scan, axe-core E2E test, and UI state inspection.

### REQ-062: Application Metadata and Authenticated ERP Page `noindex` Protection
- **Statement**: The web application must implement descriptive `<title>` tags, semantic HTML, and metadata throughout all views. Authenticated ERP pages must enforce `noindex, nofollow` to prevent search engine indexing of private company data, while public landing or login pages may be indexed.
- **Source**: S2 ("SEO done"), S2 (Owner Decision 2: "SEO Scope: Metadata, not public indexing. Keep authenticated ERP pages noindex. Implement descriptive titles, semantic HTML, and relevant metadata throughout the application. Public landing pages may be indexed"), antislop skill rule R-39.
- **Testable Acceptance Criteria**:
  - In authenticated routes:
  - Then `<meta name="robots" content="noindex, nofollow">` is present in the DOM or response headers.
  - Across all routes:
  - Then `<title>` dynamically updates with the active view name and organization title, semantic landmarks are present, and public login pages permit indexing.
- **Verification Method**: E2E browser inspection test.

### REQ-063: Omnipresent Defensive Schema Validation (Owner Requirement)
- **Statement**: Every external API boundary (request body, query parameters, path parameters) must be validated with strict Zod schemas, returning structured HTTP 400 error envelopes with field-level error messages.
- **Source**: S2 ("Proper validation everywhere"), S3 (OWASP Top 10:2021 A03:2021, OWASP ASVS v4.0.3 V5.1.1, V13.1.1).
- **Testable Acceptance Criteria**:
  - When an invalid payload (e.g. negative quantity, malformed email, missing required fields) is sent to any POST/PUT route:
  - Then the server immediately rejects the request with HTTP 400, code `VALIDATION_ERROR`, and an array of field errors.
- **Verification Method**: API integration test across all endpoints.

### REQ-064: Explicit and Clear Scope Implementation (Owner Requirement)
- **Statement**: All operational scopes (Salesman, Admin, Production Floor, Accountant, Owner) must be clearly defined in code, segregated in routes, and enforced on the server.
- **Source**: S2 ("All scopes clearly implemented"), S3 (OWASP ASVS v4.0.3 V4.1.1).
- **Testable Acceptance Criteria**:
  - In `server/src/policies/` and route middleware:
  - Then every role has an unambiguous permission set, and route guards enforce them at the HTTP controller level.
- **Verification Method**: Unit test and integration test.

---

## 12. Domain: Security Standards (OWASP Top 10, API Top 10, ASVS v4.0.3)

### REQ-065: Server-Side RBAC and ABAC Enforcement
- **Statement**: Authorization must be verified server-side on every request. Frontend navigation hiding or button disabling is never accepted as security authorization.
- **Source**: S3 (OWASP Top 10:2021 A01:2021 Broken Access Control, OWASP API Top 10:2023 API5:2023 Broken Function Level Authorization, ASVS v4.0.3 V4.1.1, V4.1.2).
- **Testable Acceptance Criteria**:
  - When a Salesman session invokes an Admin-only endpoint (e.g. `POST /api/v1/sales/orders/:id/approve`):
  - Then the server returns HTTP 403 Forbidden.
- **Verification Method**: Integration test (`rbac.test.ts`, `abac.test.ts`).

### REQ-066: Broken Object-Level Authorization (BOLA/IDOR) Prevention
- **Statement**: The server must verify that the requesting user has legitimate ownership or organizational rights over the specific resource ID requested in path parameters.
- **Source**: S3 (OWASP Top 10:2021 A01:2021, OWASP API Top 10:2023 API1:2023 Broken Object Level Authorization, ASVS v4.0.3 V4.1.3).
- **Testable Acceptance Criteria**:
  - When a Salesman attempts to read or edit an order ID belonging to another salesman or organization:
  - Then the server returns HTTP 404 or 403.
- **Verification Method**: Integration test.

### REQ-067: Secure Cookie Session Management and CSRF Protection
- **Statement**: Authentication session tokens must be stored in secure, `HttpOnly`, `SameSite=Lax` cookies, with origin verification preventing cross-site request forgery.
- **Source**: S3 (OWASP Top 10:2021 A07:2021 Identification and Authentication Failures, OWASP API Top 10:2023 API2:2023 Broken Authentication, ASVS v4.0.3 V3.1.1, V3.4.1).
- **Testable Acceptance Criteria**:
  - In authentication responses:
  - Then `Set-Cookie` contains `HttpOnly`, `Path=/`, `SameSite=Lax` (and `Secure` in production).
- **Verification Method**: Integration test (`auth.integration.test.ts`).

### REQ-068: SQL Injection Prevention via Parameterized Queries
- **Statement**: All database queries must use parameterized Prisma ORM operations or prepared SQL statements. Raw SQL string concatenation is forbidden.
- **Source**: S3 (OWASP Top 10:2021 A03:2021 Injection, ASVS v4.0.3 V5.3.1).
- **Testable Acceptance Criteria**:
  - Static code analysis confirms zero instances of dynamic SQL string interpolation (`$queryRawUnsafe` with concatenated user input).
- **Verification Method**: Static code scan and oxlint check.

### REQ-069: HTTP Security Headers and Restrictive CORS Policy
- **Statement**: The backend must emit secure HTTP headers via Helmet (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security` in production) and enforce a strict CORS allowlist.
- **Source**: S3 (OWASP Top 10:2021 A05:2021 Security Misconfiguration, OWASP API Top 10:2023 API8:2023 Security Misconfiguration, ASVS v4.0.3 V14.4.1, V14.5.1).
- **Testable Acceptance Criteria**:
  - When inspecting API responses:
  - Then security headers are present, and unauthorized cross-origin requests receive no `Access-Control-Allow-Origin` header.
- **Verification Method**: Integration test (`origins.test.ts`, `app.test.ts`).

### REQ-070: Rate Limiting on Authentication and Sensitive Endpoints
- **Statement**: The server must enforce rate limits on login, password verification, and sensitive posting operations to mitigate brute force and denial of service attacks.
- **Source**: S3 (OWASP API Top 10:2023 API4:2023 Unrestricted Resource Consumption, ASVS v4.0.3 V11.1.4).
- **Testable Acceptance Criteria**:
  - When repeated authentication attempts exceed the configured threshold within 1 minute:
  - Then the server responds with HTTP 429 Too Many Requests.
- **Verification Method**: Integration test.

### REQ-071: Sensitive Data Masking and Zero Secret Exposure
- **Statement**: Secrets, passwords, API tokens, and private credentials must never appear in responses, query logs, client bundles, or version control.
- **Source**: S3 (OWASP Top 10:2021 A02:2021 Cryptographic Failures, ASVS v4.0.3 V8.3.1).
- **Testable Acceptance Criteria**:
  - User and session queries must never select or return the `password` column from `account`.
- **Verification Method**: Integration test and static scan.

---

## 13. Domain: Accessibility and Usability Standards (WCAG 2.2 AA, NN/g, Apple HIG)

### REQ-072: Semantic HTML Landmarks and Accessible Component Names
- **Statement**: All pages must use semantic landmarks (`header`, `nav`, `main`, `footer`, `section`) and every interactive element must have a programmatic accessible name.
- **Source**: S3 (WCAG 2.2 AA SC 1.1.1 Non-text Content, SC 1.3.1 Info and Relationships, SC 4.1.2 Name, Role, Value; Apple HIG: Accessibility).
- **Testable Acceptance Criteria**:
  - Running automated axe-core accessibility checks on all pages:
  - Then zero critical or serious WCAG 2.2 AA violations are reported.
- **Verification Method**: Playwright axe-core audit test.

### REQ-073: Full Keyboard Navigation, Focus Trapping and Visible Focus Indicator
- **Statement**: Every interactive control must be navigable via keyboard (`Tab`, `Shift+Tab`), operable via `Enter`/`Space`, dialogs must trap focus and close on `Escape`, and a visible focus ring must always be shown.
- **Source**: S3 (WCAG 2.2 AA SC 2.1.1 Keyboard, SC 2.1.2 No Keyboard Trap, SC 2.4.3 Focus Order, SC 2.4.7 Focus Visible; NN/g #7 Flexibility and efficiency of use).
- **Testable Acceptance Criteria**:
  - When navigating without a mouse:
  - Then the user can reach and operate all inputs and buttons, modal dialogs trap focus, and a visible 2px-3px focus outline is clearly discernible.
- **Verification Method**: E2E keyboard test (`app-shell.spec.ts`).

### REQ-074: Color Contrast Ratios and Non-Color Status Signaling
- **Statement**: Text must meet minimum WCAG AA contrast (4.5:1 for normal text, 3:1 for large text). Status indicators must combine color with distinct icons or visible text.
- **Source**: S3 (WCAG 2.2 AA SC 1.4.1 Use of Color, SC 1.4.3 Contrast Minimum, SC 1.4.11 Non-text Contrast; Apple HIG: Aesthetic Integrity).
- **Testable Acceptance Criteria**:
  - In all UI themes (light and dark):
  - Then text contrast passes 4.5:1, and status badges (e.g. Approved, Rejected, Shortage) include descriptive text labels.
- **Verification Method**: Automated contrast analysis test.

### REQ-075: Minimum Touch Target Sizing and Responsive Reflow
- **Statement**: Interactive touch targets on mobile viewports must meet at least 44x44 CSS pixels (or WCAG 2.2 SC 2.5.8 minimum 24x24 px with adequate spacing), and content must reflow without horizontal scrolling at 320 px width.
- **Source**: S3 (WCAG 2.2 AA SC 2.5.8 Target Size Minimum; NN/g #7; Apple HIG: Direct Manipulation).
- **Testable Acceptance Criteria**:
  - In mobile viewport (320px width):
  - Then all primary buttons, inputs, and navigation pills measure at least 44px in tap height, and horizontal scrollbar is absent (`scrollWidth === clientWidth`).
- **Verification Method**: Playwright responsive viewport test.

### REQ-076: Form Error Identification, Contextual Guidance and Recovery
- **Statement**: When form validation fails, the UI must clearly highlight invalid fields with associated error messages, describe how to correct them, and move focus to the first invalid field.
- **Source**: S3 (WCAG 2.2 AA SC 3.3.1 Error Identification, SC 3.3.2 Labels or Instructions, SC 3.3.3 Error Suggestion; NN/g #5 Error prevention, NN/g #9 Help users recognize, diagnose, and recover from errors; Apple HIG: Feedback).
- **Testable Acceptance Criteria**:
  - When submitting a form with missing required fields:
  - Then inputs render red error borders, `aria-invalid="true"`, and `aria-describedby` linking to a visible descriptive error message.
- **Verification Method**: E2E form testing.

### REQ-077: Visibility of System Status, Loading States and Dialog Feedback
- **Statement**: The system must keep users informed of status during all asynchronous operations through loading indicators, clear feedback toasts on completion, and explicit confirmation dialogs for destructive actions.
- **Source**: S3 (NN/g #1 Visibility of system status, NN/g #3 User control and freedom; Apple HIG: Feedback, Apple HIG: User Control).
- **Testable Acceptance Criteria**:
  - During server mutations:
  - Then buttons show disabled loading spinners, background operations show toasts via Sonner, and irreversible actions (e.g. posting a run or reversing an invoice) require an explicit confirmation dialog.
- **Verification Method**: E2E interaction test.

### REQ-078: Customer Data Retention, Anonymization & Erasure Schedule (DPDP Act 2023 & CGST Act 2017)
- **Statement**: The system must implement a controlled customer data-erasure and anonymization workflow under Section 12 of the Digital Personal Data Protection (DPDP) Act 2023, while enforcing strict statutory preservation under Section 36 of the Central Goods and Services Tax (CGST) Act 2017 (retaining tax invoices and books of account for 72 months from the due date of furnishing the annual return for the relevant financial year, plus any extended period for pending proceedings).
- **Source**: DPDP Act 2023 (Act No. 22 of 2023, Sections 11 & 12), CGST Act 2017 (Section 36), S2 (Owner Decision OD-08: "DPDP Act 2023 Customer Data Retention, Anonymization & Erasure Schedule").
> [!NOTE] Specification Addition (20 November 2026 — Owner Decision OD-08):
> On verified customer erasure request, personal data no longer required for statutory obligations must be erased or irreversibly anonymized (pseudonymization or reversible hashing does not suffice). Statutory GST invoices and accounting records must never be removed or rewritten during their mandatory 72-month retention period (calculated from the annual return due date, not the invoice date). Retained statutory records are restricted strictly to authorized accounting, compliance, and audit personnel and barred from sales or marketing operations. A complete audit log of erasure requests, legal exceptions, and retention expiry dates is maintained, with automated reassessment and erasure upon retention expiration.
- **Testable Acceptance Criteria**:
  - When an erasure request is executed for a customer with active posted invoices within the 72-month statutory retention window:
  - Then personal contact information (email, personal phone, billing notes) is irreversibly anonymized, while statutory invoice records (GSTIN, legal name, tax breakdown, document sequence) are preserved under restricted audit-only access.
  - When an erasure request is executed for a contact with zero statutory financial transactions:
  - Then customer PII is fully purged/anonymized from all operational tables.
- **Verification Method**: Integration test (`dpdp-retention.test.ts`).

---

## 14. Formal Owner Decisions Baseline

The following 9 owner decisions represent the binding implementation baseline (formally updated with verbatim Owner Decisions on 20 November 2026):

1. **Image Hash Technique & Asset Pipeline (MANDATORY)**:
   > [!WARNING] Specification Change Notice (20 November 2026):
   > Supersedes prior assumption that placeholders were optional. Per Owner Decision OD-05, both mechanisms are approved and mandatory:
   > - **Product Imagery**: Generate ThumbHash compact progressive blur placeholders during the image upload pipeline. Serve responsive modern formats (AVIF/WebP) with intrinsic dimensions to eliminate layout shifts (CLS). Above-the-fold LCP images must never be delayed by placeholder processing or lazy loading.
   > - **Proof-of-Delivery & Receipts**: Generate server-side SHA-256 checksums upon upload. Store checksums with document metadata and immutable audit records for tenant-scoped deduplication and document tamper-proofing.
2. **SEO Scope (Metadata, Not Public Indexing)**: Keep authenticated ERP pages `noindex` via `X-Robots-Tag: noindex, nofollow`. Implement descriptive page titles, semantic HTML, and metadata throughout the application. Public landing pages may be indexed.
3. **Super Admin Provisioning & System-Wide Permissions (Owner Decision OD-02)**: Interactive CLI `pnpm admin:bootstrap` is the exclusive mechanism to provision the initial super administrator. Input password must be hidden; passwords hashed with secure application algorithm; initial admin check prevents re-runs; zero secrets stored in seed files, environment variables, or logs. Privileged actions must be audited. Never allow direct modification or deletion of posted ledger entries; corrections must use reversal entries.
4. **Booking Screens (Sales Order Booking)**: Treat booking as field-sales/customer order booking. Product images must always have readable text labels and ThumbHash placeholders. Production batches and scheduling must use clear text-based identifiers.
5. **Master Entity UI (All 10 Entities)**: All ten master entities (Suppliers, Customers, Raw Materials, Packaging Materials, Finished Goods SKUs, BOM Recipes, Facilities, Warehouses, Units of Measure, and Price Lists) must be manageable through the UI. Support create, view, update, and deactivate operations. Prevent deletion where historical transactions reference the record.
6. **Dynamic Statutory GST Rate Master (Owner Decision OD-01)**: `TaxRate` master table is the authoritative source for statutory GST rates, matched by HSN code and effective date. Invoice finalization fails safely without fallback to static product column if unconfigured. Immutable snapshots of rates and tax breakdown are preserved on invoice lines; historical invoices never recalculated; overlapping effective dates prevented; static `product.taxRate` deprecated and removed.
7. **Opening Finished Goods Costing (FIFO)**: Use FIFO inventory costing. The 50 opening packets retain their recorded opening valuation (₹0 in the benchmark), while subsequent production is valued at its actual cost. Do not blend costs across inventory layers.
8. **Threshold Discount Guard & Pricing Policy (Owner Decision OD-07)**: Base rates derive strictly from the customer's assigned price list. Discounts follow the exact policy: up to 5% salesman discretion, 5% to 15% requires explicit Manager approval (enforced via dedicated manager permission, not assumed admin equivalence), and above 15% is rejected by the server. All calculations use precise decimal arithmetic and are fully audited.
9. **Offline Synchronization Conflict Queue (Owner Decision OD-04)**: When offline orders encounter stock shortages, the server atomically creates the order in `STOCK_SHORTAGE_CONFLICT` database state using row locking (`SELECT ... FOR UPDATE`), reserving only available units and recording the exact shortage. Conflicting orders route to an explicit Conflict Queue for triage. Notifications emit via transactional outbox post-commit. Repeated sync requests are idempotent.
10. **Compensating Journal Entries, Payment Bounces & Dedicated Debit Notes (Owner Decision OD-06)**: Introduce `PaymentStatus.BOUNCED` for cheque/NACH dishonour, transactionally reversing invoice allocations and restoring customer outstanding balances without deleting payment history. Maintain a dedicated `DebitNote` model for supplier purchase returns, short deliveries, and price adjustments, cleanly separated from customer credit notes.
11. **Statutory Data Retention & Privacy Erasure Schedule (Owner Decision OD-08)**: Privacy-first customer data erasure under DPDP Act 2023 with CGST Act Section 36 statutory retention safeguards (preserving tax invoice and accounting records for 72 months from annual return due date under restricted audit access).

