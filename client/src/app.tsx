import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { AuthenticatedLayout } from '@/layouts/authenticated-layout'
import {
  DashboardPage,
  OrdersPage,
  NewOrderPage,
  InvoicesPage,
  DispatchPage,
  PaymentsPage,
  StockPage,
  PurchasesPage,
  ProductionTodayPage,
  ProductionNewPage,
  ProductionHistoryPage,
  CustomersPage,
  ReportsSalesPage,
  ReportsStockPage,
  ReportsProductionPage,
  ReportsReceivablesPage,
  ReportsGSTPage,
  ReportsAuditPage,
  ExportsPage,
  SettingsPage,
  LoginPage,
  NotFoundPage,
} from '@/pages/placeholder-pages'
import ShowcasePage from '@/pages/showcase-page'
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
} from '@/routes/route-handles'

const router = createBrowserRouter([
  // ── Public routes (outside authenticated shell) ─────────────────
  {
    path: '/auth/login',
    element: <LoginPage />,
  },

  // ── Authenticated shell ─────────────────────────────────────────
  {
    path: '/',
    element: <AuthenticatedLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <DashboardPage />,
        handle: dashboardHandle,
      },

      // Orders
      {
        path: 'orders',
        handle: ordersHandle,
        children: [
          { index: true, element: <OrdersPage />, handle: ordersHandle },
          { path: 'new', element: <NewOrderPage />, handle: newOrderHandle },
        ],
      },

      // Invoices
      { path: 'invoices', element: <InvoicesPage />, handle: invoicesHandle },

      // Dispatch
      { path: 'dispatch', element: <DispatchPage />, handle: dispatchHandle },

      // Payments
      { path: 'payments', element: <PaymentsPage />, handle: paymentsHandle },

      // Stock
      { path: 'stock', element: <StockPage />, handle: stockHandle },

      // Purchases
      { path: 'purchases', element: <PurchasesPage />, handle: purchasesHandle },

      // Production
      {
        path: 'production',
        children: [
          { path: 'today', element: <ProductionTodayPage />, handle: productionTodayHandle },
          { path: 'new', element: <ProductionNewPage />, handle: productionNewHandle },
          { path: 'history', element: <ProductionHistoryPage />, handle: productionHistoryHandle },
        ],
      },

      // Customers
      { path: 'customers', element: <CustomersPage />, handle: customersHandle },

      // Reports
      {
        path: 'reports',
        children: [
          { path: 'sales', element: <ReportsSalesPage />, handle: reportsSalesHandle },
          { path: 'stock', element: <ReportsStockPage />, handle: reportsStockHandle },
          { path: 'production', element: <ReportsProductionPage />, handle: reportsProductionHandle },
          { path: 'receivables', element: <ReportsReceivablesPage />, handle: reportsReceivablesHandle },
          { path: 'gst', element: <ReportsGSTPage />, handle: reportsGSTHandle },
          { path: 'audit', element: <ReportsAuditPage />, handle: reportsAuditHandle },
        ],
      },

      // Exports
      { path: 'exports', element: <ExportsPage />, handle: exportsHandle },

      // Settings
      { path: 'settings', element: <SettingsPage />, handle: settingsHandle },

      // Component showcase
      { path: 'showcase', element: <ShowcasePage /> },

      // Catch-all within authenticated area
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App
