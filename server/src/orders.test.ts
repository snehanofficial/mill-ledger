import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { prisma } from "./db/client.js";
import { resetOperationalData } from "./db/reset.js";
import { seedBenchmarkMasters } from "./db/seed.js";
import { inventoryService } from "./modules/inventory/inventory.service.js";

describe("M5: Sales orders, ABAC scoping, shortages, and atomic stock reservations", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    // 1. Reset orders, reservations, runs, receipts and restore seed
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

  it("executes benchmark transactions 4, 5, and 6: salesman order creation, tax calculation, atomic reservation, and exact shortage 32", async () => {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { code: "MILL" },
    });
    const warehouse = await prisma.warehouse.findFirstOrThrow({
      where: { code: "WH-1" },
    });
    const retailerA = await prisma.customer.findFirstOrThrow({
      where: { code: "CUST-RET-A" },
    });
    const distributorB = await prisma.customer.findFirstOrThrow({
      where: { code: "CUST-DIST-B" },
    });
    const murukkuVariant = await prisma.productVariant.findFirstOrThrow({
      where: { sku: "VAR-MURUKKU-200G" },
    });
    const finishedGoodsItem = await prisma.inventoryItem.findFirstOrThrow({
      where: { sku: "FG-MURUKKU-200G" },
    });

    // Setup benchmark stock condition: Finished Goods stock is 238 packets (50 opening + 188 production)
    // Directly update finished goods currentStock to 238 to represent post-production state
    await prisma.inventoryItem.update({
      where: { id: finishedGoodsItem.id },
      data: { currentStock: 238 },
    });
    await prisma.stockMovement.create({
      data: {
        inventoryItemId: finishedGoodsItem.id,
        warehouseId: warehouse.id,
        movementType: "PRODUCTION_OUTPUT",
        quantity: 188,
        unitCost: 31.143617,
        totalCost: 5855,
        notes: "M4 benchmark run output",
      },
    });

    // Check available stock before any order: onHand = 238, reserved = 0, available = 238
    const initialBal = await inventoryService.getInventoryBalances(
      org.id,
      warehouse.id,
    );
    const fgInitial = initialBal.find((b) => b.sku === "FG-MURUKKU-200G");
    expect(fgInitial?.onHand).toBe(238);
    expect(fgInitial?.reserved).toBe(0);
    expect(fgInitial?.available).toBe(238);

    // Step 4: Salesman 1 submits Retailer A order for 150 packets in Tamil Nadu
    const salesman1Cookie = await loginAndGetCookie(
      "salesman1@millledger.local",
      "SalesmanPassword123!",
    );

    const orderPayload = {
      organizationId: org.id,
      customerId: retailerA.id,
      warehouseId: warehouse.id,
      orderNumber: "SO-BENCHMARK-001",
      notes: "Benchmark order 1: 150 packets for Retailer A",
      idempotencyKey: "idem-order-retailer-a-150",
      lines: [
        {
          productVariantId: murukkuVariant.id,
          quantity: 150,
          unitPrice: 50.0,
        },
      ],
    };

    const orderRes = await fetch(`${baseUrl}/api/v1/sales/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: salesman1Cookie,
      },
      body: JSON.stringify(orderPayload),
    });

    expect(orderRes.status).toBe(201);
    const orderData = (await orderRes.json()) as {
      order: {
        id: string;
        orderNumber: string;
        status: string;
        taxableAmount: string | number;
        cgstAmount: string | number;
        sgstAmount: string | number;
        igstAmount: string | number;
        totalTaxAmount: string | number;
        totalAmount: string | number;
      };
      shortages: Array<{ productVariantId: string; shortage: number }>;
    };

    const orderA = orderData.order;
    expect(orderA.status).toBe("SUBMITTED");

    // Tax calculation assertions per Benchmark:
    // Taxable invoice: ₹7,500
    // CGST (2.5%): ₹187.50
    // SGST (2.5%): ₹187.50
    // Total invoice: ₹7,875
    expect(Number(orderA.taxableAmount)).toBe(7500);
    expect(Number(orderA.cgstAmount)).toBe(187.5);
    expect(Number(orderA.sgstAmount)).toBe(187.5);
    expect(Number(orderA.igstAmount)).toBe(0);
    expect(Number(orderA.totalTaxAmount)).toBe(375);
    expect(Number(orderA.totalAmount)).toBe(7875);
    // No shortage on Retailer A order because 238 available >= 150 requested
    expect(orderData.shortages[0]?.shortage).toBe(0);

    // Step 5: Admin approves Retailer A order and reserves stock
    const adminCookie = await loginAndGetCookie(
      "admin@millledger.local",
      "AdminPassword123!",
    );

    const approveRes = await fetch(
      `${baseUrl}/api/v1/sales/orders/${orderA.id}/approve`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: adminCookie,
        },
        body: JSON.stringify({}),
      },
    );

    expect(approveRes.status).toBe(200);
    const approvedOrder = (await approveRes.json()) as {
      status: string;
      reservations: Array<{
        reservedQuantity: string | number;
        status: string;
      }>;
    };

    expect(approvedOrder.status).toBe("APPROVED");
    expect(approvedOrder.reservations.length).toBe(1);
    expect(Number(approvedOrder.reservations[0]?.reservedQuantity)).toBe(150);
    expect(approvedOrder.reservations[0]?.status).toBe("ACTIVE");

    // Check available stock after Retailer A reservation:
    // onHand = 238, reserved = 150, available = 88 packets!
    const postApproveBal = await inventoryService.getInventoryBalances(
      org.id,
      warehouse.id,
    );
    const fgAfterApprove = postApproveBal.find(
      (b) => b.sku === "FG-MURUKKU-200G",
    );
    expect(fgAfterApprove?.onHand).toBe(238);
    expect(fgAfterApprove?.reserved).toBe(150);
    expect(fgAfterApprove?.available).toBe(88);

    // Step 6: Salesman 2 submits Distributor B order for 120 packets in Karnataka
    // Exactly 32 shortage must be shown!
    const salesman2Cookie = await loginAndGetCookie(
      "salesman2@millledger.local",
      "SalesmanPassword123!",
    );

    const orderBPayload = {
      organizationId: org.id,
      customerId: distributorB.id,
      warehouseId: warehouse.id,
      orderNumber: "SO-BENCHMARK-002",
      notes: "Benchmark order 2: 120 packets for Distributor B (Karnataka)",
      idempotencyKey: "idem-order-distributor-b-120",
      lines: [
        {
          productVariantId: murukkuVariant.id,
          quantity: 120,
          unitPrice: 50.0,
        },
      ],
    };

    const orderBRes = await fetch(`${baseUrl}/api/v1/sales/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: salesman2Cookie,
      },
      body: JSON.stringify(orderBPayload),
    });

    expect(orderBRes.status).toBe(201);
    const orderBData = (await orderBRes.json()) as {
      order: {
        id: string;
        orderNumber: string;
        deliveryState: string;
        taxableAmount: string | number;
        igstAmount: string | number;
        cgstAmount: string | number;
      };
      shortages: Array<{ shortage: number }>;
    };

    // Inter-state tax calculation for Karnataka: IGST 5%
    expect(orderBData.order.deliveryState).toBe("Karnataka");
    expect(Number(orderBData.order.taxableAmount)).toBe(6000); // 120 * 50 = 6000
    expect(Number(orderBData.order.igstAmount)).toBe(300); // 5% IGST = 300
    expect(Number(orderBData.order.cgstAmount)).toBe(0);

    // Exact assertion: Distributor B shortage = 32 packets!
    // 120 requested - 88 available = 32
    expect(orderBData.shortages[0]?.shortage).toBe(32);

    // If Admin attempts to approve all 120 packets, system blocks with 400 Insufficient stock
    const overApproveRes = await fetch(
      `${baseUrl}/api/v1/sales/orders/${orderBData.order.id}/approve`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: adminCookie,
        },
        body: JSON.stringify({}),
      },
    );
    expect(overApproveRes.status).toBe(400);
    const errBody = (await overApproveRes.json()) as { error: string };
    expect(errBody.error).toContain("Insufficient stock");
    expect(errBody.error).toContain("Shortage: 32");
  });

  it("enforces ABAC boundaries: salesman customer assignments and cross-salesman visibility", async () => {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { code: "MILL" },
    });
    const distributorB = await prisma.customer.findFirstOrThrow({
      where: { code: "CUST-DIST-B" },
    });
    const murukkuVariant = await prisma.productVariant.findFirstOrThrow({
      where: { sku: "VAR-MURUKKU-200G" },
    });

    const salesman1Cookie = await loginAndGetCookie(
      "salesman1@millledger.local",
      "SalesmanPassword123!",
    );

    // 1. Salesman 1 attempts to order for Distributor B (assigned to Salesman 2) -> 403 Forbidden!
    const unassignedOrderRes = await fetch(`${baseUrl}/api/v1/sales/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: salesman1Cookie,
      },
      body: JSON.stringify({
        organizationId: org.id,
        customerId: distributorB.id,
        lines: [{ productVariantId: murukkuVariant.id, quantity: 10 }],
      }),
    });
    expect(unassignedOrderRes.status).toBe(403);

    // 2. Salesman 1 listing orders only sees their own orders
    const salesman1OrdersRes = await fetch(`${baseUrl}/api/v1/sales/orders`, {
      headers: { Cookie: salesman1Cookie },
    });
    expect(salesman1OrdersRes.status).toBe(200);
    const s1Body = (await salesman1OrdersRes.json()) as {
      orders: Array<{ salesmanId: string }>;
    };
    const s1User = await prisma.user.findUniqueOrThrow({
      where: { email: "salesman1@millledger.local" },
    });
    expect(s1Body.orders.every((o) => o.salesmanId === s1User.id)).toBe(true);

    // 3. Accountant cannot approve orders (403 Forbidden)
    const accountantCookie = await loginAndGetCookie(
      "accountant@millledger.local",
      "AccountantPassword123!",
    );
    const accountantApproveRes = await fetch(
      `${baseUrl}/api/v1/sales/orders/any-id/approve`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: accountantCookie,
        },
        body: JSON.stringify({}),
      },
    );
    expect(accountantApproveRes.status).toBe(403);
  });

  it("handles order rejection and cancels active reservations", async () => {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { code: "MILL" },
    });
    const retailerA = await prisma.customer.findFirstOrThrow({
      where: { code: "CUST-RET-A" },
    });
    const murukkuVariant = await prisma.productVariant.findFirstOrThrow({
      where: { sku: "VAR-MURUKKU-200G" },
    });

    const adminCookie = await loginAndGetCookie(
      "admin@millledger.local",
      "AdminPassword123!",
    );

    // Create a 20-packet order directly
    const createRes = await fetch(`${baseUrl}/api/v1/sales/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        organizationId: org.id,
        customerId: retailerA.id,
        orderNumber: "SO-TO-REJECT-001",
        lines: [{ productVariantId: murukkuVariant.id, quantity: 20 }],
      }),
    });
    expect(createRes.status).toBe(201);
    const createdData = (await createRes.json()) as { order: { id: string } };
    const orderId = createdData.order.id;

    // Approve the order (reserves 20 packets)
    const approveRes = await fetch(
      `${baseUrl}/api/v1/sales/orders/${orderId}/approve`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: adminCookie,
        },
        body: JSON.stringify({}),
      },
    );
    expect(approveRes.status).toBe(200);

    // Now reject the order
    const rejectRes = await fetch(
      `${baseUrl}/api/v1/sales/orders/${orderId}/reject`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: adminCookie,
        },
        body: JSON.stringify({ reason: "Customer requested cancellation" }),
      },
    );
    expect(rejectRes.status).toBe(200);
    const rejectedData = (await rejectRes.json()) as {
      status: string;
      rejectionReason: string;
    };
    expect(rejectedData.status).toBe("REJECTED");
    expect(rejectedData.rejectionReason).toBe(
      "Customer requested cancellation",
    );

    // Verify reservations are CANCELLED
    const reservations = await prisma.stockReservation.findMany({
      where: { salesOrderId: orderId },
    });
    expect(reservations.every((r) => r.status === "CANCELLED")).toBe(true);
  });

  it("F-017: blocks mass assignment of status in sales order creation payload (OWASP API3:2023)", async () => {
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
    const adminCookie = await loginAndGetCookie(
      "admin@millledger.local",
      "AdminPassword123!",
    );

    // 1. Salesman attempts to create order directly with status: "APPROVED" -> must be rejected with 400
    const massAssignSmRes = await fetch(`${baseUrl}/api/v1/sales/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: salesman1Cookie,
      },
      body: JSON.stringify({
        organizationId: org.id,
        customerId: retailerA.id,
        status: "APPROVED",
        notes: "Malicious pre-approved order bypass",
        lines: [{ productVariantId: murukkuVariant.id, quantity: 5 }],
      }),
    });
    expect(massAssignSmRes.status).toBe(400);
    const smErr = (await massAssignSmRes.json()) as { error?: string; message?: string };
    expect(smErr.error || smErr.message).toBeDefined();

    // 2. Admin attempts to create order directly with status: "APPROVED" -> must also be rejected with 400
    const massAssignAdminRes = await fetch(`${baseUrl}/api/v1/sales/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        organizationId: org.id,
        customerId: retailerA.id,
        status: "APPROVED",
        notes: "Admin direct creation without ATP check",
        lines: [{ productVariantId: murukkuVariant.id, quantity: 5 }],
      }),
    });
    expect(massAssignAdminRes.status).toBe(400);

    // 3. Salesman attempts to create order with arbitrary status: "DISPATCHED" -> 400
    const dispatchedStatusRes = await fetch(`${baseUrl}/api/v1/sales/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: salesman1Cookie,
      },
      body: JSON.stringify({
        organizationId: org.id,
        customerId: retailerA.id,
        status: "DISPATCHED",
        lines: [{ productVariantId: murukkuVariant.id, quantity: 5 }],
      }),
    });
    expect(dispatchedStatusRes.status).toBe(400);

    // 4. Legitimate creation with status: "DRAFT" is permitted
    const draftRes = await fetch(`${baseUrl}/api/v1/sales/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: salesman1Cookie,
      },
      body: JSON.stringify({
        organizationId: org.id,
        customerId: retailerA.id,
        status: "DRAFT",
        lines: [{ productVariantId: murukkuVariant.id, quantity: 5 }],
      }),
    });
    expect(draftRes.status).toBe(201);
    const draftData = (await draftRes.json()) as { order: { status: string } };
    expect(draftData.order.status).toBe("DRAFT");

    // 5. Creation without status defaults to "SUBMITTED"
    const defaultRes = await fetch(`${baseUrl}/api/v1/sales/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: salesman1Cookie,
      },
      body: JSON.stringify({
        organizationId: org.id,
        customerId: retailerA.id,
        lines: [{ productVariantId: murukkuVariant.id, quantity: 5 }],
      }),
    });
    expect(defaultRes.status).toBe(201);
    const defaultData = (await defaultRes.json()) as { order: { status: string } };
    expect(defaultData.order.status).toBe("SUBMITTED");
  });
});
