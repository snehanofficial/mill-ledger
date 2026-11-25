import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { prisma } from "../db/client.js";
import { resetOperationalData } from "../db/reset.js";
import { seedBenchmarkMasters } from "../db/seed.js";

describe("M3: Purchases and inventory ledger integration", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    // Reset test receipts and restore benchmark opening balances
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

  it("executes benchmark transaction 1: purchase 60 kg flour at ₹45/kg and reconciles ledger", async () => {
    // 1. Fetch required master records
    const org = await prisma.organization.findUniqueOrThrow({
      where: { code: "MILL" },
    });
    const supplier = await prisma.supplier.findFirstOrThrow({
      where: { code: "SUP-FLOUR-1" },
    });
    const warehouse = await prisma.warehouse.findFirstOrThrow({
      where: { code: "WH-1" },
    });
    const flour = await prisma.inventoryItem.findFirstOrThrow({
      where: { sku: "RM-FLOUR" },
    });
    const kgUom = await prisma.unitOfMeasure.findFirstOrThrow({
      where: { code: "KG" },
    });

    const adminCookie = await loginAndGetCookie(
      "admin@millledger.local",
      "AdminPassword123!",
    );

    // Initial check: flour opening stock is 100 kg at ₹42
    expect(Number(flour.currentStock)).toBe(100);
    expect(Number(flour.weightedAverageCost)).toBe(42);

    // 2. Post purchase receipt: 60 kg at ₹45/kg
    const receiptPayload = {
      organizationId: org.id,
      supplierId: supplier.id,
      warehouseId: warehouse.id,
      receiptNumber: "PR-BENCHMARK-001",
      supplierInvoiceNumber: "INV-MAGRO-8821",
      notes: "Benchmark step 1: 60 kg flour purchase",
      idempotencyKey: "idemp-purchase-flour-60kg-001",
      items: [
        {
          inventoryItemId: flour.id,
          quantity: 60,
          uomId: kgUom.id,
          unitPrice: 45,
        },
      ],
    };

    const response = await fetch(
      `${baseUrl}/api/v1/inventory/purchase-receipts`,
      {
        method: "POST",
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(receiptPayload),
      },
    );

    expect(response.status).toBe(201);
    const receipt = await response.json();
    expect(receipt.receiptNumber).toBe("PR-BENCHMARK-001");
    expect(Number(receipt.totalAmount)).toBe(2700);

    // 3. Verify updated inventory item balances
    const updatedFlour = await prisma.inventoryItem.findUniqueOrThrow({
      where: { id: flour.id },
    });

    // Stock must be exactly 160 kg (100 opening + 60 purchase)
    expect(Number(updatedFlour.currentStock)).toBe(160);

    // Weighted average cost calculation:
    // (100 * 42 + 60 * 45) / 160 = (4200 + 2700) / 160 = 6900 / 160 = 43.125
    expect(Number(updatedFlour.weightedAverageCost)).toBe(43.125);

    // 4. Verify stock movement ledger entry
    const movements = await prisma.stockMovement.findMany({
      where: { inventoryItemId: flour.id },
      orderBy: { postedAt: "asc" },
    });

    expect(movements.length).toBe(2); // Opening balance + Purchase receipt
    expect(movements[0].movementType).toBe("OPENING_BALANCE");
    expect(Number(movements[0].quantity)).toBe(100);

    expect(movements[1].movementType).toBe("PURCHASE_RECEIPT");
    expect(Number(movements[1].quantity)).toBe(60);
    expect(Number(movements[1].unitCost)).toBe(45);
    expect(Number(movements[1].totalCost)).toBe(2700);
    expect(movements[1].referenceDocumentId).toBe(receipt.id);

    // 5. Test deterministic ledger reconciliation query
    const balancesResponse = await fetch(
      `${baseUrl}/api/v1/inventory/balances?organizationId=${org.id}`,
      {
        headers: { Cookie: adminCookie },
      },
    );

    expect(balancesResponse.status).toBe(200);
    const balancesData = await balancesResponse.json();
    const flourBalance = balancesData.balances.find(
      (b: any) => b.sku === "RM-FLOUR",
    );

    expect(flourBalance).toBeDefined();
    expect(flourBalance.onHand).toBe(160);
    expect(flourBalance.ledgerSum).toBe(160);
    expect(flourBalance.reconciled).toBe(true);
    expect(flourBalance.weightedAverageCost).toBe(43.125);

    // 6. Test item ledger endpoint
    const ledgerResponse = await fetch(
      `${baseUrl}/api/v1/inventory/items/${flour.id}/ledger`,
      {
        headers: { Cookie: adminCookie },
      },
    );

    expect(ledgerResponse.status).toBe(200);
    const ledgerData = await ledgerResponse.json();
    expect(ledgerData.ledger.length).toBe(2);
    expect(ledgerData.ledger[0].runningBalance).toBe(100);
    expect(ledgerData.ledger[1].runningBalance).toBe(160);
  });

  it("enforces idempotency: duplicate purchase receipt submission does not double count stock", async () => {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { code: "MILL" },
    });
    const supplier = await prisma.supplier.findFirstOrThrow({
      where: { code: "SUP-FLOUR-1" },
    });
    const warehouse = await prisma.warehouse.findFirstOrThrow({
      where: { code: "WH-1" },
    });
    const flour = await prisma.inventoryItem.findFirstOrThrow({
      where: { sku: "RM-FLOUR" },
    });
    const kgUom = await prisma.unitOfMeasure.findFirstOrThrow({
      where: { code: "KG" },
    });

    const adminCookie = await loginAndGetCookie(
      "admin@millledger.local",
      "AdminPassword123!",
    );

    const initialStock = Number(flour.currentStock);

    // Replay identical receipt with same idempotencyKey
    const duplicatePayload = {
      organizationId: org.id,
      supplierId: supplier.id,
      warehouseId: warehouse.id,
      receiptNumber: "PR-BENCHMARK-001",
      notes: "Duplicate submission attempt",
      idempotencyKey: "idemp-purchase-flour-60kg-001",
      items: [
        {
          inventoryItemId: flour.id,
          quantity: 60,
          uomId: kgUom.id,
          unitPrice: 45,
        },
      ],
    };

    const response = await fetch(
      `${baseUrl}/api/v1/inventory/purchase-receipts`,
      {
        method: "POST",
        headers: {
          Cookie: adminCookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(duplicatePayload),
      },
    );

    expect(response.status).toBe(201);

    // Stock must remain unchanged at initialStock without double addition
    const freshFlour = await prisma.inventoryItem.findUniqueOrThrow({
      where: { id: flour.id },
    });
    expect(Number(freshFlour.currentStock)).toBe(initialStock);
  });

  it("prevents salesman from posting purchase receipts (role denial)", async () => {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { code: "MILL" },
    });
    const supplier = await prisma.supplier.findFirstOrThrow({
      where: { code: "SUP-FLOUR-1" },
    });
    const warehouse = await prisma.warehouse.findFirstOrThrow({
      where: { code: "WH-1" },
    });
    const flour = await prisma.inventoryItem.findFirstOrThrow({
      where: { sku: "RM-FLOUR" },
    });
    const kgUom = await prisma.unitOfMeasure.findFirstOrThrow({
      where: { code: "KG" },
    });

    const salesmanCookie = await loginAndGetCookie(
      "salesman1@millledger.local",
      "SalesmanPassword123!",
    );

    const response = await fetch(
      `${baseUrl}/api/v1/inventory/purchase-receipts`,
      {
        method: "POST",
        headers: {
          Cookie: salesmanCookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          organizationId: org.id,
          supplierId: supplier.id,
          warehouseId: warehouse.id,
          receiptNumber: "PR-ILLEGAL-001",
          items: [
            {
              inventoryItemId: flour.id,
              quantity: 10,
              uomId: kgUom.id,
              unitPrice: 45,
            },
          ],
        }),
      },
    );

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.message).toContain(
      "Forbidden: Role SALESMAN lacks permission create on purchase",
    );
  });

  it("F-021: prevents exposure of item movement ledger under /api/v1/purchase-receipts and enforces purchase permission scoping (OWASP A01:2021 & API5:2023)", async () => {
    const flour = await prisma.inventoryItem.findFirstOrThrow({
      where: { sku: "RM-FLOUR" },
    });

    const salesmanCookie = await loginAndGetCookie(
      "salesman1@millledger.local",
      "SalesmanPassword123!",
    );

    const adminCookie = await loginAndGetCookie(
      "admin@millledger.local",
      "AdminPassword123!",
    );

    // 1. Salesman attempting to read item movement ledger under /api/v1/purchase-receipts is denied (HTTP 403 Forbidden)
    const salesmanLedgerRes = await fetch(
      `${baseUrl}/api/v1/purchase-receipts/items/${flour.id}/ledger`,
      {
        headers: { Cookie: salesmanCookie },
      },
    );
    expect(salesmanLedgerRes.status).toBe(403);
    const salesmanLedgerErr = await salesmanLedgerRes.json();
    expect(salesmanLedgerErr.message).toContain(
      "Forbidden: Role SALESMAN lacks permission read on purchase",
    );

    // 2. Salesman attempting to list purchase receipts under /api/v1/purchase-receipts is denied (HTTP 403 Forbidden)
    const salesmanListRes = await fetch(
      `${baseUrl}/api/v1/purchase-receipts`,
      {
        headers: { Cookie: salesmanCookie },
      },
    );
    expect(salesmanListRes.status).toBe(403);

    // 3. Salesman attempting to create purchase receipt under /api/v1/purchase-receipts is denied (HTTP 403 Forbidden)
    const salesmanPostRes = await fetch(
      `${baseUrl}/api/v1/purchase-receipts`,
      {
        method: "POST",
        headers: {
          Cookie: salesmanCookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ receiptNumber: "ILLEGAL" }),
      },
    );
    expect(salesmanPostRes.status).toBe(403);

    // 4. Admin querying non-existent ledger route on /api/v1/purchase-receipts gets HTTP 404 (separation of concerns: ledger is not a purchase-receipts route)
    const adminLedgerRes = await fetch(
      `${baseUrl}/api/v1/purchase-receipts/items/${flour.id}/ledger`,
      {
        headers: { Cookie: adminCookie },
      },
    );
    expect(adminLedgerRes.status).toBe(404);

    // 5. Admin can access purchase receipts list under /api/v1/purchase-receipts (HTTP 200)
    const adminListRes = await fetch(
      `${baseUrl}/api/v1/purchase-receipts`,
      {
        headers: { Cookie: adminCookie },
      },
    );
    expect(adminListRes.status).toBe(200);
    const adminListData = await adminListRes.json();
    expect(adminListData.receipts).toBeDefined();

    // 6. Authorized inventory ledger access remains intact under official /api/v1/inventory prefix (HTTP 200)
    const officialInventoryLedgerRes = await fetch(
      `${baseUrl}/api/v1/inventory/items/${flour.id}/ledger`,
      {
        headers: { Cookie: adminCookie },
      },
    );
    expect(officialInventoryLedgerRes.status).toBe(200);
    const officialInventoryLedgerData = await officialInventoryLedgerRes.json();
    expect(officialInventoryLedgerData.ledger).toBeDefined();
  });
});
