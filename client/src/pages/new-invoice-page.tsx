import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { formatINR, formatQuantity } from "@/lib/formatters";
import { RecordHeader } from "@/components/ui/page-header";
import { ErrorState, EmptyState, SkeletonTable } from "@/components/ui/loading-error-empty";
import { Button } from "@/components/ui/button";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileCheck2Icon } from "lucide-react";
import { toast } from "sonner";

interface ApprovedOrder {
  id: string;
  orderNumber: string;
  deliveryState: string;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTaxAmount: number;
  totalAmount: number;
  customer: {
    id: string;
    code: string;
    name: string;
    state: string;
    gstin?: string | null;
  };
  invoices?: Array<{ id: string; invoiceNumber: string }>;
  lines: Array<{
    id: string;
    quotedQuantity: number;
    approvedQuantity: number | null;
    quotedUnitPrice: number;
    approvedUnitPrice: number | null;
    taxRate: number;
    taxableAmount: number;
    taxAmount: number;
    lineTotal: number;
    productVariant: { sku: string; name: string };
  }>;
}

export function NewInvoicePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const initialOrderId = searchParams.get("orderId") ?? "";

  const [selectedOrderId, setSelectedOrderId] = useState(initialOrderId);
  const [notes, setNotes] = useState("");

  const { data, isLoading, isError, error, refetch } = useQuery<{
    orders: ApprovedOrder[];
  }>({
    queryKey: ["approved-orders-for-invoice"],
    queryFn: async () => {
      const res = await apiClient.get("/sales/orders?status=APPROVED");
      return res.data;
    },
  });

  const eligibleOrders = (data?.orders ?? []).filter(
    (o) => !o.invoices || o.invoices.length === 0,
  );
  const selectedOrder = eligibleOrders.find((o) => o.id === selectedOrderId);

  const postInvoiceMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post("/finance/invoices", {
        salesOrderId: selectedOrderId,
        notes: notes.trim() || undefined,
      });
      return res.data;
    },
    onSuccess: (resData) => {
      queryClient.invalidateQueries({ queryKey: ["sales-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      queryClient.invalidateQueries({ queryKey: ["approved-orders-for-invoice"] });
      const invId = resData?.invoice?.id ?? resData?.id;
      const invNumber = resData?.invoice?.invoiceNumber ?? resData?.invoiceNumber ?? "";
      toast.success(`Invoice ${invNumber} posted.`);
      if (invId) {
        navigate(`/invoices/${invId}`);
      } else {
        navigate("/invoices");
      }
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to post GST invoice."));
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <SkeletonTable rows={5} columns={4} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <ErrorState
          title="Unable to load approved orders"
          description={extractErrorMessage(error)}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-5xl">
      <RecordHeader
        backTo="/invoices"
        backLabel="Back to Invoices"
        reference="Create GST invoice"
        subtitle="Select an approved order, verify tax treatment and customer snapshots, and post an immutable tax invoice."
      />

      {eligibleOrders.length === 0 ? (
        <EmptyState
          title="No approved orders awaiting invoice"
          description="Approve a submitted sales order first before posting a GST invoice."
          action={
            <Button variant="primary" onClick={() => navigate("/orders")}>
              Open Order inbox
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-4 sm:p-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="order-select">Approved sales order</Label>
              <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                <SelectTrigger id="order-select" className="max-w-lg">
                  <SelectValue placeholder="Choose an approved order..." />
                </SelectTrigger>
                <SelectContent>
                  {eligibleOrders.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.orderNumber} — {o.customer.name} ({formatINR(o.totalAmount)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedOrder && (
              <>
                <div className="grid grid-cols-1 gap-4 rounded-md border border-border bg-muted/30 p-3 text-sm sm:grid-cols-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Customer</div>
                    <div className="font-medium">{selectedOrder.customer.name}</div>
                    <div className="text-xs text-muted-foreground">
                      GSTIN: {selectedOrder.customer.gstin || "Unregistered"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Place of supply</div>
                    <div className="font-medium">{selectedOrder.deliveryState}</div>
                    <div className="text-xs text-muted-foreground">
                      {Number(selectedOrder.igstAmount) > 0
                        ? "Inter-state (IGST)"
                        : "Intra-state (CGST + SGST)"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Stock effect</div>
                    <div className="font-medium">No stock deduction</div>
                    <div className="text-xs text-muted-foreground">
                      Physical stock deducts on Dispatch
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                        <TableHead className="text-right">Taxable</TableHead>
                        <TableHead className="text-right">Tax</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrder.lines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell>
                            <div className="font-medium">{line.productVariant.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {line.productVariant.sku}
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatQuantity(
                              line.approvedQuantity ?? line.quotedQuantity,
                              { unit: "pkts" },
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatINR(line.approvedUnitPrice ?? line.quotedUnitPrice)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatINR(line.taxableAmount)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-xs">
                            {line.taxRate}% ({formatINR(line.taxAmount)})
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatINR(line.lineTotal)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="invoice-notes">Invoice notes (optional)</Label>
                  <Textarea
                    id="invoice-notes"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Payment terms or delivery remarks"
                  />
                </div>

                <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Invoice total: </span>
                    <span className="text-lg font-semibold tabular-nums">
                      {formatINR(selectedOrder.totalAmount)}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      (Posted invoices are immutable; corrections use credit notes.)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => navigate("/invoices")}
                      disabled={postInvoiceMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => postInvoiceMutation.mutate()}
                      disabled={postInvoiceMutation.isPending}
                      className="gap-1.5"
                    >
                      <FileCheck2Icon className="size-4" aria-hidden="true" />
                      {postInvoiceMutation.isPending ? "Posting..." : "Post invoice"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
