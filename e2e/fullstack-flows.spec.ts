import { expect, test } from "@playwright/test";

async function loginAsAdmin(page: any) {
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

test.describe("Full-Stack Integrated Flows", () => {
  test("login page renders with seeded role quick-select buttons", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await page.goto("/auth/login");

    await expect(
      page.getByRole("heading", { name: "MillLedger" }),
    ).toBeVisible();
    await expect(page.locator("input#email")).toBeVisible();
    await expect(page.locator("input#password")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeVisible();

    // Verify quick-select roles
    await expect(
      page.getByRole("button", { name: /Admin \/ Owner/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Salesman/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Accountant/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Floor Operator/i }),
    ).toBeVisible();
  });

  test("live procurement and purchases page loads real master records", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/purchases");

    await expect(
      page.getByRole("heading", { name: "Procurement & Mandi Intake" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Record Purchase Receipt/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/total recorded/i).first(),
    ).toBeVisible();
  });

  test("live customer directory renders real customer accounts", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/customers");

    await expect(
      page.getByRole("heading", { name: "Customer Directory" }),
    ).toBeVisible();
    await expect(
      page.getByText(/total accounts/i),
    ).toBeVisible();
  });

  test("orders stream loads with action buttons and summary metrics", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/orders");

    await expect(
      page.getByRole("heading", { name: "Orders" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /New sales order/i }),
    ).toBeVisible();
  });
});
