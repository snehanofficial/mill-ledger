# Prisma Schema vs Database Drift Report

Database URL: `postgresql://postgres:***@localhost:5432/mill_ledger_audit_throwaway?schema=public`

## Summary

- Prisma Models Count: 38
- Prisma Enums Count: 11
- PostgreSQL Tables Count: 39
- Tables only in PostgreSQL: _prisma_migrations
- Tables only in Prisma: None

> Note: `_prisma_migrations` is Prisma internal metadata table, expected to be in DB only.

## Model and Table Drift Analysis

| Model Name | Table Name in DB | Prisma Field Count | DB Column Count | Status | Notes |
|------------|------------------|--------------------|-----------------|--------|-------|
| `User` | `user` | 10 | 10 | MATCH | Exact match |
| `Session` | `session` | 8 | 8 | MATCH | Exact match |
| `Account` | `account` | 13 | 13 | MATCH | Exact match |
| `Verification` | `verification` | 6 | 6 | MATCH | Exact match |
| `Organization` | `organization` | 7 | 7 | MATCH | Exact match |
| `Facility` | `facility` | 7 | 7 | MATCH | Exact match |
| `Warehouse` | `warehouse` | 6 | 6 | MATCH | Exact match |
| `Customer` | `customer` | 11 | 11 | MATCH | Exact match |
| `SalesmanCustomerAssignment` | `salesman_customer_assignment` | 4 | 4 | MATCH | Exact match |
| `Supplier` | `supplier` | 11 | 11 | MATCH | Exact match |
| `UnitOfMeasure` | `unit_of_measure` | 7 | 7 | MATCH | Exact match |
| `UnitConversion` | `unit_conversion` | 6 | 6 | MATCH | Exact match |
| `InventoryItem` | `inventory_item` | 11 | 11 | MATCH | Exact match |
| `StockMovement` | `stock_movement` | 12 | 12 | MATCH | Exact match |
| `Product` | `product` | 9 | 9 | MATCH | Exact match |
| `ProductVariant` | `product_variant` | 10 | 10 | MATCH | Exact match |
| `Recipe` | `recipe` | 11 | 11 | MATCH | Exact match |
| `RecipeItem` | `recipe_item` | 9 | 9 | MATCH | Exact match |
| `PriceList` | `price_list` | 10 | 10 | MATCH | Exact match |
| `PriceListLine` | `price_list_line` | 6 | 6 | MATCH | Exact match |
| `TaxRate` | `tax_rate` | 11 | 11 | MATCH | Exact match |
| `PurchaseReceipt` | `purchase_receipt` | 13 | 13 | MATCH | Exact match |
| `PurchaseReceiptLine` | `purchase_receipt_line` | 9 | 9 | MATCH | Exact match |
| `ProductionRun` | `production_run` | 26 | 26 | MATCH | Exact match |
| `ProductionRunMaterial` | `production_run_material` | 14 | 14 | MATCH | Exact match |
| `ProductionRunReversal` | `production_run_reversal` | 6 | 6 | MATCH | Exact match |
| `SalesOrder` | `sales_order` | 25 | 25 | MATCH | Exact match |
| `SalesOrderLine` | `sales_order_line` | 15 | 15 | MATCH | Exact match |
| `StockReservation` | `stock_reservation` | 10 | 10 | MATCH | Exact match |
| `SalesInvoice` | `sales_invoice` | 27 | 27 | MATCH | Exact match |
| `SalesInvoiceLine` | `sales_invoice_line` | 17 | 17 | MATCH | Exact match |
| `Dispatch` | `dispatch` | 15 | 15 | MATCH | Exact match |
| `DispatchLine` | `dispatch_line` | 7 | 7 | MATCH | Exact match |
| `CreditNote` | `credit_note` | 11 | 11 | MATCH | Exact match |
| `Payment` | `payment` | 15 | 15 | MATCH | Exact match |
| `PaymentAllocation` | `payment_allocation` | 7 | 7 | MATCH | Exact match |
| `AuditLog` | `audit_log` | 12 | 12 | MATCH | Exact match |
| `DocumentSequence` | `document_sequences` | 6 | 6 | MATCH | Exact match |

## Check Constraints (Custom Migration SQL Constraints)

