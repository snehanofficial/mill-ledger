export class SequenceService {
    /**
     * Atomically acquires and increments the document sequence counter for an organization,
     * document type, and financial year within an interactive transaction.
     * Guarantees strictly consecutive, collision-free numbers without table locks.
     */
    async getNextSequence(tx, organizationId, type, financialYear) {
        // Check if sequence row exists under row lock
        const existingRows = await tx.$queryRaw `
      SELECT "current_value" FROM "document_sequences"
      WHERE "organization_id" = ${organizationId}
        AND "type" = ${type}
        AND "financial_year" = ${financialYear}
      FOR UPDATE
    `;
        if (existingRows.length > 0) {
            const nextVal = existingRows[0].current_value + 1;
            await tx.$executeRaw `
        UPDATE "document_sequences"
        SET "current_value" = ${nextVal}, "updated_at" = NOW()
        WHERE "organization_id" = ${organizationId}
          AND "type" = ${type}
          AND "financial_year" = ${financialYear}
      `;
            return nextVal;
        }
        // Row does not exist yet: initialize based on existing documents if any
        let existingCount = 0;
        if (type === "SALES_INVOICE") {
            existingCount = await tx.salesInvoice.count({
                where: { organizationId, financialYear },
            });
        }
        const initialVal = existingCount + 1;
        // Concurrency-safe UPSERT with row lock
        const insertedRows = await tx.$queryRaw `
      INSERT INTO "document_sequences" ("id", "organization_id", "type", "financial_year", "current_value", "updated_at")
      VALUES (gen_random_uuid()::text, ${organizationId}, ${type}, ${financialYear}, ${initialVal}, NOW())
      ON CONFLICT ("organization_id", "type", "financial_year")
      DO UPDATE SET
        "current_value" = "document_sequences"."current_value" + 1,
        "updated_at" = NOW()
      RETURNING "current_value"
    `;
        return insertedRows[0].current_value;
    }
    /**
     * Format invoice number according to GST compliance: INV-{FY}-{XXXX}
     */
    async getNextInvoiceNumber(tx, organizationId, financialYear) {
        const seq = await this.getNextSequence(tx, organizationId, "SALES_INVOICE", financialYear);
        return `INV-${financialYear}-${seq.toString().padStart(4, "0")}`;
    }
}
export const sequenceService = new SequenceService();
