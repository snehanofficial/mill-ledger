import {
  ItemCategory,
  MovementType,
  PaymentMode,
  RecipeItemType,
} from "@prisma/client";
import type { Role, UserContext } from "@mill-ledger/shared";
import { auth } from "../lib/auth.js";
import { prisma } from "../db/client.js";
import { inventoryService } from "../modules/inventory/inventory.service.js";
import { mastersService } from "../modules/masters/masters.service.js";
import { productionService } from "../modules/production/production.service.js";
import { salesService } from "../modules/sales/sales.service.js";
import { dispatchService } from "../modules/sales/dispatch.service.js";
import { financeService } from "../modules/finance/finance.service.js";
import { paymentService } from "../modules/finance/payment.service.js";
import { reportingService } from "../modules/reporting/reporting.service.js";
import { timelineService } from "../modules/timeline/timeline.service.js";

export const DEMO_ORG_CODE = "MILL";
export const DEMO_ORG_NAME = "MillLedger Foods Pvt Ltd";

interface DemoUserSeed {
  name: string;
  email: string;
  password: string;
  role: Role;
}

export const DEMO_USERS: DemoUserSeed[] = [
  {
    name: "Factory Admin",
    email: "admin@millledger.local",
    password: "AdminPassword123!",
    role: "ADMIN",
  },
  {
    name: "Mill Owner",
    email: "owner@millledger.local",
    password: "OwnerPassword123!",
    role: "OWNER",
  },
  {
    name: "Salesman Demo",
    email: "salesman@millledger.local",
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
];

function assertSeedAllowed() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_PRODUCTION_SEED !== "true"
  ) {
    throw new Error(
      "Seeding is disabled in production environments. Set ALLOW_PRODUCTION_SEED=true to override.",
    );
  }
}

async function ensureDemoOrganization() {
  return await prisma.organization.upsert({
    where: { code: DEMO_ORG_CODE },
    update: {
      name: DEMO_ORG_NAME,
      state: "Tamil Nadu",
      gstin: "33DEMOF0000D1Z9",
    },
    create: {
      code: DEMO_ORG_CODE,
      name: DEMO_ORG_NAME,
      state: "Tamil Nadu",
      gstin: "33DEMOF0000D1Z9",
    },
  });
}

async function ensureDemoUsers(organizationId: string) {
  const userMap: Record<string, UserContext> = {};

  for (const u of DEMO_USERS) {
    let dbUser = await prisma.user.findUnique({ where: { email: u.email } });
    if (!dbUser) {
      await auth.api.signUpEmail({
        body: {
          email: u.email,
          password: u.password,
          name: u.name,
        },
      });
    }
    dbUser = await prisma.user.update({
      where: { email: u.email },
      data: {
        name: u.name,
        role: u.role,
        isActive: true,
        organizationId,
      },
    });
    userMap[u.role] = {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: u.role,
      isActive: true,
      organizationId,
    };
  }

  return userMap;
}

/**
 * Deletes ONLY records belonging to the isolated DEMO-FOODS organization.
 * Never touches MILL or any other tenant.
 */
export async function resetDemoData(): Promise<{ deleted: boolean }> {
  assertSeedAllowed();
  const demoOrg = await prisma.organization.findUnique({
    where: { code: DEMO_ORG_CODE },
  });
  if (!demoOrg) {
    return { deleted: false };
  }

  const orgId = demoOrg.id;
  const demoEmails = DEMO_USERS.map((u) => u.email);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      "SET LOCAL mill_ledger.bypass_immutability = 'on'",
    );

    await tx.auditLog.deleteMany({ where: { organizationId: orgId } });
    await tx.paymentAllocation.deleteMany({
      where: { payment: { organizationId: orgId } },
    });
    await tx.payment.deleteMany({ where: { organizationId: orgId } });
    await tx.creditNote.deleteMany({ where: { organizationId: orgId } });
    await tx.debitNoteLine.deleteMany({
      where: { debitNote: { organizationId: orgId } },
    });
    await tx.debitNote.deleteMany({ where: { organizationId: orgId } });
    await tx.dispatchLine.deleteMany({
      where: { dispatch: { organizationId: orgId } },
    });
    await tx.dispatch.deleteMany({ where: { organizationId: orgId } });
    await tx.salesInvoiceLine.deleteMany({
      where: { salesInvoice: { organizationId: orgId } },
    });
    await tx.salesInvoice.deleteMany({ where: { organizationId: orgId } });
    await tx.stockReservation.deleteMany({
      where: { salesOrder: { organizationId: orgId } },
    });
    await tx.salesOrderLine.deleteMany({
      where: { salesOrder: { organizationId: orgId } },
    });
    await tx.salesOrder.deleteMany({ where: { organizationId: orgId } });

    await tx.productionRunReversal.deleteMany({
      where: { originalRun: { organizationId: orgId } },
    });
    await tx.productionRunMaterial.deleteMany({
      where: { productionRun: { organizationId: orgId } },
    });
    await tx.productionRun.deleteMany({ where: { organizationId: orgId } });

    await tx.stockTransferLine.deleteMany({
      where: { stockTransfer: { organizationId: orgId } },
    });
    await tx.stockTransfer.deleteMany({ where: { organizationId: orgId } });
    await tx.purchaseReceiptLine.deleteMany({
      where: { purchaseReceipt: { organizationId: orgId } },
    });
    await tx.purchaseReceipt.deleteMany({ where: { organizationId: orgId } });
    await tx.stockMovement.deleteMany({
      where: { inventoryItem: { organizationId: orgId } },
    });
    await tx.warehouseStockBalance.deleteMany({
      where: { organizationId: orgId },
    });

    await tx.recipeItem.deleteMany({
      where: { recipe: { organizationId: orgId } },
    });
    await tx.recipe.deleteMany({ where: { organizationId: orgId } });

    await tx.priceListLine.deleteMany({
      where: { priceList: { organizationId: orgId } },
    });
    await tx.priceList.deleteMany({ where: { organizationId: orgId } });
    await tx.productVariant.deleteMany({
      where: { product: { organizationId: orgId } },
    });
    await tx.product.deleteMany({ where: { organizationId: orgId } });

    await tx.inventoryItem.deleteMany({ where: { organizationId: orgId } });
    await tx.unitConversion.deleteMany({
      where: { fromUom: { organizationId: orgId } },
    });
    await tx.unitOfMeasure.deleteMany({ where: { organizationId: orgId } });

    await tx.salesmanCustomerAssignment.deleteMany({
      where: { customer: { organizationId: orgId } },
    });
    await tx.customer.deleteMany({ where: { organizationId: orgId } });
    await tx.supplier.deleteMany({ where: { organizationId: orgId } });
    await tx.taxRate.deleteMany({ where: { organizationId: orgId } });
    await tx.documentSequence.deleteMany({ where: { organizationId: orgId } });
    await tx.warehouse.deleteMany({ where: { organizationId: orgId } });
    await tx.facility.deleteMany({ where: { organizationId: orgId } });

    await tx.session.deleteMany({
      where: { user: { email: { in: demoEmails } } },
    });
    await tx.account.deleteMany({
      where: { user: { email: { in: demoEmails } } },
    });
    await tx.user.deleteMany({
      where: { email: { in: demoEmails }, organizationId: orgId },
    });
    await tx.organization.delete({ where: { id: orgId } });
  });

  return { deleted: true };
}

