import { prisma } from "../../server/src/db/client.js";
import { sequenceService } from "../../server/src/modules/finance/sequence.service.js";

async function main() {
  console.log("=== CHECKING INVOICE NUMBERING GAPLESS TRANSACTION ROLLBACK ===");

  const org = await prisma.organization.findFirstOrThrow({ where: { code: "MILL" } });
  const fy = "2026-27";

  // Step 1: Check initial sequence value
  const initialRow = await prisma.$queryRaw<any[]>`
    SELECT "current_value" FROM "document_sequences"
    WHERE "organization_id" = ${org.id} AND "type" = 'SALES_INVOICE' AND "financial_year" = ${fy}
  `;
  const initialSeq = initialRow[0]?.current_value ?? 0;
  console.log(`Initial sequence value for FY ${fy}:`, initialSeq);

  // Step 2: Post an invoice number inside a transaction that fails mid-post
  let failedNumber = "";
  try {
    await prisma.$transaction(async (tx) => {
      failedNumber = await sequenceService.getNextInvoiceNumber(tx, org.id, fy);
      console.log(`Generated invoice number inside failing tx: ${failedNumber}`);
      throw new Error("FORCED_MID_POST_FAILURE");
    });
  } catch (err: any) {
    console.log("Transaction successfully rolled back with error:", err.message);
  }

  // Step 3: Check sequence value in DB after rollback
  const rowAfterRollback = await prisma.$queryRaw<any[]>`
    SELECT "current_value" FROM "document_sequences"
    WHERE "organization_id" = ${org.id} AND "type" = 'SALES_INVOICE' AND "financial_year" = ${fy}
  `;
  const seqAfterRollback = rowAfterRollback[0]?.current_value ?? 0;
  console.log(`Sequence value in DB after rollback:`, seqAfterRollback);

  // Step 4: Next transaction gets next invoice number
  let nextNumber = "";
  await prisma.$transaction(async (tx) => {
    nextNumber = await sequenceService.getNextInvoiceNumber(tx, org.id, fy);
  });
  console.log(`Next generated invoice number in succeeding tx: ${nextNumber}`);

  const isGapless = nextNumber === failedNumber;
  console.log(`\nIs numbering strictly gapless on failure? ${isGapless} (${failedNumber} == ${nextNumber})`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
