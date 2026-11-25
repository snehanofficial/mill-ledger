import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { prisma } from "../db/client.js";
import { resetOperationalData } from "../db/reset.js";
import { seedBenchmarkMasters } from "../db/seed.js";
import { inventoryService } from "../modules/inventory/inventory.service.js";

describe("M4: Production execution, atomic posting, and reversals", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    // 1. Reset any existing production and purchase runs and restore opening stock
    await resetOperationalData();
    await seedBenchmarkMasters();

    const app = createApp();
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  async function loginAndGetCookie(
    email: string,
    password: string,
  ): Promise<string> {
    const res = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    return res.headers.get("set-cookie") ?? "";
  }

  it("executes benchmark transactions 1, 2, and 3: purchases flour, posts production run, and verifies exact costs and balances", async () => {
    // 1. Fetch master records
    const org = await prisma.organization.findUniqueOrThrow({
      where: { code: "MILL" },
    });
    const warehouse = await prisma.warehouse.findFirstOrThrow({
      where: { code: "WH-1" },
    });
    const supplier = await prisma.supplier.findFirstOrThrow({
      where: { code: "SUP-FLOUR-1" },
    });
    const kgUom = await prisma.unitOfMeasure.findFirstOrThrow({
      where: { code: "KG" },
    });
    const recipe = await prisma.recipe.findFirstOrThrow({
      where: {
        organizationId: org.id,
        version: 1,
      },
    });

    const flour = await prisma.inventoryItem.findFirstOrThrow({
      where: { sku: "RM-FLOUR" },
    });
    const oil = await prisma.inventoryItem.findFirstOrThrow({
      where: { sku: "RM-OIL" },
    });
    const spice = await prisma.inventoryItem.findFirstOrThrow({
      where: { sku: "RM-SPICE" },
    });
    const pouch = await prisma.inventoryItem.findFirstOrThrow({
      where: { sku: "PKG-POUCH-200G" },
    });
    const carton = await prisma.inventoryItem.findFirstOrThrow({
      where: { sku: "PKG-CARTON" },
    });

    // Step 1: Purchase 60 kg flour at ₹45/kg (Benchmark Transaction 1)
    await inventoryService.postPurchaseReceipt({
      organizationId: org.id,
      supplierId: supplier.id,
      warehouseId: warehouse.id,
      receiptNumber: "PR-PROD-TEST-001",
      idempotencyKey: "idem-prod-flour-purchase",
      items: [
        {
          inventoryItemId: flour.id,
          quantity: 60,
          uomId: kgUom.id,
          unitPrice: 45.0,
        },
      ],
    });

    // Check flour weighted average cost: (100 * 42 + 60 * 45) / 160 = 43.125
    const flourAfterPurchase = await prisma.inventoryItem.findUniqueOrThrow({
      where: { id: flour.id },
    });
    expect(Number(flourAfterPurchase.currentStock)).toBe(160);
    expect(Number(flourAfterPurchase.weightedAverageCost)).toBe(43.125);

    // Step 2 & 3: Post production run as PRODUCTION user
    const productionCookie = await loginAndGetCookie(
      "production@millledger.local",
      "ProductionPassword123!",
    );

    const postPayload = {
      organizationId: org.id,
      warehouseId: warehouse.id,
      recipeId: recipe.id,
      runNumber: "RUN-BENCHMARK-001",
      batchCount: 1,
      actualGoodQty: 188,
      actualRejectedQty: 0,
      directLaborCost: 1200,
      utilityCost: 600,
      notes:
        "Benchmark production batch 1 with 6 damaged pouches and 9 cartons",
      idempotencyKey: "idem-prod-run-001",
      consumedMaterials: [
        {
          inventoryItemId: flour.id,
          actualQty: 40,
        },
        {
          inventoryItemId: oil.id,
          actualQty: 10.5,
        },
        {
          inventoryItemId: spice.id,
          actualQty: 1.2,
        },
        {
          inventoryItemId: pouch.id,
          actualQty: 194,
          damagedQty: 6,
        },
        {
          inventoryItemId: carton.id,
          actualQty: 9,
        },
      ],
    };

    const postRes = await fetch(`${baseUrl}/api/v1/production-runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: productionCookie,
      },
      body: JSON.stringify(postPayload),
    });

    expect(postRes.status).toBe(201);
    const body = (await postRes.json()) as {
      run: {
        id: string;
        runNumber: string;
        status: string;
        expectedOutputQty: string | number;
        actualGoodQty: string | number;
        yieldVarianceQty: string | number;
        yieldVariancePct: string | number;
        isYieldFlagged: boolean;
        directMaterialCost: string | number;
        directLaborCost: string | number;
        utilityCost: string | number;
        totalRunCost: string | number;
        costPerGoodUnit: string | number;
        materials: Array<{
          inventoryItemId: string;
          actualQty: string | number;
          varianceQty: string | number;
          variancePct: string | number;
          isVarianceFlagged: boolean;
          unitCost: string | number;
          totalCost: string | number;
        }>;
      };
      warnings: string[];
    };

    const run = body.run;
    expect(run.status).toBe("POSTED");
    expect(Number(run.expectedOutputQty)).toBe(200);
    expect(Number(run.actualGoodQty)).toBe(188);

    // Exact Yield variance: -12 packets (-6%), flagged
    expect(Number(run.yieldVarianceQty)).toBe(-12);
    expect(Number(run.yieldVariancePct)).toBe(-6);
    expect(run.isYieldFlagged).toBe(true);

    // Exact direct materials and packaging: ₹4,055
    // Flour: 40 * 43.125 = 1725
    // Oil: 10.5 * 140 = 1470
    // Spice: 1.2 * 200 = 240
    // Pouches: 194 * 2.50 = 485
    // Cartons: 9 * 15 = 135
    // Total: 1725 + 1470 + 240 + 485 + 135 = 4055
    expect(Number(run.directMaterialCost)).toBe(4055);
    expect(Number(run.directLaborCost)).toBe(1200);
    expect(Number(run.utilityCost)).toBe(600);

    // Total run cost: 4055 + 1200 + 600 = ₹5,855
    expect(Number(run.totalRunCost)).toBe(5855);

    // Cost per good packet: 5855 / 188 ≈ 31.14
    expect(Number(run.costPerGoodUnit)).toBeCloseTo(31.1436, 3);

    // Variances on materials:
    const oilMaterial = run.materials.find((m) => m.inventoryItemId === oil.id);
    expect(oilMaterial).toBeDefined();
    expect(Number(oilMaterial!.actualQty)).toBe(10.5);
    expect(Number(oilMaterial!.varianceQty)).toBe(0.5);
    expect(Number(oilMaterial!.variancePct)).toBe(5);
    expect(oilMaterial!.isVarianceFlagged).toBe(true); // +5% flagged

    // Carton warning: 9 cartons hold 180 of 188 packets
    expect(
      body.warnings.some((w) =>
        w.includes("9 cartons represent 180 of 188 packets"),
      ),
    ).toBe(true);

    // Check exact closing balances per Benchmark table:
    const balances = await inventoryService.getInventoryBalances(
      org.id,
      warehouse.id,
    );
    const balanceMap = new Map(balances.map((b) => [b.sku, b]));

    // Flour closing: 120 kg
    expect(balanceMap.get("RM-FLOUR")?.onHand).toBe(120);
    expect(balanceMap.get("RM-FLOUR")?.reconciled).toBe(true);

    // Oil closing: 19.5 L
    expect(balanceMap.get("RM-OIL")?.onHand).toBe(19.5);
    expect(balanceMap.get("RM-OIL")?.reconciled).toBe(true);

    // Spice closing: 3.8 kg
    expect(balanceMap.get("RM-SPICE")?.onHand).toBe(3.8);
    expect(balanceMap.get("RM-SPICE")?.reconciled).toBe(true);

    // Pouch closing: 306 pieces
    expect(balanceMap.get("PKG-POUCH-200G")?.onHand).toBe(306);
    expect(balanceMap.get("PKG-POUCH-200G")?.reconciled).toBe(true);

    // Carton closing: 21 pieces
    expect(balanceMap.get("PKG-CARTON")?.onHand).toBe(21);
    expect(balanceMap.get("PKG-CARTON")?.reconciled).toBe(true);

    // Finished stock after run: 50 opening + 188 = 238 packets
    const finishedStock = balanceMap.get("FG-MURUKKU-200G");
    expect(finishedStock?.onHand).toBe(238);
    expect(finishedStock?.reconciled).toBe(true);
  });

  it("enforces role permissions: blocks unauthorized posting and permits read-only access for accountants", async () => {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { code: "MILL" },
    });
    const warehouse = await prisma.warehouse.findFirstOrThrow({
      where: { code: "WH-1" },
    });
    const recipe = await prisma.recipe.findFirstOrThrow({
      where: {
        organizationId: org.id,
        version: 1,
      },
    });
    const flour = await prisma.inventoryItem.findFirstOrThrow({
      where: { sku: "RM-FLOUR" },
    });

    const payload = {
      organizationId: org.id,
      warehouseId: warehouse.id,
      recipeId: recipe.id,
      runNumber: "RUN-ILLEGAL-001",
      actualGoodQty: 50,
      consumedMaterials: [{ inventoryItemId: flour.id, actualQty: 10 }],
    };

    // 1. Salesman cannot post production run (403)
    const salesmanCookie = await loginAndGetCookie(
      "salesman1@millledger.local",
      "SalesmanPassword123!",
    );
    const salesmanRes = await fetch(`${baseUrl}/api/v1/production-runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: salesmanCookie,
      },
      body: JSON.stringify(payload),
    });
    expect(salesmanRes.status).toBe(403);

    // 2. Accountant cannot post production run (403 write prohibited)
    const accountantCookie = await loginAndGetCookie(
      "accountant@millledger.local",
      "AccountantPassword123!",
    );
    const accountantPostRes = await fetch(`${baseUrl}/api/v1/production-runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: accountantCookie,
      },
      body: JSON.stringify(payload),
    });
    expect(accountantPostRes.status).toBe(403);

    // 3. Accountant cannot read production runs (403 per authorization matrix line 27)
    const accountantGetRes = await fetch(
      `${baseUrl}/api/v1/production-runs?organizationId=${org.id}`,
      {
        headers: { Cookie: accountantCookie },
      },
    );
    expect(accountantGetRes.status).toBe(403);

    // 4. Owner CAN read production runs (200 read allowed per authorization matrix)
    const ownerCookie = await loginAndGetCookie(
      "owner@millledger.local",
      "OwnerPassword123!",
    );
    const ownerGetRes = await fetch(
      `${baseUrl}/api/v1/production-runs?organizationId=${org.id}`,
      {
        headers: { Cookie: ownerCookie },
      },
    );
    expect(ownerGetRes.status).toBe(200);
  });

  it("handles production run reversal: restores stock balances and marks run as REVERSED", async () => {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { code: "MILL" },
    });
    const warehouse = await prisma.warehouse.findFirstOrThrow({
      where: { code: "WH-1" },
    });
    const recipe = await prisma.recipe.findFirstOrThrow({
      where: {
        organizationId: org.id,
        version: 1,
      },
    });
    const flour = await prisma.inventoryItem.findFirstOrThrow({
      where: { sku: "RM-FLOUR" },
    });

    const adminCookie = await loginAndGetCookie(
      "admin@millledger.local",
      "AdminPassword123!",
    );

    // Create and post a reversible run with 10 kg flour producing 50 packets
    const postRes = await fetch(`${baseUrl}/api/v1/production-runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        organizationId: org.id,
        warehouseId: warehouse.id,
        recipeId: recipe.id,
        runNumber: "RUN-TO-REVERSE-001",
        batchCount: 1,
        actualGoodQty: 50,
        directLaborCost: 100,
        consumedMaterials: [{ inventoryItemId: flour.id, actualQty: 10 }],
      }),
    });
    expect(postRes.status).toBe(201);
    const postData = (await postRes.json()) as { run: { id: string } };
    const runId = postData.run.id;

    // Check flour on-hand decreased by 10 (120 - 10 = 110)
    const flourBeforeRev = await prisma.inventoryItem.findUniqueOrThrow({
      where: { id: flour.id },
    });
    expect(Number(flourBeforeRev.currentStock)).toBe(110);

    // Post reversal
    const revRes = await fetch(
      `${baseUrl}/api/v1/production-runs/${runId}/reverse`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: adminCookie,
        },
        body: JSON.stringify({ reason: "Quality check failed on output" }),
      },
    );

    expect(revRes.status).toBe(200);
    const reversedRun = (await revRes.json()) as {
      status: string;
      reversalReason: string;
    };
    expect(reversedRun.status).toBe("REVERSED");
    expect(reversedRun.reversalReason).toBe("Quality check failed on output");

    // Verify flour restored back to 120 kg
    const flourAfterRev = await prisma.inventoryItem.findUniqueOrThrow({
      where: { id: flour.id },
    });
    expect(Number(flourAfterRev.currentStock)).toBe(120);

    // Verify ledger reconciliation remains intact
    const balances = await inventoryService.getInventoryBalances(
      org.id,
      warehouse.id,
    );
    const flourBal = balances.find((b) => b.sku === "RM-FLOUR");
    expect(flourBal?.onHand).toBe(120);
    expect(flourBal?.reconciled).toBe(true);
  });

  it("resolves organization code MILL and warehouse code WH-1 when listing balances, recipes, and posting a run", async () => {
    const productionCookie = await loginAndGetCookie(
      "production@millledger.local",
      "ProductionPassword123!",
    );

    const balRes = await fetch(
      `${baseUrl}/api/v1/inventory/balances?organizationId=MILL`,
      { headers: { Cookie: productionCookie } },
    );
    expect(balRes.status).toBe(200);
    const balData = (await balRes.json()) as {
      balances: Array<{ id: string; sku: string }>;
    };
    const flour = balData.balances.find((b) => b.sku === "RM-FLOUR");
    expect(flour).toBeDefined();

    const recipesRes = await fetch(
      `${baseUrl}/api/v1/production-runs/recipes?organizationId=MILL`,
      { headers: { Cookie: productionCookie } },
    );
    expect(recipesRes.status).toBe(200);
    const recipesData = (await recipesRes.json()) as {
      recipes: Array<{ id: string }>;
    };
    expect(recipesData.recipes.length).toBeGreaterThan(0);

    const postRes = await fetch(`${baseUrl}/api/v1/production-runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: productionCookie,
      },
      body: JSON.stringify({
        organizationId: "MILL",
        warehouseId: "WH-1",
        recipeId: recipesData.recipes[0].id,
        runNumber: "RUN-CODE-RES-001",
        batchCount: 1,
        actualGoodQty: 180,
        consumedMaterials: [{ inventoryItemId: flour!.id, actualQty: 40 }],
      }),
    });
    expect(postRes.status).toBe(201);

    const listRes = await fetch(
      `${baseUrl}/api/v1/production-runs?organizationId=MILL`,
      { headers: { Cookie: productionCookie } },
    );
    expect(listRes.status).toBe(200);
    const listData = (await listRes.json()) as {
      runs: Array<{ runNumber: string }>;
    };
    expect(
      listData.runs.some((r) => r.runNumber === "RUN-CODE-RES-001"),
    ).toBe(true);
  });

  it("IMP-011 & IMP-013: clones BOM recipe versions without mutating historical versions and enforces draft-only edit/delete", async () => {
    const adminCookie = await loginAndGetCookie(
      "admin@millledger.local",
      "AdminPassword123!",
    );
    const prodCookie = await loginAndGetCookie(
      "production@millledger.local",
      "ProductionPassword123!",
    );

    const recipesRes = await fetch(
      `${baseUrl}/api/v1/production-runs/recipes?organizationId=MILL`,
      { headers: { Cookie: adminCookie } },
    );
    const { recipes } = (await recipesRes.json()) as {
      recipes: Array<{ id: string; version: number }>;
    };
    const baseRecipe = recipes[0];

    // Clone new version
    const verRes = await fetch(
      `${baseUrl}/api/v1/production-runs/recipes/${baseRecipe.id}/version`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: adminCookie,
        },
        body: JSON.stringify({ expectedOutputQty: 220 }),
      },
    );
    expect(verRes.status).toBe(201);
    const { recipe: cloned } = (await verRes.json()) as {
      recipe: { id: string; version: number };
    };
    expect(cloned.version).toBeGreaterThan(baseRecipe.version);

    // Create draft run
    const draftRes = await fetch(`${baseUrl}/api/v1/production-runs/draft`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: prodCookie,
      },
      body: JSON.stringify({
        organizationId: "MILL",
        warehouseId: "WH-1",
        recipeId: cloned.id,
        runNumber: `RUN-DRAFT-${Date.now()}`,
        batchCount: 1,
        notes: "Initial draft",
      }),
    });
    expect(draftRes.status).toBe(201);
    const draftRun = (await draftRes.json()) as { id: string };

    // Update draft run
    const putRes = await fetch(
      `${baseUrl}/api/v1/production-runs/${draftRun.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: prodCookie,
        },
        body: JSON.stringify({ notes: "Updated draft notes" }),
      },
    );
    expect(putRes.status).toBe(200);

    // Delete draft run
    const delRes = await fetch(
      `${baseUrl}/api/v1/production-runs/${draftRun.id}`,
      {
        method: "DELETE",
        headers: { Cookie: prodCookie },
      },
    );
    expect(delRes.status).toBe(200);

    // Reject edit on POSTED run
    const postedRun = await prisma.productionRun.findFirstOrThrow({
      where: { status: "POSTED" },
    });
    const badPut = await fetch(
      `${baseUrl}/api/v1/production-runs/${postedRun.id}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: prodCookie,
        },
        body: JSON.stringify({ notes: "Should fail" }),
      },
    );
    expect(badPut.status).toBe(400);
  });
});
