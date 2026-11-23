-- AlterEnum
ALTER TYPE "ReservationStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

-- AlterTable
ALTER TABLE "stock_reservation" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stock_reservation_status_expiresAt_idx" ON "stock_reservation"("status", "expiresAt");
