# MillLedger ERP Comprehensive Data Dictionary

This document provides a field-by-field, column-by-column Data Dictionary for all 40 database models and 12 enums defined in `server/prisma/schema.prisma`.

---

## 1. Mathematical & Precision Conventions

To guarantee financial and inventory accuracy without IEEE 754 floating-point rounding errors:

- **Financial Balances & Taxes (`Decimal(15,2)`)**: Stored with 2 decimal places (exact paise). Examples: `taxableAmount`, `cgstAmount`, `sgstAmount`, `igstAmount`, `totalAmount`, `outstandingAmount`, `allocatedAmount`.
- **Physical Quantities & Unit Costs (`Decimal(18,6)`)**: Stored with 6 decimal places (micro-unit precision) to prevent rounding drift during multi-stage recipe bill-of-materials conversion, wastage calculation, and moving weighted-average inventory costing. Examples: `currentStock`, `unitCost`, `weightedAverageCost`, `quantity`, `yieldQuantity`.
- **Primary Keys**: CUID (`String @id @default(cuid())`) or UUID strings.
- **Timestamps**: `DateTime @default(now())` stored in UTC. Application displays timestamps in Indian Standard Time (IST, `Asia/Kolkata`).

---

## 2. Enumerations

### 2.1 `ItemCategory`

Categories classifying inventory items:

- `RAW_MATERIAL`: Raw grains, flour, spices, cooking oils.
- `PACKAGING`: Packing pouches, corrugated cartons, sealing labels.
- `WORK_IN_PROGRESS`: Intermediate doughs, unroasted mixes.
- `FINISHED_GOOD`: Final consumer packaged food products (e.g., 200g Murukku packets).

### 2.2 `MovementType`

Traceable stock movement classifications:

- `PURCHASE_RECEIPT`: Inward stock from vendor purchase.
- `PRODUCTION_ISSUE`: Outward raw material consumed into a production batch.
- `PRODUCTION_RECEIPT`: Inward finished goods produced from a batch.
- `DISPATCH`: Outward finished goods shipped to customer against an approved sales order.
- `WASTAGE_DAMAGED`: Stock written off due to quality rejection or damage.
- `ADJUSTMENT`: Physical stock audit correction.
- `REVERSAL`: Compensating transaction reversing a previously posted run.

### 2.3 `RecipeItemType`

Roles of materials in bill-of-materials:

- `INPUT`: Raw material consumed in recipe.
- `PACKAGING`: Packaging material consumed per unit produced.
- `OUTPUT`: Primary finished product.
- `BYPRODUCT`: Secondary consumable or saleable scrap.

### 2.4 `ProductionRunStatus`

Lifecycle states of a manufacturing run:

- `DRAFT`: Initial preparation of batch.
- `IN_PROGRESS`: Floor processing underway.
- `COMPLETED`: Run finished, output packets recorded and costed.
- `REVERSED`: Production batch cancelled and stock reversed via compensating ledger movements.

### 2.5 `OrderStatus`

Lifecycle states of a sales order:

- `DRAFT`: Local unsubmitted draft.
- `SUBMITTED`: Placed by salesman; stock atomically reserved.
- `APPROVED`: Reviewed and approved by admin/owner.
- `REJECTED`: Cancelled by admin or customer.

### 2.6 `FulfilmentStatus`

Order dispatch completion status:

- `UNFULFILLED`: No goods dispatched.
- `PARTIALLY_FULFILLED`: Partial shipment dispatched.
- `FULFILLED`: All ordered items dispatched.

### 2.7 `ReservationStatus`

Atomic inventory reservation status:

- `ACTIVE`: Quantity is reserved and unavailable for other orders.
- `RELEASED`: Reservation fulfilled via dispatch.
- `CANCELLED`: Order cancelled; reserved quantity returned to available pool.

### 2.8 `InvoiceStatus`

Statutory sales invoice lifecycle:

- `DRAFT`: Pro-forma invoice.
- `POSTED`: Final tax invoice posted; immutable; assigned gapless GST financial-year sequence.
- `PAID`: Outstanding balance reduced to zero via payment allocations.
- `CANCELLED`: Cancelled prior to delivery or offset via Credit Note.

### 2.9 `DispatchStatus`

Goods dispatch note status:

