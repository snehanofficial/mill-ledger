import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("F-053 Regression Test: Dynamic Route Titles and SPA Screen Reader Announcements (WCAG 2.2 SC 2.4.2, 4.1.3)", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const layoutPath = path.join(repoRoot, "client/src/layouts/authenticated-layout.tsx");
  const handlesPath = path.join(repoRoot, "client/src/routes/route-handles.ts");

  it("AuthenticatedLayout renders a polite, atomic aria-live status container for route transitions", () => {
    const layoutSource = fs.readFileSync(layoutPath, "utf8");

    expect(layoutSource).toContain('id="route-announcer"');
    expect(layoutSource).toContain('role="status"');
    expect(layoutSource).toContain('aria-live="polite"');
    expect(layoutSource).toContain('aria-atomic="true"');
    expect(layoutSource).toContain('className="sr-only"');
    expect(layoutSource).toContain("{routeAnnouncement}");
  });

  it("AuthenticatedLayout updates document.title and routeAnnouncement on navigation", () => {
    const layoutSource = fs.readFileSync(layoutPath, "utf8");

    expect(layoutSource).toContain("document.title = `${label} | MillLedger`");
    expect(layoutSource).toContain("const routeAnnouncement = `${label} view loaded`;");
  });

  it("AuthenticatedLayout resets focus to #main-content upon client-side SPA navigation", () => {
    const layoutSource = fs.readFileSync(layoutPath, "utf8");

    expect(layoutSource).toContain('document.getElementById("main-content")');
    expect(layoutSource).toContain("main.focus({ preventScroll: true })");
  });

  it("route-handles.ts exports accessible titles for all operational views", () => {
    const handlesSource = fs.readFileSync(handlesPath, "utf8");

    expect(handlesSource).toContain('export const dashboardHandle: RouteHandle = { breadcrumb: "Overview" }');
    expect(handlesSource).toContain('export const ordersHandle: RouteHandle = { breadcrumb: "Orders" }');
    expect(handlesSource).toContain('export const newOrderHandle: RouteHandle = { breadcrumb: "New order" }');
    expect(handlesSource).toContain('export const invoicesHandle: RouteHandle = { breadcrumb: "Invoices" }');
    expect(handlesSource).toContain('export const dispatchHandle: RouteHandle = { breadcrumb: "Dispatch" }');
    expect(handlesSource).toContain('export const paymentsHandle: RouteHandle = { breadcrumb: "Payments" }');
    expect(handlesSource).toContain('export const stockHandle: RouteHandle = { breadcrumb: "Stock" }');
    expect(handlesSource).toContain('export const purchasesHandle: RouteHandle = { breadcrumb: "Purchases" }');
    expect(handlesSource).toContain('export const suppliersHandle: RouteHandle = { breadcrumb: "Suppliers" }');
    expect(handlesSource).toContain('export const customersHandle: RouteHandle = { breadcrumb: "Customers" }');
    expect(handlesSource).toContain('export const exportsHandle: RouteHandle = { breadcrumb: "Exports" }');
    expect(handlesSource).toContain('export const settingsHandle: RouteHandle = { breadcrumb: "Settings" }');
  });
});
