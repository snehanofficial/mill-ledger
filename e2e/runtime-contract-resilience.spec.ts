import { expect, test, type Page } from "@playwright/test";

async function loginAsAdmin(page: Page) {
  await page.goto("/auth/login");
  try {
    await page.waitForURL(/\/dashboard$/, { timeout: 3000 });
    return;
  } catch {
    // Session not active, proceed to sign in
  }
  const emailInput = page.locator("input#email");
  await emailInput.waitFor({ state: "visible", timeout: 10000 });
  await emailInput.fill("admin@millledger.local");
  await page.locator("input#password").fill("AdminPassword123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 10000 });
}

test.describe("System-Wide Runtime & Contract Resilience", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test("navigates all primary routes without uncaught .map() or runtime errors", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => {
      pageErrors.push(`${err.name}: ${err.message}`);
    });

    const routes = [
      "/dashboard",
      "/orders",
      "/orders/new",
      "/invoices",
      "/invoices/new",
      "/dispatch",
      "/dispatch/new",
      "/payments",
      "/payments/new",
      "/receivables",
      "/stock",
      "/purchases",
      "/purchases/new",
      "/suppliers",
      "/production/today",
      "/production/history",
      "/production/recipes",
      "/customers",
      "/products",
      "/reports",
      "/reports/sales",
      "/reports/gst",
      "/reports/stock",
      "/reports/production",
      "/reports/receivables",
      "/reports/audit",
      "/exports",
      "/settings",
    ];

    for (const route of routes) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(300);
      await expect(page.locator("body")).not.toContainText(
        /Cannot read properties of undefined|Application Error|This view hit an unexpected snag/i,
      );
    }

    expect(pageErrors).toEqual([]);
  });

  test("renders CustomerLedgerPage (/receivables/:customerId) without crashing", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => {
      pageErrors.push(`${err.name}: ${err.message}`);
    });

    await page.goto("/receivables");
    await page.waitForLoadState("networkidle");

    // Click first customer ledger link if present
    const ledgerLink = page.locator('a[href^="/receivables/"]').first();
    if ((await ledgerLink.count()) > 0) {
      await ledgerLink.click();
      await page.waitForLoadState("networkidle");
      await expect(page.locator("body")).not.toContainText(
        /Cannot read properties of undefined|Application Error/i,
      );
      await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Payments" })).toBeVisible();
    }

    expect(pageErrors).toEqual([]);
  });

  test("surfaces actionable ErrorState instead of crashing when API returns malformed collection payloads", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => {
      pageErrors.push(`${err.name}: ${err.message}`);
    });

    // Simulate malformed /sales/orders response (missing orders array)
    await page.route("**/api/v1/sales/orders*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ unexpected: true }),
      });
    });

    await page.goto("/orders");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("alert")).toContainText(/orders/i);
    await expect(page.locator("body")).not.toContainText(
      /Cannot read properties of undefined/i,
    );

    expect(pageErrors).toEqual([]);
  });

  test("surfaces ErrorState on /dashboard when /dashboard returns malformed nested arrays", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => {
      pageErrors.push(`${err.name}: ${err.message}`);
    });

    await page.route("**/api/v1/dashboard", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          dashboardTitle: "Broken",
          asOf: new Date().toISOString(),
          metrics: {},
          // recentInvoices and stockItems intentionally omitted
        }),
      });
    });

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(
      /Cannot read properties of undefined/i,
    );

    expect(pageErrors).toEqual([]);
  });
});
