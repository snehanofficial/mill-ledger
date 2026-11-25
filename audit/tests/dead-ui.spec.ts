/**
 * AUDIT-ONLY PLAYWRIGHT TEST
 * Task: Phase 6 Requirement 2 - Dead UI Audit
 * Find buttons, links, tabs and menu items that do nothing, 404, or navigate to placeholders.
 * Click every interactive element on every route for every role and record outcomes.
 * Standards: NN/g 10 Heuristics #1 (Visibility of system status), #3 (User control and freedom)
 */
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

interface ClickResult {
  role: string;
  route: string;
  elementTag: string;
  elementText: string;
  elementHref?: string | null;
  outcome: "NAVIGATED" | "MODAL_OPENED" | "API_MUTATION" | "PLACEHOLDER" | "DEAD_NOOP" | "ERROR_CRASH";
  details: string;
}

const ROLES = [
  { role: "ADMIN", email: "admin@millledger.local", pass: "AdminPassword123!" },
  { role: "SALESMAN", email: "salesman1@millledger.local", pass: "SalesmanPassword123!" },
  { role: "PRODUCTION", email: "production@millledger.local", pass: "ProductionPassword123!" },
  { role: "ACCOUNTANT", email: "accountant@millledger.local", pass: "AccountantPassword123!" },
  { role: "OWNER", email: "owner@millledger.local", pass: "OwnerPassword123!" },
];

const ROUTE_LISTS: Record<string, string[]> = {
  ADMIN: [
    "/dashboard",
    "/orders",
    "/orders/new",
    "/invoices",
    "/dispatch",
    "/payments",
    "/stock",
    "/purchases",
    "/production/today",
    "/production/new",
    "/production/history",
    "/customers",
    "/reports/sales",
    "/reports/stock",
    "/reports/production",
    "/reports/receivables",
    "/reports/gst",
    "/reports/audit",
    "/exports",
    "/settings",
  ],
  SALESMAN: [
    "/orders",
    "/orders/new",
    "/customers",
    "/reports/sales",
  ],
  PRODUCTION: [
    "/stock",
    "/purchases",
    "/production/today",
    "/production/new",
    "/production/history",
    "/reports/stock",
    "/reports/production",
  ],
  ACCOUNTANT: [
    "/invoices",
    "/payments",
    "/stock",
    "/purchases",
    "/customers",
    "/reports/sales",
    "/reports/stock",
    "/reports/receivables",
    "/reports/gst",
    "/reports/audit",
    "/exports",
  ],
  OWNER: [
    "/dashboard",
    "/orders",
    "/invoices",
    "/dispatch",
    "/payments",
    "/stock",
    "/purchases",
    "/customers",
    "/reports/sales",
    "/settings",
  ],
};

const allResults: ClickResult[] = [];

