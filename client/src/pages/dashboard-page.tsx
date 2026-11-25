import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { formatINR, formatQuantity, formatTime } from "@/lib/formatters";
import { useLanguage } from "@/lib/i18n";
import {
  SkeletonTable,
  SkeletonKPIs,
  ErrorState,
} from "@/components/ui/loading-error-empty";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  IndianRupeeIcon,
  RefreshCwIcon,
  PackageCheckIcon,
  AlertTriangleIcon,
  TrendingUpIcon,
  WarehouseIcon,
  FileTextIcon,
  LayersIcon,
  CheckCircle2Icon,
  ClockIcon,
} from "lucide-react";
import { Link } from "react-router-dom";

interface DashboardData {
  dashboardTitle: string;
  asOf: string;
  metrics: {
    totalRevenue: number;
    totalInvoicesCount: number;
    totalStockValuation: number;
    stockReconciliationOk: boolean;
    totalProductionUnits: number;
    totalProductionCost: number;
    totalCollections: number;
    totalOutstandingReceivables: number;
    unallocatedCashCredit: number;
    pendingOrdersCount: number;
    todayOrdersCount?: number;
    todayRevenue?: number;
  };
  lowStockAlerts?: Array<{
    sku: string;
    name: string;
    available: number;
    onHand: number;
  }>;
  varianceAlerts?: Array<{
    runNumber: string;
    productName: string;
    yieldVariancePct: number;
  }>;
  productMargins?: Array<{
    sku: string;
    name: string;
    sellingPriceExclGst: number;
    unitCost: number;
    marginAmount: number;
    marginPct: number;
  }>;
  recentInvoices: Array<{
    invoiceId: string;
    invoiceNumber: string;
    customerName: string;
    taxableAmount: number;
    taxAmount: number;
    lineTotal: number;
    status: string;
  }>;
  stockItems: Array<{
    sku: string;
    name: string;
    category: string;
    onHand: number;
    available: number;
    weightedAverageCost: number;
    totalValuation: number;
    isReconciled: boolean;
  }>;
  recentProductionRuns: Array<{
    runId: string;
    runNumber: string;
    productName: string;
    actualGoodQty: number;
    totalCost: number;
    yieldVariancePct: number;
  }>;
  topReceivables: Array<{
    customerId: string;
    customerCode: string;
    customerName: string;
    netOutstanding: number;
  }>;
}

