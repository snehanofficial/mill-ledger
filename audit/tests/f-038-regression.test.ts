import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createServer, type Server } from "node:http";
import { createApp } from "../../server/src/app.js";
import { prisma } from "../../server/src/db/client.js";

describe("F-038 Regression Test: Supplier Master Data Management API & UI", () => {
  const suppliersPagePath = path.resolve(
    process.cwd(),
    "client/src/pages/suppliers-page.tsx",
  );
  const appTsxPath = path.resolve(process.cwd(), "client/src/app.tsx");
  const navConfigPath = path.resolve(
    process.cwd(),
    "client/src/components/shell/nav-config.tsx",
  );
  const purchasesPagePath = path.resolve(
    process.cwd(),
    "client/src/pages/purchases-page.tsx",
  );

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

  it("UI components and routing are registered for supplier management", () => {
    expect(fs.existsSync(suppliersPagePath)).toBe(true);
    const suppliersPageContent = fs.readFileSync(suppliersPagePath, "utf-8");
    expect(suppliersPageContent).toContain("Supplier Directory");
    expect(suppliersPageContent).toContain("Add Supplier");
    expect(suppliersPageContent).toContain("Edit Supplier");
    expect(suppliersPageContent).toContain("/inventory/suppliers");

    const appTsxContent = fs.readFileSync(appTsxPath, "utf-8");
    expect(appTsxContent).toContain('path: "suppliers"');
    expect(appTsxContent).toContain("<SuppliersPage />");

    const navConfigContent = fs.readFileSync(navConfigPath, "utf-8");
    expect(navConfigContent).toContain('label: "Suppliers"');
    expect(navConfigContent).toContain('href: "/suppliers"');

    const purchasesPageContent = fs.readFileSync(purchasesPagePath, "utf-8");
    expect(purchasesPageContent).toContain('to="/suppliers"');
    expect(purchasesPageContent).toContain("Manage Suppliers");
  });

  it("POST /api/v1/inventory/suppliers creates a supplier and enforces duplicate code check", async () => {
    // Sign in as admin
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

    const testCode = `SUP-TEST-${Date.now().toString().slice(-4)}`;
    const createPayload = {
      organizationId: "MILL",
      code: testCode,
      name: "Kongu Agro Mandi Traders",
      state: "Tamil Nadu",
      gstin: "33AABCS3456J1Z4",
      phone: "+91 98765 43210",
      email: "kongu@mandi.test",
    };

    // 1. Create supplier
    const createRes = await fetch(`${baseUrl}/api/v1/inventory/suppliers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify(createPayload),
    });
    expect(createRes.status).toBe(201);
    const createdData = await createRes.json();
    expect(createdData.supplier).toBeDefined();
    expect(createdData.supplier.code).toBe(testCode);
    expect(createdData.supplier.name).toBe("Kongu Agro Mandi Traders");
    expect(createdData.supplier.gstin).toBe("33AABCS3456J1Z4");

    const supplierId = createdData.supplier.id;

    // 2. Duplicate code rejection (409)
    const dupRes = await fetch(`${baseUrl}/api/v1/inventory/suppliers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify(createPayload),
    });
    expect(dupRes.status).toBe(409);

    // 3. GET /api/v1/inventory/suppliers/:id
    const getRes = await fetch(`${baseUrl}/api/v1/inventory/suppliers/${supplierId}`, {
      headers: { Cookie: cookie },
    });
    expect(getRes.status).toBe(200);
    const fetchedData = await getRes.json();
    expect(fetchedData.supplier.id).toBe(supplierId);
    expect(fetchedData.supplier.code).toBe(testCode);

    // 4. PUT /api/v1/inventory/suppliers/:id updates supplier
    const updateRes = await fetch(`${baseUrl}/api/v1/inventory/suppliers/${supplierId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        name: "Kongu Agro Mandi Traders Updated",
        phone: "+91 99999 88888",
      }),
    });
    expect(updateRes.status).toBe(200);
    const updatedData = await updateRes.json();
    expect(updatedData.supplier.name).toBe("Kongu Agro Mandi Traders Updated");
    expect(updatedData.supplier.phone).toBe("+91 99999 88888");

    // Clean up test supplier
    await prisma.supplier.delete({ where: { id: supplierId } });
  });

  it("POST /api/v1/inventory/suppliers rejects unauthenticated requests with 401", async () => {
    const res = await fetch(`${baseUrl}/api/v1/inventory/suppliers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: "MILL",
        code: "UNAUTH-1",
        name: "Unauth Supplier",
        state: "Tamil Nadu",
      }),
    });
    expect(res.status).toBe(401);
  });
});
