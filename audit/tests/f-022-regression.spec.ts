import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../server/src/app.js";
import { prisma } from "../../server/src/db/client.js";

describe("F-022 Regression Test: Audit Logging Across Operational Mutations", () => {
  let server: Server;
  let baseUrl: string;
  let adminCookie: string;
  let adminUserId: string;

  beforeAll(async () => {
    const app = createApp();
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;

    // Login as admin
    const loginRes = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@millledger.local",
        password: "AdminPassword123!",
      }),
    });
    adminCookie = loginRes.headers.get("set-cookie") ?? "";

    const user = await prisma.user.findUnique({
      where: { email: "admin@millledger.local" },
    });
    adminUserId = user?.id ?? "";
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("records audit log when a customer is created and updated", async () => {
    const org = await prisma.organization.findFirstOrThrow();
    const testCode = `CUST-AUDIT-${Date.now()}`;

    // 1. Create customer
    const createRes = await fetch(`${baseUrl}/api/v1/sales/customers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        organizationId: org.id,
        code: testCode,
        name: "Audit Test Customer",
        state: "Tamil Nadu",
        gstin: "33AABCM1234F1Z1",
      }),
    });
    expect(createRes.status).toBe(201);
    const createdData = (await createRes.json()) as { status: string; customer: { id: string } };
    const custId = createdData.customer.id;

    const createLog = await prisma.auditLog.findFirst({
      where: {
        entity: "Customer",
        entityId: custId,
        action: "CREATE",
      },
    });
    expect(createLog).not.toBeNull();
    expect(createLog?.userId).toBe(adminUserId);
    expect(createLog?.details).toContain(testCode);

    // 2. Update customer
    const updateRes = await fetch(
      `${baseUrl}/api/v1/sales/customers/${custId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          name: "Audit Test Customer Renamed",
        }),
      },
    );
    expect(updateRes.status).toBe(200);

    const updateLog = await prisma.auditLog.findFirst({
      where: {
        entity: "Customer",
        entityId: custId,
        action: "UPDATE",
      },
    });
    expect(updateLog).not.toBeNull();
    expect(updateLog?.userId).toBe(adminUserId);
    expect(updateLog?.details).toContain("Audit Test Customer Renamed");
  });

  it("records audit log across sales order lifecycle: create, update, approve, and reject", async () => {
    const customer = await prisma.customer.findFirstOrThrow();
    const variant = await prisma.productVariant.findFirstOrThrow({
      where: { sku: "VAR-MURUKKU-200G" },
    });

    // 1. Create sales order
    const createRes = await fetch(`${baseUrl}/api/v1/sales/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        customerId: customer.id,
        status: "DRAFT",
        notes: "Initial audit test note",
        lines: [{ productVariantId: variant.id, quantity: 2 }],
      }),
    });
    expect(createRes.status).toBe(201);
    const createData = (await createRes.json()) as { order: { id: string; orderNumber: string } };
    const orderId = createData.order.id;

    const createOrderLog = await prisma.auditLog.findFirst({
      where: {
        entity: "SalesOrder",
        entityId: orderId,
        action: "CREATE",
      },
    });
    expect(createOrderLog).not.toBeNull();
    expect(createOrderLog?.userId).toBe(adminUserId);
    expect(createOrderLog?.details).toContain(createData.order.orderNumber);

    // 2. Update draft order
    const updateRes = await fetch(`${baseUrl}/api/v1/sales/orders/${orderId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        notes: "Updated note for audit test",
      }),
    });
    expect(updateRes.status).toBe(200);

    const updateOrderLog = await prisma.auditLog.findFirst({
      where: {
        entity: "SalesOrder",
        entityId: orderId,
        action: "UPDATE",
      },
    });
    expect(updateOrderLog).not.toBeNull();
    expect(updateOrderLog?.userId).toBe(adminUserId);
    expect(updateOrderLog?.details).toContain("Updated note for audit test");

    // 3. Reject order
    const rejectRes = await fetch(`${baseUrl}/api/v1/sales/orders/${orderId}/reject`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        reason: "Audit test order cancellation",
      }),
    });
    expect(rejectRes.status).toBe(200);

    const rejectOrderLog = await prisma.auditLog.findFirst({
      where: {
        entity: "SalesOrder",
        entityId: orderId,
        action: "REJECT",
      },
    });
    expect(rejectOrderLog).not.toBeNull();
    expect(rejectOrderLog?.userId).toBe(adminUserId);
    expect(rejectOrderLog?.reason).toBe("Audit test order cancellation");

    // 4. Create another order and approve it
    const approveOrderRes = await fetch(`${baseUrl}/api/v1/sales/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        customerId: customer.id,
        status: "SUBMITTED",
        lines: [{ productVariantId: variant.id, quantity: 1 }],
      }),
    });
    expect(approveOrderRes.status).toBe(201);
    const approveData = (await approveOrderRes.json()) as { order: { id: string } };
    const orderToApproveId = approveData.order.id;

    const approveRes = await fetch(`${baseUrl}/api/v1/sales/orders/${orderToApproveId}/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({}),
    });
    expect(approveRes.status).toBe(200);

    const approveOrderLog = await prisma.auditLog.findFirst({
      where: {
        entity: "SalesOrder",
        entityId: orderToApproveId,
        action: "APPROVE",
      },
    });
    expect(approveOrderLog).not.toBeNull();
    expect(approveOrderLog?.userId).toBe(adminUserId);
  });

  it("records audit log when a purchase receipt is posted", async () => {
    const org = await prisma.organization.findFirstOrThrow();
    const supplier = await prisma.supplier.findFirstOrThrow();
    const warehouse = await prisma.warehouse.findFirstOrThrow();
    const item = await prisma.inventoryItem.findFirstOrThrow({
      where: { category: "RAW_MATERIAL" },
    });
    const uom = await prisma.unitOfMeasure.findFirstOrThrow();

    const receiptNum = `PR-AUDIT-${Date.now()}`;
    const receiptRes = await fetch(`${baseUrl}/api/v1/inventory/purchase-receipts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        organizationId: org.id,
        supplierId: supplier.id,
        warehouseId: warehouse.id,
        receiptNumber: receiptNum,
        items: [
          {
            inventoryItemId: item.id,
            quantity: 10,
            uomId: uom.id,
            unitPrice: 50,
          },
        ],
      }),
    });
    expect(receiptRes.status).toBe(201);
    const receiptData = (await receiptRes.json()) as { id: string };

    const receiptLog = await prisma.auditLog.findFirst({
      where: {
        entity: "PurchaseReceipt",
        entityId: receiptData.id,
        action: "CREATE",
      },
    });
    expect(receiptLog).not.toBeNull();
    expect(receiptLog?.userId).toBe(adminUserId);
    expect(receiptLog?.details).toContain(receiptNum);
  });

  it("records audit log across production runs: create draft, post run, and reverse run", async () => {
    const org = await prisma.organization.findFirstOrThrow();
    const warehouse = await prisma.warehouse.findFirstOrThrow();
    const recipe = await prisma.recipe.findFirstOrThrow({
      where: {
        items: {
          some: {},
        },
      },
      include: {
        items: {
          include: { inventoryItem: true },
        },
      },
    });

    const runNum = `RUN-AUDIT-${Date.now()}`;

    // 1. Create draft run
    const draftRes = await fetch(`${baseUrl}/api/v1/production-runs/draft`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        organizationId: org.id,
        warehouseId: warehouse.id,
        recipeId: recipe.id,
        runNumber: runNum,
        batchCount: 1,
      }),
    });
    expect(draftRes.status).toBe(201);
    const draftData = (await draftRes.json()) as { id: string };

    const draftLog = await prisma.auditLog.findFirst({
      where: {
        entity: "ProductionRun",
        entityId: draftData.id,
        action: "CREATE",
      },
    });
    expect(draftLog).not.toBeNull();
    expect(draftLog?.userId).toBe(adminUserId);
    expect(draftLog?.details).toContain(runNum);

    // 2. Post production run
    const postRes = await fetch(`${baseUrl}/api/v1/production-runs/${draftData.id}/post`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        organizationId: org.id,
        actualGoodQty: 10,
        consumedMaterials: recipe.items.map((i) => ({
          inventoryItemId: i.inventoryItemId,
          actualQty: Number(i.plannedQty),
        })),
      }),
    });
    expect(postRes.status).toBe(200);

    const postLog = await prisma.auditLog.findFirst({
      where: {
        entity: "ProductionRun",
        entityId: draftData.id,
        action: "POST",
      },
    });
    expect(postLog).not.toBeNull();
    expect(postLog?.userId).toBe(adminUserId);
    expect(postLog?.details).toContain(runNum);

    // 3. Reverse production run
    const reverseRes = await fetch(`${baseUrl}/api/v1/production-runs/${draftData.id}/reverse`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        reason: "Audit test run reversal defect found",
      }),
    });
    expect(reverseRes.status).toBe(200);

    const reverseLog = await prisma.auditLog.findFirst({
      where: {
        entity: "ProductionRun",
        entityId: draftData.id,
        action: "REVERSE",
      },
    });
    expect(reverseLog).not.toBeNull();
    expect(reverseLog?.userId).toBe(adminUserId);
    expect(reverseLog?.reason).toBe("Audit test run reversal defect found");
  });

  it("records audit log when recording and bouncing payments", async () => {
    const customer = await prisma.customer.findFirstOrThrow();

    // 1. Record payment
    const paymentRes = await fetch(`${baseUrl}/api/v1/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        customerId: customer.id,
        amount: 2500,
        paymentMode: "CHEQUE",
        referenceNumber: `CHQ-${Date.now()}`,
      }),
    });
    expect(paymentRes.status).toBe(201);
    const paymentData = (await paymentRes.json()) as { id: string; paymentNumber: string };

    const paymentLog = await prisma.auditLog.findFirst({
      where: {
        entity: "Payment",
        entityId: paymentData.id,
        action: "CREATE",
      },
    });
    expect(paymentLog).not.toBeNull();
    expect(paymentLog?.userId).toBe(adminUserId);
    expect(paymentLog?.details).toContain(paymentData.paymentNumber);

    // 2. Bounce payment
    const bounceRes = await fetch(`${baseUrl}/api/v1/payments/${paymentData.id}/bounce`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        reason: "Insufficient funds cheque return",
      }),
    });
    expect(bounceRes.status).toBe(200);

    const bounceLog = await prisma.auditLog.findFirst({
      where: {
        entity: "payment",
        entityId: paymentData.id,
        action: "PAYMENT_BOUNCED",
      },
    });
    expect(bounceLog).not.toBeNull();
    expect(bounceLog?.userId).toBe(adminUserId);
    expect(bounceLog?.reason).toBe("Insufficient funds cheque return");
  });

  it("records audit log when creating an invoice and issuing a credit note", async () => {
    const customer = await prisma.customer.findFirstOrThrow();
    const variant = await prisma.productVariant.findFirstOrThrow({
      where: { sku: "VAR-MURUKKU-200G" },
    });

    // 1. Create and approve order
    const orderRes = await fetch(`${baseUrl}/api/v1/sales/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        customerId: customer.id,
        status: "SUBMITTED",
        lines: [{ productVariantId: variant.id, quantity: 1 }],
      }),
    });
    const orderData = (await orderRes.json()) as { order: { id: string } };

    await fetch(`${baseUrl}/api/v1/sales/orders/${orderData.order.id}/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({}),
    });

    // 2. Generate invoice
    const invRes = await fetch(`${baseUrl}/api/v1/finance/invoices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        salesOrderId: orderData.order.id,
      }),
    });
    expect(invRes.status).toBe(201);
    const invData = (await invRes.json()) as { id: string; invoiceNumber: string };

    const invLog = await prisma.auditLog.findFirst({
      where: {
        entity: "SalesInvoice",
        entityId: invData.id,
        action: "POST",
      },
    });
    expect(invLog).not.toBeNull();
    expect(invLog?.userId).toBe(adminUserId);
    expect(invLog?.details).toContain(invData.invoiceNumber);

    // 3. Issue credit note
    const cnRes = await fetch(`${baseUrl}/api/v1/finance/invoices/${invData.id}/credit-note`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        reason: "Customer goods damaged in transit credit note",
      }),
    });
    expect(cnRes.status).toBe(201);
    const cnData = (await cnRes.json()) as { id: string; creditNoteNumber: string };

    const cnLog = await prisma.auditLog.findFirst({
      where: {
        entity: "CreditNote",
        entityId: cnData.id,
        action: "CREATE",
      },
    });
    expect(cnLog).not.toBeNull();
    expect(cnLog?.userId).toBe(adminUserId);
    expect(cnLog?.reason).toBe("Customer goods damaged in transit credit note");
  });
});
