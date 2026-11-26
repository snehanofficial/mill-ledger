import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatINR, formatQuantity, formatDateTime } from "@/lib/formatters";
import { RecordHeader } from "@/components/ui/page-header";
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
import { FileTextIcon, RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";

interface ReceiptDetail {
  id: string;
  receiptNumber: string;
  supplierInvoiceNumber: string | null;
  status: string;
  totalAmount: number;
  notes: string | null;
  receivedAt: string;
  supplier: { id: string; name: string; code: string };
  warehouse?: { name: string };
  lines: Array<{
    id: string;
    inventoryItemId: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    inventoryItem?: {
      id: string;
      sku: string;
      name: string;
      baseUom?: { code: string };
    };
  }>;
}

export function PurchaseDetailPage() {
  const { receiptId } = useParams<{ receiptId: string }>();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const isAdmin = user?.role === "ADMIN";

  const [reverseOpen, setReverseOpen] = useState(false);
  const [reverseReason, setReverseReason] = useState("");
  const [debitOpen, setDebitOpen] = useState(false);
  const [debitAmount, setDebitAmount] = useState("");
  const [debitReason, setDebitReason] = useState("");

  const { data, isLoading, isError, error, refetch } = useQuery<{
    receipt: ReceiptDetail;
  }>({
    queryKey: ["purchase-receipt", receiptId],
    queryFn: async () => {
      const res = await apiClient.get(`/inventory/purchase-receipts/${receiptId}`);
      return res.data;
    },
    enabled: Boolean(receiptId),
  });

  const receipt = data?.receipt;

  const reverseMutation = useMutation({
    mutationFn: async () => {
      if (!receipt) return;
      const res = await apiClient.post(
        `/inventory/purchase-receipts/${receipt.id}/reverse`,
        { reason: reverseReason.trim() },
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-receipt", receiptId] });
      queryClient.invalidateQueries({ queryKey: ["purchase-receipts"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-balances"] });
      setReverseOpen(false);
      setReverseReason("");
      toast.success("Purchase receipt reversed.");
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to reverse receipt."));
    },
  });

  const debitNoteMutation = useMutation({
    mutationFn: async () => {
      if (!receipt) return;
      const res = await apiClient.post("/finance/debit-notes", {
        purchaseReceiptId: receipt.id,
        supplierId: receipt.supplier.id,
        amount: Number(debitAmount),
        taxAmount: 0,
        reason: debitReason.trim(),
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debit-notes"] });
      setDebitOpen(false);
      setDebitAmount("");
      setDebitReason("");
      toast.success("Supplier debit note issued.");
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to issue debit note."));
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <SkeletonTable rows={4} columns={5} />
      </div>
    );
  }

  if (isError || !receipt) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <ErrorState
          title="Unable to load purchase receipt"
          description={extractErrorMessage(error)}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-5xl">
      <RecordHeader
        backTo="/purchases"
        backLabel="Back to Purchase receipts"
        reference={receipt.receiptNumber}
        subtitle={`${receipt.supplier.name} (${receipt.supplier.code}) • Received ${formatDateTime(receipt.receivedAt)}`}
        statuses={<Badge variant="outline">{receipt.status}</Badge>}
        secondaryActions={
          isAdmin && receipt.status !== "REVERSED" ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDebitOpen(true)}
                className="gap-1.5"
              >
                <FileTextIcon className="size-4" aria-hidden="true" />
                Issue debit note
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setReverseOpen(true)}
                className="gap-1.5"
              >
                <RotateCcwIcon className="size-4" aria-hidden="true" />
                Reverse receipt
              </Button>
            </>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-card p-4 text-sm sm:grid-cols-3">
        <div>
          <div className="text-xs text-muted-foreground">Supplier</div>
          <Link
            to={`/suppliers/${receipt.supplier.id}`}
            className="font-medium text-primary hover:underline"
          >
            {receipt.supplier.name}
          </Link>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Supplier bill ref</div>
          <div className="font-medium">{receipt.supplierInvoiceNumber || "—"}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Total receipt value</div>
          <div className="text-lg font-semibold tabular-nums">
            {formatINR(receipt.totalAmount)}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Unit rate</TableHead>
              <TableHead className="text-right">Line total</TableHead>
              <TableHead className="text-right">Stock ledger</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {receipt.lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell>
                  <div className="font-medium">
                    {line.inventoryItem?.name ?? line.inventoryItemId}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {line.inventoryItem?.sku}
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatQuantity(
                    line.quantity,
                    { unit: line.inventoryItem?.baseUom?.code ?? "unit" },
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatINR(line.unitPrice)}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatINR(line.lineTotal)}
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    to={`/stock/${line.inventoryItemId}/ledger`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    View ledger
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={reverseOpen} onOpenChange={setReverseOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reverse {receipt.receiptNumber}</DialogTitle>
            <DialogDescription>
              Reversing creates offsetting stock ledger entries without deleting the original receipt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="rev-reason">
              Reversal reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="rev-reason"
              rows={3}
              value={reverseReason}
              onChange={(e) => setReverseReason(e.target.value)}
              placeholder="Explain why this receipt is being reversed"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReverseOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => reverseMutation.mutate()}
              disabled={!reverseReason.trim() || reverseMutation.isPending}
            >
              {reverseMutation.isPending ? "Reversing..." : "Confirm reversal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={debitOpen} onOpenChange={setDebitOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Issue supplier debit note</DialogTitle>
            <DialogDescription>
              Record a financial claim against {receipt.supplier.name} for {receipt.receiptNumber}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="dn-amt">Amount (₹)</Label>
              <Input
                id="dn-amt"
                type="number"
                min={0.01}
                step="0.01"
                value={debitAmount}
                onChange={(e) => setDebitAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dn-reason">
                Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="dn-reason"
                rows={2}
                value={debitReason}
                onChange={(e) => setDebitReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDebitOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => debitNoteMutation.mutate()}
              disabled={
                !(Number(debitAmount) > 0) ||
                !debitReason.trim() ||
                debitNoteMutation.isPending
              }
            >
              {debitNoteMutation.isPending ? "Issuing..." : "Issue debit note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
