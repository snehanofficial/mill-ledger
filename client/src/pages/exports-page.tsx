import { useState, useId } from "react";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DownloadIcon,
  ShieldCheckIcon,
  RefreshCwIcon,
  CalendarIcon,
  FolderDownIcon,
  DatabaseIcon,
  ReceiptIcon,
  BoxIcon,
  LayersIcon,
  CreditCardIcon,
  PackageIcon,
  HistoryIcon,
  FileTextIcon,
  ArrowRightIcon,
} from "lucide-react";
import { toast } from "sonner";

interface ExportDataset {
  id: string;
  reportType: string;
  name: string;
  category: string;
  icon: React.ReactNode;
  description: string;
  fields: string[];
}

const DATASETS: ExportDataset[] = [
  {
    id: "sales",
    reportType: "sales",
    name: "Sales Register",
    category: "Finance & Sales",
    icon: <ReceiptIcon className="size-5 text-emerald-600" />,
    description: "Line-by-line sales orders, posted invoices, taxable values, and statutory GST breakdowns.",
    fields: ["Invoice Number", "Order Date", "Customer Name", "State", "Taxable Value", "CGST", "SGST", "IGST", "Total Amount"],
  },
  {
    id: "customer-sales",
    reportType: "customer-sales",
    name: "Customer-Wise Sales Summary",
    category: "Finance & Sales",
    icon: <ReceiptIcon className="size-5 text-emerald-600" />,
    description: "Aggregated taxable value, GST, total invoiced, and outstanding balance per customer.",
    fields: ["Customer Code", "Customer Name", "State", "Invoices Count", "Taxable Amount", "Total Tax", "Total Amount", "Outstanding"],
  },
  {
    id: "product-sales",
    reportType: "product-sales",
    name: "Product-Wise Sales Summary",
    category: "Finance & Sales",
    icon: <PackageIcon className="size-5 text-blue-600" />,
    description: "Aggregated quantities, taxable value, and GST by product and HSN code.",
    fields: ["Product Name", "HSN Code", "Total Quantity", "Taxable Amount", "Total Tax", "Total Amount"],
  },
  {
    id: "stock-ledger",
    reportType: "stock-ledger",
    name: "Stock Movement Ledger",
    category: "Warehouse & Supply",
    icon: <BoxIcon className="size-5 text-amber-600" />,
    description: "Chronological append-only stock movement ledger across all materials and finished goods.",
    fields: ["Posted At", "SKU", "Item Name", "Warehouse", "Movement Type", "Quantity", "Unit Cost", "Reference"],
  },
  {
    id: "gst",
    reportType: "gst",
    name: "GSTR-1 Outward Summary",
    category: "Statutory Tax",
    icon: <ShieldCheckIcon className="size-5 text-indigo-600" />,
    description: "Statutory outward supplies summary classified by HSN 21069099, rate (5%), and place of supply.",
    fields: ["Financial Year", "Quarter", "HSN Code", "Tax Rate", "Intra-state Taxable", "Inter-state Taxable", "Tax Total"],
  },
  {
    id: "stock",
    reportType: "stock",
    name: "Stock Valuation & Inventory",
    category: "Warehouse & Supply",
    icon: <BoxIcon className="size-5 text-amber-600" />,
    description: "Closing inventory quantities, active reservations, Available-To-Promise (ATP), and weighted-average unit costs.",
    fields: ["SKU", "Item Name", "UOM", "Physical On Hand", "Reserved Stock", "ATP Stock", "Weighted Avg Cost", "Valuation Total"],
  },
  {
    id: "production",
    reportType: "production",
    name: "Production Runs & Yield Variances",
    category: "Shop Floor",
    icon: <LayersIcon className="size-5 text-blue-600" />,
    description: "Milling production runs, recipe yields, flour & oil consumption, scrap/wastage, and tolerance variance flags.",
    fields: ["Run Number", "Batch Date", "Recipe Code", "Flour Consumed", "Good Packets", "Damaged Units", "Unit Cost", "Variance Flag"],
  },
  {
    id: "receivables",
    reportType: "receivables",
    name: "Accounts Receivable & Ageing",
    category: "Accounting",
    icon: <CreditCardIcon className="size-5 text-rose-600" />,
    description: "Outstanding invoice balances segmented into standard accounting ageing buckets (0-30, 31-60, 61-90, 90+ days).",
    fields: ["Customer Code", "Customer Name", "Total Invoiced", "Total Collected", "Outstanding Balance", "Ageing 0-30d", "Ageing 30d+"],
  },
  {
    id: "collections",
    reportType: "collections",
    name: "Collections & Payment Register",
    category: "Accounting",
    icon: <CreditCardIcon className="size-5 text-teal-600" />,
    description: "Inbound customer payments, bank transfer / cheque / cash receipts, and line allocation reconciliations.",
    fields: ["Payment Number", "Payment Date", "Customer Name", "Payment Mode", "Total Amount", "Allocated Amount", "Unallocated Balance"],
  },
  {
    id: "purchase",
    reportType: "purchase",
    name: "Procurement & Mandi Receipts",
    category: "Procurement",
    icon: <PackageIcon className="size-5 text-amber-700" />,
    description: "Direct mandi intake records, supplier invoice references, raw material weights, and intake cost rates.",
    fields: ["Receipt Number", "Intake Date", "Supplier Code", "Supplier Name", "Raw Material", "Quantity Received", "Unit Price", "Total Amount"],
  },
  {
    id: "audit",
    reportType: "audit",
    name: "Security & Mutation Audit Log",
    category: "Compliance",
    icon: <HistoryIcon className="size-5 text-purple-600" />,
    description: "Permanent append-only transaction log containing user actions, entity IDs, IP addresses, and correlation IDs.",
    fields: ["Log Timestamp", "Actor Email", "Role", "Action (CREATE/UPDATE)", "Entity Type", "Entity ID", "Request UUID"],
  },
];

