import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/use-current-user";
import { apiClient } from "@/lib/api-client";
import { BACKEND_URL } from "@/lib/env";
import { useUrlState } from "@/hooks/use-url-state";
import { formatINR } from "@/lib/formatters";
import { useLanguage } from "@/lib/i18n";
import { EmptyState, SkeletonTable, ErrorState } from "@/components/ui/loading-error-empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  FileTextIcon,
  RefreshCwIcon,
  FileCheck2Icon,
  PrinterIcon,
  DownloadIcon,
  Share2Icon,
  CopyIcon,
  IndianRupeeIcon,
  PlusCircleIcon,
  AlertTriangleIcon,
} from "lucide-react";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

interface SalesInvoiceLine {
  id: string;
  productNameSnapshot: string;
  hsnCodeSnapshot: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  taxAmount: number;
  lineTotal: number;
}

interface SalesInvoice {
  id: string;
  invoiceNumber: string;
  financialYear: string;
  customerNameSnapshot: string;
  customerGstinSnapshot: string | null;
  deliveryStateSnapshot: string;
  companyGstinSnapshot: string;
  status:
    "DRAFT" | "POSTED" | "CANCELLED_BY_CREDIT_NOTE" | "PAID" | "PARTIALLY_PAID";
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTaxAmount: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  notes: string | null;
  postedAt: string;
  customer: {
    code: string;
    name: string;
    state: string;
  };
  lines: SalesInvoiceLine[];
}

