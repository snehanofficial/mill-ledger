import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createServer, type Server } from "node:http";
import { createApp } from "../../server/src/app.js";

describe("F-040 Regression Test: Primary Navigation Links Point to Functional Screens (/orders/new, /exports, /settings)", () => {
  const appTsxPath = path.resolve(process.cwd(), "client/src/app.tsx");
  const exportsPagePath = path.resolve(
    process.cwd(),
    "client/src/pages/exports-page.tsx",
  );
  const settingsPagePath = path.resolve(
    process.cwd(),
    "client/src/pages/settings-page.tsx",
  );
  const newOrderPagePath = path.resolve(
    process.cwd(),
    "client/src/pages/new-order-page.tsx",
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

  it("client/src/app.tsx binds /orders/new, /exports, and /settings to production portal pages, not placeholders", () => {
    const appTsxContent = fs.readFileSync(appTsxPath, "utf-8");

    // Must import from dedicated pages
    expect(appTsxContent).toContain('import("@/pages/new-order-page")');
    expect(appTsxContent).toContain('import("@/pages/exports-page")');
    expect(appTsxContent).toContain('import("@/pages/settings-page")');

    // Must NOT bind any of these three to placeholder-pages
    expect(appTsxContent).not.toMatch(
      /import\("@\/pages\/placeholder-pages"\)\.then\(\(m\) => \(\{ default: m\.NewOrderPage \}\)\)/,
    );
    expect(appTsxContent).not.toMatch(
      /import\("@\/pages\/placeholder-pages"\)\.then\(\(m\) => \(\{ default: m\.ExportsPage \}\)\)/,
    );
    expect(appTsxContent).not.toMatch(
      /import\("@\/pages\/placeholder-pages"\)\.then\(\(m\) => \(\{ default: m\.SettingsPage \}\)\)/,
    );
  });

  it("client/src/pages/exports-page.tsx implements complete Data Export Hub with CSV/JSON triggers", () => {
    expect(fs.existsSync(exportsPagePath)).toBe(true);
    const content = fs.readFileSync(exportsPagePath, "utf-8");

    expect(content).toContain("Enterprise Data Export Hub");
    expect(content).toContain("/reports/export");
    expect(content).toContain("Sales Register");
    expect(content).toContain("GSTR-1 Outward Summary");
    expect(content).toContain("Stock Valuation & Inventory");
    expect(content).toContain("Production Runs & Yield Variances");
    expect(content).toContain("Security & Mutation Audit Log");
    expect(content).toContain("Download");
  });

  it("client/src/pages/settings-page.tsx implements Mill Profile, Statutory GST, and User Management", () => {
    expect(fs.existsSync(settingsPagePath)).toBe(true);
    const content = fs.readFileSync(settingsPagePath, "utf-8");

    expect(content).toContain("Mill Settings & Administration");
    expect(content).toContain("MillLedger Foods Pvt Ltd");
    expect(content).toContain("Tamil Nadu (State Code 33)");
    expect(content).toContain("21069099");
    expect(content).toContain("Weighted-Average Costing");
    expect(content).toContain("Section 170 CGST Act");
    expect(content).toContain("User & Role Management");
    expect(content).toContain("/users");
    expect(content).toContain("Data Protection (DPDP 2023)");
  });

  it("Backend supports export generation and user listing for admin session", async () => {
    // 1. Login as admin
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

    // 2. Test export endpoint
    const exportRes = await fetch(`${baseUrl}/api/v1/reports/export`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify({
        reportType: "sales",
        format: "csv",
        organizationId: "MILL",
      }),
    });
    expect(exportRes.status).toBe(200);
    expect(exportRes.headers.get("content-type")).toContain("text/csv");

    // 3. Test user listing endpoint
    const usersRes = await fetch(`${baseUrl}/api/v1/users`, {
      headers: { Cookie: cookie },
    });
    expect(usersRes.status).toBe(200);
    const usersData = await usersRes.json();
    expect(Array.isArray(usersData.users)).toBe(true);
    expect(usersData.users.length).toBeGreaterThan(0);
  });
});
