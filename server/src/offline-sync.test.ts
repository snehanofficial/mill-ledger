import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { createApp } from "./app.js";
import { prisma } from "./db/client.js";
import { resetOperationalData } from "./db/reset.js";
import { seedBenchmarkMasters } from "./db/seed.js";
import { inventoryService } from "./modules/inventory/inventory.service.js";

describe("M9: Offline synchronization and idempotency verification", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    // Clean up dependent records in proper foreign key order
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

  it("verifies salesman customer scoping for offline snapshots", async () => {
    const salesman1Cookie = await loginAndGetCookie(
      "salesman1@millledger.local",
      "SalesmanPassword123!",
    );
    const salesman2Cookie = await loginAndGetCookie(
      "salesman2@millledger.local",
      "SalesmanPassword123!",
    );
    const adminCookie = await loginAndGetCookie(
      "admin@millledger.local",
      "AdminPassword123!",
    );

    // Salesman 1 should only receive Retailer A
    const res1 = await fetch(`${baseUrl}/api/v1/sales/customers`, {
      headers: { Cookie: salesman1Cookie },
    });
    expect(res1.status).toBe(200);
    const data1 = (await res1.json()) as { customers: Array<{ code: string }> };
    expect(data1.customers.length).toBe(1);
    expect(data1.customers[0].code).toBe("CUST-RET-A");

    // Salesman 2 should only receive Distributor B
    const res2 = await fetch(`${baseUrl}/api/v1/sales/customers`, {
      headers: { Cookie: salesman2Cookie },
    });
    expect(res2.status).toBe(200);
    const data2 = (await res2.json()) as { customers: Array<{ code: string }> };
    expect(data2.customers.length).toBe(1);
    expect(data2.customers[0].code).toBe("CUST-DIST-B");

    // Admin should receive both customers
    const resAdmin = await fetch(`${baseUrl}/api/v1/sales/customers`, {
      headers: { Cookie: adminCookie },
    });
    expect(resAdmin.status).toBe(200);
    const dataAdmin = (await resAdmin.json()) as {
      customers: Array<{ code: string }>;
    };
    expect(dataAdmin.customers.length).toBeGreaterThanOrEqual(2);
    const codes = dataAdmin.customers.map((c) => c.code);
    expect(codes).toContain("CUST-RET-A");
    expect(codes).toContain("CUST-DIST-B");
  });

  it("verifies product and price snapshot endpoint for offline cache", async () => {
    const salesman1Cookie = await loginAndGetCookie(
      "salesman1@millledger.local",
      "SalesmanPassword123!",
    );

    const res = await fetch(`${baseUrl}/api/v1/sales/products`, {
      headers: { Cookie: salesman1Cookie },
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      products: Array<{
        sku: string;
        name: string;
        taxRate: number;
        uom: string;
        defaultPrice: number;
      }>;
    };

    expect(data.products.length).toBeGreaterThan(0);
    const murukku = data.products.find((p) => p.sku === "VAR-MURUKKU-200G");
    expect(murukku).toBeDefined();
    expect(murukku?.defaultPrice).toBe(50.0);
    expect(murukku?.taxRate).toBe(5.0);
    expect(murukku?.uom).toBe("PACKET");
  });

  it("verifies exactly once order creation with idempotency key replay", async () => {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { code: "MILL" },
    });
    const retailerA = await prisma.customer.findFirstOrThrow({
      where: { code: "CUST-RET-A" },
    });
    const murukkuVariant = await prisma.productVariant.findFirstOrThrow({
      where: { sku: "VAR-MURUKKU-200G" },
    });

    const salesman1Cookie = await loginAndGetCookie(
      "salesman1@millledger.local",
      "SalesmanPassword123!",
    );

    const idempotencyKey = "idem-replay-test-001";
    const payload = {
      organizationId: org.id,
      customerId: retailerA.id,
      orderNumber: "SO-OFFLINE-REPLAY-1",
      notes: "Offline sync idempotency test",
      idempotencyKey,
      lines: [
        {
          productVariantId: murukkuVariant.id,
          quantity: 25,
          unitPrice: 50.0,
        },
      ],
    };

    // First submission
    const res1 = await fetch(`${baseUrl}/api/v1/sales/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: salesman1Cookie,
      },
      body: JSON.stringify(payload),
    });
    expect(res1.status).toBe(201);
    const orderData1 = (await res1.json()) as {
      order: { id: string; orderNumber: string };
    };
    expect(orderData1.order.id).toBeDefined();

    // Replay with identical idempotency key (simulating network retry after client disconnect)
    const res2 = await fetch(`${baseUrl}/api/v1/sales/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: salesman1Cookie,
      },
      body: JSON.stringify(payload),
    });
    expect(res2.status).toBe(201);
    const orderData2 = (await res2.json()) as {
      order: { id: string; orderNumber: string };
    };

    // Verifies that replayed request returned the exact same order without duplication
    expect(orderData2.order.id).toBe(orderData1.order.id);
    expect(orderData2.order.orderNumber).toBe(orderData1.order.orderNumber);

    // Verify exactly one order exists in database with this idempotency key
    const count = await prisma.salesOrder.count({
      where: { idempotencyKey },
    });
    expect(count).toBe(1);
  });

  it("detects and rejects sync conflict when salesman attempts order for unassigned customer", async () => {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { code: "MILL" },
    });
    const distributorB = await prisma.customer.findFirstOrThrow({
      where: { code: "CUST-DIST-B" },
    });
    const murukkuVariant = await prisma.productVariant.findFirstOrThrow({
      where: { sku: "VAR-MURUKKU-200G" },
    });

    // Salesman 1 is not assigned to Distributor B
    const salesman1Cookie = await loginAndGetCookie(
      "salesman1@millledger.local",
      "SalesmanPassword123!",
    );

    const conflictPayload = {
      organizationId: org.id,
      customerId: distributorB.id,
      orderNumber: "SO-OFFLINE-CONFLICT-1",
      notes: "Conflict test",
      idempotencyKey: "idem-conflict-test-001",
      lines: [
        {
          productVariantId: murukkuVariant.id,
          quantity: 10,
          unitPrice: 50.0,
        },
      ],
    };

    const res = await fetch(`${baseUrl}/api/v1/sales/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: salesman1Cookie,
      },
      body: JSON.stringify(conflictPayload),
    });

    expect(res.status).toBe(403);
    const errorData = (await res.json()) as {
      message?: string;
    };
    expect(errorData.message ?? "").toContain("Salesman is not assigned");
  });

  it("verifies that offline orders do not create fake reservations before server acceptance and approval", async () => {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { code: "MILL" },
    });
    const warehouse = await prisma.warehouse.findFirstOrThrow({
      where: { code: "WH-1" },
    });
    const finishedGoodsItem = await prisma.inventoryItem.findFirstOrThrow({
      where: { sku: "FG-MURUKKU-200G" },
    });

    // Reset stock to 100 packets
    await prisma.inventoryItem.update({
      where: { id: finishedGoodsItem.id },
      data: { currentStock: 100 },
    });

    const balances = await inventoryService.getInventoryBalances(
      org.id,
      warehouse.id,
    );
    const fg = balances.find((b) => b.sku === "FG-MURUKKU-200G");
    expect(fg?.available).toBe(100);
    expect(fg?.reserved).toBe(0);

    // Queued or draft orders do not touch reservations
    // Reservations are only created upon explicit admin approval on the server
    const activeReservations = await prisma.stockReservation.count({
      where: {
        inventoryItemId: finishedGoodsItem.id,
        status: "ACTIVE",
      },
    });
    expect(activeReservations).toBe(0);
  });
});
