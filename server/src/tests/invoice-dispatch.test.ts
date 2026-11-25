import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { prisma } from "../db/client.js";
import { resetOperationalData } from "../db/reset.js";
import { seedBenchmarkMasters } from "../db/seed.js";
import { inventoryService } from "../modules/inventory/inventory.service.js";

describe("M6: Invoice generation, physical dispatch, reservation release, and credit note", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    // 1. Reset all operational data and restore opening benchmark state
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

  it("executes benchmark transaction 5: posts ₹7,875 Retailer A invoice and dispatches stock reducing from 238 to 88 packets", async () => {
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
        orderNumber: "SO-BENCHMARK-TX5",
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

    // Admin approves order (reserves 150 packets)
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

    // Verify stock before dispatch: onHand = 238, reserved = 150, available = 88
    const preDispatchBal = await inventoryService.getInventoryBalances(
      org.id,
      warehouse.id,
    );
    const fgPre = preDispatchBal.find((b) => b.sku === "FG-MURUKKU-200G");
    expect(fgPre?.onHand).toBe(238);
    expect(fgPre?.reserved).toBe(150);
    expect(fgPre?.available).toBe(88);

    // 1. Post Invoice for Retailer A order
    const invoiceRes = await fetch(`${baseUrl}/api/v1/finance/invoices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        salesOrderId: orderId,
        notes: "Benchmark Transaction 5: Retailer A Invoice",
        idempotencyKey: "idem-tx5-retailer-a-invoice",
      }),
    });

    expect(invoiceRes.status).toBe(201);
    const invoice = (await invoiceRes.json()) as {
      id: string;
      invoiceNumber: string;
      status: string;
      taxableAmount: string | number;
      cgstAmount: string | number;
      sgstAmount: string | number;
      igstAmount: string | number;
      totalTaxAmount: string | number;
      totalAmount: string | number;
      outstandingAmount: string | number;
      customerNameSnapshot: string;
      deliveryStateSnapshot: string;
    };

    // Exact benchmark invoice assertions:
    // Taxable invoice: ₹7,500
    // CGST: ₹187.50
    // SGST: ₹187.50
    // Invoice total: ₹7,875
    expect(Number(invoice.taxableAmount)).toBe(7500);
    expect(Number(invoice.cgstAmount)).toBe(187.5);
    expect(Number(invoice.sgstAmount)).toBe(187.5);
    expect(Number(invoice.igstAmount)).toBe(0);
    expect(Number(invoice.totalTaxAmount)).toBe(375);
    expect(Number(invoice.totalAmount)).toBe(7875);
    expect(Number(invoice.outstandingAmount)).toBe(7875);
    expect(invoice.status).toBe("POSTED");
    expect(invoice.customerNameSnapshot).toBe("Retailer A");
    expect(invoice.deliveryStateSnapshot).toBe("Tamil Nadu");
    expect(invoice.invoiceNumber).toMatch(
      /^INV-\d{4}-\d{2}-\d{4}$|^INV-\d{4}-\d{4}$/,
    );

    // 2. Post physical dispatch
    const dispatchRes = await fetch(`${baseUrl}/api/v1/sales/dispatches`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        salesOrderId: orderId,
        warehouseId: warehouse.id,
        vehicleNumber: "TN-01-AB-1234",
        driverName: "Murugan",
        notes: "Full physical dispatch to Retailer A",
        idempotencyKey: "idem-tx5-retailer-a-dispatch",
      }),
    });

    expect(dispatchRes.status).toBe(201);
    const dispatch = (await dispatchRes.json()) as {
      dispatchNumber: string;
      status: string;
      salesOrder: { fulfilmentStatus: string };
    };

    expect(dispatch.status).toBe("POSTED");
    expect(dispatch.salesOrder.fulfilmentStatus).toBe("FULFILLED");

    // 3. Verify exact stock balance after dispatch: 238 to 88 packets!
    const postDispatchBal = await inventoryService.getInventoryBalances(
      org.id,
      warehouse.id,
    );
    const fgPost = postDispatchBal.find((b) => b.sku === "FG-MURUKKU-200G");

    // Finished stock after dispatch: 88 packets
    expect(fgPost?.onHand).toBe(88);
    // Reservation is released
    expect(fgPost?.reserved).toBe(0);
    // Available stock is 88 packets
    expect(fgPost?.available).toBe(88);
    // Stock ledger deterministically reconciles
    expect(fgPost?.reconciled).toBe(true);

    // Check append-only stock movement recorded for DISPATCH
    const dispatchMovement = await prisma.stockMovement.findFirstOrThrow({
      where: {
        inventoryItemId: finishedGoodsItem.id,
        movementType: "DISPATCH",
      },
    });
    expect(Number(dispatchMovement.quantity)).toBe(-150);

    // Check reservation status transitioned to RELEASED
    const reservation = await prisma.stockReservation.findFirstOrThrow({
      where: { salesOrderId: orderId },
    });
    expect(reservation.status).toBe("RELEASED");
    expect(Number(reservation.releasedQuantity)).toBe(150);
  });

  it("handles financial correction via credit note without deleting posted invoice", async () => {
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

    // Create and approve a small order
    const orderRes = await fetch(`${baseUrl}/api/v1/sales/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        organizationId: org.id,
        customerId: retailerA.id,
        lines: [
          { productVariantId: murukkuVariant.id, quantity: 10, unitPrice: 50 },
        ],
      }),
    });
    const orderData = (await orderRes.json()) as { order: { id: string } };
    const orderId = orderData.order.id;

    await fetch(`${baseUrl}/api/v1/sales/orders/${orderId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({}),
    });

    // Post invoice (10 pkts * ₹50 = ₹500 + ₹25 GST = ₹525)
    const invRes = await fetch(`${baseUrl}/api/v1/finance/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ salesOrderId: orderId }),
    });
    const invoice = (await invRes.json()) as {
      id: string;
      totalAmount: number;
      outstandingAmount: number;
    };
    expect(Number(invoice.totalAmount)).toBe(525);

    // Issue credit note for ₹105 (e.g. 2 damaged packets allowance)
    const cnRes = await fetch(
      `${baseUrl}/api/v1/finance/invoices/${invoice.id}/credit-note`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({
          reason: "Damage allowance during transit",
          totalAmount: 105,
        }),
      },
    );
    expect(cnRes.status).toBe(201);
    const cn = (await cnRes.json()) as {
      creditNoteNumber: string;
      totalAmount: number;
    };
    expect(Number(cn.totalAmount)).toBe(105);

    // Verify invoice outstanding reduced from ₹525 to ₹420 without record deletion
    const updatedInvoice = await prisma.salesInvoice.findUniqueOrThrow({
      where: { id: invoice.id },
    });
    expect(Number(updatedInvoice.outstandingAmount)).toBe(420);
    expect(updatedInvoice.status).toBe("POSTED");
  });

  it("enforces role permissions: prevents unauthorized dispatch and invoicing while allowing accountant read access", async () => {
    const salesmanCookie = await loginAndGetCookie(
      "salesman1@millledger.local",
      "SalesmanPassword123!",
    );
    const accountantCookie = await loginAndGetCookie(
      "accountant@millledger.local",
      "AccountantPassword123!",
    );

    // 1. Salesman cannot post invoice (403)
    const sPostInv = await fetch(`${baseUrl}/api/v1/finance/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesmanCookie },
      body: JSON.stringify({ salesOrderId: "any-order" }),
    });
    expect(sPostInv.status).toBe(403);

    // 2. Salesman cannot dispatch (403)
    const sDispatch = await fetch(`${baseUrl}/api/v1/sales/dispatches`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesmanCookie },
      body: JSON.stringify({ salesOrderId: "any-order" }),
    });
    expect(sDispatch.status).toBe(403);

    // 3. Accountant cannot post invoice (403 write prohibited)
    const aPostInv = await fetch(`${baseUrl}/api/v1/finance/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: accountantCookie },
      body: JSON.stringify({ salesOrderId: "any-order" }),
    });
    expect(aPostInv.status).toBe(403);

    // 4. Accountant CAN read invoices (200 read only permitted)
    const aGetInv = await fetch(`${baseUrl}/api/v1/finance/invoices`, {
      headers: { Cookie: accountantCookie },
    });
    expect(aGetInv.status).toBe(200);
  });

  it("F-018: restricts GET /api/v1/sales/dispatches so salesmen only see dispatches for their own orders (OD-03)", async () => {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { code: "MILL" },
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

    const sm1Cookie = await loginAndGetCookie(
      "salesman1@millledger.local",
      "SalesmanPassword123!",
    );
    const sm2Cookie = await loginAndGetCookie(
      "salesman2@millledger.local",
      "SalesmanPassword123!",
    );
    const adminCookie = await loginAndGetCookie(
      "admin@millledger.local",
      "AdminPassword123!",
    );

    // 1. Salesman 1 creates Order 1 (Retailer A)
    const order1Res = await fetch(`${baseUrl}/api/v1/sales/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sm1Cookie },
      body: JSON.stringify({
        organizationId: org.id,
        customerId: retailerA.id,
        lines: [{ productVariantId: murukkuVariant.id, quantity: 5 }],
      }),
    });
    expect(order1Res.status).toBe(201);
    const order1Data = (await order1Res.json()) as { order: { id: string } };

    // Admin approves and dispatches Order 1
    await fetch(`${baseUrl}/api/v1/sales/orders/${order1Data.order.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({}),
    });
    const disp1Res = await fetch(`${baseUrl}/api/v1/sales/dispatches`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        salesOrderId: order1Data.order.id,
        vehicleNumber: "TN-38-SM1-001",
      }),
    });
    expect(disp1Res.status).toBe(201);
    const disp1Data = (await disp1Res.json()) as { id: string };
    const dispatch1Id = disp1Data.id;

    // 2. Salesman 2 creates Order 2 (Distributor B)
    const order2Res = await fetch(`${baseUrl}/api/v1/sales/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: sm2Cookie },
      body: JSON.stringify({
        organizationId: org.id,
        customerId: distributorB.id,
        lines: [{ productVariantId: murukkuVariant.id, quantity: 5 }],
      }),
    });
    expect(order2Res.status).toBe(201);
    const order2Data = (await order2Res.json()) as { order: { id: string } };

    // Admin approves and dispatches Order 2
    await fetch(`${baseUrl}/api/v1/sales/orders/${order2Data.order.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({}),
    });
    const disp2Res = await fetch(`${baseUrl}/api/v1/sales/dispatches`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        salesOrderId: order2Data.order.id,
        vehicleNumber: "KA-01-SM2-002",
      }),
    });
    expect(disp2Res.status).toBe(201);
    const disp2Data = (await disp2Res.json()) as { id: string };
    const dispatch2Id = disp2Data.id;

    // 3. Admin lists dispatches -> sees BOTH Dispatch 1 and Dispatch 2
    const adminListRes = await fetch(`${baseUrl}/api/v1/sales/dispatches`, {
      headers: { Cookie: adminCookie },
    });
    expect(adminListRes.status).toBe(200);
    const adminListData = (await adminListRes.json()) as { dispatches: Array<{ id: string }> };
    const adminDispatchIds = adminListData.dispatches.map((d) => d.id);
    expect(adminDispatchIds).toContain(dispatch1Id);
    expect(adminDispatchIds).toContain(dispatch2Id);

    // 4. Salesman 1 lists dispatches -> sees ONLY Dispatch 1, NOT Dispatch 2
    const sm1ListRes = await fetch(`${baseUrl}/api/v1/sales/dispatches`, {
      headers: { Cookie: sm1Cookie },
    });
    expect(sm1ListRes.status).toBe(200);
    const sm1ListData = (await sm1ListRes.json()) as { dispatches: Array<{ id: string }> };
    const sm1DispatchIds = sm1ListData.dispatches.map((d) => d.id);
    expect(sm1DispatchIds).toContain(dispatch1Id);
    expect(sm1DispatchIds).not.toContain(dispatch2Id);

    // 5. Salesman 1 fetches individual dispatch by ID:
    // Own dispatch -> 200 OK
    const sm1GetOwnRes = await fetch(`${baseUrl}/api/v1/sales/dispatches/${dispatch1Id}`, {
      headers: { Cookie: sm1Cookie },
    });
    expect(sm1GetOwnRes.status).toBe(200);
    const sm1OwnData = (await sm1GetOwnRes.json()) as { dispatch: { id: string } };
    expect(sm1OwnData.dispatch.id).toBe(dispatch1Id);

    // Other salesman's dispatch -> 404 Not Found (scoped access denied)
    const sm1GetOtherRes = await fetch(`${baseUrl}/api/v1/sales/dispatches/${dispatch2Id}`, {
      headers: { Cookie: sm1Cookie },
    });
    expect(sm1GetOtherRes.status).toBe(404);

    // 6. Salesman 2 lists dispatches -> sees ONLY Dispatch 2, NOT Dispatch 1
    const sm2ListRes = await fetch(`${baseUrl}/api/v1/sales/dispatches`, {
      headers: { Cookie: sm2Cookie },
    });
    expect(sm2ListRes.status).toBe(200);
    const sm2ListData = (await sm2ListRes.json()) as { dispatches: Array<{ id: string }> };
    const sm2DispatchIds = sm2ListData.dispatches.map((d) => d.id);
    expect(sm2DispatchIds).toContain(dispatch2Id);
    expect(sm2DispatchIds).not.toContain(dispatch1Id);

    // 7. Salesman 2 fetches other salesman's dispatch -> 404
    const sm2GetOtherRes = await fetch(`${baseUrl}/api/v1/sales/dispatches/${dispatch1Id}`, {
      headers: { Cookie: sm2Cookie },
    });
    expect(sm2GetOtherRes.status).toBe(404);
  });

  it("F-096: generates inter-state invoice for Karnataka delivery asserting 100% IGST allocation and 0 CGST/SGST", async () => {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { code: "MILL" },
    });
    const warehouse = await prisma.warehouse.findFirstOrThrow({
      where: { code: "WH-1" },
    });
    const distB = await prisma.customer.findFirstOrThrow({
      where: { code: "CUST-DIST-B" },
    });
    const murukkuVariant = await prisma.productVariant.findFirstOrThrow({
      where: { sku: "VAR-MURUKKU-200G" },
    });

    const adminCookie = await loginAndGetCookie(
      "admin@millledger.local",
      "AdminPassword123!",
    );

    const sm2Cookie = await loginAndGetCookie(
      "salesman2@millledger.local",
      "SalesmanPassword123!",
    );

    const orderRes = await fetch(`${baseUrl}/api/v1/sales/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sm2Cookie,
      },
      body: JSON.stringify({
        organizationId: org.id,
        customerId: distB.id,
        warehouseId: warehouse.id,
        orderNumber: "SO-INTERSTATE-TEST-F096",
        lines: [
          {
            productVariantId: murukkuVariant.id,
            quantity: 50,
            unitPrice: 50.0,
          },
        ],
      }),
    });
    expect(orderRes.status).toBe(201);
    const orderData = (await orderRes.json()) as { order: { id: string } };
    const orderId = orderData.order.id;

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

    const invoiceRes = await fetch(`${baseUrl}/api/v1/finance/invoices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        salesOrderId: orderId,
        notes: "Inter-state IGST test for F-096",
        idempotencyKey: "idem-f096-dist-b-invoice",
      }),
    });

    expect(invoiceRes.status).toBe(201);
    const invoice = (await invoiceRes.json()) as {
      id: string;
      taxableAmount: number;
      cgstAmount: number;
      sgstAmount: number;
      igstAmount: number;
      totalTaxAmount: number;
      totalAmount: number;
      deliveryStateSnapshot: string;
    };

    expect(Number(invoice.taxableAmount)).toBe(2500);
    expect(Number(invoice.cgstAmount)).toBe(0);
    expect(Number(invoice.sgstAmount)).toBe(0);
    expect(Number(invoice.igstAmount)).toBe(125);
    expect(Number(invoice.totalTaxAmount)).toBe(125);
    expect(Number(invoice.totalAmount)).toBe(2625);
    expect(invoice.deliveryStateSnapshot).toBe("Karnataka");

    const dbInvoice = await prisma.salesInvoice.findUniqueOrThrow({
      where: { id: invoice.id },
      include: { lines: true },
    });
    expect(dbInvoice.lines).toHaveLength(1);
    const line = dbInvoice.lines[0];
    expect(Number(line.taxableAmount)).toBe(2500);
    expect(Number(line.cgstAmount)).toBe(0);
    expect(Number(line.sgstAmount)).toBe(0);
    expect(Number(line.igstAmount)).toBe(125);
    expect(Number(line.taxAmount)).toBe(125);
    expect(Number(line.lineTotal)).toBe(2625);
  });

  it("IMP-001: downloads a real application/pdf for posted invoices and enforces RBAC", async () => {
    const invoice = await prisma.salesInvoice.findFirstOrThrow();
    const adminCookie = await loginAndGetCookie(
      "admin@millledger.local",
      "AdminPassword123!",
    );
    const salesmanCookie = await loginAndGetCookie(
      "salesman1@millledger.local",
      "SalesmanPassword123!",
    );
    const productionCookie = await loginAndGetCookie(
      "production@millledger.local",
      "ProductionPassword123!",
    );

    const pdfRes = await fetch(
      `${baseUrl}/api/v1/finance/invoices/${invoice.id}/pdf`,
      {
        headers: { Cookie: adminCookie },
      },
    );
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers.get("content-type")).toContain("application/pdf");
    const pdfBytes = Buffer.from(await pdfRes.arrayBuffer());
    expect(pdfBytes.subarray(0, 5).toString("utf8")).toBe("%PDF-");
    expect(pdfBytes.length).toBeGreaterThan(500);

    const salesmanRes = await fetch(
      `${baseUrl}/api/v1/finance/invoices/${invoice.id}/pdf`,
      {
        headers: { Cookie: salesmanCookie },
      },
    );
    expect(salesmanRes.status).toBe(403);

    const prodRes = await fetch(
      `${baseUrl}/api/v1/finance/invoices/${invoice.id}/pdf`,
      {
        headers: { Cookie: productionCookie },
      },
    );
    expect(prodRes.status).toBe(403);
  });

  it("IMP-014: records a sales return against a posted dispatch and restores stock", async () => {
    const adminCookie = await loginAndGetCookie(
      "admin@millledger.local",
      "AdminPassword123!",
    );
    const dispatch = await prisma.dispatch.findFirstOrThrow({
      where: { status: "POSTED" },
      include: { lines: true },
    });
    const line = dispatch.lines[0];
    const beforeItem = await prisma.inventoryItem.findUniqueOrThrow({
      where: { id: line.inventoryItemId },
    });

    const retRes = await fetch(`${baseUrl}/api/v1/sales/returns`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        dispatchId: dispatch.id,
        reason: "Customer returned 5 packets",
        lines: [{ inventoryItemId: line.inventoryItemId, quantity: 5 }],
      }),
    });
    expect(retRes.status).toBe(201);

    const afterItem = await prisma.inventoryItem.findUniqueOrThrow({
      where: { id: line.inventoryItemId },
    });
    expect(Number(afterItem.currentStock)).toBe(
      Number(beforeItem.currentStock) + 5,
    );
  });

  it("lists posted invoices when queried by organization code (MILL) or default", async () => {
    const adminCookie = await loginAndGetCookie(
      "admin@millledger.local",
      "AdminPassword123!",
    );

    const byCodeRes = await fetch(
      `${baseUrl}/api/v1/finance/invoices?organizationId=MILL&limit=50&offset=0`,
      {
        headers: { Cookie: adminCookie },
      },
    );
    expect(byCodeRes.status).toBe(200);
    const byCodeBody = (await byCodeRes.json()) as {
      invoices: Array<{ id: string; invoiceNumber: string }>;
      pagination: { count: number };
    };
    expect(byCodeBody.invoices.length).toBeGreaterThan(0);
    expect(byCodeBody.pagination.count).toBe(byCodeBody.invoices.length);

    const defaultRes = await fetch(`${baseUrl}/api/v1/finance/invoices`, {
      headers: { Cookie: adminCookie },
    });
    expect(defaultRes.status).toBe(200);
    const defaultBody = (await defaultRes.json()) as {
      invoices: Array<{ id: string; invoiceNumber: string }>;
    };
    expect(defaultBody.invoices.length).toBe(byCodeBody.invoices.length);
  });
});
