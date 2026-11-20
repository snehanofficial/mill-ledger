import { prisma } from "../../server/src/db/client.js";
import { inventoryService } from "../../server/src/modules/inventory/inventory.service.js";
import { productionService } from "../../server/src/modules/production/production.service.js";
import { Prisma } from "@prisma/client";

async function main() {
  console.log("=== TESTING PARALLEL PURCHASE RECEIPTS AND PRODUCTION RUNS ON SAME ITEM ===");

  const org = await prisma.organization.findFirstOrThrow({ where: { code: "MILL" } });
  const wh = await prisma.warehouse.findFirstOrThrow({ where: { facility: { organizationId: org.id } } });
  const supplier = await prisma.supplier.findFirstOrThrow({ where: { organizationId: org.id } });
  const uom = await prisma.unitOfMeasure.findFirstOrThrow({ where: { code: "KG" } });

  // Create isolated item with opening stock 100 @ 40
  const sku = `WAC-CONC-${Date.now()}`;
  const item = await prisma.inventoryItem.create({
    data: {
      organizationId: org.id,
      sku,
      name: `WAC Concurrency Item`,
      category: "RAW_MATERIAL",
      baseUomId: uom.id,
      currentStock: 100.000000,
      weightedAverageCost: 40.000000,
    }
  });

  console.log(`Starting stock: 100 @ 40. Total value: 4000`);

  // We will run 5 purchase receipts in parallel:
  // Each receipt adds 20 units @ 50 (total value +1000 each)
  // Serially:
  // Stock 100 @ 40 -> 4000
  // Receipt 1: +20 @ 50 -> 120 qty, 5000 value, avg = 41.666667
  // Receipt 2: +20 @ 50 -> 140 qty, 6000 value, avg = 42.857143
  // Receipt 3: +20 @ 50 -> 160 qty, 7000 value, avg = 43.750000
  // Receipt 4: +20 @ 50 -> 180 qty, 8000 value, avg = 44.444444
  // Receipt 5: +20 @ 50 -> 200 qty, 9000 value, avg = 45.000000
  // Expected final: exactly 200 qty, weightedAverageCost = 45.000000

  const promises = [1, 2, 3, 4, 5].map((i) =>
    inventoryService.postPurchaseReceipt({
      organizationId: org.id,
      supplierId: supplier.id,
      warehouseId: wh.id,
      receiptNumber: `PR-WAC-${Date.now()}-${i}`,
      items: [
        {
          inventoryItemId: item.id,
          quantity: 20,
          unitPrice: 50,
          uomId: uom.id,
        }
      ]
    })
  );

  await Promise.all(promises);

  const updatedItem = await prisma.inventoryItem.findUniqueOrThrow({
    where: { id: item.id }
  });

  const finalStock = Number(updatedItem.currentStock);
  const finalCost = Number(updatedItem.weightedAverageCost);

  console.log(`Final Stock: ${finalStock} (Expected: 200)`);
  console.log(`Final Weighted Average Cost: ${finalCost} (Expected: 45)`);

  const stockMatch = finalStock === 200;
  const costMatch = Math.abs(finalCost - 45.0) < 0.0001;

  console.log(`Stock match: ${stockMatch}, Cost match: ${costMatch}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
