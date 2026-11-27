import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { PaginationMeta } from "@mill-ledger/shared";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useUrlState } from "@/hooks/use-url-state";
import { usePagination } from "@/hooks/use-pagination";
import { DataPagination } from "@/components/ui/data-pagination";
import { formatDate, formatDateTime, formatINR } from "@/lib/formatters";
import { useLanguage } from "@/lib/i18n";
import { EmptyState, ErrorState, SkeletonTable } from "@/components/ui/loading-error-empty";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  EyeIcon,
} from "lucide-react";
import {
  AuditDetailSheet,
  type AuditLogRecord,
} from "@/components/reports/audit-detail-sheet";
import {
  getActionBadgeVariant,
  humanizeEntity,
  summarizeAuditDetails,
} from "@/lib/audit-formatter";
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
    id: "customer-sales",
    label: "Customer-wise sales",
    roles: ["ADMIN", "SALESMAN", "ACCOUNTANT", "OWNER"],
  },
  {
    id: "product-sales",
    label: "Product-wise sales",
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
    id: "stock-ledger",
    label: "Stock ledger",
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
  const [selectedAuditLog, setSelectedAuditLog] =
    useState<AuditLogRecord | null>(null);
  const [startDate, setStartDate] = useUrlState("startDate", "");
  const [endDate, setEndDate] = useUrlState("endDate", "");
  const [customerIdFilter, setCustomerIdFilter] = useUrlState("customerId", "ALL");
  const [auditSearch, setAuditSearch] = useUrlState("q", "", {
    debounceMs: 250,
  });
  const [auditActionFilter, setAuditActionFilter] = useUrlState("action", "ALL");
  const {
    page: auditPage,
    pageSize: auditPageSize,
    offset: auditOffset,
    setPage: setAuditPage,
    setPageSize: setAuditPageSize,
  } = usePagination({ defaultPageSize: 20, prefix: "audit" });

  const filterParams = new URLSearchParams();
  if (startDate) filterParams.set("startDate", startDate);
  if (endDate) filterParams.set("endDate", endDate);
  if (customerIdFilter && customerIdFilter !== "ALL") {
    filterParams.set("customerId", customerIdFilter);
  }
  const filterQs = filterParams.toString();

  const { data: customersListData } = useQuery<{
    customers: Array<{ id: string; name: string }>;
  }>({
    queryKey: ["report-filter-customers"],
    queryFn: async () => {
      const res = await apiClient.get("/sales/customers");
      return res.data;
    },
  });

  // 1. Sales Report
  const {
    data: salesData,
    isLoading: loadingSales,
    isError: isErrorSales,
    error: errorSales,
    refetch: refetchSales,
  } = useQuery({
    queryKey: ["report-sales", filterQs],
    queryFn: async () => {
      const res = await apiClient.get(`/reports/sales?${filterQs}`);
      return res.data;
    },
    enabled: effectiveTab === "sales",
  });

  // 2. GST Outward Summary
  const { data: gstData, isError: isErrorGST, error: errorGST, refetch: refetchGST } = useQuery({
    queryKey: ["report-gst", filterQs],
    queryFn: async () => {
      const res = await apiClient.get(`/reports/gst?${filterQs}`);
      return res.data;
    },
    enabled: effectiveTab === "gst",
  });

  // 3. Stock Valuation Report
  const { data: stockData, isError: isErrorStock, error: errorStock, refetch: refetchStock } = useQuery({
    queryKey: ["report-stock", filterQs],
    queryFn: async () => {
      const res = await apiClient.get(`/reports/stock?${filterQs}`);
      return res.data;
    },
    enabled: effectiveTab === "stock",
  });

  // 4. Production Report
  const { data: prodData, isError: isErrorProd, error: errorProd, refetch: refetchProd } = useQuery({
    queryKey: ["report-production", filterQs],
    queryFn: async () => {
      const res = await apiClient.get(`/reports/production?${filterQs}`);
      return res.data;
    },
    enabled: effectiveTab === "production",
  });

  // 5. Receivables Report
  const { data: recData, isError: isErrorRec, error: errorRec, refetch: refetchRec } = useQuery({
    queryKey: ["report-receivables", filterQs],
    queryFn: async () => {
      const res = await apiClient.get(`/reports/receivables?${filterQs}`);
      return res.data;
    },
    enabled: effectiveTab === "receivables",
  });

  // 5b. Customer-wise Sales (IMP-020)
  const { data: custSalesData, isError: isErrorCustSales, error: errorCustSales, refetch: refetchCustSales } = useQuery({
    queryKey: ["report-customer-sales", filterQs],
    queryFn: async () => {
      const res = await apiClient.get(`/reports/customer-sales?${filterQs}`);
      return res.data;
    },
    enabled: effectiveTab === "customer-sales",
  });

  // 5c. Product-wise Sales (IMP-020)
  const { data: prodSalesData, isError: isErrorProdSales, error: errorProdSales, refetch: refetchProdSales } = useQuery({
    queryKey: ["report-product-sales", filterQs],
    queryFn: async () => {
      const res = await apiClient.get(`/reports/product-sales?${filterQs}`);
      return res.data;
    },
    enabled: effectiveTab === "product-sales",
  });

  // 5d. Stock Ledger (IMP-020)
  const { data: stockLedgerData, isError: isErrorStockLedger, error: errorStockLedger, refetch: refetchStockLedger } = useQuery({
    queryKey: ["report-stock-ledger", filterQs],
    queryFn: async () => {
      const res = await apiClient.get(`/reports/stock-ledger?${filterQs}`);
      return res.data;
    },
    enabled: effectiveTab === "stock-ledger",
  });

  // 6. Audit Report
  const { data: auditData, isFetching: isFetchingAudit, isError: isErrorAudit, error: errorAudit, refetch: refetchAudit } = useQuery<{
    logs: any[];
    pagination: PaginationMeta;
  }>({
    queryKey: ["report-audit", auditPage, auditPageSize, auditActionFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(auditPageSize),
        offset: String(auditOffset),
      });
      if (auditActionFilter !== "ALL") {
        params.set("action", auditActionFilter);
      }
      const res = await apiClient.get(`/reports/audit?${params.toString()}`);
      return res.data;
    },
    enabled: effectiveTab === "audit",
    placeholderData: keepPreviousData,
  });

  const activeReportError = (() => {
    switch (effectiveTab) {
      case "sales":
        return isErrorSales ? { error: errorSales, refetch: refetchSales } : null;
      case "gst":
        return isErrorGST ? { error: errorGST, refetch: refetchGST } : null;
      case "stock":
        return isErrorStock ? { error: errorStock, refetch: refetchStock } : null;
      case "production":
        return isErrorProd ? { error: errorProd, refetch: refetchProd } : null;
      case "receivables":
        return isErrorRec ? { error: errorRec, refetch: refetchRec } : null;
      case "customer-sales":
        return isErrorCustSales ? { error: errorCustSales, refetch: refetchCustSales } : null;
      case "product-sales":
        return isErrorProdSales ? { error: errorProdSales, refetch: refetchProdSales } : null;
      case "stock-ledger":
        return isErrorStockLedger ? { error: errorStockLedger, refetch: refetchStockLedger } : null;
      case "audit":
        return isErrorAudit ? { error: errorAudit, refetch: refetchAudit } : null;
      default:
        return null;
    }
  })();

  const filteredAuditLogs = (auditData?.logs || []).filter((log: AuditLogRecord) => {
    if (auditActionFilter !== "ALL" && log.action !== auditActionFilter) {
      return false;
    }
    if (auditSearch.trim()) {
      const q = auditSearch.toLowerCase();
      const matchEmail = (log.userEmail || "").toLowerCase().includes(q);
      const matchEntity = (log.entity || "").toLowerCase().includes(q);
      const matchAction = (log.action || "").toLowerCase().includes(q);
      const detailsText =
        typeof log.details === "string"
          ? log.details
          : log.details
            ? JSON.stringify(log.details)
            : "";
      const matchDetails = detailsText.toLowerCase().includes(q);
      const matchReason = (log.reason || "").toLowerCase().includes(q);
      return matchEmail || matchEntity || matchAction || matchDetails || matchReason;
    }
    return true;
  });

  const handleExport = async (format: "csv" | "xlsx" | "pdf") => {
    try {
      setExporting(true);
      const res = await apiClient.get(
        `/reports/${effectiveTab}/export?format=${format}&${filterQs}`,
        {
          responseType: "blob",
        },
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `${effectiveTab}-report-${new Date().toISOString().slice(0, 10)}.${format}`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Reports & Audit
            </h1>
          </div>
          <p className="max-w-[60ch] text-sm text-muted-foreground">
            Tax registers, stock valuation, production costing, and system
            activity logs
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (effectiveTab === "sales") refetchSales();
              if (effectiveTab === "customer-sales") refetchCustSales();
              if (effectiveTab === "product-sales") refetchProdSales();
              if (effectiveTab === "gst") refetchGST();
              if (effectiveTab === "stock") refetchStock();
              if (effectiveTab === "stock-ledger") refetchStockLedger();
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
            variant="outline"
            size="sm"
            onClick={() => handleExport("csv")}
            disabled={exporting}
            className="gap-1.5 cursor-pointer"
          >
            <DownloadIcon className="h-4 w-4" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("xlsx")}
            disabled={exporting}
            className="gap-1.5 cursor-pointer"
          >
            <DownloadIcon className="h-4 w-4" />
            Excel
          </Button>
          <Button
            size="sm"
            onClick={() => handleExport("pdf")}
            disabled={exporting}
            className="gap-1.5 cursor-pointer"
          >
            <DownloadIcon className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      {/* Report Filter Bar (IMP-006) */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3 shadow-xs">
        <div className="flex flex-col gap-1">
          <label htmlFor="report-start-date" className="text-2xs font-medium uppercase text-muted-foreground">
            From Date
          </label>
          <Input
            id="report-start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-8 w-40 text-xs"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="report-end-date" className="text-2xs font-medium uppercase text-muted-foreground">
            To Date
          </label>
          <Input
            id="report-end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-8 w-40 text-xs"
          />
        </div>
        {(effectiveTab === "sales" || effectiveTab === "receivables") && (
          <div className="flex flex-col gap-1">
            <label htmlFor="report-customer-filter" className="text-2xs font-medium uppercase text-muted-foreground">
              Customer
            </label>
            <Select value={customerIdFilter} onValueChange={setCustomerIdFilter}>
              <SelectTrigger id="report-customer-filter" className="h-8 w-48 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent searchable searchPlaceholder="Search customers...">
                <SelectItem value="ALL">All Customers</SelectItem>
                {(customersListData?.customers ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {(startDate || endDate || customerIdFilter !== "ALL") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStartDate("");
              setEndDate("");
              setCustomerIdFilter("ALL");
            }}
            className="h-8 text-xs text-muted-foreground"
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Navigation Tabs */}
      <div role="tablist" aria-label="Report views" className="flex flex-wrap border-b border-border">
        {allowedTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={effectiveTab === tab.id}
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

      {activeReportError ? (
        <ErrorState
          title="Could not load report"
          description={extractErrorMessage(activeReportError.error)}
          error={activeReportError.error}
          onRetry={() => activeReportError.refetch()}
        />
      ) : (
        <>
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
                    <TableHead className="text-right">{t("IGST")}</TableHead>
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
                      <TableCell className="text-right font-mono text-xs">
                        {formatINR(row.igstAmount)}
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                    <TableHead className="text-right">IGST</TableHead>
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
                      <TableCell className="text-right font-mono text-xs">
                        {formatINR(r.igst)}
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

      {/* Tab: Customer-Wise Sales (IMP-020) */}
      {effectiveTab === "customer-sales" && (
        <div className="rounded-xl border bg-card shadow-xs overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="text-right">Invoices</TableHead>
                <TableHead className="text-right">Taxable</TableHead>
                <TableHead className="text-right">GST</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(custSalesData?.rows || []).map((r: any) => (
                <TableRow key={r.customerCode}>
                  <TableCell className="font-medium text-xs">{r.customerName} ({r.customerCode})</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.state}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{r.invoicesCount}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatINR(r.taxableAmount)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatINR(r.totalTaxAmount)}</TableCell>
                  <TableCell className="text-right font-mono text-xs font-bold">{formatINR(r.totalAmount)}</TableCell>
                  <TableCell className="text-right font-mono text-xs text-amber-600">{formatINR(r.outstandingAmount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Tab: Product-Wise Sales (IMP-020) */}
      {effectiveTab === "product-sales" && (
        <div className="rounded-xl border bg-card shadow-xs overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>HSN</TableHead>
                <TableHead className="text-right">Qty Sold</TableHead>
                <TableHead className="text-right">Taxable</TableHead>
                <TableHead className="text-right">GST</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(prodSalesData?.rows || []).map((r: any) => (
                <TableRow key={`${r.productName}-${r.hsnCode}`}>
                  <TableCell className="font-medium text-xs">{r.productName}</TableCell>
                  <TableCell className="font-mono text-xs">{r.hsnCode}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{r.totalQuantity}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatINR(r.taxableAmount)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatINR(r.totalTaxAmount)}</TableCell>
                  <TableCell className="text-right font-mono text-xs font-bold">{formatINR(r.totalAmount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Tab: Stock Ledger (IMP-020) */}
      {effectiveTab === "stock-ledger" && (
        <div className="rounded-xl border bg-card shadow-xs overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Cost</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(stockLedgerData?.rows || []).map((r: any, idx: number) => (
                <TableRow key={`${r.sku}-${r.postedAt}-${idx}`}>
                  <TableCell className="text-xs text-muted-foreground">{formatDateTime(r.postedAt)}</TableCell>
                  <TableCell className="text-xs font-medium">{r.itemName} ({r.sku})</TableCell>
                  <TableCell><Badge variant="outline" className="font-mono text-2xs">{r.movementType}</Badge></TableCell>
                  <TableCell className="text-right font-mono text-xs font-semibold">{r.quantity} {r.uom}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatINR(r.unitCost)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{r.notes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
                aria-label="Search audit events by actor, entity, details"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="h-8 w-56 text-xs"
              />
              <Select
                value={auditActionFilter}
                onValueChange={setAuditActionFilter}
              >
                <SelectTrigger
                  aria-label="Filter audit events by action"
                  className="h-9 w-auto min-w-32 px-3 py-1 text-xs font-medium"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Actions</SelectItem>
                  <SelectItem value="CREATE">CREATE</SelectItem>
                  <SelectItem value="UPDATE">UPDATE</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                  <SelectItem value="APPROVE">APPROVE</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="REVERSE">REVERSE</SelectItem>
                  <SelectItem value="EXPORT">EXPORT</SelectItem>
                </SelectContent>
              </Select>
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
                  <TableHead>Summary</TableHead>
                  <TableHead className="text-right">Inspect</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAuditLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-0">
                      <EmptyState
                        title={
                          auditSearch || auditActionFilter !== "ALL"
                            ? "No matching audit events found"
                            : "No audit events recorded yet"
                        }
                        description={
                          auditSearch || auditActionFilter !== "ALL"
                            ? "Clear the search or action filter to view all audit events."
                            : undefined
                        }
                        className="min-h-32 py-6"
                        action={
                          auditSearch || auditActionFilter !== "ALL" ? (
                            <Button
                              variant="tertiary"
                              size="sm"
                              onClick={() => {
                                setAuditSearch("");
                                setAuditActionFilter("ALL");
                              }}
                            >
                              Clear filters
                            </Button>
                          ) : undefined
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAuditLogs.map((log: AuditLogRecord) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-xs font-mono text-muted-foreground">
                        {formatDateTime(log.timestamp)}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-foreground">
                        {log.userEmail || "System"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={getActionBadgeVariant(log.action)}
                          className="font-mono text-[10px]"
                        >
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium text-foreground">
                          {humanizeEntity(log.entity)}
                        </div>
                        {log.entityId ? (
                          <div className="font-mono text-[11px] text-muted-foreground truncate max-w-36">
                            {log.entityId}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-md text-xs text-muted-foreground">
                        <p className="line-clamp-2">
                          {summarizeAuditDetails(log.details, log.reason)}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="tertiary"
                          size="sm"
                          aria-label={`Inspect audit event for ${humanizeEntity(log.entity)}`}
                          onClick={() => setSelectedAuditLog(log)}
                        >
                          <EyeIcon className="size-3.5" aria-hidden="true" />
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <AuditDetailSheet
            log={selectedAuditLog}
            open={Boolean(selectedAuditLog)}
            onOpenChange={(nextOpen) => {
              if (!nextOpen) {
                setSelectedAuditLog(null);
              }
            }}
          />
          <DataPagination
            pagination={auditData?.pagination}
            page={auditPage}
            pageSize={auditPageSize}
            onPageChange={setAuditPage}
            onPageSizeChange={setAuditPageSize}
            isFetching={isFetchingAudit}
            itemLabel="audit logs"
            className="m-4"
          />
        </div>
      )}
        </>
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
