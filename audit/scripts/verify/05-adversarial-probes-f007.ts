import { prisma } from "../../../server/src/db/client.js";
import { seedBenchmarkMasters } from "../../../server/src/db/seed.js";
import { salesService } from "../../../server/src/modules/sales/sales.service.js";
import type { UserContext } from "@mill-ledger/shared";

async function runAdversarialProbesF007() {
  console.log("=== STARTING ADVERSARIAL PROBES FOR F-007 ===");
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

  try {
    // ------------------------------------------------------------------------
    // PROBE 1: High concurrency (50 parallel approval requests for 100 units)
    // ------------------------------------------------------------------------
    console.log("\n--- PROBE 1: 50 concurrent approval requests against 100 available units ---");
    const sku1 = `ADV-P1-${Date.now()}`;
    const invItem1 = await prisma.inventoryItem.create({
      data: {
        organizationId: orgId,
        sku: sku1,
        name: `Adversarial P1 Item`,
        category: "FINISHED_GOODS",
        baseUomId: uomId,
        currentStock: 100.0,
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

    const ordersP1 = [];
    for (let i = 0; i < 50; i++) {
      const res = await salesService.createSalesOrder(
        {
          organizationId: orgId,
          customerId,
          warehouseId,
          orderNumber: `SO-P1-${Date.now()}-${i}`,
          lines: [{ productVariantId: var1.id, quantity: 10, unitPrice: 50 }],
        },
        adminUser,
      );
      ordersP1.push(res.order);
      createdOrderIds.push(res.order.id);
    }

    const p1Results = await Promise.all(
      ordersP1.map((o) =>
        salesService
          .approveSalesOrder(o.id, {}, adminUser)
          .then(() => ({ success: true, orderId: o.id, error: null }))
          .catch((err) => ({ success: false, orderId: o.id, error: err.message })),
      ),
    );

    const p1Approved = p1Results.filter((r) => r.success).length;
    const p1Rejected = p1Results.filter((r) => !r.success).length;

    const resAgg1 = await prisma.stockReservation.aggregate({
      where: { inventoryItemId: invItem1.id, status: "ACTIVE" },
      _sum: { reservedQuantity: true },
    });
    const totalReserved1 = Number(resAgg1._sum.reservedQuantity ?? 0);

    console.log(`Probe 1 Results: Approved=${p1Approved}, Rejected=${p1Rejected}, TotalReserved=${totalReserved1} (Stock=100)`);
    if (totalReserved1 > 100) {
      throw new Error(`PROBE 1 FAILED: Stock oversold! Total reserved ${totalReserved1} > 100`);
    }
    if (p1Approved !== 10 || p1Rejected !== 40) {
      throw new Error(`PROBE 1 FAILED: Expected exactly 10 approved and 40 rejected, got ${p1Approved} approved, ${p1Rejected} rejected`);
    }
    console.log("✓ PROBE 1 PASSED: Strict 100-unit ATP reservation maintained under 50 concurrent requests.");

    // ------------------------------------------------------------------------
    // PROBE 2: Multi-line orders with inverse lock order (Deadlock Freedom Probe)
    // ------------------------------------------------------------------------
    console.log("\n--- PROBE 2: Multi-line orders with shuffled line order (Deadlock Prevention) ---");
    const itemIdsP2: string[] = [];
    const varIdsP2: string[] = [];
    for (let i = 0; i < 3; i++) {
      const sku = `ADV-P2-${Date.now()}-${i}`;
      const item = await prisma.inventoryItem.create({
        data: {
          organizationId: orgId,
          sku,
          name: `P2 Multi-item ${i}`,
          category: "FINISHED_GOODS",
          baseUomId: uomId,
          currentStock: 200.0,
          weightedAverageCost: 15.0,
        },
      });
      createdInvItemIds.push(item.id);
      itemIdsP2.push(item.id);

      const prd = await prisma.product.create({
        data: {
          organizationId: orgId,
          code: `PRD-${sku}`,
          name: `Product ${sku}`,
          taxRate: 5.0,
          hsnCode: "21069099",
        },
      });
      const v = await prisma.productVariant.create({
        data: {
          productId: prd.id,
          sku: `VAR-${sku}`,
          name: `Variant ${sku}`,
          uomId,
          inventoryItemId: item.id,
          packSize: 0.2,
        },
      });
      varIdsP2.push(v.id);
    }

    // Create 30 orders with different variant orderings: [0, 1, 2], [2, 1, 0], [1, 2, 0]
    const ordersP2 = [];
    for (let i = 0; i < 30; i++) {
      const lineOrder = i % 3 === 0 ? [0, 1, 2] : i % 3 === 1 ? [2, 1, 0] : [1, 2, 0];
      const res = await salesService.createSalesOrder(
        {
          organizationId: orgId,
          customerId,
          warehouseId,
          orderNumber: `SO-P2-${Date.now()}-${i}`,
          lines: lineOrder.map((idx) => ({
            productVariantId: varIdsP2[idx],
            quantity: 5,
            unitPrice: 30,
          })),
        },
        adminUser,
      );
      ordersP2.push(res.order);
      createdOrderIds.push(res.order.id);
    }

    // Fire 30 concurrent approvals
    const p2Results = await Promise.all(
      ordersP2.map((o) =>
        salesService
          .approveSalesOrder(o.id, {}, adminUser)
          .then(() => ({ success: true, orderId: o.id, error: null }))
          .catch((err) => ({ success: false, orderId: o.id, error: err.message })),
      ),
    );

    const deadlockErrors = p2Results.filter(
      (r) => r.error && (r.error.includes("deadlock detected") || r.error.includes("40P01")),
    );
    console.log(`Probe 2 Results: Total=${p2Results.length}, Succeeded=${p2Results.filter((r) => r.success).length}, Deadlocks=${deadlockErrors.length}`);
    if (deadlockErrors.length > 0) {
      throw new Error(`PROBE 2 FAILED: Deadlock detected in multi-line order approvals!`);
    }
    console.log("✓ PROBE 2 PASSED: Deterministic item sorting prevented deadlocks across concurrent multi-line orders.");

    // ------------------------------------------------------------------------
    // PROBE 3: Partial stock failure atomic rollback
    // ------------------------------------------------------------------------
    console.log("\n--- PROBE 3: Partial stock shortage atomicity probe ---");
    // Line 1 has stock (100), Line 2 has insufficient stock (5)
    const sku3a = `ADV-P3A-${Date.now()}`;
    const invItem3a = await prisma.inventoryItem.create({
      data: {
        organizationId: orgId,
        sku: sku3a,
        name: `P3 Sufficient Item`,
        category: "FINISHED_GOODS",
        baseUomId: uomId,
        currentStock: 100.0,
        weightedAverageCost: 10.0,
      },
    });
    createdInvItemIds.push(invItem3a.id);

    const sku3b = `ADV-P3B-${Date.now()}`;
    const invItem3b = await prisma.inventoryItem.create({
      data: {
        organizationId: orgId,
        sku: sku3b,
        name: `P3 Insufficient Item`,
        category: "FINISHED_GOODS",
        baseUomId: uomId,
        currentStock: 5.0,
        weightedAverageCost: 10.0,
      },
    });
    createdInvItemIds.push(invItem3b.id);

    const prd3a = await prisma.product.create({
      data: { organizationId: orgId, code: `PRD-${sku3a}`, name: `PRD ${sku3a}`, taxRate: 5.0, hsnCode: "21069099" },
    });
    const var3a = await prisma.productVariant.create({
      data: { productId: prd3a.id, sku: `VAR-${sku3a}`, name: `VAR ${sku3a}`, uomId, inventoryItemId: invItem3a.id, packSize: 0.2 },
    });

    const prd3b = await prisma.product.create({
      data: { organizationId: orgId, code: `PRD-${sku3b}`, name: `PRD ${sku3b}`, taxRate: 5.0, hsnCode: "21069099" },
    });
    const var3b = await prisma.productVariant.create({
      data: { productId: prd3b.id, sku: `VAR-${sku3b}`, name: `VAR ${sku3b}`, uomId, inventoryItemId: invItem3b.id, packSize: 0.2 },
    });

    const orderP3 = await salesService.createSalesOrder(
      {
        organizationId: orgId,
        customerId,
        warehouseId,
        orderNumber: `SO-P3-${Date.now()}`,
        lines: [
          { productVariantId: var3a.id, quantity: 10, unitPrice: 40 },
          { productVariantId: var3b.id, quantity: 50, unitPrice: 40 }, // requested 50, only 5 available
        ],
      },
      adminUser,
    );
    createdOrderIds.push(orderP3.order.id);

    let p3Failed = false;
    try {
      await salesService.approveSalesOrder(orderP3.order.id, {}, adminUser);
    } catch (err: any) {
      p3Failed = true;
      console.log(`Probe 3 expected rejection caught: "${err.message}"`);
    }

    if (!p3Failed) {
      throw new Error("PROBE 3 FAILED: Order should have been rejected due to line 2 stock shortage!");
    }

    // Verify atomic rollback: item3a must have 0 reservations
    const resAgg3a = await prisma.stockReservation.aggregate({
      where: { inventoryItemId: invItem3a.id, status: "ACTIVE" },
      _sum: { reservedQuantity: true },
    });
    const reserved3a = Number(resAgg3a._sum.reservedQuantity ?? 0);
    if (reserved3a !== 0) {
      throw new Error(`PROBE 3 FAILED: Atomic rollback failed! Item 3A has ${reserved3a} orphaned reservations.`);
    }
    console.log("✓ PROBE 3 PASSED: Atomic rollback confirmed. Zero orphaned reservations created.");

    // ------------------------------------------------------------------------
    // PROBE 4: Zero stock item (currentStock = 0)
    // ------------------------------------------------------------------------
    console.log("\n--- PROBE 4: Zero stock concurrent rejection probe ---");
    const sku4 = `ADV-P4-${Date.now()}`;
    const invItem4 = await prisma.inventoryItem.create({
      data: {
        organizationId: orgId,
        sku: sku4,
        name: `P4 Zero Stock Item`,
        category: "FINISHED_GOODS",
        baseUomId: uomId,
        currentStock: 0.0,
        weightedAverageCost: 10.0,
      },
    });
    createdInvItemIds.push(invItem4.id);

    const prd4 = await prisma.product.create({
      data: { organizationId: orgId, code: `PRD-${sku4}`, name: `PRD ${sku4}`, taxRate: 5.0, hsnCode: "21069099" },
    });
    const var4 = await prisma.productVariant.create({
      data: { productId: prd4.id, sku: `VAR-${sku4}`, name: `VAR ${sku4}`, uomId, inventoryItemId: invItem4.id, packSize: 0.2 },
    });

    const ordersP4 = [];
    for (let i = 0; i < 10; i++) {
      const res = await salesService.createSalesOrder(
        {
          organizationId: orgId,
          customerId,
          warehouseId,
          orderNumber: `SO-P4-${Date.now()}-${i}`,
          lines: [{ productVariantId: var4.id, quantity: 1, unitPrice: 20 }],
        },
        adminUser,
      );
      ordersP4.push(res.order);
      createdOrderIds.push(res.order.id);
    }

    const p4Results = await Promise.all(
      ordersP4.map((o) =>
        salesService
          .approveSalesOrder(o.id, {}, adminUser)
          .then(() => ({ success: true, orderId: o.id, error: null }))
          .catch((err) => ({ success: false, orderId: o.id, error: err.message })),
      ),
    );

    const p4Approved = p4Results.filter((r) => r.success).length;
    if (p4Approved > 0) {
      throw new Error(`PROBE 4 FAILED: ${p4Approved} orders approved on zero stock!`);
    }
    console.log("✓ PROBE 4 PASSED: 10/10 concurrent requests cleanly rejected on 0 available stock.");

    // ------------------------------------------------------------------------
    // PROBE 5: Invalid override quantities (<= 0)
    // ------------------------------------------------------------------------
    console.log("\n--- PROBE 5: Negative / Zero override validation ---");
    const orderP5 = await salesService.createSalesOrder(
      {
        organizationId: orgId,
        customerId,
        warehouseId,
        orderNumber: `SO-P5-${Date.now()}`,
        lines: [{ productVariantId: var1.id, quantity: 10, unitPrice: 50 }],
      },
      adminUser,
    );
    createdOrderIds.push(orderP5.order.id);

    let zeroOverrideRejected = false;
    try {
      await salesService.approveSalesOrder(
        orderP5.order.id,
        {
          lineOverrides: [{ lineId: orderP5.order.lines[0].id, approvedQuantity: 0 }],
        },
        adminUser,
      );
    } catch (err: any) {
      if (err.statusCode === 400 && err.message.includes("greater than zero")) {
        zeroOverrideRejected = true;
      }
    }

    if (!zeroOverrideRejected) {
      throw new Error("PROBE 5 FAILED: Zero approvedQuantity override was not rejected with 400 AppError!");
    }
    console.log("✓ PROBE 5 PASSED: Zero approved quantity override correctly rejected.");

    console.log("\n=== ALL ADVERSARIAL PROBES FOR F-007 PASSED SUCCESSFULLY ===");
  } finally {
    // Teardown
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL mill_ledger.bypass_immutability = 'on'");
      if (createdOrderIds.length > 0) {
        await tx.stockReservation.deleteMany({ where: { salesOrderId: { in: createdOrderIds } } });
        await tx.salesOrderLine.deleteMany({ where: { salesOrderId: { in: createdOrderIds } } });
        await tx.salesOrder.deleteMany({ where: { id: { in: createdOrderIds } } });
      }
      if (createdInvItemIds.length > 0) {
        await tx.productVariant.deleteMany({ where: { inventoryItemId: { in: createdInvItemIds } } });
        await tx.inventoryItem.deleteMany({ where: { id: { in: createdInvItemIds } } });
      }
    });
  }
}

runAdversarialProbesF007()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Adversarial Probes F-007 Failed:", err);
    process.exit(1);
  });
