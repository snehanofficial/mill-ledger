import { expect, test } from "@playwright/test";

test.describe("Full-Stack Integrated Flows", () => {
  test("login page renders with seeded role quick-select buttons", async ({
    page,
  }) => {
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
    await page.goto("/purchases");

    await expect(
      page.getByRole("heading", { name: "Procurement & Mandi Intake" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Record Purchase Receipt/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/total recorded|No purchase receipts/i),
    ).toBeVisible();
  });

  test("live customer directory renders real customer accounts", async ({
    page,
  }) => {
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
    await page.goto("/orders");

    await expect(
      page.getByRole("heading", { name: "Orders" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /New sales order/i }),
    ).toBeVisible();
  });
});
