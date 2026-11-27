-- AlterTable
ALTER TABLE "audit_log" ADD COLUMN     "actorName" TEXT,
ADD COLUMN     "actorType" TEXT NOT NULL DEFAULT 'USER',
ADD COLUMN     "changes" JSONB,
ADD COLUMN     "correlationId" TEXT,
ADD COLUMN     "eventType" TEXT,
ADD COLUMN     "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "relatedEntities" JSONB,
ADD COLUMN     "schemaVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'API',
ADD COLUMN     "summary" TEXT;

-- CreateIndex
CREATE INDEX "audit_log_organizationId_entity_entityId_timestamp_idx" ON "audit_log"("organizationId", "entity", "entityId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "audit_log_organizationId_entityId_idx" ON "audit_log"("organizationId", "entityId");

-- CreateIndex
CREATE INDEX "audit_log_correlationId_idx" ON "audit_log"("correlationId");