- `PENDING`: Staged for loading.
- `DISPATCHED`: Transport initiated; stock deducted from warehouse.
- `DELIVERED`: Confirmed delivered to customer premises.

### 2.10 `DebitNoteStatus`

Vendor purchase debit note status:

- `DRAFT`: Initial draft.
- `POSTED`: Confirmed and submitted to vendor.

### 2.11 `PaymentMode`

Modes of monetary receipt:

- `CASH`, `BANK_TRANSFER`, `UPI`, `CHEQUE`, `CREDIT_CARD`.

### 2.12 `PaymentStatus`

State of customer payment allocation:

- `UNALLOCATED`: Payment recorded but not linked to invoices.
- `PARTIALLY_ALLOCATED`: Portion applied to invoices; unallocated balance remains.
- `FULLY_ALLOCATED`: Entire payment sum applied across invoices.

---

## 3. Auth, Tenancy & Organization Models

### `User`

Accounts for system actors across roles.

- `id` (`String`, PK): CUID identifier.
- `name` (`String`): Full name.
- `email` (`String`, Unique): Work email address.
- `emailVerified` (`Boolean`): Verification status.
- `image` (`String?`): Optional profile avatar URL.
- `role` (`String`): RBAC role (`ADMIN`, `SALESMAN`, `PRODUCTION_MANAGER`, `AUDITOR`).
- `organizationId` (`String?`, FK -> `Organization.id`): Tenant isolation key.
- `createdAt`, `updatedAt` (`DateTime`).

### `Session`

Active Better Auth web sessions.

- `id` (`String`, PK): Session token ID.
- `userId` (`String`, FK -> `User.id`): Authenticated user.
- `token` (`String`, Unique): Cryptographic session bearer token.
- `expiresAt` (`DateTime`): Expiry timestamp.
- `ipAddress`, `userAgent` (`String?`): Client telemetry.
- `organizationId` (`String?`): Tenant session context.
- `createdAt`, `updatedAt` (`DateTime`).

### `Account`

Authentication credentials and OAuth links.

- `id` (`String`, PK): Account ID.
- `userId` (`String`, FK -> `User.id`): Associated user.
- `accountId` (`String`): Provider account identifier.
- `providerId` (`String`): Provider (`credential`, etc.).
- `password` (`String?`): Argon2id / bcrypt salted password hash.
- `createdAt`, `updatedAt` (`DateTime`).

### `Verification`

One-time tokens for email verification and password resets.

- `id` (`String`, PK): Token ID.
- `identifier` (`String`): Target user email.
- `value` (`String`): One-time verification token.
- `expiresAt` (`DateTime`): Expiry timestamp.
- `createdAt`, `updatedAt` (`DateTime`).

### `Organization`

Top-level multi-tenant mill enterprise entity.

- `id` (`String`, PK): Organization key (e.g., `"MILL"`).
- `name` (`String`): Registered business trade name.
- `code` (`String`, Unique): Organization short code.
- `gstin` (`String?`): 15-character GST Identification Number.
- `address`, `city`, `state`, `pincode` (`String?`): Registered business address.
- `phone`, `email` (`String?`): Contact info.
- `createdAt`, `updatedAt` (`DateTime`).

### `Facility`

Physical operational milling and packing plants.

- `id` (`String`, PK): Facility ID.
- `organizationId` (`String`, FK -> `Organization.id`): Parent organization.
- `name` (`String`): Plant facility name.
- `code` (`String`, Unique): Facility code.
- `createdAt`, `updatedAt` (`DateTime`).

### `Warehouse`

Specific storage zones within a facility (raw storage, finished goods cold room).

- `id` (`String`, PK): Warehouse ID.
- `facilityId` (`String`, FK -> `Facility.id`): Parent facility.
- `name` (`String`): Storage location name.
- `code` (`String`, Unique): Warehouse code.
- `createdAt`, `updatedAt` (`DateTime`).

---

## 4. Master Data Models

### `Customer`

Wholesale distributors, retail stores, and direct buyers.