export function InvoicesPage() {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const { t } = useLanguage();
  const canIssueCreditNote = user?.role === "ADMIN";
  const canCreateInvoice = user?.role === "ADMIN";
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(
    null,
  );
  const [showCreditNoteModal, setShowCreditNoteModal] = useState(false);
  const [creditNoteReason, setCreditNoteReason] = useState("Damage allowance");
  const [creditNoteAmount, setCreditNoteAmount] = useState<number>(0);
  const [showCreateInvoiceModal, setShowCreateInvoiceModal] = useState(false);
  const [showConfirmCreditNote, setShowConfirmCreditNote] = useState(false);
  const [showConfirmCreateInvoice, setShowConfirmCreateInvoice] =
    useState(false);
  const [selectedOrderIdForInvoice, setSelectedOrderIdForInvoice] =
    useState<string>("");
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [statusFilter, setStatusFilter] = useUrlState("status", "ALL");
  const [searchQuery, setSearchQuery] = useUrlState("q", "", {
    debounceMs: 250,
  });
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Fetch approved orders eligible for invoicing (F-037)
  const { data: approvedOrdersData, isLoading: isLoadingApprovedOrders } =
    useQuery<{
      orders: Array<{
        id: string;
        orderNumber: string;
        status: string;
        totalAmount: number;
        customer: { name: string; code: string };
        invoices?: Array<{ id: string; invoiceNumber: string }>;
      }>;
    }>({
      queryKey: ["approved-orders-for-invoice"],
      queryFn: async () => {
        const res = await apiClient.get("/sales/orders?status=APPROVED");
        return res.data;
      },
      enabled: canCreateInvoice && showCreateInvoiceModal,
    });

  const eligibleOrders =
    approvedOrdersData?.orders?.filter(
      (o) => !o.invoices || o.invoices.length === 0,
    ) ?? [];

  // Create invoice mutation (F-037)
  const createInvoiceMutation = useMutation({
    mutationFn: async ({
      salesOrderId,
      notes,
    }: {
      salesOrderId: string;
      notes?: string;
    }) => {
      const res = await apiClient.post("/finance/invoices", {
        salesOrderId,
        notes: notes || undefined,
      });
      return res.data;
    },
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ["sales-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      queryClient.invalidateQueries({
        queryKey: ["approved-orders-for-invoice"],
      });
      setShowConfirmCreateInvoice(false);
      setShowCreateInvoiceModal(false);
      setSelectedOrderIdForInvoice("");
      setInvoiceNotes("");
      toast.success(
        `Invoice ${invoice.invoiceNumber ?? ""} posted successfully`,
      );
    },
    onError: (err: any) => {
      toast.error(
        err.response?.data?.message ||
          err.message ||
          "Failed to create invoice",
      );
    },
  });

  // Fetch invoices (paginated - F-074)
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{
    invoices: SalesInvoice[];
    pagination?: { limit: number; offset: number; count: number };
  }>({
    queryKey: ["sales-invoices", page],
    queryFn: async () => {
      const res = await apiClient.get(
        `/finance/invoices?limit=${pageSize}&offset=${(page - 1) * pageSize}`,
      );
      return res.data;
    },
  });

  // Credit note mutation
  const creditNoteMutation = useMutation({
    mutationFn: async ({
      invoiceId,
      reason,
      totalAmount,
    }: {
      invoiceId: string;
      reason: string;
      totalAmount: number;
    }) => {
      const res = await apiClient.post(
        `/finance/invoices/${invoiceId}/credit-note`,
        {
          reason,
          totalAmount: totalAmount > 0 ? totalAmount : undefined,
        },
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-invoices"] });
      setShowConfirmCreditNote(false);
      setShowCreditNoteModal(false);
      setSelectedInvoice(null);
      toast.success("GST credit note posted successfully");
    },
    onError: (err: any) => {
      toast.error(
        err.response?.data?.message ||
          err.message ||
          "Failed to issue credit note",
      );
    },
  });

  const invoices = data?.invoices ?? [];

  const filteredInvoices = invoices.filter((inv) => {
    if (statusFilter !== "ALL" && inv.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchNum = inv.invoiceNumber.toLowerCase().includes(q);
      const matchCust =
        inv.customerNameSnapshot.toLowerCase().includes(q) ||
        (inv.customerGstinSnapshot || "").toLowerCase().includes(q);
      const matchPos = (inv.deliveryStateSnapshot || inv.customer?.state || "")
        .toLowerCase()
        .includes(q);
      if (!matchNum && !matchCust && !matchPos) return false;
    }
    return true;
  });

  // Summary counts
  const totalInvoices = invoices.length;
  const totalBilled = invoices.reduce(
    (sum, inv) => sum + Number(inv.totalAmount),
    0,
  );
  const totalOutstanding = invoices.reduce(
    (sum, inv) => sum + Number(inv.outstandingAmount),
    0,
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {t("Invoices")}
            </h1>
          </div>
          <p className="max-w-[60ch] text-sm text-muted-foreground">
            {t(
              "Tax calculation snapshots, FY series numbering, and immutable invoice ledger",
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canCreateInvoice && (
            <Button
              size="sm"
              onClick={() => setShowCreateInvoiceModal(true)}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <PlusCircleIcon className="h-4 w-4" />
              {t("Generate Invoice")}
            </Button>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">
              {t("Total invoices")}
            </span>
            <FileTextIcon className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold">{totalInvoices}</div>
          <div className="text-xs text-muted-foreground">
            Posted tax invoices
          </div>
        </div>

        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">
              {t("Total billed")}
            </span>
            <IndianRupeeIcon className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold">{formatINR(totalBilled)}</div>
          <div className="text-xs text-muted-foreground">
            Gross invoiced value inclusive of GST
          </div>
        </div>

        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">
              {t("Total outstanding")}
            </span>
            <IndianRupeeIcon className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {formatINR(totalOutstanding)}
          </div>
          <div className="text-xs text-muted-foreground">
            Awaiting payment settlement
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="rounded-xl border bg-card shadow-xs">
        <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">
              {t("Posted invoices ledger")}
            </h2>
            <span className="text-xs text-muted-foreground">
              ({filteredInvoices.length} of {invoices.length})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder={t("Search invoices...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-44 text-xs"
              aria-label="Search invoices"
            />
            <Select
              value={statusFilter}
              onValueChange={setStatusFilter}
            >
              <SelectTrigger
                className="h-9 w-auto min-w-32 px-3 py-1 text-xs font-medium"
                aria-label="Filter invoices by status"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="POSTED">Posted</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
                <SelectItem value="PARTIAL">Partial</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="p-4">
            <SkeletonTable rows={6} columns={8} />
          </div>
        ) : isError ? (
          <div className="p-4">
            <ErrorState
              title={t("Failed to load invoices", "Failed to load invoices")}
              description={
                error instanceof Error
                  ? error.message
                  : "An unexpected server error occurred."
              }
              error={error}
              onRetry={() => refetch()}
            />
          </div>
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={FileTextIcon}
            title="No invoices posted yet"
            description="Generate a tax invoice from an approved or dispatched sales order."
            action={
              canCreateInvoice ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateInvoiceModal(true)}
                  className="gap-1.5"
                >
                  <PlusCircleIcon className="h-4 w-4" aria-hidden="true" />
                  Create Invoice
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* Mobile Card Layout (<md viewports per F-047) */}
            <div
              className="divide-y divide-border md:hidden"
              data-slot="mobile-cards"
            >
              {filteredInvoices.length === 0 && invoices.length > 0 && (
                <EmptyState
                  title={t("No invoices match the selected filters.")}
                  description="Clear the search or status filter to view all invoices."
                  action={
                    <Button
                      variant="tertiary"
                      size="sm"
                      onClick={() => {
                        setSearchQuery("");
                        setStatusFilter("ALL");
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              )}
              {filteredInvoices.map((inv) => (
                <div key={inv.id} className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-foreground">
                        {inv.invoiceNumber}
                      </span>
                      <span className="font-mono text-2xs text-muted-foreground">
                        ({inv.financialYear})
                      </span>
                    </div>
                    <Badge
                      variant={
                        inv.status === "PAID"
                          ? "success"
                          : inv.status === "POSTED"
                            ? "info"
                            : inv.status === "CANCELLED_BY_CREDIT_NOTE"
                              ? "danger"
                              : "warning"
                      }
                    >
                      {inv.status}
                    </Badge>
                  </div>

                  <div className="flex justify-between items-baseline text-xs">
                    <span className="font-medium text-foreground">
                      {inv.customerNameSnapshot}
                    </span>
                    <span className="text-muted-foreground font-mono text-2xs">
                      {inv.customerGstinSnapshot || "Unregistered"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-2.5 text-xs">
                    <div>
                      <span className="text-muted-foreground text-2xs uppercase">
                        Total Amount
                      </span>
                      <p className="font-bold text-foreground">
                        {formatINR(inv.totalAmount)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-muted-foreground text-2xs uppercase">
                        Outstanding
                      </span>
                      <p
                        className={
                          Number(inv.outstandingAmount) > 0
                            ? "font-bold text-amber-600 dark:text-amber-400"
                            : "font-medium text-emerald-600 dark:text-emerald-400"
                        }
                      >
                        {formatINR(inv.outstandingAmount)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedInvoice(inv)}
                      className="min-h-[44px] px-4 text-xs"
                    >
                      View Details
                    </Button>
                    {canIssueCreditNote && inv.status === "POSTED" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedInvoice(inv);
                          setCreditNoteAmount(Number(inv.outstandingAmount));
                          setShowCreditNoteModal(true);
                        }}
                        className="min-h-[44px] px-3 text-xs text-amber-600 hover:bg-amber-500/10"
                      >
                        Credit Note
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View (md+ viewports) */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Invoice number")}</TableHead>
                    <TableHead>{t("FY")}</TableHead>
                    <TableHead>{t("Status")}</TableHead>
                    <TableHead>{t("Customer")}</TableHead>
                    <TableHead>{t("Place of supply")}</TableHead>
                    <TableHead className="text-right">{t("Taxable")}</TableHead>
                    <TableHead className="text-right">{t("GST")}</TableHead>
                    <TableHead className="text-right">{t("Total")}</TableHead>
                    <TableHead className="text-right">
                      {t("Outstanding")}
                    </TableHead>
                    <TableHead className="text-right">{t("Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.length === 0 && invoices.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="p-0">
                        <EmptyState
                          title={t("No invoices match the selected filters.")}
                          description="Clear the search or status filter to view all invoices."
                          className="min-h-32 py-6"
                          action={
                            <Button
                              variant="tertiary"
                              size="sm"
                              onClick={() => {
                                setSearchQuery("");
                                setStatusFilter("ALL");
                              }}
                            >
                              Clear filters
                            </Button>
                          }
                        />
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredInvoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono font-medium">
                        {inv.invoiceNumber}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {inv.financialYear}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            inv.status === "PAID"
                              ? "success"
                              : inv.status === "POSTED"
                                ? "info"
                                : inv.status === "CANCELLED_BY_CREDIT_NOTE"
                                  ? "danger"
                                  : "warning"
                          }
                        >
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {inv.customerNameSnapshot}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {inv.deliveryStateSnapshot}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatINR(inv.taxableAmount)}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {Number(inv.igstAmount) > 0 ? (
                          <span>IGST: {formatINR(inv.igstAmount)}</span>
                        ) : (
                          <span>
                            CGST/SGST:{" "}
                            {formatINR(
                              Number(inv.cgstAmount) + Number(inv.sgstAmount),
                            )}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-bold text-foreground">
                        {formatINR(inv.totalAmount)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-amber-600 dark:text-amber-400">
                        {formatINR(inv.outstandingAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedInvoice(inv)}
                            className="h-8 min-h-[32px] px-2.5 text-xs sm:h-7 sm:min-h-[28px] sm:px-2"
                          >
                            <PrinterIcon className="h-3.5 w-3.5 mr-1" />
                            View
                          </Button>
                          {canIssueCreditNote &&
                            Number(inv.outstandingAmount) > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedInvoice(inv);
                                  setCreditNoteAmount(
                                    Number(inv.outstandingAmount),
                                  );
                                  setShowCreditNoteModal(true);
                                }}
                                className="h-8 min-h-[32px] px-2.5 text-xs text-destructive hover:bg-destructive/10 sm:h-7 sm:min-h-[28px] sm:px-2"
                              >
                                Credit note
                              </Button>
                            )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* Pagination controls (F-074) */}
            <div className="flex items-center justify-between border-t border-border px-4 py-3 sm:px-6">
              <div className="text-sm text-muted-foreground">
                {t("Page")}{" "}
                <span className="font-medium text-foreground">{page}</span>
                {data?.pagination ? ` (${data.invoices.length} items)` : ""}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || isFetching}
                >
                  {t("Previous")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={
                    !data?.invoices ||
                    data.invoices.length < pageSize ||
                    isFetching
                  }
                >
                  {t("Next")}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Invoice Snapshot Modal */}
      <Dialog
        open={selectedInvoice !== null && !showCreditNoteModal}
        onOpenChange={(open) => {
          if (!open) setSelectedInvoice(null);
        }}
      >
        {selectedInvoice && !showCreditNoteModal && (
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <span className="text-xs font-mono uppercase text-muted-foreground">
                Tax Invoice
              </span>
              <DialogTitle className="text-xl font-bold text-foreground">
                {selectedInvoice.invoiceNumber}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Tax invoice details for {selectedInvoice.invoiceNumber}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-2 flex flex-col gap-6 text-sm">
              {/* Header Parties */}
              <div className="grid grid-cols-2 gap-4 border-b pb-4">
                <div>
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                    Supplier (Billed by)
                  </h4>
                  <p className="font-bold text-foreground">Mill Ledger ERP</p>
                  <p className="text-xs text-muted-foreground">
                    Factory: Tamil Nadu
                  </p>
                  <p className="text-xs font-mono">
                    GSTIN: {selectedInvoice.companyGstinSnapshot}
                  </p>
                </div>

                <div>
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                    Customer (Billed to)
                  </h4>
                  <p className="font-bold text-foreground">
                    {selectedInvoice.customerNameSnapshot}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    State: {selectedInvoice.deliveryStateSnapshot}
                  </p>
                  <p className="text-xs font-mono">
                    GSTIN:{" "}
                    {selectedInvoice.customerGstinSnapshot || "Unregistered"}
                  </p>
                </div>
              </div>

              {/* Line items */}
              <div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("Item description")}</TableHead>
                      <TableHead>{t("HSN")}</TableHead>
                      <TableHead className="text-right">{t("Qty")}</TableHead>
                      <TableHead className="text-right">{t("Rate")}</TableHead>
                      <TableHead className="text-right">
                        {t("Taxable")}
                      </TableHead>
                      <TableHead className="text-right">{t("Tax")}</TableHead>
                      <TableHead className="text-right">{t("Total")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedInvoice.lines.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">
                          {l.productNameSnapshot}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {l.hsnCodeSnapshot}
                        </TableCell>
                        <TableCell className="text-right">
                          {Number(l.quantity)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatINR(l.unitPrice)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatINR(l.taxableAmount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatINR(l.taxAmount)}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {formatINR(l.lineTotal)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-64 flex flex-col gap-1.5 rounded-lg bg-muted/50 p-4 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Taxable value:
                    </span>
                    <span className="font-semibold">
                      {formatINR(selectedInvoice.taxableAmount)}
                    </span>
                  </div>
                  {Number(selectedInvoice.cgstAmount) > 0 && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          CGST (2.5%):
                        </span>
                        <span className="font-semibold">
                          {formatINR(selectedInvoice.cgstAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          SGST (2.5%):
                        </span>
                        <span className="font-semibold">
                          {formatINR(selectedInvoice.sgstAmount)}
                        </span>
                      </div>
                    </>
                  )}
                  {Number(selectedInvoice.igstAmount) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        IGST (5.0%):
                      </span>
                      <span className="font-semibold">
                        {formatINR(selectedInvoice.igstAmount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-1 font-bold text-sm">
                    <span>Invoice total:</span>
                    <span className="text-foreground">
                      {formatINR(selectedInvoice.totalAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between text-amber-600 font-semibold">
                    <span>Outstanding:</span>
                    <span>{formatINR(selectedInvoice.outstandingAmount)}</span>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-6 flex-wrap gap-2 border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedInvoice(null)}
              >
                Close
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const summary = `Invoice ${selectedInvoice.invoiceNumber} | ${selectedInvoice.customerNameSnapshot} | Total: ${formatINR(selectedInvoice.totalAmount)} | Outstanding: ${formatINR(selectedInvoice.outstandingAmount)} | PDF: ${BACKEND_URL}/api/v1/finance/invoices/${selectedInvoice.id}/pdf`;
                  try {
                    await navigator.clipboard.writeText(summary);
                    toast.success("Invoice summary & PDF link copied");
                  } catch {
                    toast.error("Could not copy to clipboard");
                  }
                }}
                className="gap-2"
              >
                <CopyIcon className="h-4 w-4" />
                Copy Link
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const text = encodeURIComponent(
                    `Tax Invoice ${selectedInvoice.invoiceNumber} for ${selectedInvoice.customerNameSnapshot}\nTotal: ${formatINR(selectedInvoice.totalAmount)}\nOutstanding: ${formatINR(selectedInvoice.outstandingAmount)}`,
                  );
                  window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
                }}
                className="gap-2"
              >
                <Share2Icon className="h-4 w-4" />
                WhatsApp
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="gap-2"
              >
                <PrinterIcon className="h-4 w-4" />
                Print
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    const res = await fetch(
                      `${BACKEND_URL}/api/v1/finance/invoices/${selectedInvoice.id}/pdf`,
                      { credentials: "include" },
                    );
                    if (!res.ok) {
                      throw new Error("Failed to download PDF");
                    }
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${selectedInvoice.invoiceNumber}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                    toast.success(`Downloaded ${selectedInvoice.invoiceNumber}.pdf`);
                  } catch {
                    toast.error("Failed to download invoice PDF");
                  }
                }}
                className="gap-2"
              >
                <DownloadIcon className="h-4 w-4" />
                Download PDF
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Credit Note Modal */}
      <Dialog
        open={showCreditNoteModal && selectedInvoice !== null}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreditNoteModal(false);
            setCreditNoteReason("");
          }
        }}
      >
        {showCreditNoteModal && selectedInvoice && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Issue credit note</DialogTitle>
              <DialogDescription>
                Adjust invoice {selectedInvoice.invoiceNumber} without deleting
                the immutable record.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-2 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="credit-note-reason"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  Reason for credit note
                </Label>
                <Input
                  id="credit-note-reason"
                  type="text"
                  value={creditNoteReason}
                  onChange={(e) => setCreditNoteReason(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="credit-note-amount"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  Adjustment amount (₹)
                </Label>
                <Input
                  id="credit-note-amount"
                  type="number"
                  value={creditNoteAmount}
                  onChange={(e) => setCreditNoteAmount(Number(e.target.value))}
                  className="font-semibold"
                />
                <span className="text-xs text-muted-foreground">
                  Maximum adjustable:{" "}
                  {formatINR(selectedInvoice.outstandingAmount)}
                </span>
              </div>
            </div>

            <DialogFooter className="mt-6 border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowCreditNoteModal(false);
                  setSelectedInvoice(null);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (creditNoteAmount <= 0) {
                    toast.error(
                      "Please enter a valid adjustment amount greater than zero",
                    );
                    return;
                  }
                  if (creditNoteAmount > selectedInvoice.outstandingAmount) {
                    toast.error(
                      `Adjustment amount cannot exceed outstanding amount (${formatINR(selectedInvoice.outstandingAmount)})`,
                    );
                    return;
                  }
                  setShowConfirmCreditNote(true);
                }}
                disabled={creditNoteMutation.isPending}
                className="gap-2"
              >
                <FileCheck2Icon className="h-4 w-4" />
                Review & confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Generate Invoice Modal (F-037) */}
      <Dialog
        open={showCreateInvoiceModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateInvoiceModal(false);
            setSelectedOrderIdForInvoice("");
            setInvoiceNotes("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate GST Sales Invoice</DialogTitle>
            <DialogDescription>
              Select an approved order to calculate statutory taxes and post an
              immutable sales invoice.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="invoice-order-select"
                className="text-xs font-semibold text-muted-foreground"
              >
                Approved Sales Order *
              </Label>
              {isLoadingApprovedOrders ? (
                <div className="py-2 text-xs text-muted-foreground">
                  Loading approved orders...
                </div>
              ) : eligibleOrders.length === 0 ? (
                <div className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                  No approved orders awaiting invoicing.
                </div>
              ) : (
                <Select
                  value={selectedOrderIdForInvoice || undefined}
                  onValueChange={setSelectedOrderIdForInvoice}
                >
                  <SelectTrigger
                    id="invoice-order-select"
                    className="font-medium"
                  >
                    <SelectValue placeholder="Select an approved order..." />
                  </SelectTrigger>
                  <SelectContent searchable searchPlaceholder="Search orders or customers...">
                    {eligibleOrders.map((ord) => (
                      <SelectItem key={ord.id} value={ord.id}>
                        {ord.orderNumber} · {ord.customer.name} (
                        {formatINR(ord.totalAmount)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="invoice-notes-input"
                className="text-xs font-semibold text-muted-foreground"
              >
                Invoice Notes (Optional)
              </Label>
              <Input
                id="invoice-notes-input"
                type="text"
                placeholder="e.g. Standard 30 days payment term"
                value={invoiceNotes}
                onChange={(e) => setInvoiceNotes(e.target.value)}
                className="font-medium"
              />
            </div>
          </div>

          <DialogFooter className="mt-6 border-t pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowCreateInvoiceModal(false);
                setSelectedOrderIdForInvoice("");
                setInvoiceNotes("");
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={
                !selectedOrderIdForInvoice || createInvoiceMutation.isPending
              }
              onClick={() => setShowConfirmCreateInvoice(true)}
              className="gap-2"
            >
              <FileCheck2Icon className="h-4 w-4" />
              Review & confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credit Note Irreversible Financial Action Confirmation (F-058) */}
      {selectedInvoice && (
        <ConfirmationDialog
          open={showConfirmCreditNote}
          onOpenChange={setShowConfirmCreditNote}
          title={
            <div className="flex items-center gap-2 text-destructive font-semibold">
              <AlertTriangleIcon className="h-5 w-5" />
              <span>Confirm GST Credit Note Issuance</span>
            </div>
          }
          description={
            <div className="flex flex-col gap-3 text-left">
              <p className="text-sm text-foreground">
                You are about to issue an immutable Credit Note against invoice{" "}
                <strong className="font-mono">
                  {selectedInvoice.invoiceNumber}
                </strong>
                .
              </p>
              <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-medium text-foreground">
                    {selectedInvoice.customer?.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Original Total:</span>
                  <span className="font-mono">
                    {formatINR(selectedInvoice.totalAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Outstanding Before:
                  </span>
                  <span className="font-mono">
                    {formatINR(selectedInvoice.outstandingAmount)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border/50 pt-1 font-semibold">
                  <span className="text-destructive">Credit Adjustment:</span>
                  <span className="font-mono text-destructive">
                    -{formatINR(creditNoteAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reason:</span>
                  <span className="italic">{creditNoteReason}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Statutory warning: Issuing this credit note permanently reduces
                legal GST tax liabilities and accounts receivable in the general
                ledger. This sequential document cannot be altered or deleted
                once committed.
              </p>
            </div>
          }
          confirmLabel={
            creditNoteMutation.isPending
              ? "Issuing..."
              : "Confirm & Post Credit Note"
          }
          cancelLabel="Back to Edit"
          destructive
          disabled={creditNoteMutation.isPending}
          onConfirm={() =>
            creditNoteMutation.mutate({
              invoiceId: selectedInvoice.id,
              reason: creditNoteReason,
              totalAmount: creditNoteAmount,
            })
          }
        />
      )}

      {/* Create Invoice Irreversible Financial Action Confirmation (F-058) */}
      {selectedOrderIdForInvoice && (
        <ConfirmationDialog
          open={showConfirmCreateInvoice}
          onOpenChange={setShowConfirmCreateInvoice}
          title={
            <div className="flex items-center gap-2 font-semibold">
              <FileCheck2Icon className="h-5 w-5 text-primary" />
              <span>Confirm GST Sales Invoice Generation</span>
            </div>
          }
          description={
            <div className="flex flex-col gap-3 text-left">
              <p className="text-sm text-foreground">
                You are about to generate and post a legal GST Sales Invoice for
                order{" "}
                <strong className="font-mono">
                  {
                    eligibleOrders.find(
                      (o) => o.id === selectedOrderIdForInvoice,
                    )?.orderNumber
                  }
                </strong>
                .
              </p>
              <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-medium text-foreground">
                    {
                      eligibleOrders.find(
                        (o) => o.id === selectedOrderIdForInvoice,
                      )?.customer?.name
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Total Taxable & Taxes:
                  </span>
                  <span className="font-mono font-semibold text-foreground">
                    {formatINR(
                      eligibleOrders.find(
                        (o) => o.id === selectedOrderIdForInvoice,
                      )?.totalAmount || 0,
                    )}
                  </span>
                </div>
                {invoiceNotes && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Invoice Notes:
                    </span>
                    <span className="italic">{invoiceNotes}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Financial warning: This posts an immutable sequential tax
                invoice to the ledger and books accounts receivable. Stock
                allocations will be permanently committed.
              </p>
            </div>
          }
          confirmLabel={
            createInvoiceMutation.isPending
              ? "Generating..."
              : "Confirm & Post Invoice"
          }
          cancelLabel="Back to Review"
          disabled={createInvoiceMutation.isPending}
          onConfirm={() =>
            createInvoiceMutation.mutate({
              salesOrderId: selectedOrderIdForInvoice,
              notes: invoiceNotes || undefined,
            })
          }
        />
      )}
    </div>
  );
}
