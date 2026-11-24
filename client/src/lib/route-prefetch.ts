/**
 * Intent-based and idle route prefetching (F-076).
 * Initiates dynamic chunk import on hover, focus, or browser idle time.
 */

export const ROUTE_CHUNK_LOADERS: Record<string, () => Promise<unknown>> = {
  "/": () => import("@/pages/public/landing-page"),
  "/catalog": () => import("@/pages/public/catalog-page"),
  "/contact": () => import("@/pages/public/contact-page"),
  "/login": () => import("@/pages/login-page"),
  "/auth/login": () => import("@/pages/login-page"),
  "/dashboard": () => import("@/pages/dashboard-page"),
  "/stock": () => import("@/pages/stock-page"),
  "/production": () => import("@/pages/production-page"),
  "/production/today": () => import("@/pages/production-page"),
  "/production/new": () => import("@/pages/production-page"),
  "/production/history": () => import("@/pages/production-page"),
  "/orders": () => import("@/pages/orders-page"),
  "/orders/new": () => import("@/pages/new-order-page"),
  "/invoices": () => import("@/pages/invoices-page"),
  "/dispatch": () => import("@/pages/dispatch-page"),
  "/payments": () => import("@/pages/payments-page"),
  "/reports/sales": () => import("@/pages/reports-page"),
  "/reports/stock": () => import("@/pages/reports-page"),
  "/reports/production": () => import("@/pages/reports-page"),
  "/reports/receivables": () => import("@/pages/reports-page"),
  "/reports/gst": () => import("@/pages/reports-page"),
  "/reports/audit": () => import("@/pages/reports-page"),
  "/purchases": () => import("@/pages/purchases-page"),
  "/suppliers": () => import("@/pages/suppliers-page"),
  "/customers": () => import("@/pages/customers-page"),
  "/exports": () => import("@/pages/exports-page"),
  "/settings": () => import("@/pages/settings-page"),
};

const prefetchedRoutes = new Set<string>();

export function prefetchRoute(href: string | undefined): void {
  if (!href || href === "#" || href.startsWith("http")) return;

  // Clean pathname from query string or hash
  const pathname = href.split("?")[0].split("#")[0];
  if (prefetchedRoutes.has(pathname)) return;

  const loader =
    ROUTE_CHUNK_LOADERS[pathname] ||
    ROUTE_CHUNK_LOADERS["/" + pathname.split("/")[1]];
  if (loader) {
    prefetchedRoutes.add(pathname);
    loader().catch(() => {
      // In case of transient network failure during prefetch, allow retry
      prefetchedRoutes.delete(pathname);
    });
  }
}

export function getPrefetchProps(href: string | undefined) {
  if (!href || href === "#" || href.startsWith("http")) return {};
  return {
    onPointerEnter: () => prefetchRoute(href),
    onFocus: () => prefetchRoute(href),
  };
}

export function prefetchIdleRoutes(routes?: string[]): void {
  if (typeof window === "undefined") return;

  const defaultRoutes = ["/orders", "/invoices", "/stock", "/dashboard"];
  const targets = routes || defaultRoutes;

  const schedule =
    typeof window.requestIdleCallback === "function"
      ? window.requestIdleCallback
      : (cb: () => void) => setTimeout(cb, 1200);

  schedule(() => {
    for (const r of targets) {
      prefetchRoute(r);
    }
  });
}
