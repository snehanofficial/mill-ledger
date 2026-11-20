/**
 * AUDIT-ONLY PLAYWRIGHT TEST
 * Task: Enumerate UI navigation items, direct URL access, and button parity per role
 * Standards: OWASP Top 10:2021 A01 (Broken Access Control), WCAG 2.2 AA
 */
import { test, expect } from "@playwright/test";
import fs from "node:fs";

const ROLES_CREDENTIALS = [
  { role: "ADMIN", email: "admin@millledger.local", pass: "AdminPassword123!" },
  { role: "SALESMAN", email: "salesman1@millledger.local", pass: "SalesmanPassword123!" },
  { role: "PRODUCTION", email: "production@millledger.local", pass: "ProductionPassword123!" },
  { role: "ACCOUNTANT", email: "accountant@millledger.local", pass: "AccountantPassword123!" },
  { role: "OWNER", email: "owner@millledger.local", pass: "OwnerPassword123!" },
];

const UI_ROUTES = [
  { path: "/dashboard", label: "Dashboard", allowedRoles: ["ADMIN", "OWNER"] },
  { path: "/orders", label: "Orders List", allowedRoles: ["ADMIN", "OWNER", "ACCOUNTANT", "SALESMAN"] },
  { path: "/orders/new", label: "New Order", allowedRoles: ["ADMIN", "SALESMAN"] },
  { path: "/invoices", label: "Invoices", allowedRoles: ["ADMIN", "OWNER", "ACCOUNTANT"] },
  { path: "/dispatch", label: "Dispatch", allowedRoles: ["ADMIN", "OWNER"] },
  { path: "/payments", label: "Payments", allowedRoles: ["ADMIN", "OWNER", "ACCOUNTANT"] },
  { path: "/stock", label: "Stock", allowedRoles: ["ADMIN", "OWNER", "ACCOUNTANT", "PRODUCTION"] },
  { path: "/purchases", label: "Purchases", allowedRoles: ["ADMIN", "OWNER", "ACCOUNTANT", "PRODUCTION"] },
  { path: "/production/today", label: "Production Today", allowedRoles: ["ADMIN", "OWNER", "PRODUCTION"] },
  { path: "/production/new", label: "New Run", allowedRoles: ["ADMIN", "PRODUCTION"] },
  { path: "/production/history", label: "Run History", allowedRoles: ["ADMIN", "OWNER", "PRODUCTION"] },
  { path: "/customers", label: "Customers", allowedRoles: ["ADMIN", "OWNER", "ACCOUNTANT", "SALESMAN"] },
  { path: "/reports/sales", label: "Report Sales", allowedRoles: ["ADMIN", "OWNER", "ACCOUNTANT", "SALESMAN"] },
  { path: "/reports/stock", label: "Report Stock", allowedRoles: ["ADMIN", "OWNER", "ACCOUNTANT", "SALESMAN", "PRODUCTION"] },
  { path: "/reports/production", label: "Report Production", allowedRoles: ["ADMIN", "OWNER", "ACCOUNTANT", "PRODUCTION"] },
  { path: "/reports/receivables", label: "Report Receivables", allowedRoles: ["ADMIN", "OWNER", "ACCOUNTANT"] },
  { path: "/reports/gst", label: "Report GST", allowedRoles: ["ADMIN", "OWNER", "ACCOUNTANT"] },
  { path: "/reports/audit", label: "Report Audit", allowedRoles: ["ADMIN", "OWNER", "ACCOUNTANT"] },
  { path: "/exports", label: "Exports", allowedRoles: ["ADMIN", "OWNER", "ACCOUNTANT"] },
  { path: "/settings", label: "Settings", allowedRoles: ["ADMIN", "OWNER"] },
];

interface MatrixRow {
  role: string;
  route: string;
  label: string;
  isPermitted: boolean;
  inNav: boolean;
  directAccessStatus: string;
  parityStatus: string;
  notes: string;
}

const matrixResults: MatrixRow[] = [];

