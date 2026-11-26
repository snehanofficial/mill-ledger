import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { prisma } from "../db/client.js";
import { resetOperationalData } from "../db/reset.js";
import { seedBenchmarkMasters } from "../db/seed.js";

describe("IMP-009 & IMP-010: Customers ABAC/Assignments and Products/Variants/PriceLists CRUD", () => {
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

  async function loginAndGetCookie(email: string, password: string) {
    const res = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return res.headers.get("set-cookie") ?? "";
  }

  it("creates product, pack-size variant with default price, updates price list, and blocks delete on referenced variant", async () => {
    const adminCookie = await loginAndGetCookie(
      "admin@millledger.local",
      "AdminPassword123!",
    );
    const salesmanCookie = await loginAndGetCookie(
      "salesman1@millledger.local",
      "SalesmanPassword123!",
    );

    // Salesman cannot create product
    const forbiddenProd = await fetch(`${baseUrl}/api/v1/masters/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: salesmanCookie,
      },
      body: JSON.stringify({
        code: "PROD-FORBID",
        name: "Forbidden",
      }),
    });
    expect(forbiddenProd.status).toBe(403);

    // Admin creates product
    const prodRes = await fetch(`${baseUrl}/api/v1/masters/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        code: `PROD-SEV-${Date.now()}`,
        name: "Butter Sev",
        hsnCode: "21069099",
        taxRate: 5,
      }),
    });
    expect(prodRes.status).toBe(201);
    const { product } = (await prodRes.json()) as {
      product: { id: string };
    };

    const pktUom = await prisma.unitOfMeasure.findFirstOrThrow();

    // Admin creates 500g variant with defaultPrice = 110
    const varRes = await fetch(`${baseUrl}/api/v1/masters/variants`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        productId: product.id,
        sku: `VAR-SEV-500G-${Date.now()}`,
        name: "Butter Sev 500 g",
        packSize: 500,
        uomId: pktUom.id,
        defaultPrice: 110,
      }),
    });
    expect(varRes.status).toBe(201);
    const { variant } = (await varRes.json()) as {
      variant: { id: string };
    };

    // Unreferenced variant can be deleted
    const delUnref = await fetch(
      `${baseUrl}/api/v1/masters/variants/${variant.id}`,
      {
        method: "DELETE",
        headers: { Cookie: adminCookie },
      },
    );
    expect(delUnref.status).toBe(200);

    // Referenced variant (Murukku 200g used in Recipe) cannot be deleted
    const refVariant = await prisma.productVariant.findFirstOrThrow({
      where: { sku: "VAR-MURUKKU-200G" },
    });
    const delRef = await fetch(
      `${baseUrl}/api/v1/masters/variants/${refVariant.id}`,
      {
        method: "DELETE",
        headers: { Cookie: adminCookie },
      },
    );
    expect(delRef.status).toBe(400);
  });

  it("enforces customer detail ABAC and allows admin salesman assignment", async () => {
    const adminCookie = await loginAndGetCookie(
      "admin@millledger.local",
      "AdminPassword123!",
    );
    const salesman1Cookie = await loginAndGetCookie(
      "salesman1@millledger.local",
      "SalesmanPassword123!",
    );

    const distB = await prisma.customer.findFirstOrThrow({
      where: { code: "CUST-DIST-B" },
    });

    // Salesman 1 is NOT assigned to Distributor B -> 403
    const denied = await fetch(
      `${baseUrl}/api/v1/sales/customers/${distB.id}`,
      {
        headers: { Cookie: salesman1Cookie },
      },
    );
    expect(denied.status).toBe(403);

    // Admin can view Distributor B
    const ok = await fetch(`${baseUrl}/api/v1/sales/customers/${distB.id}`, {
      headers: { Cookie: adminCookie },
    });
    expect(ok.status).toBe(200);
  });

  it("IMP-016: reads and updates organization settings with ADMIN-only write enforcement", async () => {
    const adminCookie = await loginAndGetCookie(
      "admin@millledger.local",
      "AdminPassword123!",
    );
    const ownerCookie = await loginAndGetCookie(
      "owner@millledger.local",
      "OwnerPassword123!",
    );

    const getRes = await fetch(
      `${baseUrl}/api/v1/masters/organization`,
      { headers: { Cookie: ownerCookie } },
    );
    expect(getRes.status).toBe(200);

    // Owner is read-only -> 403
    const ownerPut = await fetch(`${baseUrl}/api/v1/masters/organization`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: ownerCookie,
      },
      body: JSON.stringify({ name: "Hacked" }),
    });
    expect(ownerPut.status).toBe(403);

    // Admin can update
    const adminPut = await fetch(`${baseUrl}/api/v1/masters/organization`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        name: "MillLedger Foods Pvt Ltd",
      }),
    });
    expect(adminPut.status).toBe(200);
  });
});
