import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./db/client.js";
import { ItemCategory, MovementType, RecipeItemType } from "@prisma/client";
import { seedBenchmarkMasters } from "./db/seed.js";

describe("M2: Masters, BOM, and opening stock verification", () => {
  beforeAll(async () => {
    await seedBenchmarkMasters();
  });
  it("verifies organization, facility, and warehouse setup", async () => {
    const org = await prisma.organization.findUnique({
      where: { code: "MILL" },
      include: {
        facilities: {
          include: { warehouses: true },
        },
      },
    });

    expect(org).toBeDefined();
    expect(org?.state).toBe("Tamil Nadu");
    expect(org?.facilities.length).toBeGreaterThan(0);

    const warehouse = org?.facilities[0].warehouses.find(
      (w) => w.code === "WH-1",
    );
    expect(warehouse).toBeDefined();
  });

  it("verifies customer and salesman assignments for Retailer A and Distributor B", async () => {
    const retailerA = await prisma.customer.findFirst({
      where: { code: "CUST-RET-A" },
      include: {
        assignments: {
          include: { salesman: true },
        },
      },
    });

    expect(retailerA).toBeDefined();
    expect(retailerA?.state).toBe("Tamil Nadu");
    expect(retailerA?.assignments[0]?.salesman?.email).toBe(
      "salesman1@millledger.local",
    );

    const distributorB = await prisma.customer.findFirst({
      where: { code: "CUST-DIST-B" },
      include: {
        assignments: {
          include: { salesman: true },
        },
      },
    });

    expect(distributorB).toBeDefined();
    expect(distributorB?.state).toBe("Karnataka");
    expect(distributorB?.assignments[0]?.salesman?.email).toBe(
      "salesman2@millledger.local",
    );
  });

  it("verifies units of measure and carton to packet conversion", async () => {
    const carton = await prisma.unitOfMeasure.findFirst({
      where: { code: "CARTON" },
    });
    const packet = await prisma.unitOfMeasure.findFirst({
      where: { code: "PACKET" },
    });

    expect(carton).toBeDefined();
    expect(packet).toBeDefined();

    const conversion = await prisma.unitConversion.findUnique({
      where: {
        fromUomId_toUomId: {
          fromUomId: carton!.id,
          toUomId: packet!.id,
        },
      },
    });

    expect(conversion).toBeDefined();
    expect(Number(conversion?.factor)).toBe(20);
  });

  it("verifies benchmark opening stocks and append-only stock movements", async () => {
    const flour = await prisma.inventoryItem.findFirst({
      where: { sku: "RM-FLOUR" },
    });
    const oil = await prisma.inventoryItem.findFirst({
      where: { sku: "RM-OIL" },
    });
    const spice = await prisma.inventoryItem.findFirst({
      where: { sku: "RM-SPICE" },
    });
    const pouch = await prisma.inventoryItem.findFirst({
      where: { sku: "PKG-POUCH-200G" },
    });
    const carton = await prisma.inventoryItem.findFirst({
      where: { sku: "PKG-CARTON" },
    });
    const finished = await prisma.inventoryItem.findFirst({
      where: { sku: "FG-MURUKKU-200G" },
    });

    expect(flour).toBeDefined();
    expect(Number(flour?.currentStock)).toBe(100);
    expect(Number(flour?.weightedAverageCost)).toBe(42);
    expect(flour?.category).toBe(ItemCategory.RAW_MATERIAL);

    expect(oil).toBeDefined();
    expect(Number(oil?.currentStock)).toBe(30);
    expect(Number(oil?.weightedAverageCost)).toBe(140);

    expect(spice).toBeDefined();
    expect(Number(spice?.currentStock)).toBe(5);
    expect(Number(spice?.weightedAverageCost)).toBe(200);

    expect(pouch).toBeDefined();
    expect(Number(pouch?.currentStock)).toBe(500);
    expect(Number(pouch?.weightedAverageCost)).toBe(2.5);
    expect(pouch?.category).toBe(ItemCategory.PACKAGING);

    expect(carton).toBeDefined();
    expect(Number(carton?.currentStock)).toBe(30);
    expect(Number(carton?.weightedAverageCost)).toBe(15);

    expect(finished).toBeDefined();
    expect(Number(finished?.currentStock)).toBe(50);
    expect(finished?.category).toBe(ItemCategory.FINISHED_GOODS);

    // Verify stock movement ledger records exist for each opening item
    const openingMovements = await prisma.stockMovement.findMany({
      where: { movementType: MovementType.OPENING_BALANCE },
    });

    expect(openingMovements.length).toBeGreaterThanOrEqual(6);
  });

  it("verifies Murukku 200g recipe BOM version 1", async () => {
    const variant = await prisma.productVariant.findFirst({
      where: { sku: "VAR-MURUKKU-200G" },
      include: {
        recipes: {
          where: { version: 1 },
          include: {
            items: {
              include: { inventoryItem: true },
            },
          },
        },
      },
    });

    expect(variant).toBeDefined();
    const recipe = variant?.recipes[0];
    expect(recipe).toBeDefined();
    expect(Number(recipe?.standardBatchSize)).toBe(200);
    expect(Number(recipe?.expectedOutputQty)).toBe(200);

    const flourItem = recipe?.items.find(
      (i) => i.inventoryItem.sku === "RM-FLOUR",
    );
    expect(flourItem).toBeDefined();
    expect(Number(flourItem?.plannedQty)).toBe(40);
    expect(flourItem?.itemType).toBe(RecipeItemType.INGREDIENT);

    const oilItem = recipe?.items.find((i) => i.inventoryItem.sku === "RM-OIL");
    expect(oilItem).toBeDefined();
    expect(Number(oilItem?.plannedQty)).toBe(10);
    expect(Number(oilItem?.tolerancePct)).toBe(5);

    const spiceItem = recipe?.items.find(
      (i) => i.inventoryItem.sku === "RM-SPICE",
    );
    expect(spiceItem).toBeDefined();
    expect(Number(spiceItem?.plannedQty)).toBe(1.2);

    const pouchItem = recipe?.items.find(
      (i) => i.inventoryItem.sku === "PKG-POUCH-200G",
    );
    expect(pouchItem).toBeDefined();
    expect(Number(pouchItem?.plannedQty)).toBe(200);
    expect(pouchItem?.itemType).toBe(RecipeItemType.PACKAGING);

    const cartonItem = recipe?.items.find(
      (i) => i.inventoryItem.sku === "PKG-CARTON",
    );
    expect(cartonItem).toBeDefined();
    expect(Number(cartonItem?.plannedQty)).toBe(10);
  });

  it("verifies wholesale selling price and GST tax rates", async () => {
    const variant = await prisma.productVariant.findFirst({
      where: { sku: "VAR-MURUKKU-200G" },
      include: {
        priceLines: {
          include: { priceList: true },
        },
      },
    });

    const defaultPriceLine = variant?.priceLines.find(
      (pl) => pl.priceList.isDefault,
    );
    expect(defaultPriceLine).toBeDefined();
    expect(Number(defaultPriceLine?.price)).toBe(50.0);

    const taxRate = await prisma.taxRate.findFirst({
      where: { hsnCode: "21069099" },
    });
    expect(taxRate).toBeDefined();
    expect(Number(taxRate?.rate)).toBe(5.0);
    expect(Number(taxRate?.cgstRate)).toBe(2.5);
    expect(Number(taxRate?.sgstRate)).toBe(2.5);
    expect(Number(taxRate?.igstRate)).toBe(5.0);
  });

  it("proves recipe versioning preserves historical version 1 when creating version 2", async () => {
    const variant = await prisma.productVariant.findFirst({
      where: { sku: "VAR-MURUKKU-200G" },
      include: { product: true },
    });
    expect(variant).toBeDefined();

    const org = await prisma.organization.findUnique({
      where: { code: "MILL" },
    });

    const packet = await prisma.unitOfMeasure.findFirst({
      where: { code: "PACKET" },
    });

    // Create a new version 2 of the recipe with modified batch size
    const recipeV2 = await prisma.recipe.upsert({
      where: {
        productVariantId_version: {
          productVariantId: variant!.id,
          version: 2,
        },
      },
      update: {},
      create: {
        organizationId: org!.id,
        productVariantId: variant!.id,
        version: 2,
        name: "Standard Murukku 200g Recipe Version 2",
        standardBatchSize: 400,
        expectedOutputQty: 400,
        outputUomId: packet!.id,
      },
    });

    expect(recipeV2).toBeDefined();
    expect(recipeV2.version).toBe(2);

    // Verify version 1 remains unaltered
    const recipeV1 = await prisma.recipe.findUnique({
      where: {
        productVariantId_version: {
          productVariantId: variant!.id,
          version: 1,
        },
      },
    });

    expect(recipeV1).toBeDefined();
    expect(Number(recipeV1?.standardBatchSize)).toBe(200);
    expect(Number(recipeV1?.expectedOutputQty)).toBe(200);
  });
});