test.describe("UI Role Parity & Route Protection Audit", () => {
  for (const cred of ROLES_CREDENTIALS) {
    test(`Verify UI Parity for Role: ${cred.role}`, async ({ page }) => {
      test.setTimeout(60000);
      await page.setViewportSize({ width: 1280, height: 800 });

      // 1. Sign in
      await page.goto("/auth/login");
      await page.fill('input#email', cred.email);
      await page.fill('input#password', cred.pass);
      await page.click('button[type="submit"]');

      // Wait for navigation away from login
      await page.waitForURL((url) => !url.pathname.includes("/auth/login"), { timeout: 10000 });
      await page.waitForTimeout(500);

      // 2. Enumerate visible sidebar navigation links
      const navHrefs = new Set<string>();
      const links = await page.locator('[data-slot="sidebar"] a').all();
      for (const link of links) {
        const href = await link.getAttribute("href");
        if (href && href.startsWith("/")) {
          navHrefs.add(href.split("?")[0]);
        }
      }
      console.log(`[${cred.role}] Visible Sidebar Nav Links (${navHrefs.size}):`, Array.from(navHrefs));

      // 3. Test every UI route via direct navigation
      for (const route of UI_ROUTES) {
        const isPermitted = route.allowedRoles.includes(cred.role);
        const inNav = navHrefs.has(route.path);

        // Navigate directly to route
        await page.goto(route.path);
        await page.waitForTimeout(150);

        const bodyText = await page.innerText("body");
        const has403Text = /403|forbidden|access denied|not authorized/i.test(bodyText);
        const has404Text = bodyText.includes("Page not found") || bodyText.includes("404");

        let directAccessStatus = "UNKNOWN";
        if (has403Text) {
          directAccessStatus = "403-FORBIDDEN-PAGE";
        } else if (has404Text) {
          directAccessStatus = "404-NOT-FOUND";
        } else {
          directAccessStatus = "SHELL-RENDERED";
        }

        let parityStatus = "PASS";
        let notes = "";

        if (inNav && !isPermitted) {
          parityStatus = "BUG-VISIBLE-BUT-FORBIDDEN";
          notes = "Route link rendered in sidebar navigation despite role lacking permission";
        } else if (!inNav && isPermitted) {
          parityStatus = "MISSING-FEATURE-PERMITTED-BUT-UNREACHABLE";
          notes = "Role is permitted but route has no link in sidebar navigation";
        } else if (!isPermitted && directAccessStatus === "SHELL-RENDERED") {
          parityStatus = "VULN-DIRECT-ACCESS-NO-403";
          notes = "Forbidden route renders full page shell without 403 guard page";
        }

        matrixResults.push({
          role: cred.role,
          route: route.path,
          label: route.label,
          isPermitted,
          inNav,
          directAccessStatus,
          parityStatus,
          notes,
        });
      }

      // 4. Test button parity on key operational pages
      if (cred.role === "ACCOUNTANT" || cred.role === "OWNER") {
        await page.goto("/orders");
        await page.waitForTimeout(200);
        const orderBody = await page.innerText("body");
        console.log(`[${cred.role}] /orders page text contains "New order":`, orderBody.includes("New order"));
        console.log(`[${cred.role}] /orders page text contains "Approve":`, orderBody.includes("Approve"));

        await page.goto("/invoices");
        await page.waitForTimeout(200);
        const invBody = await page.innerText("body");
        console.log(`[${cred.role}] /invoices page text contains "Credit note":`, invBody.includes("Credit note"));

        await page.goto("/payments");
        await page.waitForTimeout(200);
        const payBody = await page.innerText("body");
        console.log(`[${cred.role}] /payments page text contains "Record payment":`, payBody.includes("Record payment"));
      }
    });
  }

  test.afterAll(() => {
    // Generate CSV in audit/evidence/role-ui-route-matrix.csv
    const csvHeader = "Role,Route,Label,IsPermitted,InNav,DirectAccessStatus,ParityStatus,Notes\n";
    const csvRows = matrixResults
      .map(
        (r) =>
          `"${r.role}","${r.route}","${r.label}",${r.isPermitted},${r.inNav},"${r.directAccessStatus}","${r.parityStatus}","${r.notes}"`
      )
      .join("\n");

    fs.writeFileSync("audit/evidence/role-ui-route-matrix.csv", csvHeader + csvRows);
    console.log("Saved audit/evidence/role-ui-route-matrix.csv with", matrixResults.length, "rows");
  });
});
