import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const ROUTES = [
  { path: "/auth/login", name: "login" },
  { path: "/dashboard", name: "dashboard" },
  { path: "/orders", name: "orders" },
  { path: "/orders/new", name: "orders-new" },
  { path: "/stock", name: "stock" },
  { path: "/production/today", name: "production-today" },
  { path: "/invoices", name: "invoices" },
  { path: "/dispatch", name: "dispatch" },
  { path: "/payments", name: "payments" },
  { path: "/customers", name: "customers" },
  { path: "/reports/sales", name: "reports-sales" },
  { path: "/reports/stock", name: "reports-stock" },
  { path: "/reports/gst", name: "reports-gst" },
];

test.describe("Phase 11: Internationalization (i18n) & Tamil Verification", () => {
  test("audit Tamil localization across all application routes", async ({ page }) => {
    const evidenceDir = path.resolve(process.cwd(), "audit/evidence/i18n");
    fs.mkdirSync(evidenceDir, { recursive: true });

    // Set language in localStorage before navigating so it loads with ta
    await page.addInitScript(() => {
      localStorage.setItem("mill_ledger_lang", "ta");
    });

    // 1. First test Login Page
    await page.goto("/auth/login");
    await page.waitForLoadState("networkidle");

    // Check lang attribute immediately
    const initialLangAttr = await page.evaluate(() => document.documentElement.lang);

    await page.screenshot({
      path: path.join(evidenceDir, "route-login-ta.png"),
      fullPage: true,
    });

    // Login as Admin to access all authenticated routes
    await page.fill('input[type="email"]', "admin@millledger.local");
    await page.fill('input[type="password"]', "AdminPassword123!");
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.includes("/auth/login"), { timeout: 10000 });

    const routeAuditResults: Record<string, any> = {};

    for (const r of ROUTES) {
      if (r.name === "login") continue;
      await page.goto(r.path);
      await page.waitForLoadState("networkidle");
      // Wait an extra 500ms for animations/render
      await page.waitForTimeout(500);

      // Capture screenshot
      const screenshotPath = path.join(evidenceDir, `route-${r.name}-ta.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      // Analyze page text content
      const textAnalysis = await page.evaluate(() => {
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          {
            acceptNode: (node) => {
              const text = node.textContent?.trim() || "";
              if (!text || text.length < 2) return NodeFilter.FILTER_REJECT;
              const parent = node.parentElement;
              if (!parent) return NodeFilter.FILTER_REJECT;
              const tag = parent.tagName.toLowerCase();
              if (tag === "script" || tag === "style" || tag === "noscript") return NodeFilter.FILTER_REJECT;
              return NodeFilter.FILTER_ACCEPT;
            },
          }
        );

        let tamilNodeCount = 0;
        let englishNodeCount = 0;
        const tamilSamples: string[] = [];
        const englishSamples: string[] = [];

        // Tamil Unicode range: U+0B80 - U+0BFF
        const tamilRegex = /[\u0B80-\u0BFF]/;
        const latinRegex = /[a-zA-Z]/;

        let currentNode = walker.nextNode();
        while (currentNode) {
          const val = currentNode.textContent?.trim() || "";
          if (tamilRegex.test(val)) {
            tamilNodeCount++;
            if (tamilSamples.length < 10) tamilSamples.push(val);
          } else if (latinRegex.test(val)) {
            englishNodeCount++;
            if (englishSamples.length < 15) englishSamples.push(val);
          }
          currentNode = walker.nextNode();
        }

        // Check computed font-family for body and buttons
        const bodyFont = window.getComputedStyle(document.body).fontFamily;
        const htmlLang = document.documentElement.lang;

        // Check date strings
        const textContent = document.body.innerText;
        const dateMatches = textContent.match(/\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}/g) || [];

        return {
          tamilNodeCount,
          englishNodeCount,
          tamilRatio: (tamilNodeCount + englishNodeCount) > 0 ? tamilNodeCount / (tamilNodeCount + englishNodeCount) : 0,
          tamilSamples,
          englishSamples,
          bodyFont,
          htmlLang,
          dateSamples: dateMatches.slice(0, 5),
        };
      });

      routeAuditResults[r.name] = textAnalysis;
    }

    // Also test Outbox Sheet / Drawer in Tamil
    const outboxTrigger = page.locator('button[aria-label*="outbox" i], button:has-text("Live"), button:has-text("Offline")').first();
    if (await outboxTrigger.count() > 0) {
      await outboxTrigger.click();
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(evidenceDir, "outbox-sheet-ta.png"),
      });
    }

    const report = {
      initialLangAttr,
      routeAuditResults,
    };

    fs.writeFileSync(
      path.join(evidenceDir, "tamil-localization-audit.json"),
      JSON.stringify(report, null, 2)
    );

    console.log("=== TAMIL ROUTE AUDIT SUMMARY ===");
    for (const [route, res] of Object.entries(routeAuditResults)) {
      console.log(`Route ${route}: Tamil nodes=${res.tamilNodeCount}, English nodes=${res.englishNodeCount}, Tamil Ratio=${(res.tamilRatio * 100).toFixed(1)}%`);
    }

    // Expect that English still overwhelmingly dominates (confirming the finding)
    const dashboardRatio = routeAuditResults["dashboard"].tamilRatio;
    expect(dashboardRatio).toBeLessThan(0.15); // Less than 15% translated
  });
});
