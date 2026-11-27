import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { assertEntityResponse } from "@/lib/api-contracts";
import { BACKEND_URL } from "@/lib/env";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatINR, formatQuantity, formatDateTime } from "@/lib/formatters";
import { RecordHeader } from "@/components/ui/page-header";
import { EntityLifecycleTimeline } from "@/components/timeline/entity-lifecycle-timeline";
import { ErrorState, SkeletonTable } from "@/components/ui/loading-error-empty";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CopyIcon,
  CreditCardIcon,
  DownloadIcon,
  RotateCcwIcon,
  Share2Icon,
  TruckIcon,
} from "lucide-react";
import { toast } from "sonner";

interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  financialYear: string;
  salesOrderId?: string;
  customerId?: string;
  customerNameSnapshot: string;
  customerGstinSnapshot: string | null;
  deliveryStateSnapshot: string;
  companyGstinSnapshot: string;
  status: "DRAFT" | "POSTED" | "CANCELLED_BY_CREDIT_NOTE" | "PAID" | "PARTIALLY_PAID";
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
  customer?: {
    id: string;
    code: string;
    name: string;
    state: string;
  };
  salesOrder?: {
    id: string;
    orderNumber: string;
    fulfilmentStatus: string;
  };
  lines: Array<{
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
  }>;
}

