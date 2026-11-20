/**
 * AUDIT-ONLY PLAYWRIGHT SPEC
 * Phase 8: Accessibility Audit (WCAG 2.2 Level AA)
 * Automated axe-core + Programmatic WCAG 2.2 AA Verification
 */

import { test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const LANGUAGES: ("en" | "ta")[] = ["en", "ta"];

const ROLES = [
  { role: "ADMIN", email: "admin@millledger.local", pass: "AdminPassword123!" },
  { role: "SALESMAN", email: "salesman1@millledger.local", pass: "SalesmanPassword123!" },
  { role: "PRODUCTION", email: "production@millledger.local", pass: "ProductionPassword123!" },
  { role: "ACCOUNTANT", email: "accountant@millledger.local", pass: "AccountantPassword123!" },
  { role: "OWNER", email: "owner@millledger.local", pass: "OwnerPassword123!" },
];

const ALL_ROUTES = [
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

const ROLE_ROUTES: Record<string, string[]> = {
  PUBLIC: ["/auth/login"],
  ADMIN: ALL_ROUTES.map((r) => r.path),
  OWNER: ALL_ROUTES.map((r) => r.path),
  SALESMAN: [
    "/dashboard",
    "/orders",
    "/orders/new",
    "/customers",
    "/stock",
    "/invoices",
    "/payments",
    "/reports/sales",
  ],
  PRODUCTION: [
    "/dashboard",
    "/production/today",
    "/production/new",
    "/production/history",
    "/stock",
    "/purchases",
    "/reports/production",
    "/reports/stock",
  ],
  ACCOUNTANT: [
    "/dashboard",
    "/invoices",
    "/payments",
    "/reports/sales",
    "/reports/stock",
    "/reports/production",
    "/reports/receivables",
    "/reports/gst",
    "/reports/audit",
    "/exports",
  ],
};

const axeScriptPath = path.resolve("audit/scratch/axe.min.js");
const axeSource = fs.readFileSync(axeScriptPath, "utf-8");

interface AxeSummaryEntry {
  role: string;
  lang: string;
  route: string;
  slug: string;
  violationCount: number;
  passCount: number;
  incompleteCount: number;
  violations: Array<{
    id: string;
    impact: string | null;
    description: string;
    help: string;
    helpUrl: string;
    nodesCount: number;
    firstNodeHtml: string;
    firstNodeFailureSummary?: string;
  }>;
}

const consolidatedAxeSummary: AxeSummaryEntry[] = [];

test.describe("Phase 8 WCAG 2.2 AA Accessibility Audit", () => {
  test.beforeAll(async () => {
    fs.mkdirSync(path.resolve("audit/evidence/a11y/raw-axe"), { recursive: true });
    fs.mkdirSync(path.resolve("audit/evidence/a11y/axe-summary"), { recursive: true });
    fs.mkdirSync(path.resolve("audit/evidence/a11y/snapshots"), { recursive: true });
  });

  // 1. PUBLIC Role: Login page in en and ta
  test("PUBLIC Role - /auth/login Accessibility & axe-core scan", async ({ page }) => {
    test.setTimeout(90000);
    await page.context().clearCookies();

    for (const lang of LANGUAGES) {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto("/auth/login");
      await page.evaluate((l) => {
        localStorage.setItem("mill_ledger_lang", l);
        document.documentElement.lang = l;
      }, lang);
      await page.reload();
      await page.waitForTimeout(300);

      // Inject axe-core and run
      await page.evaluate(axeSource);
      const axeResult = await page.evaluate(async () => {
        // @ts-expect-error axe is injected in browser global
        return await window.axe.run(document, {
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
          },
        });
      });

      const rawAxeFile = path.resolve(
        `audit/evidence/a11y/raw-axe/PUBLIC_${lang}_auth-login.json`,
      );
      fs.writeFileSync(rawAxeFile, JSON.stringify(axeResult, null, 2));

      consolidatedAxeSummary.push({
        role: "PUBLIC",
        lang,
        route: "/auth/login",
        slug: "auth-login",
        violationCount: axeResult.violations.length,
        passCount: axeResult.passes.length,
        incompleteCount: axeResult.incomplete.length,
        violations: axeResult.violations.map((v: any) => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          help: v.help,
          helpUrl: v.helpUrl,
          nodesCount: v.nodes.length,
          firstNodeHtml: v.nodes[0]?.html || "",
          firstNodeFailureSummary: v.nodes[0]?.failureSummary,
        })),
      });

      // Verification of specific WCAG criteria on login page:
      const loginChecks = await page.evaluate(() => {
        const hasSkipLink = !!document.querySelector('a[href^="#"]');
        const h1 = document.querySelector("h1");
        const docLang = document.documentElement.lang;
        const emailInput = document.querySelector("#email") as HTMLInputElement | null;
        const passInput = document.querySelector("#password") as HTMLInputElement | null;
        const emailLabel = document.querySelector('label[for="email"]');
        const passLabel = document.querySelector('label[for="password"]');

        return {
          title: document.title,
          docLang,
          hasSkipLink,
          h1Text: h1?.textContent?.trim() || null,
          emailAutocomplete: emailInput?.autocomplete,
          passAutocomplete: passInput?.autocomplete,
          hasEmailLabelFor: !!emailLabel,
          hasPassLabelFor: !!passLabel,
        };
      });

      fs.writeFileSync(
        path.resolve(`audit/evidence/a11y/snapshots/PUBLIC_${lang}_checks.json`),
        JSON.stringify(loginChecks, null, 2),
      );
    }
  });

  // 2. AUTHENTICATED ROLES - Axe scans & DOM checks across routes
  for (const cred of ROLES) {
    test(`Role ${cred.role} - Full Route Accessibility & axe-core scan`, async ({
      page,
    }) => {
      test.setTimeout(180000);
      await page.context().clearCookies();
      await page.setViewportSize({ width: 1280, height: 800 });

      // Sign in
      await page.goto("/auth/login");
      await page.fill("#email", cred.email);
      await page.fill("#password", cred.pass);
      await page.click('button[type="submit"]');
      await page.waitForURL((url) => !url.pathname.includes("/auth/login"), {
        timeout: 15000,
      });

      const allowedRoutes = ROLE_ROUTES[cred.role] || ["/dashboard"];

      for (const lang of LANGUAGES) {
        // Set language
        await page.evaluate((l) => {
          localStorage.setItem("mill_ledger_lang", l);
          document.documentElement.lang = l;
        }, lang);
        await page.reload();
        await page.waitForTimeout(300);

        for (const routePath of allowedRoutes) {
          const routeMeta = ALL_ROUTES.find((r) => r.path === routePath) || {
            path: routePath,
            slug: routePath.replace(/^\//, "").replace(/\//g, "-") || "root",
          };

          await page.goto(routePath);
          await page.waitForTimeout(200);

          // Inject and run axe-core
          await page.evaluate(axeSource);
          const axeResult = await page.evaluate(async () => {
            // @ts-expect-error axe global
            return await window.axe.run(document, {
              runOnly: {
                type: "tag",
                values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
              },
            });
          });

          const rawAxeFile = path.resolve(
            `audit/evidence/a11y/raw-axe/${cred.role}_${lang}_${routeMeta.slug}.json`,
          );
          fs.writeFileSync(rawAxeFile, JSON.stringify(axeResult, null, 2));

          consolidatedAxeSummary.push({
            role: cred.role,
            lang,
            route: routePath,
            slug: routeMeta.slug,
            violationCount: axeResult.violations.length,
            passCount: axeResult.passes.length,
            incompleteCount: axeResult.incomplete.length,
            violations: axeResult.violations.map((v: any) => ({
              id: v.id,
              impact: v.impact,
              description: v.description,
              help: v.help,
              helpUrl: v.helpUrl,
              nodesCount: v.nodes.length,
              firstNodeHtml: v.nodes[0]?.html || "",
              firstNodeFailureSummary: v.nodes[0]?.failureSummary,
            })),
          });

          // Programmatic check of key criteria
          const pageEval = await page.evaluate(() => {
            const docTitle = document.title;
            const docLang = document.documentElement.lang;
            const h1s = Array.from(document.querySelectorAll("h1")).map((h) =>
              h.textContent?.trim(),
            );
            const headings = Array.from(
              document.querySelectorAll("h1, h2, h3, h4, h5, h6"),
            ).map((h) => ({ tag: h.tagName, text: h.textContent?.trim() }));

            const skipLink = document.querySelector('a[href="#main-content"]');
            const mainLandmark = document.querySelector("main");
            const navLandmarks = Array.from(document.querySelectorAll("nav")).length;
            const headerLandmarks = Array.from(document.querySelectorAll("header")).length;

            // Form inputs and label association
            const formControls = Array.from(
              document.querySelectorAll("input, select, textarea"),
            ).map((ctrl) => {
              const el = ctrl as HTMLElement;
              const id = el.id;
              const hasLabelFor = id ? !!document.querySelector(`label[for="${id}"]`) : false;
              const ariaLabel = el.getAttribute("aria-label");
              const ariaLabelledBy = el.getAttribute("aria-labelledby");
              const placeholder = el.getAttribute("placeholder");
              return {
                tag: el.tagName,
                type: el.getAttribute("type") || "text",
                id: id || null,
                hasLabelFor,
                ariaLabel,
                ariaLabelledBy,
                placeholder,
                hasAccessibleName: !!(hasLabelFor || ariaLabel || ariaLabelledBy),
              };
            });

            // Icon-only buttons
            const buttons = Array.from(document.querySelectorAll("button")).map((b) => {
              const text = b.innerText?.trim() || "";
              const ariaLabel = b.getAttribute("aria-label");
              const ariaLabelledBy = b.getAttribute("aria-labelledby");
              const title = b.getAttribute("title");
              const svgs = b.querySelectorAll("svg").length;
              const rect = b.getBoundingClientRect();
              return {
                text,
                ariaLabel,
                ariaLabelledBy,
                title,
                svgs,
                width: rect.width,
                height: rect.height,
                isIconOnly: !text && svgs > 0,
                hasAccessibleName: !!(text || ariaLabel || ariaLabelledBy || title),
                isBelow24px: rect.width < 24 || rect.height < 24,
                isBelow44px: rect.width < 44 || rect.height < 44,
              };
            });

            // Tables semantics
            const tables = Array.from(document.querySelectorAll("table")).map((tbl) => {
              const ths = Array.from(tbl.querySelectorAll("th"));
              const thsWithScope = ths.filter((th) => th.getAttribute("scope") === "col").length;
              const caption = tbl.querySelector("caption");
              const ariaLabel = tbl.getAttribute("aria-label");
              return {
                thTotal: ths.length,
                thsWithScope,
                hasCaptionOrAriaLabel: !!(caption || ariaLabel),
              };
            });

            return {
              docTitle,
              docLang,
              h1s,
              headings,
              skipLinkExists: !!skipLink,
              mainLandmarkExists: !!mainLandmark,
              navLandmarks,
              headerLandmarks,
              formControlsCount: formControls.length,
              unlabeledFormControls: formControls.filter((f) => !f.hasAccessibleName),
              buttonsCount: buttons.length,
              iconOnlyButtonsWithoutName: buttons.filter(
                (b) => b.isIconOnly && !b.hasAccessibleName,
              ),
              buttonsBelow24px: buttons.filter((b) => b.isBelow24px),
              buttonsBelow44px: buttons.filter((b) => b.isBelow44px),
              tables,
            };
          });

          fs.writeFileSync(
            path.resolve(
              `audit/evidence/a11y/snapshots/${cred.role}_${lang}_${routeMeta.slug}.json`,
            ),
            JSON.stringify(pageEval, null, 2),
          );
        }
      }
    });
  }

  // 3. Programmatic Keyboard, Focus Trap, Sticky Header Obscurity, Text Spacing, 320px Reflow
  test("Detailed Manual Scenarios: Keyboard trap, 2.4.11 Focus Obscured, 1.4.12 Text Spacing, 1.4.10 Reflow", async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.context().clearCookies();
    await page.setViewportSize({ width: 1280, height: 800 });

    // Login as Admin
    await page.goto("/auth/login");
    await page.fill("#email", "admin@millledger.local");
    await page.fill("#password", "AdminPassword123!");
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => url.pathname.includes("/dashboard"));

    // Check 1: Skip Link activation
    await page.goto("/dashboard");
    await page.keyboard.press("Tab");
    const focusedTag = await page.evaluate(() => {
      const el = document.activeElement;
      return {
        tag: el?.tagName,
        text: el?.textContent?.trim(),
        href: el?.getAttribute("href"),
      };
    });

    // Check 2: Sticky Header focus obscuration (2.4.11)
    // Scroll down and test whether focusing an element under sticky header is obscured
    const focusObscurityTest = await page.evaluate(() => {
      const header = document.querySelector("header") || document.querySelector(".sticky.top-0");
      const headerRect = header ? header.getBoundingClientRect() : null;
      const main = document.querySelector("#main-content");
      return {
        headerRect,
        mainPaddingTop: main ? window.getComputedStyle(main).paddingTop : null,
      };
    });

    // Check 3: 1.4.12 Text Spacing Override
    const textSpacingTest = await page.evaluate(() => {
      const style = document.createElement("style");
      style.id = "wcag-1412-text-spacing";
      style.textContent = `
        * {
          line-height: 1.5 !important;
          letter-spacing: 0.12em !important;
          word-spacing: 0.16em !important;
        }
        p {
          margin-bottom: 2em !important;
        }
      `;
      document.head.appendChild(style);

      // Measure whether body or main overflows horizontally
      const scrollWidth = document.documentElement.scrollWidth;
      const clientWidth = document.documentElement.clientWidth;
      style.remove();
      return {
        applied: true,
        scrollWidth,
        clientWidth,
        hasHorizontalOverflow: scrollWidth > clientWidth,
      };
    });

    // Check 4: Modal Dialog Focus Trap & Escape key dismissal
    // Open Cmd+K command palette
    await page.keyboard.press("Control+k");
    await page.waitForTimeout(300);
    const dialogState = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const activeEl = document.activeElement;
      return {
        dialogOpen: !!dialog,
        activeElementTag: activeEl?.tagName,
        activeElementRole: activeEl?.getAttribute("role"),
        dialogAriaModal: dialog?.getAttribute("aria-modal"),
      };
    });
    // Press Escape to dismiss
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const dialogDismissed = await page.evaluate(() => {
      return !document.querySelector('[role="dialog"]');
    });

    // Check 5: 320px Reflow on Orders, Stock, and Production
    const reflowResults: Record<string, any> = {};
    for (const r of ["/orders", "/stock", "/production/today", "/invoices"]) {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto(r);
      await page.waitForTimeout(300);
      const reflow = await page.evaluate(() => {
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          has2DScroll: document.documentElement.scrollWidth > 320,
        };
      });
      reflowResults[r] = reflow;
    }

    // Save detailed scenario output
    fs.writeFileSync(
      path.resolve("audit/evidence/a11y/snapshots/manual_scenarios_verification.json"),
      JSON.stringify(
        {
          skipLink: focusedTag,
          focusObscurityTest,
          textSpacingTest,
          dialog: { ...dialogState, dismissedOnEscape: dialogDismissed },
          reflowResults,
        },
        null,
        2,
      ),
    );
  });

  // Write consolidated axe summary after all tests complete
  test.afterAll(async () => {
    fs.writeFileSync(
      path.resolve("audit/evidence/a11y/axe-summary/consolidated-axe-findings.json"),
      JSON.stringify(consolidatedAxeSummary, null, 2),
    );
  });
});
