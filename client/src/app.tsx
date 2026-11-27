import { lazy, Suspense } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RoleGuard } from "@/components/auth/role-guard";
import { RouteErrorFallback } from "@/components/ui/route-error-fallback";
import { ROUTE_PERMISSIONS, getDefaultRouteForRole } from "@/lib/role-routing";
import { useCurrentUser } from "@/hooks/use-current-user";

const AuthenticatedLayout = lazy(() =>
  import("@/layouts/authenticated-layout").then((m) => ({
    default: m.AuthenticatedLayout,
  })),
);

// Lazy-loaded routes for code splitting (MLD-014)
const LandingPage = lazy(() =>
  import("@/pages/public/landing-page").then((m) => ({
    default: m.LandingPage,
  })),
);
const FeaturesPage = lazy(() =>
  import("@/pages/public/features-page").then((m) => ({
    default: m.FeaturesPage,
  })),
);
const WorkflowsPage = lazy(() =>
  import("@/pages/public/workflows-page").then((m) => ({
    default: m.WorkflowsPage,
  })),
);
const SpreadsheetAlternativePage = lazy(() =>
  import("@/pages/public/spreadsheet-alternative-page").then((m) => ({
    default: m.SpreadsheetAlternativePage,
  })),
);
const ResourcesPage = lazy(() =>
  import("@/pages/public/resources-page").then((m) => ({
    default: m.ResourcesPage,
  })),
);
const ResourceArticlePage = lazy(() =>
  import("@/pages/public/resource-article-page").then((m) => ({
    default: m.ResourceArticlePage,
  })),
);
const SecurityPage = lazy(() =>
  import("@/pages/public/security-page").then((m) => ({
    default: m.SecurityPage,
  })),
);
const AboutPage = lazy(() =>
  import("@/pages/public/about-page").then((m) => ({
    default: m.AboutPage,
  })),
);
const ContactPage = lazy(() =>
  import("@/pages/public/contact-page").then((m) => ({
    default: m.ContactPage,
  })),
);
const DemoPage = lazy(() =>
  import("@/pages/public/contact-page").then((m) => ({
    default: m.DemoPage,
  })),
);
const LoginPage = lazy(() =>
  import("@/pages/auth/login-page").then((m) => ({ default: m.LoginPage })),
);
const DashboardPage = lazy(() =>
  import("@/pages/dashboard/dashboard-page").then((m) => ({
    default: m.DashboardPage,
  })),
);
const StockPage = lazy(() =>
  import("@/pages/stock/stock-page").then((m) => ({ default: m.StockPage })),
);
const ProductionTodayPage = lazy(() =>
  import("@/pages/production/production-today-page").then((m) => ({
    default: m.ProductionTodayPage,
  })),
);
const ProductionHistoryPage = lazy(() =>
  import("@/pages/production/production-history-page").then((m) => ({
    default: m.ProductionHistoryPage,
  })),
);
const ProductionRecipesPage = lazy(() =>
  import("@/pages/production/production-recipes-page").then((m) => ({
    default: m.ProductionRecipesPage,
  })),
);
const OrdersPage = lazy(() =>
  import("@/pages/orders/orders-page").then((m) => ({ default: m.OrdersPage })),
);
const OrderDetailPage = lazy(() =>
  import("@/pages/orders/order-detail-page").then((m) => ({
    default: m.OrderDetailPage,
  })),
);
const InvoicesPage = lazy(() =>
  import("@/pages/invoices/invoices-page").then((m) => ({
    default: m.InvoicesPage,
  })),
);
const NewInvoicePage = lazy(() =>
  import("@/pages/invoices/new-invoice-page").then((m) => ({
    default: m.NewInvoicePage,
  })),
);
const InvoiceDetailPage = lazy(() =>
  import("@/pages/invoices/invoice-detail-page").then((m) => ({
    default: m.InvoiceDetailPage,
  })),
);
const DispatchPage = lazy(() =>
  import("@/pages/dispatch/dispatch-page").then((m) => ({
    default: m.DispatchPage,
  })),
);
const NewDispatchPage = lazy(() =>
  import("@/pages/dispatch/new-dispatch-page").then((m) => ({
    default: m.NewDispatchPage,
  })),
);
const DispatchDetailPage = lazy(() =>
  import("@/pages/dispatch/dispatch-detail-page").then((m) => ({
    default: m.DispatchDetailPage,
  })),
);
const PaymentsPage = lazy(() =>
  import("@/pages/payments/payments-page").then((m) => ({
    default: m.PaymentsPage,
  })),
);
const NewPaymentPage = lazy(() =>
  import("@/pages/payments/new-payment-page").then((m) => ({
    default: m.NewPaymentPage,
  })),
);
const PaymentDetailPage = lazy(() =>
  import("@/pages/payments/payment-detail-page").then((m) => ({
    default: m.PaymentDetailPage,
  })),
);
const ReceivablesPage = lazy(() =>
  import("@/pages/receivables/receivables-page").then((m) => ({
    default: m.ReceivablesPage,
  })),
);
const CustomerLedgerPage = lazy(() =>
  import("@/pages/receivables/customer-ledger-page").then((m) => ({
    default: m.CustomerLedgerPage,
  })),
);
const StockLedgerPage = lazy(() =>
  import("@/pages/stock/stock-ledger-page").then((m) => ({
    default: m.StockLedgerPage,
  })),
);
const NewPurchasePage = lazy(() =>
  import("@/pages/purchases/new-purchase-page").then((m) => ({
    default: m.NewPurchasePage,
  })),
);
const PurchaseDetailPage = lazy(() =>
  import("@/pages/purchases/purchase-detail-page").then((m) => ({
    default: m.PurchaseDetailPage,
  })),
);
const ProductionRunDetailPage = lazy(() =>
  import("@/pages/production/production-run-detail-page").then((m) => ({
    default: m.ProductionRunDetailPage,
  })),
);
const ReportsHomePage = lazy(() =>
  import("@/pages/reports/reports-home-page").then((m) => ({
    default: m.ReportsHomePage,
  })),
);
const ReportsSalesPage = lazy(() =>
  import("@/pages/reports/reports-page").then((m) => ({
    default: m.ReportsSalesPage,
  })),
);
const ReportsStockPage = lazy(() =>
  import("@/pages/reports/reports-page").then((m) => ({
    default: m.ReportsStockPage,
  })),
);
const ReportsProductionPage = lazy(() =>
  import("@/pages/reports/reports-page").then((m) => ({
    default: m.ReportsProductionPage,
  })),
);
const ReportsReceivablesPage = lazy(() =>
  import("@/pages/reports/reports-page").then((m) => ({
    default: m.ReportsReceivablesPage,
  })),
);
const ReportsGSTPage = lazy(() =>
  import("@/pages/reports/reports-page").then((m) => ({
    default: m.ReportsGSTPage,
  })),
);
const ReportsAuditPage = lazy(() =>
  import("@/pages/reports/reports-page").then((m) => ({
    default: m.ReportsAuditPage,
  })),
);
const NewOrderPage = lazy(() =>
  import("@/pages/orders/new-order-page").then((m) => ({
    default: m.NewOrderPage,
  })),
);
const PurchasesPage = lazy(() =>
  import("@/pages/purchases/purchases-page").then((m) => ({
    default: m.PurchasesPage,
  })),
);
const SuppliersPage = lazy(() =>
  import("@/pages/suppliers/suppliers-page").then((m) => ({
    default: m.SuppliersPage,
  })),
);
const CustomersPage = lazy(() =>
  import("@/pages/customers/customers-page").then((m) => ({
    default: m.CustomersPage,
  })),
);
const CustomerDetailPage = lazy(() =>
  import("@/pages/customers/customer-detail-page").then((m) => ({
    default: m.CustomerDetailPage,
  })),
);
const ProductsPage = lazy(() =>
  import("@/pages/products/products-page").then((m) => ({
    default: m.ProductsPage,
  })),
);
const ProductDetailPage = lazy(() =>
  import("@/pages/products/product-detail-page").then((m) => ({
    default: m.ProductDetailPage,
  })),
);
const RecipeDetailPage = lazy(() =>
  import("@/pages/production/recipe-detail-page").then((m) => ({
    default: m.RecipeDetailPage,
  })),
);
const ExportsPage = lazy(() =>
  import("@/pages/exports/exports-page").then((m) => ({
    default: m.ExportsPage,
  })),
);
const SettingsPage = lazy(() =>
  import("@/pages/settings/settings-page").then((m) => ({
    default: m.SettingsPage,
  })),
);
const NotFoundPage = lazy(() =>
  import("@/pages/errors/not-found-page").then((m) => ({
    default: m.NotFoundPage,
  })),
);
const ShowcasePage = lazy(() => import("@/pages/dev/showcase-page"));
import {
  dashboardHandle,
  ordersHandle,
  orderDetailHandle,
  newOrderHandle,
  invoicesHandle,
  newInvoiceHandle,
  invoiceDetailHandle,
  dispatchHandle,
  newDispatchHandle,
  dispatchDetailHandle,
  paymentsHandle,
  newPaymentHandle,
  paymentDetailHandle,
  receivablesHandle,
  customerLedgerHandle,
  stockHandle,
  stockLedgerHandle,
  purchasesHandle,
  newPurchaseHandle,
  purchaseDetailHandle,
  productionTodayHandle,
  productionNewHandle,
  productionHistoryHandle,
  productionRunDetailHandle,
  productionRecipesHandle,
  productionRecipeDetailHandle,
  customersHandle,
  customerDetailHandle,
  productsHandle,
  productDetailHandle,
  reportsHomeHandle,
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

function PageFallback() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background">
      <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

/**
 * RootEntry: Dual-purpose root entry point (F-092 / OD-02).
 * - For unauthenticated visitors: renders the public B2B marketing & milling landing surface.
 * - For authenticated staff: redirects seamlessly to their dedicated role workspace.
 */
function RootEntry() {
  const { user, isLoading } = useCurrentUser();

  if (isLoading) {
    return <PageFallback />;
  }

  if (user) {
    import("@/layouts/authenticated-layout");
    return <Navigate to={getDefaultRouteForRole(user.role)} replace />;
  }

  return <LandingPage />;
}

const router = createBrowserRouter([
  // ── Public routes (outside authenticated shell) ─────────────────
  {
    path: "/",
    errorElement: <RouteErrorFallback homePath="/" />,
    element: (
      <Suspense fallback={<PageFallback />}>
        <RootEntry />
      </Suspense>
    ),
  },
  {
    path: "/features",
    errorElement: <RouteErrorFallback homePath="/" />,
    element: (
      <Suspense fallback={<PageFallback />}>
        <FeaturesPage />
      </Suspense>
    ),
  },
  {
    path: "/workflows",
    errorElement: <RouteErrorFallback homePath="/" />,
    element: (
      <Suspense fallback={<PageFallback />}>
        <WorkflowsPage />
      </Suspense>
    ),
  },
  {
    path: "/spreadsheet-alternative",
    errorElement: <RouteErrorFallback homePath="/" />,
    element: (
      <Suspense fallback={<PageFallback />}>
        <SpreadsheetAlternativePage />
      </Suspense>
    ),
  },
  {
    path: "/resources",
    errorElement: <RouteErrorFallback homePath="/" />,
    element: (
      <Suspense fallback={<PageFallback />}>
        <ResourcesPage />
      </Suspense>
    ),
  },
  {
    path: "/resources/indian-gst-invoicing-for-food-mills",
    errorElement: <RouteErrorFallback homePath="/" />,
    element: (
      <Suspense fallback={<PageFallback />}>
        <ResourceArticlePage articleId="gst-invoicing" />
      </Suspense>
    ),
  },
  {
    path: "/resources/moving-weighted-average-stock-ledger",
    errorElement: <RouteErrorFallback homePath="/" />,
    element: (
      <Suspense fallback={<PageFallback />}>
        <ResourceArticlePage articleId="stock-ledger" />
      </Suspense>
    ),
  },
  {
    path: "/resources/offline-salesman-order-capture",
    errorElement: <RouteErrorFallback homePath="/" />,
    element: (
      <Suspense fallback={<PageFallback />}>
        <ResourceArticlePage articleId="offline-orders" />
      </Suspense>
    ),
  },
  {
    path: "/security",
    errorElement: <RouteErrorFallback homePath="/" />,
    element: (
      <Suspense fallback={<PageFallback />}>
        <SecurityPage />
      </Suspense>
    ),
  },
  {
    path: "/about",
    errorElement: <RouteErrorFallback homePath="/" />,
    element: (
      <Suspense fallback={<PageFallback />}>
        <AboutPage />
      </Suspense>
    ),
  },
  {
    path: "/demo",
    errorElement: <RouteErrorFallback homePath="/" />,
    element: (
      <Suspense fallback={<PageFallback />}>
        <DemoPage />
      </Suspense>
    ),
  },
  {
    path: "/contact",
    errorElement: <RouteErrorFallback homePath="/" />,
    element: (
      <Suspense fallback={<PageFallback />}>
        <ContactPage />
      </Suspense>
    ),
  },
  {
    path: "/catalog",
    element: <Navigate to="/features" replace />,
  },
  {
    path: "/auth/login",
    errorElement: <RouteErrorFallback homePath="/" />,
    element: (
      <Suspense fallback={<PageFallback />}>
        <LoginPage />
      </Suspense>
    ),
  },

  // ── Authenticated shell ─────────────────────────────────────────
  {
    errorElement: <RouteErrorFallback />,
    element: (
      <Suspense fallback={<PageFallback />}>
        <AuthenticatedLayout />
      </Suspense>
    ),
    children: [
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
          {
            path: ":orderId",
            element: (
              <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/orders/:orderId"]}>
                <OrderDetailPage />
              </RoleGuard>
            ),
            handle: orderDetailHandle,
          },
        ],
      },

      // Invoices
      {
        path: "invoices",
        handle: invoicesHandle,
        children: [
          {
            index: true,
            element: (
              <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/invoices"]}>
                <InvoicesPage />
              </RoleGuard>
            ),
            handle: invoicesHandle,
          },
          {
            path: "new",
            element: (
              <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/invoices/new"]}>
                <NewInvoicePage />
              </RoleGuard>
            ),
            handle: newInvoiceHandle,
          },
          {
            path: ":invoiceId",
            element: (
              <RoleGuard
                allowedRoles={ROUTE_PERMISSIONS["/invoices/:invoiceId"]}
              >
                <InvoiceDetailPage />
              </RoleGuard>
            ),
            handle: invoiceDetailHandle,
          },
        ],
      },

      // Dispatch
      {
        path: "dispatch",
        handle: dispatchHandle,
        children: [
          {
            index: true,
            element: (
              <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/dispatch"]}>
                <DispatchPage />
              </RoleGuard>
            ),
            handle: dispatchHandle,
          },
          {
            path: "new",
            element: (
              <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/dispatch/new"]}>
                <NewDispatchPage />
              </RoleGuard>
            ),
            handle: newDispatchHandle,
          },
          {
            path: ":dispatchId",
            element: (
              <RoleGuard
                allowedRoles={ROUTE_PERMISSIONS["/dispatch/:dispatchId"]}
              >
                <DispatchDetailPage />
              </RoleGuard>
            ),
            handle: dispatchDetailHandle,
          },
        ],
      },

      // Payments
      {
        path: "payments",
        handle: paymentsHandle,
        children: [
          {
            index: true,
            element: (
              <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/payments"]}>
                <PaymentsPage />
              </RoleGuard>
            ),
            handle: paymentsHandle,
          },
          {
            path: "new",
            element: (
              <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/payments/new"]}>
                <NewPaymentPage />
              </RoleGuard>
            ),
            handle: newPaymentHandle,
          },
          {
            path: ":paymentId",
            element: (
              <RoleGuard
                allowedRoles={ROUTE_PERMISSIONS["/payments/:paymentId"]}
              >
                <PaymentDetailPage />
              </RoleGuard>
            ),
            handle: paymentDetailHandle,
          },
        ],
      },

      // Receivables & Customer Ledgers
      {
        path: "receivables",
        handle: receivablesHandle,
        children: [
          {
            index: true,
            element: (
              <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/receivables"]}>
                <ReceivablesPage />
              </RoleGuard>
            ),
            handle: receivablesHandle,
          },
          {
            path: ":customerId",
            element: (
              <RoleGuard
                allowedRoles={ROUTE_PERMISSIONS["/receivables/:customerId"]}
              >
                <CustomerLedgerPage />
              </RoleGuard>
            ),
            handle: customerLedgerHandle,
          },
        ],
      },

      // Stock
      {
        path: "stock",
        handle: stockHandle,
        children: [
          {
            index: true,
            element: (
              <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/stock"]}>
                <StockPage />
              </RoleGuard>
            ),
            handle: stockHandle,
          },
          {
            path: ":itemId/ledger",
            element: (
              <RoleGuard
                allowedRoles={ROUTE_PERMISSIONS["/stock/:itemId/ledger"]}
              >
                <StockLedgerPage />
              </RoleGuard>
            ),
            handle: stockLedgerHandle,
          },
        ],
      },

      // Purchases
      {
        path: "purchases",
        handle: purchasesHandle,
        children: [
          {
            index: true,
            element: (
              <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/purchases"]}>
                <PurchasesPage />
              </RoleGuard>
            ),
            handle: purchasesHandle,
          },
          {
            path: "new",
            element: (
              <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/purchases/new"]}>
                <NewPurchasePage />
              </RoleGuard>
            ),
            handle: newPurchaseHandle,
          },
          {
            path: ":receiptId",
            element: (
              <RoleGuard
                allowedRoles={ROUTE_PERMISSIONS["/purchases/:receiptId"]}
              >
                <PurchaseDetailPage />
              </RoleGuard>
            ),
            handle: purchaseDetailHandle,
          },
        ],
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
                <ProductionTodayPage />
              </RoleGuard>
            ),
            handle: productionTodayHandle,
          },
          {
            path: "new",
            element: (
              <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/production/new"]}>
                <ProductionTodayPage initialOpenNewBatch />
              </RoleGuard>
            ),
            handle: productionNewHandle,
          },
          {
            path: "history",
            element: (
              <RoleGuard
                allowedRoles={ROUTE_PERMISSIONS["/production/history"]}
              >
                <ProductionHistoryPage />
              </RoleGuard>
            ),
            handle: productionHistoryHandle,
          },
          {
            path: "runs/:runId",
            element: (
              <RoleGuard
                allowedRoles={ROUTE_PERMISSIONS["/production/runs/:runId"]}
              >
                <ProductionRunDetailPage />
              </RoleGuard>
            ),
            handle: productionRunDetailHandle,
          },
          {
            path: "recipes",
            element: (
              <RoleGuard
                allowedRoles={ROUTE_PERMISSIONS["/production/recipes"]}
              >
                <ProductionRecipesPage />
              </RoleGuard>
            ),
            handle: productionRecipesHandle,
          },
          {
            path: "recipes/:recipeId",
            element: (
              <RoleGuard
                allowedRoles={
                  ROUTE_PERMISSIONS["/production/recipes/:recipeId"]
                }
              >
                <RecipeDetailPage />
              </RoleGuard>
            ),
            handle: productionRecipeDetailHandle,
          },
        ],
      },

      // Customers
      {
        path: "customers",
        handle: customersHandle,
        children: [
          {
            index: true,
            element: (
              <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/customers"]}>
                <CustomersPage />
              </RoleGuard>
            ),
            handle: customersHandle,
          },
          {
            path: ":customerId",
            element: (
              <RoleGuard
                allowedRoles={ROUTE_PERMISSIONS["/customers/:customerId"]}
              >
                <CustomerDetailPage />
              </RoleGuard>
            ),
            handle: customerDetailHandle,
          },
        ],
      },

      // Products & Price Lists
      {
        path: "products",
        handle: productsHandle,
        children: [
          {
            index: true,
            element: (
              <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/products"]}>
                <ProductsPage />
              </RoleGuard>
            ),
            handle: productsHandle,
          },
          {
            path: ":productId",
            element: (
              <RoleGuard
                allowedRoles={ROUTE_PERMISSIONS["/products/:productId"]}
              >
                <ProductDetailPage />
              </RoleGuard>
            ),
            handle: productDetailHandle,
          },
        ],
      },

      // Reports
      {
        path: "reports",
        handle: reportsHomeHandle,
        children: [
          {
            index: true,
            element: (
              <RoleGuard allowedRoles={ROUTE_PERMISSIONS["/reports"]}>
                <ReportsHomePage />
              </RoleGuard>
            ),
            handle: reportsHomeHandle,
          },
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
              <RoleGuard
                allowedRoles={ROUTE_PERMISSIONS["/reports/production"]}
              >
                <ReportsProductionPage />
              </RoleGuard>
            ),
            handle: reportsProductionHandle,
          },
          {
            path: "receivables",
            element: (
              <RoleGuard
                allowedRoles={ROUTE_PERMISSIONS["/reports/receivables"]}
              >
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
    errorElement: <RouteErrorFallback homePath="/" />,
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
import { ErrorBoundary } from "@/components/ui/error-boundary";

function AppWithUserLanguage() {
  const { user } = useCurrentUser();
  return (
    <LanguageProvider
      userId={user?.id}
      preferredLanguage={user?.preferredLanguage}
    >
      <RouterProvider router={router} />
    </LanguageProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppWithUserLanguage />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
