-- AlterTable: Add product variant image fields (F-075)
ALTER TABLE "product_variant" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "product_variant" ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT;
ALTER TABLE "product_variant" ADD COLUMN IF NOT EXISTS "thumbHash" TEXT;

-- CreateIndex: Foreign key indexes on lines (F-071)
CREATE INDEX IF NOT EXISTS "sales_order_line_salesOrderId_idx" ON "sales_order_line"("salesOrderId");
CREATE INDEX IF NOT EXISTS "sales_invoice_line_invoiceId_idx" ON "sales_invoice_line"("invoiceId");

-- CreateIndex: Composite query indexes on invoices (F-071)
CREATE INDEX IF NOT EXISTS "sales_invoice_customerId_status_postedAt_idx" ON "sales_invoice"("customerId", "status", "postedAt" DESC);
CREATE INDEX IF NOT EXISTS "sales_invoice_organizationId_postedAt_idx" ON "sales_invoice"("organizationId", "postedAt" DESC);
CREATE INDEX IF NOT EXISTS "sales_invoice_organizationId_status_idx" ON "sales_invoice"("organizationId", "status");

-- CreateIndex: Composite query indexes on orders (F-071)
CREATE INDEX IF NOT EXISTS "sales_order_organizationId_createdAt_idx" ON "sales_order"("organizationId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "sales_order_customerId_idx" ON "sales_order"("customerId");

-- CreateIndex: Stock movement ledger traversal index (F-071)
CREATE INDEX IF NOT EXISTS "stock_movement_inventoryItemId_postedAt_idx" ON "stock_movement"("inventoryItemId", "postedAt" DESC);
