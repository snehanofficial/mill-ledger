-- CreateEnum
CREATE TYPE "DebitNoteStatus" AS ENUM ('POSTED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentStatus" ADD VALUE 'BOUNCED';
ALTER TYPE "PaymentStatus" ADD VALUE 'REVERSED';

-- AlterTable
ALTER TABLE "payment" ADD COLUMN     "reversalReason" TEXT,
ADD COLUMN     "reversalReference" TEXT,
ADD COLUMN     "reversedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "payment_allocation" ADD COLUMN     "isReversed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reversedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "production_run" ADD COLUMN     "packagingMismatch" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "packagingWarning" TEXT;

-- CreateTable
CREATE TABLE "debit_note" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "debitNoteNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "purchaseReceiptId" TEXT,
    "reason" TEXT NOT NULL,
    "status" "DebitNoteStatus" NOT NULL DEFAULT 'POSTED',
    "taxableAmount" DECIMAL(18,2) NOT NULL,
    "taxAmount" DECIMAL(18,2) NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debit_note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debit_note_line" (
    "id" TEXT NOT NULL,
    "debitNoteId" TEXT NOT NULL,
    "inventoryItemId" TEXT,
    "description" TEXT,
    "quantity" DECIMAL(18,6),
    "uomId" TEXT,
    "unitPrice" DECIMAL(18,6),
    "taxableAmount" DECIMAL(18,2) NOT NULL,
    "taxAmount" DECIMAL(18,2) NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debit_note_line_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "debit_note_organizationId_supplierId_idx" ON "debit_note"("organizationId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "debit_note_organizationId_debitNoteNumber_key" ON "debit_note"("organizationId", "debitNoteNumber");

-- AddForeignKey
ALTER TABLE "debit_note" ADD CONSTRAINT "debit_note_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_note" ADD CONSTRAINT "debit_note_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_note" ADD CONSTRAINT "debit_note_purchaseReceiptId_fkey" FOREIGN KEY ("purchaseReceiptId") REFERENCES "purchase_receipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_note_line" ADD CONSTRAINT "debit_note_line_debitNoteId_fkey" FOREIGN KEY ("debitNoteId") REFERENCES "debit_note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_note_line" ADD CONSTRAINT "debit_note_line_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_note_line" ADD CONSTRAINT "debit_note_line_uomId_fkey" FOREIGN KEY ("uomId") REFERENCES "unit_of_measure"("id") ON DELETE SET NULL ON UPDATE CASCADE;
