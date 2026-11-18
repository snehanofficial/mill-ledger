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

  async function loginAndGetCookie(email: string, password: string): Promise<{ cookie: string; user: any }> {
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
      expect(data.error).toContain("Forbidden: Role ACCOUNTANT lacks permission create on order");
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

      // Attempt to update an order with creatorId set to salesman 2
      const crossUpdateResponse = await fetch(
        `${baseUrl}/api/v1/sales/orders/order-cross-test`,
        {
          method: "PUT",
          headers: {
            Cookie: cookie,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            creatorId: salesmanTwo!.id,
            status: "draft",
          }),
        },
      );

      expect(crossUpdateResponse.status).toBe(403);
      const crossData = await crossUpdateResponse.json();
      expect(crossData.error).toContain("Forbidden: Policy evaluation denied request");

      // Verify salesman 1 CAN update their own draft order
      const ownUpdateResponse = await fetch(
        `${baseUrl}/api/v1/sales/orders/order-own-test`,
        {
          method: "PUT",
          headers: {
            Cookie: cookie,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            creatorId: salesmanOne!.id,
            status: "draft",
          }),
        },
      );

      expect(ownUpdateResponse.status).toBe(200);
      const ownData = await ownUpdateResponse.json();
      expect(ownData.status).toBe("updated");
    });
  });
});
