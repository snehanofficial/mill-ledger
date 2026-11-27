import { expect, test } from "@playwright/test";

const PUBLIC_PATHS = [
  "/",
  "/features",
  "/workflows",
  "/spreadsheet-alternative",
  "/resources",
  "/resources/indian-gst-invoicing-for-food-mills",
  "/resources/moving-weighted-average-stock-ledger",
  "/resources/offline-salesman-order-capture",
  "/security",
  "/about",
  "/demo",
  "/contact",
];

test.describe("Public SEO, GEO & Demo Funnel", () => {
  for (const vp of [
    { name: "mobile", width: 375, height: 812 },
    { name: "desktop", width: 1280, height: 800 },
  ]) {
    test(`renders all 12 public routes cleanly on ${vp.name} (${vp.width}x${vp.height})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));
      page.on("console", (msg) => {
        if (
          msg.type() === "error" &&
          !msg.text().includes("401 (Unauthorized)")
        ) {
          errors.push(msg.text());
        }
      });

      const seenTitles = new Set<string>();
      for (const routePath of PUBLIC_PATHS) {
        const res = await page.goto(routePath, { waitUntil: "networkidle" });
        expect(res?.status()).toBe(200);

        const metrics = await page.evaluate(() => ({
          title: document.title,
          h1Count: document.querySelectorAll("h1").length,
          overflowPx:
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
          brokenImgs: Array.from(document.querySelectorAll("img")).filter(
            (img) => !img.complete || img.naturalWidth === 0,
          ).length,
          robots: document
            .querySelector('meta[name="robots"]')
            ?.getAttribute("content"),
          canonical: document
            .querySelector('link[rel="canonical"]')
            ?.getAttribute("href"),
        }));

        expect(metrics.h1Count).toBe(1);
        expect(metrics.overflowPx).toBeLessThanOrEqual(0);
        expect(metrics.brokenImgs).toBe(0);
        expect(metrics.robots).toBe("index, follow");
        expect(metrics.canonical).toBeTruthy();
        seenTitles.add(metrics.title);
      }

      expect(seenTitles.size).toBe(PUBLIC_PATHS.length);
      expect(errors).toEqual([]);
    });
  }

  test("validates and submits /demo inquiry form to backend API", async ({
    page,
  }) => {
    await page.goto("/demo", { waitUntil: "networkidle" });

    // Empty submit triggers accessible field validation
    await page.getByRole("button", { name: "Submit Request" }).click();
    await expect(page.locator("#error-fullname")).toBeVisible();
    await expect(page.locator("#error-phone")).toBeVisible();
    await expect(page.locator("#error-message")).toBeVisible();

    // Valid submit reaches POST /api/v1/public/inquiries and renders referenceId
    await page.fill("#inquiry-fullname", "K. Sundaram");
    await page.fill("#inquiry-business", "Cauvery Flour Mills");
    await page.fill("#inquiry-phone", "+91 98765 43210");
    await page.fill("#inquiry-email", "sundaram@cauverymills.in");
    await page.fill(
      "#inquiry-message",
      "Evaluating BOM yield variance and offline salesman order capture.",
    );

    await page.getByRole("button", { name: "Submit Request" }).click();
    await expect(page.getByText(/Request Received \(INQ-/)).toBeVisible();
  });

  test("redirects /catalog to /features and marks unknown routes noindex", async ({
    page,
  }) => {
    await page.goto("/catalog", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/features$/);

    await page.goto("/unknown-route-seo-check", { waitUntil: "networkidle" });
    await expect(
      page.getByRole("heading", { name: /404 - Page Not Found/ }),
    ).toBeVisible();
    const robots = await page
      .locator('meta[name="robots"]')
      .getAttribute("content");
    expect(robots).toBe("noindex, nofollow");
  });
});