- `id` (`String`, PK): Customer ID.
- `organizationId` (`String`, FK -> `Organization.id`): Owning tenant.
- `name` (`String`): Registered business name.
- `code` (`String`, Unique): Short code (e.g. `CUST-RET-A`).
- `gstin` (`String?`): 15-character GSTIN. Null for unregistered retailers.
- `state` (`String`): State of supply for GST classification (e.g. `"Tamil Nadu"`, `"Karnataka"`).
- `address`, `city`, `pincode`, `phone`, `email` (`String?`).
- `creditLimit` (`Decimal(15,2)`, Default `0.00`): Maximum authorized credit exposure.
- `creditDays` (`Int`, Default `30`): Payment due period.
- `active` (`Boolean`, Default `true`).
- `createdAt`, `updatedAt` (`DateTime`).

### `SalesmanCustomerAssignment`

ABAC salesman geographic account scoping table.

- `id` (`String`, PK): Assignment ID.
- `salesmanId` (`String`, FK -> `User.id`): Assigned sales representative.
- `customerId` (`String`, FK -> `Customer.id`): Assigned customer account.
- `assignedAt` (`DateTime`, Default `now()`).

### `Supplier`

Raw material and packaging vendors.

- `id` (`String`, PK): Supplier ID.
- `organizationId` (`String`, FK -> `Organization.id`): Tenant key.
- `name` (`String`): Vendor name.
- `code` (`String`, Unique): Supplier short code.
- `gstin` (`String?`): Vendor GSTIN.
- `state`, `address`, `city`, `phone`, `email` (`String?`).
- `createdAt`, `updatedAt` (`DateTime`).

### `UnitOfMeasure`

Physical units of measurement.

- `id` (`String`, PK): UOM ID.
- `name` (`String`): Full unit name (`Kilogram`, `Litre`, `Pouch`).
- `code` (`String`, Unique): Abbreviation (`KG`, `L`, `PKT`, `BOX`).
- `symbol` (`String`): Notation symbol.
- `createdAt`, `updatedAt` (`DateTime`).

### `UnitConversion`

Dimensional conversions between measurement units.

- `id` (`String`, PK): Conversion ID.
- `fromUomId` (`String`, FK -> `UnitOfMeasure.id`): Source unit.
- `toUomId` (`String`, FK -> `UnitOfMeasure.id`): Target unit.
- `conversionFactor` (`Decimal(18,6)`): Multiplier factor.
- `createdAt`, `updatedAt` (`DateTime`).

### `InventoryItem`

Tracked inventory SKUs with real-time stock balances.

- `id` (`String`, PK): Item ID.
- `organizationId` (`String`, FK -> `Organization.id`): Tenant key.
- `sku` (`String`, Unique): SKU code (e.g. `RM-FLOUR`, `FG-MURUKKU-200G`).
- `name` (`String`): Item description.
- `category` (`ItemCategory`): Enum item category.
- `uomId` (`String`, FK -> `UnitOfMeasure.id`): Base unit of measure.
- `hsnCode` (`String?`): 4, 6, or 8-digit statutory HSN/SAC code.
- `currentStock` (`Decimal(18,6)`, Default `0.000000`): Physical stock on hand. Protected by DB check constraint `chk_current_stock_non_negative`.
- `weightedAverageCost` (`Decimal(18,6)`, Default `0.000000`): Continuous moving weighted-average cost per unit.
- `minimumStock`, `reorderPoint` (`Decimal(18,6)?`): Inventory replenishment thresholds.
- `active` (`Boolean`, Default `true`).
- `createdAt`, `updatedAt` (`DateTime`).

### `Product` & `ProductVariant`

Manufactured goods hierarchy and pack sizes.

- `id` (`String`, PK).
- `name`, `code` (`String`).
- `inventoryItemId` (`String`, FK -> `InventoryItem.id`): Linked finished good SKU.
- `packSize` (`Decimal(18,6)`): Net weight/volume per unit.

### `Recipe` & `RecipeItem`

Manufacturing bill-of-materials (BOM) formulas.

- `Recipe`:
  - `id` (`String`, PK).
  - `name`, `code` (`String`).
  - `expectedYieldQuantity` (`Decimal(18,6)`): Target output per recipe batch.
  - `yieldTolerancePercent` (`Decimal(5,2)`, Default `5.00`): Allowed yield variance threshold.
- `RecipeItem`:
  - `id` (`String`, PK).
  - `recipeId` (`String`, FK -> `Recipe.id`): Parent recipe.
  - `inventoryItemId` (`String`, FK -> `InventoryItem.id`): Consumed material SKU.
  - `type` (`RecipeItemType`): Enum (`INPUT`, `PACKAGING`, etc.).
  - `quantity` (`Decimal(18,6)`): Formula quantity required per batch.

