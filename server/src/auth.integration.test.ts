import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { prisma } from "./db/client.js";

describe("Better Auth and permission integration", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
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
  ): Promise<{ cookie: string; user: any }> {
    const res = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const cookie = res.headers.get("set-cookie") ?? "";
    const body = await res.json();
    return { cookie, user: body.user };
  }

  describe("Authentication behavior (401)", () => {
    it("returns 401 Unauthorized when requesting /api/v1/me without a session cookie", async () => {
      const response = await fetch(`${baseUrl}/api/v1/me`);
      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.error).toContain("Session required");
    });

    it("rejects login with invalid password", async () => {
      const response = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "admin@millledger.local",
          password: "WrongPassword!",
        }),
      });

      expect(response.status).not.toBe(200);
    });

    it("logs in successfully with valid credentials and sets session cookie", async () => {
      const { cookie, user } = await loginAndGetCookie(
        "admin@millledger.local",
        "AdminPassword123!",
      );

      expect(cookie).toContain("better-auth");
      expect(user.email).toBe("admin@millledger.local");
      expect(user.role).toBe("ADMIN");

      // Verify authenticated /api/v1/me returns user context
      const meResponse = await fetch(`${baseUrl}/api/v1/me`, {
        headers: { Cookie: cookie },
      });
      expect(meResponse.status).toBe(200);

      const meData = await meResponse.json();
      expect(meData.user.email).toBe("admin@millledger.local");
      expect(meData.user.role).toBe("ADMIN");
      expect(meData.user.isActive).toBe(true);
    });

    it("accepts cross-origin sign-in from trusted CORS origin (MLD-001)", async () => {
      const response = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:5173",
        },
        body: JSON.stringify({
          email: "admin@millledger.local",
          password: "AdminPassword123!",
        }),
      });

      expect(response.status).toBe(200);
      const setCookie = response.headers.get("set-cookie");
      expect(setCookie).toBeTruthy();
      expect(setCookie).toContain("better-auth");
    });
  });

  describe("Auditor write prevention (403)", () => {
    it("prevents ACCOUNTANT role from calling write endpoints", async () => {
      const { cookie } = await loginAndGetCookie(
        "accountant@millledger.local",
        "AccountantPassword123!",
      );

      const response = await fetch(`${baseUrl}/api/v1/sales/orders`, {
        method: "POST",
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId: "cust-1",
          items: [],
        }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain(
        "Forbidden: Role ACCOUNTANT lacks permission create on order",
      );
    });
  });

  describe("Cross-salesman access isolation (403)", () => {
    it("denies salesman when updating another salesman's order", async () => {
      // Find salesman 1 and salesman 2 in database
      const salesmanOne = await prisma.user.findUnique({
        where: { email: "salesman1@millledger.local" },
      });
      const salesmanTwo = await prisma.user.findUnique({
        where: { email: "salesman2@millledger.local" },
      });

      expect(salesmanOne).toBeDefined();
      expect(salesmanTwo).toBeDefined();

      const { cookie } = await loginAndGetCookie(
        "salesman1@millledger.local",
        "SalesmanPassword123!",
      );

      const org = await prisma.organization.findFirstOrThrow();
      const customer = await prisma.customer.findFirstOrThrow();
      const warehouse = await prisma.warehouse.findFirstOrThrow();

      // Create real draft orders for salesman 1 and salesman 2
      const orderOne = await prisma.salesOrder.create({
        data: {
          organization: { connect: { id: org.id } },
          customer: { connect: { id: customer.id } },
          salesman: { connect: { id: salesmanOne!.id } },
          warehouse: { connect: { id: warehouse.id } },
          orderNumber: `ORD-TEST-S1-${Date.now()}`,
          deliveryState: "Tamil Nadu",
          status: "DRAFT",
          taxableAmount: 100,
          cgstAmount: 2.5,
          sgstAmount: 2.5,
          totalAmount: 105,
        },
      });

      const orderTwo = await prisma.salesOrder.create({
        data: {
          organization: { connect: { id: org.id } },
          customer: { connect: { id: customer.id } },
          salesman: { connect: { id: salesmanTwo!.id } },
          warehouse: { connect: { id: warehouse.id } },
          orderNumber: `ORD-TEST-S2-${Date.now()}`,
          deliveryState: "Tamil Nadu",
          status: "DRAFT",
          taxableAmount: 200,
          cgstAmount: 5,
          sgstAmount: 5,
          totalAmount: 210,
        },
      });

      // Attempt to update salesman 2's order with spoofed creatorId in body
      const crossUpdateResponse = await fetch(
        `${baseUrl}/api/v1/sales/orders/${orderTwo.id}`,
        {
          method: "PUT",
          headers: {
            Cookie: cookie,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            creatorId: salesmanOne!.id, // Spoofed creatorId
            status: "DRAFT",
            notes: "Spoofed update",
          }),
        },
      );

      expect(crossUpdateResponse.status).toBe(403);
      const crossData = await crossUpdateResponse.json();
      expect(crossData.error).toContain("Forbidden");

      // Verify salesman 1 CAN update their own draft order
      const ownUpdateResponse = await fetch(
        `${baseUrl}/api/v1/sales/orders/${orderOne.id}`,
        {
          method: "PUT",
          headers: {
            Cookie: cookie,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            creatorId: salesmanOne!.id,
            status: "DRAFT",
            notes: "Legitimate update",
          }),
        },
      );

      expect(ownUpdateResponse.status).toBe(200);
      const ownData = await ownUpdateResponse.json();
      expect(ownData.status).toBe("updated");
    });

    it("rejects inactive users with HTTP 403 Forbidden even with valid session (MLD-006)", async () => {
      // 1. Log in with an active user to obtain a genuine signed session cookie
      const { cookie, user } = await loginAndGetCookie(
        "production@millledger.local",
        "ProductionPassword123!",
      );

      // Verify the session works initially
      const initialRes = await fetch(`${baseUrl}/api/v1/me`, {
        headers: { Cookie: cookie },
      });
      expect(initialRes.status).toBe(200);

      // 2. Deactivate the user in the database
      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: false },
      });

      // 3. Attempt request with existing session cookie -> Must be rejected with 403 Forbidden
      const response = await fetch(`${baseUrl}/api/v1/me`, {
        headers: { Cookie: cookie },
      });

      // Restore user active status after test
      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: true },
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain("User account is inactive");
    });
  });

  describe("Multi-tenant isolation & BOLA prevention (MLD-002)", () => {
    it("rejects cross-tenant data access with HTTP 403 Forbidden when user requests a foreign organization", async () => {
      const { cookie } = await loginAndGetCookie(
        "admin@millledger.local",
        "AdminPassword123!",
      );

      // Verify normal access to user's own organization works
      const ownOrgRes = await fetch(`${baseUrl}/api/v1/dashboard?organizationId=MILL`, {
        headers: { Cookie: cookie },
      });
      expect(ownOrgRes.status).toBe(200);

      // Attempt to access a different organization ID (BOLA attack)
      const foreignOrgRes = await fetch(`${baseUrl}/api/v1/dashboard?organizationId=COMPETING_MILL_XYZ`, {
        headers: { Cookie: cookie },
      });

      expect(foreignOrgRes.status).toBe(403);
      const data = await foreignOrgRes.json();
      expect(data.error).toContain("Access denied to organization COMPETING_MILL_XYZ");
    });
  });
});
