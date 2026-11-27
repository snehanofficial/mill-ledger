import { expect, test } from "@playwright/test";

const DEMO_EMAIL = "demo.admin@millledger.example";
const DEMO_PASSWORD = "DemoAdmin123!";

async function loginAsDemoAdmin(page: any) {
  await page.context().clearCookies();
  await page.goto("/auth/login");
  const emailInput = page.locator("input#email");
  await emailInput.waitFor({ state: "visible", timeout: 10000 });
  await emailInput.fill(DEMO_EMAIL);
  await page.locator("input#password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/dashboard$/, { timeout: 15000 });
}

test.describe("MillLedger Demo Foods — End-to-End UI & Export Verification", () => {
  test("verifies dashboard, masters, orders, invoices, payments, timelines, search, and exports with zero runtime errors", async ({
    page,
  }) => {
    test.setTimeout(60000);
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => {
      pageErrors.push(err.message);
    });

    await loginAsDemoAdmin(page);

    // 1. Dashboard
    await page.goto("/dashboard");
    await expect(page.locator("main")).toBeVisible();
    await page.waitForLoadState("networkidle");

    // 2. Customers + search + detail timeline
    await page.goto("/customers");
    await expect(page.getByText("Green Basket Retailers").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Sri Annapoorna Foods").first()).toBeVisible();
    await expect(page.getByText("Kaveri Wholesale Mart").first()).toBeVisible();

    const custSearch = page.getByPlaceholder(/search/i).first();
    if (await custSearch.isVisible()) {
      await custSearch.fill("Green Basket");
      await page.waitForTimeout(400);
      await expect(page.getByText("Green Basket Retailers").first()).toBeVisible();
    }

    await page.getByRole("button", { name: "View Green Basket Retailers" }).click();
    const custDetailLink = page.locator("a[href^='/customers/']").first();
    await custDetailLink.waitFor({ state: "visible", timeout: 10000 });
    await custDetailLink.click();
    await page.waitForURL(/\/customers\/.+/, { timeout: 10000 });
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("DEMO-SO-001").first()).toBeVisible({ timeout: 10000 });

    // 3. Products + detail
    await page.goto("/products");
    await expect(page.getByText("Sprouted Ragi Health Mix").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Millet Flour").first()).toBeVisible();
    await expect(page.getByText("Traditional Idli Mix").first()).toBeVisible();
    await expect(page.getByText("Multigrain Cookies").first()).toBeVisible();
    await expect(page.getByText("Spiced Ready-Mix").first()).toBeVisible();

    await page.locator("a[href^='/products/']").first().click();
    await page.waitForURL(/\/products\/.+/, { timeout: 10000 });
    await page.waitForLoadState("networkidle");

    // 4. Recipes + detail
    await page.goto("/production/recipes");
    await expect(page.getByText(/Sprouted Ragi Health Mix 500g BOM/i).first()).toBeVisible({ timeout: 10000 });
    await page.locator("a[href^='/production/recipes/']").first().click();
    await page.waitForURL(/\/production\/recipes\/.+/, { timeout: 10000 });
    await page.waitForLoadState("networkidle");

    // 5. Orders + detail + unified timeline
    await page.goto("/orders");
    const orderLink = page.locator("a[href^='/orders/']:visible", { hasText: "DEMO-SO-001" }).first();
    await expect(orderLink).toBeVisible({ timeout: 10000 });
    await expect(page.locator("a[href^='/orders/']:visible", { hasText: "DEMO-SO-005" }).first()).toBeVisible();
    await orderLink.click();
    await page.waitForURL(/\/orders\/.+/, { timeout: 10000 });
    await page.waitForLoadState("networkidle");
    const orderUrl = page.url();
    const orderId = orderUrl.split("/orders/")[1]?.split("?")[0];

    // 6. Invoices + detail
    await page.goto("/invoices");
    await expect(page.getByText("Green Basket Retailers").first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Kaveri Wholesale Mart").first()).toBeVisible();
    await page.locator("a[href^='/invoices/']:visible").first().click();
    await page.waitForURL(/\/invoices\/.+/, { timeout: 10000 });
    await page.waitForLoadState("networkidle");
    const invoiceUrl = page.url();
    const invoiceId = invoiceUrl.split("/invoices/")[1]?.split("?")[0];

    // 7. Payments + detail
    await page.goto("/payments");
    await expect(page.locator("text=UPI-DEMO-2026-001 >> visible=true").first()).toBeVisible({ timeout: 10000 });
    const payListRes = await page.request.get("http://127.0.0.1:4000/api/v1/payments");
    expect(payListRes.status()).toBe(200);
    const payListJson = await payListRes.json();
    const firstPayId = payListJson.data?.[0]?.id ?? payListJson.payments?.[0]?.id;
    expect(firstPayId).toBeTruthy();
    await page.goto(`/payments/${firstPayId}`);
    await page.waitForLoadState("networkidle");

    // 8. Exports (PDF, Excel, CSV) via authenticated API requests
    const apiBase = "http://127.0.0.1:4000/api/v1/exports";

    const pdfRes = await page.request.get(`${apiBase}/invoices?format=pdf`);
    expect(pdfRes.status()).toBe(200);
    expect(pdfRes.headers()["content-type"]).toContain("application/pdf");
    const pdfBuf = await pdfRes.body();
    expect(pdfBuf.subarray(0, 5).toString("utf8")).toBe("%PDF-");

    const xlsxRes = await page.request.get(`${apiBase}/invoices?format=xlsx`);
    expect(xlsxRes.status()).toBe(200);
    expect(xlsxRes.headers()["content-type"]).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    const xlsxBuf = await xlsxRes.body();
    expect(xlsxBuf.subarray(0, 2).toString("utf8")).toBe("PK");

    const csvRes = await page.request.get(`${apiBase}/invoices?format=csv`);
    expect(csvRes.status()).toBe(200);
    expect(csvRes.headers()["content-type"]).toContain("text/csv");
    const csvText = await csvRes.text();
    expect(csvText).toContain("Green Basket Retailers");
    expect(csvText).toContain("Kaveri Wholesale Mart");

    if (orderId) {
      const orderPdfRes = await page.request.get(`${apiBase}/orders/${orderId}/pdf`);
      expect(orderPdfRes.status()).toBe(200);
      expect((await orderPdfRes.body()).subarray(0, 5).toString("utf8")).toBe("%PDF-");
    }

    if (invoiceId) {
      const invPdfRes = await page.request.get(
        `http://127.0.0.1:4000/api/v1/finance/invoices/${invoiceId}/pdf`,
      );
      expect(invPdfRes.status()).toBe(200);
      expect((await invPdfRes.body()).subarray(0, 5).toString("utf8")).toBe("%PDF-");
    }

    if (firstPayId) {
      const payPdfRes = await page.request.get(`${apiBase}/payments/${firstPayId}/pdf`);
      expect(payPdfRes.status()).toBe(200);
      expect((await payPdfRes.body()).subarray(0, 5).toString("utf8")).toBe("%PDF-");
    }

    expect(pageErrors).toEqual([]);
  });
});
