import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useUrlState } from "@/hooks/use-url-state";
import { formatDate, formatDateTime, formatINR } from "@/lib/formatters";
import { useLanguage } from "@/lib/i18n";
import { SkeletonTable } from "@/components/ui/loading-error-empty";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DomainTooltip } from "@/components/ui/domain-tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RefreshCwIcon,
  DownloadIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
} from "lucide-react";
import type { Role } from "@mill-ledger/shared";

interface ReportTabItem {
  id: string;
  label: string;
  roles: Role[];
}

const REPORT_TABS: ReportTabItem[] = [
  {
    id: "sales",
    label: "Sales register",
    roles: ["ADMIN", "SALESMAN", "ACCOUNTANT", "OWNER"],
  },
  {
    id: "gst",
    label: "GST outward summary",
    roles: ["ADMIN", "ACCOUNTANT", "OWNER"],
  },
  {
    id: "stock",
    label: "Stock valuation",
    roles: ["ADMIN", "SALESMAN", "PRODUCTION", "ACCOUNTANT", "OWNER"],
  },
  {
    id: "production",
    label: "Production & variances",
    roles: ["ADMIN", "PRODUCTION", "ACCOUNTANT", "OWNER"],
  },
  {
    id: "receivables",
    label: "Receivables & ageing",
    roles: ["ADMIN", "ACCOUNTANT", "OWNER"],
  },
  {
    id: "audit",
    label: "Audit logs",
    roles: ["ADMIN", "ACCOUNTANT", "OWNER"],
  },
];