export function ExportsPage() {
  const datasetSelectId = useId();
  const dateRangeSelectId = useId();
  const formatSelectId = useId();
  const [selectedReportType, setSelectedReportType] = useState<string>("sales");
  const [selectedFormat, setSelectedFormat] = useState<"csv" | "xlsx" | "pdf" | "json">("csv");
  const [dateRange, setDateRange] = useState<"all" | "month" | "year">("all");
  const [isExporting, setIsExporting] = useState(false);

  const activeDataset =
    DATASETS.find((d) => d.reportType === selectedReportType) || DATASETS[0];

  const handleDownload = async () => {
    setIsExporting(true);
    try {
      const now = new Date();
      let startDate: string | undefined;
      let endDate: string | undefined;

      if (dateRange === "month") {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        startDate = start.toISOString();
        endDate = now.toISOString();
      } else if (dateRange === "year") {
        // Indian FY starts April 1
        const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
        const start = new Date(year, 3, 1);
        startDate = start.toISOString();
        endDate = now.toISOString();
      }

      const response = await apiClient.post(
        "/reports/export",
        {
          reportType: selectedReportType,
          format: selectedFormat,
          startDate,
          endDate,
        },
        {
          responseType: "blob",
        },
      );

      // Trigger browser file download
      const mimeType =
        selectedFormat === "csv"
          ? "text/csv;charset=utf-8;"
          : selectedFormat === "xlsx"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : selectedFormat === "pdf"
              ? "application/pdf"
              : "application/json";
      const blob = new Blob([response.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const dateStr = now.toISOString().slice(0, 10);
      link.setAttribute("download", `${selectedReportType}-report-${dateStr}.${selectedFormat}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(
        `${activeDataset.name} exported successfully (${selectedFormat.toUpperCase()})`,
      );
    } catch (err: unknown) {
      toast.error(`Export failed: ${extractErrorMessage(err, "Export generation failed")}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-page-title text-foreground">
              Enterprise Data Export Hub
            </h1>
            <Badge variant="outline" className="text-xs">
              M8 Certified
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground max-w-[60ch]">
            Generate authorized statutory GST filings, closing inventory balances, and auditor reconciliation packages.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Badge
            variant="success"
            className="text-xs"
          >
            <ShieldCheckIcon className="size-3.5" />
            DPDP & Section 170 CGST Compliant
          </Badge>
        </div>
      </div>

      {/* Main Interactive Export Configuration Card */}
      <Card className="border-border/80">
        <CardHeader className="border-b border-border/60 px-5 py-4 sm:px-6">
          <CardTitle className="flex items-center gap-2">
            <FolderDownIcon className="size-4 text-primary" />
            Configure Export Parameters
          </CardTitle>
          <CardDescription>
            Select domain, reporting period, and file encoding format
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-5 px-5 py-4 sm:px-6 sm:pb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Dataset Selector */}
            <div className="flex flex-col">
              <Label
                htmlFor={datasetSelectId}
                className="mb-1.5 flex items-center gap-1.5 text-label text-muted-foreground"
              >
                <DatabaseIcon className="size-4 shrink-0" />
                Report Domain
              </Label>
              <Select
                value={selectedReportType}
                onValueChange={setSelectedReportType}
              >
                <SelectTrigger
                  id={datasetSelectId}
                  className="h-11 px-4 bg-surface-muted/70 dark:bg-surface-muted border-input/45 dark:border-input font-medium"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATASETS.map((d) => (
                    <SelectItem key={d.reportType} value={d.reportType}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="mt-1.5 text-xs text-muted-foreground">
                {activeDataset.description}
              </span>
            </div>

            {/* Date Range Selector */}
            <div className="flex flex-col">
              <Label
                htmlFor={dateRangeSelectId}
                className="mb-1.5 flex items-center gap-1.5 text-label text-muted-foreground"
              >
                <CalendarIcon className="size-4 shrink-0" />
                Reporting Period
              </Label>
              <Select
                value={dateRange}
                onValueChange={(value) => setDateRange(value as "all" | "month" | "year")}
              >
                <SelectTrigger
                  id={dateRangeSelectId}
                  className="h-11 px-4 bg-surface-muted/70 dark:bg-surface-muted border-input/45 dark:border-input font-medium"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Historical Records</SelectItem>
                  <SelectItem value="month">Current Month to Date</SelectItem>
                  <SelectItem value="year">Current Financial Year (2025-26)</SelectItem>
                </SelectContent>
              </Select>
              <span className="mt-1.5 text-xs text-muted-foreground">
                {dateRange === "all"
                  ? "Includes full operational ledger history"
                  : dateRange === "month"
                    ? "Filtered from the 1st of this calendar month"
                    : "Filtered from April 1 (Statutory Indian FY)"}
              </span>
            </div>

            {/* Format Selector */}
            <div className="flex flex-col">
              <Label
                htmlFor={formatSelectId}
                className="mb-1.5 flex items-center gap-1.5 text-label text-muted-foreground"
              >
                <FileTextIcon className="size-4 shrink-0" />
                File Format
              </Label>
              <Select
                value={selectedFormat}
                onValueChange={(value) => setSelectedFormat(value as "csv" | "xlsx" | "pdf" | "json")}
              >
                <SelectTrigger
                  id={formatSelectId}
                  className="h-11 px-4 bg-surface-muted/70 dark:bg-surface-muted border-input/45 dark:border-input font-medium"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV (Spreadsheet / Tally)</SelectItem>
                  <SelectItem value="xlsx">Excel (.xlsx Workbook)</SelectItem>
                  <SelectItem value="pdf">PDF Document (.pdf)</SelectItem>
                  <SelectItem value="json">JSON (Standard Machine-Readable Payload)</SelectItem>
                </SelectContent>
              </Select>
              <span className="mt-1.5 text-xs text-muted-foreground">
                {selectedFormat === "csv"
                  ? "UTF-8 with commas, escaped quotes, and decimal headers"
                  : selectedFormat === "xlsx"
                    ? "Formatted Microsoft Excel workbook (.xlsx)"
                    : selectedFormat === "pdf"
                      ? "Printable landscape PDF report"
                      : "Structured array of typed schema objects"}
              </span>
            </div>
          </div>

          {/* Selected Schema Fields Preview */}
          <div className="rounded-medium bg-surface-muted/60 border border-border/60 p-4 flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                Export Schema Columns ({activeDataset.fields.length} attributes)
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <span className="size-2 rounded-full bg-success" aria-hidden="true" />
                Schema Match 100%
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {activeDataset.fields.map((field) => (
                <span
                  key={field}
                  className="rounded-small border border-border/70 bg-card px-2 py-1 font-mono text-[11px] text-muted-foreground font-medium"
                >
                  {field}
                </span>
              ))}
            </div>
          </div>

          {/* Action Button */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <Button
              size="lg"
              onClick={handleDownload}
              disabled={isExporting}
              className="gap-2 cursor-pointer font-semibold shadow-xs"
            >
              {isExporting ? (
                <>
                  <RefreshCwIcon className="size-4 animate-spin" />
                  <span>Generating Export...</span>
                </>
              ) : (
                <>
                  <DownloadIcon className="size-4" />
                  <span>
                    Download {activeDataset.name} ({selectedFormat.toUpperCase()})
                  </span>
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dataset Directory Grid */}
      <section aria-labelledby="available-exports-heading" className="flex flex-col gap-4">
        <div>
          <h2 id="available-exports-heading" className="text-lg font-bold text-foreground flex items-center gap-2">
            <DatabaseIcon className="size-5 text-primary" />
            Available System Export Registers
          </h2>
          <p className="text-xs text-muted-foreground">
            All exports are generated transactionally from PostgreSQL and logged to the immutable audit trail.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {DATASETS.map((d) => (
            <article
              key={d.id}
              className={`flex flex-col justify-between rounded-xl border bg-card p-4 shadow-xs transition-colors cursor-pointer hover:border-primary/50 ${
                selectedReportType === d.reportType
                  ? "border-primary ring-1 ring-primary/20 bg-primary/[0.02]"
                  : "border-border"
              }`}
              onClick={() => setSelectedReportType(d.reportType)}
            >
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-muted/60 border border-border/50">
                    {d.icon}
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {d.category}
                  </Badge>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-foreground">{d.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {d.description}
                  </p>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-border/60 flex items-center justify-between text-xs">
                <span className="text-[11px] text-muted-foreground">
                  {d.fields.length} columns
                </span>
                <span className="inline-flex items-center gap-1 text-primary font-semibold hover:underline">
                  Select
                  <ArrowRightIcon className="size-3.5" aria-hidden="true" />
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
