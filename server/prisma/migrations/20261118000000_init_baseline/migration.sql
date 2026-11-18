-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ItemCategory" AS ENUM ('RAW_MATERIAL', 'PACKAGING', 'FINISHED_GOODS');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('OPENING_BALANCE', 'PURCHASE_RECEIPT', 'PRODUCTION_CONSUMED', 'PRODUCTION_OUTPUT', 'PRODUCTION_REVERSAL', 'DISPATCH', 'ADJUSTMENT', 'RETURN');

-- CreateEnum
CREATE TYPE "RecipeItemType" AS ENUM ('INGREDIENT', 'PACKAGING');

-- CreateEnum
CREATE TYPE "ProductionRunStatus" AS ENUM ('DRAFT', 'POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "FulfilmentStatus" AS ENUM ('UNFULFILLED', 'PARTIALLY_FULFILLED', 'FULFILLED');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'RELEASED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED_BY_CREDIT_NOTE', 'PAID', 'PARTIALLY_PAID');

-- CreateEnum
CREATE TYPE "DispatchStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'DEMAND_DRAFT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('POSTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'SALESMAN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gstin" TEXT,
    "state" TEXT NOT NULL DEFAULT 'Tamil Nadu',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'Tamil Nadu',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "state" TEXT NOT NULL DEFAULT 'Tamil Nadu',
    "gstin" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salesman_customer_assignment" (
    "id" TEXT NOT NULL,
    "salesmanId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salesman_customer_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "state" TEXT NOT NULL DEFAULT 'Tamil Nadu',
    "gstin" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_of_measure" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_of_measure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_conversion" (
    "id" TEXT NOT NULL,
    "fromUomId" TEXT NOT NULL,
    "toUomId" TEXT NOT NULL,
    "factor" DECIMAL(18,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_conversion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_item" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ItemCategory" NOT NULL,
    "baseUomId" TEXT NOT NULL,
    "currentStock" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "weightedAverageCost" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movement" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "movementType" "MovementType" NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "unitCost" DECIMAL(18,6) NOT NULL,
    "totalCost" DECIMAL(18,2) NOT NULL,
    "referenceDocumentType" TEXT,
    "referenceDocumentId" TEXT,
    "notes" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hsnCode" TEXT NOT NULL DEFAULT '21069099',
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 5.00,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "packSize" DECIMAL(18,6) NOT NULL,
    "uomId" TEXT NOT NULL,
    "inventoryItemId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "standardBatchSize" DECIMAL(18,6) NOT NULL,
    "expectedOutputQty" DECIMAL(18,6) NOT NULL,
    "outputUomId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_item" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "itemType" "RecipeItemType" NOT NULL,
    "plannedQty" DECIMAL(18,6) NOT NULL,
    "uomId" TEXT NOT NULL,
    "tolerancePct" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipe_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_list" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_list_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_list_line" (
    "id" TEXT NOT NULL,
    "priceListId" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "price" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_list_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_rate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "hsnCode" TEXT NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "cgstRate" DECIMAL(5,2) NOT NULL,
    "sgstRate" DECIMAL(5,2) NOT NULL,
    "igstRate" DECIMAL(5,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_rate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_receipt" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "supplierInvoiceNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "notes" TEXT,
    "idempotencyKey" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_receipt_line" (
    "id" TEXT NOT NULL,
    "purchaseReceiptId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "uomId" TEXT NOT NULL,
    "unitPrice" DECIMAL(18,6) NOT NULL,
    "totalPrice" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_receipt_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_run" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "recipeVersion" INTEGER NOT NULL,
    "runNumber" TEXT NOT NULL,
    "batchCount" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "status" "ProductionRunStatus" NOT NULL DEFAULT 'DRAFT',
    "expectedOutputQty" DECIMAL(18,6) NOT NULL,
    "actualGoodQty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "actualRejectedQty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "yieldVarianceQty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "yieldVariancePct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "isYieldFlagged" BOOLEAN NOT NULL DEFAULT false,
    "directMaterialCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "directLaborCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "utilityCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalRunCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "costPerGoodUnit" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "idempotencyKey" TEXT,
    "postedAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "reversalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_run_material" (
    "id" TEXT NOT NULL,
    "productionRunId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "itemType" "RecipeItemType" NOT NULL,
    "plannedQty" DECIMAL(18,6) NOT NULL,
    "actualQty" DECIMAL(18,6) NOT NULL,
    "damagedQty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "varianceQty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "variancePct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "isVarianceFlagged" BOOLEAN NOT NULL DEFAULT false,
    "unitCost" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_run_material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_run_reversal" (
    "id" TEXT NOT NULL,
    "originalRunId" TEXT NOT NULL,
    "reversalRunNumber" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reversedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_run_reversal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "salesmanId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "fulfilmentStatus" "FulfilmentStatus" NOT NULL DEFAULT 'UNFULFILLED',
    "deliveryState" TEXT NOT NULL DEFAULT 'Tamil Nadu',
    "notes" TEXT,
    "rejectionReason" TEXT,
    "overrideReason" TEXT,
    "taxableAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cgstAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalTaxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_line" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "inventoryItemId" TEXT,
    "quotedQuantity" DECIMAL(18,6) NOT NULL,
    "approvedQuantity" DECIMAL(18,6) NOT NULL,
    "dispatchedQuantity" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "quotedUnitPrice" DECIMAL(18,2) NOT NULL,
    "approvedUnitPrice" DECIMAL(18,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL,
    "taxableAmount" DECIMAL(18,2) NOT NULL,
    "taxAmount" DECIMAL(18,2) NOT NULL,
    "lineTotal" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_order_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_reservation" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "salesOrderLineId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "reservedQuantity" DECIMAL(18,6) NOT NULL,
    "releasedQuantity" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_invoice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "salesOrderId" TEXT,
    "customerId" TEXT NOT NULL,
    "customerNameSnapshot" TEXT NOT NULL,
    "customerGstinSnapshot" TEXT,
    "customerAddressSnapshot" TEXT,
    "deliveryStateSnapshot" TEXT NOT NULL,
    "companyGstinSnapshot" TEXT NOT NULL DEFAULT '33AAAAA0000A1Z5',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'POSTED',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "taxableAmount" DECIMAL(18,2) NOT NULL,
    "cgstAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalTaxAmount" DECIMAL(18,2) NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "outstandingAmount" DECIMAL(18,2) NOT NULL,
    "notes" TEXT,
    "idempotencyKey" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_invoice_line" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "salesOrderLineId" TEXT,
    "productVariantId" TEXT NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "hsnCodeSnapshot" TEXT NOT NULL DEFAULT '21069099',
    "quantity" DECIMAL(18,6) NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL,
    "taxableAmount" DECIMAL(18,2) NOT NULL,
    "cgstAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL,
    "lineTotal" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_invoice_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dispatchNumber" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "salesInvoiceId" TEXT,
    "warehouseId" TEXT NOT NULL,
    "status" "DispatchStatus" NOT NULL DEFAULT 'POSTED',
    "vehicleNumber" TEXT,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "notes" TEXT,
    "idempotencyKey" TEXT,
    "dispatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatch_line" (
    "id" TEXT NOT NULL,
    "dispatchId" TEXT NOT NULL,
    "salesOrderLineId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispatch_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_note" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "creditNoteNumber" TEXT NOT NULL,
    "salesInvoiceId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "taxableAmount" DECIMAL(18,2) NOT NULL,
    "taxAmount" DECIMAL(18,2) NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "unallocatedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "paymentMode" "PaymentMode" NOT NULL DEFAULT 'BANK_TRANSFER',
    "referenceNumber" TEXT,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "PaymentStatus" NOT NULL DEFAULT 'POSTED',
    "notes" TEXT,
    "idempotencyKey" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "salesInvoiceId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT,
    "reason" TEXT,
    "requestId" TEXT,
    "ipAddress" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "organization_code_key" ON "organization"("code");

-- CreateIndex
CREATE UNIQUE INDEX "facility_organizationId_code_key" ON "facility"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_facilityId_code_key" ON "warehouse"("facilityId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "customer_organizationId_code_key" ON "customer"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "salesman_customer_assignment_salesmanId_customerId_key" ON "salesman_customer_assignment"("salesmanId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_organizationId_code_key" ON "supplier"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "unit_of_measure_organizationId_code_key" ON "unit_of_measure"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "unit_conversion_fromUomId_toUomId_key" ON "unit_conversion"("fromUomId", "toUomId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_item_organizationId_sku_key" ON "inventory_item"("organizationId", "sku");

-- CreateIndex
CREATE INDEX "stock_movement_inventoryItemId_warehouseId_postedAt_idx" ON "stock_movement"("inventoryItemId", "warehouseId", "postedAt");

-- CreateIndex
CREATE UNIQUE INDEX "product_organizationId_code_key" ON "product"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "product_variant_productId_sku_key" ON "product_variant"("productId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "recipe_productVariantId_version_key" ON "recipe"("productVariantId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "price_list_organizationId_code_key" ON "price_list"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "price_list_line_priceListId_productVariantId_key" ON "price_list_line"("priceListId", "productVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "tax_rate_organizationId_hsnCode_effectiveFrom_key" ON "tax_rate"("organizationId", "hsnCode", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_receipt_idempotencyKey_key" ON "purchase_receipt"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_receipt_organizationId_receiptNumber_key" ON "purchase_receipt"("organizationId", "receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "production_run_idempotencyKey_key" ON "production_run"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "production_run_organizationId_runNumber_key" ON "production_run"("organizationId", "runNumber");

-- CreateIndex
CREATE UNIQUE INDEX "production_run_reversal_originalRunId_key" ON "production_run_reversal"("originalRunId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_order_idempotencyKey_key" ON "sales_order"("idempotencyKey");

-- CreateIndex
CREATE INDEX "sales_order_salesmanId_status_idx" ON "sales_order"("salesmanId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sales_order_organizationId_orderNumber_key" ON "sales_order"("organizationId", "orderNumber");

-- CreateIndex
CREATE INDEX "stock_reservation_inventoryItemId_warehouseId_status_idx" ON "stock_reservation"("inventoryItemId", "warehouseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoice_idempotencyKey_key" ON "sales_invoice"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoice_organizationId_invoiceNumber_key" ON "sales_invoice"("organizationId", "invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "dispatch_idempotencyKey_key" ON "dispatch"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "dispatch_organizationId_dispatchNumber_key" ON "dispatch"("organizationId", "dispatchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "credit_note_organizationId_creditNoteNumber_key" ON "credit_note"("organizationId", "creditNoteNumber");

-- CreateIndex
CREATE UNIQUE INDEX "payment_idempotencyKey_key" ON "payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payment_organizationId_customerId_idx" ON "payment"("organizationId", "customerId");

-- CreateIndex
CREATE INDEX "payment_paymentDate_idx" ON "payment"("paymentDate");

-- CreateIndex
CREATE UNIQUE INDEX "payment_organizationId_paymentNumber_key" ON "payment"("organizationId", "paymentNumber");

-- CreateIndex
CREATE INDEX "payment_allocation_paymentId_idx" ON "payment_allocation"("paymentId");

-- CreateIndex
CREATE INDEX "payment_allocation_salesInvoiceId_idx" ON "payment_allocation"("salesInvoiceId");

-- CreateIndex
CREATE INDEX "audit_log_organizationId_entity_idx" ON "audit_log"("organizationId", "entity");

-- CreateIndex
CREATE INDEX "audit_log_organizationId_timestamp_idx" ON "audit_log"("organizationId", "timestamp");


-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility" ADD CONSTRAINT "facility_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse" ADD CONSTRAINT "warehouse_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salesman_customer_assignment" ADD CONSTRAINT "salesman_customer_assignment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salesman_customer_assignment" ADD CONSTRAINT "salesman_customer_assignment_salesmanId_fkey" FOREIGN KEY ("salesmanId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier" ADD CONSTRAINT "supplier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_of_measure" ADD CONSTRAINT "unit_of_measure_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_conversion" ADD CONSTRAINT "unit_conversion_fromUomId_fkey" FOREIGN KEY ("fromUomId") REFERENCES "unit_of_measure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_conversion" ADD CONSTRAINT "unit_conversion_toUomId_fkey" FOREIGN KEY ("toUomId") REFERENCES "unit_of_measure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_item" ADD CONSTRAINT "inventory_item_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_item" ADD CONSTRAINT "inventory_item_baseUomId_fkey" FOREIGN KEY ("baseUomId") REFERENCES "unit_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_uomId_fkey" FOREIGN KEY ("uomId") REFERENCES "unit_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe" ADD CONSTRAINT "recipe_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe" ADD CONSTRAINT "recipe_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "product_variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe" ADD CONSTRAINT "recipe_outputUomId_fkey" FOREIGN KEY ("outputUomId") REFERENCES "unit_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_item" ADD CONSTRAINT "recipe_item_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_item" ADD CONSTRAINT "recipe_item_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_item" ADD CONSTRAINT "recipe_item_uomId_fkey" FOREIGN KEY ("uomId") REFERENCES "unit_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list" ADD CONSTRAINT "price_list_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_line" ADD CONSTRAINT "price_list_line_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "price_list"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_list_line" ADD CONSTRAINT "price_list_line_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "product_variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_rate" ADD CONSTRAINT "tax_rate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipt" ADD CONSTRAINT "purchase_receipt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipt" ADD CONSTRAINT "purchase_receipt_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipt" ADD CONSTRAINT "purchase_receipt_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipt_line" ADD CONSTRAINT "purchase_receipt_line_purchaseReceiptId_fkey" FOREIGN KEY ("purchaseReceiptId") REFERENCES "purchase_receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipt_line" ADD CONSTRAINT "purchase_receipt_line_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipt_line" ADD CONSTRAINT "purchase_receipt_line_uomId_fkey" FOREIGN KEY ("uomId") REFERENCES "unit_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_run" ADD CONSTRAINT "production_run_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_run" ADD CONSTRAINT "production_run_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_run" ADD CONSTRAINT "production_run_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "recipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_run_material" ADD CONSTRAINT "production_run_material_productionRunId_fkey" FOREIGN KEY ("productionRunId") REFERENCES "production_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_run_material" ADD CONSTRAINT "production_run_material_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_run_reversal" ADD CONSTRAINT "production_run_reversal_originalRunId_fkey" FOREIGN KEY ("originalRunId") REFERENCES "production_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order" ADD CONSTRAINT "sales_order_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order" ADD CONSTRAINT "sales_order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order" ADD CONSTRAINT "sales_order_salesmanId_fkey" FOREIGN KEY ("salesmanId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order" ADD CONSTRAINT "sales_order_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_line" ADD CONSTRAINT "sales_order_line_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_line" ADD CONSTRAINT "sales_order_line_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "product_variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_order_line" ADD CONSTRAINT "sales_order_line_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservation" ADD CONSTRAINT "stock_reservation_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservation" ADD CONSTRAINT "stock_reservation_salesOrderLineId_fkey" FOREIGN KEY ("salesOrderLineId") REFERENCES "sales_order_line"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservation" ADD CONSTRAINT "stock_reservation_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reservation" ADD CONSTRAINT "stock_reservation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice" ADD CONSTRAINT "sales_invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice" ADD CONSTRAINT "sales_invoice_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice" ADD CONSTRAINT "sales_invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_line" ADD CONSTRAINT "sales_invoice_line_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "sales_invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch" ADD CONSTRAINT "dispatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch" ADD CONSTRAINT "dispatch_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch" ADD CONSTRAINT "dispatch_salesInvoiceId_fkey" FOREIGN KEY ("salesInvoiceId") REFERENCES "sales_invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch" ADD CONSTRAINT "dispatch_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_line" ADD CONSTRAINT "dispatch_line_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "dispatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_line" ADD CONSTRAINT "dispatch_line_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note" ADD CONSTRAINT "credit_note_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note" ADD CONSTRAINT "credit_note_salesInvoiceId_fkey" FOREIGN KEY ("salesInvoiceId") REFERENCES "sales_invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocation" ADD CONSTRAINT "payment_allocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocation" ADD CONSTRAINT "payment_allocation_salesInvoiceId_fkey" FOREIGN KEY ("salesInvoiceId") REFERENCES "sales_invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;



