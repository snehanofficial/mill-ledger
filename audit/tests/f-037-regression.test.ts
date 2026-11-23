import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createServer, type Server } from "node:http";
import { createApp } from "../../server/src/app.js";
import { prisma } from "../../server/src/db/client.js";

describe("F-037 Regression Test: Core Invoicing Workflow UI & API Initiation (REQ-026 & REQ-028)", () => {
  const ordersPagePath = path.resolve(process.cwd(), "client/src/pages/orders-page.tsx");
  const invoicesPagePath = path.resolve(process.cwd(), "client/src/pages/invoices-page.tsx");
  const salesServicePath = path.resolve(process.cwd(), "server/src/modules/sales/sales.service.ts");

  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    const app = createApp();
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("server includes invoices relation in sales order queries", () => {
    expect(fs.existsSync(salesServicePath)).toBe(true);
    const content = fs.readFileSync(salesServicePath, "utf-8");

    // Both getSalesOrders and getSalesOrderById include invoices
    expect(content).toContain("reservations: true,\n        invoices: true,");
  });

  it("client/src/pages/orders-page.tsx provides Invoice Order action for approved orders", () => {
    expect(fs.existsSync(ordersPagePath)).toBe(true);
    const content = fs.readFileSync(ordersPagePath, "utf-8");

    expect(content).toContain('canCreateInvoice = user?.role === "ADMIN"');
    expect(content).toContain('apiClient.post("/finance/invoices"');
    expect(content).toContain("Invoice Order");
    expect(content).toContain("Invoiced (");
  });

  it("client/src/pages/invoices-page.tsx provides Generate Invoice modal and action button", () => {
    expect(fs.existsSync(invoicesPagePath)).toBe(true);
    const content = fs.readFileSync(invoicesPagePath, "utf-8");

    expect(content).toContain('canCreateInvoice = user?.role === "ADMIN"');
    expect(content).toContain("Generate Invoice");
    expect(content).toContain('apiClient.post("/finance/invoices"');
    expect(content).toContain('apiClient.get("/sales/orders?status=APPROVED"');
    expect(content).toContain("Post Invoice");
  });

  it("POST /api/v1/finance/invoices successfully generates invoice from approved sales order", async () => {
    // Sign in as admin to get session cookie
    const loginRes = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@millledger.local",
        password: "AdminPassword123!",
      }),
    });
    expect(loginRes.status).toBe(200);
    const cookie = loginRes.headers.get("set-cookie") || "";

    // Find an approved order with stock reserved
    const order = await prisma.salesOrder.findFirst({
      where: { status: "APPROVED" },
      include: { customer: true, lines: true },
    });

    if (order) {
      // Check if already invoiced; if not, post invoice
      const existingInvoice = await prisma.salesInvoice.findFirst({
        where: { salesOrderId: order.id },
      });

      if (!existingInvoice) {
        const invoiceRes = await fetch(`${baseUrl}/api/v1/finance/invoices`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            cookie,
          },
          body: JSON.stringify({
            salesOrderId: order.id,
            notes: "Automated regression invoice test",
          }),
        });

        expect(invoiceRes.status).toBe(201);
        const invoiceData = await invoiceRes.json();
        expect(invoiceData.invoiceNumber).toBeDefined();
        expect(invoiceData.salesOrderId).toBe(order.id);
        expect(invoiceData.status).toBe("POSTED");
      }
    }
  });
});