export function InvoiceDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const isAdmin = user?.role === "ADMIN";

  const [creditOpen, setCreditOpen] = useState(false);
  const [creditReason, setCreditReason] = useState("");
  const [creditAmount, setCreditAmount] = useState("");

  const { data: invoice, isLoading, isError, error, refetch } =
    useQuery<InvoiceDetail>({
      queryKey: ["sales-invoice", invoiceId],
      queryFn: async () => {
        const endpoint = `/finance/invoices/${invoiceId}`;
        const res = await apiClient.get(endpoint);
        return assertEntityResponse<InvoiceDetail & Record<string, unknown>>(
          res.data,
          "invoice",
          ["lines"],
          endpoint,
        );
      },
      enabled: Boolean(invoiceId),
    });

  const creditNoteMutation = useMutation({
    mutationFn: async () => {
      if (!invoice) return;
      const parsedAmount = Number(creditAmount);
      const res = await apiClient.post(`/finance/invoices/${invoice.id}/credit-note`, {
        reason: creditReason.trim(),
        totalAmount: parsedAmount > 0 ? parsedAmount : undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-invoice", invoiceId] });
      queryClient.invalidateQueries({ queryKey: ["sales-invoices"] });
      setCreditOpen(false);
      setCreditReason("");
      setCreditAmount("");
      toast.success("Credit note issued.");
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to issue credit note."));
    },
  });

  const handleDownloadPdf = async () => {
    if (!invoice) return;
    try {
      const response = await apiClient.get(`/finance/invoices/${invoice.id}/pdf`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${invoice.invoiceNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(extractErrorMessage(err, "Failed to download PDF."));
    }
  };

  const handleCopyLink = async () => {
    if (!invoice) return;
    const shareUrl = `${BACKEND_URL}/api/v1/finance/invoices/${invoice.id}/pdf`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Invoice PDF link copied.");
    } catch {
      toast.error("Unable to copy link.");
    }
  };

  const handleShareWhatsApp = () => {
    if (!invoice) return;
    const text = `Invoice ${invoice.invoiceNumber} for ${invoice.customerNameSnapshot}: Total ${formatINR(invoice.totalAmount)}, Outstanding ${formatINR(invoice.outstandingAmount)}.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <SkeletonTable rows={5} columns={5} />
      </div>
    );
  }

  if (isError || !invoice) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <ErrorState
          title="Unable to load invoice"
          description={extractErrorMessage(error)}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const canDispatch =
    isAdmin &&
    invoice.salesOrder &&
    invoice.salesOrder.fulfilmentStatus !== "FULFILLED" &&
    invoice.status !== "CANCELLED_BY_CREDIT_NOTE";
  const canRecordPayment =
    isAdmin &&
    Number(invoice.outstandingAmount) > 0 &&
    invoice.status !== "CANCELLED_BY_CREDIT_NOTE";
  const canCreditNote =
    isAdmin &&
    invoice.status !== "CANCELLED_BY_CREDIT_NOTE" &&
    invoice.status !== "DRAFT";

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-6xl">
      <RecordHeader
        backTo="/invoices"
        backLabel="Back to Invoices"
        reference={invoice.invoiceNumber}
        subtitle={`${invoice.customerNameSnapshot} • FY ${invoice.financialYear} • Posted ${formatDateTime(invoice.postedAt)}`}
        statuses={
          <>
            <Badge variant="outline">{invoice.status.replaceAll("_", " ")}</Badge>
            <Badge variant="outline">
              Outstanding: {formatINR(invoice.outstandingAmount)}
            </Badge>
          </>
        }
        primaryAction={
          canDispatch ? (
            <Button
              variant="primary"
              onClick={() => navigate(`/dispatch/new?orderId=${invoice.salesOrder!.id}`)}
              className="gap-1.5"
            >
              <TruckIcon className="size-4" aria-hidden="true" />
              Prepare dispatch
            </Button>
          ) : canRecordPayment ? (
            <Button
              variant="primary"
              onClick={() =>
                navigate(
                  `/payments/new?customerId=${invoice.customer?.id ?? invoice.customerId ?? ""}&invoiceId=${invoice.id}`,
                )
              }
              className="gap-1.5"
            >
              <CreditCardIcon className="size-4" aria-hidden="true" />
              Record payment
            </Button>
          ) : null
        }
        secondaryActions={
          <>
            <Button variant="outline" size="sm" onClick={handleDownloadPdf} className="gap-1.5">
              <DownloadIcon className="size-4" aria-hidden="true" />
              Download PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopyLink} className="gap-1.5">
              <CopyIcon className="size-4" aria-hidden="true" />
              Copy link
            </Button>
            <Button variant="outline" size="sm" onClick={handleShareWhatsApp} className="gap-1.5">
              <Share2Icon className="size-4" aria-hidden="true" />
              Share
            </Button>
            {canCreditNote && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreditOpen(true)}
                className="gap-1.5"
              >
                <RotateCcwIcon className="size-4" aria-hidden="true" />
                Issue credit note
              </Button>
            )}
          </>
        }
      />

      {/* Statutory Snapshot */}
      <div className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-card p-4 text-sm md:grid-cols-3">
        <div>
          <div className="text-xs text-muted-foreground">Billed to</div>
          <div className="font-medium">{invoice.customerNameSnapshot}</div>
          <div className="text-xs text-muted-foreground">
            GSTIN: {invoice.customerGstinSnapshot || "Unregistered"}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Place of supply</div>
          <div className="font-medium">{invoice.deliveryStateSnapshot}</div>
          <div className="text-xs text-muted-foreground">
            Supplier GSTIN: {invoice.companyGstinSnapshot}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Source order</div>
          {invoice.salesOrder ? (
            <Link
              to={`/orders/${invoice.salesOrder.id}`}
              className="font-medium text-primary hover:underline"
            >
              {invoice.salesOrder.orderNumber}
            </Link>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
          <div className="text-xs text-muted-foreground">
            Paid: {formatINR(invoice.paidAmount)} • Due: {formatINR(invoice.outstandingAmount)}
          </div>
        </div>
      </div>

      {/* Invoice Lines */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item & HSN</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Taxable</TableHead>
              <TableHead className="text-right">CGST</TableHead>
              <TableHead className="text-right">SGST</TableHead>
              <TableHead className="text-right">IGST</TableHead>
              <TableHead className="text-right">Line total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoice.lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell>
                  <div className="font-medium">{line.productNameSnapshot}</div>
                  <div className="text-xs text-muted-foreground">
                    HSN: {line.hsnCodeSnapshot}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatQuantity(line.quantity, { unit: "pkts" })}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatINR(line.unitPrice)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatINR(line.taxableAmount)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatINR(line.cgstAmount)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatINR(line.sgstAmount)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatINR(line.igstAmount)}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatINR(line.lineTotal)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Totals */}
      <div className="ml-auto w-full max-w-sm rounded-lg border border-border bg-card p-4 text-sm space-y-1.5">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Taxable value</span>
          <span className="tabular-nums">{formatINR(invoice.taxableAmount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">CGST</span>
          <span className="tabular-nums">{formatINR(invoice.cgstAmount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">SGST</span>
          <span className="tabular-nums">{formatINR(invoice.sgstAmount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">IGST</span>
          <span className="tabular-nums">{formatINR(invoice.igstAmount)}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-2 font-semibold">
          <span>Invoice total</span>
          <span className="tabular-nums">{formatINR(invoice.totalAmount)}</span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground pt-1">
          <span>Outstanding balance</span>
          <span className="font-medium text-foreground tabular-nums">
            {formatINR(invoice.outstandingAmount)}
          </span>
        </div>
      </div>

      <EntityLifecycleTimeline
        entityType="invoice"
        entityId={invoice.id}
        description="Invoice issuance, source order context, allocated payments, and credit note adjustments."
      />

      {/* Credit Note Dialog */}
      <Dialog open={creditOpen} onOpenChange={setCreditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Issue credit note for {invoice.invoiceNumber}</DialogTitle>
            <DialogDescription>
              Posted invoices are immutable. A credit note creates a linked financial reversal without deleting the original invoice.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cn-amount">Credit amount (leave blank for full credit)</Label>
              <Input
                id="cn-amount"
                type="number"
                min={0}
                step="0.01"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                placeholder={`Max ${invoice.totalAmount}`}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cn-reason">
                Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="cn-reason"
                rows={3}
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                placeholder="e.g., Damaged packets returned or billing rate correction"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => creditNoteMutation.mutate()}
              disabled={!creditReason.trim() || creditNoteMutation.isPending}
            >
              {creditNoteMutation.isPending ? "Issuing..." : "Issue credit note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
