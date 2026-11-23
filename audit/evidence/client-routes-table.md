# Client React Routes and Layout Inventory

Total Client Routes: 24
Placeholder Routes: 4 (/orders/new, /exports, /settings, /*)

| Path | Layout | Component | Source File | Lazy? | Lazy Boundary | Handle ID | Status |
|------|--------|-----------|-------------|-------|---------------|-----------|--------|
| `/auth/login` | `None (Standalone public page)` | `LoginPage` | `client/src/pages/login-page.tsx` | Yes | `<Suspense fallback={<Spinner />}> in app.tsx` | `None` | REAL IMPLEMENTATION |
| `/` | `AuthenticatedLayout` | `Navigate to=/dashboard` | `client/src/app.tsx` | No | `None (Sync Redirect)` | `None` | REAL IMPLEMENTATION |
| `/dashboard` | `AuthenticatedLayout` | `DashboardPage` | `client/src/pages/dashboard-page.tsx` | Yes | `<Suspense fallback={<RouteLoadingFallback />}> in AuthenticatedLayout` | `dashboard` | REAL IMPLEMENTATION |
| `/orders` | `AuthenticatedLayout` | `OrdersPage` | `client/src/pages/orders-page.tsx` | Yes | `<Suspense fallback={<RouteLoadingFallback />}> in AuthenticatedLayout` | `orders` | REAL IMPLEMENTATION |
| `/orders/new` | `AuthenticatedLayout` | `NewOrderPage` | `client/src/pages/placeholder-pages.tsx` | Yes | `<Suspense fallback={<RouteLoadingFallback />}> in AuthenticatedLayout` | `new-order` | ⚠️ PLACEHOLDER |
| `/invoices` | `AuthenticatedLayout` | `InvoicesPage` | `client/src/pages/invoices-page.tsx` | Yes | `<Suspense fallback={<RouteLoadingFallback />}> in AuthenticatedLayout` | `invoices` | REAL IMPLEMENTATION |
| `/dispatch` | `AuthenticatedLayout` | `DispatchPage` | `client/src/pages/dispatch-page.tsx` | Yes | `<Suspense fallback={<RouteLoadingFallback />}> in AuthenticatedLayout` | `dispatch` | REAL IMPLEMENTATION |
| `/payments` | `AuthenticatedLayout` | `PaymentsPage` | `client/src/pages/payments-page.tsx` | Yes | `<Suspense fallback={<RouteLoadingFallback />}> in AuthenticatedLayout` | `payments` | REAL IMPLEMENTATION |
| `/stock` | `AuthenticatedLayout` | `StockPage` | `client/src/pages/stock-page.tsx` | Yes | `<Suspense fallback={<RouteLoadingFallback />}> in AuthenticatedLayout` | `stock` | REAL IMPLEMENTATION |
| `/purchases` | `AuthenticatedLayout` | `PurchasesPage` | `client/src/pages/purchases-page.tsx` | Yes | `<Suspense fallback={<RouteLoadingFallback />}> in AuthenticatedLayout` | `purchases` | REAL IMPLEMENTATION |
| `/production/today` | `AuthenticatedLayout` | `ProductionPage (mode=today)` | `client/src/pages/production-page.tsx` | Yes | `<Suspense fallback={<RouteLoadingFallback />}> in AuthenticatedLayout` | `production-today` | REAL IMPLEMENTATION |
| `/production/new` | `AuthenticatedLayout` | `ProductionPage (mode=new)` | `client/src/pages/production-page.tsx` | Yes | `<Suspense fallback={<RouteLoadingFallback />}> in AuthenticatedLayout` | `production-new` | REAL IMPLEMENTATION |
| `/production/history` | `AuthenticatedLayout` | `ProductionPage (mode=history)` | `client/src/pages/production-page.tsx` | Yes | `<Suspense fallback={<RouteLoadingFallback />}> in AuthenticatedLayout` | `production-history` | REAL IMPLEMENTATION |
| `/customers` | `AuthenticatedLayout` | `CustomersPage` | `client/src/pages/customers-page.tsx` | Yes | `<Suspense fallback={<RouteLoadingFallback />}> in AuthenticatedLayout` | `customers` | REAL IMPLEMENTATION |
| `/reports/sales` | `AuthenticatedLayout` | `ReportsSalesPage` | `client/src/pages/reports-page.tsx` | Yes | `<Suspense fallback={<RouteLoadingFallback />}> in AuthenticatedLayout` | `reports-sales` | REAL IMPLEMENTATION |
| `/reports/stock` | `AuthenticatedLayout` | `ReportsStockPage` | `client/src/pages/reports-page.tsx` | Yes | `<Suspense fallback={<RouteLoadingFallback />}> in AuthenticatedLayout` | `reports-stock` | REAL IMPLEMENTATION |
| `/reports/production` | `AuthenticatedLayout` | `ReportsProductionPage` | `client/src/pages/reports-page.tsx` | Yes | `<Suspense fallback={<RouteLoadingFallback />}> in AuthenticatedLayout` | `reports-production` | REAL IMPLEMENTATION |
| `/reports/receivables` | `AuthenticatedLayout` | `ReportsReceivablesPage` | `client/src/pages/reports-page.tsx` | Yes | `<Suspense fallback={<RouteLoadingFallback />}> in AuthenticatedLayout` | `reports-receivables` | REAL IMPLEMENTATION |
| `/reports/gst` | `AuthenticatedLayout` | `ReportsGSTPage` | `client/src/pages/reports-page.tsx` | Yes | `<Suspense fallback={<RouteLoadingFallback />}> in AuthenticatedLayout` | `reports-gst` | REAL IMPLEMENTATION |
| `/reports/audit` | `AuthenticatedLayout` | `ReportsAuditPage` | `client/src/pages/reports-page.tsx` | Yes | `<Suspense fallback={<RouteLoadingFallback />}> in AuthenticatedLayout` | `reports-audit` | REAL IMPLEMENTATION |
| `/exports` | `AuthenticatedLayout` | `ExportsPage` | `client/src/pages/placeholder-pages.tsx` | Yes | `<Suspense fallback={<RouteLoadingFallback />}> in AuthenticatedLayout` | `exports` | ⚠️ PLACEHOLDER |
| `/settings` | `AuthenticatedLayout` | `SettingsPage` | `client/src/pages/placeholder-pages.tsx` | Yes | `<Suspense fallback={<RouteLoadingFallback />}> in AuthenticatedLayout` | `settings` | ⚠️ PLACEHOLDER |
| `/showcase` | `AuthenticatedLayout` | `ShowcasePage` | `client/src/pages/showcase-page.tsx` | Yes | `<Suspense fallback={<RouteLoadingFallback />}> in AuthenticatedLayout` | `None` | REAL IMPLEMENTATION |
| `/*` | `AuthenticatedLayout` | `NotFoundPage` | `client/src/pages/placeholder-pages.tsx` | Yes | `<Suspense fallback={<RouteLoadingFallback />}> in AuthenticatedLayout` | `None` | ⚠️ PLACEHOLDER |
