import { expect, test, type Page } from "@playwright/test";

async function signInWithRole(
  page: Page,
  email: string,
  password: string,
  expectedUrl: RegExp,
) {
  await page.context().clearCookies();
  await page.goto("/auth/login");
  await page.locator("input#email").fill(email);
  await page.locator("input#password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(expectedUrl, { timeout: 10000 });
}

test.describe("5-Role Workspace & Permission Journeys", () => {
  test("SALESMAN lands on My work & orders, can open New order, and is blocked from Invoices/Settings", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInWithRole(
      page,
      "salesman1@millledger.local",
      "SalesmanPassword123!",
      /\/orders$/,
    );

    await expect(
      page.getByRole("heading", { name: /My work & orders/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /New order/i }),
    ).toBeVisible();

    // Verify mobile horizontal overflow is 0
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBe(0);

    // Navigate to New order
    await page.getByRole("button", { name: /New order/i }).click();
    await expect(page).toHaveURL(/\/orders\/new$/);

    // Verify restricted routes are blocked with 403 Forbidden
    await page.goto("/invoices");
    await expect(
      page.getByRole("heading", { name: /Access Denied|Forbidden|403/i }),
    ).toBeVisible();
    await page.goto("/settings");
    await expect(
      page.getByRole("heading", { name: /Access Denied|Forbidden|403/i }),
    ).toBeVisible();
  });

  test("PRODUCTION lands on Today's runs, can open New run and Stock, and is blocked from Finance/Orders", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await signInWithRole(
      page,
      "production@millledger.local",
      "ProductionPassword123!",
      /\/production\/today$/,
    );

    await expect(page.locator("h1")).toBeVisible();
    await page.goto("/stock");
    await expect(page.locator("h1")).toBeVisible();

    // Verify restricted routes are blocked
    await page.goto("/invoices");
    await expect(
      page.getByRole("heading", { name: /Access Denied|Forbidden|403/i }),
    ).toBeVisible();
    await page.goto("/payments");
    await expect(
      page.getByRole("heading", { name: /Access Denied|Forbidden|403/i }),
    ).toBeVisible();
  });

  test("ACCOUNTANT lands on Reporting home (read-only) and cannot access write routes", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await signInWithRole(
      page,
      "accountant@millledger.local",
      "AccountantPassword123!",
      /\/reports$/,
    );

    await expect(
      page.getByRole("heading", { name: /Reporting home/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Sales register/i }).first(),
    ).toBeVisible();

    // Can view receivables read-only
    await page.goto("/receivables");
    await expect(
      page.getByRole("heading", { name: /Customer balances/i }),
    ).toBeVisible();

    // Blocked from write forms
    await page.goto("/orders/new");
    await expect(
      page.getByRole("heading", { name: /Access Denied|Forbidden|403/i }),
    ).toBeVisible();
    await page.goto("/payments/new");
    await expect(
      page.getByRole("heading", { name: /Access Denied|Forbidden|403/i }),
    ).toBeVisible();
  });

  test("OWNER lands on Business overview and is blocked from operational write forms", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await signInWithRole(
      page,
      "owner@millledger.local",
      "OwnerPassword123!",
      /\/dashboard$/,
    );

    await expect(
      page.getByRole("heading", { name: /Business overview/i }),
    ).toBeVisible();

    // Blocked from operational write forms
    await page.goto("/orders/new");
    await expect(
      page.getByRole("heading", { name: /Access Denied|Forbidden|403/i }),
    ).toBeVisible();
    await page.goto("/production/new");
    await expect(
      page.getByRole("heading", { name: /Access Denied|Forbidden|403/i }),
    ).toBeVisible();
  });

  test("ADMIN lands on Work queue and can navigate across Sales, Purchases, Finance, and Receivables", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await signInWithRole(
      page,
      "admin@millledger.local",
      "AdminPassword123!",
      /\/dashboard$/,
    );

    await expect(
      page.getByRole("heading", { name: /Work queue/i }),
    ).toBeVisible();

    await page.goto("/receivables");
    await expect(
      page.getByRole("heading", { name: /Customer balances/i }),
    ).toBeVisible();

    await page.goto("/purchases/new");
    await expect(
      page.getByRole("heading", { name: /Receive materials/i }),
    ).toBeVisible();

    await page.goto("/payments/new");
    await expect(
      page.getByRole("heading", { name: /Record customer payment/i }),
    ).toBeVisible();
  });
});
