import { prisma } from "../../server/src/db/client.js";
import { productionService } from "../../server/src/modules/production/production.service.js";

async function main() {
  console.log("=== CHECKING PRODUCTION COSTING, BOM VERSIONING & PACKAGING WARNING ===");

  const org = await prisma.organization.findFirstOrThrow({ where: { code: "MILL" } });
  const wh = await prisma.warehouse.findFirstOrThrow({ where: { facility: { organizationId: org.id } } });
  const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku: "VAR-MURUKKU-200G" } });
  const recipeV1 = await prisma.recipe.findFirstOrThrow({
    where: { productVariantId: variant.id, version: 1 },
    include: { items: { include: { inventoryItem: true } } }
  });

  console.log(`Found Recipe V1: ${recipeV1.name}, Version: ${recipeV1.version}`);
  console.log(`BOM Items count: ${recipeV1.items.length}`);

  // 1. Post a production run with Recipe V1
  const flourItem = recipeV1.items.find(i => i.inventoryItem.sku === "RM-FLOUR")!.inventoryItem;
  const oilItem = recipeV1.items.find(i => i.inventoryItem.sku === "RM-OIL")!.inventoryItem;
  const spiceItem = recipeV1.items.find(i => i.inventoryItem.sku === "RM-SPICE")!.inventoryItem;
  const pouchItem = recipeV1.items.find(i => i.inventoryItem.sku === "PKG-POUCH-200G")!.inventoryItem;
  const cartonItem = recipeV1.items.find(i => i.inventoryItem.sku === "PKG-CARTON")!.inventoryItem;

  // Ensure stock is available for the run
  await prisma.inventoryItem.update({ where: { id: flourItem.id }, data: { currentStock: 200 } });
  await prisma.inventoryItem.update({ where: { id: oilItem.id }, data: { currentStock: 100 } });
  await prisma.inventoryItem.update({ where: { id: spiceItem.id }, data: { currentStock: 50 } });
  await prisma.inventoryItem.update({ where: { id: pouchItem.id }, data: { currentStock: 1000 } });
  await prisma.inventoryItem.update({ where: { id: cartonItem.id }, data: { currentStock: 100 } });

  console.log("Posting Run 1 with 188 good packets, 9 cartons (triggering packaging mismatch warning)...");
  const postRes = await productionService.postProductionRun(undefined, {
    organizationId: org.id,
    warehouseId: wh.id,
    recipeId: recipeV1.id,
    actualGoodQty: 188,
    actualRejectedQty: 0,
    directLaborCost: 1200,
    utilityCost: 600,
    consumedMaterials: [
      { inventoryItemId: flourItem.id, actualQty: 40 },
      { inventoryItemId: oilItem.id, actualQty: 10.5 }, // +5% variance
      { inventoryItemId: spiceItem.id, actualQty: 1.2 },
      { inventoryItemId: pouchItem.id, actualQty: 194, damagedQty: 6 },
      { inventoryItemId: cartonItem.id, actualQty: 9 }, // 9 cartons * 20 = 180 < 188
    ]
  });

  console.log("Run 1 ID:", postRes.run.id);
  console.log("Run 1 recipeVersion:", postRes.run.recipeVersion);
  console.log("Run 1 totalRunCost:", postRes.run.totalRunCost);
  console.log("Run 1 costPerGoodUnit:", postRes.run.costPerGoodUnit);
  console.log("Run 1 yieldVariancePct:", postRes.run.yieldVariancePct);
  console.log("Run 1 isYieldFlagged:", postRes.run.isYieldFlagged);
  console.log("Run 1 Warnings:", JSON.stringify(postRes.warnings));

  // Verify warning triggered
  const hasMismatchWarning = postRes.warnings.some(w => w.includes("9 cartons represent 180 of 188 packets"));
  console.log("Packaging mismatch warning triggered:", hasMismatchWarning);

  // 2. Test BOM Versioning: Create next Recipe Version with standardBatchSize = 400
  const maxV = await prisma.recipe.aggregate({
    where: { productVariantId: variant.id },
    _max: { version: true }
  });
  const nextVersion = (maxV._max.version ?? 1) + 1;
  console.log(`\nCreating Recipe Version ${nextVersion} with new BOM quantities...`);
  const recipeVNext = await prisma.recipe.create({
    data: {
      organizationId: org.id,
      productVariantId: variant.id,
      version: nextVersion,
      name: `Standard Murukku Recipe V${nextVersion} (Batch: 400)`,
      standardBatchSize: 400,
      expectedOutputQty: 400,
      outputUomId: recipeV1.outputUomId,
    }
  });

  // Verify historical Run 1 is completely unchanged
  const run1After = await prisma.productionRun.findUniqueOrThrow({
    where: { id: postRes.run.id },
    include: { materials: true }
  });

  console.log("Run 1 recipeVersion after new Recipe created:", run1After.recipeVersion);
  console.log("Run 1 costPerGoodUnit after new Recipe created:", run1After.costPerGoodUnit);
  const run1Unchanged = run1After.recipeVersion === 1 && Number(run1After.actualGoodQty) === 188;
  console.log("Historical run 1 is unchanged:", run1Unchanged);
}

main().catch(console.error).finally(() => prisma.$disconnect());
