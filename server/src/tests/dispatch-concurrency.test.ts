import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../db/client.js";
import { seedBenchmarkMasters } from "../db/seed.js";
import { salesService } from "../modules/sales/sales.service.js";
import { dispatchService } from "../modules/sales/dispatch.service.js";
import type { UserContext } from "@mill-ledger/shared";

describe("F-008: Concurrency race condition in dispatch sequence generation", () => {
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
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL mill_ledger.bypass_immutability = 'on'");
      if (createdInvItemIds.length > 0) {
        await tx.stockMovement.deleteMany({
          where: { inventoryItemId: { in: createdInvItemIds } },
        });
      }
      if (createdOrderIds.length > 0) {
        await tx.dispatchLine.deleteMany({
          where: { dispatch: { salesOrderId: { in: createdOrderIds } } },
        });
        await tx.dispatch.deleteMany({
          where: { salesOrderId: { in: createdOrderIds } },
        });
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

  it("handles 10 concurrent dispatches without unique constraint collisions", async () => {
    // Setup isolated inventory item with 500 units
    const sku = `CONC-DSP-${Date.now()}`;
    const invItem = await prisma.inventoryItem.create({
      data: {
        organizationId: orgId,
        sku,
        name: `Dispatch Concurrency Item`,
        category: "FINISHED_GOODS",
        baseUomId: uomId,
        currentStock: 500.0,
        weightedAverageCost: 20.0,
      },
    });
    createdInvItemIds.push(invItem.id);

    await prisma.warehouseStockBalance.create({
      data: {
        organizationId: orgId,
        warehouseId,
        inventoryItemId: invItem.id,
        onHand: 500.0,
        reserved: 0,
      },
    });

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

    // Create and approve 10 separate sales orders of 10 units each
    const orderCount = 10;
    const orders = [];

    for (let i = 0; i < orderCount; i++) {
      const res = await salesService.createSalesOrder(
        {
          organizationId: orgId,
          customerId,
          warehouseId,
          orderNumber: `SO-DSP-${Date.now()}-${i}`,
          lines: [
            {
              productVariantId: variant.id,
              quantity: 10,
              unitPrice: 50,
            },
          ],
        },
        adminUser,
      );
      await salesService.approveSalesOrder(res.order.id, {}, adminUser);
      orders.push(res.order);
      createdOrderIds.push(res.order.id);
    }

    // Fire 10 parallel dispatches simultaneously
    const dispatchPromises = orders.map((o) =>
      dispatchService
        .postDispatch({
          salesOrderId: o.id,
          warehouseId,
        })
        .then((res) => ({ success: true, dispatch: res, error: null }))
        .catch((err) => ({ success: false, dispatch: null, error: err.message })),
    );

    const results = await Promise.all(dispatchPromises);
    const successfulDispatches = results.filter((r) => r.success);
    const failedDispatches = results.filter((r) => !r.success);

    // Assert that zero dispatches failed with unique constraint violations
    const uniqueConstraintErrors = failedDispatches.filter((f) =>
      f.error?.includes("Unique constraint failed") || f.error?.includes("dispatch_organizationId_dispatchNumber_key"),
    );

    expect(uniqueConstraintErrors).toHaveLength(0);
    expect(failedDispatches).toHaveLength(0);
    expect(successfulDispatches).toHaveLength(orderCount);

    // Verify all dispatch numbers are distinct
    const dispatchNumbers = successfulDispatches.map((d) => d.dispatch!.dispatchNumber);
    const uniqueNumbers = new Set(dispatchNumbers);
    expect(uniqueNumbers.size).toBe(orderCount);
  });
});
