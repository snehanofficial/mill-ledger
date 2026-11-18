/**
 * Placeholder pages for shell route demonstration.
 * Adapted directly from DashboardBlocks PagePlaceholder pattern.
 * These will be replaced with real portal screens in subsequent milestones.
 */

import { Badge } from "@/components/ui/badge";

interface PlaceholderPageProps {
  title: string;
  description: string;
}

const PLACEHOLDER_STATS = [
  {
    label: "Total Active Orders",
    val: "1,429",
    change: "+12% vs last mo",
    variant: "success" as const,
  },
  {
    label: "Weekly Milling Yield",
    val: "68.4%",
    change: "Target: 68.0%",
    variant: "outline" as const,
  },
  {
    label: "Pending Audit Review",
    val: "12",
    change: "Action needed",
    variant: "warning" as const,
  },
  {
    label: "Active Milling Batches",
    val: "4",
    change: "Shift in progress",
    variant: "info" as const,
  },
];

const PLACEHOLDER_BARS = [
  34, 41, 38, 47, 44, 52, 49, 58, 55, 61, 57, 66, 63, 70, 67, 74, 71, 79, 76,
  83, 80, 88, 85, 92,
];

function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 md:p-8">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {/* Metric Cards Skeleton Wireframe */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLACEHOLDER_STATS.map((stat, index) => (
          <div
            key={index}
            className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-card p-5 shadow-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {stat.label}
              </span>
              <Badge
                variant={stat.variant}
                className="shrink-0 text-[11px] font-medium"
              >
                {stat.change}
              </Badge>
            </div>
            <div className="flex items-baseline">
              <span className="text-2xl font-bold tracking-tight text-foreground">
                {stat.val}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Wireframe Card */}
      <div className="flex flex-1 flex-col rounded-xl border border-border bg-card p-6 shadow-xs min-h-[320px]">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Activity & Ledger Stream
            </h2>
            <p className="text-xs text-muted-foreground">
              Real-time operational stream and transaction log
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            Last updated just now
          </span>
        </div>

        <div className="flex flex-1 items-end gap-1.5 pt-8 pb-4 sm:gap-2">
          {PLACEHOLDER_BARS.map((height, index) => (
            <div
              key={index}
              className="bg-muted hover:bg-primary/20 transition-colors flex-1 rounded-t-sm"
              style={{ height: `${height}%` }}
              title={`Period ${index + 1}: ${height}%`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  return (
    <PlaceholderPage
      title="Overview"
      description="Submitted orders, stock exceptions, variance alerts and recent operational events."
    />
  );
}

export function OrdersPage() {
  return (
    <PlaceholderPage
      title="Orders"
      description="Sales orders, customer bookings, and dispatch readiness."
    />
  );
}

export function NewOrderPage() {
  return (
    <PlaceholderPage
      title="New order"
      description="Enter customer order details, credit terms, and pricing."
    />
  );
}

export function InvoicesPage() {
  return (
    <PlaceholderPage
      title="Invoices"
      description="Posted sales invoices, GST records, and PDF dispatch notes."
    />
  );
}

export function DispatchPage() {
  return (
    <PlaceholderPage
      title="Dispatch"
      description="Vehicle gate passes, delivery confirmations, and waybills."
    />
  );
}

export function PaymentsPage() {
  return (
    <PlaceholderPage
      title="Payments"
      description="Collection receipts, customer payment reconciliation, and ledger entries."
    />
  );
}

export function StockPage() {
  return (
    <PlaceholderPage
      title="Stock"
      description="Raw paddy, processed rice, bran, and husk inventory balances."
    />
  );
}

export function PurchasesPage() {
  return (
    <PlaceholderPage
      title="Purchases"
      description="Paddy procurement, mandi intake weighment, and supplier bills."
    />
  );
}

export function ProductionTodayPage() {
  return (
    <PlaceholderPage
      title="Today's production"
      description="Live shift yield, active milling batches, and byproduct output."
    />
  );
}

export function ProductionNewPage() {
  return (
    <PlaceholderPage
      title="New production batch"
      description="Start a new milling batch, specify paddy input, and track recovery."
    />
  );
}

export function ProductionHistoryPage() {
  return (
    <PlaceholderPage
      title="Production history"
      description="Historical batch records, milling yields, and outturn percentages."
    />
  );
}

export function CustomersPage() {
  return (
    <PlaceholderPage
      title="Customers"
      description="Customer directory, approved credit limits, and outstanding ledger balances."
    />
  );
}

export function ReportsSalesPage() {
  return (
    <PlaceholderPage
      title="Sales report"
      description="Periodic sales turnover, customer-wise breakdown, and item volume."
    />
  );
}

export function ReportsStockPage() {
  return (
    <PlaceholderPage
      title="Stock report"
      description="Opening, receipts, issues, and closing balances with weighted average cost."
    />
  );
}

export function ReportsProductionPage() {
  return (
    <PlaceholderPage
      title="Production report"
      description="Yield analysis, outturn ratios, and byproduct production summaries."
    />
  );
}

export function ReportsReceivablesPage() {
  return (
    <PlaceholderPage
      title="Receivables report"
      description="Aging analysis (0-30, 31-60, 61-90, 90+ days) and payment performance."
    />
  );
}

export function ReportsGSTPage() {
  return (
    <PlaceholderPage
      title="GST report"
      description="GSTR-1 outward supplies, tax liabilities, and HSN-wise summaries."
    />
  );
}

export function ReportsAuditPage() {
  return (
    <PlaceholderPage
      title="Audit report"
      description="Traceable modifications, balance reconciliation logs, and security events."
    />
  );
}

export function ExportsPage() {
  return (
    <PlaceholderPage
      title="Exports"
      description="CSV and Excel financial reporting exports, backups, and audit dumps."
    />
  );
}

export function SettingsPage() {
  return (
    <PlaceholderPage
      title="Settings"
      description="System configuration, ledger tax settings, and operational preferences."
    />
  );
}

export function SettingsProfilePage() {
  return (
    <PlaceholderPage
      title="Profile & Account"
      description="User profile, credentials, security, and notification settings."
    />
  );
}

export function SettingsUsersPage() {
  return (
    <PlaceholderPage
      title="User management"
      description="Staff accounts, role assignments, and permission controls."
    />
  );
}

export function SettingsMillPage() {
  return (
    <PlaceholderPage
      title="Mill configuration"
      description="Production lines, huller parameters, storage bins, and ledger tax settings."
    />
  );
}

export function SettingsAuditPage() {
  return (
    <PlaceholderPage
      title="Audit log"
      description="Immutable system event log, user actions, and security audit records."
    />
  );
}

export function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xs">
        <h1 className="text-xl font-semibold text-foreground">
          Sign in to MillLedger
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Enter your credentials to access the production unit.
        </p>
      </div>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <h1 className="text-2xl font-bold text-foreground">
        404 - Page Not Found
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The requested operational route does not exist.
      </p>
    </div>
  );
}