### `TaxRate`

Statutory Goods and Services Tax schedule.

- `id` (`String`, PK): Tax rate ID.
- `code` (`String`, Unique): Tax identifier (`GST_5`, `GST_12`, `GST_18`).
- `name` (`String`): Rate description.
- `rate` (`Decimal(5,2)`): Total tax percentage (e.g. `5.00`).
- `cgstRate` (`Decimal(5,2)`): Central tax rate (e.g. `2.50`).
- `sgstRate` (`Decimal(5,2)`): State tax rate (e.g. `2.50`).
- `igstRate` (`Decimal(5,2)`): Integrated inter-state tax rate (e.g. `5.00`).
- `effectiveFrom` (`DateTime`): Inception date.
- `effectiveTo` (`DateTime?`): Expiry date.

---

## 5. Inventory Ledger & Reservation Models

### `StockMovement`

Immutable inventory double-entry transaction ledger.

- `id` (`String`, PK): Movement ID.
- `inventoryItemId` (`String`, FK -> `InventoryItem.id`): Affected SKU.
- `warehouseId` (`String`, FK -> `Warehouse.id`): Location.
- `movementType` (`MovementType`): Transaction classification.
- `quantity` (`Decimal(18,6)`): Signed quantity change (+ for inward, - for outward).
- `unitCost` (`Decimal(18,6)`): Exact cost per unit of this movement.
- `totalCost` (`Decimal(15,2)`): Total monetary valuation (`quantity * unitCost`).
- `referenceType` (`String`): Originating document type (`PURCHASE_RECEIPT`, `PRODUCTION_RUN`, `DISPATCH`).
- `referenceId` (`String`): Originating document ID.
- `batchNumber` (`String?`): Production lot or procurement batch.
- `notes` (`String?`).
- `createdAt` (`DateTime`, Default `now()`).

### `StockReservation`

Atomic stock reservation holding finished goods for approved sales orders.

- `id` (`String`, PK): Reservation ID.
- `salesOrderId` (`String`, FK -> `SalesOrder.id`): Linked order.
- `inventoryItemId` (`String`, FK -> `InventoryItem.id`): Reserved SKU.
- `reservedQuantity` (`Decimal(18,6)`): Reserved quantity.
- `releasedQuantity` (`Decimal(18,6)`, Default `0.000000`): Quantity converted to dispatch.
- `status` (`ReservationStatus`, Default `ACTIVE`): Lifecycle state.
- `createdAt`, `updatedAt` (`DateTime`).

---

## 6. Manufacturing & Production Models

### `ProductionRun`

Recorded manufacturing batch execution.

- `id` (`String`, PK): Run ID.
- `organizationId` (`String`, FK -> `Organization.id`): Tenant key.
- `runNumber` (`String`, Unique): Document number (`PR-2026-0001`).
- `recipeId` (`String`, FK -> `Recipe.id`): Formula used.
- `status` (`ProductionRunStatus`): Current lifecycle state.
- `plannedQuantity` (`Decimal(18,6)`): Target production volume.
- `actualGoodQuantity` (`Decimal(18,6)`): Sound commercial units produced.
- `actualDamagedQuantity` (`Decimal(18,6)`): Damaged or rejected units.
- `yieldVariancePercent` (`Decimal(5,2)`): Deviation from standard recipe yield.
- `totalCost` (`Decimal(15,2)`): Aggregated cost of consumed materials.
- `costPerUnit` (`Decimal(18,6)`): Cost per good unit (`totalCost / actualGoodQuantity`).
- `idempotencyKey` (`String?`, Unique): Prevents duplicate posting races.
- `postedAt`, `createdAt`, `updatedAt` (`DateTime`).

### `ProductionRunMaterial`

Bill of actual materials consumed in a specific production run.

- `id` (`String`, PK).
- `productionRunId` (`String`, FK -> `ProductionRun.id`): Linked run.
- `inventoryItemId` (`String`, FK -> `InventoryItem.id`): Consumed SKU.
- `standardQuantity` (`Decimal(18,6)`): Expected theoretical consumption.
- `actualQuantity` (`Decimal(18,6)`): Actual physical consumption recorded.
- `unitCost` (`Decimal(18,6)`): Moving average cost at consumption time.
- `totalCost` (`Decimal(15,2)`): Total line cost (`actualQuantity * unitCost`).
- `variancePercent` (`Decimal(5,2)`): Consumption variance percentage.

