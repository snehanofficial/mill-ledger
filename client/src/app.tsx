import { lazy, Suspense } from "react";
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthenticatedLayout } from "@/layouts/authenticated-layout";
import { RoleGuard, RoleDefaultRedirect } from "@/components/auth/role-guard";
import { ROUTE_PERMISSIONS } from "@/lib/role-routing";

// Lazy-loaded routes for code splitting (MLD-014)
const LoginPage = lazy(() =>
  import("@/pages/login-page").then((m) => ({ default: m.LoginPage })),
);
const DashboardPage = lazy(() =>
  import("@/pages/dashboard-page").then((m) => ({ default: m.DashboardPage })),
);
const StockPage = lazy(() =>
  import("@/pages/stock-page").then((m) => ({ default: m.StockPage })),
);
const ProductionPage = lazy(() =>
  import("@/pages/production-page").then((m) => ({ default: m.ProductionPage })),
);
const OrdersPage = lazy(() =>
  import("@/pages/orders-page").then((m) => ({ default: m.OrdersPage })),
);
const InvoicesPage = lazy(() =>
  import("@/pages/invoices-page").then((m) => ({ default: m.InvoicesPage })),
);
const DispatchPage = lazy(() =>
  import("@/pages/dispatch-page").then((m) => ({ default: m.DispatchPage })),
);
const PaymentsPage = lazy(() =>
  import("@/pages/payments-page").then((m) => ({ default: m.PaymentsPage })),
);
const ReportsSalesPage = lazy(() =>
  import("@/pages/reports-page").then((m) => ({ default: m.ReportsSalesPage })),
);
const ReportsStockPage = lazy(() =>
  import("@/pages/reports-page").then((m) => ({ default: m.ReportsStockPage })),
);
const ReportsProductionPage = lazy(() =>
  import("@/pages/reports-page").then((m) => ({ default: m.ReportsProductionPage })),
);
const ReportsReceivablesPage = lazy(() =>
  import("@/pages/reports-page").then((m) => ({ default: m.ReportsReceivablesPage })),
);
const ReportsGSTPage = lazy(() =>
  import("@/pages/reports-page").then((m) => ({ default: m.ReportsGSTPage })),
);
const ReportsAuditPage = lazy(() =>
  import("@/pages/reports-page").then((m) => ({ default: m.ReportsAuditPage })),
);
const NewOrderPage = lazy(() =>
  import("@/pages/new-order-page").then((m) => ({ default: m.NewOrderPage })),
);
const PurchasesPage = lazy(() =>
  import("@/pages/purchases-page").then((m) => ({ default: m.PurchasesPage })),
);
const SuppliersPage = lazy(() =>
  import("@/pages/suppliers-page").then((m) => ({ default: m.SuppliersPage })),
);
const CustomersPage = lazy(() =>
  import("@/pages/customers-page").then((m) => ({ default: m.CustomersPage })),
);
const ExportsPage = lazy(() =>
  import("@/pages/placeholder-pages").then((m) => ({ default: m.ExportsPage })),
);
const SettingsPage = lazy(() =>
  import("@/pages/placeholder-pages").then((m) => ({ default: m.SettingsPage })),
);
const NotFoundPage = lazy(() =>
  import("@/pages/placeholder-pages").then((m) => ({ default: m.NotFoundPage })),
);
const ShowcasePage = lazy(() => import("@/pages/showcase-page"));
import {
  dashboardHandle,
  ordersHandle,
  newOrderHandle,
  invoicesHandle,
  dispatchHandle,
  paymentsHandle,
  stockHandle,
  purchasesHandle,
  productionTodayHandle,
  productionNewHandle,
  productionHistoryHandle,
  customersHandle,
  reportsSalesHandle,
  reportsStockHandle,
  reportsProductionHandle,
  reportsReceivablesHandle,
  reportsGSTHandle,
  reportsAuditHandle,
  exportsHandle,
  settingsHandle,
  suppliersHandle,
} from "@/routes/route-handles";