export function DashboardPage() {
  const { t } = useLanguage();
  const { data, isLoading, isError, error, refetch, isFetching } =
    useQuery<DashboardData>({
      queryKey: ["owner-dashboard"],
      queryFn: async () => {
        const res = await apiClient.get("/dashboard?organizationId=MILL");
        return res.data;
      },
    });

  const metrics = data?.metrics;

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {t("Overview")}
            </h1>
          </div>
          <p className="max-w-[60ch] text-sm text-muted-foreground">
            {t("Executive operational overview and real time reconciled business metrics")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {data?.asOf && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ClockIcon className="h-3.5 w-3.5" />
              As of {formatTime(data.asOf)}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCwIcon
              className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            />
            {t("Refresh")}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-6">
          <SkeletonKPIs count={4} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SkeletonTable rows={4} columns={4} />
            <SkeletonTable rows={4} columns={4} />
          </div>
        </div>
      ) : isError ? (
        <ErrorState
          title={t("Failed to load overview data", "Failed to load overview data")}
          description={
            error instanceof Error ? error.message : "Unknown error occurred"
          }
          error={error}
          onRetry={() => refetch()}
        />
      ) : (
        <>
          {/* Top KPI Cards Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Revenue */}
            <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wider">
                  {t("Total revenue")}
                </span>
                <IndianRupeeIcon className="h-4 w-4 text-primary" />
              </div>
              <div className="text-2xl font-bold text-foreground">
                {formatINR(metrics?.totalRevenue || 0)}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>
                  {metrics?.totalInvoicesCount || 0} posted tax invoices
                </span>
              </div>
            </div>

            {/* Outstanding Receivables */}
            <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wider">
                  {t("Receivables outstanding")}
                </span>
                <TrendingUpIcon className="h-4 w-4 text-amber-600" />
              </div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {formatINR(metrics?.totalOutstandingReceivables || 0)}
              </div>
              <div className="text-xs text-muted-foreground">
                Collections: {formatINR(metrics?.totalCollections || 0)}
              </div>
            </div>

            {/* Inventory Valuation */}
            <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wider">
                  {t("Stock valuation")}
                </span>
                <WarehouseIcon className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatINR(metrics?.totalStockValuation || 0)}
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                {metrics?.stockReconciliationOk ? (
                  <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2Icon className="h-3.5 w-3.5" />
                    {t("Ledger balanced")}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 font-medium text-destructive">
                    <AlertTriangleIcon className="h-3.5 w-3.5" />
                    {t("Discrepancy flagged")}
                  </span>
                )}
              </div>
            </div>

            {/* Production Good Output */}
            <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-medium uppercase tracking-wider">
                  {t("Production output", "Good output units")}
                </span>
                <PackageCheckIcon className="h-4 w-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-foreground">
                {formatQuantity(metrics?.totalProductionUnits || 0, {
                  unit: "units",
                })}
              </div>
              <div className="text-xs text-muted-foreground">
                Run cost: {formatINR(metrics?.totalProductionCost || 0)}
              </div>
            </div>
          </div>

          {/* Today Activity, Alerts & Margin Summary (IMP-019) */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-xl border bg-card p-4 shadow-xs flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Today&apos;s Activity (IST)
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-bold">{metrics?.todayOrdersCount ?? 0} orders</span>
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatINR(metrics?.todayRevenue ?? 0)}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                Pending approvals/fulfilment: {metrics?.pendingOrdersCount ?? 0}
              </span>
            </div>

            <div className="rounded-xl border bg-card p-4 shadow-xs flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Operational Alerts
              </span>
              <div className="text-xs flex flex-col gap-1">
                <span className={data?.varianceAlerts?.length ? "text-amber-600 font-semibold" : "text-muted-foreground"}>
                  Yield variance alerts: {data?.varianceAlerts?.length ?? 0}
                </span>
                <span className={data?.lowStockAlerts?.length ? "text-amber-600 font-semibold" : "text-muted-foreground"}>
                  Low-stock items (&le;50 ATP): {data?.lowStockAlerts?.length ?? 0}
                </span>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-4 shadow-xs flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Unit Margin (Excl. GST)
              </span>
              {(data?.productMargins ?? []).slice(0, 2).map((m) => (
                <div key={m.sku} className="flex items-center justify-between text-xs">
                  <span className="font-medium truncate">{m.name}</span>
                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    {m.unitCost > 0
                      ? `${formatINR(m.marginAmount)} (${m.marginPct}%)`
                      : "No run cost"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Operational Tables Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Recent Invoices */}
            <div className="rounded-xl border bg-card shadow-xs">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-2">
                  <FileTextIcon className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Recent sales invoices
                  </h3>
                </div>
                <Link
                  to="/invoices"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  View all
                </Link>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("Invoice")}</TableHead>
                      <TableHead>{t("Customer")}</TableHead>
                      <TableHead className="text-right">{t("Total")}</TableHead>
                      <TableHead className="text-right">{t("Status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.recentInvoices || []).length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-xs text-muted-foreground"
                        >
                          No invoices posted yet
                        </TableCell>
                      </TableRow>
                    ) : (
                      data?.recentInvoices.map((inv) => (
                        <TableRow key={inv.invoiceId}>
                          <TableCell className="font-mono text-xs font-semibold">
                            {inv.invoiceNumber}
                          </TableCell>
                          <TableCell className="text-xs">
                            {inv.customerName}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-medium">
                            {formatINR(inv.lineTotal)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={
                                inv.status === "PAID"
                                  ? "success"
                                  : inv.status === "PARTIALLY_PAID"
                                    ? "default"
                                    : "outline"
                              }
                              className="text-[10px]"
                            >
                              {inv.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Inventory Valuation and Stock Health */}
            <div className="rounded-xl border bg-card shadow-xs">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-2">
                  <LayersIcon className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Critical stock items
                  </h3>
                </div>
                <Link
                  to="/stock"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  View all stock
                </Link>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("Item")}</TableHead>
                      <TableHead className="text-right">{t("On hand")}</TableHead>
                      <TableHead className="text-right">{t("Unit cost")}</TableHead>
                      <TableHead className="text-right">{t("Valuation")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.stockItems || []).length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-xs text-muted-foreground"
                        >
                          No stock items loaded
                        </TableCell>
                      </TableRow>
                    ) : (
                      data?.stockItems.map((item) => (
                        <TableRow key={item.sku}>
                          <TableCell>
                            <div className="flex flex-col text-xs">
                              <span className="font-medium text-foreground">
                                {item.name}
                              </span>
                              <span className="font-mono text-muted-foreground">
                                {item.sku}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-semibold">
                            {item.onHand}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">
                            {formatINR(item.weightedAverageCost)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            {formatINR(item.totalValuation)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
