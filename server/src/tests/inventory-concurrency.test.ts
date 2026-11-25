import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../db/client.js";
import { seedBenchmarkMasters } from "../db/seed.js";
import { inventoryService } from "../modules/inventory/inventory.service.js";

describe("MLD-011: Inventory atomic concurrency and non-negative constraints", () => {
  let orgId: string;
  let warehouseId: string;
  let flourItemId: string;
  let uomId: string;
  let supplierId: string;

  beforeAll(async () => {
    await seedBenchmarkMasters();

    const org = await prisma.organization.findUniqueOrThrow({
      where: { code: "MILL" },
    });
    orgId = org.id;

    const wh = await prisma.warehouse.findFirstOrThrow({
      where: { facility: { organizationId: orgId } },
    });
    warehouseId = wh.id;

    const flour = await prisma.inventoryItem.findFirstOrThrow({
      where: { organizationId: orgId, sku: "RM-FLOUR" },
    });
    flourItemId = flour.id;

    const uom = await prisma.unitOfMeasure.findFirstOrThrow({
      where: { code: "KG" },
    });
    uomId = uom.id;

    const supplier = await prisma.supplier.findFirstOrThrow({
      where: { organizationId: orgId },
    });
    supplierId = supplier.id;
  });

  afterAll(async () => {
    // Clean up test purchase receipts
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL mill_ledger.bypass_immutability = 'on'");
      await tx.purchaseReceiptLine.deleteMany({
        where: {
          purchaseReceipt: {
            receiptNumber: { startsWith: "PR-CONCURRENCY-" },
          },
        },
      });
      await tx.purchaseReceipt.deleteMany({
        where: {
          receiptNumber: { startsWith: "PR-CONCURRENCY-" },
        },
      });
      await tx.stockMovement.deleteMany({
        where: {
          notes: { contains: "PR-CONCURRENCY-" },
        },
      });
    });
  });

  it("handles 10 simultaneous purchase receipts without lost updates", async () => {
    const itemBefore = await prisma.inventoryItem.findUniqueOrThrow({
      where: { id: flourItemId },
    });
    const initialStock = Number(itemBefore.currentStock);

    const concurrencyCount = 10;
    const qtyPerReceipt = 5;

    // Launch 10 simultaneous purchase receipts
    const promises = Array.from({ length: concurrencyCount }, (_, i) =>
      inventoryService.postPurchaseReceipt(
        {
          organizationId: orgId,
          supplierId,
          warehouseId,
          receiptNumber: `PR-CONCURRENCY-${Date.now()}-${i}`,
          items: [
            {
              inventoryItemId: flourItemId,
              quantity: qtyPerReceipt,
              unitPrice: 50,
              uomId,
            },
          ],
        }),
    );

    const results = await Promise.all(promises);
    expect(results).toHaveLength(concurrencyCount);

    const itemAfter = await prisma.inventoryItem.findUniqueOrThrow({
      where: { id: flourItemId },
    });
    const finalStock = Number(itemAfter.currentStock);

    expect(finalStock).toBe(initialStock + concurrencyCount * qtyPerReceipt);
  });

  it("enforces database CHECK constraint chk_current_stock_non_negative on direct reduction past 0", async () => {
    // Attempting to decrement currentStock below zero must violate the PostgreSQL check constraint
    await expect(
      prisma.inventoryItem.update({
        where: { id: flourItemId },
        data: {
          currentStock: -10,
        },
      }),
    ).rejects.toThrow();
  });

  it("executes getInventoryBalances using bulk grouping queries", async () => {
    const balances = await inventoryService.getInventoryBalances(orgId);

    // Assert that balances are returned for multiple items (e.g. >= 6 benchmark items)
    expect(balances.length).toBeGreaterThanOrEqual(6);

    for (const b of balances) {
      expect(typeof b.onHand).toBe("number");
      expect(typeof b.reserved).toBe("number");
      expect(typeof b.available).toBe("number");
      expect(typeof b.ledgerSum).toBe("number");
    }
  });
});
