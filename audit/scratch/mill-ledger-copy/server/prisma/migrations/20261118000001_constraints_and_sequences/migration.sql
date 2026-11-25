-- AlterTable
ALTER TABLE "user" ADD COLUMN "organization_id" TEXT;

-- CreateTable
CREATE TABLE "document_sequences" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "financial_year" TEXT NOT NULL,
    "current_value" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_sequences_organization_id_type_financial_year_key" ON "document_sequences"("organization_id", "type", "financial_year");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CheckConstraints (MLD-004, MLD-011, DEC-003)
ALTER TABLE "inventory_item" ADD CONSTRAINT "chk_current_stock_non_negative" CHECK ("currentStock" >= 0);
ALTER TABLE "sales_invoice" ADD CONSTRAINT "chk_invoice_taxable_amount_non_negative" CHECK ("taxableAmount" >= 0);
ALTER TABLE "sales_order" ADD CONSTRAINT "chk_order_taxable_amount_non_negative" CHECK ("taxableAmount" >= 0);
