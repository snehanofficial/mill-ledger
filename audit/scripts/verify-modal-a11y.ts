/**
 * AUDIT-ONLY SCRIPT: Modal Accessibility & APG Compliance Verification
 */

import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  // Login as salesman
  await page.goto("http://127.0.0.1:4173/auth/login");
  await page.fill("#email", "salesman1@millledger.local");
  await page.fill("#password", "SalesmanPassword123!");
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => u.pathname.includes("/dashboard"));

  // Go to orders
  await page.goto("http://127.0.0.1:4173/orders");
  await page.waitForTimeout(500);

  // Click New sales order button
  const newOrderBtn = page.locator('button:has-text("New sales order")').first();
  await newOrderBtn.click();
  await page.waitForTimeout(400);

  // Inspect the open modal
  const modalData = await page.evaluate(() => {
    const fixedOverlay = document.querySelector(".fixed.inset-0.z-50");
    const activeEl = document.activeElement;
    return {
      modalExists: !!fixedOverlay,
      modalRole: fixedOverlay?.getAttribute("role"),
      modalAriaModal: fixedOverlay?.getAttribute("aria-modal"),
      modalAriaLabelledBy: fixedOverlay?.getAttribute("aria-labelledby"),
      activeElementTag: activeEl?.tagName,
      activeElementText: activeEl?.textContent?.trim().slice(0, 30),
      activeElementInsideModal: fixedOverlay?.contains(activeEl),
    };
  });

  // Try pressing Escape
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const escapeDismissed = await page.evaluate(() => {
    return !document.querySelector(".fixed.inset-0.z-50");
  });

  // Try tabbing through the modal to see if focus escapes
  let focusEscaped = false;
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab");
    const isInside = await page.evaluate(() => {
      const modal = document.querySelector(".fixed.inset-0.z-50");
      return modal?.contains(document.activeElement);
    });
    if (!isInside) {
      focusEscaped = true;
      break;
    }
  }

  const result = {
    modalData,
    dismissedOnEscape: escapeDismissed,
    focusEscapesModalOnTab: focusEscaped,
  };

  fs.writeFileSync(
    path.resolve(process.cwd(), "../audit/evidence/a11y/snapshots/raw_modal_verification.json"),
    JSON.stringify(result, null, 2),
  );

  console.log("Raw Modal Verification Result:", JSON.stringify(result, null, 2));

  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
