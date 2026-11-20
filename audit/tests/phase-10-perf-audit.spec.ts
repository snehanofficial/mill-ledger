/**
 * AUDIT-ONLY PLAYWRIGHT SPEC
 * Phase 10: Performance, Waterfall, Lazy Loading & Image Audit
 */

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const EVIDENCE_DIR = path.resolve("audit/evidence/performance/waterfalls");
const METRICS_DIR = path.resolve("audit/evidence/performance");

const ADMIN_USER = {
  email: "admin@millledger.local",
  pass: "AdminPassword123!",
};

async function loginAsAdmin(page: any) {
  await page.context().clearCookies();
  await page.goto("/auth/login");
  await page.evaluate(() => {
    localStorage.setItem("mill_ledger_lang", "en");
    document.documentElement.lang = "en";
  });
  await page.fill("#email", ADMIN_USER.email);
  await page.fill("#password", ADMIN_USER.pass);
  await page.click('button[type="submit"]');
  await page.waitForURL((url: URL) => !url.pathname.includes("/auth/login"), {
    timeout: 15000,
  });
}

test.describe("Phase 10: Performance & Waterfall Verification", () => {
  test.beforeAll(() => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    fs.mkdirSync(METRICS_DIR, { recursive: true });
  });

  // =========================================================================
  // 1. Route-Level Lazy Loading, Suspense Fallback & Waterfall Proof
  // =========================================================================
  test("1. Route chunks load on demand and prefetch on hover is absent", async ({
    page,
  }) => {
    const networkRequests: Array<{ url: string; method: string; resourceType: string; time: number }> = [];

    page.on("request", (req) => {
      networkRequests.push({
        url: req.url(),
        method: req.method(),
        resourceType: req.resourceType(),
        time: Date.now(),
      });
    });

    await loginAsAdmin(page);
    await page.goto("/dashboard");
    await page.waitForSelector("#main-content");

    // Clear recorded initial requests
    const initialJsRequests = networkRequests.filter((r) => r.resourceType === "script").map((r) => r.url);
    const invoicesChunkLoadedInitially = initialJsRequests.some((u) => u.includes("invoices-page"));
    const reportsChunkLoadedInitially = initialJsRequests.some((u) => u.includes("reports-page"));

    expect(invoicesChunkLoadedInitially).toBe(false);
    expect(reportsChunkLoadedInitially).toBe(false);

    // 2. Hover over Invoices link in navigation to test hover prefetching
    const preHoverReqCount = networkRequests.length;
    const invoicesNav = page.locator('a[href="/invoices"]').first();
    await expect(invoicesNav).toBeVisible();
    await invoicesNav.hover();
    await page.waitForTimeout(500); // 500ms hover dwell

    const hoverRequests = networkRequests.slice(preHoverReqCount);
    const hoverPrefetchedChunk = hoverRequests.some((r) => r.url.includes("invoices-page"));

    // 3. Click Invoices link and observe lazy chunk requested dynamically
    const preClickReqCount = networkRequests.length;
    await invoicesNav.click();
    await page.waitForURL((url: URL) => url.pathname.includes("/invoices"), { timeout: 15000 });
    await page.waitForTimeout(500);

    const postClickRequests = networkRequests.slice(preClickReqCount);
    const invoicesChunkLoadedOnDemand = postClickRequests.some((r) => r.url.includes("invoices-page"));

    const waterfallReport = {
      initialJsChunksCount: initialJsRequests.length,
      invoicesChunkLoadedInitially,
      reportsChunkLoadedInitially,
      hoverRequests: hoverRequests.map((r) => ({ url: r.url, type: r.resourceType })),
      hoverPrefetchedChunk,
      invoicesChunkLoadedOnDemand,
      postClickRequests: postClickRequests.map((r) => ({ url: r.url, type: r.resourceType })),
    };

    fs.writeFileSync(
      path.join(EVIDENCE_DIR, "route-waterfall-lazy-loading.json"),
      JSON.stringify(waterfallReport, null, 2),
      "utf8"
    );

    expect(invoicesChunkLoadedOnDemand).toBe(true);
    expect(hoverPrefetchedChunk).toBe(false); // Proves route JS chunk is NOT prefetched on hover
  });

  // =========================================================================
  // 2. Image Audit & Viewport Lazy Loading Proof
  // =========================================================================
  test("2. DOM images inventory, attributes and scroll test", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/dashboard");
    await page.waitForSelector("#main-content");

    // Gather all <img> elements across DOM
    const imagesInfo = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll("img"));
      return imgs.map((img) => ({
        src: img.src,
        alt: img.getAttribute("alt"),
        width: img.getAttribute("width"),
        height: img.getAttribute("height"),
        loading: img.getAttribute("loading"),
        decoding: img.getAttribute("decoding"),
        fetchpriority: img.getAttribute("fetchpriority"),
        computedWidth: img.clientWidth,
        computedHeight: img.clientHeight,
      }));
    });

    // Track any network request for images during scroll
    const scrolledImageRequests: string[] = [];
    page.on("request", (req) => {
      if (req.resourceType() === "image") {
        scrolledImageRequests.push(req.url());
      }
    });

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    const imageAuditReport = {
      totalImagesCount: imagesInfo.length,
      images: imagesInfo,
      scrolledImageRequests,
      hasModernFormats: imagesInfo.some((img) => img.src.endsWith(".webp") || img.src.endsWith(".avif")),
      hasContentHash: imagesInfo.some((img) => /\.[a-f0-9]{8,}\./i.test(img.src)),
    };

    fs.writeFileSync(
      path.join(METRICS_DIR, "images-audit.json"),
      JSON.stringify(imageAuditReport, null, 2),
      "utf8"
    );

    console.log(`Images found on /dashboard: ${imagesInfo.length}`);
  });

  // =========================================================================
  // 3. TanStack Query Cache & Request Deduplication
  // =========================================================================
  test("3. Client data caching and request deduplication", async ({ page }) => {
    await loginAsAdmin(page);

    const apiRequests: Array<{ url: string; time: number }> = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/v1/")) {
        apiRequests.push({ url: req.url(), time: Date.now() });
      }
    });

    // 1. Visit /customers via SPA link
    await page.locator('a[href="/customers"]').first().click();
    await page.waitForURL("**/customers", { timeout: 10000 });
    await page.waitForSelector("table", { timeout: 10000 });
    const firstVisitCount = apiRequests.filter((r) => r.url.includes("/sales/customers")).length;

    // 2. Navigate away to /dashboard via SPA link
    await page.locator('a[href="/dashboard"]').first().click();
    await page.waitForURL("**/dashboard", { timeout: 10000 });
    await page.waitForSelector("#main-content", { timeout: 10000 });

    // 3. Navigate back to /customers within staleTime (30s configured)
    await page.locator('a[href="/customers"]').first().click();
    await page.waitForURL("**/customers", { timeout: 10000 });
    await page.waitForSelector("table", { timeout: 10000 });
    const secondVisitCount = apiRequests.filter((r) => r.url.includes("/sales/customers")).length;

    const cacheReport = {
      firstVisitCustomersReqCount: firstVisitCount,
      secondVisitCustomersReqCount: secondVisitCount,
      reusedCachedDataWithoutImmediateRefetch: secondVisitCount === firstVisitCount,
    };

    fs.writeFileSync(
      path.join(METRICS_DIR, "tanstack-query-cache-dedupe.json"),
      JSON.stringify(cacheReport, null, 2),
      "utf8"
    );
  });
});