test.describe("Phase 6: Dead UI & Interactive Elements Audit", () => {
  for (const cred of ROLES) {
    test(`Click interactive elements for role: ${cred.role}`, async ({ page }) => {
      test.setTimeout(180000); // 3 minutes per role

      // Login
      await page.goto("/auth/login");
      await page.fill("input#email", cred.email);
      await page.fill("input#password", cred.pass);
      await page.click('button[type="submit"]');
      await page.waitForURL((url) => !url.pathname.includes("/auth/login"), { timeout: 10000 });
      await page.waitForTimeout(500);

      const routesToTest = ROUTE_LISTS[cred.role] || [];

      for (const route of routesToTest) {
        await page.goto(route, { waitUntil: "networkidle" }).catch(() => {});
        await page.waitForTimeout(400);

        // Check if page itself is a placeholder
        const pageText = await page.innerText("body").catch(() => "");
        const isPlaceholder = pageText.includes("Module in Progress") || pageText.includes("Workspace") && pageText.includes("scheduled for rollout");

        if (isPlaceholder) {
          allResults.push({
            role: cred.role,
            route,
            elementTag: "PAGE_ROOT",
            elementText: "Page Container",
            outcome: "PLACEHOLDER",
            details: "Route renders placeholder page (Module in Progress / scheduled for rollout in next milestone)",
          });
          continue; // No interactives to click on placeholder
        }

        // Collect interactive elements (buttons, links in main content, tabs)
        // Skip sidebar logout button and language toggle to keep session intact
        const elements = await page.$$eval("main button, main a, [role='tab'], [role='button']", (els) => {
          return els.map((el) => {
            const tag = el.tagName.toLowerCase();
            const text = (el.textContent || "").trim().replace(/\s+/g, " ");
            const href = el.getAttribute("href");
            const roleAttr = el.getAttribute("role");
            const disabled = el.hasAttribute("disabled") || (el as any).disabled;
            return {
              tag,
              text: text.slice(0, 60),
              href,
              roleAttr,
              disabled,
            };
          });
        });

        for (let i = 0; i < elements.length; i++) {
          const elMeta = elements[i];
          if (!elMeta.text && !elMeta.href) continue;
          if (elMeta.disabled) {
            allResults.push({
              role: cred.role,
              route,
              elementTag: elMeta.tag,
              elementText: elMeta.text || elMeta.href || "unlabeled",
              elementHref: elMeta.href,
              outcome: "DEAD_NOOP",
              details: "Element is statically disabled",
            });
            continue;
          }

          // Fresh query of the element on page
          const locator = page.locator(`main button, main a, [role='tab'], [role='button']`).nth(i);
          const isVisible = await locator.isVisible().catch(() => false);
          if (!isVisible) continue;

          // Track network requests and navigation
          let apiFired = false;
          let consoleError = false;
          const reqListener = (req: any) => {
            if (req.url().includes("/api/")) apiFired = true;
          };
          const errListener = (msg: any) => {
            if (msg.type() === "error") consoleError = true;
          };
          page.on("request", reqListener);
          page.on("console", errListener);

          const urlBefore = page.url();

          try {
            await locator.click({ timeout: 2000 }).catch(() => {});
            await page.waitForTimeout(300);

            const urlAfter = page.url();
            const bodyTextAfter = await page.innerText("body").catch(() => "");
            const hasModal = (await page.$(".fixed.inset-0, [role='dialog'], [role='alertdialog']")) !== null;
            const landedPlaceholder = bodyTextAfter.includes("Module in Progress") || (bodyTextAfter.includes("Workspace") && bodyTextAfter.includes("scheduled for rollout"));

            let outcome: ClickResult["outcome"] = "DEAD_NOOP";
            let details = "Click produced no observable URL change, modal, or network request";

            if (consoleError) {
              outcome = "ERROR_CRASH";
              details = "Console error triggered upon click";
            } else if (landedPlaceholder) {
              outcome = "PLACEHOLDER";
              details = "Navigated to placeholder screen";
            } else if (urlAfter !== urlBefore) {
              outcome = "NAVIGATED";
              details = `URL changed from ${urlBefore} to ${urlAfter}`;
            } else if (hasModal) {
              outcome = "MODAL_OPENED";
              details = "Modal/Dialog/Overlay opened on click";
              // Close modal if open
              const closeBtn = await page.$("button:has-text('✕'), button:has-text('Cancel'), button:has-text('Close')");
              if (closeBtn) await closeBtn.click().catch(() => {});
            } else if (apiFired) {
              outcome = "API_MUTATION";
              details = "API network request dispatched";
            }

            allResults.push({
              role: cred.role,
              route,
              elementTag: elMeta.tag,
              elementText: elMeta.text || elMeta.href || "unlabeled",
              elementHref: elMeta.href,
              outcome,
              details,
            });
          } catch (err: any) {
            allResults.push({
              role: cred.role,
              route,
              elementTag: elMeta.tag,
              elementText: elMeta.text || "unlabeled",
              elementHref: elMeta.href,
              outcome: "ERROR_CRASH",
              details: err.message,
            });
          } finally {
            page.off("request", reqListener);
            page.off("console", errListener);
          }

          // If navigated away, return to original route
          if (page.url() !== urlBefore) {
            await page.goto(route, { waitUntil: "networkidle" }).catch(() => {});
            await page.waitForTimeout(300);
          }
        }
      }
    });
  }

  test.afterAll(() => {
    const outPath = path.resolve(process.cwd(), "audit/evidence/dead-ui-results.json");
    fs.writeFileSync(outPath, JSON.stringify(allResults, null, 2));
    console.log(`Saved ${allResults.length} dead UI audit click outcomes to ${outPath}`);

    // Summary counts
    const counts = allResults.reduce((acc: any, r) => {
      acc[r.outcome] = (acc[r.outcome] || 0) + 1;
      return acc;
    }, {});
    console.log("Dead UI Summary:", JSON.stringify(counts, null, 2));
  });
});