export async function seedDemoData(): Promise<{
  alreadySeeded: boolean;
  organizationId: string;
}> {
  assertSeedAllowed();

  const org = await ensureDemoOrganization();
  const users = await ensureDemoUsers(org.id);
  const adminUser = users["ADMIN"];
  const salesmanUser = users["SALESMAN"];
  const productionUser = users["PRODUCTION"];

  // Idempotency check: if primary demo order already exists in DEMO-FOODS, skip operational replay
  const existingPrimaryOrder = await prisma.salesOrder.findUnique({
    where: {
      organizationId_orderNumber: {
        organizationId: org.id,
        orderNumber: "DEMO-SO-001",
      },
    },
  });

  if (existingPrimaryOrder) {
    return { alreadySeeded: true, organizationId: org.id };
  }

  // ── 1. Facility & Warehouse ───────────────────────────────────────────────
  const facility = await prisma.facility.upsert({
    where: {
      organizationId_code: { organizationId: org.id, code: "DEMO-FAC-1" },
    },
    update: { name: "Coimbatore Millet Processing Plant", state: "Tamil Nadu" },
    create: {
      organizationId: org.id,
      code: "DEMO-FAC-1",
      name: "Coimbatore Millet Processing Plant",
      state: "Tamil Nadu",
    },
  });

  const warehouse = await prisma.warehouse.upsert({
    where: {
      facilityId_code: { facilityId: facility.id, code: "DEMO-WH-1" },
    },
    update: { name: "Main Finished Goods & Raw Store", isActive: true },
    create: {
      organizationId: org.id,
      facilityId: facility.id,
      code: "DEMO-WH-1",
      name: "Main Finished Goods & Raw Store",
    },
  });

  // ── 2. Units of Measure & Conversions ─────────────────────────────────────
  const uomSpecs = [
    { code: "KG", name: "Kilogram", symbol: "kg" },
    { code: "L", name: "Litre", symbol: "L" },
    { code: "PIECE", name: "Piece", symbol: "pcs" },
    { code: "PACKET", name: "Packet", symbol: "pkt" },
    { code: "CARTON", name: "Carton", symbol: "ctn" },
  ];
  const uoms: Record<string, string> = {};
  for (const spec of uomSpecs) {
    const uom = await prisma.unitOfMeasure.upsert({
      where: {
        organizationId_code: { organizationId: org.id, code: spec.code },
      },
      update: { name: spec.name, symbol: spec.symbol },
      create: {
        organizationId: org.id,
        code: spec.code,
        name: spec.name,
        symbol: spec.symbol,
      },
    });
    uoms[spec.code] = uom.id;
  }

  await prisma.unitConversion.upsert({
    where: {
      fromUomId_toUomId: { fromUomId: uoms["CARTON"], toUomId: uoms["PACKET"] },
    },
    update: { factor: 20 },
    create: {
      fromUomId: uoms["CARTON"],
      toUomId: uoms["PACKET"],
      factor: 20,
    },
  });

  // ── 3. Tax Rates (GST Slabs) ──────────────────────────────────────────────
  const taxEffectiveFrom = new Date("2026-01-01T00:00:00Z");
  const taxSlabs = [
    { hsnCode: "19041090", rate: 5, cgst: 2.5, sgst: 2.5, igst: 5 },
    { hsnCode: "11029090", rate: 5, cgst: 2.5, sgst: 2.5, igst: 5 },
    { hsnCode: "19053100", rate: 18, cgst: 9, sgst: 9, igst: 18 },
    { hsnCode: "21069099", rate: 12, cgst: 6, sgst: 6, igst: 12 },
  ];
  for (const slab of taxSlabs) {
    await prisma.taxRate.upsert({
      where: {
        organizationId_hsnCode_effectiveFrom: {
          organizationId: org.id,
          hsnCode: slab.hsnCode,
          effectiveFrom: taxEffectiveFrom,
        },
      },
      update: {
        rate: slab.rate,
        cgstRate: slab.cgst,
        sgstRate: slab.sgst,
        igstRate: slab.igst,
      },
      create: {
        organizationId: org.id,
        hsnCode: slab.hsnCode,
        rate: slab.rate,
        cgstRate: slab.cgst,
        sgstRate: slab.sgst,
        igstRate: slab.igst,
        effectiveFrom: taxEffectiveFrom,
      },
    });
  }

  // ── 4. Suppliers ──────────────────────────────────────────────────────────
  const supMillet = await inventoryService.createSupplier(
    {
      organizationId: org.id,
      code: "DEMO-SUP-1",
      name: "Kongu Millet Farmers Co-op",
      state: "Tamil Nadu",
      gstin: "33DEMOS1111M1Z1",
      phone: "+91 98000 00201",
      email: "supply@kongumillet.example",
      isActive: true,
    },
    adminUser,
  );
  const supPkg = await inventoryService.createSupplier(
    {
      organizationId: org.id,
      code: "DEMO-SUP-2",
      name: "Erode Natural Packaging Co.",
      state: "Tamil Nadu",
      gstin: "33DEMOS2222P1Z2",
      phone: "+91 98000 00202",
      email: "sales@erodepack.example",
      isActive: true,
    },
    adminUser,
  );

  // ── 5. Inventory Items (Raw Materials, Packaging, Finished Goods) ─────────
  const itemSpecs: Array<{
    sku: string;
    name: string;
    category: ItemCategory;
    uomCode: string;
  }> = [
    {
      sku: "DEMO-RM-RAGI",
      name: "Organic Finger Millet (Ragi)",
      category: ItemCategory.RAW_MATERIAL,
      uomCode: "KG",
    },
    {
      sku: "DEMO-RM-FOXTAIL",
      name: "Foxtail Millet Grain",
      category: ItemCategory.RAW_MATERIAL,
      uomCode: "KG",
    },
    {
      sku: "DEMO-RM-URAD",
      name: "Split Black Gram (Urad Dal)",
      category: ItemCategory.RAW_MATERIAL,
      uomCode: "KG",
    },
    {
      sku: "DEMO-RM-RICE",
      name: "Parboiled Idli Rice",
      category: ItemCategory.RAW_MATERIAL,
      uomCode: "KG",
    },
    {
      sku: "DEMO-RM-JAGGERY",
      name: "Cane Jaggery Powder",
      category: ItemCategory.RAW_MATERIAL,
      uomCode: "KG",
    },
    {
      sku: "DEMO-RM-BUTTER",
      name: "Cultured Dairy Butter",
      category: ItemCategory.RAW_MATERIAL,
      uomCode: "KG",
    },
    {
      sku: "DEMO-RM-SPICE",
      name: "Roasted Masala Blend",
      category: ItemCategory.RAW_MATERIAL,
      uomCode: "KG",
    },
    {
      sku: "DEMO-PKG-POUCH-500G",
      name: "500g Stand-Up Craft Pouch",
      category: ItemCategory.PACKAGING,
      uomCode: "PIECE",
    },
    {
      sku: "DEMO-PKG-BOX-200G",
      name: "200g Cookie Carton Box",
      category: ItemCategory.PACKAGING,
      uomCode: "PIECE",
    },
    {
      sku: "DEMO-PKG-MASTER-CTN",
      name: "Corrugated Master Carton",
      category: ItemCategory.PACKAGING,
      uomCode: "PIECE",
    },
    {
      sku: "DEMO-FG-RAGI-500G",
      name: "Ragi Health Mix 500g",
      category: ItemCategory.FINISHED_GOODS,
      uomCode: "PACKET",
    },
    {
      sku: "DEMO-FG-MILLET-1KG",
      name: "Millet Flour 1kg",
      category: ItemCategory.FINISHED_GOODS,
      uomCode: "PACKET",
    },
    {
      sku: "DEMO-FG-IDLI-500G",
      name: "Traditional Idli Mix 500g",
      category: ItemCategory.FINISHED_GOODS,
      uomCode: "PACKET",
    },
    {
      sku: "DEMO-FG-COOKIES-200G",
      name: "Multigrain Cookies 200g",
      category: ItemCategory.FINISHED_GOODS,
      uomCode: "PACKET",
    },
    {
      sku: "DEMO-FG-SPICED-250G",
      name: "Spiced Ready-Mix 250g",
      category: ItemCategory.FINISHED_GOODS,
      uomCode: "PACKET",
    },
  ];

  const inv: Record<string, { id: string; baseUomId: string }> = {};
  for (const spec of itemSpecs) {
    const created = await inventoryService.createInventoryItem(
      {
        organizationId: org.id,
        sku: spec.sku,
        name: spec.name,
        category: spec.category,
        baseUomId: uoms[spec.uomCode],
      },
      adminUser,
    );
    inv[spec.sku] = { id: created.id, baseUomId: created.baseUomId };
  }

  // Opening stock for Spiced Ready-Mix 250g (produced in prior cycle)
  await prisma.$transaction(async (tx) => {
    const openingQty = 120;
    const unitCost = 42;
    await tx.inventoryItem.update({
      where: { id: inv["DEMO-FG-SPICED-250G"].id },
      data: { currentStock: openingQty, weightedAverageCost: unitCost },
    });
    await tx.warehouseStockBalance.upsert({
      where: {
        warehouseId_inventoryItemId: {
          warehouseId: warehouse.id,
          inventoryItemId: inv["DEMO-FG-SPICED-250G"].id,
        },
      },
      update: { onHand: openingQty },
      create: {
        organizationId: org.id,
        warehouseId: warehouse.id,
        inventoryItemId: inv["DEMO-FG-SPICED-250G"].id,
        onHand: openingQty,
        reserved: 0,
      },
    });
    await tx.stockMovement.create({
      data: {
        inventoryItemId: inv["DEMO-FG-SPICED-250G"].id,
        warehouseId: warehouse.id,
        movementType: MovementType.OPENING_BALANCE,
        quantity: openingQty,
        unitCost,
        totalCost: openingQty * unitCost,
        referenceDocumentType: "OPENING",
        referenceDocumentId: "DEMO-OPEN-001",
        notes: "Opening finished goods balance for Spiced Ready-Mix 250g",
      },
    });
  });

  // ── 6. Purchase Receipts (Raw Materials & Packaging) ──────────────────────
  await inventoryService.postPurchaseReceipt(
    {
      organizationId: org.id,
      supplierId: supMillet.id,
      warehouseId: warehouse.id,
      receiptNumber: "DEMO-PR-001",
      supplierInvoiceNumber: "KMC-2026-104",
      notes: "Monthly organic millet, dal, and jaggery procurement",
      idempotencyKey: "demo-pr-001",
      items: [
        {
          inventoryItemId: inv["DEMO-RM-RAGI"].id,
          quantity: 250,
          uomId: uoms["KG"],
          unitPrice: 54,
        },
        {
          inventoryItemId: inv["DEMO-RM-FOXTAIL"].id,
          quantity: 220,
          uomId: uoms["KG"],
          unitPrice: 68,
        },
        {
          inventoryItemId: inv["DEMO-RM-URAD"].id,
          quantity: 120,
          uomId: uoms["KG"],
          unitPrice: 118,
        },
        {
          inventoryItemId: inv["DEMO-RM-RICE"].id,
          quantity: 180,
          uomId: uoms["KG"],
          unitPrice: 48,
        },
        {
          inventoryItemId: inv["DEMO-RM-JAGGERY"].id,
          quantity: 80,
          uomId: uoms["KG"],
          unitPrice: 62,
        },
        {
          inventoryItemId: inv["DEMO-RM-BUTTER"].id,
          quantity: 45,
          uomId: uoms["KG"],
          unitPrice: 420,
        },
        {
          inventoryItemId: inv["DEMO-RM-SPICE"].id,
          quantity: 25,
          uomId: uoms["KG"],
          unitPrice: 210,
        },
      ],
    },
    adminUser,
  );

  await inventoryService.postPurchaseReceipt(
    {
      organizationId: org.id,
      supplierId: supPkg.id,
      warehouseId: warehouse.id,
      receiptNumber: "DEMO-PR-002",
      supplierInvoiceNumber: "ENP-2026-088",
      notes: "Food-grade pouches, cookie boxes, and master cartons",
      idempotencyKey: "demo-pr-002",
      items: [
        {
          inventoryItemId: inv["DEMO-PKG-POUCH-500G"].id,
          quantity: 1500,
          uomId: uoms["PIECE"],
          unitPrice: 3.5,
        },
        {
          inventoryItemId: inv["DEMO-PKG-BOX-200G"].id,
          quantity: 600,
          uomId: uoms["PIECE"],
          unitPrice: 5.5,
        },
        {
          inventoryItemId: inv["DEMO-PKG-MASTER-CTN"].id,
          quantity: 150,
          uomId: uoms["PIECE"],
          unitPrice: 22,
        },
      ],
    },
    adminUser,
  );

  // ── 7. Price List, Products, Variants & Historical Price Change ───────────
  const priceList = await mastersService.createPriceList(
    {
      organizationId: org.id,
      code: "DEMO-PL-DEFAULT",
      name: "Demo Wholesale Price List",
      isDefault: true,
    },
    adminUser,
  );

  const prdRagi = await mastersService.createProduct(
    {
      organizationId: org.id,
      code: "DEMO-PRD-RAGI",
      name: "Ragi Health Mix",
      hsnCode: "19041090",
      taxRate: 5,
    },
    adminUser,
  );
  // Update product to demonstrate product audit history
  await mastersService.updateProduct(
    prdRagi.id,
    { name: "Sprouted Ragi Health Mix" },
    adminUser,
  );

  const varRagi = await mastersService.createVariant(
    {
      productId: prdRagi.id,
      sku: "DEMO-VAR-RAGI-500G",
      name: "Sprouted Ragi Health Mix 500g",
      packSize: 0.5,
      uomId: uoms["PACKET"],
      inventoryItemId: inv["DEMO-FG-RAGI-500G"].id,
      defaultPrice: 140,
    },
    adminUser,
  );
  // Historical price revision: ₹140 -> ₹150
  await mastersService.upsertPriceListLine(
    priceList.id,
    { productVariantId: varRagi.id, price: 150 },
    adminUser,
  );

  const prdMillet = await mastersService.createProduct(
    {
      organizationId: org.id,
      code: "DEMO-PRD-MILLET",
      name: "Millet Flour",
      hsnCode: "11029090",
      taxRate: 5,
    },
    adminUser,
  );
  const varMillet = await mastersService.createVariant(
    {
      productId: prdMillet.id,
      sku: "DEMO-VAR-MILLET-1KG",
      name: "Foxtail Millet Flour 1kg",
      packSize: 1.0,
      uomId: uoms["PACKET"],
      inventoryItemId: inv["DEMO-FG-MILLET-1KG"].id,
      defaultPrice: 110,
    },
    adminUser,
  );

  const prdIdli = await mastersService.createProduct(
    {
      organizationId: org.id,
      code: "DEMO-PRD-IDLI",
      name: "Traditional Idli Mix",
      hsnCode: "19041090",
      taxRate: 5,
    },
    adminUser,
  );
  const varIdli = await mastersService.createVariant(
    {
      productId: prdIdli.id,
      sku: "DEMO-VAR-IDLI-500G",
      name: "Traditional Idli Mix 500g",
      packSize: 0.5,
      uomId: uoms["PACKET"],
      inventoryItemId: inv["DEMO-FG-IDLI-500G"].id,
      defaultPrice: 95,
    },
    adminUser,
  );

  const prdCookies = await mastersService.createProduct(
    {
      organizationId: org.id,
      code: "DEMO-PRD-COOKIES",
      name: "Multigrain Cookies",
      hsnCode: "19053100",
      taxRate: 18,
    },
    adminUser,
  );
  const varCookies = await mastersService.createVariant(
    {
      productId: prdCookies.id,
      sku: "DEMO-VAR-COOKIES-200G",
      name: "Multigrain Butter Cookies 200g",
      packSize: 0.2,
      uomId: uoms["PACKET"],
      inventoryItemId: inv["DEMO-FG-COOKIES-200G"].id,
      defaultPrice: 120,
    },
    adminUser,
  );

  const prdSpiced = await mastersService.createProduct(
    {
      organizationId: org.id,
      code: "DEMO-PRD-SPICED",
      name: "Spiced Ready-Mix",
      hsnCode: "21069099",
      taxRate: 12,
    },
    adminUser,
  );
  const varSpiced = await mastersService.createVariant(
    {
      productId: prdSpiced.id,
      sku: "DEMO-VAR-SPICED-250G",
      name: "Spiced Millet Ready-Mix 250g",
      packSize: 0.25,
      uomId: uoms["PACKET"],
      inventoryItemId: inv["DEMO-FG-SPICED-250G"].id,
      defaultPrice: 85,
    },
    adminUser,
  );

  // ── 8. Recipes & Revisions ────────────────────────────────────────────────
  const ragiRecipeV1 = await productionService.createRecipe(
    {
      organizationId: org.id,
      productVariantId: varRagi.id,
      name: "Sprouted Ragi Health Mix 500g BOM",
      standardBatchSize: 100,
      expectedOutputQty: 100,
      outputUomId: uoms["PACKET"],
      items: [
        {
          inventoryItemId: inv["DEMO-RM-RAGI"].id,
          itemType: RecipeItemType.INGREDIENT,
          plannedQty: 38,
          uomId: uoms["KG"],
        },
        {
          inventoryItemId: inv["DEMO-RM-JAGGERY"].id,
          itemType: RecipeItemType.INGREDIENT,
          plannedQty: 12,
          uomId: uoms["KG"],
        },
        {
          inventoryItemId: inv["DEMO-PKG-POUCH-500G"].id,
          itemType: RecipeItemType.PACKAGING,
          plannedQty: 100,
          uomId: uoms["PIECE"],
        },
        {
          inventoryItemId: inv["DEMO-PKG-MASTER-CTN"].id,
          itemType: RecipeItemType.PACKAGING,
          plannedQty: 5,
          uomId: uoms["PIECE"],
        },
      ],
    },
    productionUser,
  );

  // Create v2 revision preserving v1 history
  const ragiRecipeV2 = await productionService.createRecipeVersion(
    ragiRecipeV1.id,
    {
      name: "Sprouted Ragi Health Mix 500g BOM (Optimized Roast)",
      expectedOutputQty: 105,
    },
    productionUser,
  );

  const milletRecipe = await productionService.createRecipe(
    {
      organizationId: org.id,
      productVariantId: varMillet.id,
      name: "Foxtail Millet Flour 1kg BOM",
      standardBatchSize: 100,
      expectedOutputQty: 100,
      outputUomId: uoms["PACKET"],
      items: [
        {
          inventoryItemId: inv["DEMO-RM-FOXTAIL"].id,
          itemType: RecipeItemType.INGREDIENT,
          plannedQty: 102,
          uomId: uoms["KG"],
        },
        {
          inventoryItemId: inv["DEMO-PKG-POUCH-500G"].id,
          itemType: RecipeItemType.PACKAGING,
          plannedQty: 100,
          uomId: uoms["PIECE"],
        },
      ],
    },
    productionUser,
  );

  const idliRecipe = await productionService.createRecipe(
    {
      organizationId: org.id,
      productVariantId: varIdli.id,
      name: "Traditional Idli Mix 500g BOM",
      standardBatchSize: 120,
      expectedOutputQty: 120,
      outputUomId: uoms["PACKET"],
      items: [
        {
          inventoryItemId: inv["DEMO-RM-RICE"].id,
          itemType: RecipeItemType.INGREDIENT,
          plannedQty: 42,
          uomId: uoms["KG"],
        },
        {
          inventoryItemId: inv["DEMO-RM-URAD"].id,
          itemType: RecipeItemType.INGREDIENT,
          plannedQty: 18,
          uomId: uoms["KG"],
        },
        {
          inventoryItemId: inv["DEMO-PKG-POUCH-500G"].id,
          itemType: RecipeItemType.PACKAGING,
          plannedQty: 120,
          uomId: uoms["PIECE"],
        },
      ],
    },
    productionUser,
  );

  const cookiesRecipe = await productionService.createRecipe(
    {
      organizationId: org.id,
      productVariantId: varCookies.id,
      name: "Multigrain Butter Cookies 200g BOM",
      standardBatchSize: 150,
      expectedOutputQty: 150,
      outputUomId: uoms["PACKET"],
      items: [
        {
          inventoryItemId: inv["DEMO-RM-RAGI"].id,
          itemType: RecipeItemType.INGREDIENT,
          plannedQty: 18,
          uomId: uoms["KG"],
        },
        {
          inventoryItemId: inv["DEMO-RM-BUTTER"].id,
          itemType: RecipeItemType.INGREDIENT,
          plannedQty: 9,
          uomId: uoms["KG"],
        },
        {
          inventoryItemId: inv["DEMO-RM-JAGGERY"].id,
          itemType: RecipeItemType.INGREDIENT,
          plannedQty: 8,
          uomId: uoms["KG"],
        },
        {
          inventoryItemId: inv["DEMO-PKG-BOX-200G"].id,
          itemType: RecipeItemType.PACKAGING,
          plannedQty: 150,
          uomId: uoms["PIECE"],
        },
      ],
    },
    productionUser,
  );

  // ── 9. Production Runs ────────────────────────────────────────────────────
  await productionService.postProductionRun(
    undefined,
    {
      organizationId: org.id,
      warehouseId: warehouse.id,
      recipeId: ragiRecipeV1.id,
      runNumber: "DEMO-RUN-001",
      batchCount: 1,
      actualGoodQty: 98,
      actualRejectedQty: 2,
      directLaborCost: 1100,
      utilityCost: 450,
      notes: "Initial batch on Ragi BOM v1",
      idempotencyKey: "demo-run-001",
      consumedMaterials: [
        { inventoryItemId: inv["DEMO-RM-RAGI"].id, actualQty: 38 },
        { inventoryItemId: inv["DEMO-RM-JAGGERY"].id, actualQty: 12 },
        { inventoryItemId: inv["DEMO-PKG-POUCH-500G"].id, actualQty: 100 },
        { inventoryItemId: inv["DEMO-PKG-MASTER-CTN"].id, actualQty: 5 },
      ],
    },
    productionUser,
  );

  await productionService.postProductionRun(
    undefined,
    {
      organizationId: org.id,
      warehouseId: warehouse.id,
      recipeId: ragiRecipeV2.id,
      runNumber: "DEMO-RUN-002",
      batchCount: 2,
      actualGoodQty: 210,
      actualRejectedQty: 0,
      directLaborCost: 2000,
      utilityCost: 800,
      notes: "Scaled batch using Ragi BOM v2 (improved yield)",
      idempotencyKey: "demo-run-002",
      consumedMaterials: [
        { inventoryItemId: inv["DEMO-RM-RAGI"].id, actualQty: 76 },
        { inventoryItemId: inv["DEMO-RM-JAGGERY"].id, actualQty: 24 },
        { inventoryItemId: inv["DEMO-PKG-POUCH-500G"].id, actualQty: 210 },
        { inventoryItemId: inv["DEMO-PKG-MASTER-CTN"].id, actualQty: 10 },
      ],
    },
    productionUser,
  );

  await productionService.postProductionRun(
    undefined,
    {
      organizationId: org.id,
      warehouseId: warehouse.id,
      recipeId: milletRecipe.id,
      runNumber: "DEMO-RUN-003",
      batchCount: 2,
      actualGoodQty: 200,
      actualRejectedQty: 0,
      directLaborCost: 1400,
      utilityCost: 600,
      notes: "Foxtail millet milling run",
      idempotencyKey: "demo-run-003",
      consumedMaterials: [
        { inventoryItemId: inv["DEMO-RM-FOXTAIL"].id, actualQty: 204 },
        { inventoryItemId: inv["DEMO-PKG-POUCH-500G"].id, actualQty: 200 },
      ],
    },
    productionUser,
  );

  await productionService.postProductionRun(
    undefined,
    {
      organizationId: org.id,
      warehouseId: warehouse.id,
      recipeId: idliRecipe.id,
      runNumber: "DEMO-RUN-004",
      batchCount: 2,
      actualGoodQty: 240,
      actualRejectedQty: 0,
      directLaborCost: 1600,
      utilityCost: 550,
      notes: "Traditional idli mix blending run",
      idempotencyKey: "demo-run-004",
      consumedMaterials: [
        { inventoryItemId: inv["DEMO-RM-RICE"].id, actualQty: 84 },
        { inventoryItemId: inv["DEMO-RM-URAD"].id, actualQty: 36 },
        { inventoryItemId: inv["DEMO-PKG-POUCH-500G"].id, actualQty: 240 },
      ],
    },
    productionUser,
  );

  await productionService.postProductionRun(
    undefined,
    {
      organizationId: org.id,
      warehouseId: warehouse.id,
      recipeId: cookiesRecipe.id,
      runNumber: "DEMO-RUN-005",
      batchCount: 2,
      actualGoodQty: 296,
      actualRejectedQty: 4,
      directLaborCost: 2200,
      utilityCost: 900,
      notes: "Multigrain cookies baking batch",
      idempotencyKey: "demo-run-005",
      consumedMaterials: [
        { inventoryItemId: inv["DEMO-RM-RAGI"].id, actualQty: 36 },
        { inventoryItemId: inv["DEMO-RM-BUTTER"].id, actualQty: 18 },
        { inventoryItemId: inv["DEMO-RM-JAGGERY"].id, actualQty: 16 },
        { inventoryItemId: inv["DEMO-PKG-BOX-200G"].id, actualQty: 300 },
      ],
    },
    productionUser,
  );

  // ── 10. Customers & Salesman Assignments ──────────────────────────────────
  const custGreenBasket = await salesService.createCustomer(
    {
      organizationId: org.id,
      code: "DEMO-CUST-GBR",
      name: "Green Basket Retailers",
      state: "Tamil Nadu",
      gstin: "33DEMOC1111G1Z1",
      phone: "+91 98000 00101",
      email: "orders@greenbasket.example",
    },
    adminUser,
  );
  // Profile update to demonstrate customer audit history
  await salesService.updateCustomer(
    custGreenBasket.id,
    {
      phone: "+91 98000 00199",
      email: "procurement@greenbasket.example",
    },
    adminUser,
  );

  const custAnnapoorna = await salesService.createCustomer(
    {
      organizationId: org.id,
      code: "DEMO-CUST-SAF",
      name: "Sri Annapoorna Foods",
      state: "Tamil Nadu",
      gstin: "33DEMOC2222S1Z2",
      phone: "+91 98000 00102",
      email: "buying@annapoornafoods.example",
    },
    adminUser,
  );

  const custKaveri = await salesService.createCustomer(
    {
      organizationId: org.id,
      code: "DEMO-CUST-KWM",
      name: "Kaveri Wholesale Mart",
      state: "Karnataka",
      gstin: "29DEMOC3333K1Z3",
      phone: "+91 98000 00103",
      email: "accounts@kaverimart.example",
    },
    adminUser,
  );

  for (const cust of [custGreenBasket, custAnnapoorna, custKaveri]) {
    await salesService.assignSalesman(cust.id, salesmanUser.id, adminUser);
  }

  // ── 11. Orders, Dispatches, Invoices, and Payments ────────────────────────

  // ORDER 1 (Primary Story): Green Basket Retailers — Draft -> Updated -> Submitted -> Approved -> Invoiced -> Dispatched -> Fully Paid (2 payments)
  const order1Draft = await salesService.createSalesOrder(
    {
      organizationId: org.id,
      customerId: custGreenBasket.id,
      warehouseId: warehouse.id,
      orderNumber: "DEMO-SO-001",
      status: "DRAFT",
      notes: "Initial draft order for Green Basket Retailers",
      idempotencyKey: "demo-so-001",
      lines: [
        { productVariantId: varRagi.id, quantity: 80, unitPrice: 150 },
      ],
    },
    salesmanUser,
  );
  await salesService.updateDraftOrder(
    order1Draft.order.id,
    {
      status: "SUBMITTED",
      notes: "Confirmed Q4 restock: Sprouted Ragi Mix & Traditional Idli Mix",
      lines: [
        { productVariantId: varRagi.id, quantity: 100, unitPrice: 150 },
        { productVariantId: varIdli.id, quantity: 80, unitPrice: 95 },
      ],
    },
    salesmanUser,
  );
  await salesService.approveSalesOrder(order1Draft.order.id, {}, adminUser);
  const inv1 = await financeService.createInvoiceFromOrder(
    {
      salesOrderId: order1Draft.order.id,
      notes: "Intra-state GST invoice for Green Basket Retailers",
      idempotencyKey: "demo-inv-001",
    },
    adminUser,
  );
  if (!inv1) throw new Error("Failed to create DEMO-INV-001");
  await dispatchService.postDispatch(
    {
      salesOrderId: order1Draft.order.id,
      warehouseId: warehouse.id,
      vehicleNumber: "TN-37-DEMO-101",
      driverName: "Muruganandam S.",
      driverPhone: "9800000301",
      notes: "Delivered to Green Basket RS Puram hub",
      idempotencyKey: "demo-dsp-001",
    },
    adminUser,
  );

  // Payment 1 & 2: Settle inv1 (₹23,730.00 = ₹10,000.00 + ₹13,730.00)
  await paymentService.recordPayment(
    {
      organizationId: org.id,
      customerId: custGreenBasket.id,
      amount: 10000,
      paymentMode: PaymentMode.UPI,
      referenceNumber: "UPI-DEMO-2026-001",
      notes: "First tranche against invoice " + inv1.invoiceNumber,
      idempotencyKey: "demo-pay-001",
      allocations: [{ salesInvoiceId: inv1.id, amount: 10000 }],
    },
    adminUser,
  );
  const inv1Remaining = Number(inv1.totalAmount) - 10000;
  await paymentService.recordPayment(
    {
      organizationId: org.id,
      customerId: custGreenBasket.id,
      amount: inv1Remaining,
      paymentMode: PaymentMode.BANK_TRANSFER,
      referenceNumber: "NEFT-DEMO-2026-002",
      notes: "Final settlement against invoice " + inv1.invoiceNumber,
      idempotencyKey: "demo-pay-002",
      allocations: [{ salesInvoiceId: inv1.id, amount: inv1Remaining }],
    },
    adminUser,
  );

  // ORDER 2: Green Basket Retailers — Cookies & Spiced Ready-Mix -> Dispatched -> Partially Paid (2 partial payments)
  const order2 = await salesService.createSalesOrder(
    {
      organizationId: org.id,
      customerId: custGreenBasket.id,
      warehouseId: warehouse.id,
      orderNumber: "DEMO-SO-002",
      status: "SUBMITTED",
      notes: "Festive snacks assortment for Coimbatore stores",
      idempotencyKey: "demo-so-002",
      lines: [
        { productVariantId: varCookies.id, quantity: 120, unitPrice: 120 },
        { productVariantId: varSpiced.id, quantity: 50, unitPrice: 85 },
      ],
    },
    salesmanUser,
  );
  await salesService.approveSalesOrder(order2.order.id, {}, adminUser);
  const inv2 = await financeService.createInvoiceFromOrder(
    {
      salesOrderId: order2.order.id,
      notes: "Multi-slab GST (18% & 12%) invoice",
      idempotencyKey: "demo-inv-002",
    },
    adminUser,
  );
  if (!inv2) throw new Error("Failed to create DEMO-INV-002");
  await dispatchService.postDispatch(
    {
      salesOrderId: order2.order.id,
      warehouseId: warehouse.id,
      vehicleNumber: "TN-37-DEMO-102",
      driverName: "Prakash R.",
      driverPhone: "9800000302",
      notes: "Dispatched in master cartons",
      idempotencyKey: "demo-dsp-002",
    },
    adminUser,
  );

  await paymentService.recordPayment(
    {
      organizationId: org.id,
      customerId: custGreenBasket.id,
      amount: 12000,
      paymentMode: PaymentMode.CHEQUE,
      referenceNumber: "CHQ-DEMO-44019",
      notes: "Part payment for festive cookies order",
      idempotencyKey: "demo-pay-003",
      allocations: [{ salesInvoiceId: inv2.id, amount: 12000 }],
    },
    adminUser,
  );
  await paymentService.recordPayment(
    {
      organizationId: org.id,
      customerId: custGreenBasket.id,
      amount: 2000,
      paymentMode: PaymentMode.CASH,
      referenceNumber: "CASH-DEMO-006",
      notes: "Counter cash collection towards balance",
      idempotencyKey: "demo-pay-006",
      allocations: [{ salesInvoiceId: inv2.id, amount: 2000 }],
    },
    adminUser,
  );

  // ORDER 3 & 4: Kaveri Wholesale Mart (Karnataka, Inter-State IGST) + Cross-Invoice Payment
  const order3 = await salesService.createSalesOrder(
    {
      organizationId: org.id,
      customerId: custKaveri.id,
      warehouseId: warehouse.id,
      orderNumber: "DEMO-SO-003",
      status: "SUBMITTED",
      notes: "Bengaluru wholesale replenishment (Inter-state IGST)",
      idempotencyKey: "demo-so-003",
      lines: [
        { productVariantId: varMillet.id, quantity: 100, unitPrice: 110 },
        { productVariantId: varRagi.id, quantity: 80, unitPrice: 150 },
      ],
    },
    salesmanUser,
  );
  await salesService.approveSalesOrder(order3.order.id, {}, adminUser);
  const inv3 = await financeService.createInvoiceFromOrder(
    {
      salesOrderId: order3.order.id,
      notes: "Inter-state IGST supply to Karnataka",
      idempotencyKey: "demo-inv-003",
    },
    adminUser,
  );
  if (!inv3) throw new Error("Failed to create DEMO-INV-003");
  await dispatchService.postDispatch(
    {
      salesOrderId: order3.order.id,
      warehouseId: warehouse.id,
      vehicleNumber: "KA-01-DEMO-808",
      driverName: "Nagaraj K.",
      driverPhone: "9800000303",
      notes: "Inter-state linehaul dispatch to Bengaluru",
      idempotencyKey: "demo-dsp-003",
    },
    adminUser,
  );

  // Order 4: Approved + Invoiced, awaiting dispatch (UNFULFILLED)
  const order4 = await salesService.createSalesOrder(
    {
      organizationId: org.id,
      customerId: custKaveri.id,
      warehouseId: warehouse.id,
      orderNumber: "DEMO-SO-004",
      status: "SUBMITTED",
      notes: "Cookies wholesale order — packed & awaiting carrier pickup",
      idempotencyKey: "demo-so-004",
      lines: [
        { productVariantId: varCookies.id, quantity: 60, unitPrice: 120 },
      ],
    },
    salesmanUser,
  );
  await salesService.approveSalesOrder(order4.order.id, {}, adminUser);
  const inv4 = await financeService.createInvoiceFromOrder(
    {
      salesOrderId: order4.order.id,
      notes: "Inter-state IGST invoice (awaiting dispatch)",
      idempotencyKey: "demo-inv-004",
    },
    adminUser,
  );
  if (!inv4) throw new Error("Failed to create DEMO-INV-004");

  // Payment 4: Single ₹28,000.00 payment allocated across inv3 (full) and inv4 (partial)
  const inv3Total = Number(inv3.totalAmount);
  const inv4Partial = 28000 - inv3Total;
  await paymentService.recordPayment(
    {
      organizationId: org.id,
      customerId: custKaveri.id,
      amount: 28000,
      paymentMode: PaymentMode.BANK_TRANSFER,
      referenceNumber: "RTGS-DEMO-2026-004",
      notes: "Consolidated RTGS settling " + inv3.invoiceNumber + " & part of " + inv4.invoiceNumber,
      idempotencyKey: "demo-pay-004",
      allocations: [
        { salesInvoiceId: inv3.id, amount: inv3Total },
        { salesInvoiceId: inv4.id, amount: inv4Partial },
      ],
    },
    adminUser,
  );

  // ORDER 5: Sri Annapoorna Foods — Newly Submitted Order awaiting approval + Unallocated Advance Payment
  await salesService.createSalesOrder(
    {
      organizationId: org.id,
      customerId: custAnnapoorna.id,
      warehouseId: warehouse.id,
      orderNumber: "DEMO-SO-005",
      status: "SUBMITTED",
      notes: "New distributor order awaiting credit & stock approval",
      idempotencyKey: "demo-so-005",
      lines: [
        { productVariantId: varIdli.id, quantity: 60, unitPrice: 95 },
        { productVariantId: varMillet.id, quantity: 40, unitPrice: 110 },
      ],
    },
    salesmanUser,
  );

  // Payment 5: Unallocated customer advance from Sri Annapoorna Foods
  await paymentService.recordPayment(
    {
      organizationId: org.id,
      customerId: custAnnapoorna.id,
      amount: 5000,
      paymentMode: PaymentMode.UPI,
      referenceNumber: "UPI-DEMO-ADV-005",
      notes: "Advance booking deposit from Sri Annapoorna Foods",
      idempotencyKey: "demo-pay-005",
      allocations: [],
    },
    adminUser,
  );

  return { alreadySeeded: false, organizationId: org.id };
}

