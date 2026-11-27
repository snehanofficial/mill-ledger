-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MovementType" ADD VALUE 'TRANSFER_OUT';
ALTER TYPE "MovementType" ADD VALUE 'TRANSFER_IN';

-- AlterTable
ALTER TABLE "facility" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "warehouse" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "organizationId" TEXT;

UPDATE "warehouse" w
SET "organizationId" = f."organizationId"
FROM "facility" f
WHERE w."facilityId" = f."id"
  AND w."organizationId" IS NULL;

ALTER TABLE "warehouse" ALTER COLUMN "organizationId" SET NOT NULL;

-- CreateTable
CREATE TABLE "warehouse_stock_balance" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "onHand" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "reserved" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_stock_balance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "fromWarehouseId" TEXT NOT NULL,
    "toWarehouseId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "notes" TEXT,
    "idempotencyKey" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfer_line" (
    "id" TEXT NOT NULL,
    "stockTransferId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "unitCost" DECIMAL(18,6) NOT NULL,
    "totalCost" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_transfer_line_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "warehouse_stock_balance_organizationId_warehouseId_idx" ON "warehouse_stock_balance"("organizationId", "warehouseId");

-- CreateIndex
CREATE INDEX "warehouse_stock_balance_organizationId_inventoryItemId_idx" ON "warehouse_stock_balance"("organizationId", "inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_stock_balance_warehouseId_inventoryItemId_key" ON "warehouse_stock_balance"("warehouseId", "inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transfer_idempotencyKey_key" ON "stock_transfer"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transfer_organizationId_transferNumber_key" ON "stock_transfer"("organizationId", "transferNumber");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_organizationId_code_key" ON "warehouse"("organizationId", "code");

-- AddForeignKey
ALTER TABLE "warehouse" ADD CONSTRAINT "warehouse_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_stock_balance" ADD CONSTRAINT "warehouse_stock_balance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_stock_balance" ADD CONSTRAINT "warehouse_stock_balance_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_stock_balance" ADD CONSTRAINT "warehouse_stock_balance_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_line" ADD CONSTRAINT "stock_transfer_line_stockTransferId_fkey" FOREIGN KEY ("stockTransferId") REFERENCES "stock_transfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_line" ADD CONSTRAINT "stock_transfer_line_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill warehouse_stock_balance from existing stock_movement and active stock_reservation rows
INSERT INTO "warehouse_stock_balance" ("id", "organizationId", "warehouseId", "inventoryItemId", "onHand", "reserved", "updatedAt")
SELECT
  'wsb_' || md5(w."id" || ':' || sm."inventoryItemId"),
  w."organizationId",
  sm."warehouseId",
  sm."inventoryItemId",
  COALESCE(SUM(sm."quantity"), 0),
  0,
  NOW()
FROM "stock_movement" sm
JOIN "warehouse" w ON w."id" = sm."warehouseId"
GROUP BY w."id", w."organizationId", sm."warehouseId", sm."inventoryItemId"
ON CONFLICT ("warehouseId", "inventoryItemId") DO UPDATE
SET "onHand" = EXCLUDED."onHand",
    "updatedAt" = NOW();

INSERT INTO "warehouse_stock_balance" ("id", "organizationId", "warehouseId", "inventoryItemId", "onHand", "reserved", "updatedAt")
SELECT
  'wsb_' || md5(w."id" || ':' || sr."inventoryItemId"),
  w."organizationId",
  sr."warehouseId",
  sr."inventoryItemId",
  0,
  COALESCE(SUM(GREATEST(sr."reservedQuantity" - sr."releasedQuantity", 0)), 0),
  NOW()
FROM "stock_reservation" sr
JOIN "warehouse" w ON w."id" = sr."warehouseId"
WHERE sr."status" = 'ACTIVE'
GROUP BY w."id", w."organizationId", sr."warehouseId", sr."inventoryItemId"
ON CONFLICT ("warehouseId", "inventoryItemId") DO UPDATE
SET "reserved" = EXCLUDED."reserved",
    "updatedAt" = NOW();

