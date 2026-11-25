/**
 * AUDIT-ONLY PLAYWRIGHT SPEC
 * Phase 7: UX, Information Architecture, Heuristics, Touch Targets, and Multi-Viewport Screenshots
 * Viewports: 320px, 390px, 768px, 1024px, 1440px
 * Languages: en, ta
 * Roles: PUBLIC, ADMIN, SALESMAN, PRODUCTION, ACCOUNTANT, OWNER
 */

import { test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const VIEWPORTS = [
  { width: 320, height: 640, label: "320px" },
  { width: 390, height: 844, label: "390px" },
  { width: 768, height: 1024, label: "768px" },
  { width: 1024, height: 768, label: "1024px" },
  { width: 1440, height: 900, label: "1440px" },
];

const LANGUAGES: ("en" | "ta")[] = ["en", "ta"];

const ROLES = [
  { role: "ADMIN", email: "admin@millledger.local", pass: "AdminPassword123!" },
  { role: "SALESMAN", email: "salesman1@millledger.local", pass: "SalesmanPassword123!" },
  { role: "PRODUCTION", email: "production@millledger.local", pass: "ProductionPassword123!" },
  { role: "ACCOUNTANT", email: "accountant@millledger.local", pass: "AccountantPassword123!" },
  { role: "OWNER", email: "owner@millledger.local", pass: "OwnerPassword123!" },
];

const ROUTES = [
  { path: "/dashboard", slug: "dashboard" },
  { path: "/orders", slug: "orders" },
  { path: "/orders/new", slug: "orders-new" },
  { path: "/invoices", slug: "invoices" },
  { path: "/dispatch", slug: "dispatch" },
  { path: "/payments", slug: "payments" },
  { path: "/stock", slug: "stock" },
  { path: "/purchases", slug: "purchases" },
  { path: "/production/today", slug: "production-today" },
  { path: "/production/new", slug: "production-new" },
  { path: "/production/history", slug: "production-history" },
  { path: "/customers", slug: "customers" },
  { path: "/reports/sales", slug: "reports-sales" },
  { path: "/reports/stock", slug: "reports-stock" },
  { path: "/reports/production", slug: "reports-production" },
  { path: "/reports/receivables", slug: "reports-receivables" },
  { path: "/reports/gst", slug: "reports-gst" },
  { path: "/reports/audit", slug: "reports-audit" },
  { path: "/exports", slug: "exports" },
  { path: "/settings", slug: "settings" },
  { path: "/showcase", slug: "showcase" },
];

interface ScreenshotRecord {
  role: string;
  lang: string;
  width: number;
  height: number;
  route: string;
  slug: string;
  filePath: string;
  fileSize: number;
  title: string;
  hasHorizontalScroll: boolean;
  touchTargetsBelow44px: number;
}

const screenshotRecords: ScreenshotRecord[] = [];

test.describe("Phase 7 UX Audit & Screenshot Matrix", () => {
  test.beforeAll(async () => {
    fs.mkdirSync(path.resolve("audit/evidence/screenshots"), { recursive: true });
  });

  // 1. PUBLIC Role (/auth/login)
  test("Capture PUBLIC /auth/login across viewports and languages", async ({ page }) => {
    test.setTimeout(60000);
    await page.context().clearCookies();

    for (const lang of LANGUAGES) {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto("/auth/login");
      await page.evaluate((l) => {
        localStorage.setItem("mill_ledger_lang", l);
        document.documentElement.lang = l;
      }, lang);
      await page.reload();
      await page.waitForTimeout(200);

      for (const vp of VIEWPORTS) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.waitForTimeout(50);

        const outDir = path.resolve(`audit/evidence/screenshots/PUBLIC/${lang}/${vp.label}`);
        fs.mkdirSync(outDir, { recursive: true });
        const filePath = path.join(outDir, "auth-login.png");

        await page.screenshot({ path: filePath, fullPage: false });
        const stat = fs.statSync(filePath);

        const title = await page.title();
        const hasHorizontalScroll = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth
        );

        const smallTargets = await page.evaluate(() => {
          const interactives = Array.from(document.querySelectorAll("button, a, input, select"));
          return interactives.filter((el) => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44);
          }).length;
        });

        screenshotRecords.push({
          role: "PUBLIC",
          lang,
          width: vp.width,
          height: vp.height,
          route: "/auth/login",
          slug: "auth-login",
          filePath: path.relative(process.cwd(), filePath),
          fileSize: stat.size,
          title,
          hasHorizontalScroll,
          touchTargetsBelow44px: smallTargets,
        });
      }
    }
  });

  // 2. Authenticated Roles
  for (const cred of ROLES) {
    test(`Capture and evaluate role: ${cred.role}`, async ({ page }) => {
      test.setTimeout(180000);

      // Clear all state to start clean
      await page.context().clearCookies();
      await page.setViewportSize({ width: 1280, height: 800 });

      // Sign in
      await page.goto("/auth/login");
      await page.fill("input#email", cred.email);
      await page.fill("input#password", cred.pass);
      await page.click('button[type="submit"]');
      await page.waitForURL((url) => !url.pathname.includes("/auth/login"), { timeout: 10000 });
      await page.waitForTimeout(250);

      for (const lang of LANGUAGES) {
        // Set language
        await page.evaluate((l) => {
          localStorage.setItem("mill_ledger_lang", l);
          document.documentElement.lang = l;
        }, lang);

        for (const route of ROUTES) {
          await page.goto(route.path);
          await page.waitForLoadState("domcontentloaded");
          await page.waitForTimeout(80);

          for (const vp of VIEWPORTS) {
            await page.setViewportSize({ width: vp.width, height: vp.height });
            await page.waitForTimeout(25);

            const outDir = path.resolve(`audit/evidence/screenshots/${cred.role}/${lang}/${vp.label}`);
            fs.mkdirSync(outDir, { recursive: true });
            const filePath = path.join(outDir, `${route.slug}.png`);

            await page.screenshot({ path: filePath, fullPage: false });
            const stat = fs.statSync(filePath);

            const title = await page.title();
            const hasHorizontalScroll = await page.evaluate(
              () => document.documentElement.scrollWidth > window.innerWidth
            );

            const smallTargets = await page.evaluate(() => {
              const interactives = Array.from(document.querySelectorAll("button, a, input, select"));
              return interactives.filter((el) => {
                const rect = el.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44);
              }).length;
            });

            screenshotRecords.push({
              role: cred.role,
              lang,
              width: vp.width,
              height: vp.height,
              route: route.path,
              slug: route.slug,
              filePath: path.relative(process.cwd(), filePath),
              fileSize: stat.size,
              title,
              hasHorizontalScroll,
              touchTargetsBelow44px: smallTargets,
            });
          }
        }
      }

      // Logout / clear cookies at end of role
      await page.context().clearCookies();
    });
  }

  test.afterAll(async () => {
    fs.writeFileSync(
      "audit/evidence/screenshots-index.json",
      JSON.stringify(screenshotRecords, null, 2)
    );
    console.log(`Saved ${screenshotRecords.length} screenshot records to audit/evidence/screenshots-index.json`);
  });
});
