import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./db/client.js";
import { seedBenchmarkMasters } from "./db/seed.js";
import { sequenceService } from "./modules/finance/sequence.service.js";

describe("MLD-012: Atomic document sequence generation and concurrency", () => {
  let orgId: string;

  beforeAll(async () => {
    await seedBenchmarkMasters();

    const org = await prisma.organization.findUniqueOrThrow({
      where: { code: "MILL" },
    });
    orgId = org.id;

    // Clear test sequence rows for isolated test run
    await prisma.documentSequence.deleteMany({
      where: {
        organizationId: orgId,
        type: "TEST_CONCURRENCY",
      },
    });
  });

  it("generates 20 consecutive, collision-free numbers under simultaneous execution", async () => {
    const testFy = "2026-27";
    const totalRequests = 20;

    // Fire 20 parallel transactions that atomically acquire next sequence number
    const sequencePromises = Array.from({ length: totalRequests }, () =>
      prisma.$transaction(async (tx) => {
        return await sequenceService.getNextSequence(
          tx,
          orgId,
          "TEST_CONCURRENCY",
          testFy,
        );
      }),
    );

    const generatedNumbers = await Promise.all(sequencePromises);

    // Verify all 20 numbers are unique
    const uniqueNumbers = new Set(generatedNumbers);
    expect(uniqueNumbers.size).toBe(totalRequests);

    // Verify consecutive ordering (1 to 20)
    const sorted = [...generatedNumbers].sort((a, b) => a - b);
    expect(sorted).toEqual(
      Array.from({ length: totalRequests }, (_, i) => i + 1),
    );
  });

  it("formats invoice numbers conforming to GST financial year pattern", async () => {
    const invoiceNumber = await prisma.$transaction(async (tx) => {
      return await sequenceService.getNextInvoiceNumber(tx, orgId, "2026-27");
    });

    expect(invoiceNumber).toMatch(/^INV-2026-27-\d{4}$/);
  });
});
