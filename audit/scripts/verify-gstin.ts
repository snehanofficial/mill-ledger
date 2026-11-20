import { prisma } from "../../server/src/db/client.js";

async function main() {
  console.log("=== CHECKING GSTIN VALIDATION IN DATABASE AND REPOSITORY ===");

  const org = await prisma.organization.findFirstOrThrow({ where: { code: "MILL" } });

  // Test inserting completely invalid GSTINs:
  const invalidGstins = [
    "INVALID-GSTIN-123",
    "33INVALID",
    "99ZZZZZ9999Z9Z9",
    "000000000000000",
    "SHORT",
  ];

  for (const gstin of invalidGstins) {
    try {
      const cust = await prisma.customer.create({
        data: {
          organizationId: org.id,
          code: `CUST-TEST-${Date.now()}-${Math.floor(Math.random()*1000)}`,
          name: "Invalid GSTIN Customer",
          state: "Tamil Nadu",
          gstin: gstin,
        }
      });
      console.log(`ACTUAL: Customer created with INVALID GSTIN "${gstin}"! ID: ${cust.id}`);
      // Clean up
      await prisma.customer.delete({ where: { id: cust.id } });
    } catch (err: any) {
      console.log(`REFUSED GSTIN "${gstin}":`, err.message);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
