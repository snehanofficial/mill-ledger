import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatINR, formatDateTime } from "@/lib/formatters";
import { RecordHeader } from "@/components/ui/page-header";
import { ErrorState, SkeletonTable } from "@/components/ui/loading-error-empty";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangleIcon, Link2Icon } from "lucide-react";
import { toast } from "sonner";

interface PaymentDetail {
  id: string;
  paymentNumber?: string;
  receiptNumber?: string;
  paymentDate: string;
  paymentMode: string;
  referenceNumber: string | null;
  amount: number;
  allocatedAmount: number;
  unallocatedAmount: number;
  status: string;
  notes: string | null;
  customer: { id: string; code: string; name: string };
  allocations: Array<{
    id: string;
    amount: number;
    salesInvoice: {
      id: string;
      invoiceNumber: string;
      totalAmount: number;
      outstandingAmount: number;
    };
  }>;
}

export function PaymentDetailPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const isAdmin = user?.role === "ADMIN";

  const [allocOpen, setAllocOpen] = useState(false);
  const [allocInvoiceId, setAllocInvoiceId] = useState("");
  const [allocAmount, setAllocAmount] = useState("");
  const [bounceOpen, setBounceOpen] = useState(false);
  const [bounceReason, setBounceReason] = useState("");

  const { data, isLoading, isError, error, refetch } = useQuery<
    PaymentDetail | { payment: PaymentDetail }
  >({
    queryKey: ["payment", paymentId],
    queryFn: async () => {
      const res = await apiClient.get(`/payments/${paymentId}`);
      return res.data;
    },
    enabled: Boolean(paymentId),
  });

  const payment = data && "payment" in data ? data.payment : data;

  const { data: openInvoicesData } = useQuery<{
    invoices: Array<{
      id: string;
      invoiceNumber: string;
      outstandingAmount: number;
    }>;
  }>({
    queryKey: ["open-invoices-for-alloc", payment?.customer?.id],
    queryFn: async () => {
      const res = await apiClient.get(
        `/finance/invoices?customerId=${payment!.customer.id}`,
      );
      return {
        invoices: (res.data.invoices ?? []).filter(
          (i: { outstandingAmount: number }) => Number(i.outstandingAmount) > 0,
        ),
      };
    },
    enabled: Boolean(payment?.customer?.id) && allocOpen,
  });

  const allocateMutation = useMutation({
    mutationFn: async () => {
      if (!payment) return;
      const res = await apiClient.post(`/payments/${payment.id}/allocate`, {
        allocations: [
          {
            salesInvoiceId: allocInvoiceId,
            amount: Number(allocAmount),
          },
        ],
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment", paymentId] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["receivables-summary"] });
      setAllocOpen(false);
      setAllocInvoiceId("");
      setAllocAmount("");
      toast.success("Cash allocated to invoice.");
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to allocate payment."));
    },
  });

  const bounceMutation = useMutation({
    mutationFn: async () => {
      if (!payment) return;
      const res = await apiClient.post(`/payments/${payment.id}/bounce`, {
        reason: bounceReason.trim(),
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment", paymentId] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["receivables-summary"] });
      setBounceOpen(false);
      setBounceReason("");
      toast.success("Payment marked bounced and allocations restored.");
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to bounce payment."));
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <SkeletonTable rows={4} columns={4} />
      </div>
    );
  }

  if (isError || !payment) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <ErrorState
          title="Unable to load payment"
          description={extractErrorMessage(error)}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-5xl">
      <RecordHeader
        backTo="/payments"
        backLabel="Back to Payments"
        reference={payment.paymentNumber ?? payment.receiptNumber ?? payment.id}
        subtitle={`${payment.customer.name} • ${payment.paymentMode} • ${formatDateTime(payment.paymentDate)}`}
        statuses={
          <>
            <Badge variant="outline">{payment.status}</Badge>
            <Badge variant="outline">
              Unallocated: {formatINR(payment.unallocatedAmount)}
            </Badge>
          </>
        }
        primaryAction={
          isAdmin &&
          Number(payment.unallocatedAmount) > 0 &&
          payment.status !== "BOUNCED" ? (
            <Button
              variant="primary"
              onClick={() => setAllocOpen(true)}
              className="gap-1.5"
            >
              <Link2Icon className="size-4" aria-hidden="true" />
              Allocate cash
            </Button>
          ) : null
        }
        secondaryActions={
          isAdmin && payment.status !== "BOUNCED" ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBounceOpen(true)}
              className="gap-1.5"
            >
              <AlertTriangleIcon className="size-4" aria-hidden="true" />
              Mark bounced
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-card p-4 text-sm md:grid-cols-3">
        <div>
          <div className="text-xs text-muted-foreground">Customer</div>
          <Link
            to={`/receivables/${payment.customer.id}`}
            className="font-medium text-primary hover:underline"
          >
            {payment.customer.name}
          </Link>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Reference #</div>
          <div className="font-medium">{payment.referenceNumber || "—"}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Amount received</div>
          <div className="text-lg font-semibold tabular-nums">
            {formatINR(payment.amount)}
          </div>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Invoice allocations</h2>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead className="text-right">Invoice total</TableHead>
                <TableHead className="text-right">Allocated amount</TableHead>
                <TableHead className="text-right">Current outstanding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payment.allocations.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-xs text-muted-foreground py-6"
                  >
                    No invoice allocations yet. Full amount remains as unallocated customer credit.
                  </TableCell>
                </TableRow>
              ) : (
                payment.allocations.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium tabular-nums">
                      <Link
                        to={`/invoices/${a.salesInvoice.id}`}
                        className="text-primary hover:underline"
                      >
                        {a.salesInvoice.invoiceNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatINR(a.salesInvoice.totalAmount)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatINR(a.amount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatINR(a.salesInvoice.outstandingAmount)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <Dialog open={allocOpen} onOpenChange={setAllocOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Allocate unallocated cash</DialogTitle>
            <DialogDescription>
              Available unallocated balance: {formatINR(payment.unallocatedAmount)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="alloc-inv">Open invoice</Label>
              <Select value={allocInvoiceId} onValueChange={setAllocInvoiceId}>
                <SelectTrigger id="alloc-inv">
                  <SelectValue placeholder="Choose invoice..." />
                </SelectTrigger>
                <SelectContent>
                  {(openInvoicesData?.invoices ?? []).map((inv) => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} — Due {formatINR(inv.outstandingAmount)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="alloc-amt">Amount (₹)</Label>
              <Input
                id="alloc-amt"
                type="number"
                min={0.01}
                max={payment.unallocatedAmount}
                step="0.01"
                value={allocAmount}
                onChange={(e) => setAllocAmount(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAllocOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => allocateMutation.mutate()}
              disabled={
                !allocInvoiceId ||
                !(Number(allocAmount) > 0) ||
                allocateMutation.isPending
              }
            >
              {allocateMutation.isPending ? "Allocating..." : "Allocate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bounceOpen} onOpenChange={setBounceOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark {payment.receiptNumber} as bounced</DialogTitle>
            <DialogDescription>
              Restores all allocated invoice balances without deleting this payment record.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="bounce-reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="bounce-reason"
              rows={2}
              value={bounceReason}
              onChange={(e) => setBounceReason(e.target.value)}
              placeholder="e.g., Cheque returned insufficient funds"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBounceOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => bounceMutation.mutate()}
              disabled={!bounceReason.trim() || bounceMutation.isPending}
            >
              {bounceMutation.isPending ? "Processing..." : "Confirm bounce"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
