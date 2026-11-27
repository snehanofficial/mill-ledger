import { describe, expect, it } from "vitest";
import {
  getDefaultRouteForRole,
  isRoutePermitted,
  ROUTE_PERMISSIONS,
} from "./role-routing";
import type { Role } from "@mill-ledger/shared";

describe("Frontend Route-Level Role Authorization & Default Workspaces", () => {
  describe("getDefaultRouteForRole", () => {
    it("routes SALESMAN to their order intake workspace", () => {
      expect(getDefaultRouteForRole("SALESMAN")).toBe("/orders");
    });

    it("routes PRODUCTION to the daily production queue", () => {
      expect(getDefaultRouteForRole("PRODUCTION")).toBe("/production/today");
    });

    it("routes ACCOUNTANT to reporting home", () => {
      expect(getDefaultRouteForRole("ACCOUNTANT")).toBe("/reports");
    });

    it("routes ADMIN and OWNER to operations dashboard", () => {
      expect(getDefaultRouteForRole("ADMIN")).toBe("/dashboard");
      expect(getDefaultRouteForRole("OWNER")).toBe("/dashboard");
    });

    it("defaults unknown or null role to /dashboard safely", () => {
      expect(getDefaultRouteForRole(null)).toBe("/dashboard");
      expect(getDefaultRouteForRole(undefined)).toBe("/dashboard");
    });
  });

  describe("isRoutePermitted matrix compliance", () => {
    it("blocks SALESMAN from navigating directly to sensitive finance and production views", () => {
      expect(isRoutePermitted("/invoices", "SALESMAN")).toBe(false);
      expect(isRoutePermitted("/invoices/inv-1", "SALESMAN")).toBe(false);
      expect(isRoutePermitted("/payments", "SALESMAN")).toBe(false);
      expect(isRoutePermitted("/receivables", "SALESMAN")).toBe(false);
      expect(isRoutePermitted("/dispatch", "SALESMAN")).toBe(false);
      expect(isRoutePermitted("/stock", "SALESMAN")).toBe(false);
      expect(isRoutePermitted("/purchases", "SALESMAN")).toBe(false);
      expect(isRoutePermitted("/production/today", "SALESMAN")).toBe(false);
      expect(isRoutePermitted("/production/new", "SALESMAN")).toBe(false);
      expect(isRoutePermitted("/dashboard", "SALESMAN")).toBe(false);
      expect(isRoutePermitted("/settings", "SALESMAN")).toBe(false);
      expect(isRoutePermitted("/exports", "SALESMAN")).toBe(false);
      expect(isRoutePermitted("/reports", "SALESMAN")).toBe(false);

      // Permitted views for Salesman
      expect(isRoutePermitted("/orders", "SALESMAN")).toBe(true);
      expect(isRoutePermitted("/orders/new", "SALESMAN")).toBe(true);
      expect(isRoutePermitted("/orders/ord-123", "SALESMAN")).toBe(true);
      expect(isRoutePermitted("/customers", "SALESMAN")).toBe(true);
      expect(isRoutePermitted("/customers/cust-123", "SALESMAN")).toBe(true);
      expect(isRoutePermitted("/reports/sales", "SALESMAN")).toBe(true);
      expect(isRoutePermitted("/reports/stock", "SALESMAN")).toBe(true);
    });

    it("blocks PRODUCTION from accessing sales orders, finance, invoices, or dispatches", () => {
      expect(isRoutePermitted("/orders", "PRODUCTION")).toBe(false);
      expect(isRoutePermitted("/orders/new", "PRODUCTION")).toBe(false);
      expect(isRoutePermitted("/invoices", "PRODUCTION")).toBe(false);
      expect(isRoutePermitted("/payments", "PRODUCTION")).toBe(false);
      expect(isRoutePermitted("/receivables", "PRODUCTION")).toBe(false);
      expect(isRoutePermitted("/dispatch", "PRODUCTION")).toBe(false);
      expect(isRoutePermitted("/customers", "PRODUCTION")).toBe(false);
      expect(isRoutePermitted("/dashboard", "PRODUCTION")).toBe(false);
      expect(isRoutePermitted("/settings", "PRODUCTION")).toBe(false);

      // Permitted views for Production
      expect(isRoutePermitted("/production/today", "PRODUCTION")).toBe(true);
      expect(isRoutePermitted("/production/new", "PRODUCTION")).toBe(true);
      expect(isRoutePermitted("/production/history", "PRODUCTION")).toBe(true);
      expect(isRoutePermitted("/production/runs/run-1", "PRODUCTION")).toBe(
        true,
      );
      expect(isRoutePermitted("/production/recipes", "PRODUCTION")).toBe(true);
      expect(isRoutePermitted("/stock", "PRODUCTION")).toBe(true);
      expect(isRoutePermitted("/stock/item-1/ledger", "PRODUCTION")).toBe(true);
      expect(isRoutePermitted("/purchases", "PRODUCTION")).toBe(true);
      expect(isRoutePermitted("/purchases/new", "PRODUCTION")).toBe(true);
      expect(isRoutePermitted("/reports/stock", "PRODUCTION")).toBe(true);
      expect(isRoutePermitted("/reports/production", "PRODUCTION")).toBe(true);
    });

    it("blocks ACCOUNTANT from order creation, dispatches, and production batch execution", () => {
      expect(isRoutePermitted("/orders/new", "ACCOUNTANT")).toBe(false);
      expect(isRoutePermitted("/invoices/new", "ACCOUNTANT")).toBe(false);
      expect(isRoutePermitted("/dispatch", "ACCOUNTANT")).toBe(false);
      expect(isRoutePermitted("/payments/new", "ACCOUNTANT")).toBe(false);
      expect(isRoutePermitted("/production/today", "ACCOUNTANT")).toBe(false);
      expect(isRoutePermitted("/production/new", "ACCOUNTANT")).toBe(false);
      expect(isRoutePermitted("/production/history", "ACCOUNTANT")).toBe(false);
      expect(isRoutePermitted("/dashboard", "ACCOUNTANT")).toBe(false);
      expect(isRoutePermitted("/settings", "ACCOUNTANT")).toBe(false);

      // Permitted read/finance views for Accountant
      expect(isRoutePermitted("/reports", "ACCOUNTANT")).toBe(true);
      expect(isRoutePermitted("/orders", "ACCOUNTANT")).toBe(true);
      expect(isRoutePermitted("/orders/ord-1", "ACCOUNTANT")).toBe(true);
      expect(isRoutePermitted("/invoices", "ACCOUNTANT")).toBe(true);
      expect(isRoutePermitted("/invoices/inv-1", "ACCOUNTANT")).toBe(true);
      expect(isRoutePermitted("/payments", "ACCOUNTANT")).toBe(true);
      expect(isRoutePermitted("/receivables", "ACCOUNTANT")).toBe(true);
      expect(isRoutePermitted("/receivables/cust-1", "ACCOUNTANT")).toBe(true);
      expect(isRoutePermitted("/stock", "ACCOUNTANT")).toBe(true);
      expect(isRoutePermitted("/purchases", "ACCOUNTANT")).toBe(true);
      expect(isRoutePermitted("/customers", "ACCOUNTANT")).toBe(true);
      expect(isRoutePermitted("/reports/sales", "ACCOUNTANT")).toBe(true);
      expect(isRoutePermitted("/reports/receivables", "ACCOUNTANT")).toBe(true);
      expect(isRoutePermitted("/reports/gst", "ACCOUNTANT")).toBe(true);
      expect(isRoutePermitted("/exports", "ACCOUNTANT")).toBe(true);
    });

    it("blocks OWNER from operational write forms per authorization matrix", () => {
      expect(isRoutePermitted("/orders/new", "OWNER")).toBe(false);
      expect(isRoutePermitted("/invoices/new", "OWNER")).toBe(false);
      expect(isRoutePermitted("/dispatch/new", "OWNER")).toBe(false);
      expect(isRoutePermitted("/payments/new", "OWNER")).toBe(false);
      expect(isRoutePermitted("/purchases/new", "OWNER")).toBe(false);
      expect(isRoutePermitted("/production/new", "OWNER")).toBe(false);

      // Permitted views for Owner
      expect(isRoutePermitted("/dashboard", "OWNER")).toBe(true);
      expect(isRoutePermitted("/orders", "OWNER")).toBe(true);
      expect(isRoutePermitted("/invoices", "OWNER")).toBe(true);
      expect(isRoutePermitted("/dispatch", "OWNER")).toBe(true);
      expect(isRoutePermitted("/payments", "OWNER")).toBe(true);
      expect(isRoutePermitted("/receivables", "OWNER")).toBe(true);
      expect(isRoutePermitted("/stock", "OWNER")).toBe(true);
      expect(isRoutePermitted("/purchases", "OWNER")).toBe(true);
      expect(isRoutePermitted("/production/today", "OWNER")).toBe(true);
      expect(isRoutePermitted("/production/history", "OWNER")).toBe(true);
      expect(isRoutePermitted("/reports", "OWNER")).toBe(true);
      expect(isRoutePermitted("/settings", "OWNER")).toBe(true);
    });

    it("allows ADMIN access across all configured system routes", () => {
      const allRoutes = Object.keys(ROUTE_PERMISSIONS);
      for (const route of allRoutes) {
        expect(isRoutePermitted(route, "ADMIN")).toBe(true);
      }
    });

    it("fails closed for unknown routes and unauthenticated users", () => {
      expect(isRoutePermitted("/invoices", null)).toBe(false);
      expect(isRoutePermitted("/dashboard", null)).toBe(false);
      expect(isRoutePermitted("/unknown-secret-route", "ADMIN")).toBe(false);
      expect(isRoutePermitted("/unknown-secret-route", "OWNER")).toBe(false);
    });
  });

  describe("Exact parity with authorization matrix", () => {
    const roles: Role[] = [
      "ADMIN",
      "SALESMAN",
      "PRODUCTION",
      "ACCOUNTANT",
      "OWNER",
    ];
    const expectedPermittedRoutes: Record<string, string[]> = {
      "/dashboard": ["ADMIN", "OWNER"],
      "/orders": ["ADMIN", "SALESMAN", "ACCOUNTANT", "OWNER"],
      "/orders/new": ["ADMIN", "SALESMAN"],
      "/invoices": ["ADMIN", "ACCOUNTANT", "OWNER"],
      "/dispatch": ["ADMIN", "OWNER"],
      "/payments": ["ADMIN", "ACCOUNTANT", "OWNER"],
      "/receivables": ["ADMIN", "ACCOUNTANT", "OWNER"],
      "/stock": ["ADMIN", "PRODUCTION", "ACCOUNTANT", "OWNER"],
      "/purchases": ["ADMIN", "PRODUCTION", "ACCOUNTANT", "OWNER"],
      "/production/today": ["ADMIN", "PRODUCTION", "OWNER"],
      "/production/new": ["ADMIN", "PRODUCTION"],
      "/production/history": ["ADMIN", "PRODUCTION", "OWNER"],
      "/customers": ["ADMIN", "SALESMAN", "ACCOUNTANT", "OWNER"],
      "/reports": ["ADMIN", "ACCOUNTANT", "OWNER"],
      "/reports/sales": ["ADMIN", "SALESMAN", "ACCOUNTANT", "OWNER"],
      "/reports/stock": [
        "ADMIN",
        "SALESMAN",
        "PRODUCTION",
        "ACCOUNTANT",
        "OWNER",
      ],
      "/reports/production": ["ADMIN", "PRODUCTION", "ACCOUNTANT", "OWNER"],
      "/reports/receivables": ["ADMIN", "ACCOUNTANT", "OWNER"],
      "/reports/gst": ["ADMIN", "ACCOUNTANT", "OWNER"],
      "/reports/audit": ["ADMIN", "ACCOUNTANT", "OWNER"],
      "/exports": ["ADMIN", "ACCOUNTANT", "OWNER"],
      "/settings": ["ADMIN", "OWNER"],
    };

    for (const [route, expectedRoles] of Object.entries(
      expectedPermittedRoutes,
    )) {
      it(`enforces exact role list for ${route}`, () => {
        for (const role of roles) {
          const shouldBeAllowed = expectedRoles.includes(role);
          expect(isRoutePermitted(route, role)).toBe(shouldBeAllowed);
        }
      });
    }
  });
});
