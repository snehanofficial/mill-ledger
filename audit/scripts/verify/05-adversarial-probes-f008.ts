import { prisma } from "../../../server/src/db/client.js";
import { seedBenchmarkMasters } from "../../../server/src/db/seed.js";
import { salesService } from "../../../server/src/modules/sales/sales.service.js";
import { dispatchService } from "../../../server/src/modules/sales/dispatch.service.js";
import { sequenceService } from "../../../server/src/modules/finance/sequence.service.js";
import type { UserContext } from "@mill-ledger/shared";

async function runAdversarialProbesF008() {
  console.log("=== STARTING ADVERSARIAL PROBES FOR F-008 ===");
  await seedBenchmarkMasters();

  const adminDb = await prisma.user.findFirstOrThrow({
    where: { role: "ADMIN" },
  });
  const adminUser: UserContext = {
    id: adminDb.id,
    email: adminDb.email,
    role: "ADMIN",
    isActive: adminDb.isActive,
    organizationId: adminDb.organizationId ?? undefined,
  };

  const org = await prisma.organization.findUniqueOrThrow({
    where: { code: "MILL" },
  });
  const orgId = org.id;

  const wh = await prisma.warehouse.findFirstOrThrow({
    where: { facility: { organizationId: orgId } },
  });
  const warehouseId = wh.id;

  const cust = await prisma.customer.findFirstOrThrow({
    where: { organizationId: orgId },
  });
  const customerId = cust.id;

  const uom = await prisma.unitOfMeasure.findFirstOrThrow({
    where: { code: "PACKET" },
  });
  const uomId = uom.id;

  const createdInvItemIds: string[] = [];
  const createdOrderIds: string[] = [];
  const createdOrgIds: string[] = [];

  try {
    // ------------------------------------------------------------------------
    // PROBE 1: 50 Concurrent Dispatches Under Heavy Load
    // ------------------------------------------------------------------------
    console.log("\n--- PROBE 1: 50 concurrent dispatches under heavy parallel load ---");
    const sku1 = `ADV-DSP50-${Date.now()}`;
    const invItem1 = await prisma.inventoryItem.create({
      data: {
        organizationId: orgId,
        sku: sku1,
        name: `Adversarial Dispatch 50 Item`,
        category: "FINISHED_GOODS",
        baseUomId: uomId,
        currentStock: 1000.0,
        weightedAverageCost: 20.0,
      },
    });
    createdInvItemIds.push(invItem1.id);

    const prd1 = await prisma.product.create({
      data: {
        organizationId: orgId,
        code: `PRD-${sku1}`,
        name: `Product ${sku1}`,
        taxRate: 5.0,
        hsnCode: "21069099",
      },
    });

    const var1 = await prisma.productVariant.create({
      data: {
        productId: prd1.id,
        sku: `VAR-${sku1}`,
        name: `Variant ${sku1}`,
        uomId,
        inventoryItemId: invItem1.id,
        packSize: 0.2,
      },
    });

    // Create and approve 50 sales orders
    const count50 = 50;
    const orders50 = [];
    for (let i = 0; i < count50; i++) {
      const res = await salesService.createSalesOrder(
        {
          organizationId: orgId,
          customerId,
          warehouseId,
          orderNumber: `SO-D50-${Date.now()}-${i}`,
          lines: [{ productVariantId: var1.id, quantity: 1, unitPrice: 50 }],
        },
        adminUser,
      );
      await salesService.approveSalesOrder(res.order.id, {}, adminUser);
      orders50.push(res.order);
      createdOrderIds.push(res.order.id);
    }

    // Fire 50 simultaneous dispatches
    const dispatch50Results = await Promise.all(
      orders50.map((o) =>
        dispatchService
          .postDispatch({
            salesOrderId: o.id,
            warehouseId,
          })
          .then((res) => ({ success: true, dispatch: res, error: null }))
          .catch((err) => ({ success: false, dispatch: null, error: err.message })),
      ),
    );

    const successful50 = dispatch50Results.filter((r) => r.success);
    const failed50 = dispatch50Results.filter((r) => !r.success);

    console.log(`Probe 1 Results: Total=50, Succeeded=${successful50.length}, Failed=${failed50.length}`);

    if (failed50.length > 0) {
      console.error("Failed dispatches sample error:", failed50[0].error);
      throw new Error(`PROBE 1 FAILED: ${failed50.length} dispatches failed during 50-way concurrent dispatch!`);
    }

    const dispatchNumbers = successful50.map((r) => r.dispatch!.dispatchNumber);
    const uniqueDispatchNumbers = new Set(dispatchNumbers);
    if (uniqueDispatchNumbers.size !== count50) {
      throw new Error(`PROBE 1 FAILED: Sequence collision! Expected 50 unique numbers, got ${uniqueDispatchNumbers.size}`);
    }
    console.log("✓ PROBE 1 PASSED: 50/50 concurrent dispatches succeeded with zero unique constraint collisions and 50 unique sequence numbers.");

    // ------------------------------------------------------------------------
    // PROBE 2: Multi-Organization Sequence Isolation
    // ------------------------------------------------------------------------
    console.log("\n--- PROBE 2: Multi-organization sequence isolation ---");
    const orgCode2 = `ORG2_${Date.now()}`;
    const org2 = await prisma.organization.create({
      data: {
        code: orgCode2,
        name: `Second Test Org ${Date.now()}`,
      },
    });
    createdOrgIds.push(org2.id);

    // Call getNextDispatchNumber concurrently across orgId and org2.id in transactions
    const [numOrg1_a, numOrg1_b, numOrg2_a, numOrg2_b] = await Promise.all([
      prisma.$transaction((tx) => sequenceService.getNextDispatchNumber(tx, orgId, "2026")),
      prisma.$transaction((tx) => sequenceService.getNextDispatchNumber(tx, orgId, "2026")),
      prisma.$transaction((tx) => sequenceService.getNextDispatchNumber(tx, org2.id, "2026")),
      prisma.$transaction((tx) => sequenceService.getNextDispatchNumber(tx, org2.id, "2026")),
    ]);

    console.log(`Org1 sequences: ${numOrg1_a}, ${numOrg1_b}`);
    console.log(`Org2 sequences: ${numOrg2_a}, ${numOrg2_b}`);

    if (numOrg1_a === numOrg1_b || numOrg2_a === numOrg2_b) {
      throw new Error("PROBE 2 FAILED: Intra-organization sequence duplicate detected!");
    }
    // Org2 starting from scratch should start at 0001
    if (numOrg2_a !== "DSP-2026-0001" && numOrg2_b !== "DSP-2026-0001") {
      throw new Error("PROBE 2 FAILED: Org2 did not start sequence independently at DSP-2026-0001!");
    }
    console.log("✓ PROBE 2 PASSED: Strict organization-level sequence isolation verified.");

    // ------------------------------------------------------------------------
    // PROBE 3: Year Rollover and 4-digit Formatting
    // ------------------------------------------------------------------------
    console.log("\n--- PROBE 3: Year rollover segregation and formatting ---");
    const [num2026, num2027, num2028] = await Promise.all([
      prisma.$transaction((tx) => sequenceService.getNextDispatchNumber(tx, org2.id, "2026")),
      prisma.$transaction((tx) => sequenceService.getNextDispatchNumber(tx, org2.id, "2027")),
      prisma.$transaction((tx) => sequenceService.getNextDispatchNumber(tx, org2.id, "2028")),
    ]);

    console.log(`Year 2026 sequence: ${num2026}`);
    console.log(`Year 2027 sequence: ${num2027}`);
    console.log(`Year 2028 sequence: ${num2028}`);

    if (!num2026.startsWith("DSP-2026-") || !num2027.startsWith("DSP-2027-") || !num2028.startsWith("DSP-2028-")) {
      throw new Error("PROBE 3 FAILED: Year prefix formatting incorrect!");
    }
    if (num2027 !== "DSP-2027-0001" || num2028 !== "DSP-2028-0001") {
      throw new Error(`PROBE 3 FAILED: New calendar year did not reset sequence counter to 0001! (Got ${num2027}, ${num2028})`);
    }
    console.log("✓ PROBE 3 PASSED: Calendar year rollover cleanly segregates sequence counters.");

    // ------------------------------------------------------------------------
    // PROBE 4: Monotonicity and Document Sequence Record Integrity
    // ------------------------------------------------------------------------
    console.log("\n--- PROBE 4: Document sequence record integrity ---");
    const seqRow = await prisma.documentSequence.findUnique({
      where: {
        organizationId_type_financialYear: {
          organizationId: org2.id,
          type: "DISPATCH",
          financialYear: "2027",
        },
      },
    });

    if (!seqRow || seqRow.currentNumber < 1) {
      throw new Error("PROBE 4 FAILED: DocumentSequence record not found or currentNumber invalid!");
    }
    console.log(`DocumentSequence record: type=${seqRow.type}, year=${seqRow.financialYear}, currentNumber=${seqRow.currentNumber}`);
    console.log("✓ PROBE 4 PASSED: DocumentSequence record confirmed in PostgreSQL database.");

    console.log("\n=== ALL ADVERSARIAL PROBES FOR F-008 PASSED SUCCESSFULLY ===");
  } finally {
    // Teardown
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL mill_ledger.bypass_immutability = 'on'");
      if (createdInvItemIds.length > 0) {
        await tx.stockMovement.deleteMany({ where: { inventoryItemId: { in: createdInvItemIds } } });
      }
      if (createdOrderIds.length > 0) {
        await tx.dispatchLine.deleteMany({ where: { dispatch: { salesOrderId: { in: createdOrderIds } } } });
        await tx.dispatch.deleteMany({ where: { salesOrderId: { in: createdOrderIds } } });
        await tx.stockReservation.deleteMany({ where: { salesOrderId: { in: createdOrderIds } } });
        await tx.salesOrderLine.deleteMany({ where: { salesOrderId: { in: createdOrderIds } } });
        await tx.salesOrder.deleteMany({ where: { id: { in: createdOrderIds } } });
      }
      if (createdInvItemIds.length > 0) {
        await tx.productVariant.deleteMany({ where: { inventoryItemId: { in: createdInvItemIds } } });
        await tx.inventoryItem.deleteMany({ where: { id: { in: createdInvItemIds } } });
      }
      if (createdOrgIds.length > 0) {
        await tx.documentSequence.deleteMany({ where: { organizationId: { in: createdOrgIds } } });
        await tx.organization.deleteMany({ where: { id: { in: createdOrgIds } } });
      }
    });
  }
}

runAdversarialProbesF008()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Adversarial Probes F-008 Failed:", err);
    process.exit(1);
  });
