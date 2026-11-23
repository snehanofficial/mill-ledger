import { auth } from "../src/lib/auth.js";
import { prisma } from "../src/db/client.js";
import {
  ItemCategory,
  MovementType,
  RecipeItemType,
  type Prisma,
} from "@prisma/client";
import type { Role } from "@mill-ledger/shared";

interface SeedUser {
  name: string;
  email: string;
  password: string;
  role: Role;
}

const SEED_USERS: SeedUser[] = [
  {
    name: "Factory Admin",
    email: "admin@millledger.local",
    password: "AdminPassword123!",
    role: "ADMIN",
  },
  {
    name: "Salesman One",
    email: "salesman1@millledger.local",
    password: "SalesmanPassword123!",
    role: "SALESMAN",
  },
  {
    name: "Salesman Demo",
    email: "salesman@millledger.local",
    password: "SalesmanPassword123!",
    role: "SALESMAN",
  },
  {
    name: "Salesman Two",
    email: "salesman2@millledger.local",
    password: "SalesmanPassword123!",
    role: "SALESMAN",
  },
  {
    name: "Production Manager",
    email: "production@millledger.local",
    password: "ProductionPassword123!",
    role: "PRODUCTION",
  },
  {
    name: "Floor Operator",
    email: "operator@millledger.local",
    password: "OperatorPassword123!",
    role: "PRODUCTION",
  },
  {
    name: "Auditor Accountant",
    email: "accountant@millledger.local",
    password: "AccountantPassword123!",
    role: "ACCOUNTANT",
  },
  {
    name: "Mill Owner",
    email: "owner@millledger.local",
    password: "OwnerPassword123!",
    role: "OWNER",
  },
];

export async function seedUsers() {
  console.log("Seeding test users for M1...");

  const org = await prisma.organization.upsert({
    where: { code: "MILL" },
    update: {},
    create: {
      code: "MILL",
      name: "MillLedger Foods Pvt Ltd",
      state: "Tamil Nadu",
      gstin: "33AABCM1234F1Z1",
    },
  });

  for (const user of SEED_USERS) {
    if (process.env.NODE_ENV === "production" && user.role === "ADMIN") {
      console.warn("Skipping default admin user creation in production environment per OD-02. Use pnpm admin:bootstrap.");
      continue;
    }
    const existing = await prisma.user.findUnique({
      where: { email: user.email },
    });

    if (existing) {
      await prisma.user.update({
        where: { email: user.email },
        data: {
          role: user.role,
          name: user.name,
          isActive: true,
          organizationId: org.id,
        },
      });
      continue;
    }

    await auth.api.signUpEmail({
      body: {
        email: user.email,
        password: user.password,
        name: user.name,
      },
    });

    await prisma.user.update({
      where: { email: user.email },
      data: {
        role: user.role,
        isActive: true,
        organizationId: org.id,
      },
    });

    console.log(`Created user ${user.email} with role ${user.role}`);
  }
}

