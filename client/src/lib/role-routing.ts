import type { Role } from "@mill-ledger/shared";

/**
 * Returns the default home workspace route for a given user role.
 * - SALESMAN: /orders (order creation & personal sales stream)
 * - PRODUCTION: /production/today (daily production run batch queue)
 * - ACCOUNTANT: /invoices (statutory tax invoices & receivables)
 * - ADMIN / OWNER: /dashboard (operations overview & KPI cards)
 */
export function getDefaultRouteForRole(role?: Role | null): string {
  switch (role) {
    case "SALESMAN":
      return "/orders";
    case "PRODUCTION":
      return "/production/today";
    case "ACCOUNTANT":
      return "/invoices";
    case "ADMIN":
    case "OWNER":
    default:
      return "/dashboard";
  }
}

/**
 * Authoritative UI route permission mapping conforming to:
 * - docs/authorization-matrix.md
 * - audit/evidence/role-ui-route-matrix.csv
 * - OWASP Top 10:2021 A01:2021 (Broken Access Control)
 */
export const ROUTE_PERMISSIONS: Record<string, Role[]> = {
  "/dashboard": ["ADMIN", "OWNER"],
  "/orders": ["ADMIN", "SALESMAN", "ACCOUNTANT", "OWNER"],
  "/orders/new": ["ADMIN", "SALESMAN"],
  "/invoices": ["ADMIN", "ACCOUNTANT", "OWNER"],
  "/dispatch": ["ADMIN", "OWNER"],
  "/payments": ["ADMIN", "ACCOUNTANT", "OWNER"],
  "/stock": ["ADMIN", "PRODUCTION", "ACCOUNTANT", "OWNER"],
  "/purchases": ["ADMIN", "PRODUCTION", "ACCOUNTANT", "OWNER"],
  "/suppliers": ["ADMIN", "PRODUCTION", "ACCOUNTANT", "OWNER"],
  "/production/today": ["ADMIN", "PRODUCTION", "OWNER"],
  "/production/new": ["ADMIN", "PRODUCTION"],
  "/production/history": ["ADMIN", "PRODUCTION", "OWNER"],
  "/customers": ["ADMIN", "SALESMAN", "ACCOUNTANT", "OWNER"],
  "/reports/sales": ["ADMIN", "SALESMAN", "ACCOUNTANT", "OWNER"],
  "/reports/stock": ["ADMIN", "SALESMAN", "PRODUCTION", "ACCOUNTANT", "OWNER"],
  "/reports/production": ["ADMIN", "PRODUCTION", "ACCOUNTANT", "OWNER"],
  "/reports/receivables": ["ADMIN", "ACCOUNTANT", "OWNER"],
  "/reports/gst": ["ADMIN", "ACCOUNTANT", "OWNER"],
  "/reports/audit": ["ADMIN", "ACCOUNTANT", "OWNER"],
  "/exports": ["ADMIN", "ACCOUNTANT", "OWNER"],
  "/settings": ["ADMIN", "OWNER"],
};

/**
 * Checks whether a role has access to a specific route.
 */
export function isRoutePermitted(route: string, role?: Role | null): boolean {
  if (!role) return false;
  const allowed = ROUTE_PERMISSIONS[route];
  if (!allowed) {
    // If not explicitly restricted, allow authenticated access
    return true;
  }
  return allowed.includes(role);
}
