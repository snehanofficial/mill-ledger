/**
 * Placeholder pages for shell route demonstration.
 * Adapted directly from DashboardBlocks PagePlaceholder pattern.
 * These will be replaced with real portal screens in subsequent milestones.
 */

import { Badge } from "@/components/ui/badge";
import { FolderKanbanIcon } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  description: string;
}

function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 md:p-8">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          <Badge variant="outline" className="text-xs">
            Module in Progress
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {/* Clean, Dignified Operational Placeholder State - No AI Slop */}
      <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-border bg-card p-8 sm:p-12 text-center shadow-xs min-h-[360px]">
        <div className="flex size-12 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground mb-4">
          <FolderKanbanIcon className="size-6" />
        </div>
        <h2 className="text-base font-semibold text-foreground">
          {title} Workspace
        </h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
          {description} This view is currently scheduled for rollout in the next operational milestone.
        </p>
        <div className="mt-6 flex items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground">
          <span className="size-2 rounded-full bg-emerald-600/70" />
          <span>Ledger database schema and API contracts ready</span>
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