### `ProductionRunReversal`

Audit record of compensated production run cancellation.

- `id` (`String`, PK).
- `productionRunId` (`String`, FK -> `ProductionRun.id`, Unique): Cancelled run.
- `reason` (`String`): Reason for cancellation.
- `reversedBy` (`String`, FK -> `User.id`): Operator initiating reversal.
- `createdAt` (`DateTime`, Default `now()`).

---

## 7. Procurement Models

### `PurchaseReceipt` & `PurchaseReceiptLine`

Vendor inward goods receiving vouchers.

- `PurchaseReceipt`:
  - `id` (`String`, PK).
  - `organizationId` (`String`, FK -> `Organization.id`).
  - `receiptNumber` (`String`, Unique): Document number (`GRN-2026-0001`).
  - `supplierId` (`String`, FK -> `Supplier.id`).
  - `totalAmount` (`Decimal(15,2)`): Total purchase cost.
  - `idempotencyKey` (`String?`, Unique): Prevents duplicate receipt postings.
  - `receivedAt`, `createdAt`, `updatedAt` (`DateTime`).
- `PurchaseReceiptLine`:
  - `id` (`String`, PK).
  - `purchaseReceiptId` (`String`, FK -> `PurchaseReceipt.id`).
  - `inventoryItemId` (`String`, FK -> `InventoryItem.id`).
  - `quantity` (`Decimal(18,6)`): Inward quantity.
  - `unitPrice` (`Decimal(18,6)`): Purchase price per unit.
  - `totalPrice` (`Decimal(15,2)`): Line amount.

---

## 8. Sales, Invoicing & Fulfilment Models

### `SalesOrder` & `SalesOrderLine`

Sales order agreements submitted by salesmen.

- `SalesOrder`:
  - `id` (`String`, PK).
  - `organizationId` (`String`, FK -> `Organization.id`).
  - `orderNumber` (`String`, Unique): Document number (`SO-2026-0001`).
  - `customerId` (`String`, FK -> `Customer.id`).
  - `salesmanId` (`String`, FK -> `User.id`).
  - `orderStatus` (`OrderStatus`, Default `DRAFT`).
  - `fulfilmentStatus` (`FulfilmentStatus`, Default `UNFULFILLED`).
  - `totalTaxableAmount` (`Decimal(15,2)`).
  - `totalTaxAmount` (`Decimal(15,2)`).
  - `totalAmount` (`Decimal(15,2)`): Taxable + total taxes.
  - `idempotencyKey` (`String?`, Unique): Prevents duplicate submissions.
  - `createdAt`, `updatedAt` (`DateTime`).
- `SalesOrderLine`:
  - `id` (`String`, PK).
  - `salesOrderId` (`String`, FK -> `SalesOrder.id`).
  - `inventoryItemId` (`String`, FK -> `InventoryItem.id`).
  - `quantity` (`Decimal(18,6)`).
  - `unitPrice` (`Decimal(18,6)`).
  - `taxRateId` (`String`, FK -> `TaxRate.id`).
  - `taxableAmount`, `cgstAmount`, `sgstAmount`, `igstAmount`, `lineTotal` (`Decimal(15,2)`).

### `SalesInvoice` & `SalesInvoiceLine`

Statutory GST Tax Invoices.

- `SalesInvoice`:
  - `id` (`String`, PK).
  - `organizationId` (`String`, FK -> `Organization.id`).
  - `invoiceNumber` (`String`, Unique): Strict gapless financial year sequence (`INV/2026-27/0001`).
  - `salesOrderId` (`String?`, FK -> `SalesOrder.id`).
  - `customerId` (`String`, FK -> `Customer.id`).
  - `status` (`InvoiceStatus`, Default `DRAFT`).
  - `taxableAmount`, `cgstAmount`, `sgstAmount`, `igstAmount`, `totalTaxAmount`, `totalAmount` (`Decimal(15,2)`).
  - `paidAmount` (`Decimal(15,2)`, Default `0.00`): Sum of allocated payments.
  - `outstandingAmount` (`Decimal(15,2)`): Total invoice balance remaining.
  - `financialYear` (`String`): GST financial year (`"2026-27"`).
  - `postedAt` (`DateTime?`): Timestamp of formal invoice posting.
  - `createdAt`, `updatedAt` (`DateTime`).
