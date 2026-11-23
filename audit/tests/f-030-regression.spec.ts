import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../server/src/app.js";
import { prisma } from "../../server/src/db/client.js";

describe("F-030 Regression Test: Sales Order Modification Input Validation (PUT /api/v1/sales/orders/:id)", () => {
  let server: Server;
  let baseUrl: string;
  let adminCookie: string;
  let draftOrderId: string;

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

    // Obtain an existing customer and variant
    const customer = await prisma.customer.findFirstOrThrow();
    const variant = await prisma.productVariant.findFirstOrThrow();

    // Create a draft sales order for testing
    const createRes = await fetch(`${baseUrl}/api/v1/sales/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        customerId: customer.id,
        status: "DRAFT",
        lines: [{ productVariantId: variant.id, quantity: 5 }],
      }),
    });
    const createData = (await createRes.json()) as { order?: { id: string } };
    draftOrderId = createData.order?.id ?? "";
    expect(draftOrderId).toBeTruthy();
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("rejects attempt to mutate status directly to APPROVED with HTTP 400", async () => {
    const res = await fetch(`${baseUrl}/api/v1/sales/orders/${draftOrderId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({ status: "APPROVED" }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain(
      "Draft orders can only be updated to DRAFT or SUBMITTED status",
    );
  });

  it("rejects invalid status enumeration string with HTTP 400 (never crashes with HTTP 500)", async () => {
    const res = await fetch(`${baseUrl}/api/v1/sales/orders/${draftOrderId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({ status: "NON_EXISTENT_ENUM_VALUE" }),
    });

    expect(res.status).toBe(400);
    const raw = await res.text();
    expect(raw).not.toContain("PrismaClient");
    expect(raw).not.toContain("Internal Server Error");
  });

  it("rejects numeric status types with HTTP 400 (never crashes with HTTP 500)", async () => {
    const res = await fetch(`${baseUrl}/api/v1/sales/orders/${draftOrderId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({ status: 12345 }),
    });

    expect(res.status).toBe(400);
    const raw = await res.text();
    expect(raw).not.toContain("PrismaClient");
    expect(raw).not.toContain("Internal Server Error");
  });

  it("rejects null status with HTTP 400", async () => {
    const res = await fetch(`${baseUrl}/api/v1/sales/orders/${draftOrderId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({ status: null }),
    });

    expect(res.status).toBe(400);
  });

  it("rejects unexpected arbitrary properties via strict schema validation", async () => {
    const res = await fetch(`${baseUrl}/api/v1/sales/orders/${draftOrderId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        notes: "Legal note",
        maliciousInjectedField: "attacker_payload",
      }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toMatch(/unrecognized/i);
  });

  it("accepts valid partial update to draft order and returns HTTP 200", async () => {
    const res = await fetch(`${baseUrl}/api/v1/sales/orders/${draftOrderId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        notes: "Updated delivery instructions for order",
        status: "SUBMITTED",
      }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      status: string;
      order: { notes: string; status: string };
    };
    expect(data.status).toBe("updated");
    expect(data.order.notes).toBe("Updated delivery instructions for order");
    expect(data.order.status).toBe("SUBMITTED");
  });
});
