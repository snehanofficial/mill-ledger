import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../db/client.js";
import { productionService } from "../modules/production/production.service.js";
import { ItemCategory, RecipeItemType } from "@prisma/client";

describe("F-016: Dynamic Packaging Capacity Mismatch Warning and Database Persistence", () => {
  const runId = Date.now().toString().slice(-6);
  let testOrgId: string;
  let testFacilityId: string;
  let testWarehouseId: string;
  let testRecipeId: string;
  let flourItemId: string;
  let oilItemId: string;
  let spiceItemId: string;
  let pouchItemId: string;
  let cartonItemId: string;
  let customTinItemId: string;

  beforeAll(async () => {
    // 1. Create dedicated isolated organization for F-016 testing
    const testOrg = await prisma.organization.create({
      data: {
        code: `ORG-PKG-${runId}`,
        name: `Packaging Test Org ${runId}`,
        state: "Tamil Nadu",
        gstin: `33TEST${runId}F1Z1`,
      },
    });
    testOrgId = testOrg.id;

    const testFacility = await prisma.facility.create({
      data: {
        organizationId: testOrgId,
        code: `FAC-PKG-${runId}`,
        name: `Facility PKG ${runId}`,
        state: "Tamil Nadu",
      },
    });
    testFacilityId = testFacility.id;

    const testWarehouse = await prisma.warehouse.create({
      data: {
        facilityId: testFacilityId,
        code: `WH-PKG-${runId}`,
        name: `Warehouse PKG ${runId}`,
      },
    });
    testWarehouseId = testWarehouse.id;

    // 2. Create UOMs
    const kgUom = await prisma.unitOfMeasure.create({
      data: { organizationId: testOrgId, code: `KG-${runId}`, name: "Kilogram", symbol: "kg" },
    });
    const lUom = await prisma.unitOfMeasure.create({
      data: { organizationId: testOrgId, code: `L-${runId}`, name: "Liter", symbol: "L" },
    });
    const pktUom = await prisma.unitOfMeasure.create({
      data: { organizationId: testOrgId, code: `PKT-${runId}`, name: "Packet", symbol: "pkt" },
    });
    const cartonUom = await prisma.unitOfMeasure.create({
      data: { organizationId: testOrgId, code: `CARTON-${runId}`, name: "Carton", symbol: "ctn" },
    });
    const tinUom = await prisma.unitOfMeasure.create({
      data: { organizationId: testOrgId, code: `TIN-${runId}`, name: "Tin", symbol: "tin" },
    });

    // 3. Unit conversions: 1 Carton = 20 Packets, 1 Tin = 15 Packets
    await prisma.unitConversion.create({
      data: {
        fromUomId: cartonUom.id,
        toUomId: pktUom.id,
        factor: 20,
      },
    });
    await prisma.unitConversion.create({
      data: {
        fromUomId: tinUom.id,
        toUomId: pktUom.id,
        factor: 15,
      },
    });

    // 4. Products
    const product = await prisma.product.create({
      data: {
        organizationId: testOrgId,
        code: `PRD-MURUKKU-${runId}`,
        name: "Murukku Test",
        hsnCode: "21069099",
        taxRate: 5.0,
      },
    });

    // 5. Inventory items
    const fgItem = await prisma.inventoryItem.create({
      data: {
        organizationId: testOrgId,
        sku: `FG-MURUKKU-${runId}`,
        name: "Murukku 200g FG",
        category: ItemCategory.FINISHED_GOODS,
        baseUomId: pktUom.id,
        currentStock: 0,
        weightedAverageCost: 0,
      },
    });

    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: `VAR-MURUKKU-${runId}`,
        name: "Murukku 200g Test",
        packSize: 0.2,
        uomId: pktUom.id,
        inventoryItemId: fgItem.id,
      },
    });

    const flourItem = await prisma.inventoryItem.create({
      data: {
        organizationId: testOrgId,
        sku: `RM-FLOUR-${runId}`,
        name: "Flour",
        category: ItemCategory.RAW_MATERIAL,
        baseUomId: kgUom.id,
        currentStock: 500,
        weightedAverageCost: 42,
      },
    });
    flourItemId = flourItem.id;

    const oilItem = await prisma.inventoryItem.create({
      data: {
        organizationId: testOrgId,
        sku: `RM-OIL-${runId}`,
        name: "Cooking Oil",
        category: ItemCategory.RAW_MATERIAL,
        baseUomId: lUom.id,
        currentStock: 500,
        weightedAverageCost: 140,
      },
    });
    oilItemId = oilItem.id;

    const spiceItem = await prisma.inventoryItem.create({
      data: {
        organizationId: testOrgId,
        sku: `RM-SPICE-${runId}`,
        name: "Spice Mix",
        category: ItemCategory.RAW_MATERIAL,
        baseUomId: kgUom.id,
        currentStock: 500,
        weightedAverageCost: 200,
      },
    });
    spiceItemId = spiceItem.id;

    const pouchItem = await prisma.inventoryItem.create({
      data: {
        organizationId: testOrgId,
        sku: `PKG-POUCH-${runId}`,
        name: "Pouch 200g",
        category: ItemCategory.PACKAGING,
        baseUomId: pktUom.id,
        currentStock: 1000,
        weightedAverageCost: 1.8,
      },
    });
    pouchItemId = pouchItem.id;

    const cartonItem = await prisma.inventoryItem.create({
      data: {
        organizationId: testOrgId,
        sku: `PKG-CARTON-${runId}`,
        name: "Carton Box",
        category: ItemCategory.PACKAGING,
        baseUomId: cartonUom.id,
        currentStock: 500,
        weightedAverageCost: 25,
      },
    });
    cartonItemId = cartonItem.id;

    const tinItem = await prisma.inventoryItem.create({
      data: {
        organizationId: testOrgId,
        sku: `PKG-TIN-${runId}`,
        name: "Tin Container",
        category: ItemCategory.PACKAGING,
        baseUomId: tinUom.id,
        currentStock: 500,
        weightedAverageCost: 35,
      },
    });
    customTinItemId = tinItem.id;

    // Create opening stock movements for these items
    const rawItems = [
      { item: flourItem, qty: 500, cost: 42 },
      { item: oilItem, qty: 500, cost: 140 },
      { item: spiceItem, qty: 500, cost: 200 },
      { item: pouchItem, qty: 1000, cost: 1.8 },
      { item: cartonItem, qty: 500, cost: 25 },
      { item: tinItem, qty: 500, cost: 35 },
    ];

    for (const r of rawItems) {
      await prisma.stockMovement.create({
        data: {
          inventoryItemId: r.item.id,
          warehouseId: testWarehouseId,
          movementType: "OPENING_BALANCE",
          quantity: r.qty,
          unitCost: r.cost,
          totalCost: r.qty * r.cost,
          referenceDocumentType: "OPENING",
          referenceDocumentId: `INIT-${runId}`,
        },
      });
    }

    // 6. Create recipe
    const recipe = await prisma.recipe.create({
      data: {
        organizationId: testOrgId,
        productVariantId: variant.id,
        name: `Murukku Recipe ${runId}`,
        version: 1,
        standardBatchSize: 200,
        outputUomId: pktUom.id,
        expectedOutputQty: 200,
        items: {
          create: [
            { inventoryItemId: flourItemId, uomId: kgUom.id, plannedQty: 40, itemType: RecipeItemType.INGREDIENT },
            { inventoryItemId: oilItemId, uomId: lUom.id, plannedQty: 10, itemType: RecipeItemType.INGREDIENT },
            { inventoryItemId: spiceItemId, uomId: kgUom.id, plannedQty: 1.2, itemType: RecipeItemType.INGREDIENT },
            { inventoryItemId: pouchItemId, uomId: pktUom.id, plannedQty: 200, itemType: RecipeItemType.PACKAGING },
            { inventoryItemId: cartonItemId, uomId: cartonUom.id, plannedQty: 10, itemType: RecipeItemType.PACKAGING },
          ],
        },
      },
    });
    testRecipeId = recipe.id;
  });

  afterAll(async () => {
    // Clean up isolated test organization data within a transaction that bypasses immutability
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL mill_ledger.bypass_immutability = 'on'");
      await tx.productionRunMaterial.deleteMany({
        where: { productionRun: { organizationId: testOrgId } },
      });
      await tx.productionRun.deleteMany({
        where: { organizationId: testOrgId },
      });
      await tx.stockMovement.deleteMany({
        where: { inventoryItem: { organizationId: testOrgId } },
      });
      await tx.recipeItem.deleteMany({
        where: { recipe: { organizationId: testOrgId } },
      });
      await tx.recipe.deleteMany({
        where: { organizationId: testOrgId },
      });
      await tx.productVariant.deleteMany({
        where: { product: { organizationId: testOrgId } },
      });
      await tx.inventoryItem.deleteMany({
        where: { organizationId: testOrgId },
      });
      await tx.product.deleteMany({
        where: { organizationId: testOrgId },
      });
      await tx.unitConversion.deleteMany({
        where: { fromUom: { organizationId: testOrgId } },
      });
      await tx.unitOfMeasure.deleteMany({
        where: { organizationId: testOrgId },
      });
      await tx.warehouse.deleteMany({
        where: { facilityId: testFacilityId },
      });
      await tx.facility.deleteMany({
        where: { organizationId: testOrgId },
      });
      await tx.organization.delete({
        where: { id: testOrgId },
      });
    });
  });

  it("1. Dynamically detects packaging capacity shortfall using unit_conversion and persists warning to DB", async () => {
    // 9 cartons * 20 packets/carton = 180 capacity < 188 actual good packets
    const result = await productionService.postProductionRun(undefined, {
      organizationId: testOrgId,
      warehouseId: testWarehouseId,
      recipeId: testRecipeId,
      runNumber: `RUN-PKG-WARN-${runId}`,
      actualGoodQty: 188,
      actualRejectedQty: 0,
      directLaborCost: 1200,
      utilityCost: 600,
      consumedMaterials: [
        { inventoryItemId: flourItemId, actualQty: 40 },
        { inventoryItemId: oilItemId, actualQty: 10.5 },
        { inventoryItemId: spiceItemId, actualQty: 1.2 },
        { inventoryItemId: pouchItemId, actualQty: 194, damagedQty: 6 },
        { inventoryItemId: cartonItemId, actualQty: 9 }, // 9 * 20 = 180 < 188
      ],
    });

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("9 cartons represent 180 of 188 packets");

    // Assert warning flag and text are persisted on returned run
    expect(result.run.packagingMismatch).toBe(true);
    expect(result.run.packagingWarning).toContain("9 cartons represent 180 of 188 packets");

    // Fetch freshly from database via getProductionRunById to verify DB persistence
    const fetched = await productionService.getProductionRunById(result.run.id);
    expect(fetched.packagingMismatch).toBe(true);
    expect(fetched.packagingWarning).toContain("9 cartons represent 180 of 188 packets");
  });

  it("2. Does not flag packaging mismatch when carton capacity is sufficient", async () => {
    // 10 cartons * 20 packets/carton = 200 capacity >= 188 actual good packets
    const result = await productionService.postProductionRun(undefined, {
      organizationId: testOrgId,
      warehouseId: testWarehouseId,
      recipeId: testRecipeId,
      runNumber: `RUN-PKG-OK-${runId}`,
      actualGoodQty: 188,
      actualRejectedQty: 0,
      directLaborCost: 1200,
      utilityCost: 600,
      consumedMaterials: [
        { inventoryItemId: flourItemId, actualQty: 40 },
        { inventoryItemId: oilItemId, actualQty: 10.5 },
        { inventoryItemId: spiceItemId, actualQty: 1.2 },
        { inventoryItemId: pouchItemId, actualQty: 194, damagedQty: 6 },
        { inventoryItemId: cartonItemId, actualQty: 10 }, // 10 * 20 = 200 >= 188
      ],
    });

    expect(result.warnings).toHaveLength(0);
    expect(result.run.packagingMismatch).toBe(false);
    expect(result.run.packagingWarning).toBeNull();

    // Verify DB record
    const fetched = await productionService.getProductionRunById(result.run.id);
    expect(fetched.packagingMismatch).toBe(false);
    expect(fetched.packagingWarning).toBeNull();
  });

  it("3. Dynamically resolves custom packaging UOM conversions without hardcoded ratios", async () => {
    // 12 tins * 15 = 180 capacity < 188 good packets
    const result = await productionService.postProductionRun(undefined, {
      organizationId: testOrgId,
      warehouseId: testWarehouseId,
      recipeId: testRecipeId,
      runNumber: `RUN-PKG-TIN-${runId}`,
      actualGoodQty: 188,
      actualRejectedQty: 0,
      directLaborCost: 1200,
      utilityCost: 600,
      consumedMaterials: [
        { inventoryItemId: flourItemId, actualQty: 40 },
        { inventoryItemId: oilItemId, actualQty: 10.5 },
        { inventoryItemId: spiceItemId, actualQty: 1.2 },
        { inventoryItemId: pouchItemId, actualQty: 194, damagedQty: 6 },
        { inventoryItemId: customTinItemId, actualQty: 12 },
      ],
    });

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("12 tins represent 180 of 188 packets");
    expect(result.run.packagingMismatch).toBe(true);
    expect(result.run.packagingWarning).toContain("12 tins represent 180 of 188 packets");

    const fetched = await productionService.getProductionRunById(result.run.id);
    expect(fetched.packagingMismatch).toBe(true);
    expect(fetched.packagingWarning).toContain("12 tins represent 180 of 188 packets");
  });
});