- `SalesInvoiceLine`:
  - `id` (`String`, PK).
  - `salesInvoiceId` (`String`, FK -> `SalesInvoice.id`).
  - `inventoryItemId` (`String`, FK -> `InventoryItem.id`).
  - `quantity` (`Decimal(18,6)`).
  - `unitPrice` (`Decimal(18,6)`).
  - `taxableAmount`, `cgstAmount`, `sgstAmount`, `igstAmount`, `lineTotal` (`Decimal(15,2)`).

### `Dispatch` & `DispatchLine`

Warehouse delivery and transport orders.

- `Dispatch`:
  - `id` (`String`, PK).
  - `dispatchNumber` (`String`, Unique): Document number (`DSP-2026-0001`).
  - `salesOrderId` (`String`, FK -> `SalesOrder.id`).
  - `status` (`DispatchStatus`, Default `PENDING`).
  - `dispatchedAt`, `createdAt`, `updatedAt` (`DateTime`).
- `DispatchLine`:
  - `id` (`String`, PK).
  - `dispatchId` (`String`, FK -> `Dispatch.id`).
  - `inventoryItemId` (`String`, FK -> `InventoryItem.id`).
  - `quantity` (`Decimal(18,6)`).

---

## 9. Payments & Adjustments Models

### `Payment`

Monetary collections from customers.

- `id` (`String`, PK).
- `paymentNumber` (`String`, Unique): Document number (`PAY-2026-0001`).
- `customerId` (`String`, FK -> `Customer.id`).
- `amount` (`Decimal(15,2)`): Total amount collected.
- `unallocatedAmount` (`Decimal(15,2)`): Amount not yet applied to invoices.
- `paymentMode` (`PaymentMode`).
- `paymentDate` (`DateTime`).
- `referenceNumber` (`String?`): Cheque/NEFT/UPI reference.
- `createdAt`, `updatedAt` (`DateTime`).

### `PaymentAllocation`

FIFO or selective matching of payments against outstanding invoices.

- `id` (`String`, PK).
- `paymentId` (`String`, FK -> `Payment.id`).
- `salesInvoiceId` (`String`, FK -> `SalesInvoice.id`).
- `amount` (`Decimal(15,2)`): Amount applied to invoice.
- `allocatedAt` (`DateTime`, Default `now()`).

### `CreditNote` & `DebitNote`

Adjustments for returns, discounts, or supply shortages.

- `CreditNote`:
  - `id` (`String`, PK).
  - `creditNoteNumber` (`String`, Unique): Document number (`CN-2026-0001`).
  - `salesInvoiceId` (`String`, FK -> `SalesInvoice.id`).
  - `amount`, `taxAmount`, `totalAmount` (`Decimal(15,2)`).
  - `reason` (`String`).
  - `createdAt`, `updatedAt` (`DateTime`).
- `DebitNote` & `DebitNoteLine`: Adjustments issued to suppliers against purchase receipts.

---

## 10. Audit & Governance Models

### `AuditLog`

Append-only tamper-resistant operational audit ledger.

- `id` (`String`, PK): UUID identifier.
- `userId` (`String?`): Operator executing the action.
- `action` (`String`): Action verb (`LOGIN`, `CREATE`, `APPROVE`, `POST`, `DISPATCH`, `EXPORT`).
- `resource` (`String`): Affected domain entity (`SALES_ORDER`, `INVOICE`, `REPORT`).
- `details` (`Json?`): Structured payload containing metadata, changed fields, and IP.
- `createdAt` (`DateTime`, Default `now()`).

### `DocumentSequence`

Atomic gapless statutory document numbering sequence generator.

- `id` (`String`, PK).
- `organizationId` (`String`, FK -> `Organization.id`).
- `type` (`String`): Sequence type (`INVOICE`, `ORDER`, `DISPATCH`, `PAYMENT`, `PRODUCTION`).
- `financialYear` (`String`): Accounting year (`"2026-27"`).
- `prefix` (`String`): Sequence prefix (e.g., `"INV/2026-27/"`).
- `currentValue` (`Int`, Default `0`): Monotonically increasing atomic sequence counter.
- `updatedAt` (`DateTime`).
