import { prisma } from "../../server/src/db/client.js";

async function main() {
  console.log("=== CHECKING IMMUTABILITY AT DATABASE LEVEL ===");
  
  // 1. Check stock_movement
  const sm = await prisma.stockMovement.findFirst();
  if (sm) {
    console.log(`Found stock_movement: ${sm.id}, qty=${sm.quantity}`);
    try {
      await prisma.$executeRaw`UPDATE "stock_movement" SET "quantity" = 999.000000 WHERE "id" = ${sm.id}`;
      console.log("ACTUAL: Database ALLOWED UPDATE on stock_movement!");
      // Revert back
      await prisma.$executeRaw`UPDATE "stock_movement" SET "quantity" = ${sm.quantity} WHERE "id" = ${sm.id}`;
    } catch (e: any) {
      console.log("Database REFUSED UPDATE on stock_movement:", e.message);
    }

    try {
      // Test DELETE inside a transaction that rolls back
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`DELETE FROM "stock_movement" WHERE "id" = ${sm.id}`;
        console.log("ACTUAL: Database ALLOWED DELETE on stock_movement!");
        throw new Error("ROLLBACK_FOR_TEST");
      });
    } catch (e: any) {
      if (e.message === "ROLLBACK_FOR_TEST") {
        console.log("DELETE succeeded before transaction rollback.");
      } else {
        console.log("Database REFUSED DELETE on stock_movement:", e.message);
      }
    }
  }

  // 2. Check sales_invoice
  // Create a dummy posted invoice inside a test transaction to see if DB allows UPDATE or DELETE
  try {
    await prisma.$transaction(async (tx) => {
      const org = await tx.organization.findFirstOrThrow();
      const cust = await tx.customer.findFirstOrThrow();
      const inv = await tx.salesInvoice.create({
        data: {
          organizationId: org.id,
          invoiceNumber: "INV-TEST-IMMUTABLE",
          financialYear: "2026-27",
          customerId: cust.id,
          customerNameSnapshot: cust.name,
          deliveryStateSnapshot: "Tamil Nadu",
          companyGstinSnapshot: "33AAAAA0000A1Z5",
          status: "POSTED",
          taxableAmount: 100,
          cgstAmount: 2.5,
          sgstAmount: 2.5,
          igstAmount: 0,
          totalTaxAmount: 5,
          totalAmount: 105,
          outstandingAmount: 105,
        }
      });
      console.log(`Created test posted invoice: ${inv.id}`);

      // Attempt UPDATE
      await tx.$executeRaw`UPDATE "sales_invoice" SET "totalAmount" = 9999 WHERE "id" = ${inv.id}`;
      console.log("ACTUAL: Database ALLOWED UPDATE on sales_invoice!");

      // Attempt DELETE
      await tx.$executeRaw`DELETE FROM "sales_invoice" WHERE "id" = ${inv.id}`;
      console.log("ACTUAL: Database ALLOWED DELETE on sales_invoice!");

      throw new Error("ROLLBACK_FOR_TEST");
    });
  } catch (e: any) {
    if (e.message !== "ROLLBACK_FOR_TEST") {
      console.log("Database refused operation on sales_invoice:", e.message);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
