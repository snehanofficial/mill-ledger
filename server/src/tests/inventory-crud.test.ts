import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { prisma } from "../db/client.js";
import { resetOperationalData } from "../db/reset.js";
import { seedBenchmarkMasters } from "../db/seed.js";

describe("IMP-012: Inventory Items, UOMs, and Stock Adjustments", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
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
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        "SET LOCAL mill_ledger.bypass_immutability = 'on'",
      );
      await tx.stockMovement.deleteMany({
        where: { inventoryItem: { sku: { startsWith: "RM-TEST-" } } },
      });
      await tx.inventoryItem.deleteMany({
        where: { sku: { startsWith: "RM-TEST-" } },
      });
    });
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  async function loginAndGetCookie(email: string, password: string) {
    const res = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return res.headers.get("set-cookie") ?? "";
  }

  it("creates inventory item with opening balance movement and posts audited adjustment preventing negative stock", async () => {
    const adminCookie = await loginAndGetCookie(
      "admin@millledger.local",
      "AdminPassword123!",
    );

    const uom = await prisma.unitOfMeasure.findFirstOrThrow();

    const createRes = await fetch(`${baseUrl}/api/v1/inventory/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        
        sku: `RM-TEST-${Date.now()}`,
        name: "Test Sesame Seed",
        category: "RAW_MATERIAL",
        baseUomId: uom.id,
        openingStock: 25,
        openingUnitCost: 120,
      }),
    });
    expect(createRes.status).toBe(201);
    const { item } = (await createRes.json()) as {
      item: { id: string; currentStock: number };
    };
    expect(Number(item.currentStock)).toBe(25);

    // Positive adjustment (+5 -> 30)
    const adjOk = await fetch(`${baseUrl}/api/v1/inventory/adjustments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        
        inventoryItemId: item.id,
        quantity: 5,
        reason: "Found extra bag",
      }),
    });
    expect(adjOk.status).toBe(201);

    // Negative adjustment beyond stock (-50 -> -20) must fail with 400
    const adjNeg = await fetch(`${baseUrl}/api/v1/inventory/adjustments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        
        inventoryItemId: item.id,
        quantity: -50,
        reason: "Over-deduction test",
      }),
    });
    expect(adjNeg.status).toBe(400);
  });

  it("IMP-015: fetches purchase receipt detail and reverses unconsumed receipt atomically", async () => {
    const adminCookie = await loginAndGetCookie(
      "admin@millledger.local",
      "AdminPassword123!",
    );
    const org = await prisma.organization.findUniqueOrThrow({
      where: { code: "MILL" },
    });
    const warehouse = await prisma.warehouse.findFirstOrThrow({
      where: { code: "WH-1" },
    });
    const supplier = await prisma.supplier.findFirstOrThrow();
    const flour = await prisma.inventoryItem.findFirstOrThrow({
      where: { sku: "RM-FLOUR" },
    });

    const flourBefore = await prisma.inventoryItem.findFirstOrThrow({
      where: { sku: "RM-FLOUR" },
    });
    const initialStock = Number(flourBefore.currentStock);
    const initialWac = Number(flourBefore.weightedAverageCost);

    const prRes = await fetch(`${baseUrl}/api/v1/inventory/purchase-receipts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        organizationId: org.id,
        warehouseId: warehouse.id,
        supplierId: supplier.id,
        receiptNumber: `PR-REV-${Date.now()}`,
        items: [
          {
            inventoryItemId: flour.id,
            quantity: 10,
            uomId: flour.baseUomId,
            unitPrice: 50,
          },
        ],
      }),
    });
    expect(prRes.status).toBe(201);
    const created = (await prRes.json()) as { id: string };

    const detailRes = await fetch(
      `${baseUrl}/api/v1/inventory/purchase-receipts/${created.id}`,
      { headers: { Cookie: adminCookie } },
    );
    expect(detailRes.status).toBe(200);

    const revRes = await fetch(
      `${baseUrl}/api/v1/inventory/purchase-receipts/${created.id}/reverse`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: adminCookie,
        },
        body: JSON.stringify({ reason: "Duplicate test receipt" }),
      },
    );
    expect(revRes.status).toBe(200);

    const flourAfter = await prisma.inventoryItem.findFirstOrThrow({
      where: { sku: "RM-FLOUR" },
    });
    expect(Number(flourAfter.currentStock)).toBeCloseTo(initialStock, 4);
    expect(Number(flourAfter.weightedAverageCost)).toBeCloseTo(initialWac, 4);

    // Second reversal must be rejected
    const revAgain = await fetch(
      `${baseUrl}/api/v1/inventory/purchase-receipts/${created.id}/reverse`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: adminCookie,
        },
        body: JSON.stringify({ reason: "Second reversal attempt" }),
      },
    );
    expect(revAgain.status).toBe(400);
  });
});
