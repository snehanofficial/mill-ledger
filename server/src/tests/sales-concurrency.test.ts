import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../db/client.js";
import { seedBenchmarkMasters } from "../db/seed.js";
import { salesService } from "../modules/sales/sales.service.js";
import type { UserContext } from "@mill-ledger/shared";

describe("F-007: Concurrency race condition in sales order approval (ATP stock overselling)", () => {
  let adminUser: UserContext;
  let orgId: string;
  let warehouseId: string;
  let customerId: string;
  let uomId: string;
  const createdInvItemIds: string[] = [];
  const createdOrderIds: string[] = [];

  beforeAll(async () => {
    await seedBenchmarkMasters();

    const adminDb = await prisma.user.findFirstOrThrow({
      where: { role: "ADMIN" },
    });
    adminUser = {
      id: adminDb.id,
      email: adminDb.email,
      role: "ADMIN",
      isActive: adminDb.isActive,
      organizationId: adminDb.organizationId ?? undefined,
    };

    const org = await prisma.organization.findUniqueOrThrow({
      where: { code: "MILL" },
    });
    orgId = org.id;

    const wh = await prisma.warehouse.findFirstOrThrow({
      where: { facility: { organizationId: orgId } },
    });
    warehouseId = wh.id;

    const cust = await prisma.customer.findFirstOrThrow({
      where: { organizationId: orgId },
    });
    customerId = cust.id;

    const uom = await prisma.unitOfMeasure.findFirstOrThrow({
      where: { code: "PACKET" },
    });
    uomId = uom.id;
  });

  afterAll(async () => {
    // Teardown test artifacts
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        "SET LOCAL mill_ledger.bypass_immutability = 'on'",
      );
      if (createdOrderIds.length > 0) {
        await tx.stockReservation.deleteMany({
          where: { salesOrderId: { in: createdOrderIds } },
        });
        await tx.salesOrderLine.deleteMany({
          where: { salesOrderId: { in: createdOrderIds } },
        });
        await tx.salesOrder.deleteMany({
          where: { id: { in: createdOrderIds } },
        });
      }
      if (createdInvItemIds.length > 0) {
        await tx.productVariant.deleteMany({
          where: { inventoryItemId: { in: createdInvItemIds } },
        });
        await tx.inventoryItem.deleteMany({
          where: { id: { in: createdInvItemIds } },
        });
      }
    });
  });

  it("prevents overselling when 20 concurrent approval requests compete for 50 available units", async () => {
    // Setup isolated inventory item with currentStock = 50
    const sku = `CONC-ATP-${Date.now()}`;
    const invItem = await prisma.inventoryItem.create({
      data: {
        organizationId: orgId,
        sku,
        name: `ATP Concurrency Test Item`,
        category: "FINISHED_GOODS",
        baseUomId: uomId,
        currentStock: 50.0,
        weightedAverageCost: 20.0,
      },
    });
    createdInvItemIds.push(invItem.id);

    const prd = await prisma.product.create({
      data: {
        organizationId: orgId,
        code: `PRD-${sku}`,
        name: `Product ${sku}`,
        taxRate: 5.0,
        hsnCode: "21069099",
      },
    });

    const variant = await prisma.productVariant.create({
      data: {
        productId: prd.id,
        sku: `VAR-${sku}`,
        name: `Variant ${sku}`,
        uomId,
        inventoryItemId: invItem.id,
        packSize: 0.2,
      },
    });

    // Create 20 SUBMITTED sales orders requesting 10 units each (total demand: 200, available: 50)
    const orderCount = 20;
    const qtyPerOrder = 10;
    const orders = [];

    for (let i = 0; i < orderCount; i++) {
      const res = await salesService.createSalesOrder(
        {
          organizationId: orgId,
          customerId,
          warehouseId,
          orderNumber: `SO-ATP-${Date.now()}-${i}`,
          lines: [
            {
              productVariantId: variant.id,
              quantity: qtyPerOrder,
              unitPrice: 50,
            },
          ],
        },
        adminUser,
      );
      orders.push(res.order);
      createdOrderIds.push(res.order.id);
    }

    // Fire 20 parallel approval requests simultaneously
    const approvePromises = orders.map((o) =>
      salesService
        .approveSalesOrder(o.id, {}, adminUser)
        .then(() => ({ success: true, orderId: o.id, error: null }))
        .catch((err) => ({
          success: false,
          orderId: o.id,
          error: err.message,
        })),
    );

    const results = await Promise.all(approvePromises);
    const approvedCount = results.filter((r) => r.success).length;
    const rejectedCount = results.filter((r) => !r.success).length;

    // Check total active stock reservations created
    const resAgg = await prisma.stockReservation.aggregate({
      where: {
        inventoryItemId: invItem.id,
        status: "ACTIVE",
      },
      _sum: {
        reservedQuantity: true,
      },
    });
    const totalReserved = Number(resAgg._sum.reservedQuantity ?? 0);

    // With 50 available units and 10 units per order, at most 5 orders can be approved.
    // Total reserved MUST NEVER exceed 50.
    expect(totalReserved).toBeLessThanOrEqual(50);
    expect(approvedCount).toBeLessThanOrEqual(5);
    expect(approvedCount + rejectedCount).toBe(20);
  });
});