const router = createBrowserRouter([
  // ── Public routes (outside authenticated shell) ─────────────────
  {
    path: "/auth/login",
    element: (
      <Suspense
        fallback={
          <div className="flex min-h-svh items-center justify-center bg-background">
            <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        }
      >
        <LoginPage />
      </Suspense>
    ),
  },

  // ── Authenticated shell ─────────────────────────────────────────
  {
    path: "/",
    element: <AuthenticatedLayout />,
    children: [
      {
        index: true,
        element: <RoleDefaultRedirect />,
      },
      {
        path: "dashboard",
        element: (
          <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/dashboard"]}>
            <DashboardPage />
          </RoleGuard>
        ),
        handle: dashboardHandle,
      },

      // Orders
      {
        path: "orders",
        handle: ordersHandle,
        children: [
          {
            index: true,
            element: (
              <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/orders"]}>
                <OrdersPage />
              </RoleGuard>
            ),
            handle: ordersHandle,
          },
          {
            path: "new",
            element: (
              <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/orders/new"]}>
                <NewOrderPage />
              </RoleGuard>
            ),
            handle: newOrderHandle,
          },
        ],
      },

      // Invoices
      {
        path: "invoices",
        element: (
          <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/invoices"]}>
            <InvoicesPage />
          </RoleGuard>
        ),
        handle: invoicesHandle,
      },

      // Dispatch
      {
        path: "dispatch",
        element: (
          <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/dispatch"]}>
            <DispatchPage />
          </RoleGuard>
        ),
        handle: dispatchHandle,
      },

      // Payments
      {
        path: "payments",
        element: (
          <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/payments"]}>
            <PaymentsPage />
          </RoleGuard>
        ),
        handle: paymentsHandle,
      },

      // Stock
      {
        path: "stock",
        element: (
          <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/stock"]}>
            <StockPage />
          </RoleGuard>
        ),
        handle: stockHandle,
      },

      // Purchases
      {
        path: "purchases",
        element: (
          <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/purchases"]}>
            <PurchasesPage />
          </RoleGuard>
        ),
        handle: purchasesHandle,
      },

      // Suppliers
      {
        path: "suppliers",
        element: (
          <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/suppliers"]}>
            <SuppliersPage />
          </RoleGuard>
        ),
        handle: suppliersHandle,
      },

      // Production
      {
        path: "production",
        children: [
          {
            path: "today",
            element: (
              <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/production/today"]}>
                <ProductionPage />
              </RoleGuard>
            ),
            handle: productionTodayHandle,
          },
          {
            path: "new",
            element: (
              <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/production/new"]}>
                <ProductionPage />
              </RoleGuard>
            ),
            handle: productionNewHandle,
          },
          {
            path: "history",
            element: (
              <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/production/history"]}>
                <ProductionPage />
              </RoleGuard>
            ),
            handle: productionHistoryHandle,
          },
        ],
      },

      // Customers
      {
        path: "customers",
        element: (
          <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/customers"]}>
            <CustomersPage />
          </RoleGuard>
        ),
        handle: customersHandle,
      },

      // Reports
      {
        path: "reports",
        children: [
          {
            path: "sales",
            element: (
              <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/reports/sales"]}>
                <ReportsSalesPage />
              </RoleGuard>
            ),
            handle: reportsSalesHandle,
          },
          {
            path: "stock",
            element: (
              <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/reports/stock"]}>
                <ReportsStockPage />
              </RoleGuard>
            ),
            handle: reportsStockHandle,
          },
          {
            path: "production",
            element: (
              <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/reports/production"]}>
                <ReportsProductionPage />
              </RoleGuard>
            ),
            handle: reportsProductionHandle,
          },
          {
            path: "receivables",
            element: (
              <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/reports/receivables"]}>
                <ReportsReceivablesPage />
              </RoleGuard>
            ),
            handle: reportsReceivablesHandle,
          },
          {
            path: "gst",
            element: (
              <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/reports/gst"]}>
                <ReportsGSTPage />
              </RoleGuard>
            ),
            handle: reportsGSTHandle,
          },
          {
            path: "audit",
            element: (
              <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/reports/audit"]}>
                <ReportsAuditPage />
              </RoleGuard>
            ),
            handle: reportsAuditHandle,
          },
        ],
      },

      // Exports
      {
        path: "exports",
        element: (
          <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/exports"]}>
            <ExportsPage />
          </RoleGuard>
        ),
        handle: exportsHandle,
      },

      // Settings
      {
        path: "settings",
        element: (
          <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/settings"]}>
            <SettingsPage />
          </RoleGuard>
        ),
        handle: settingsHandle,
      },

      // Component showcase
      {
        path: "showcase",
        element: (
          <RoleGuard allowedRoles={["ADMIN", "OWNER"]}>
            <ShowcasePage />
          </RoleGuard>
        ),
        handle: { breadcrumb: "Showcase" },
      },
    ],
  },

  // ── Root catch-all for unknown routes (prevents unauthenticated redirect hijacking) ──
  {
    path: "*",
    element: (
      <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
        <NotFoundPage />
      </Suspense>
    ),
  },
]);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 1,
    },
  },
});

import { LanguageProvider } from "@/lib/i18n";

function App() {
  return (
    <LanguageProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </LanguageProvider>
  );
}

export default App;
