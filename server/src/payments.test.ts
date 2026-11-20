import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApp } from "./app.js";
import { createServer, type Server } from "node:http";
import { prisma } from "./db/client.js";
import { resetOperationalData } from "./db/reset.js";
import { seedBenchmarkMasters } from "./db/seed.js";
import { inventoryService } from "./modules/inventory/inventory.service.js";

describe("M7: Payments, customer ledger, allocations, and costing", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    // 1. Reset all operational data in correct order
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

  it("executes benchmark transaction 7: allocates ₹4,000 to Retailer A leaving ₹3,875 outstanding", async () => {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { code: "MILL" },
    });
    const warehouse = await prisma.warehouse.findFirstOrThrow({
      where: { code: "WH-1" },
    });
    const retailerA = await prisma.customer.findFirstOrThrow({
      where: { code: "CUST-RET-A" },
    });
    const murukkuVariant = await prisma.productVariant.findFirstOrThrow({
      where: { sku: "VAR-MURUKKU-200G" },
    });
    const finishedGoodsItem = await prisma.inventoryItem.findFirstOrThrow({
      where: { sku: "FG-MURUKKU-200G" },
    });

    // Establish benchmark stock after run: 238 packets (50 opening + 188 output)
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

    // Salesman 1 submits Retailer A order for 150 packets
    const salesman1Cookie = await loginAndGetCookie(
      "salesman1@millledger.local",
      "SalesmanPassword123!",
    );

    const orderRes = await fetch(`${baseUrl}/api/v1/sales/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: salesman1Cookie,
      },
      body: JSON.stringify({
        organizationId: org.id,
        customerId: retailerA.id,
        warehouseId: warehouse.id,
        orderNumber: "SO-BENCHMARK-TX7",
        lines: [
          {
            productVariantId: murukkuVariant.id,
            quantity: 150,
            unitPrice: 50.0,
          },
        ],
      }),
    });
    expect(orderRes.status).toBe(201);
    const orderData = (await orderRes.json()) as { order: { id: string } };
    const orderId = orderData.order.id;

    // Admin approves order
    const adminCookie = await loginAndGetCookie(
      "admin@millledger.local",
      "AdminPassword123!",
    );
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

    // Admin posts invoice (₹7,875 total)
    const invoiceRes = await fetch(`${baseUrl}/api/v1/finance/invoices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        salesOrderId: orderId,
        notes: "Benchmark Transaction 5 invoice",
      }),
    });
    expect(invoiceRes.status).toBe(201);
    const invoice = (await invoiceRes.json()) as {
      id: string;
      totalAmount: number;
      outstandingAmount: number;
    };
    expect(Number(invoice.totalAmount)).toBe(7875);
    expect(Number(invoice.outstandingAmount)).toBe(7875);

    // Admin dispatches stock (238 -> 88)
    const dispatchRes = await fetch(`${baseUrl}/api/v1/sales/dispatches`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        salesOrderId: orderId,
        vehicleNumber: "TN-38-BZ-4321",
        driverName: "Murugan",
      }),
    });
    expect(dispatchRes.status).toBe(201);

    const postDispatchBal = await inventoryService.getInventoryBalances(
      org.id,
      warehouse.id,
    );
    const fgPost = postDispatchBal.find((b) => b.sku === "FG-MURUKKU-200G");
    expect(fgPost?.onHand).toBe(88);
    expect(fgPost?.reserved).toBe(0);

    // 7. Benchmark Transaction 7: Allocate ₹4,000 payment to Retailer A
    const paymentRes = await fetch(`${baseUrl}/api/v1/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        customerId: retailerA.id,
        amount: 4000,
        paymentMode: "BANK_TRANSFER",
        referenceNumber: "NEFT-12345678",
        allocations: [
          {
            salesInvoiceId: invoice.id,
            amount: 4000,
          },
        ],
      }),
    });

    expect(paymentRes.status).toBe(201);
    const payment = (await paymentRes.json()) as {
      paymentNumber: string;
      amount: number;
      unallocatedAmount: number;
      allocations: Array<{ amount: number }>;
    };

    expect(payment.paymentNumber).toMatch(/^REC-\d{4}-\d{4}$/);
    expect(Number(payment.amount)).toBe(4000);
    expect(Number(payment.unallocatedAmount)).toBe(0);
    expect(payment.allocations).toHaveLength(1);
    expect(Number(payment.allocations[0].amount)).toBe(4000);

    // Verify invoice is partially paid with ₹3,875 outstanding
    const updatedInvoice = await prisma.salesInvoice.findUniqueOrThrow({
      where: { id: invoice.id },
    });
    expect(updatedInvoice.status).toBe("PARTIALLY_PAID");
    expect(Number(updatedInvoice.paidAmount)).toBe(4000);
    expect(Number(updatedInvoice.outstandingAmount)).toBe(3875);

    // 8. Verify Customer Ledger and Net Outstanding
    const ledgerRes = await fetch(
      `${baseUrl}/api/v1/payments/ledger/${retailerA.id}`,
      {
        headers: {
          Cookie: adminCookie,
        },
      },
    );
    expect(ledgerRes.status).toBe(200);
    const ledger = await ledgerRes.json();

    expect(ledger.summary.totalInvoiced).toBe(7875);
    expect(ledger.summary.totalPaid).toBe(4000);
    expect(ledger.summary.netOutstanding).toBe(3875);

    // Verify chronological entries
    expect(ledger.ledgerEntries.length).toBeGreaterThanOrEqual(2);
    const invoiceEntry = ledger.ledgerEntries.find(
      (e: any) => e.documentType === "INVOICE",
    );
    const paymentEntry = ledger.ledgerEntries.find(
      (e: any) => e.documentType === "PAYMENT",
    );
    expect(invoiceEntry).toBeDefined();
    expect(invoiceEntry.debit).toBe(7875);
    expect(paymentEntry).toBeDefined();
    expect(paymentEntry.credit).toBe(4000);
  });

  it("validates payment allocation business rules: rejects over allocation and enforces permissions", async () => {
    const retailerA = await prisma.customer.findFirstOrThrow({
      where: { code: "CUST-RET-A" },
    });
    const openInvoice = await prisma.salesInvoice.findFirstOrThrow({
      where: { customerId: retailerA.id, status: "PARTIALLY_PAID" },
    });

    const adminCookie = await loginAndGetCookie(
      "admin@millledger.local",
      "AdminPassword123!",
    );

    // 1. Attempting to allocate ₹5,000 to an invoice with ₹3,875 outstanding must be rejected with 400
    const overAllocRes = await fetch(`${baseUrl}/api/v1/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        customerId: retailerA.id,
        amount: 5000,
        allocations: [
          {
            salesInvoiceId: openInvoice.id,
            amount: 5000,
          },
        ],
      }),
    });
    expect(overAllocRes.status).toBe(400);

    // 2. Salesman cannot record payment (403 Forbidden)
    const salesman1Cookie = await loginAndGetCookie(
      "salesman1@millledger.local",
      "SalesmanPassword123!",
    );
    const salesmanRes = await fetch(`${baseUrl}/api/v1/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: salesman1Cookie,
      },
      body: JSON.stringify({
        customerId: retailerA.id,
        amount: 1000,
      }),
    });
    expect(salesmanRes.status).toBe(403);

    // 3. Accountant has read-only access (403 on POST, 200 on GET)
    const accountantCookie = await loginAndGetCookie(
      "accountant@millledger.local",
      "AccountantPassword123!",
    );
    const acctPostRes = await fetch(`${baseUrl}/api/v1/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: accountantCookie,
      },
      body: JSON.stringify({
        customerId: retailerA.id,
        amount: 1000,
      }),
    });
    expect(acctPostRes.status).toBe(403);

    const acctGetRes = await fetch(`${baseUrl}/api/v1/payments`, {
      headers: {
        Cookie: accountantCookie,
      },
    });
    expect(acctGetRes.status).toBe(200);
  });

  it("handles auto FIFO allocation and unallocated credit balance", async () => {
    const retailerA = await prisma.customer.findFirstOrThrow({
      where: { code: "CUST-RET-A" },
    });
    const openInvoice = await prisma.salesInvoice.findFirstOrThrow({
      where: { customerId: retailerA.id, status: "PARTIALLY_PAID" },
    });
    expect(Number(openInvoice.outstandingAmount)).toBe(3875);

    const adminCookie = await loginAndGetCookie(
      "admin@millledger.local",
      "AdminPassword123!",
    );

    // Pay ₹4,875 with auto FIFO allocation: ₹3,875 clears the invoice, ₹1,000 remains unallocated
    const fifoPayRes = await fetch(`${baseUrl}/api/v1/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        customerId: retailerA.id,
        amount: 4875,
        paymentMode: "UPI",
        referenceNumber: "UPI-987654321",
      }),
    });
    expect(fifoPayRes.status).toBe(201);
    const fifoPay = (await fifoPayRes.json()) as {
      amount: number;
      unallocatedAmount: number;
      allocations: Array<{ amount: number }>;
    };

    expect(Number(fifoPay.amount)).toBe(4875);
    expect(Number(fifoPay.unallocatedAmount)).toBe(1000);
    expect(fifoPay.allocations).toHaveLength(1);
    expect(Number(fifoPay.allocations[0].amount)).toBe(3875);

    // Invoice is now fully PAID
    const clearedInvoice = await prisma.salesInvoice.findUniqueOrThrow({
      where: { id: openInvoice.id },
    });
    expect(clearedInvoice.status).toBe("PAID");
    expect(Number(clearedInvoice.paidAmount)).toBe(7875);
    expect(Number(clearedInvoice.outstandingAmount)).toBe(0);
  });
});
