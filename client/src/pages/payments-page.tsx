import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/use-current-user";
import { apiClient } from "@/lib/api-client";
import { useUrlState } from "@/hooks/use-url-state";
import { formatDate, formatINR } from "@/lib/formatters";
import { useLanguage } from "@/lib/i18n";
import {
  SkeletonTable,
  ErrorState,
} from "@/components/ui/loading-error-empty";
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
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { DomainTooltip } from "@/components/ui/domain-tooltip";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CreditCardIcon,
  RefreshCwIcon,
  AlertTriangleIcon,
  PlusCircleIcon,
  IndianRupeeIcon,
  HistoryIcon,
  CheckCircle2Icon,
  UserCheckIcon,
  LayersIcon,
} from "lucide-react";

interface PaymentAllocation {
  id: string;
  amount: number;
  salesInvoice?: {
    id: string;
    invoiceNumber: string;
    totalAmount: number;
  };
}

interface Payment {
  id: string;
  paymentNumber: string;
  amount: number;
  unallocatedAmount: number;
  paymentMode: string;
  referenceNumber: string | null;
  paymentDate: string;
  status: string;
  notes: string | null;
  customer?: {
    id: string;
    code: string;
    name: string;
    city?: string;
    state: string;
  };
  allocations: PaymentAllocation[];
}

interface CustomerReceivable {
  customerId: string;
  customerCode: string;
  customerName: string;
  state: string;
  totalInvoiced: number;
  totalCreditNotes: number;
  totalPaid: number;
  netOutstanding: number;
  openInvoicesCount: number;
}

interface CustomerLedgerData {
  customer: {
    id: string;
    code: string;
    name: string;
    state: string;
    gstin: string | null;
  };
  summary: {
    totalInvoiced: number;
    totalCreditNotes: number;
    totalPaid: number;
    netOutstanding: number;
    ageing: {
      current0to30: number;
      days31to60: number;
      days61to90: number;
      over90days: number;
    };
  };
  ledgerEntries: Array<{
    date: string;
    documentType: "INVOICE" | "CREDIT_NOTE" | "PAYMENT";
    documentNumber: string;
    referenceId: string;
    debit: number;
    credit: number;
    balance: number;
    notes?: string | null;
  }>;
}

interface OpenInvoice {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  outstandingAmount: number;
  postedAt: string;
}

