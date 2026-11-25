import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer, type Server } from "node:http";
import { createApp } from "../../server/src/app.js";
import { prisma } from "../../server/src/db/client.js";
import { userService } from "../../server/src/modules/auth/user.service.js";

describe("F-106 Regression Test: DPDP Act 2023 Compliance & Data Retention", () => {
  let server: Server;
  let baseUrl: string;
  let adminCookie: string;
  let salesmanCookie: string;
  let salesmanId: string;
  let testCustomer: any;

  beforeEach(async () => {
    const app = createApp();
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;

    // Admin login
    const adminRes = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" },
      body: JSON.stringify({ email: "admin@millledger.local", password: "AdminPassword123!" }),
    });
    expect(adminRes.status).toBe(200);
    adminCookie = adminRes.headers.get("set-cookie")?.split(";")[0] || "";

    // Salesman login
    const smRes = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" },
      body: JSON.stringify({ email: "salesman1@millledger.local", password: "SalesmanPassword123!" }),
    });
    expect(smRes.status).toBe(200);
    salesmanCookie = smRes.headers.get("set-cookie")?.split(";")[0] || "";

    const smUser = await prisma.user.findFirstOrThrow({
      where: { email: "salesman1@millledger.local" },
    });
    salesmanId = smUser.id;

    // Create a customer with contact PII and transactional history
    const org = await prisma.organization.findFirstOrThrow();
    const warehouse = await prisma.warehouse.findFirstOrThrow();
    testCustomer = await prisma.customer.create({
      data: {
        organization: { connect: { id: org.id } },
        code: `DPDP-TEST-${Date.now()}`,
        name: "Test Retailer Principal",
        phone: "9876543210",
        email: "retailer@example.com",
        state: "Tamil Nadu",
        gstin: "33AAAAA0000A1Z5",
        assignments: {
          create: {
            salesmanId,
          },
        },
      },
    });

    // Create an order referencing this customer
    await prisma.salesOrder.create({
      data: {
        organization: { connect: { id: org.id } },
        warehouse: { connect: { id: warehouse.id } },
        customer: { connect: { id: testCustomer.id } },
        salesman: { connect: { id: salesmanId } },
        orderNumber: `SO-DPDP-${Date.now()}`,
        status: "SUBMITTED",
        taxableAmount: 100,
        cgstAmount: 2.5,
        sgstAmount: 2.5,
        totalTaxAmount: 5,
        totalAmount: 105,
      },
    });
  });

  afterEach(async () => {
    try {
      await prisma.salesOrder.deleteMany({
        where: { orderNumber: { startsWith: "SO-DPDP-" } },
      });
      await prisma.salesmanCustomerAssignment.deleteMany({
        where: { customer: { code: { startsWith: "DPDP-" } } },
      });
      await prisma.customer.deleteMany({
        where: { code: { startsWith: "DPDP-" } },
      });
    } catch {
      // ignore cleanup errors in case tables are locked
    }
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("exports customer data summary under DPDP Act Section 11 (Right to Access)", async () => {
    const res = await fetch(`${baseUrl}/api/v1/sales/customers/${testCustomer.id}/data-export`, {
      headers: { Cookie: adminCookie, Origin: "http://localhost:5173" },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("success");
    expect(json.data.statutoryReference).toContain("DPDP Act 2023 Section 11");
    expect(json.data.profile.name).toBe("Test Retailer Principal");
    expect(json.data.profile.phone).toBe("9876543210");
    expect(json.data.profile.email).toBe("retailer@example.com");
    expect(json.data.documentSummary.ordersCount).toBeGreaterThanOrEqual(1);

    // Verify audit log entry
    const auditRecord = await prisma.auditLog.findFirst({
      where: {
        action: "EXPORT",
        entity: "Customer",
        entityId: testCustomer.id,
      },
    });
    expect(auditRecord).toBeDefined();
  });

  it("enforces ABAC scoping on customer data export: unassigned salesman is blocked", async () => {
    // Create unassigned customer
    const org = await prisma.organization.findFirstOrThrow();
    const unassignedCust = await prisma.customer.create({
      data: {
        organizationId: org.id,
        code: `DPDP-UNASSIGNED-${Date.now()}`,
        name: "Unassigned Customer",
        phone: "9123456789",
        email: "unassigned@example.com",
      },
    });

    const res = await fetch(`${baseUrl}/api/v1/sales/customers/${unassignedCust.id}/data-export`, {
      headers: { Cookie: salesmanCookie, Origin: "http://localhost:5173" },
    });

    expect(res.status).toBe(403);
  });

  it("anonymizes customer PII under DPDP Act Section 12 without breaking historical FK references", async () => {
    const res = await fetch(`${baseUrl}/api/v1/sales/customers/${testCustomer.id}/anonymize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie, Origin: "http://localhost:5173" },
      body: JSON.stringify({ reason: "Customer requested account deletion" }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("anonymized");
    expect(json.customer.name).toBe("ANONYMIZED_CUSTOMER");
    expect(json.customer.phone).toBeNull();
    expect(json.customer.email).toBeNull();
    expect(json.customer.gstin).toBeNull();
    expect(json.customer.isActive).toBe(false);

    // Verify database record
    const updated = await prisma.customer.findUnique({
      where: { id: testCustomer.id },
    });
    expect(updated?.name).toBe("ANONYMIZED_CUSTOMER");
    expect(updated?.phone).toBeNull();
    expect(updated?.email).toBeNull();
    expect(updated?.isActive).toBe(false);

    // Verify assignments were pruned
    const assignments = await prisma.salesmanCustomerAssignment.count({
      where: { customerId: testCustomer.id },
    });
    expect(assignments).toBe(0);

    // Verify historical sales orders still retain FK integrity
    const orders = await prisma.salesOrder.findMany({
      where: { customerId: testCustomer.id },
    });
    expect(orders.length).toBeGreaterThanOrEqual(1);

    // Verify audit log entry
    const auditRecord = await prisma.auditLog.findFirst({
      where: {
        action: "ANONYMIZE",
        entity: "Customer",
        entityId: testCustomer.id,
      },
    });
    expect(auditRecord).toBeDefined();
    expect(auditRecord?.details).toContain("Customer requested account deletion");
  });

  it("blocks non-admin/owner roles from executing customer anonymization", async () => {
    const res = await fetch(`${baseUrl}/api/v1/sales/customers/${testCustomer.id}/anonymize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: salesmanCookie, Origin: "http://localhost:5173" },
      body: JSON.stringify({ reason: "Unauthorized attempt" }),
    });

    expect(res.status).toBe(403);
  });

  it("purges expired sessions via automated cleanup procedure", async () => {
    const user = await prisma.user.findFirstOrThrow();
    const expiredToken = `expired-token-${Date.now()}`;

    // Insert an expired session
    await prisma.session.create({
      data: {
        userId: user.id,
        token: expiredToken,
        expiresAt: new Date(Date.now() - 3600 * 1000), // 1 hour ago
      },
    });

    const cleanupResult = await userService.cleanupExpiredSessions();
    expect(cleanupResult.deletedCount).toBeGreaterThanOrEqual(1);

    const check = await prisma.session.findUnique({
      where: { token: expiredToken },
    });
    expect(check).toBeNull();
  });
});