export async function seedBenchmarkMasters() {
  console.log("Seeding benchmark master data and opening stock (M2)...");

  // 1. Organization
  const org = await prisma.organization.upsert({
    where: { code: "MILL" },
    update: {},
    create: {
      code: "MILL",
      name: "MillLedger Foods Pvt Ltd",
      state: "Tamil Nadu",
      gstin: "33AABCM1234F1Z1",
    },
  });

  // 2. Facility & Warehouse
  const facility = await prisma.facility.upsert({
    where: {
      organizationId_code: {
        organizationId: org.id,
        code: "FAC-1",
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      code: "FAC-1",
      name: "Madurai Production Facility",
      state: "Tamil Nadu",
    },
  });

  const warehouse = await prisma.warehouse.upsert({
    where: {
      facilityId_code: {
        facilityId: facility.id,
        code: "WH-1",
      },
    },
    update: {},
    create: {
      facilityId: facility.id,
      code: "WH-1",
      name: "Central Factory Warehouse",
    },
  });

  // 3. Units of Measure
  const uomConfigs = [
    { code: "KG", name: "Kilogram", symbol: "kg" },
    { code: "L", name: "Litre", symbol: "L" },
    { code: "PIECE", name: "Piece", symbol: "pcs" },
    { code: "PACKET", name: "Packet", symbol: "pkt" },
    { code: "CARTON", name: "Carton", symbol: "ctn" },
  ];

  const uoms: Record<string, string> = {};
  for (const cfg of uomConfigs) {
    const uom = await prisma.unitOfMeasure.upsert({
      where: {
        organizationId_code: {
          organizationId: org.id,
          code: cfg.code,
        },
      },
      update: { name: cfg.name, symbol: cfg.symbol },
      create: {
        organizationId: org.id,
        code: cfg.code,
        name: cfg.name,
        symbol: cfg.symbol,
      },
    });
    uoms[cfg.code] = uom.id;
  }

  // Unit conversion: 1 Carton = 20 Packets
  await prisma.unitConversion.upsert({
    where: {
      fromUomId_toUomId: {
        fromUomId: uoms["CARTON"],
        toUomId: uoms["PACKET"],
      },
    },
    update: { factor: 20 },
    create: {
      fromUomId: uoms["CARTON"],
      toUomId: uoms["PACKET"],
      factor: 20,
    },
  });

  // 4. Customers
  const retailerA = await prisma.customer.upsert({
    where: {
      organizationId_code: {
        organizationId: org.id,
        code: "CUST-RET-A",
      },
    },
    update: { state: "Tamil Nadu", gstin: "33AABCR5678G1Z2" },
    create: {
      organizationId: org.id,
      code: "CUST-RET-A",
      name: "Retailer A",
      state: "Tamil Nadu",
      gstin: "33AABCR5678G1Z2",
      phone: "+91 98400 12345",
      email: "retailer.a@example.com",
    },
  });

  const distributorB = await prisma.customer.upsert({
    where: {
      organizationId_code: {
        organizationId: org.id,
        code: "CUST-DIST-B",
      },
    },
    update: { state: "Karnataka", gstin: "29AABCD9012H1Z3" },
    create: {
      organizationId: org.id,
      code: "CUST-DIST-B",
      name: "Distributor B",
      state: "Karnataka",
      gstin: "29AABCD9012H1Z3",
      phone: "+91 98800 67890",
      email: "distributor.b@example.com",
    },
  });

  // 5. Customer Assignments (Salesman 1 -> Retailer A, Salesman 2 -> Distributor B)
  const salesmanOne = await prisma.user.findUnique({
    where: { email: "salesman1@millledger.local" },
  });
  const salesmanTwo = await prisma.user.findUnique({
    where: { email: "salesman2@millledger.local" },
  });

  if (salesmanOne) {
    await prisma.salesmanCustomerAssignment.upsert({
      where: {
        salesmanId_customerId: {
          salesmanId: salesmanOne.id,
          customerId: retailerA.id,
        },
      },
      update: {},
      create: {
        salesmanId: salesmanOne.id,
        customerId: retailerA.id,
      },
    });
  }

  if (salesmanTwo) {
    await prisma.salesmanCustomerAssignment.upsert({
      where: {
        salesmanId_customerId: {
          salesmanId: salesmanTwo.id,
          customerId: distributorB.id,
        },
      },
      update: {},
      create: {
        salesmanId: salesmanTwo.id,
        customerId: distributorB.id,
      },
    });
  }

  // 6. Supplier
  await prisma.supplier.upsert({
    where: {
      organizationId_code: {
        organizationId: org.id,
        code: "SUP-FLOUR-1",
      },
    },
    update: { state: "Tamil Nadu" },
    create: {
      organizationId: org.id,
      code: "SUP-FLOUR-1",
      name: "Murugan Agro Mills",
      state: "Tamil Nadu",
      gstin: "33AABCS3456J1Z4",
      phone: "+91 94433 22110",
      email: "orders@muruganagro.com",
    },
  });

  // 7. Inventory Items and Opening Stock
  const itemConfigs = [
    {
      sku: "RM-FLOUR",
      name: "Flour",
      category: ItemCategory.RAW_MATERIAL,
      uomCode: "KG",
      openingQty: 100,
      unitCost: 42,
    },
    {
      sku: "RM-OIL",
      name: "Cooking oil",
      category: ItemCategory.RAW_MATERIAL,
      uomCode: "L",
      openingQty: 30,
      unitCost: 140,
    },
    {
      sku: "RM-SPICE",
      name: "Spice mix",
      category: ItemCategory.RAW_MATERIAL,
      uomCode: "KG",
      openingQty: 5,
      unitCost: 200,
    },
    {
      sku: "PKG-POUCH-200G",
      name: "200 g pouch",
      category: ItemCategory.PACKAGING,
      uomCode: "PIECE",
      openingQty: 500,
      unitCost: 2.5,
    },
    {
      sku: "PKG-CARTON",
      name: "Carton",
      category: ItemCategory.PACKAGING,
      uomCode: "PIECE",
      openingQty: 30,
      unitCost: 15,
    },
    {
      sku: "FG-MURUKKU-200G",
      name: "Murukku 200 g finished goods",
      category: ItemCategory.FINISHED_GOODS,
      uomCode: "PACKET",
      openingQty: 50,
      unitCost: 0,
    },
  ];

  const inventoryItems: Record<string, string> = {};

  for (const cfg of itemConfigs) {
    const totalCost = cfg.openingQty * cfg.unitCost;

    const item = await prisma.inventoryItem.upsert({
      where: {
        organizationId_sku: {
          organizationId: org.id,
          sku: cfg.sku,
        },
      },
      update: {
        name: cfg.name,
        category: cfg.category,
        baseUomId: uoms[cfg.uomCode],
        currentStock: cfg.openingQty,
        weightedAverageCost: cfg.unitCost,
      },
      create: {
        organizationId: org.id,
        sku: cfg.sku,
        name: cfg.name,
        category: cfg.category,
        baseUomId: uoms[cfg.uomCode],
        currentStock: cfg.openingQty,
        weightedAverageCost: cfg.unitCost,
      },
    });

    inventoryItems[cfg.sku] = item.id;

    const existingMovement = await prisma.stockMovement.findFirst({
      where: {
        inventoryItemId: item.id,
        warehouseId: warehouse.id,
        movementType: MovementType.OPENING_BALANCE,
      },
    });

    if (!existingMovement && cfg.openingQty > 0) {
      await prisma.stockMovement.create({
        data: {
          inventoryItemId: item.id,
          warehouseId: warehouse.id,
          movementType: MovementType.OPENING_BALANCE,
          quantity: cfg.openingQty,
          unitCost: cfg.unitCost,
          totalCost: totalCost,
          referenceDocumentType: "OPENING",
          referenceDocumentId: "INIT-BENCHMARK",
          notes: `Opening stock initialized from benchmark for ${cfg.name}`,
        },
      });
    }
  }

  // 8. Product and Product Variant
  const product = await prisma.product.upsert({
    where: {
      organizationId_code: {
        organizationId: org.id,
        code: "PRD-MURUKKU",
      },
    },
    update: { taxRate: 5.0 },
    create: {
      organizationId: org.id,
      code: "PRD-MURUKKU",
      name: "Murukku Traditional Savoury",
      hsnCode: "21069099",
      taxRate: 5.0,
    },
  });

  const variant = await prisma.productVariant.upsert({
    where: {
      productId_sku: {
        productId: product.id,
        sku: "VAR-MURUKKU-200G",
      },
    },
    update: {
      name: "Murukku 200 g",
      packSize: 0.2,
      uomId: uoms["PACKET"],
      inventoryItemId: inventoryItems["FG-MURUKKU-200G"],
    },
    create: {
      productId: product.id,
      sku: "VAR-MURUKKU-200G",
      name: "Murukku 200 g",
      packSize: 0.2,
      uomId: uoms["PACKET"],
      inventoryItemId: inventoryItems["FG-MURUKKU-200G"],
    },
  });

  // 9. Recipe / BOM (Standard Batch: 200 Packets)
  const recipe = await prisma.recipe.upsert({
    where: {
      productVariantId_version: {
        productVariantId: variant.id,
        version: 1,
      },
    },
    update: {
      standardBatchSize: 200,
      expectedOutputQty: 200,
    },
    create: {
      organizationId: org.id,
      productVariantId: variant.id,
      version: 1,
      name: "Standard Murukku 200g Recipe (Batch: 200 packets)",
      standardBatchSize: 200,
      expectedOutputQty: 200,
      outputUomId: uoms["PACKET"],
    },
  });

  await prisma.recipeItem.deleteMany({
    where: { recipeId: recipe.id },
  });

  const recipeBOMItems: Prisma.RecipeItemCreateManyInput[] = [
    {
      recipeId: recipe.id,
      inventoryItemId: inventoryItems["RM-FLOUR"],
      itemType: RecipeItemType.INGREDIENT,
      plannedQty: 40,
      uomId: uoms["KG"],
    },
    {
      recipeId: recipe.id,
      inventoryItemId: inventoryItems["RM-OIL"],
      itemType: RecipeItemType.INGREDIENT,
      plannedQty: 10,
      uomId: uoms["L"],
      tolerancePct: 5,
    },
    {
      recipeId: recipe.id,
      inventoryItemId: inventoryItems["RM-SPICE"],
      itemType: RecipeItemType.INGREDIENT,
      plannedQty: 1.2,
      uomId: uoms["KG"],
    },
    {
      recipeId: recipe.id,
      inventoryItemId: inventoryItems["PKG-POUCH-200G"],
      itemType: RecipeItemType.PACKAGING,
      plannedQty: 200,
      uomId: uoms["PIECE"],
    },
    {
      recipeId: recipe.id,
      inventoryItemId: inventoryItems["PKG-CARTON"],
      itemType: RecipeItemType.PACKAGING,
      plannedQty: 10,
      uomId: uoms["PIECE"],
    },
  ];

  await prisma.recipeItem.createMany({
    data: recipeBOMItems,
  });

  // 10. Default Price List (Selling price ₹50/packet)
  const priceList = await prisma.priceList.upsert({
    where: {
      organizationId_code: {
        organizationId: org.id,
        code: "PL-DEFAULT",
      },
    },
    update: { isDefault: true },
    create: {
      organizationId: org.id,
      code: "PL-DEFAULT",
      name: "Wholesale Standard Price List",
      isDefault: true,
    },
  });

  await prisma.priceListLine.upsert({
    where: {
      priceListId_productVariantId: {
        priceListId: priceList.id,
        productVariantId: variant.id,
      },
    },
    update: { price: 50.0 },
    create: {
      priceListId: priceList.id,
      productVariantId: variant.id,
      price: 50.0,
    },
  });

  // 11. Statutory Tax Rates (5%, 12%, 18%, 0% GST Slabs)
  const taxDate = new Date("2026-01-01T00:00:00Z");
  const statutorySlabs = [
    { hsnCode: "21069099", rate: 5.0, cgstRate: 2.5, sgstRate: 2.5, igstRate: 5.0 },
    { hsnCode: "21069098", rate: 18.0, cgstRate: 9.0, sgstRate: 9.0, igstRate: 18.0 },
    { hsnCode: "21069097", rate: 12.0, cgstRate: 6.0, sgstRate: 6.0, igstRate: 12.0 },
    { hsnCode: "21069090", rate: 0.0, cgstRate: 0.0, sgstRate: 0.0, igstRate: 0.0 },
  ];

  for (const slab of statutorySlabs) {
    await prisma.taxRate.upsert({
      where: {
        organizationId_hsnCode_effectiveFrom: {
          organizationId: org.id,
          hsnCode: slab.hsnCode,
          effectiveFrom: taxDate,
        },
      },
      update: {
        rate: slab.rate,
        cgstRate: slab.cgstRate,
        sgstRate: slab.sgstRate,
        igstRate: slab.igstRate,
      },
      create: {
        organizationId: org.id,
        hsnCode: slab.hsnCode,
        rate: slab.rate,
        cgstRate: slab.cgstRate,
        sgstRate: slab.sgstRate,
        igstRate: slab.igstRate,
        effectiveFrom: taxDate,
      },
    });
  }

  console.log("M2 benchmark master data seed successfully completed.");
}

export async function runFullSeed() {
  await seedUsers();
  await seedBenchmarkMasters();
}

// Execute when invoked directly
if (
  process.argv[1]?.endsWith("seed.ts") ||
  process.argv[1]?.endsWith("seed.js")
) {
  runFullSeed()
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error("Failed to seed database:", error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
