import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatDateTime, formatQuantity, formatINR } from "@/lib/formatters";
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
import { RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";

interface DispatchDetail {
  id: string;
  dispatchNumber: string;
  dispatchedAt: string;
  vehicleNumber: string | null;
  driverName: string | null;
  driverPhone: string | null;
  status: "DRAFT" | "POSTED" | "CANCELLED";
  notes: string | null;
  salesOrder?: {
    id: string;
    orderNumber: string;
    fulfilmentStatus: string;
    customer?: {
      code: string;
      name: string;
      city: string;
      state: string;
    };
  };
  salesInvoice?: {
    id: string;
    invoiceNumber: string;
    totalAmount: number;
  } | null;
  lines: Array<{
    id: string;
    inventoryItemId: string;
    quantity: number;
    inventoryItem?: {
      sku: string;
      name: string;
      unitOfMeasure: string;
    };
  }>;
}

export function DispatchDetailPage() {
  const { dispatchId } = useParams<{ dispatchId: string }>();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const isAdmin = user?.role === "ADMIN";

  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnQuantities, setReturnQuantities] = useState<Record<string, string>>({});

  const { data, isLoading, isError, error, refetch } = useQuery<{
    dispatch: DispatchDetail;
  }>({
    queryKey: ["dispatch", dispatchId],
    queryFn: async () => {
      const res = await apiClient.get(`/sales/dispatches/${dispatchId}`);
      return res.data;
    },
    enabled: Boolean(dispatchId),
  });

  const dispatch = data?.dispatch;

  useEffect(() => {
    if (!dispatch) return;
    const init: Record<string, string> = {};
    for (const line of dispatch.lines) {
      init[line.inventoryItemId] = "0";
    }
    setReturnQuantities(init);
  }, [dispatch]);

  const returnMutation = useMutation({
    mutationFn: async () => {
      if (!dispatch) return;
      const lines = Object.entries(returnQuantities)
        .map(([inventoryItemId, qty]) => ({
          inventoryItemId,
          quantity: Number(qty || 0),
        }))
        .filter((l) => l.quantity > 0);

      const res = await apiClient.post("/sales/returns", {
        dispatchId: dispatch.id,
        reason: returnReason.trim(),
        lines,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dispatch", dispatchId] });
      queryClient.invalidateQueries({ queryKey: ["dispatches"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-balances"] });
      setReturnOpen(false);
      setReturnReason("");
      toast.success("Sales return recorded and finished stock restored.");
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to record sales return."));
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <SkeletonTable rows={4} columns={4} />
      </div>
    );
  }

  if (isError || !dispatch) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <ErrorState
          title="Unable to load dispatch"
          description={extractErrorMessage(error)}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-5xl">
      <RecordHeader
        backTo="/dispatch"
        backLabel="Back to Dispatch"
        reference={dispatch.dispatchNumber}
        subtitle={`Dispatched ${formatDateTime(dispatch.dispatchedAt)}${dispatch.salesOrder?.customer ? ` • ${dispatch.salesOrder.customer.name}` : ""}`}
        statuses={<Badge variant="outline">{dispatch.status}</Badge>}
        secondaryActions={
          isAdmin && dispatch.status === "POSTED" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReturnOpen(true)}
              className="gap-1.5"
            >
              <RotateCcwIcon className="size-4" aria-hidden="true" />
              Record sales return
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-card p-4 text-sm md:grid-cols-3">
        <div>
          <div className="text-xs text-muted-foreground">Sales order</div>
          {dispatch.salesOrder ? (
            <Link
              to={`/orders/${dispatch.salesOrder.id}`}
              className="font-medium text-primary hover:underline"
            >
              {dispatch.salesOrder.orderNumber}
            </Link>
          ) : (
            <span>—</span>
          )}
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Linked invoice</div>
          {dispatch.salesInvoice ? (
            <Link
              to={`/invoices/${dispatch.salesInvoice.id}`}
              className="font-medium text-primary hover:underline"
            >
              {dispatch.salesInvoice.invoiceNumber} ({formatINR(dispatch.salesInvoice.totalAmount)})
            </Link>
          ) : (
            <span className="text-muted-foreground">Not linked</span>
          )}
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Logistics</div>
          <div className="font-medium">
            {dispatch.vehicleNumber || "No vehicle recorded"}
          </div>
          <div className="text-xs text-muted-foreground">
            {dispatch.driverName || "—"} {dispatch.driverPhone ? `(${dispatch.driverPhone})` : ""}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Dispatched quantity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dispatch.lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell className="text-xs text-muted-foreground">
                  {line.inventoryItem?.sku ?? line.inventoryItemId}
                </TableCell>
                <TableCell className="font-medium">
                  {line.inventoryItem?.name ?? "Finished goods"}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatQuantity(
                    line.quantity,
                    { unit: line.inventoryItem?.unitOfMeasure ?? "pkts" },
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record sales return</DialogTitle>
            <DialogDescription>
              Restores returned finished goods back into stock without deleting {dispatch.dispatchNumber}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {dispatch.lines.map((line) => (
              <div key={line.id} className="flex items-center justify-between gap-3">
                <Label htmlFor={`ret-${line.id}`} className="text-sm">
                  {line.inventoryItem?.name ?? line.inventoryItemId} (max {line.quantity})
                </Label>
                <Input
                  id={`ret-${line.id}`}
                  type="number"
                  min={0}
                  max={line.quantity}
                  step="1"
                  value={returnQuantities[line.inventoryItemId] ?? "0"}
                  onChange={(e) =>
                    setReturnQuantities((prev) => ({
                      ...prev,
                      [line.inventoryItemId]: e.target.value,
                    }))
                  }
                  className="w-24 text-right tabular-nums"
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label htmlFor="ret-reason">
                Return reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="ret-reason"
                rows={2}
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="e.g., Damaged in transit or customer refused partial delivery"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => returnMutation.mutate()}
              disabled={!returnReason.trim() || returnMutation.isPending}
            >
              {returnMutation.isPending ? "Recording..." : "Record return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
