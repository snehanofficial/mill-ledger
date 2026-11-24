import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { translate, dictionary } from "../../client/src/lib/i18n.js";

describe("F-080 Regression: Bilingual Tamil Localization Coverage (REQ-053 / Problem Statement)", () => {
  const clientDir = path.resolve(__dirname, "../../client/src");

  it("provides authentic Tamil unicode translations across all core manufacturing and ledger modules", () => {
    const operationalPhrases = [
      // Production
      "Production execution",
      "Record production batch",
      "Good packets produced",
      "Damaged pouches",
      "Total batches",
      "Packets produced",
      "Total run cost",
      "Ledger integrity",
      "Verified",
      "Cooking oil consumed (L)",
      "Cartons used (pieces)",
      "Direct labour cost (₹)",
      "Gas and power cost (₹)",
      "Reason for reversal",
      "Reverse Run",

      // Stock
      "Refresh Balances",
      "Total Items",
      "Raw Materials",
      "Packaging",
      "Finished Goods",
      "Valued Stock Total",

      // Orders
      "Orders",
      "Sales orders",
      "New sales order",
      "Total orders",
      "Approved bookings",
      "Booked value",

      // Invoices
      "Invoices",
      "Generate Invoice",
      "Total invoices",
      "Total billed",
      "Total outstanding",

      // Purchases
      "Procurement & Mandi Intake",
      "Live Ledger",
      "Record Purchase Receipt",

      // Dispatch
      "Dispatch",
      "Record dispatch",
      "Total dispatches",

      // Payments
      "Payments",
      "Total collected",
      "Net outstanding",
      "Unallocated credit",
      "Payments ledger",
      "Customer receivables",

      // Outbox
      "Device Outbox",
      "Connected",
      "Offline",
      "Sync now",
      "Refresh catalog",
      "Waiting to sync",
    ];

    const tamilUnicodeRegex = /[\u0B80-\u0BFF]/;

    for (const phrase of operationalPhrases) {
      const translated = translate(phrase, phrase, "ta");
      expect(
        tamilUnicodeRegex.test(translated),
        `Expected phrase "${phrase}" to translate to Tamil unicode, got "${translated}"`,
      ).toBe(true);
    }
  });

  it("verifies all operational pages and shell dialogs integrate useLanguage and t()", () => {
    const requiredFiles = [
      "pages/production-page.tsx",
      "pages/orders-page.tsx",
      "pages/stock-page.tsx",
      "pages/invoices-page.tsx",
      "pages/purchases-page.tsx",
      "pages/dispatch-page.tsx",
      "pages/payments-page.tsx",
      "pages/dashboard-page.tsx",
      "pages/new-order-page.tsx",
      "pages/customers-page.tsx",
      "pages/suppliers-page.tsx",
      "components/shell/device-outbox-sheet.tsx",
      "components/ui/confirmation-dialog.tsx",
    ];

    for (const relPath of requiredFiles) {
      const fullPath = path.join(clientDir, relPath);
      expect(fs.existsSync(fullPath), `File ${relPath} should exist`).toBe(true);
      const content = fs.readFileSync(fullPath, "utf8");
      expect(content).toContain("useLanguage");
      expect(content).toContain("t(");
    }
  });

  it("dictionary contains over 150 localized bilingual keys", () => {
    const totalKeys = Object.keys(dictionary).length;
    expect(totalKeys).toBeGreaterThanOrEqual(150);
  });
});
