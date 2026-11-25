import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
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
import {
  FileTextIcon,
  RefreshCwIcon,
  AlertTriangleIcon,
  FileCheck2Icon,
  PrinterIcon,
  IndianRupeeIcon,
} from "lucide-react";

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
  const [selectedInvoice, setSelectedInvoice] = useState<SalesInvoice | null>(
    null,
  );
  const [showCreditNoteModal, setShowCreditNoteModal] = useState(false);
  const [creditNoteReason, setCreditNoteReason] = useState("Damage allowance");
  const [creditNoteAmount, setCreditNoteAmount] = useState<number>(0);

  // Fetch invoices
  const { data, isLoading, isError, refetch, isFetching } = useQuery<{
    invoices: SalesInvoice[];
  }>({
    queryKey: ["sales-invoices"],
    queryFn: async () => {
      const res = await apiClient.get("/finance/invoices?organizationId=MILL");
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
      setShowCreditNoteModal(false);
      setSelectedInvoice(null);
    },
  });

  const invoices = data?.invoices ?? [];

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Invoices
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Tax calculation snapshots, FY series numbering, and immutable
            invoice ledger
          </p>
        </div>

        <div className="flex items-center gap-2">
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
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">
              Total invoices
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
              Total billed
            </span>
            <IndianRupeeIcon className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold">
            ₹
            {totalBilled.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </div>
          <div className="text-xs text-muted-foreground">
            Gross invoiced value inclusive of GST
          </div>
        </div>

        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">
              Total outstanding
            </span>
            <IndianRupeeIcon className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            ₹
            {totalOutstanding.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </div>
          <div className="text-xs text-muted-foreground">
            Awaiting payment settlement
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="rounded-xl border bg-card shadow-xs">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">
            Posted invoices ledger
          </h2>
          <span className="text-xs text-muted-foreground">
            {invoices.length} invoices found
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
            <RefreshCwIcon className="mr-2 h-4 w-4 animate-spin" />
            Loading invoices...
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-2 p-12 text-sm text-destructive">
            <AlertTriangleIcon className="h-6 w-6" />
            <span>Failed to load invoices</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12 text-center text-sm text-muted-foreground">
            <FileTextIcon className="h-8 w-8 stroke-1 text-muted-foreground/60" />
            <p>No invoices posted yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice number</TableHead>
                  <TableHead>FY</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Place of supply</TableHead>
                  <TableHead className="text-right">Taxable</TableHead>
                  <TableHead className="text-right">GST</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
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
                      ₹
                      {Number(inv.taxableAmount).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {Number(inv.igstAmount) > 0 ? (
                        <span>IGST: ₹{Number(inv.igstAmount).toFixed(2)}</span>
                      ) : (
                        <span>
                          CGST/SGST: ₹
                          {(
                            Number(inv.cgstAmount) + Number(inv.sgstAmount)
                          ).toFixed(2)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-bold text-foreground">
                      ₹
                      {Number(inv.totalAmount).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-amber-600 dark:text-amber-400">
                      ₹
                      {Number(inv.outstandingAmount).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedInvoice(inv)}
                          className="h-7 text-xs"
                        >
                          <PrinterIcon className="h-3.5 w-3.5 mr-1" />
                          View
                        </Button>
                        {Number(inv.outstandingAmount) > 0 && (
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
                            className="h-7 text-xs text-destructive hover:bg-destructive/10"
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
        )}
      </div>

      {/* Invoice Snapshot Modal */}
      {selectedInvoice && !showCreditNoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-card p-6 shadow-xl border">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <span className="text-xs font-mono uppercase text-muted-foreground">
                  Tax Invoice
                </span>
                <h3 className="text-xl font-bold text-foreground">
                  {selectedInvoice.invoiceNumber}
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedInvoice(null)}
              >
                ✕
              </Button>
            </div>

            <div className="mt-4 flex flex-col gap-6 text-sm">
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
                      <TableHead>Item description</TableHead>
                      <TableHead>HSN</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Taxable</TableHead>
                      <TableHead className="text-right">Tax</TableHead>
                      <TableHead className="text-right">Total</TableHead>
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
                          ₹{Number(l.unitPrice).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          ₹{Number(l.taxableAmount).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          ₹{Number(l.taxAmount).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          ₹{Number(l.lineTotal).toFixed(2)}
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
                      ₹{Number(selectedInvoice.taxableAmount).toFixed(2)}
                    </span>
                  </div>
                  {Number(selectedInvoice.cgstAmount) > 0 && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          CGST (2.5%):
                        </span>
                        <span className="font-semibold">
                          ₹{Number(selectedInvoice.cgstAmount).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          SGST (2.5%):
                        </span>
                        <span className="font-semibold">
                          ₹{Number(selectedInvoice.sgstAmount).toFixed(2)}
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
                        ₹{Number(selectedInvoice.igstAmount).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-1 font-bold text-sm">
                    <span>Invoice total:</span>
                    <span className="text-foreground">
                      ₹{Number(selectedInvoice.totalAmount).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-amber-600 font-semibold">
                    <span>Outstanding:</span>
                    <span>
                      ₹{Number(selectedInvoice.outstandingAmount).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedInvoice(null)}
              >
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => window.print()}
                className="gap-2"
              >
                <PrinterIcon className="h-4 w-4" />
                Print / Save PDF
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Credit Note Modal */}
      {showCreditNoteModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl border">
            <h3 className="text-lg font-bold text-foreground">
              Issue credit note
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Adjust invoice {selectedInvoice.invoiceNumber} without deleting
              the immutable record.
            </p>

            <div className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Reason for credit note
                </label>
                <input
                  type="text"
                  value={creditNoteReason}
                  onChange={(e) => setCreditNoteReason(e.target.value)}
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Adjustment amount (₹)
                </label>
                <input
                  type="number"
                  value={creditNoteAmount}
                  onChange={(e) => setCreditNoteAmount(Number(e.target.value))}
                  className="rounded-md border bg-background px-3 py-2 text-sm font-semibold"
                />
                <span className="text-xs text-muted-foreground">
                  Maximum adjustable: ₹
                  {Number(selectedInvoice.outstandingAmount).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t pt-4">
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
                onClick={() =>
                  creditNoteMutation.mutate({
                    invoiceId: selectedInvoice.id,
                    reason: creditNoteReason,
                    totalAmount: creditNoteAmount,
                  })
                }
                disabled={creditNoteMutation.isPending}
                className="gap-2"
              >
                {creditNoteMutation.isPending ? (
                  <>
                    <RefreshCwIcon className="h-4 w-4 animate-spin" />
                    Issuing...
                  </>
                ) : (
                  <>
                    <FileCheck2Icon className="h-4 w-4" />
                    Issue credit note
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
