import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createServer, type Server } from "node:http";
import { createApp } from "../../server/src/app.js";

describe("F-041 Regression Test: Role-Scoped Reports Tabs & 403 Prevention (Salesman & Production)", () => {
  const reportsPagePath = path.resolve(
    process.cwd(),
    "client/src/pages/reports-page.tsx",
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

  it("client/src/pages/reports-page.tsx filters report tabs based on current user role", () => {
    expect(fs.existsSync(reportsPagePath)).toBe(true);
    const content = fs.readFileSync(reportsPagePath, "utf-8");

    // Must connect to useCurrentUser
    expect(content).toContain("useCurrentUser");

    // Must define REPORT_TABS with role restrictions
    expect(content).toContain("REPORT_TABS");
    expect(content).toContain('"sales",\n    label: "Sales register",\n    roles: ["ADMIN", "SALESMAN", "ACCOUNTANT", "OWNER"]');
    expect(content).toContain('"gst",\n    label: "GST outward summary",\n    roles: ["ADMIN", "ACCOUNTANT", "OWNER"]');
    expect(content).toContain('"production",\n    label: "Production & variances",\n    roles: ["ADMIN", "PRODUCTION", "ACCOUNTANT", "OWNER"]');

    // Must compute allowedTabs and effectiveTab
    expect(content).toContain("allowedTabs = REPORT_TABS.filter");
    expect(content).toContain("allowedTabs.map");
    expect(content).toContain("effectiveTab");
  });

  it("Backend enforces scoping rules returning 403 for unpermitted reports", async () => {
    // 1. Sign in as salesman1
    const salesmanLogin = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "salesman1@millledger.local",
        password: "SalesmanPassword123!",
      }),
    });
    expect(salesmanLogin.status).toBe(200);
    const salesmanCookie = salesmanLogin.headers.get("set-cookie") || "";

    // Salesman CAN access sales and stock
    const salesRes = await fetch(`${baseUrl}/api/v1/reports/sales`, {
      headers: { Cookie: salesmanCookie },
    });
    expect(salesRes.status).toBe(200);

    const stockRes = await fetch(`${baseUrl}/api/v1/reports/stock`, {
      headers: { Cookie: salesmanCookie },
    });
    expect(stockRes.status).toBe(200);

    // Salesman CANNOT access GST, Audit, or Production (Must return 403)
    const gstRes = await fetch(`${baseUrl}/api/v1/reports/gst`, {
      headers: { Cookie: salesmanCookie },
    });
    expect(gstRes.status).toBe(403);

    const auditRes = await fetch(`${baseUrl}/api/v1/reports/audit`, {
      headers: { Cookie: salesmanCookie },
    });
    expect(auditRes.status).toBe(403);

    const prodRes = await fetch(`${baseUrl}/api/v1/reports/production`, {
      headers: { Cookie: salesmanCookie },
    });
    expect(prodRes.status).toBe(403);

    // 2. Sign in as production manager
    const prodLogin = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "production@millledger.local",
        password: "ProductionPassword123!",
      }),
    });
    expect(prodLogin.status).toBe(200);
    const prodCookie = prodLogin.headers.get("set-cookie") || "";

    // Production CAN access production and stock
    const pProdRes = await fetch(`${baseUrl}/api/v1/reports/production`, {
      headers: { Cookie: prodCookie },
    });
    expect(pProdRes.status).toBe(200);

    const pStockRes = await fetch(`${baseUrl}/api/v1/reports/stock`, {
      headers: { Cookie: prodCookie },
    });
    expect(pStockRes.status).toBe(200);

    // Production CANNOT access sales, GST, or audit
    const pSalesRes = await fetch(`${baseUrl}/api/v1/reports/sales`, {
      headers: { Cookie: prodCookie },
    });
    expect(pSalesRes.status).toBe(403);

    const pGstRes = await fetch(`${baseUrl}/api/v1/reports/gst`, {
      headers: { Cookie: prodCookie },
    });
    expect(pGstRes.status).toBe(403);
  });
});
