import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("F-051 Regression Test: Accessible Dialogs & APG Modal Semantics", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const pagesDir = path.join(repoRoot, "client/src/pages");

  const operationalPages = [
    "orders-page.tsx",
    "invoices-page.tsx",
    "production-page.tsx",
    "payments-page.tsx",
    "purchases-page.tsx",
    "dispatch-page.tsx",
    "suppliers-page.tsx",
    "settings-page.tsx",
  ];

  it("client/src/pages/ contains ZERO raw custom fixed inset-0 modal overlay divs", () => {
    for (const pageName of operationalPages) {
      const pagePath = path.join(pagesDir, pageName);
      const source = fs.readFileSync(pagePath, "utf8");

      expect(source).not.toContain("fixed inset-0 z-50 flex items-center justify-center bg-black/50");
      expect(source).not.toContain("fixed inset-0 z-50");
    }
  });

  it("all operational pages import and compose @/components/ui/dialog primitives", () => {
    for (const pageName of operationalPages) {
      const pagePath = path.join(pagesDir, pageName);
      const source = fs.readFileSync(pagePath, "utf8");

      expect(source).toContain('from "@/components/ui/dialog"');
      expect(source).toMatch(/<Dialog[\s\n]/);
      expect(source).toContain("<DialogContent");
      expect(source).toContain("<DialogTitle");
    }
  });

  it("client/src/components/ui/dialog.tsx configures Radix UI portal, overlay, focus trap, and close button", () => {
    const dialogSource = fs.readFileSync(
      path.join(repoRoot, "client/src/components/ui/dialog.tsx"),
      "utf8",
    );

    expect(dialogSource).toContain('from "radix-ui"');
    expect(dialogSource).toContain("DialogPrimitive.Portal");
    expect(dialogSource).toContain("DialogPrimitive.Overlay");
    expect(dialogSource).toContain("DialogPrimitive.Content");
    expect(dialogSource).toContain("DialogPrimitive.Close");
    expect(dialogSource).toContain('aria-label="Close dialog"');
    expect(dialogSource).toContain("overflow-y-auto");
  });

  it("modals across all operational workflows provide accessible titles for screen readers", () => {
    const ordersSource = fs.readFileSync(path.join(pagesDir, "orders-page.tsx"), "utf8");
    expect(ordersSource).toContain("<DialogTitle>Create sales order</DialogTitle>");
    expect(ordersSource).toContain("<DialogTitle>Approve sales order</DialogTitle>");

    const invoicesSource = fs.readFileSync(path.join(pagesDir, "invoices-page.tsx"), "utf8");
    expect(invoicesSource).toContain("<DialogTitle className=\"text-xl font-bold text-foreground\">");
    expect(invoicesSource).toContain("<DialogTitle>Issue credit note</DialogTitle>");
    expect(invoicesSource).toContain("<DialogTitle>Generate GST Sales Invoice</DialogTitle>");

    const productionSource = fs.readFileSync(path.join(pagesDir, "production-page.tsx"), "utf8");
    expect(productionSource).toContain("<DialogTitle>Record production batch</DialogTitle>");
    expect(productionSource).toContain("<DialogTitle>Reverse production run</DialogTitle>");

    const paymentsSource = fs.readFileSync(path.join(pagesDir, "payments-page.tsx"), "utf8");
    expect(paymentsSource).toContain("<DialogTitle>Customer statement and ledger</DialogTitle>");
    expect(paymentsSource).toContain("<DialogTitle>Record customer payment</DialogTitle>");

    const purchasesSource = fs.readFileSync(path.join(pagesDir, "purchases-page.tsx"), "utf8");
    expect(purchasesSource).toContain("<DialogTitle>Record Purchase Receipt</DialogTitle>");

    const dispatchSource = fs.readFileSync(path.join(pagesDir, "dispatch-page.tsx"), "utf8");
    expect(dispatchSource).toContain("<DialogTitle>Record physical dispatch</DialogTitle>");

    const suppliersSource = fs.readFileSync(path.join(pagesDir, "suppliers-page.tsx"), "utf8");
    expect(suppliersSource).toContain("<DialogTitle>Add New Raw Material Supplier</DialogTitle>");

    const settingsSource = fs.readFileSync(path.join(pagesDir, "settings-page.tsx"), "utf8");
    expect(settingsSource).toContain("<DialogTitle>Add New Staff Member</DialogTitle>");
  });
});
