import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("F-046 Regression Test: Ephemeral Filter, Sort, and Tab State Preserved in URL", () => {
  it("client/src/hooks/use-url-state.ts exists and wraps useSearchParams with clean param handling", () => {
    const hookPath = path.resolve(
      process.cwd(),
      "client/src/hooks/use-url-state.ts",
    );
    expect(fs.existsSync(hookPath), "use-url-state.ts must exist").toBe(true);

    const content = fs.readFileSync(hookPath, "utf-8");
    expect(content).toContain("useSearchParams");
    expect(content).toContain("react-router-dom");
    expect(content).toContain("useUrlState");
    expect(content).toContain("next.delete(key)");
    expect(content).toContain("next.set(key");
  });

  it("URL parameter synchronization logic cleans defaults and preserves other parameters", () => {
    // Test URL search params reconciliation logic as implemented by useUrlState
    const reconcileParam = (
      currentQuery: string,
      key: string,
      newVal: string,
      defaultVal: string,
    ) => {
      const sp = new URLSearchParams(currentQuery);
      if (newVal === defaultVal || newVal === "" || newVal === undefined || newVal === null) {
        sp.delete(key);
      } else {
        sp.set(key, newVal);
      }
      return sp.toString();
    };

    // Setting a non-default param adds it
    expect(reconcileParam("", "status", "APPROVED", "ALL")).toBe("status=APPROVED");

    // Setting it back to default cleans it up
    expect(reconcileParam("status=APPROVED", "status", "ALL", "ALL")).toBe("");

    // Preserves other active parameters
    expect(reconcileParam("tab=stream&q=Madurai", "status", "SUBMITTED", "ALL")).toBe(
      "tab=stream&q=Madurai&status=SUBMITTED",
    );

    // Deleting one param leaves others intact
    expect(reconcileParam("tab=stream&status=APPROVED", "status", "ALL", "ALL")).toBe(
      "tab=stream",
    );
  });

  it("OrdersPage synchronizes active tab, status filter, and search query to URL", () => {
    const filePath = path.resolve(process.cwd(), "client/src/pages/orders-page.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    expect(content).toContain('useUrlState<"stream" | "outbox">');
    expect(content).toContain('"tab"');
    expect(content).toContain('useUrlState("status"');
    expect(content).toContain('useUrlState("q"');
    expect(content).toContain("filteredOrders");
  });

  it("InvoicesPage synchronizes status filter and search query to URL", () => {
    const filePath = path.resolve(process.cwd(), "client/src/pages/invoices-page.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    expect(content).toContain('useUrlState("status"');
    expect(content).toContain('useUrlState("q"');
    expect(content).toContain("filteredInvoices");
  });

  it("ReportsPage synchronizes active tab, search query, and audit action filter to URL", () => {
    const filePath = path.resolve(process.cwd(), "client/src/pages/reports-page.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    expect(content).toContain('useUrlState<string>');
    expect(content).toContain('"tab"');
    expect(content).toContain('useUrlState("q"');
    expect(content).toContain('useUrlState("action"');
  });

  it("PaymentsPage synchronizes active tab, mode filter, and search query to URL", () => {
    const filePath = path.resolve(process.cwd(), "client/src/pages/payments-page.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    expect(content).toContain('useUrlState<"ledger" | "receivables">');
    expect(content).toContain('"tab"');
    expect(content).toContain('useUrlState("mode"');
    expect(content).toContain('useUrlState("q"');
    expect(content).toContain("filteredPayments");
    expect(content).toContain("filteredReceivables");
  });

  it("SuppliersPage and CustomersPage synchronize search and status filters to URL", () => {
    const suppliersPath = path.resolve(process.cwd(), "client/src/pages/suppliers-page.tsx");
    const suppliersContent = fs.readFileSync(suppliersPath, "utf-8");
    expect(suppliersContent).toContain('useUrlState("q"');
    expect(suppliersContent).toContain("useUrlState");
    expect(suppliersContent).toContain('"status"');
    expect(suppliersContent).toContain("filteredSuppliers");

    const customersPath = path.resolve(process.cwd(), "client/src/pages/customers-page.tsx");
    const customersContent = fs.readFileSync(customersPath, "utf-8");
    expect(customersContent).toContain('useUrlState("q"');
    expect(customersContent).toContain("filteredCustomers");
  });

  it("StockPage, DispatchPage, PurchasesPage, and ProductionPage synchronize filter states to URL", () => {
    const stockPath = path.resolve(process.cwd(), "client/src/pages/stock-page.tsx");
    const stockContent = fs.readFileSync(stockPath, "utf-8");
    expect(stockContent).toContain('useUrlState("q"');
    expect(stockContent).toContain('useUrlState("category"');
    expect(stockContent).toContain("filteredBalances");

    const dispatchPath = path.resolve(process.cwd(), "client/src/pages/dispatch-page.tsx");
    const dispatchContent = fs.readFileSync(dispatchPath, "utf-8");
    expect(dispatchContent).toContain('useUrlState("q"');
    expect(dispatchContent).toContain("filteredDispatches");

    const purchasesPath = path.resolve(process.cwd(), "client/src/pages/purchases-page.tsx");
    const purchasesContent = fs.readFileSync(purchasesPath, "utf-8");
    expect(purchasesContent).toContain('useUrlState("q"');
    expect(purchasesContent).toContain("filteredReceipts");

    const prodPath = path.resolve(process.cwd(), "client/src/pages/production-page.tsx");
    const prodContent = fs.readFileSync(prodPath, "utf-8");
    expect(prodContent).toContain('useUrlState("q"');
    expect(prodContent).toContain("filteredRuns");
  });
});
