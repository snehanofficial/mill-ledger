import type { Role } from "@mill-ledger/shared";

/**
 * Returns the default home workspace route for a given user role.
 * - SALESMAN: /orders (My Work & My Orders)
 * - PRODUCTION: /production/today (Today's production runs)
 * - ACCOUNTANT: /reports (Reporting Home - read-only)
 * - ADMIN / OWNER: /dashboard (Work Queue / Business Overview)
 */
export function getDefaultRouteForRole(role?: Role | null): string {
  switch (role) {
    case "SALESMAN":
      return "/orders";
    case "PRODUCTION":
      return "/production/today";
    case "ACCOUNTANT":
      return "/reports";
    case "ADMIN":
    case "OWNER":
    default:
      return "/dashboard";
  }
}

/**
 * Authoritative UI route permission mapping conforming to:
 * - docs/authorization-matrix.md
 * - docs/02-experience/frontend-navigation-map.md
 */
export const ROUTE_PERMISSIONS: Record<string, Role[]> = {
  "/dashboard": ["ADMIN", "OWNER"],
  "/orders": ["ADMIN", "SALESMAN", "ACCOUNTANT", "OWNER"],
  "/orders/new": ["ADMIN", "SALESMAN"],
  "/orders/:orderId": ["ADMIN", "SALESMAN", "ACCOUNTANT", "OWNER"],
  "/invoices": ["ADMIN", "ACCOUNTANT", "OWNER"],
  "/invoices/new": ["ADMIN"],
  "/invoices/:invoiceId": ["ADMIN", "ACCOUNTANT", "OWNER"],
  "/dispatch": ["ADMIN", "OWNER"],
  "/dispatch/new": ["ADMIN"],
  "/dispatch/:dispatchId": ["ADMIN", "OWNER"],
  "/payments": ["ADMIN", "ACCOUNTANT", "OWNER"],
  "/payments/new": ["ADMIN"],
  "/payments/:paymentId": ["ADMIN", "ACCOUNTANT", "OWNER"],
  "/receivables": ["ADMIN", "ACCOUNTANT", "OWNER"],
  "/receivables/:customerId": ["ADMIN", "ACCOUNTANT", "OWNER"],
  "/stock": ["ADMIN", "PRODUCTION", "ACCOUNTANT", "OWNER"],
  "/stock/:itemId/ledger": ["ADMIN", "PRODUCTION", "ACCOUNTANT", "OWNER"],
  "/purchases": ["ADMIN", "PRODUCTION", "ACCOUNTANT", "OWNER"],
  "/purchases/new": ["ADMIN", "PRODUCTION"],
  "/purchases/:receiptId": ["ADMIN", "PRODUCTION", "ACCOUNTANT", "OWNER"],
  "/suppliers": ["ADMIN", "PRODUCTION", "ACCOUNTANT", "OWNER"],
  "/suppliers/:supplierId": ["ADMIN", "PRODUCTION", "ACCOUNTANT", "OWNER"],
  "/production/today": ["ADMIN", "PRODUCTION", "OWNER"],
  "/production/new": ["ADMIN", "PRODUCTION"],
  "/production/history": ["ADMIN", "PRODUCTION", "OWNER"],
  "/production/runs/:runId": ["ADMIN", "PRODUCTION", "OWNER"],
  "/production/recipes": ["ADMIN", "PRODUCTION", "OWNER"],
  "/customers": ["ADMIN", "SALESMAN", "ACCOUNTANT", "OWNER"],
  "/customers/:customerId": ["ADMIN", "SALESMAN", "ACCOUNTANT", "OWNER"],
  "/products": ["ADMIN", "SALESMAN", "PRODUCTION", "ACCOUNTANT", "OWNER"],
  "/products/:productId": ["ADMIN", "SALESMAN", "PRODUCTION", "ACCOUNTANT", "OWNER"],
  "/reports": ["ADMIN", "ACCOUNTANT", "OWNER"],
  "/reports/sales": ["ADMIN", "SALESMAN", "ACCOUNTANT", "OWNER"],
  "/reports/stock": ["ADMIN", "SALESMAN", "PRODUCTION", "ACCOUNTANT", "OWNER"],
  "/reports/production": ["ADMIN", "PRODUCTION", "ACCOUNTANT", "OWNER"],
  "/reports/receivables": ["ADMIN", "ACCOUNTANT", "OWNER"],
  "/reports/gst": ["ADMIN", "ACCOUNTANT", "OWNER"],
  "/reports/audit": ["ADMIN", "ACCOUNTANT", "OWNER"],
  "/exports": ["ADMIN", "ACCOUNTANT", "OWNER"],
  "/settings": ["ADMIN", "OWNER"],
  "/showcase": ["ADMIN", "OWNER"],
};

function matchRoutePattern(pattern: string, pathname: string): boolean {
  if (pattern === pathname) return true;
  if (!pattern.includes(":")) return false;
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) return false;
  return patternParts.every(
    (part, index) => part.startsWith(":") || part === pathParts[index],
  );
}

/**
 * Checks whether a role has access to a specific route.
 * Unknown protected routes fail closed (return false) to prevent accidental exposure.
 */
export function isRoutePermitted(route: string, role?: Role | null): boolean {
  if (!role) return false;
  const cleanRoute = route.split("?")[0] || "/";
  const exactAllowed = ROUTE_PERMISSIONS[cleanRoute];
  if (exactAllowed) {
    return exactAllowed.includes(role);
  }
  for (const [pattern, allowed] of Object.entries(ROUTE_PERMISSIONS)) {
    if (matchRoutePattern(pattern, cleanRoute)) {
      return allowed.includes(role);
    }
  }
  return false;
}
