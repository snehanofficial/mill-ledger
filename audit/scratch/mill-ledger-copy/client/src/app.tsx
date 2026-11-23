import { lazy, Suspense } from "react";
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthenticatedLayout } from "@/layouts/authenticated-layout";

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
  import("@/pages/placeholder-pages").then((m) => ({ default: m.NewOrderPage })),
);
const PurchasesPage = lazy(() =>
  import("@/pages/purchases-page").then((m) => ({ default: m.PurchasesPage })),
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
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: "dashboard",
        element: <DashboardPage />,
        handle: dashboardHandle,
      },

      // Orders
      {
        path: "orders",
        handle: ordersHandle,
        children: [
          { index: true, element: <OrdersPage />, handle: ordersHandle },
          { path: "new", element: <NewOrderPage />, handle: newOrderHandle },
        ],
      },

      // Invoices
      { path: "invoices", element: <InvoicesPage />, handle: invoicesHandle },

      // Dispatch
      { path: "dispatch", element: <DispatchPage />, handle: dispatchHandle },

      // Payments
      { path: "payments", element: <PaymentsPage />, handle: paymentsHandle },

      // Stock
      { path: "stock", element: <StockPage />, handle: stockHandle },

      // Purchases
      {
        path: "purchases",
        element: <PurchasesPage />,
        handle: purchasesHandle,
      },

      // Production
      {
        path: "production",
        children: [
          {
            path: "today",
            element: <ProductionPage />,
            handle: productionTodayHandle,
          },
          {
            path: "new",
            element: <ProductionPage />,
            handle: productionNewHandle,
          },
          {
            path: "history",
            element: <ProductionPage />,
            handle: productionHistoryHandle,
          },
        ],
      },

      // Customers
      {
        path: "customers",
        element: <CustomersPage />,
        handle: customersHandle,
      },

      // Reports
      {
        path: "reports",
        children: [
          {
            path: "sales",
            element: <ReportsSalesPage />,
            handle: reportsSalesHandle,
          },
          {
            path: "stock",
            element: <ReportsStockPage />,
            handle: reportsStockHandle,
          },
          {
            path: "production",
            element: <ReportsProductionPage />,
            handle: reportsProductionHandle,
          },
          {
            path: "receivables",
            element: <ReportsReceivablesPage />,
            handle: reportsReceivablesHandle,
          },
          {
            path: "gst",
            element: <ReportsGSTPage />,
            handle: reportsGSTHandle,
          },
          {
            path: "audit",
            element: <ReportsAuditPage />,
            handle: reportsAuditHandle,
          },
        ],
      },

      // Exports
      { path: "exports", element: <ExportsPage />, handle: exportsHandle },

      // Settings
      { path: "settings", element: <SettingsPage />, handle: settingsHandle },

      // Component showcase
      { path: "showcase", element: <ShowcasePage /> },

      // Catch-all within authenticated area
      { path: "*", element: <NotFoundPage /> },
    ],
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
