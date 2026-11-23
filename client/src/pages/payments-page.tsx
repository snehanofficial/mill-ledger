import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/use-current-user";
import { apiClient } from "@/lib/api-client";
import { formatDate, formatINR } from "@/lib/formatters";
import { useLanguage } from "@/lib/i18n";
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
  XIcon,
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
  const [activeTab, setActiveTab] = useState<"ledger" | "receivables">(
    "ledger",
  );

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

  // 1. Fetch payments
  const {
    data: paymentsData,
    isLoading: loadingPayments,
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
      setShowPaymentModal(false);
      setSelectedCustomerId("");
      setPaymentAmount("");
      setReferenceNumber("");
      setNotes("");
      setManualAllocations({});
      setUseManualAllocation(false);
      setPaymentError(null);
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
    paymentMutation.mutate({
      customerId: selectedCustomerId,
      amount: amountNum,
      paymentMode,
      referenceNumber: referenceNumber.trim() || undefined,
      notes: notes.trim() || undefined,
      allocations: allocationsToSend,
    });
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Payments
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Customer collections, invoice payment allocations, and receivables
            ledger
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
            Refresh
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
              Record payment
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">
              Total collected
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
              Net outstanding
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
              Unallocated credit
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
          Payments ledger ({payments.length})
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
          Customer receivables ({receivables.length})
        </button>
      </div>

      {/* Tab 1: Payments Ledger */}
      {activeTab === "ledger" && (
        <div className="rounded-xl border bg-card shadow-xs">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-base font-semibold text-foreground">
              Collections ledger
            </h2>
            <span className="text-xs text-muted-foreground">
              {payments.length} transactions recorded
            </span>
          </div>

          {loadingPayments ? (
            <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
              <RefreshCwIcon className="mr-2 h-4 w-4 animate-spin" />
              Loading payments...
            </div>
          ) : payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-sm text-muted-foreground">
              <CreditCardIcon className="mb-3 h-8 w-8 text-muted-foreground/50" />
              <p className="font-medium text-foreground">
                No payments recorded
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Record receipts from customers to allocate against outstanding
                invoices.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
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
                  {payments.map((p) => (
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
          )}
        </div>
      )}

      {/* Tab 2: Customer Receivables */}
      {activeTab === "receivables" && (
        <div className="rounded-xl border bg-card shadow-xs">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-base font-semibold text-foreground">
              Customer receivables overview
            </h2>
            <span className="text-xs text-muted-foreground">
              {receivables.length} accounts found
            </span>
          </div>

          {loadingReceivables ? (
            <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
              <RefreshCwIcon className="mr-2 h-4 w-4 animate-spin" />
              Loading receivables...
            </div>
          ) : receivables.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-sm text-muted-foreground">
              <p className="font-medium text-foreground">No customer records</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
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
                  {receivables.map((r) => (
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
          )}
        </div>
      )}

      {/* Customer Detailed Ledger Modal */}
      {selectedCustomerIdForLedger && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2">
                <HistoryIcon className="h-5 w-5 text-foreground" />
                <h3 className="text-lg font-semibold text-foreground">
                  Customer statement and ledger
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCustomerIdForLedger(null)}
                className="h-8 w-8 p-0"
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>

            {loadingLedger || !customerLedger ? (
              <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
                <RefreshCwIcon className="mr-2 h-4 w-4 animate-spin" />
                Loading ledger entries...
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-6">
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
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2">
                <CreditCardIcon className="h-5 w-5 text-foreground" />
                <h3 className="text-lg font-semibold text-foreground">
                  Record customer payment
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPaymentModal(false)}
                className="h-8 w-8 p-0"
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>

            <form
              onSubmit={handleRecordPaymentSubmit}
              className="mt-4 flex flex-col gap-4"
            >
              {paymentError && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertTriangleIcon className="h-4 w-4 shrink-0" />
                  <span>{paymentError}</span>
                </div>
              )}

              {/* Customer selection */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Select customer *
                </label>
                <select
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
                  <label className="text-xs font-semibold text-foreground">
                    Receipt amount (₹) *
                  </label>
                  <Input
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
                  <label className="text-xs font-semibold text-foreground">
                    Payment mode *
                  </label>
                  <select
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
                  <label className="text-xs font-semibold text-foreground">
                    Reference number
                  </label>
                  <Input
                    placeholder="e.g. UTR or Cheque no"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Notes
                  </label>
                  <Input
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
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <input
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
                      <p className="text-xs text-muted-foreground">
                        Automatic FIFO mode: payment will settle oldest
                        outstanding invoices first.
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

              <div className="flex items-center justify-end gap-2 border-t pt-4">
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
                  {paymentMutation.isPending ? (
                    <RefreshCwIcon className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2Icon className="h-4 w-4" />
                  )}
                  Save payment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
