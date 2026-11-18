/**
 * Placeholder pages for shell route demonstration.
 * These will be replaced with real portal screens in subsequent milestones.
 */

interface PlaceholderPageProps {
  title: string
  description: string
}

function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="flex flex-1 flex-col p-6 sm:p-8">
      <div className="mb-6">
        <h1 className="text-page-title font-semibold text-foreground leading-tight tracking-tight">
          {title}
        </h1>
        <p className="mt-1 text-body text-muted">{description}</p>
      </div>

      {/* Placeholder content area */}
      <div className="flex-1 rounded-panel border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-body font-medium text-foreground">Operational workspace</p>
          <p className="mt-1 text-caption text-muted">
            {title} portal screens and ledger tables will be mounted here.
          </p>
        </div>
      </div>
    </div>
  )
}

export function DashboardPage() {
  return (
    <PlaceholderPage
      title="Overview"
      description="Submitted orders, stock exceptions, variance alerts and recent operational events."
    />
  )
}

export function OrdersPage() {
  return <PlaceholderPage title="Orders" description="Sales orders, customer bookings, and dispatch readiness." />
}

export function NewOrderPage() {
  return <PlaceholderPage title="New order" description="Enter customer order details, credit terms, and pricing." />
}

export function InvoicesPage() {
  return <PlaceholderPage title="Invoices" description="Posted sales invoices, GST records, and PDF dispatch notes." />
}

export function DispatchPage() {
  return <PlaceholderPage title="Dispatch" description="Vehicle gate passes, delivery confirmations, and waybills." />
}

export function PaymentsPage() {
  return <PlaceholderPage title="Payments" description="Collection receipts, customer payment reconciliation, and ledger entries." />
}

export function StockPage() {
  return <PlaceholderPage title="Stock" description="Raw paddy, processed rice, bran, and husk inventory balances." />
}

export function PurchasesPage() {
  return <PlaceholderPage title="Purchases" description="Paddy procurement, mandi intake weighment, and supplier bills." />
}

export function ProductionTodayPage() {
  return <PlaceholderPage title="Today's production" description="Live shift yield, active milling batches, and byproduct output." />
}

export function ProductionNewPage() {
  return <PlaceholderPage title="New production batch" description="Start a new milling batch, specify paddy input, and track recovery." />
}

export function ProductionHistoryPage() {
  return <PlaceholderPage title="Production history" description="Historical batch records, milling yields, and outturn percentages." />
}

export function CustomersPage() {
  return <PlaceholderPage title="Customers" description="Customer directory, approved credit limits, and outstanding ledger balances." />
}

export function ReportsSalesPage() {
  return <PlaceholderPage title="Sales report" description="Periodic sales turnover, customer-wise breakdown, and item volume." />
}

export function ReportsStockPage() {
  return <PlaceholderPage title="Stock report" description="Opening, receipts, issues, and closing balances with weighted average cost." />
}

export function ReportsProductionPage() {
  return <PlaceholderPage title="Production report" description="Yield analysis, outturn ratios, and byproduct production summaries." />
}

export function ReportsReceivablesPage() {
  return <PlaceholderPage title="Receivables report" description="Aging analysis (0-30, 31-60, 61-90, 90+ days) and payment performance." />
}

export function ReportsGSTPage() {
  return <PlaceholderPage title="GST report" description="GSTR-1 outward supplies, tax breakdown, and HSN-wise summaries." />
}

export function ReportsAuditPage() {
  return <PlaceholderPage title="Audit log" description="System security events, user activity trace, and operational change history." />
}

export function ExportsPage() {
  return <PlaceholderPage title="Exports" description="Tally XML, Excel, and CSV data export packages." />
}

export function SettingsPage() {
  return <PlaceholderPage title="Settings" description="Milling unit preferences, notification settings, and system configuration." />
}

export function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-panel border border-border bg-surface p-6 shadow-modal">
        <h1 className="text-section-title font-semibold text-foreground">Sign in to MillLedger</h1>
        <p className="mt-1 text-body text-muted">Milling operations & ledger platform</p>
        <div className="mt-6 flex flex-col gap-3">
          <input
            type="email"
            placeholder="name@mill.local"
            defaultValue="admin@mill.local"
            className="h-10 rounded-control border border-input bg-surface px-3 text-body text-foreground"
          />
          <button
            type="button"
            className="flex h-10 items-center justify-center rounded-control bg-primary px-4 text-body font-medium text-primary-foreground hover:bg-primary-hover"
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="text-center">
        <h1 className="text-page-title font-semibold text-foreground">404</h1>
        <p className="mt-2 text-body text-muted">Page not found</p>
        <a href="/dashboard" className="mt-4 inline-block text-body font-medium text-primary hover:underline">
          Return to dashboard
        </a>
      </div>
    </div>
  )
}