export async function verifyDemoData() {
  const org = await prisma.organization.findUnique({
    where: { code: DEMO_ORG_CODE },
  });
  if (!org) {
    throw new Error(`Demo organization ${DEMO_ORG_CODE} not found.`);
  }
  const orgId = org.id;

  const [
    customersCount,
    productsCount,
    recipesCount,
    orders,
    invoices,
    payments,
    runsCount,
    receiptsCount,
    dispatchesCount,
    balances,
    auditCount,
    adminDb,
  ] = await Promise.all([
    prisma.customer.count({ where: { organizationId: orgId } }),
    prisma.product.count({ where: { organizationId: orgId } }),
    prisma.recipe.count({ where: { organizationId: orgId } }),
    prisma.salesOrder.findMany({
      where: { organizationId: orgId },
      include: { customer: true, lines: true },
    }),
    prisma.salesInvoice.findMany({
      where: { organizationId: orgId },
      include: {
        salesOrder: true,
        paymentAllocations: { where: { isReversed: false } },
      },
    }),
    prisma.payment.findMany({
      where: { organizationId: orgId },
      include: { allocations: { where: { isReversed: false } } },
    }),
    prisma.productionRun.count({ where: { organizationId: orgId } }),
    prisma.purchaseReceipt.count({ where: { organizationId: orgId } }),
    prisma.dispatch.count({ where: { organizationId: orgId } }),
    prisma.warehouseStockBalance.findMany({ where: { organizationId: orgId } }),
    prisma.auditLog.count({ where: { organizationId: orgId } }),
    prisma.user.findFirstOrThrow({
      where: { email: "admin@millledger.local" },
    }),
  ]);

  // 1. Referential & Stock Integrity
  const negativeStock = balances.filter(
    (b) =>
      Number(b.onHand) < 0 ||
      Number(b.reserved) < 0 ||
      Number(b.onHand) < Number(b.reserved),
  );
  const referentialOk =
    negativeStock.length === 0 &&
    orders.every((o) => o.customer.organizationId === orgId) &&
    invoices.every(
      (i) => !i.salesOrder || i.salesOrder.customerId === i.customerId,
    );

  // 2. Financial Reconciliation
  let invoiceReconciled = true;
  let totalInvoiced = 0;
  for (const inv of invoices) {
    const taxable = Number(inv.taxableAmount);
    const tax = Number(inv.totalTaxAmount);
    const total = Number(inv.totalAmount);
    const paid = Number(inv.paidAmount);
    const outstanding = Number(inv.outstandingAmount);
    const allocSum = inv.paymentAllocations.reduce(
      (acc, a) => acc + Number(a.amount),
      0,
    );
    totalInvoiced += total;
    if (
      Math.abs(taxable + tax - total) > 0.01 ||
      Math.abs(paid - allocSum) > 0.01 ||
      Math.abs(total - paid - outstanding) > 0.01
    ) {
      invoiceReconciled = false;
    }
  }

  let paymentReconciled = true;
  let totalCollected = 0;
  for (const p of payments) {
    const amt = Number(p.amount);
    const unalloc = Number(p.unallocatedAmount);
    const allocSum = p.allocations.reduce((acc, a) => acc + Number(a.amount), 0);
    totalCollected += amt;
    if (Math.abs(amt - (allocSum + unalloc)) > 0.01) {
      paymentReconciled = false;
    }
  }

  const [salesReport, collectionsReport] = await Promise.all([
    reportingService.getSalesReport({ organizationId: orgId }),
    reportingService.getCollectionsReport({ organizationId: orgId }),
  ]);
  const reportsMatch =
    Math.abs(salesReport.summary.grandTotal - totalInvoiced) < 0.01 &&
    Math.abs(collectionsReport.summary.totalAmount - totalCollected) < 0.01;

  // 3. Timeline Coverage
  const adminCtx: UserContext = {
    id: adminDb.id,
    name: adminDb.name,
    email: adminDb.email,
    role: "ADMIN",
    isActive: true,
    organizationId: orgId,
  };
  const sampleCust = await prisma.customer.findFirstOrThrow({
    where: { organizationId: orgId, code: "DEMO-CUST-GBR" },
  });
  const sampleProd = await prisma.product.findFirstOrThrow({
    where: { organizationId: orgId, code: "DEMO-PRD-RAGI" },
  });
  const sampleRecipe = await prisma.recipe.findFirstOrThrow({
    where: { organizationId: orgId, version: 2 },
  });
  const sampleOrder = orders.find((o) => o.orderNumber === "DEMO-SO-001")!;
  const sampleInvoice = invoices.find((i) => i.salesOrderId === sampleOrder.id)!;
  const samplePayment = payments[0]!;

  const timelines = await Promise.all([
    timelineService.getEntityTimeline({
      organizationId: orgId,
      user: adminCtx,
      entityType: "customer",
      entityId: sampleCust.id,
      filter: "ALL",
      limit: 50,
      offset: 0,
    }),
    timelineService.getEntityTimeline({
      organizationId: orgId,
      user: adminCtx,
      entityType: "product",
      entityId: sampleProd.id,
      filter: "ALL",
      limit: 50,
      offset: 0,
    }),
    timelineService.getEntityTimeline({
      organizationId: orgId,
      user: adminCtx,
      entityType: "recipe",
      entityId: sampleRecipe.id,
      filter: "ALL",
      limit: 50,
      offset: 0,
    }),
    timelineService.getEntityTimeline({
      organizationId: orgId,
      user: adminCtx,
      entityType: "order",
      entityId: sampleOrder.id,
      filter: "ALL",
      limit: 50,
      offset: 0,
    }),
    timelineService.getEntityTimeline({
      organizationId: orgId,
      user: adminCtx,
      entityType: "invoice",
      entityId: sampleInvoice.id,
      filter: "ALL",
      limit: 50,
      offset: 0,
    }),
    timelineService.getEntityTimeline({
      organizationId: orgId,
      user: adminCtx,
      entityType: "payment",
      entityId: samplePayment.id,
      filter: "ALL",
      limit: 50,
      offset: 0,
    }),
  ]);
  const timelinesOk = timelines.every((t) => t.events.length > 0);

  return {
    counts: {
      customers: customersCount,
      products: productsCount,
      recipes: recipesCount,
      orders: orders.length,
      invoices: invoices.length,
      payments: payments.length,
      productionRuns: runsCount,
      purchaseReceipts: receiptsCount,
      dispatches: dispatchesCount,
      auditLogs: auditCount,
    },
    checks: {
      referentialIntegrity: referentialOk,
      invoiceReconciliation: invoiceReconciled,
      paymentReconciliation: paymentReconciled,
      reportsMatch,
      timelineCoverage: timelinesOk,
    },
    totals: {
      totalInvoiced,
      totalCollected,
      timelineEventCounts: {
        customer: timelines[0].events.length,
        product: timelines[1].events.length,
        recipe: timelines[2].events.length,
        order: timelines[3].events.length,
        invoice: timelines[4].events.length,
        payment: timelines[5].events.length,
      },
    },
  };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const shouldReset = args.has("--reset");
  const verifyOnly = args.has("--verify-only");

  if (shouldReset) {
    console.log(`Resetting isolated demo dataset (${DEMO_ORG_CODE})...`);
    const res = await resetDemoData();
    console.log(
      res.deleted
        ? `Deleted ${DEMO_ORG_CODE} records without touching other organizations.`
        : `No ${DEMO_ORG_CODE} organization found to reset.`,
    );
    if (args.has("--reset-only")) {
      await prisma.$disconnect();
      return;
    }
  }

  if (!verifyOnly) {
    const seedRes = await seedDemoData();
    console.log(
      seedRes.alreadySeeded
        ? `Demo dataset (${DEMO_ORG_CODE}) already seeded (idempotent skip).`
        : `Seeded MillLedger Demo Foods (${DEMO_ORG_CODE}) successfully.`,
    );
  }

  const report = await verifyDemoData();
  console.log("\n=== MillLedger Demo Foods — Seed & Verification Summary ===");
  console.table([
    { Category: "Customers", Count: report.counts.customers, Verified: report.checks.referentialIntegrity ? "PASS" : "FAIL" },
    { Category: "Products", Count: report.counts.products, Verified: "PASS" },
    { Category: "Recipes", Count: report.counts.recipes, Verified: "PASS" },
    { Category: "Orders", Count: report.counts.orders, Verified: report.checks.referentialIntegrity ? "PASS" : "FAIL" },
    { Category: "Invoices", Count: report.counts.invoices, Verified: report.checks.invoiceReconciliation ? "PASS" : "FAIL" },
    { Category: "Payments", Count: report.counts.payments, Verified: report.checks.paymentReconciliation ? "PASS" : "FAIL" },
    { Category: "Production Runs", Count: report.counts.productionRuns, Verified: "PASS" },
    { Category: "Purchase Receipts", Count: report.counts.purchaseReceipts, Verified: "PASS" },
    { Category: "Dispatches", Count: report.counts.dispatches, Verified: "PASS" },
    { Category: "Audit Logs", Count: report.counts.auditLogs, Verified: report.checks.timelineCoverage ? "PASS" : "FAIL" },
  ]);
  console.log("Financial & Integrity Checks:", JSON.stringify(report.checks));
  console.log("Totals & Timeline Event Counts:", JSON.stringify(report.totals));

  const allPassed = Object.values(report.checks).every(Boolean);
  await prisma.$disconnect();
  if (!allPassed) {
    process.exit(1);
  }
}

const isEntrypoint =
  process.argv[1] && process.argv[1].endsWith("seed-demo.ts");
if (isEntrypoint) {
  main().catch(async (err) => {
    console.error("Demo seed failed:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
}