| Table | Constraint Name | Check Clause |
|-------|-----------------|--------------|
| `_prisma_migrations` | `_prisma_migrations_applied_steps_count_not_null` | `applied_steps_count IS NOT NULL` |
| `_prisma_migrations` | `_prisma_migrations_checksum_not_null` | `checksum IS NOT NULL` |
| `_prisma_migrations` | `_prisma_migrations_id_not_null` | `id IS NOT NULL` |
| `_prisma_migrations` | `_prisma_migrations_migration_name_not_null` | `migration_name IS NOT NULL` |
| `_prisma_migrations` | `_prisma_migrations_started_at_not_null` | `started_at IS NOT NULL` |
| `account` | `account_accountId_not_null` | `accountId IS NOT NULL` |
| `account` | `account_createdAt_not_null` | `createdAt IS NOT NULL` |
| `account` | `account_id_not_null` | `id IS NOT NULL` |
| `account` | `account_providerId_not_null` | `providerId IS NOT NULL` |
| `account` | `account_updatedAt_not_null` | `updatedAt IS NOT NULL` |
| `account` | `account_userId_not_null` | `userId IS NOT NULL` |
| `audit_log` | `audit_log_action_not_null` | `action IS NOT NULL` |
| `audit_log` | `audit_log_entity_not_null` | `entity IS NOT NULL` |
| `audit_log` | `audit_log_id_not_null` | `id IS NOT NULL` |
| `audit_log` | `audit_log_organizationId_not_null` | `organizationId IS NOT NULL` |
| `audit_log` | `audit_log_timestamp_not_null` | `timestamp IS NOT NULL` |
| `credit_note` | `credit_note_createdAt_not_null` | `createdAt IS NOT NULL` |
| `credit_note` | `credit_note_creditNoteNumber_not_null` | `creditNoteNumber IS NOT NULL` |
| `credit_note` | `credit_note_id_not_null` | `id IS NOT NULL` |
| `credit_note` | `credit_note_organizationId_not_null` | `organizationId IS NOT NULL` |
| `credit_note` | `credit_note_postedAt_not_null` | `postedAt IS NOT NULL` |
| `credit_note` | `credit_note_reason_not_null` | `reason IS NOT NULL` |
| `credit_note` | `credit_note_salesInvoiceId_not_null` | `salesInvoiceId IS NOT NULL` |
| `credit_note` | `credit_note_taxAmount_not_null` | `taxAmount IS NOT NULL` |
| `credit_note` | `credit_note_taxableAmount_not_null` | `taxableAmount IS NOT NULL` |
| `credit_note` | `credit_note_totalAmount_not_null` | `totalAmount IS NOT NULL` |
| `credit_note` | `credit_note_updatedAt_not_null` | `updatedAt IS NOT NULL` |
| `customer` | `customer_code_not_null` | `code IS NOT NULL` |
| `customer` | `customer_createdAt_not_null` | `createdAt IS NOT NULL` |
| `customer` | `customer_id_not_null` | `id IS NOT NULL` |
| `customer` | `customer_isActive_not_null` | `isActive IS NOT NULL` |
| `customer` | `customer_name_not_null` | `name IS NOT NULL` |
| `customer` | `customer_organizationId_not_null` | `organizationId IS NOT NULL` |
| `customer` | `customer_state_not_null` | `state IS NOT NULL` |
| `customer` | `customer_updatedAt_not_null` | `updatedAt IS NOT NULL` |
| `dispatch` | `dispatch_createdAt_not_null` | `createdAt IS NOT NULL` |
| `dispatch` | `dispatch_dispatchNumber_not_null` | `dispatchNumber IS NOT NULL` |
| `dispatch` | `dispatch_dispatchedAt_not_null` | `dispatchedAt IS NOT NULL` |
| `dispatch` | `dispatch_id_not_null` | `id IS NOT NULL` |
| `dispatch` | `dispatch_organizationId_not_null` | `organizationId IS NOT NULL` |
| `dispatch` | `dispatch_salesOrderId_not_null` | `salesOrderId IS NOT NULL` |
| `dispatch` | `dispatch_status_not_null` | `status IS NOT NULL` |
| `dispatch` | `dispatch_updatedAt_not_null` | `updatedAt IS NOT NULL` |
| `dispatch` | `dispatch_warehouseId_not_null` | `warehouseId IS NOT NULL` |
| `dispatch_line` | `dispatch_line_createdAt_not_null` | `createdAt IS NOT NULL` |
| `dispatch_line` | `dispatch_line_dispatchId_not_null` | `dispatchId IS NOT NULL` |
| `dispatch_line` | `dispatch_line_id_not_null` | `id IS NOT NULL` |
| `dispatch_line` | `dispatch_line_inventoryItemId_not_null` | `inventoryItemId IS NOT NULL` |
| `dispatch_line` | `dispatch_line_quantity_not_null` | `quantity IS NOT NULL` |
| `dispatch_line` | `dispatch_line_salesOrderLineId_not_null` | `salesOrderLineId IS NOT NULL` |
| `dispatch_line` | `dispatch_line_updatedAt_not_null` | `updatedAt IS NOT NULL` |
| `document_sequences` | `document_sequences_current_value_not_null` | `current_value IS NOT NULL` |
| `document_sequences` | `document_sequences_financial_year_not_null` | `financial_year IS NOT NULL` |
| `document_sequences` | `document_sequences_id_not_null` | `id IS NOT NULL` |
| `document_sequences` | `document_sequences_organization_id_not_null` | `organization_id IS NOT NULL` |
| `document_sequences` | `document_sequences_type_not_null` | `type IS NOT NULL` |
| `document_sequences` | `document_sequences_updated_at_not_null` | `updated_at IS NOT NULL` |
| `facility` | `facility_code_not_null` | `code IS NOT NULL` |
| `facility` | `facility_createdAt_not_null` | `createdAt IS NOT NULL` |
| `facility` | `facility_id_not_null` | `id IS NOT NULL` |
| `facility` | `facility_name_not_null` | `name IS NOT NULL` |
| `facility` | `facility_organizationId_not_null` | `organizationId IS NOT NULL` |
| `facility` | `facility_state_not_null` | `state IS NOT NULL` |
| `facility` | `facility_updatedAt_not_null` | `updatedAt IS NOT NULL` |
| `inventory_item` | `chk_current_stock_non_negative` | `("currentStock" >= (0)::numeric)` |
| `inventory_item` | `inventory_item_baseUomId_not_null` | `baseUomId IS NOT NULL` |
| `inventory_item` | `inventory_item_category_not_null` | `category IS NOT NULL` |
| `inventory_item` | `inventory_item_createdAt_not_null` | `createdAt IS NOT NULL` |
| `inventory_item` | `inventory_item_currentStock_not_null` | `currentStock IS NOT NULL` |
| `inventory_item` | `inventory_item_id_not_null` | `id IS NOT NULL` |
| `inventory_item` | `inventory_item_isActive_not_null` | `isActive IS NOT NULL` |
| `inventory_item` | `inventory_item_name_not_null` | `name IS NOT NULL` |
| `inventory_item` | `inventory_item_organizationId_not_null` | `organizationId IS NOT NULL` |
| `inventory_item` | `inventory_item_sku_not_null` | `sku IS NOT NULL` |
| `inventory_item` | `inventory_item_updatedAt_not_null` | `updatedAt IS NOT NULL` |
| `inventory_item` | `inventory_item_weightedAverageCost_not_null` | `weightedAverageCost IS NOT NULL` |
| `organization` | `organization_code_not_null` | `code IS NOT NULL` |
| `organization` | `organization_createdAt_not_null` | `createdAt IS NOT NULL` |
| `organization` | `organization_id_not_null` | `id IS NOT NULL` |
| `organization` | `organization_name_not_null` | `name IS NOT NULL` |
| `organization` | `organization_state_not_null` | `state IS NOT NULL` |
| `organization` | `organization_updatedAt_not_null` | `updatedAt IS NOT NULL` |
| `payment` | `payment_amount_not_null` | `amount IS NOT NULL` |
| `payment` | `payment_createdAt_not_null` | `createdAt IS NOT NULL` |
| `payment` | `payment_customerId_not_null` | `customerId IS NOT NULL` |
| `payment` | `payment_id_not_null` | `id IS NOT NULL` |
| `payment` | `payment_organizationId_not_null` | `organizationId IS NOT NULL` |
| `payment` | `payment_paymentDate_not_null` | `paymentDate IS NOT NULL` |
| `payment` | `payment_paymentMode_not_null` | `paymentMode IS NOT NULL` |
| `payment` | `payment_paymentNumber_not_null` | `paymentNumber IS NOT NULL` |
| `payment` | `payment_postedAt_not_null` | `postedAt IS NOT NULL` |
| `payment` | `payment_status_not_null` | `status IS NOT NULL` |
| `payment` | `payment_unallocatedAmount_not_null` | `unallocatedAmount IS NOT NULL` |
| `payment` | `payment_updatedAt_not_null` | `updatedAt IS NOT NULL` |
| `payment_allocation` | `payment_allocation_allocatedAt_not_null` | `allocatedAt IS NOT NULL` |
| `payment_allocation` | `payment_allocation_amount_not_null` | `amount IS NOT NULL` |
| `payment_allocation` | `payment_allocation_createdAt_not_null` | `createdAt IS NOT NULL` |
| `payment_allocation` | `payment_allocation_id_not_null` | `id IS NOT NULL` |
| `payment_allocation` | `payment_allocation_paymentId_not_null` | `paymentId IS NOT NULL` |
| `payment_allocation` | `payment_allocation_salesInvoiceId_not_null` | `salesInvoiceId IS NOT NULL` |
| `payment_allocation` | `payment_allocation_updatedAt_not_null` | `updatedAt IS NOT NULL` |
| `price_list` | `price_list_code_not_null` | `code IS NOT NULL` |
| `price_list` | `price_list_createdAt_not_null` | `createdAt IS NOT NULL` |
| `price_list` | `price_list_effectiveFrom_not_null` | `effectiveFrom IS NOT NULL` |
| `price_list` | `price_list_id_not_null` | `id IS NOT NULL` |
| `price_list` | `price_list_isActive_not_null` | `isActive IS NOT NULL` |
| `price_list` | `price_list_isDefault_not_null` | `isDefault IS NOT NULL` |
| `price_list` | `price_list_name_not_null` | `name IS NOT NULL` |
| `price_list` | `price_list_organizationId_not_null` | `organizationId IS NOT NULL` |
| `price_list` | `price_list_updatedAt_not_null` | `updatedAt IS NOT NULL` |
| `price_list_line` | `price_list_line_createdAt_not_null` | `createdAt IS NOT NULL` |
| `price_list_line` | `price_list_line_id_not_null` | `id IS NOT NULL` |
| `price_list_line` | `price_list_line_priceListId_not_null` | `priceListId IS NOT NULL` |
| `price_list_line` | `price_list_line_price_not_null` | `price IS NOT NULL` |
| `price_list_line` | `price_list_line_productVariantId_not_null` | `productVariantId IS NOT NULL` |
| `price_list_line` | `price_list_line_updatedAt_not_null` | `updatedAt IS NOT NULL` |
| `product` | `product_code_not_null` | `code IS NOT NULL` |
| `product` | `product_createdAt_not_null` | `createdAt IS NOT NULL` |
| `product` | `product_hsnCode_not_null` | `hsnCode IS NOT NULL` |
| `product` | `product_id_not_null` | `id IS NOT NULL` |
| `product` | `product_isActive_not_null` | `isActive IS NOT NULL` |
| `product` | `product_name_not_null` | `name IS NOT NULL` |
| `product` | `product_organizationId_not_null` | `organizationId IS NOT NULL` |
| `product` | `product_taxRate_not_null` | `taxRate IS NOT NULL` |
| `product` | `product_updatedAt_not_null` | `updatedAt IS NOT NULL` |
| `product_variant` | `product_variant_createdAt_not_null` | `createdAt IS NOT NULL` |
| `product_variant` | `product_variant_id_not_null` | `id IS NOT NULL` |
| `product_variant` | `product_variant_isActive_not_null` | `isActive IS NOT NULL` |
| `product_variant` | `product_variant_name_not_null` | `name IS NOT NULL` |
| `product_variant` | `product_variant_packSize_not_null` | `packSize IS NOT NULL` |
| `product_variant` | `product_variant_productId_not_null` | `productId IS NOT NULL` |
| `product_variant` | `product_variant_sku_not_null` | `sku IS NOT NULL` |
| `product_variant` | `product_variant_uomId_not_null` | `uomId IS NOT NULL` |
| `product_variant` | `product_variant_updatedAt_not_null` | `updatedAt IS NOT NULL` |
| `production_run` | `production_run_actualGoodQty_not_null` | `actualGoodQty IS NOT NULL` |
| `production_run` | `production_run_actualRejectedQty_not_null` | `actualRejectedQty IS NOT NULL` |
| `production_run` | `production_run_batchCount_not_null` | `batchCount IS NOT NULL` |
| `production_run` | `production_run_costPerGoodUnit_not_null` | `costPerGoodUnit IS NOT NULL` |
| `production_run` | `production_run_createdAt_not_null` | `createdAt IS NOT NULL` |
| `production_run` | `production_run_directLaborCost_not_null` | `directLaborCost IS NOT NULL` |
| `production_run` | `production_run_directMaterialCost_not_null` | `directMaterialCost IS NOT NULL` |
| `production_run` | `production_run_expectedOutputQty_not_null` | `expectedOutputQty IS NOT NULL` |
| `production_run` | `production_run_id_not_null` | `id IS NOT NULL` |
| `production_run` | `production_run_isYieldFlagged_not_null` | `isYieldFlagged IS NOT NULL` |
| `production_run` | `production_run_organizationId_not_null` | `organizationId IS NOT NULL` |
| `production_run` | `production_run_recipeId_not_null` | `recipeId IS NOT NULL` |
| `production_run` | `production_run_recipeVersion_not_null` | `recipeVersion IS NOT NULL` |
| `production_run` | `production_run_runNumber_not_null` | `runNumber IS NOT NULL` |
| `production_run` | `production_run_status_not_null` | `status IS NOT NULL` |
| `production_run` | `production_run_totalRunCost_not_null` | `totalRunCost IS NOT NULL` |
| `production_run` | `production_run_updatedAt_not_null` | `updatedAt IS NOT NULL` |
| `production_run` | `production_run_utilityCost_not_null` | `utilityCost IS NOT NULL` |
| `production_run` | `production_run_warehouseId_not_null` | `warehouseId IS NOT NULL` |
| `production_run` | `production_run_yieldVariancePct_not_null` | `yieldVariancePct IS NOT NULL` |
| `production_run` | `production_run_yieldVarianceQty_not_null` | `yieldVarianceQty IS NOT NULL` |
| `production_run_material` | `production_run_material_actualQty_not_null` | `actualQty IS NOT NULL` |
| `production_run_material` | `production_run_material_createdAt_not_null` | `createdAt IS NOT NULL` |
| `production_run_material` | `production_run_material_damagedQty_not_null` | `damagedQty IS NOT NULL` |
| `production_run_material` | `production_run_material_id_not_null` | `id IS NOT NULL` |
| `production_run_material` | `production_run_material_inventoryItemId_not_null` | `inventoryItemId IS NOT NULL` |
| `production_run_material` | `production_run_material_isVarianceFlagged_not_null` | `isVarianceFlagged IS NOT NULL` |
| `production_run_material` | `production_run_material_itemType_not_null` | `itemType IS NOT NULL` |
| `production_run_material` | `production_run_material_plannedQty_not_null` | `plannedQty IS NOT NULL` |
| `production_run_material` | `production_run_material_productionRunId_not_null` | `productionRunId IS NOT NULL` |
| `production_run_material` | `production_run_material_totalCost_not_null` | `totalCost IS NOT NULL` |
| `production_run_material` | `production_run_material_unitCost_not_null` | `unitCost IS NOT NULL` |
| `production_run_material` | `production_run_material_updatedAt_not_null` | `updatedAt IS NOT NULL` |
| `production_run_material` | `production_run_material_variancePct_not_null` | `variancePct IS NOT NULL` |
| `production_run_material` | `production_run_material_varianceQty_not_null` | `varianceQty IS NOT NULL` |
| `production_run_reversal` | `production_run_reversal_createdAt_not_null` | `createdAt IS NOT NULL` |
| `production_run_reversal` | `production_run_reversal_id_not_null` | `id IS NOT NULL` |
| `production_run_reversal` | `production_run_reversal_originalRunId_not_null` | `originalRunId IS NOT NULL` |
| `production_run_reversal` | `production_run_reversal_reason_not_null` | `reason IS NOT NULL` |
| `production_run_reversal` | `production_run_reversal_reversalRunNumber_not_null` | `reversalRunNumber IS NOT NULL` |
| `purchase_receipt` | `purchase_receipt_createdAt_not_null` | `createdAt IS NOT NULL` |
| `purchase_receipt` | `purchase_receipt_id_not_null` | `id IS NOT NULL` |
| `purchase_receipt` | `purchase_receipt_organizationId_not_null` | `organizationId IS NOT NULL` |
| `purchase_receipt` | `purchase_receipt_postedAt_not_null` | `postedAt IS NOT NULL` |
| `purchase_receipt` | `purchase_receipt_receiptNumber_not_null` | `receiptNumber IS NOT NULL` |
| `purchase_receipt` | `purchase_receipt_status_not_null` | `status IS NOT NULL` |
| `purchase_receipt` | `purchase_receipt_supplierId_not_null` | `supplierId IS NOT NULL` |
| `purchase_receipt` | `purchase_receipt_totalAmount_not_null` | `totalAmount IS NOT NULL` |
| `purchase_receipt` | `purchase_receipt_updatedAt_not_null` | `updatedAt IS NOT NULL` |
| `purchase_receipt` | `purchase_receipt_warehouseId_not_null` | `warehouseId IS NOT NULL` |
| `purchase_receipt_line` | `purchase_receipt_line_createdAt_not_null` | `createdAt IS NOT NULL` |
| `purchase_receipt_line` | `purchase_receipt_line_id_not_null` | `id IS NOT NULL` |
| `purchase_receipt_line` | `purchase_receipt_line_inventoryItemId_not_null` | `inventoryItemId IS NOT NULL` |
| `purchase_receipt_line` | `purchase_receipt_line_purchaseReceiptId_not_null` | `purchaseReceiptId IS NOT NULL` |
| `purchase_receipt_line` | `purchase_receipt_line_quantity_not_null` | `quantity IS NOT NULL` |
| `purchase_receipt_line` | `purchase_receipt_line_totalPrice_not_null` | `totalPrice IS NOT NULL` |
| `purchase_receipt_line` | `purchase_receipt_line_unitPrice_not_null` | `unitPrice IS NOT NULL` |
| `purchase_receipt_line` | `purchase_receipt_line_uomId_not_null` | `uomId IS NOT NULL` |
| `purchase_receipt_line` | `purchase_receipt_line_updatedAt_not_null` | `updatedAt IS NOT NULL` |
| `recipe` | `recipe_createdAt_not_null` | `createdAt IS NOT NULL` |
| `recipe` | `recipe_expectedOutputQty_not_null` | `expectedOutputQty IS NOT NULL` |
| `recipe` | `recipe_id_not_null` | `id IS NOT NULL` |
| `recipe` | `recipe_isActive_not_null` | `isActive IS NOT NULL` |
| `recipe` | `recipe_name_not_null` | `name IS NOT NULL` |
| `recipe` | `recipe_organizationId_not_null` | `organizationId IS NOT NULL` |
| `recipe` | `recipe_outputUomId_not_null` | `outputUomId IS NOT NULL` |
| `recipe` | `recipe_productVariantId_not_null` | `productVariantId IS NOT NULL` |
| `recipe` | `recipe_standardBatchSize_not_null` | `standardBatchSize IS NOT NULL` |
| `recipe` | `recipe_updatedAt_not_null` | `updatedAt IS NOT NULL` |
| `recipe` | `recipe_version_not_null` | `version IS NOT NULL` |
| `recipe_item` | `recipe_item_createdAt_not_null` | `createdAt IS NOT NULL` |
| `recipe_item` | `recipe_item_id_not_null` | `id IS NOT NULL` |
| `recipe_item` | `recipe_item_inventoryItemId_not_null` | `inventoryItemId IS NOT NULL` |
| `recipe_item` | `recipe_item_itemType_not_null` | `itemType IS NOT NULL` |
| `recipe_item` | `recipe_item_plannedQty_not_null` | `plannedQty IS NOT NULL` |
| `recipe_item` | `recipe_item_recipeId_not_null` | `recipeId IS NOT NULL` |
| `recipe_item` | `recipe_item_uomId_not_null` | `uomId IS NOT NULL` |
| `recipe_item` | `recipe_item_updatedAt_not_null` | `updatedAt IS NOT NULL` |
| `sales_invoice` | `chk_invoice_taxable_amount_non_negative` | `("taxableAmount" >= (0)::numeric)` |
| `sales_invoice` | `sales_invoice_cgstAmount_not_null` | `cgstAmount IS NOT NULL` |
| `sales_invoice` | `sales_invoice_companyGstinSnapshot_not_null` | `companyGstinSnapshot IS NOT NULL` |
| `sales_invoice` | `sales_invoice_createdAt_not_null` | `createdAt IS NOT NULL` |
| `sales_invoice` | `sales_invoice_currency_not_null` | `currency IS NOT NULL` |
| `sales_invoice` | `sales_invoice_customerId_not_null` | `customerId IS NOT NULL` |
| `sales_invoice` | `sales_invoice_customerNameSnapshot_not_null` | `customerNameSnapshot IS NOT NULL` |
| `sales_invoice` | `sales_invoice_deliveryStateSnapshot_not_null` | `deliveryStateSnapshot IS NOT NULL` |
| `sales_invoice` | `sales_invoice_financialYear_not_null` | `financialYear IS NOT NULL` |
| `sales_invoice` | `sales_invoice_id_not_null` | `id IS NOT NULL` |
| `sales_invoice` | `sales_invoice_igstAmount_not_null` | `igstAmount IS NOT NULL` |
| `sales_invoice` | `sales_invoice_invoiceNumber_not_null` | `invoiceNumber IS NOT NULL` |
| `sales_invoice` | `sales_invoice_organizationId_not_null` | `organizationId IS NOT NULL` |
| `sales_invoice` | `sales_invoice_outstandingAmount_not_null` | `outstandingAmount IS NOT NULL` |
| `sales_invoice` | `sales_invoice_paidAmount_not_null` | `paidAmount IS NOT NULL` |
| `sales_invoice` | `sales_invoice_postedAt_not_null` | `postedAt IS NOT NULL` |
| `sales_invoice` | `sales_invoice_sgstAmount_not_null` | `sgstAmount IS NOT NULL` |
| `sales_invoice` | `sales_invoice_status_not_null` | `status IS NOT NULL` |
| `sales_invoice` | `sales_invoice_taxableAmount_not_null` | `taxableAmount IS NOT NULL` |
| `sales_invoice` | `sales_invoice_totalAmount_not_null` | `totalAmount IS NOT NULL` |
| `sales_invoice` | `sales_invoice_totalTaxAmount_not_null` | `totalTaxAmount IS NOT NULL` |
| `sales_invoice` | `sales_invoice_updatedAt_not_null` | `updatedAt IS NOT NULL` |
| `sales_invoice_line` | `sales_invoice_line_cgstAmount_not_null` | `cgstAmount IS NOT NULL` |
| `sales_invoice_line` | `sales_invoice_line_createdAt_not_null` | `createdAt IS NOT NULL` |
| `sales_invoice_line` | `sales_invoice_line_hsnCodeSnapshot_not_null` | `hsnCodeSnapshot IS NOT NULL` |
| `sales_invoice_line` | `sales_invoice_line_id_not_null` | `id IS NOT NULL` |
| `sales_invoice_line` | `sales_invoice_line_igstAmount_not_null` | `igstAmount IS NOT NULL` |
| `sales_invoice_line` | `sales_invoice_line_invoiceId_not_null` | `invoiceId IS NOT NULL` |
| `sales_invoice_line` | `sales_invoice_line_lineTotal_not_null` | `lineTotal IS NOT NULL` |
| `sales_invoice_line` | `sales_invoice_line_productNameSnapshot_not_null` | `productNameSnapshot IS NOT NULL` |
| `sales_invoice_line` | `sales_invoice_line_productVariantId_not_null` | `productVariantId IS NOT NULL` |
| `sales_invoice_line` | `sales_invoice_line_quantity_not_null` | `quantity IS NOT NULL` |
| `sales_invoice_line` | `sales_invoice_line_sgstAmount_not_null` | `sgstAmount IS NOT NULL` |
| `sales_invoice_line` | `sales_invoice_line_taxAmount_not_null` | `taxAmount IS NOT NULL` |
| `sales_invoice_line` | `sales_invoice_line_taxRate_not_null` | `taxRate IS NOT NULL` |
| `sales_invoice_line` | `sales_invoice_line_taxableAmount_not_null` | `taxableAmount IS NOT NULL` |
| `sales_invoice_line` | `sales_invoice_line_unitPrice_not_null` | `unitPrice IS NOT NULL` |
| `sales_invoice_line` | `sales_invoice_line_updatedAt_not_null` | `updatedAt IS NOT NULL` |
| `sales_order` | `chk_order_taxable_amount_non_negative` | `("taxableAmount" >= (0)::numeric)` |
| `sales_order` | `sales_order_cgstAmount_not_null` | `cgstAmount IS NOT NULL` |
| `sales_order` | `sales_order_createdAt_not_null` | `createdAt IS NOT NULL` |
| `sales_order` | `sales_order_customerId_not_null` | `customerId IS NOT NULL` |
| `sales_order` | `sales_order_deliveryState_not_null` | `deliveryState IS NOT NULL` |
| `sales_order` | `sales_order_fulfilmentStatus_not_null` | `fulfilmentStatus IS NOT NULL` |
| `sales_order` | `sales_order_id_not_null` | `id IS NOT NULL` |
| `sales_order` | `sales_order_igstAmount_not_null` | `igstAmount IS NOT NULL` |
| `sales_order` | `sales_order_orderNumber_not_null` | `orderNumber IS NOT NULL` |
| `sales_order` | `sales_order_organizationId_not_null` | `organizationId IS NOT NULL` |
| `sales_order` | `sales_order_salesmanId_not_null` | `salesmanId IS NOT NULL` |
| `sales_order` | `sales_order_sgstAmount_not_null` | `sgstAmount IS NOT NULL` |
| `sales_order` | `sales_order_status_not_null` | `status IS NOT NULL` |
| `sales_order` | `sales_order_taxableAmount_not_null` | `taxableAmount IS NOT NULL` |
| `sales_order` | `sales_order_totalAmount_not_null` | `totalAmount IS NOT NULL` |
| `sales_order` | `sales_order_totalTaxAmount_not_null` | `totalTaxAmount IS NOT NULL` |
| `sales_order` | `sales_order_updatedAt_not_null` | `updatedAt IS NOT NULL` |
| `sales_order` | `sales_order_warehouseId_not_null` | `warehouseId IS NOT NULL` |
| `sales_order_line` | `sales_order_line_approvedQuantity_not_null` | `approvedQuantity IS NOT NULL` |
| `sales_order_line` | `sales_order_line_approvedUnitPrice_not_null` | `approvedUnitPrice IS NOT NULL` |
| `sales_order_line` | `sales_order_line_createdAt_not_null` | `createdAt IS NOT NULL` |
| `sales_order_line` | `sales_order_line_dispatchedQuantity_not_null` | `dispatchedQuantity IS NOT NULL` |
| `sales_order_line` | `sales_order_line_id_not_null` | `id IS NOT NULL` |
| `sales_order_line` | `sales_order_line_lineTotal_not_null` | `lineTotal IS NOT NULL` |
| `sales_order_line` | `sales_order_line_productVariantId_not_null` | `productVariantId IS NOT NULL` |
| `sales_order_line` | `sales_order_line_quotedQuantity_not_null` | `quotedQuantity IS NOT NULL` |
| `sales_order_line` | `sales_order_line_quotedUnitPrice_not_null` | `quotedUnitPrice IS NOT NULL` |
| `sales_order_line` | `sales_order_line_salesOrderId_not_null` | `salesOrderId IS NOT NULL` |
| `sales_order_line` | `sales_order_line_taxAmount_not_null` | `taxAmount IS NOT NULL` |
| `sales_order_line` | `sales_order_line_taxRate_not_null` | `taxRate IS NOT NULL` |
| `sales_order_line` | `sales_order_line_taxableAmount_not_null` | `taxableAmount IS NOT NULL` |
| `sales_order_line` | `sales_order_line_updatedAt_not_null` | `updatedAt IS NOT NULL` |
| `salesman_customer_assignment` | `salesman_customer_assignment_assignedAt_not_null` | `assignedAt IS NOT NULL` |
| `salesman_customer_assignment` | `salesman_customer_assignment_customerId_not_null` | `customerId IS NOT NULL` |
| `salesman_customer_assignment` | `salesman_customer_assignment_id_not_null` | `id IS NOT NULL` |
| `salesman_customer_assignment` | `salesman_customer_assignment_salesmanId_not_null` | `salesmanId IS NOT NULL` |
| `session` | `session_createdAt_not_null` | `createdAt IS NOT NULL` |
| `session` | `session_expiresAt_not_null` | `expiresAt IS NOT NULL` |
| `session` | `session_id_not_null` | `id IS NOT NULL` |
| `session` | `session_token_not_null` | `token IS NOT NULL` |
| `session` | `session_updatedAt_not_null` | `updatedAt IS NOT NULL` |
| `session` | `session_userId_not_null` | `userId IS NOT NULL` |
| `stock_movement` | `stock_movement_createdAt_not_null` | `createdAt IS NOT NULL` |
| `stock_movement` | `stock_movement_id_not_null` | `id IS NOT NULL` |
| `stock_movement` | `stock_movement_inventoryItemId_not_null` | `inventoryItemId IS NOT NULL` |
| `stock_movement` | `stock_movement_movementType_not_null` | `movementType IS NOT NULL` |
| `stock_movement` | `stock_movement_postedAt_not_null` | `postedAt IS NOT NULL` |
| `stock_movement` | `stock_movement_quantity_not_null` | `quantity IS NOT NULL` |
| `stock_movement` | `stock_movement_totalCost_not_null` | `totalCost IS NOT NULL` |
| `stock_movement` | `stock_movement_unitCost_not_null` | `unitCost IS NOT NULL` |
| `stock_movement` | `stock_movement_warehouseId_not_null` | `warehouseId IS NOT NULL` |
| `stock_reservation` | `stock_reservation_createdAt_not_null` | `createdAt IS NOT NULL` |
| `stock_reservation` | `stock_reservation_id_not_null` | `id IS NOT NULL` |
| `stock_reservation` | `stock_reservation_inventoryItemId_not_null` | `inventoryItemId IS NOT NULL` |
| `stock_reservation` | `stock_reservation_releasedQuantity_not_null` | `releasedQuantity IS NOT NULL` |
| `stock_reservation` | `stock_reservation_reservedQuantity_not_null` | `reservedQuantity IS NOT NULL` |
| `stock_reservation` | `stock_reservation_salesOrderId_not_null` | `salesOrderId IS NOT NULL` |
| `stock_reservation` | `stock_reservation_salesOrderLineId_not_null` | `salesOrderLineId IS NOT NULL` |
| `stock_reservation` | `stock_reservation_status_not_null` | `status IS NOT NULL` |
| `stock_reservation` | `stock_reservation_updatedAt_not_null` | `updatedAt IS NOT NULL` |
| `stock_reservation` | `stock_reservation_warehouseId_not_null` | `warehouseId IS NOT NULL` |
| `supplier` | `supplier_code_not_null` | `code IS NOT NULL` |
| `supplier` | `supplier_createdAt_not_null` | `createdAt IS NOT NULL` |
| `supplier` | `supplier_id_not_null` | `id IS NOT NULL` |
| `supplier` | `supplier_isActive_not_null` | `isActive IS NOT NULL` |
| `supplier` | `supplier_name_not_null` | `name IS NOT NULL` |
| `supplier` | `supplier_organizationId_not_null` | `organizationId IS NOT NULL` |
| `supplier` | `supplier_state_not_null` | `state IS NOT NULL` |
| `supplier` | `supplier_updatedAt_not_null` | `updatedAt IS NOT NULL` |
| `tax_rate` | `tax_rate_cgstRate_not_null` | `cgstRate IS NOT NULL` |
| `tax_rate` | `tax_rate_createdAt_not_null` | `createdAt IS NOT NULL` |
| `tax_rate` | `tax_rate_effectiveFrom_not_null` | `effectiveFrom IS NOT NULL` |
| `tax_rate` | `tax_rate_hsnCode_not_null` | `hsnCode IS NOT NULL` |
| `tax_rate` | `tax_rate_id_not_null` | `id IS NOT NULL` |
| `tax_rate` | `tax_rate_igstRate_not_null` | `igstRate IS NOT NULL` |
| `tax_rate` | `tax_rate_organizationId_not_null` | `organizationId IS NOT NULL` |
| `tax_rate` | `tax_rate_rate_not_null` | `rate IS NOT NULL` |
| `tax_rate` | `tax_rate_sgstRate_not_null` | `sgstRate IS NOT NULL` |
| `tax_rate` | `tax_rate_updatedAt_not_null` | `updatedAt IS NOT NULL` |
| `unit_conversion` | `unit_conversion_createdAt_not_null` | `createdAt IS NOT NULL` |
| `unit_conversion` | `unit_conversion_factor_not_null` | `factor IS NOT NULL` |
| `unit_conversion` | `unit_conversion_fromUomId_not_null` | `fromUomId IS NOT NULL` |
| `unit_conversion` | `unit_conversion_id_not_null` | `id IS NOT NULL` |
| `unit_conversion` | `unit_conversion_toUomId_not_null` | `toUomId IS NOT NULL` |
| `unit_conversion` | `unit_conversion_updatedAt_not_null` | `updatedAt IS NOT NULL` |
| `unit_of_measure` | `unit_of_measure_code_not_null` | `code IS NOT NULL` |
| `unit_of_measure` | `unit_of_measure_createdAt_not_null` | `createdAt IS NOT NULL` |
| `unit_of_measure` | `unit_of_measure_id_not_null` | `id IS NOT NULL` |
| `unit_of_measure` | `unit_of_measure_name_not_null` | `name IS NOT NULL` |
| `unit_of_measure` | `unit_of_measure_organizationId_not_null` | `organizationId IS NOT NULL` |
| `unit_of_measure` | `unit_of_measure_symbol_not_null` | `symbol IS NOT NULL` |
| `unit_of_measure` | `unit_of_measure_updatedAt_not_null` | `updatedAt IS NOT NULL` |
| `user` | `user_createdAt_not_null` | `createdAt IS NOT NULL` |
| `user` | `user_emailVerified_not_null` | `emailVerified IS NOT NULL` |
| `user` | `user_email_not_null` | `email IS NOT NULL` |
| `user` | `user_id_not_null` | `id IS NOT NULL` |
| `user` | `user_isActive_not_null` | `isActive IS NOT NULL` |
| `user` | `user_name_not_null` | `name IS NOT NULL` |
| `user` | `user_role_not_null` | `role IS NOT NULL` |
| `user` | `user_updatedAt_not_null` | `updatedAt IS NOT NULL` |
| `verification` | `verification_createdAt_not_null` | `createdAt IS NOT NULL` |
| `verification` | `verification_expiresAt_not_null` | `expiresAt IS NOT NULL` |
| `verification` | `verification_id_not_null` | `id IS NOT NULL` |
| `verification` | `verification_identifier_not_null` | `identifier IS NOT NULL` |
| `verification` | `verification_updatedAt_not_null` | `updatedAt IS NOT NULL` |
| `verification` | `verification_value_not_null` | `value IS NOT NULL` |
| `warehouse` | `warehouse_code_not_null` | `code IS NOT NULL` |
| `warehouse` | `warehouse_createdAt_not_null` | `createdAt IS NOT NULL` |
| `warehouse` | `warehouse_facilityId_not_null` | `facilityId IS NOT NULL` |
| `warehouse` | `warehouse_id_not_null` | `id IS NOT NULL` |
| `warehouse` | `warehouse_name_not_null` | `name IS NOT NULL` |
| `warehouse` | `warehouse_updatedAt_not_null` | `updatedAt IS NOT NULL` |

## Enum Types Reconciliation

| Enum Name | Prisma Values Count | DB Values Count | Drift? |
|-----------|---------------------|-----------------|--------|
| `ItemCategory` | 3 | 3 | Match |
| `MovementType` | 8 | 8 | Match |
| `RecipeItemType` | 2 | 2 | Match |
| `ProductionRunStatus` | 3 | 3 | Match |
| `OrderStatus` | 6 | 6 | Match |
| `FulfilmentStatus` | 3 | 3 | Match |
| `ReservationStatus` | 3 | 3 | Match |
| `InvoiceStatus` | 5 | 5 | Match |
| `DispatchStatus` | 3 | 3 | Match |
| `PaymentMode` | 5 | 5 | Match |
| `PaymentStatus` | 2 | 2 | Match |
