import { describe, it, expect } from "vitest";
import { dictionary, translate } from "../../client/src/lib/i18n";

describe("F-043 Regression: Tamil Localization & Parity Across MillLedger", () => {
  it("translates primary navigation sections, items, and links to Tamil", () => {
    const navSections = [
      "Overview",
      "Operations",
      "Inventory",
      "Reporting",
      "Customers",
      "Settings",
    ];

    const navItems = [
      "Dashboard",
      "Orders",
      "All orders",
      "New order",
      "Production",
      "Today's runs",
      "New run",
      "Run history",
      "Stock",
      "Purchases",
      "Suppliers",
      "Invoices",
      "Dispatch",
      "Payments",
      "Reports",
      "Sales",
      "Receivables",
      "GST",
      "Audit log",
      "Exports",
    ];

    const tamilUnicodeRegex = /[\u0B80-\u0BFF]/;

    for (const section of navSections) {
      const translated = translate(section, section, "ta");
      expect(
        tamilUnicodeRegex.test(translated),
        `Section "${section}" must translate to Tamil, got "${translated}"`,
      ).toBe(true);
    }

    for (const item of navItems) {
      const translated = translate(item, item, "ta");
      expect(
        tamilUnicodeRegex.test(translated),
        `Item "${item}" must translate to Tamil, got "${translated}"`,
      ).toBe(true);
    }
  });

  it("translates all core operational entity headers across the 11 business routes", () => {
    const tableHeaders = [
      "Order number",
      "Invoice number",
      "Run number",
      "Batch number",
      "Customer",
      "Supplier",
      "Salesman",
      "Ordered",
      "Taxable",
      "GST",
      "Total",
      "Shortage status",
      "Actions",
      "SKU",
      "Item Name",
      "Category",
      "On Hand",
      "Avg Unit Cost",
      "Total Value",
      "Ledger Status",
      "Good packets",
      "Damaged packets",
      "Yield variance",
      "Materials cost",
      "Total cost",
      "Cost / packet",
      "Place of supply",
      "Outstanding",
      "HSN",
      "Qty",
      "Rate",
      "Date",
      "Status",
      "Vehicle number",
      "Driver name",
      "Paid amount",
      "Unallocated",
    ];

    const tamilUnicodeRegex = /[\u0B80-\u0BFF]/;

    for (const header of tableHeaders) {
      const translated = translate(header, header, "ta");
      expect(
        tamilUnicodeRegex.test(translated),
        `Header "${header}" must translate to Tamil, got "${translated}"`,
      ).toBe(true);
    }
  });

  it("translates mill floor commodities, units, and packaging jargon", () => {
    expect(translate("term.murukku", "", "ta")).toBe("முறுக்கு 200 கி");
    expect(translate("term.raw_rice_flour", "", "ta")).toBe("பச்சரிசி மாவு");
    expect(translate("term.refined_palm_oil", "", "ta")).toBe("சுத்திகரிக்கப்பட்ட பாமாயில்");
    expect(translate("term.packaging_pouch", "", "ta")).toBe("பேக்கிங் கவர்");
    expect(translate("term.carton_box", "", "ta")).toBe("அட்டைப்பெட்டி");
    expect(translate("term.kg", "", "ta")).toBe("கிலோ");
    expect(translate("term.liter", "", "ta")).toBe("லிட்டர்");
    expect(translate("term.pcs", "", "ta")).toBe("எண்ணிக்கை");
  });

  it("preserves English strings when language is set to 'en'", () => {
    expect(translate("Orders", "Orders", "en")).toBe("Orders");
    expect(translate("Order number", "Order number", "en")).toBe("Order number");
    expect(translate("Stock valuation", "Stock valuation", "en")).toBe("Stock valuation");
    expect(translate("Sign out", "Sign out", "en")).toBe("Sign out");
  });

  it("handles namespaced keys and direct phrase fallbacks identically", () => {
    expect(translate("nav.orders", "", "ta")).toBe(translate("Orders", "", "ta"));
    expect(translate("term.customer", "", "ta")).toBe(translate("Customer", "", "ta"));
    expect(translate("action.refresh", "", "ta")).toBe(translate("Refresh", "", "ta"));
  });
});
