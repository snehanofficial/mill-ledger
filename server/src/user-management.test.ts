import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import { createApp } from "./app.js";
import { prisma } from "./db/client.js";
import { bootstrapAdmin } from "./scripts/bootstrap-admin.js";
import { seedUsers } from "./db/seed.js";

describe("F-023: User and Role Management APIs and Admin Safeguards", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    await seedUsers();
    // Clean up any lingering test users from prior interrupted runs
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            "f023-newuser@millledger.local",
            "f023-admin2@millledger.local",
            "f023-deletable@millledger.local",
          ],
        },
      },
    });

    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === "object") {
          baseUrl = `http://localhost:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    // Cleanup temporary test accounts and test order
    await prisma.salesOrder.deleteMany({
      where: { orderNumber: "SO-TEST-F023" },
    });
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [
            "f023-newuser@millledger.local",
            "f023-admin2@millledger.local",
            "f023-deletable@millledger.local",
          ],
        },
      },
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

  it("rejects unauthenticated requests to /api/v1/users with 401", async () => {
    const res = await fetch(`${baseUrl}/api/v1/users`);
    expect(res.status).toBe(401);
  });

  it("rejects non-admin role (SALESMAN) attempting to list users with 403 Forbidden", async () => {
    const salesmanCookie = await loginAndGetCookie(
      "salesman1@millledger.local",
      "SalesmanPassword123!",
    );

    const res = await fetch(`${baseUrl}/api/v1/users`, {
      headers: { Cookie: salesmanCookie },
    });
    expect(res.status).toBe(403);
  });

  it("allows ADMIN to list users via /api/v1/users and /api/v1/admin/users", async () => {
    const adminCookie = await loginAndGetCookie(
      "admin@millledger.local",
      "AdminPassword123!",
    );

    const res1 = await fetch(`${baseUrl}/api/v1/users`, {
      headers: { Cookie: adminCookie },
    });
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(Array.isArray(data1.users)).toBe(true);
    expect(data1.users.length).toBeGreaterThan(0);

    // Also verify alias /api/v1/admin/users
    const res2 = await fetch(`${baseUrl}/api/v1/admin/users`, {
      headers: { Cookie: adminCookie },
    });
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(Array.isArray(data2.users)).toBe(true);
  });

  it("rejects SALESMAN attempting to create a user with 403 Forbidden", async () => {
    const salesmanCookie = await loginAndGetCookie(
      "salesman1@millledger.local",
      "SalesmanPassword123!",
    );

    const res = await fetch(`${baseUrl}/api/v1/users`, {
      method: "POST",
      headers: {
        Cookie: salesmanCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Unauthorized Create",
        email: "unauth@millledger.local",
        password: "Password123!",
        role: "SALESMAN",
      }),
    });
    expect(res.status).toBe(403);
  });

  it("allows ADMIN to create a new user and provisions credentials properly", async () => {
    const adminCookie = await loginAndGetCookie(
      "admin@millledger.local",
      "AdminPassword123!",
    );

    const res = await fetch(`${baseUrl}/api/v1/users`, {
      method: "POST",
      headers: {
        Cookie: adminCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "F023 New Staff",
        email: "f023-newuser@millledger.local",
        password: "StaffPassword123!",
        role: "ACCOUNTANT",
      }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe("f023-newuser@millledger.local");
    expect(data.user.role).toBe("ACCOUNTANT");
    expect(data.user.isActive).toBe(true);
    expect(data.user.password).toBeUndefined(); // Sensitive credentials never returned

    // Verify newly created user can log in
    const staffCookie = await loginAndGetCookie(
      "f023-newuser@millledger.local",
      "StaffPassword123!",
    );
    expect(staffCookie).toContain("better-auth");
  });

  it("prevents demoting or deactivating the last remaining administrator (OD-02 Last-Admin Safeguard)", async () => {
    const adminCookie = await loginAndGetCookie(
      "admin@millledger.local",
      "AdminPassword123!",
    );

    const adminUser = await prisma.user.findUniqueOrThrow({
      where: { email: "admin@millledger.local" },
    });

    // Attempt to demote sole admin to SALESMAN
    const demoteRes = await fetch(`${baseUrl}/api/v1/users/${adminUser.id}`, {
      method: "PUT",
      headers: {
        Cookie: adminCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role: "SALESMAN",
      }),
    });

    expect(demoteRes.status).toBe(400);
    const demoteData = await demoteRes.json();
    expect(demoteData.message).toContain("last remaining administrator");

    // Attempt to deactivate sole admin
    const deactRes = await fetch(`${baseUrl}/api/v1/users/${adminUser.id}`, {
      method: "PUT",
      headers: {
        Cookie: adminCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        isActive: false,
      }),
    });

    expect(deactRes.status).toBe(400);
    const deactData = await deactRes.json();
    expect(deactData.message).toContain("last remaining administrator");

    // Attempt to delete sole admin
    const delRes = await fetch(`${baseUrl}/api/v1/users/${adminUser.id}`, {
      method: "DELETE",
      headers: {
        Cookie: adminCookie,
      },
    });

    expect(delRes.status).toBe(400);
    const delData = await delRes.json();
    expect(delData.message).toContain("last remaining administrator");
  });

  it("allows demoting or deleting an admin when multiple active admins exist", async () => {
    const adminCookie = await loginAndGetCookie(
      "admin@millledger.local",
      "AdminPassword123!",
    );

    // Create a second admin
    const createRes = await fetch(`${baseUrl}/api/v1/users`, {
      method: "POST",
      headers: {
        Cookie: adminCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Second Admin",
        email: "f023-admin2@millledger.local",
        password: "Admin2Password123!",
        role: "ADMIN",
      }),
    });
    expect(createRes.status).toBe(201);
    const createData = await createRes.json();
    const admin2Id = createData.user.id;

    // Demoting second admin should succeed because primary admin remains active
    const demoteRes = await fetch(`${baseUrl}/api/v1/users/${admin2Id}`, {
      method: "PUT",
      headers: {
        Cookie: adminCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role: "ACCOUNTANT",
      }),
    });
    expect(demoteRes.status).toBe(200);
    const demoteData = await demoteRes.json();
    expect(demoteData.user.role).toBe("ACCOUNTANT");

    // Deleting second user should succeed now that they are not last admin and have no operational records
    const delRes = await fetch(`${baseUrl}/api/v1/users/${admin2Id}`, {
      method: "DELETE",
      headers: {
        Cookie: adminCookie,
      },
    });
    expect(delRes.status).toBe(200);
  });

  it("protects operational referential integrity: blocks deleting a user with sales records", async () => {
    const adminCookie = await loginAndGetCookie(
      "admin@millledger.local",
      "AdminPassword123!",
    );

    // salesman1 has existing sales orders (seed if missing)
    const salesman1 = await prisma.user.findUniqueOrThrow({
      where: { email: "salesman1@millledger.local" },
    });

    const orderCount = await prisma.salesOrder.count({
      where: { salesmanId: salesman1.id },
    });
    if (orderCount === 0) {
      const customer = await prisma.customer.findFirstOrThrow();
      const warehouse = await prisma.warehouse.findFirstOrThrow();
      await prisma.salesOrder.create({
        data: {
          organization: { connect: { id: customer.organizationId } },
          customer: { connect: { id: customer.id } },
          salesman: { connect: { id: salesman1.id } },
          warehouse: { connect: { id: warehouse.id } },
          orderNumber: "SO-TEST-F023",
          deliveryState: "Tamil Nadu",
          status: "DRAFT",
          taxableAmount: 100,
          cgstAmount: 2.5,
          sgstAmount: 2.5,
          totalAmount: 105,
        },
      });
    }

    const res = await fetch(`${baseUrl}/api/v1/users/${salesman1.id}`, {
      method: "DELETE",
      headers: {
        Cookie: adminCookie,
      },
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain("operational records");
  });

  it("verifies admin:bootstrap refuses execution if an active admin already exists (OD-02)", async () => {
    process.env.NODE_ENV = "test";
    const result = await bootstrapAdmin();
    expect(result.success).toBe(false);
    expect(result.reason).toBe("ADMIN_ALREADY_EXISTS");
  });
});