export function ReportsPage({ defaultTab = "sales" }: { defaultTab?: string }) {
  const { user } = useCurrentUser();
  const { t } = useLanguage();
  const allowedTabs = REPORT_TABS.filter((t) =>
    user ? t.roles.includes(user.role) : true,
  );

  const isDefaultAllowed = allowedTabs.some((t) => t.id === defaultTab);
  const initialTab = isDefaultAllowed
    ? defaultTab
    : allowedTabs[0]?.id || "sales";

  const [activeTab, setActiveTab] = useUrlState<string>("tab", initialTab, {
    replace: false,
  });
  const effectiveTab = allowedTabs.some((t) => t.id === activeTab)
    ? activeTab
    : allowedTabs[0]?.id || "sales";

  const [exporting, setExporting] = useState(false);
  const [auditSearch, setAuditSearch] = useUrlState("q", "");
  const [auditActionFilter, setAuditActionFilter] = useUrlState("action", "ALL");

  // 1. Sales Report
  const {
    data: salesData,
    isLoading: loadingSales,
    refetch: refetchSales,
  } = useQuery({
    queryKey: ["report-sales"],
    queryFn: async () => {
      const res = await apiClient.get("/reports/sales?organizationId=MILL");
      return res.data;
    },
    enabled: effectiveTab === "sales",
  });

  // 2. GST Outward Summary
  const { data: gstData, refetch: refetchGST } = useQuery({
    queryKey: ["report-gst"],
    queryFn: async () => {
      const res = await apiClient.get("/reports/gst?organizationId=MILL");
      return res.data;
    },
    enabled: effectiveTab === "gst",
  });

  // 3. Stock Valuation Report
  const { data: stockData, refetch: refetchStock } = useQuery({
    queryKey: ["report-stock"],
    queryFn: async () => {
      const res = await apiClient.get("/reports/stock?organizationId=MILL");
      return res.data;
    },
    enabled: effectiveTab === "stock",
  });

  // 4. Production Report
  const { data: prodData, refetch: refetchProd } = useQuery({
    queryKey: ["report-production"],
    queryFn: async () => {
      const res = await apiClient.get(
        "/reports/production?organizationId=MILL",
      );
      return res.data;
    },
    enabled: effectiveTab === "production",
  });

  // 5. Receivables Report
  const { data: recData, refetch: refetchRec } = useQuery({
    queryKey: ["report-receivables"],
    queryFn: async () => {
      const res = await apiClient.get(
        "/reports/receivables?organizationId=MILL",
      );
      return res.data;
    },
    enabled: effectiveTab === "receivables",
  });

  // 6. Audit Report
  const { data: auditData, refetch: refetchAudit } = useQuery({
    queryKey: ["report-audit"],
    queryFn: async () => {
      const res = await apiClient.get("/reports/audit?organizationId=MILL");
      return res.data;
    },
    enabled: effectiveTab === "audit",
  });

  const filteredAuditLogs = (auditData?.logs || []).filter((log: any) => {
    if (auditActionFilter !== "ALL" && log.action !== auditActionFilter) {
      return false;
    }
    if (auditSearch.trim()) {
      const q = auditSearch.toLowerCase();
      const matchEmail = (log.userEmail || "").toLowerCase().includes(q);
      const matchEntity = (log.entity || "").toLowerCase().includes(q);
      const matchAction = (log.action || "").toLowerCase().includes(q);
      const matchDetails = (log.details || "").toLowerCase().includes(q);
      return matchEmail || matchEntity || matchAction || matchDetails;
    }
    return true;
  });

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const res = await apiClient.get(
        `/reports/${effectiveTab}/export?format=csv&organizationId=MILL`,
        {
          responseType: "blob",
        },
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `${effectiveTab}-report-${new Date().toISOString().slice(0, 10)}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Export failed", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Reports & Audit
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Tax registers, stock valuation, production costing, and system
            activity logs
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (effectiveTab === "sales") refetchSales();
              if (effectiveTab === "gst") refetchGST();
              if (effectiveTab === "stock") refetchStock();
              if (effectiveTab === "production") refetchProd();
              if (effectiveTab === "receivables") refetchRec();
              if (effectiveTab === "audit") refetchAudit();
            }}
            className="gap-2 cursor-pointer"
          >
            <RefreshCwIcon className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleExportCSV}
            disabled={exporting}
            className="gap-2 cursor-pointer"
          >
            <DownloadIcon className="h-4 w-4" />
            {exporting ? "Exporting..." : "Export CSV"}
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap border-b border-border">
        {allowedTabs.map((tab) => (
          <button
            key={tab.id}
            data-testid={`report-tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
              effectiveTab === tab.id
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(tab.label)}
          </button>
        ))}
      </div>

      {/* Tab 1: Sales Register */}
      {effectiveTab === "sales" && (
        <div className="rounded-xl border bg-card shadow-xs">
          <div className="flex flex-col gap-2 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Sales Tax Register
              </h2>
              <p className="text-xs text-muted-foreground">
                All posted sales invoices and tax snapshots
              </p>
            </div>
            {salesData?.summary && (
              <div className="flex items-center gap-4 text-xs font-mono">
                <span>
                  Taxable: {formatINR(salesData.summary.totalTaxable)}
                </span>
                <span>Tax: {formatINR(salesData.summary.totalTax)}</span>
                <span className="font-bold text-foreground">
                  Grand total: {formatINR(salesData.summary.grandTotal)}
                </span>
              </div>
            )}
          </div>

          {loadingSales ? (
            <div className="p-4">
              <SkeletonTable rows={5} columns={9} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Invoice")}</TableHead>
                    <TableHead>{t("Date")}</TableHead>
                    <TableHead>{t("Customer")}</TableHead>
                    <TableHead>{t("Product")}</TableHead>
                    <TableHead className="text-right">{t("Qty")}</TableHead>
                    <TableHead className="text-right">{t("Taxable")}</TableHead>
                    <TableHead className="text-right">{t("CGST")}</TableHead>
                    <TableHead className="text-right">{t("SGST")}</TableHead>
                    <TableHead className="text-right">{t("Total")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(salesData?.rows || []).map((row: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-xs font-semibold">
                        {row.invoiceNumber}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(row.invoiceDate)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-xs">
                          <span className="font-medium">
                            {row.customerName}
                          </span>
                          <span className="font-mono text-muted-foreground">
                            {row.customerGstin}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {row.productName}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {row.quantity}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatINR(row.taxableAmount)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatINR(row.cgstAmount)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatINR(row.sgstAmount)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold">
                        {formatINR(row.lineTotal)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: GST Outward Summary */}
      {effectiveTab === "gst" && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border bg-card p-4 shadow-xs">
              <span className="text-xs uppercase text-muted-foreground">
                Total outward taxable
              </span>
              <div className="mt-1 text-2xl font-bold font-mono">
                {formatINR(gstData?.summary?.totalTaxable || 0)}
              </div>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-xs">
              <span className="text-xs uppercase text-muted-foreground">
                Total tax liability
              </span>
              <div className="mt-1 text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {formatINR(gstData?.summary?.totalTaxAmount || 0)}
              </div>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-xs">
              <span className="text-xs uppercase text-muted-foreground">
                Credit note deductions
              </span>
              <div className="mt-1 text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
                {formatINR(gstData?.summary?.totalCreditNotesAmount || 0)}
              </div>
            </div>
          </div>

          {/* Rate wise and HSN breakdown */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border bg-card p-4 shadow-xs">
              <h3 className="text-sm font-semibold mb-3">
                Rate wise tax liability
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>GST Rate</TableHead>
                    <TableHead className="text-right">Taxable value</TableHead>
                    <TableHead className="text-right">CGST</TableHead>
                    <TableHead className="text-right">SGST</TableHead>
                    <TableHead className="text-right">Total tax</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(gstData?.rateBreakup || []).map((r: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-xs">
                        {r.ratePct}%
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatINR(r.taxable)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatINR(r.cgst)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatINR(r.sgst)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold">
                        {formatINR(r.totalTax)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="rounded-xl border bg-card p-4 shadow-xs">
              <h3 className="text-sm font-semibold mb-3">HSN summary table</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>HSN Code</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Taxable</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(gstData?.hsnSummary || []).map((h: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-xs font-medium">
                        {h.hsnCode}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {h.quantity}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatINR(h.taxable)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold">
                        {formatINR(h.cgst + h.sgst + h.igst)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Stock Valuation */}
      {effectiveTab === "stock" && (
        <div className="rounded-xl border bg-card shadow-xs">
          <div className="flex items-center justify-between border-b p-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Stock Valuation Ledger
              </h2>
              <p className="text-xs text-muted-foreground">
                Weighted average unit cost and append only ledger reconciliation
              </p>
            </div>
            {stockData?.summary && (
              <div className="text-right">
                <div className="text-xs uppercase text-muted-foreground">
                  Total valuation
                </div>
                <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {formatINR(stockData.summary.totalValuation)}
                </div>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Item name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">On hand</TableHead>
                  <TableHead className="text-right">Reserved</TableHead>
                  <TableHead className="text-right">
                    <DomainTooltip term="ATP">Available</DomainTooltip>
                  </TableHead>
                  <TableHead className="text-right">
                    <DomainTooltip term="WAC">Avg cost</DomainTooltip>
                  </TableHead>
                  <TableHead className="text-right">Valuation</TableHead>
                  <TableHead className="text-center">Ledger check</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(stockData?.rows || []).map((row: any) => (
                  <TableRow key={row.sku}>
                    <TableCell className="font-mono text-xs font-semibold">
                      {row.sku}
                    </TableCell>
                    <TableCell className="text-xs">{row.name}</TableCell>
                    <TableCell className="text-xs">
                      {row.category.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold">
                      {row.onHand} {row.unitOfMeasure}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {row.reserved}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {row.available}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {formatINR(row.weightedAverageCost)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold">
                      {formatINR(row.totalValuation)}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.isReconciled ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2Icon className="h-3.5 w-3.5" />
                          Balanced
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-destructive">
                          <AlertTriangleIcon className="h-3.5 w-3.5" />
                          Mismatch
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Tab 4: Production Report */}
      {effectiveTab === "production" && (
        <div className="rounded-xl border bg-card shadow-xs">
          <div className="flex items-center justify-between border-b p-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Production Execution & Variance Report
              </h2>
              <p className="text-xs text-muted-foreground">
                Actual output, yield variances, labor and utility cost
                allocation
              </p>
            </div>
            {prodData?.summary && (
              <div className="text-right font-mono text-xs">
                <span>
                  Output: {prodData.summary.totalGoodQuantity} units |{" "}
                </span>
                <span className="font-bold">
                  Total cost: {formatINR(prodData.summary.totalRunCost)}
                </span>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run number</TableHead>
                  <TableHead>Recipe</TableHead>
                  <TableHead className="text-right">Good output</TableHead>
                  <TableHead className="text-right">
                    <DomainTooltip term="YIELD_VARIANCE">
                      Yield variance
                    </DomainTooltip>
                  </TableHead>
                  <TableHead className="text-right">Direct labor</TableHead>
                  <TableHead className="text-right">Gas & power</TableHead>
                  <TableHead className="text-right">Total cost</TableHead>
                  <TableHead className="text-right">Cost / packet</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(prodData?.rows || []).map((row: any) => (
                  <TableRow key={row.runId}>
                    <TableCell className="font-mono text-xs font-semibold">
                      {row.runNumber}
                    </TableCell>
                    <TableCell className="text-xs">{row.recipeName}</TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold">
                      {row.actualGoodQty} pkts
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      <span
                        className={
                          row.yieldVariancePct < 0
                            ? "text-amber-600 font-bold"
                            : ""
                        }
                      >
                        {row.yieldVariancePct}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatINR(row.directLaborCost)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatINR(row.gasPowerCost)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold">
                      {formatINR(row.totalCost)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {formatINR(row.unitCost)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Tab 5: Receivables and Ageing */}
      {effectiveTab === "receivables" && (
        <div className="rounded-xl border bg-card shadow-xs">
          <div className="flex items-center justify-between border-b p-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Receivables & Ageing Summary
              </h2>
              <p className="text-xs text-muted-foreground">
                Customer account balances and overdue ageing buckets
              </p>
            </div>
            {recData?.summary && (
              <div className="text-right">
                <div className="text-xs uppercase text-muted-foreground">
                  Total outstanding
                </div>
                <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
                  {formatINR(recData.summary.totalOutstanding)}
                </div>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="text-right">Invoiced</TableHead>
                  <TableHead className="text-right">Collections</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right">0 to 30 days</TableHead>
                  <TableHead className="text-right">31 to 60 days</TableHead>
                  <TableHead className="text-right">Over 90 days</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(recData?.rows || []).map((row: any) => (
                  <TableRow key={row.customerId}>
                    <TableCell>
                      <div className="flex flex-col text-xs">
                        <span className="font-medium text-foreground">
                          {row.customerName}
                        </span>
                        <span className="font-mono text-muted-foreground">
                          {row.customerCode}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.state}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatINR(row.totalInvoiced)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-emerald-600">
                      {formatINR(row.totalPaid)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
                      {formatINR(row.netOutstanding)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatINR(row.ageing.current0to30)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {formatINR(row.ageing.days31to60)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {formatINR(row.ageing.over90days)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Tab 6: Audit Logs */}
      {effectiveTab === "audit" && (
        <div className="rounded-xl border bg-card shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b p-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                System Audit Trail
              </h2>
              <p className="text-xs text-muted-foreground">
                Immutable activity logs with actor, timestamp, action and
                request metadata
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Search actor, entity, details..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="h-8 w-56 text-xs"
              />
              <select
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                className="h-8 rounded-control border border-input bg-background px-2 text-xs text-foreground shadow-xs outline-none"
              >
                <option value="ALL">All Actions</option>
                <option value="CREATE">CREATE</option>
                <option value="UPDATE">UPDATE</option>
                <option value="DELETE">DELETE</option>
                <option value="APPROVE">APPROVE</option>
                <option value="POST">POST</option>
                <option value="REVERSE">REVERSE</option>
                <option value="EXPORT">EXPORT</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAuditLogs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-xs text-muted-foreground py-8"
                    >
                      {auditSearch || auditActionFilter !== "ALL"
                        ? "No matching audit events found"
                        : "No audit events recorded yet"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAuditLogs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {formatDateTime(log.timestamp)}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {log.userEmail || "System"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px]"
                        >
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">
                        {log.entity}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {log.details || "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

export function ReportsSalesPage() {
  return <ReportsPage defaultTab="sales" />;
}

export function ReportsGSTPage() {
  return <ReportsPage defaultTab="gst" />;
}

export function ReportsStockPage() {
  return <ReportsPage defaultTab="stock" />;
}

export function ReportsProductionPage() {
  return <ReportsPage defaultTab="production" />;
}

export function ReportsReceivablesPage() {
  return <ReportsPage defaultTab="receivables" />;
}

export function ReportsAuditPage() {
  return <ReportsPage defaultTab="audit" />;
}
