import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("F-052 Regression Test: Programmatic Form Labels & Accessible Names (WCAG 2.2 SC 1.3.1, 3.3.2, 4.1.2)", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const pagesDir = path.join(repoRoot, "client/src/pages");

  it("orders-page.tsx provides explicit htmlFor and matching IDs on all order form inputs", () => {
    const source = fs.readFileSync(path.join(pagesDir, "orders-page.tsx"), "utf8");
    expect(source).toContain('htmlFor="order-customer-select"');
    expect(source).toContain('id="order-customer-select"');
    expect(source).toContain('htmlFor="order-product-select"');
    expect(source).toContain('id="order-product-select"');
    expect(source).toContain('htmlFor="order-quantity-input"');
    expect(source).toContain('id="order-quantity-input"');
    expect(source).toContain('htmlFor="order-notes-input"');
    expect(source).toContain('id="order-notes-input"');
    expect(source).toContain('aria-label="Search orders"');
    expect(source).toContain('aria-label="Filter orders by status"');
  });

  it("invoices-page.tsx associates labels and inputs for credit note and generation modals", () => {
    const source = fs.readFileSync(path.join(pagesDir, "invoices-page.tsx"), "utf8");
    expect(source).toContain('htmlFor="credit-note-reason"');
    expect(source).toContain('id="credit-note-reason"');
    expect(source).toContain('htmlFor="credit-note-amount"');
    expect(source).toContain('id="credit-note-amount"');
    expect(source).toContain('htmlFor="invoice-order-select"');
    expect(source).toContain('id="invoice-order-select"');
    expect(source).toContain('htmlFor="invoice-notes-input"');
    expect(source).toContain('id="invoice-notes-input"');
    expect(source).toContain('aria-label="Search invoices"');
    expect(source).toContain('aria-label="Filter invoices by status"');
  });

  it("production-page.tsx associates labels and inputs across BOM, actuals, costs, and reversal", () => {
    const source = fs.readFileSync(path.join(pagesDir, "production-page.tsx"), "utf8");
    expect(source).toContain('htmlFor="production-recipe-select"');
    expect(source).toContain('id="production-recipe-select"');
    expect(source).toContain('htmlFor="production-good-qty-input"');
    expect(source).toContain('id="production-good-qty-input"');
    expect(source).toContain('htmlFor="production-damaged-pouches-input"');
    expect(source).toContain('id="production-damaged-pouches-input"');
    expect(source).toContain('htmlFor="production-oil-consumed-input"');
    expect(source).toContain('id="production-oil-consumed-input"');
    expect(source).toContain('htmlFor="production-cartons-consumed-input"');
    expect(source).toContain('id="production-cartons-consumed-input"');
    expect(source).toContain('htmlFor="production-labor-cost-input"');
    expect(source).toContain('id="production-labor-cost-input"');
    expect(source).toContain('htmlFor="production-utility-cost-input"');
    expect(source).toContain('id="production-utility-cost-input"');
    expect(source).toContain('htmlFor="production-notes-input"');
    expect(source).toContain('id="production-notes-input"');
    expect(source).toContain('htmlFor="reversal-reason-input"');
    expect(source).toContain('id="reversal-reason-input"');
    expect(source).toContain('aria-label="Search production batches"');
  });

  it("purchases-page.tsx associates labels and inputs across goods receipt entry", () => {
    const source = fs.readFileSync(path.join(pagesDir, "purchases-page.tsx"), "utf8");
    expect(source).toContain('htmlFor="purchase-supplier-select"');
    expect(source).toContain('id="purchase-supplier-select"');
    expect(source).toContain('htmlFor="purchase-receipt-number-input"');
    expect(source).toContain('id="purchase-receipt-number-input"');
    expect(source).toContain('htmlFor="purchase-supplier-invoice-input"');
    expect(source).toContain('id="purchase-supplier-invoice-input"');
    expect(source).toContain('htmlFor="purchase-item-select"');
    expect(source).toContain('id="purchase-item-select"');
    expect(source).toContain('htmlFor="purchase-quantity-input"');
    expect(source).toContain('id="purchase-quantity-input"');
    expect(source).toContain('htmlFor="purchase-unit-price-input"');
    expect(source).toContain('id="purchase-unit-price-input"');
    expect(source).toContain('htmlFor="purchase-notes-input"');
    expect(source).toContain('id="purchase-notes-input"');
    expect(source).toContain('aria-label="Search purchase receipts"');
  });

  it("payments-page.tsx associates labels and inputs for collection recording and allocations", () => {
    const source = fs.readFileSync(path.join(pagesDir, "payments-page.tsx"), "utf8");
    expect(source).toContain('htmlFor="payment-customer-select"');
    expect(source).toContain('id="payment-customer-select"');
    expect(source).toContain('htmlFor="payment-amount-input"');
    expect(source).toContain('id="payment-amount-input"');
    expect(source).toContain('htmlFor="payment-mode-select"');
    expect(source).toContain('id="payment-mode-select"');
    expect(source).toContain('htmlFor="payment-reference-input"');
    expect(source).toContain('id="payment-reference-input"');
    expect(source).toContain('htmlFor="payment-notes-input"');
    expect(source).toContain('id="payment-notes-input"');
    expect(source).toContain('htmlFor="payment-custom-allocation-toggle"');
    expect(source).toContain('id="payment-custom-allocation-toggle"');
    expect(source).toContain('aria-label="Search payments"');
    expect(source).toContain('aria-label="Filter payments by mode"');
  });

  it("dispatch-page.tsx associates labels and inputs for dispatch recording", () => {
    const source = fs.readFileSync(path.join(pagesDir, "dispatch-page.tsx"), "utf8");
    expect(source).toContain('htmlFor="dispatch-order-select"');
    expect(source).toContain('id="dispatch-order-select"');
    expect(source).toContain('htmlFor="dispatch-vehicle-input"');
    expect(source).toContain('id="dispatch-vehicle-input"');
    expect(source).toContain('htmlFor="dispatch-driver-name-input"');
    expect(source).toContain('id="dispatch-driver-name-input"');
    expect(source).toContain('htmlFor="dispatch-driver-phone-input"');
    expect(source).toContain('id="dispatch-driver-phone-input"');
    expect(source).toContain('htmlFor="dispatch-notes-input"');
    expect(source).toContain('id="dispatch-notes-input"');
    expect(source).toContain('aria-label="Search dispatches"');
  });

  it("suppliers-page.tsx associates labels and inputs across new and edit supplier modals", () => {
    const source = fs.readFileSync(path.join(pagesDir, "suppliers-page.tsx"), "utf8");
    expect(source).toContain('htmlFor="supplier-new-code"');
    expect(source).toContain('id="supplier-new-code"');
    expect(source).toContain('htmlFor="supplier-new-name"');
    expect(source).toContain('id="supplier-new-name"');
    expect(source).toContain('htmlFor="supplier-new-state"');
    expect(source).toContain('id="supplier-new-state"');
    expect(source).toContain('htmlFor="supplier-new-phone"');
    expect(source).toContain('id="supplier-new-phone"');
    expect(source).toContain('htmlFor="supplier-new-email"');
    expect(source).toContain('id="supplier-new-email"');
    expect(source).toContain('htmlFor="supplier-new-gstin"');
    expect(source).toContain('id="supplier-new-gstin"');

    expect(source).toContain('htmlFor="supplier-edit-name"');
    expect(source).toContain('id="supplier-edit-name"');
    expect(source).toContain('htmlFor="supplier-edit-state"');
    expect(source).toContain('id="supplier-edit-state"');
    expect(source).toContain('htmlFor="supplier-edit-phone"');
    expect(source).toContain('id="supplier-edit-phone"');
    expect(source).toContain('htmlFor="supplier-edit-email"');
    expect(source).toContain('id="supplier-edit-email"');
    expect(source).toContain('htmlFor="supplier-edit-gstin"');
    expect(source).toContain('id="supplier-edit-gstin"');

    expect(source).toContain('aria-label="Search suppliers by name, code, state, GSTIN"');
  });

  it("settings-page.tsx associates labels and inputs for user creation", () => {
    const source = fs.readFileSync(path.join(pagesDir, "settings-page.tsx"), "utf8");
    expect(source).toContain('htmlFor="settings-user-name"');
    expect(source).toContain('id="settings-user-name"');
    expect(source).toContain('htmlFor="settings-user-email"');
    expect(source).toContain('id="settings-user-email"');
    expect(source).toContain('htmlFor="settings-user-password"');
    expect(source).toContain('id="settings-user-password"');
    expect(source).toContain('htmlFor="settings-user-role"');
    expect(source).toContain('id="settings-user-role"');
  });
});