export function PaymentsPage() {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const { t } = useLanguage();
  const canRecordPayment = user?.role === "ADMIN";
  const [activeTab, setActiveTab] = useUrlState<"ledger" | "receivables">(
    "tab",
    "ledger",
    { replace: false },
  );
  const [searchQuery, setSearchQuery] = useUrlState("q", "");
  const [modeFilter, setModeFilter] = useUrlState("mode", "ALL");

  // Modals state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedCustomerIdForLedger, setSelectedCustomerIdForLedger] =
    useState<string | null>(null);

  // Payment form state
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("BANK_TRANSFER");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [manualAllocations, setManualAllocations] = useState<
    Record<string, string>
  >({});
  const [useManualAllocation, setUseManualAllocation] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [showConfirmPayment, setShowConfirmPayment] = useState(false);
  const [pendingPaymentPayload, setPendingPaymentPayload] = useState<{
    customerId: string;
    amount: number;
    paymentMode: string;
    referenceNumber?: string;
    notes?: string;
    allocations?: Array<{ salesInvoiceId: string; amount: number }>;
  } | null>(null);

  // 1. Fetch payments
  const {
    data: paymentsData,
    isLoading: loadingPayments,
    isError: errorPayments,
    error: paymentsError,
    refetch: refetchPayments,
    isFetching: fetchingPayments,
  } = useQuery<{ payments: Payment[] }>({
    queryKey: ["payments"],
    queryFn: async () => {
      const res = await apiClient.get("/payments?organizationId=MILL");
      return res.data;
    },
  });

  // 2. Fetch receivables summary
  const {
    data: receivablesData,
    isLoading: loadingReceivables,
    refetch: refetchReceivables,
  } = useQuery<{ receivables: CustomerReceivable[] }>({
    queryKey: ["receivables-summary"],
    queryFn: async () => {
      const res = await apiClient.get(
        "/payments/receivables/summary?organizationId=MILL",
      );
      return res.data;
    },
  });

  // 3. Fetch customer ledger when a customer is inspected
  const { data: customerLedger, isLoading: loadingLedger } =
    useQuery<CustomerLedgerData>({
      queryKey: ["customer-ledger", selectedCustomerIdForLedger],
      queryFn: async () => {
        const res = await apiClient.get(
          `/payments/ledger/${selectedCustomerIdForLedger}`,
        );
        return res.data;
      },
      enabled: !!selectedCustomerIdForLedger,
    });

  // 4. Fetch open invoices for selected customer in payment modal
  const { data: openInvoicesData } = useQuery<{ invoices: OpenInvoice[] }>({
    queryKey: ["customer-open-invoices", selectedCustomerId],
    queryFn: async () => {
      const res = await apiClient.get(
        `/finance/invoices?customerId=${selectedCustomerId}`,
      );
      const invs: OpenInvoice[] = (res.data.invoices || []).filter(
        (i: any) => Number(i.outstandingAmount) > 0,
      );
      return { invoices: invs };
    },
    enabled: !!selectedCustomerId && showPaymentModal,
  });

  // 5. Record payment mutation
  const paymentMutation = useMutation({
    mutationFn: async (payload: {
      customerId: string;
      amount: number;
      paymentMode: string;
      referenceNumber?: string;
      notes?: string;
      allocations?: Array<{ salesInvoiceId: string; amount: number }>;
    }) => {
      const res = await apiClient.post("/payments", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["receivables-summary"] });
      queryClient.invalidateQueries({ queryKey: ["sales-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["customer-ledger"] });
      setShowConfirmPayment(false);
      setShowPaymentModal(false);
      setPendingPaymentPayload(null);
      setSelectedCustomerId("");
      setPaymentAmount("");
      setReferenceNumber("");
      setNotes("");
      setManualAllocations({});
      setUseManualAllocation(false);
      setPaymentError(null);
      toast.success("Customer payment posted and allocated successfully");
    },
    onError: (err: any) => {
      setPaymentError(
        err.response?.data?.message ||
          err.message ||
          "Failed to record payment",
      );
    },
  });

  const payments = paymentsData?.payments ?? [];
  const receivables = receivablesData?.receivables ?? [];

  const filteredPayments = payments.filter((p) => {
    if (modeFilter !== "ALL" && p.paymentMode !== modeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchNum = p.paymentNumber.toLowerCase().includes(q);
      const matchCust = (p.customer?.name || "").toLowerCase().includes(q);
      const matchRef = (p.referenceNumber || "").toLowerCase().includes(q);
      if (!matchNum && !matchCust && !matchRef) return false;
    }
    return true;
  });

  const filteredReceivables = receivables.filter((r) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = (r.customerName || "").toLowerCase().includes(q);
      const matchCode = (r.customerCode || "").toLowerCase().includes(q);
      if (!matchName && !matchCode) return false;
    }
    return true;
  });

  // Summary calculations
  const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalUnallocated = payments.reduce(
    (sum, p) => sum + Number(p.unallocatedAmount),
    0,
  );
  const totalNetOutstanding = receivables.reduce(
    (sum, r) => sum + Number(r.netOutstanding),
    0,
  );

  const handleRecordPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(paymentAmount);
    if (!selectedCustomerId) {
      setPaymentError("Please select a customer");
      return;
    }
    if (isNaN(amountNum) || amountNum <= 0) {
      setPaymentError("Please enter a valid positive payment amount");
      return;
    }

    let allocationsToSend:
      Array<{ salesInvoiceId: string; amount: number }> | undefined = undefined;

    if (useManualAllocation) {
      const parsedAllocations: Array<{
        salesInvoiceId: string;
        amount: number;
      }> = [];
      let totalManual = 0;
      for (const [invId, valStr] of Object.entries(manualAllocations)) {
        const val = parseFloat(valStr);
        if (!isNaN(val) && val > 0) {
          parsedAllocations.push({ salesInvoiceId: invId, amount: val });
          totalManual += val;
        }
      }

      if (totalManual > amountNum) {
        setPaymentError(
          `Total manual allocations (₹${totalManual}) exceed payment amount (₹${amountNum})`,
        );
        return;
      }
      if (parsedAllocations.length > 0) {
        allocationsToSend = parsedAllocations;
      }
    }

    setPaymentError(null);
    setPendingPaymentPayload({
      customerId: selectedCustomerId,
      amount: amountNum,
      paymentMode,
      referenceNumber: referenceNumber.trim() || undefined,
      notes: notes.trim() || undefined,
      allocations: allocationsToSend,
    });
    setShowConfirmPayment(true);
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {t("Payments")}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("Customer collections, invoice payment allocations, and receivables ledger")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchPayments();
              refetchReceivables();
            }}
            disabled={fetchingPayments}
            className="gap-2"
          >
            <RefreshCwIcon
              className={`h-4 w-4 ${fetchingPayments ? "animate-spin" : ""}`}
            />
            {t("Refresh")}
          </Button>
          {canRecordPayment && (
            <Button
              size="sm"
              onClick={() => {
                setPaymentError(null);
                setShowPaymentModal(true);
              }}
              className="gap-2"
            >
              <PlusCircleIcon className="h-4 w-4" />
              {t("Record payment")}
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">
              {t("Total collected")}
            </span>
            <IndianRupeeIcon className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatINR(totalCollected)}
          </div>
          <div className="text-xs text-muted-foreground">
            Total receipts recorded across all modes
          </div>
        </div>

        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">
              {t("Net outstanding")}
            </span>
            <IndianRupeeIcon className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {formatINR(totalNetOutstanding)}
          </div>
          <div className="text-xs text-muted-foreground">
            Pending customer dues derived from ledger
          </div>
        </div>

        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">
              {t("Unallocated credit")}
            </span>
            <LayersIcon className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-primary">
            {formatINR(totalUnallocated)}
          </div>
          <div className="text-xs text-muted-foreground">
            Advance payments awaiting invoice allocation
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("ledger")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "ledger"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <CreditCardIcon className="h-4 w-4" />
          {t("Payments ledger")} ({payments.length})
        </button>
        <button
          onClick={() => setActiveTab("receivables")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === "receivables"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <UserCheckIcon className="h-4 w-4" />
          {t("Customer receivables")} ({receivables.length})
        </button>
      </div>

      {/* Tab 1: Payments Ledger */}
      {activeTab === "ledger" && (
        <div className="rounded-xl border bg-card shadow-xs">
          <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">
                {t("Collections ledger")}
              </h2>
              <span className="text-xs text-muted-foreground">
                ({filteredPayments.length} of {payments.length})
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder={t("Search payments...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-44 text-xs"
                aria-label="Search payments"
              />
              <select
                value={modeFilter}
                onChange={(e) => setModeFilter(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="Filter payments by mode"
              >
                <option value="ALL">All modes</option>
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="NEFT_RTGS">NEFT / RTGS</option>
                <option value="CHEQUE">Cheque</option>
                <option value="UPI">UPI</option>
                <option value="CASH">Cash</option>
              </select>
            </div>
          </div>

          {loadingPayments ? (
            <div className="p-4">
              <SkeletonTable rows={5} columns={8} />
            </div>
          ) : errorPayments ? (
            <div className="p-4">
              <ErrorState
                title={t("Failed to load payments", "Failed to load payments")}
                description={
                  paymentsError instanceof Error ? paymentsError.message : "Failed to load payments."
                }
                error={paymentsError}
                onRetry={() => refetchPayments()}
              />
            </div>
          ) : payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-sm text-muted-foreground">
              <CreditCardIcon className="mb-3 h-8 w-8 text-muted-foreground" />
              <p className="font-medium text-foreground">
                No payments recorded
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Record receipts from customers to allocate against outstanding
                invoices.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile Card Layout (<md viewports per F-047) */}
              <div
                className="divide-y divide-border md:hidden"
                data-slot="mobile-cards"
              >
                {filteredPayments.length === 0 && payments.length > 0 && (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    {t("No payments match the selected filters.")}
                  </div>
                )}
                {filteredPayments.map((p) => (
                  <div key={p.id} className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-semibold text-foreground">
                        {p.paymentNumber}
                      </span>
                      <Badge
                        variant={p.status === "POSTED" ? "success" : "default"}
                      >
                        {p.status}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-baseline text-xs">
                      <div>
                        <span className="font-medium text-foreground">
                          {p.customer?.name ?? "Customer"}
                        </span>
                        <span className="ml-1 font-mono text-2xs text-muted-foreground">
                          ({p.customer?.code})
                        </span>
                      </div>
                      <span className="text-muted-foreground font-mono text-2xs">
                        {formatDate(p.paymentDate)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-2.5 text-xs">
                      <div>
                        <span className="text-muted-foreground text-2xs uppercase">
                          Mode & Ref
                        </span>
                        <p className="font-medium text-foreground">
                          {p.paymentMode.replace(/_/g, " ")}
                          {p.referenceNumber && (
                            <span className="block font-mono text-2xs text-muted-foreground">
                              {p.referenceNumber}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-muted-foreground text-2xs uppercase">
                          Total Amount
                        </span>
                        <p className="font-bold text-foreground">
                          {formatINR(p.amount)}
                        </p>
                      </div>
                    </div>
                    {Number(p.unallocatedAmount) > 0 && (
                      <div className="flex justify-between items-center text-xs px-1">
                        <span className="text-muted-foreground">Unallocated:</span>
                        <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                          {formatINR(p.unallocatedAmount)}
                        </span>
                      </div>
                    )}
                    {p.allocations.length > 0 && (
                      <div className="text-2xs text-muted-foreground pt-1">
                        <span className="font-medium">Allocated: </span>
                        {p.allocations.map((a) => (
                          <span
                            key={a.id}
                            className="font-mono text-emerald-600 dark:text-emerald-400 mr-2"
                          >
                            {a.salesInvoice?.invoiceNumber}: {formatINR(a.amount)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop Table View (md+ viewports) */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Receipt number")}</TableHead>
                    <TableHead>{t("Date")}</TableHead>
                    <TableHead>{t("Customer")}</TableHead>
                    <TableHead>{t("Mode and reference")}</TableHead>
                    <TableHead className="text-right">{t("Total amount")}</TableHead>
                    <TableHead className="text-right">{t("Unallocated")}</TableHead>
                    <TableHead>{t("Allocated invoices")}</TableHead>
                    <TableHead className="text-right">{t("Status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.length === 0 && payments.length > 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        {t("No payments match the selected filters.")}
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredPayments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-sm font-semibold text-foreground">
                        {p.paymentNumber}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(p.paymentDate)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {p.customer?.name ?? "Customer"}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {p.customer?.code}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-xs">
                          <span className="font-medium">
                            {p.paymentMode.replace(/_/g, " ")}
                          </span>
                          {p.referenceNumber && (
                            <span className="font-mono text-muted-foreground">
                              Ref: {p.referenceNumber}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {formatINR(p.amount)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {Number(p.unallocatedAmount) > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400">
                            {formatINR(p.unallocatedAmount)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">₹0.00</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 text-xs">
                          {p.allocations.length === 0 ? (
                            <span className="italic text-muted-foreground">
                              Unallocated advance
                            </span>
                          ) : (
                            p.allocations.map((a) => (
                              <div
                                key={a.id}
                                className="flex items-center gap-1 font-mono text-emerald-600 dark:text-emerald-400"
                              >
                                <span>
                                  {a.salesInvoice?.invoiceNumber || "Invoice"}:
                                </span>
                                <span>{formatINR(a.amount)}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={
                            p.status === "POSTED" ? "success" : "default"
                          }
                        >
                          {p.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
        </div>
      )}

      {/* Tab 2: Customer Receivables */}
      {activeTab === "receivables" && (
        <div className="rounded-xl border bg-card shadow-xs">
          <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">
                {t("Customer receivables overview")}
              </h2>
              <span className="text-xs text-muted-foreground">
                ({filteredReceivables.length} of {receivables.length})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Input
                placeholder={t("Search customer receivables...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-56 text-xs"
                aria-label="Search customer receivables"
              />
            </div>
          </div>

          {loadingReceivables ? (
            <div className="p-4">
              <SkeletonTable rows={5} columns={8} />
            </div>
          ) : receivables.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-sm text-muted-foreground">
              <p className="font-medium text-foreground">No customer records</p>
            </div>
          ) : (
            <>
              {/* Mobile Card Layout (<md viewports per F-047) */}
              <div
                className="divide-y divide-border md:hidden"
                data-slot="mobile-cards"
              >
                {filteredReceivables.length === 0 && receivables.length > 0 && (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    {t("No customer receivables match the search query.")}
                  </div>
                )}
                {filteredReceivables.map((r) => (
                  <div key={r.customerId} className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-foreground">{r.customerName}</p>
                        <span className="font-mono text-2xs text-muted-foreground">
                          {r.customerCode} ({r.state})
                        </span>
                      </div>
                      <Badge
                        variant={r.openInvoicesCount > 0 ? "warning" : "secondary"}
                      >
                        {r.openInvoicesCount} open
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-2.5 text-xs">
                      <div>
                        <span className="text-muted-foreground text-2xs uppercase">
                          Invoiced
                        </span>
                        <p className="font-mono font-medium">
                          {formatINR(r.totalInvoiced)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-muted-foreground text-2xs uppercase">
                          Collections
                        </span>
                        <p className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                          {formatINR(r.totalPaid)}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-2xs uppercase">
                          Credit Notes
                        </span>
                        <p className="font-mono font-medium text-muted-foreground">
                          {formatINR(r.totalCreditNotes)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-muted-foreground text-2xs uppercase">
                          Outstanding
                        </span>
                        <p
                          className={`font-mono font-bold ${
                            r.netOutstanding > 0
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {formatINR(r.netOutstanding)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-end pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setSelectedCustomerIdForLedger(r.customerId)
                        }
                        className="min-h-[44px] w-full gap-1.5 text-xs justify-center"
                      >
                        <HistoryIcon className="h-4 w-4" />
                        View ledger
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View (md+ viewports) */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Customer")}</TableHead>
                    <TableHead>{t("State")}</TableHead>
                    <TableHead className="text-right">{t("Total invoiced")}</TableHead>
                    <TableHead className="text-right">{t("Credit notes")}</TableHead>
                    <TableHead className="text-right">
                      {t("Total collections")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("Net outstanding")}
                    </TableHead>
                    <TableHead className="text-center">{t("Open invoices")}</TableHead>
                    <TableHead className="text-right">{t("Actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReceivables.length === 0 && receivables.length > 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        {t("No customer receivables match the search query.")}
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredReceivables.map((r) => (
                    <TableRow key={r.customerId}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">
                            {r.customerName}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {r.customerCode}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.state}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatINR(r.totalInvoiced)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {formatINR(r.totalCreditNotes)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">
                        {formatINR(r.totalPaid)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {r.netOutstanding > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400">
                            {formatINR(r.netOutstanding)}
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            ₹0.00
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs">
                        {r.openInvoicesCount}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setSelectedCustomerIdForLedger(r.customerId)
                          }
                          className="h-8 gap-1.5 text-xs"
                        >
                          <HistoryIcon className="h-3.5 w-3.5" />
                          View ledger
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
        </div>
      )}

      {/* Customer Detailed Ledger Modal */}
      <Dialog
        open={selectedCustomerIdForLedger !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedCustomerIdForLedger(null);
        }}
      >
        {selectedCustomerIdForLedger && (
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <HistoryIcon className="h-5 w-5 text-foreground" />
                <DialogTitle>Customer statement and ledger</DialogTitle>
              </div>
              <DialogDescription className="sr-only">
                Statement and transaction history for customer
              </DialogDescription>
            </DialogHeader>

            {loadingLedger || !customerLedger ? (
              <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
                <RefreshCwIcon className="mr-2 h-4 w-4 animate-spin" />
                Loading ledger entries...
              </div>
            ) : (
              <div className="mt-2 flex flex-col gap-6">
                {/* Account details and ageing cards */}
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                      <h4 className="text-base font-bold text-foreground">
                        {customerLedger.customer.name}
                      </h4>
                      <p className="font-mono text-xs text-muted-foreground">
                        Code: {customerLedger.customer.code} | State:{" "}
                        {customerLedger.customer.state}
                        {customerLedger.customer.gstin
                          ? ` | GSTIN: ${customerLedger.customer.gstin}`
                          : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">
                        Current balance
                      </div>
                      <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                        {formatINR(customerLedger.summary.netOutstanding)}
                      </div>
                    </div>
                  </div>

                  {/* Ageing breakdown */}
                  <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-3 sm:grid-cols-4">
                    <div className="rounded-md border bg-card p-2 text-center">
                      <div className="text-[10px] uppercase text-muted-foreground">
                        0 to 30 days
                      </div>
                      <div className="font-mono text-xs font-semibold">
                        {formatINR(customerLedger.summary.ageing.current0to30)}
                      </div>
                    </div>
                    <div className="rounded-md border bg-card p-2 text-center">
                      <div className="text-[10px] uppercase text-muted-foreground">
                        31 to 60 days
                      </div>
                      <div className="font-mono text-xs font-semibold">
                        {formatINR(customerLedger.summary.ageing.days31to60)}
                      </div>
                    </div>
                    <div className="rounded-md border bg-card p-2 text-center">
                      <div className="text-[10px] uppercase text-muted-foreground">
                        61 to 90 days
                      </div>
                      <div className="font-mono text-xs font-semibold">
                        {formatINR(customerLedger.summary.ageing.days61to90)}
                      </div>
                    </div>
                    <div className="rounded-md border bg-card p-2 text-center">
                      <div className="text-[10px] uppercase text-muted-foreground">
                        Over 90 days
                      </div>
                      <div className="font-mono text-xs font-semibold">
                        {formatINR(customerLedger.summary.ageing.over90days)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ledger chronological transactions */}
                <div className="rounded-lg border">
                  <div className="border-b bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-foreground">
                    Chronological ledger entries
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("Date")}</TableHead>
                          <TableHead>{t("Type")}</TableHead>
                          <TableHead>{t("Reference number")}</TableHead>
                          <TableHead className="text-right">
                            {t("Debit (+)")}
                          </TableHead>
                          <TableHead className="text-right">
                            {t("Credit (-)")}
                          </TableHead>
                          <TableHead className="text-right">{t("Balance")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customerLedger.ledgerEntries.map((entry, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatDate(entry.date)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  entry.documentType === "INVOICE"
                                    ? "outline"
                                    : entry.documentType === "PAYMENT"
                                      ? "success"
                                      : "default"
                                }
                                className="font-mono text-[10px]"
                              >
                                {entry.documentType}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-xs font-medium">
                              {entry.documentNumber}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {entry.debit > 0
                                ? formatINR(entry.debit)
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">
                              {entry.credit > 0
                                ? formatINR(entry.credit)
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-bold">
                              {formatINR(entry.balance)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        )}
      </Dialog>

      {/* Record Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <CreditCardIcon className="h-5 w-5 text-foreground" />
              <DialogTitle>Record customer payment</DialogTitle>
            </div>
            <DialogDescription className="sr-only">
              Record receipt of customer payment and allocate against outstanding invoices
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handleRecordPaymentSubmit}
            className="mt-2 flex flex-col gap-4"
          >
              {paymentError && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertTriangleIcon className="h-4 w-4 shrink-0" />
                  <span>{paymentError}</span>
                </div>
              )}

              {/* Customer selection */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="payment-customer-select"
                  className="text-xs font-semibold text-foreground"
                >
                  Select customer *
                </label>
                <select
                  id="payment-customer-select"
                  value={selectedCustomerId}
                  onChange={(e) => {
                    setSelectedCustomerId(e.target.value);
                    setManualAllocations({});
                  }}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
                  required
                >
                  <option value="">Choose customer...</option>
                  {receivables.map((cust) => (
                    <option key={cust.customerId} value={cust.customerId}>
                      {cust.customerName} ({cust.customerCode}) | Outstanding:{" "}
                      {formatINR(cust.netOutstanding)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount and Payment Mode */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="payment-amount-input"
                    className="text-xs font-semibold text-foreground"
                  >
                    Receipt amount (₹) *
                  </label>
                  <Input
                    id="payment-amount-input"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="e.g. 4000.00"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="font-mono text-sm"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="payment-mode-select"
                    className="text-xs font-semibold text-foreground"
                  >
                    Payment mode *
                  </label>
                  <select
                    id="payment-mode-select"
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
                  >
                    <option value="BANK_TRANSFER">
                      Bank transfer / NEFT / RTGS
                    </option>
                    <option value="UPI">UPI</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="CASH">Cash</option>
                    <option value="DEMAND_DRAFT">Demand draft</option>
                  </select>
                </div>
              </div>

              {/* Reference and Notes */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="payment-reference-input"
                    className="text-xs font-semibold text-foreground"
                  >
                    Reference number
                  </label>
                  <Input
                    id="payment-reference-input"
                    placeholder="e.g. UTR or Cheque no"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="payment-notes-input"
                    className="text-xs font-semibold text-foreground"
                  >
                    Notes
                  </label>
                  <Input
                    id="payment-notes-input"
                    placeholder="e.g. On account settlement"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>

              {/* Allocation Mode Toggle */}
              {selectedCustomerId &&
                (openInvoicesData?.invoices || []).length > 0 && (
                  <div className="flex flex-col gap-2 rounded-lg border bg-muted/20 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">
                        Invoice allocation strategy
                      </span>
                      <label
                        htmlFor="payment-custom-allocation-toggle"
                        className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer"
                      >
                        <input
                          id="payment-custom-allocation-toggle"
                          type="checkbox"
                          checked={useManualAllocation}
                          onChange={(e) =>
                            setUseManualAllocation(e.target.checked)
                          }
                          className="rounded border-border"
                        />
                        Custom allocation
                      </label>
                    </div>

                    {!useManualAllocation ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                        <DomainTooltip term="FIFO">
                          <span className="font-medium text-foreground">
                            Automatic FIFO mode
                          </span>
                        </DomainTooltip>
                        <span>
                          : payment will settle oldest outstanding invoices
                          first.
                        </span>
                      </p>
                    ) : (
                      <div className="mt-2 flex flex-col gap-2">
                        <span className="text-[11px] text-muted-foreground">
                          Specify exact allocation amount per open invoice:
                        </span>
                        {openInvoicesData?.invoices.map((inv) => (
                          <div
                            key={inv.id}
                            className="flex items-center justify-between gap-2 rounded border bg-card p-2 text-xs"
                          >
                            <div className="flex flex-col">
                              <span className="font-mono font-medium">
                                {inv.invoiceNumber}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                Outstanding:{" "}
                                {formatINR(inv.outstandingAmount)}
                              </span>
                            </div>
                            <Input
                              id={`allocation-${inv.id}`}
                              aria-label={`Allocation amount for invoice ${inv.invoiceNumber}`}
                              type="number"
                              step="0.01"
                              placeholder="₹"
                              value={manualAllocations[inv.id] || ""}
                              onChange={(e) =>
                                setManualAllocations({
                                  ...manualAllocations,
                                  [inv.id]: e.target.value,
                                })
                              }
                              className="h-8 w-28 font-mono text-xs"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              <DialogFooter className="border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPaymentModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={paymentMutation.isPending || !selectedCustomerId}
                  className="gap-2"
                >
                  <CheckCircle2Icon className="h-4 w-4" />
                  Review & confirm
                </Button>
              </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>

      {/* Payment Irreversible Financial Action Confirmation (F-058) */}
      {pendingPaymentPayload && (
        <ConfirmationDialog
          open={showConfirmPayment}
          onOpenChange={setShowConfirmPayment}
          title={
            <div className="flex items-center gap-2 font-semibold">
              <CreditCardIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <span>Confirm Customer Payment Posting</span>
            </div>
          }
          description={
            <div className="flex flex-col gap-3 text-left">
              <p className="text-sm text-foreground">
                You are about to post a permanent payment receipt into the accounting ledger.
              </p>
              <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer:</span>
                  <span className="font-semibold text-foreground">
                    {receivables.find((r) => r.customerId === pendingPaymentPayload.customerId)?.customerName ?? "Customer"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Amount:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {formatINR(pendingPaymentPayload.amount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Mode:</span>
                  <span className="font-medium text-foreground">{pendingPaymentPayload.paymentMode}</span>
                </div>
                {pendingPaymentPayload.referenceNumber && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reference / Cheque #:</span>
                    <span className="font-mono">{pendingPaymentPayload.referenceNumber}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Allocation Strategy:</span>
                  <span className="font-medium text-foreground">
                    {pendingPaymentPayload.allocations && pendingPaymentPayload.allocations.length > 0
                      ? `Manual: ${pendingPaymentPayload.allocations.length} invoice(s) allocated`
                      : "Automatic FIFO allocation across open invoices"}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Financial notice: This entry will immediately settle outstanding customer receivables and update cash/bank ledgers. This transaction cannot be deleted.
              </p>
            </div>
          }
          confirmLabel={paymentMutation.isPending ? "Posting..." : "Confirm & Post Payment"}
          cancelLabel="Back to Edit"
          disabled={paymentMutation.isPending}
          onConfirm={() => {
            if (pendingPaymentPayload) {
              paymentMutation.mutate(pendingPaymentPayload);
            }
          }}
        />
      )}
    </div>
  );
}
