import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { EntityTimelineResponse } from "@mill-ledger/shared";
import { createApp } from "../app.js";
import { prisma } from "../db/client.js";
import { resetOperationalData } from "../db/reset.js";
import { seedBenchmarkMasters } from "../db/seed.js";
import { financeService } from "../modules/finance/finance.service.js";
import { paymentService } from "../modules/finance/payment.service.js";
import { productionService } from "../modules/production/production.service.js";
import { mastersService } from "../modules/masters/masters.service.js";

describe("Unified Entity 360° Lifecycle Timeline", () => {
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

  it("aggregates Order -> Invoice -> Payment lifecycle, excludes unrelated orders, enforces RBAC/ABAC, and paginates", async () => {
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
    const variant = await prisma.productVariant.findFirstOrThrow({
      where: { sku: "VAR-MURUKKU-200G" },
      include: { product: true },
    });
    const fgItem = await prisma.inventoryItem.findFirstOrThrow({
      where: { sku: "FG-MURUKKU-200G" },
    });

    const adminUser = await prisma.user.findFirstOrThrow({
      where: { email: "admin@millledger.local" },
    });

    // Ensure enough finished stock for orders
    await prisma.inventoryItem.update({
      where: { id: fgItem.id },
      data: { currentStock: 500 },
    });
    await prisma.warehouseStockBalance.upsert({
      where: {
        warehouseId_inventoryItemId: {
          warehouseId: warehouse.id,
          inventoryItemId: fgItem.id,
        },
      },
      update: { onHand: 500 },
      create: {
        organizationId: org.id,
        warehouseId: warehouse.id,
        inventoryItemId: fgItem.id,
        onHand: 500,
        reserved: 0,
      },
    });

    const adminCookie = await loginAndGetCookie("admin@millledger.local", "AdminPassword123!");
    const salesmanCookie = await loginAndGetCookie("salesman1@millledger.local", "SalesmanPassword123!");
    const productionCookie = await loginAndGetCookie("production@millledger.local", "ProductionPassword123!");

    // 1. Salesman creates a DRAFT order for Retailer A, modifies it, submits it
    const createOrderRes = await fetch(`${baseUrl}/api/v1/sales/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: salesmanCookie,
      },
      body: JSON.stringify({
        customerId: retailerA.id,
        warehouseId: warehouse.id,
        status: "DRAFT",
        notes: "Initial draft",
        lines: [
          {
            productVariantId: variant.id,
            quantity: 10,
            unitPrice: 100,
          },
        ],
      }),
    });
    expect(createOrderRes.status).toBe(201);
    const createdOrderBody = (await createOrderRes.json()) as {
      order: { id: string; orderNumber: string };
    };
    const order1Id = createdOrderBody.order.id;

    // Submit draft order
    const submitRes = await fetch(`${baseUrl}/api/v1/sales/orders/${order1Id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: salesmanCookie,
      },
      body: JSON.stringify({
        status: "SUBMITTED",
        notes: "Ready for approval",
      }),
    });
    expect(submitRes.status).toBe(200);

    // Admin approves order 1
    const approveRes = await fetch(`${baseUrl}/api/v1/sales/orders/${order1Id}/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({}),
    });
    expect(approveRes.status).toBe(200);

    // 2. Admin posts invoice from order 1
    const adminCtx = {
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: "ADMIN" as const,
      isActive: true,
      organizationId: org.id,
    };
    const invoice1 = await financeService.createInvoiceFromOrder(
      { salesOrderId: order1Id },
      adminCtx,
    );
    expect(invoice1).toBeTruthy();

    // 3. Admin records payment & allocates to invoice 1
    const payment1 = await paymentService.recordPayment(
      {
        customerId: retailerA.id,
        amount: 500,
        paymentMode: "BANK_TRANSFER",
        referenceNumber: "UTR-TL-001",
        allocations: [
          { salesInvoiceId: invoice1!.id, amount: 500 },
        ],
      },
      adminCtx,
    );
    expect(payment1).toBeTruthy();

    // 4. Create an unrelated second order + invoice + payment for Distributor B
    const order2Res = await fetch(`${baseUrl}/api/v1/sales/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        customerId: distributorB.id,
        warehouseId: warehouse.id,
        lines: [
          {
            productVariantId: variant.id,
            quantity: 5,
            unitPrice: 100,
          },
        ],
      }),
    });
    expect(order2Res.status).toBe(201);
    const order2Body = (await order2Res.json()) as {
      order: { id: string; orderNumber: string };
    };
    const order2Id = order2Body.order.id;

    // 5. Verify Order 1 timeline as Admin
    const orderTimelineRes = await fetch(
      `${baseUrl}/api/v1/timeline/order/${order1Id}?limit=50`,
      { headers: { Cookie: adminCookie } },
    );
    expect(orderTimelineRes.status).toBe(200);
    const orderTimeline = (await orderTimelineRes.json()) as EntityTimelineResponse;

    const eventTypes = orderTimeline.events.map((e) => e.eventType);
    expect(eventTypes).toContain("ORDER_CREATED");
    expect(eventTypes).toContain("ORDER_SUBMITTED");
    expect(eventTypes).toContain("ORDER_APPROVED");
    expect(eventTypes).toContain("INVOICE_POSTED");
    expect(eventTypes).toContain("PAYMENT_ALLOCATED");

    // No duplicate IDs
    const ids = orderTimeline.events.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);

    // Unrelated order 2 must not appear in order 1's timeline
    expect(orderTimeline.events.some((e) => e.originEntityId === order2Id)).toBe(false);

    // 6. Verify RBAC on Order 1 timeline for SALESMAN (must NOT see SalesInvoice or Payment events)
    const salesmanOrderTlRes = await fetch(
      `${baseUrl}/api/v1/timeline/order/${order1Id}`,
      { headers: { Cookie: salesmanCookie } },
    );
    expect(salesmanOrderTlRes.status).toBe(200);
    const salesmanOrderTl = (await salesmanOrderTlRes.json()) as EntityTimelineResponse;
    expect(
      salesmanOrderTl.events.some(
        (e) => e.originEntityType === "SalesInvoice" || e.originEntityType === "Payment",
      ),
    ).toBe(false);

    // Salesman cannot view order 2 (created by Admin for Distributor B)
    const salesmanOrder2Res = await fetch(
      `${baseUrl}/api/v1/timeline/order/${order2Id}`,
      { headers: { Cookie: salesmanCookie } },
    );
    expect(salesmanOrder2Res.status).toBe(403);

    // Production user cannot view order timeline
    const prodOrderRes = await fetch(
      `${baseUrl}/api/v1/timeline/order/${order1Id}`,
      { headers: { Cookie: productionCookie } },
    );
    expect(prodOrderRes.status).toBe(403);

    // 7. Verify Invoice 1 timeline
    const invTlRes = await fetch(
      `${baseUrl}/api/v1/timeline/invoice/${invoice1!.id}`,
      { headers: { Cookie: adminCookie } },
    );
    expect(invTlRes.status).toBe(200);
    const invTl = (await invTlRes.json()) as EntityTimelineResponse;
    expect(invTl.events.some((e) => e.originEntityType === "SalesOrder")).toBe(true);
    expect(invTl.events.some((e) => e.originEntityType === "Payment")).toBe(true);

    // 8. Verify Payment 1 timeline distinguishes creation and allocation
    const payTlRes = await fetch(
      `${baseUrl}/api/v1/timeline/payment/${payment1!.id}`,
      { headers: { Cookie: adminCookie } },
    );
    expect(payTlRes.status).toBe(200);
    const payTl = (await payTlRes.json()) as EntityTimelineResponse;
    expect(payTl.events.some((e) => e.eventType === "PAYMENT_RECORDED")).toBe(true);
    expect(payTl.events.some((e) => e.eventType === "PAYMENT_ALLOCATED")).toBe(true);

    // 9. Verify Customer timeline + pagination
    const custTlRes = await fetch(
      `${baseUrl}/api/v1/timeline/customer/${retailerA.id}?limit=2&offset=0`,
      { headers: { Cookie: adminCookie } },
    );
    expect(custTlRes.status).toBe(200);
    const custTl = (await custTlRes.json()) as EntityTimelineResponse;
    expect(custTl.events.length).toBe(2);
    expect(custTl.pagination.total).toBeGreaterThan(2);
    expect(custTl.pagination.hasMore).toBe(true);

    // 10. Verify Product & Recipe timelines
    await mastersService.updateProduct(
      variant.product.id,
      { name: `${variant.product.name} Updated` },
      adminCtx,
    );
    const prodTlRes = await fetch(
      `${baseUrl}/api/v1/timeline/product/${variant.product.id}`,
      { headers: { Cookie: adminCookie } },
    );
    expect(prodTlRes.status).toBe(200);
    const prodTl = (await prodTlRes.json()) as EntityTimelineResponse;
    expect(prodTl.events.some((e) => e.eventType === "PRODUCT_UPDATED")).toBe(true);

    const recipe = await prisma.recipe.findFirstOrThrow({
      where: { productVariantId: variant.id },
    });
    const cloned = await productionService.createRecipeVersion(
      recipe.id,
      { name: `${recipe.name} Rev` },
      adminCtx,
    );
    const recipeTlRes = await fetch(
      `${baseUrl}/api/v1/timeline/recipe/${cloned.id}`,
      { headers: { Cookie: productionCookie } },
    );
    expect(recipeTlRes.status).toBe(200);
    const recipeTl = (await recipeTlRes.json()) as EntityTimelineResponse;
    expect(recipeTl.events.some((e) => e.eventType === "RECIPE_VERSION_CREATED")).toBe(true);
  });
});
