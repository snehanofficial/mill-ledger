import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { formatQuantity } from "@/lib/formatters";
import { RecordHeader } from "@/components/ui/page-header";
import { ErrorState, EmptyState, SkeletonTable } from "@/components/ui/loading-error-empty";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TruckIcon } from "lucide-react";
import { toast } from "sonner";

interface EligibleOrder {
  id: string;
  orderNumber: string;
  status: string;
  fulfilmentStatus: string;
  deliveryState: string;
  customer: { id: string; code: string; name: string; state: string };
  lines: Array<{
    id: string;
    quotedQuantity: number;
    approvedQuantity: number | null;
    dispatchedQuantity?: number;
    productVariant: { sku: string; name: string };
  }>;
}

export function NewDispatchPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const initialOrderId = searchParams.get("orderId") ?? "";

  const [selectedOrderId, setSelectedOrderId] = useState(initialOrderId);
  const [lineQuantities, setLineQuantities] = useState<Record<string, string>>({});
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [notes, setNotes] = useState("");

  const { data, isLoading, isError, error, refetch } = useQuery<{
    orders: EligibleOrder[];
  }>({
    queryKey: ["sales-orders", "eligible-dispatch"],
    queryFn: async () => {
      const res = await apiClient.get("/sales/orders");
      return res.data;
    },
  });

  const eligibleOrders = (data?.orders ?? []).filter(
    (o) => o.status === "APPROVED" && o.fulfilmentStatus !== "FULFILLED",
  );
  const selectedOrder = eligibleOrders.find((o) => o.id === selectedOrderId);

  useEffect(() => {
    if (!selectedOrder) return;
    const init: Record<string, string> = {};
    for (const line of selectedOrder.lines) {
      const approved = Number(line.approvedQuantity ?? line.quotedQuantity);
      const dispatched = Number(line.dispatchedQuantity ?? 0);
      const remaining = Math.max(0, approved - dispatched);
      init[line.id] = String(remaining);
    }
    setLineQuantities(init);
  }, [selectedOrder]);

  const totalToDispatch = Object.values(lineQuantities).reduce(
    (sum, v) => sum + Math.max(0, Number(v) || 0),
    0,
  );

  const postDispatchMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrder) return;
      const lines = selectedOrder.lines
        .map((line) => ({
          salesOrderLineId: line.id,
          quantity: Number(lineQuantities[line.id] || 0),
        }))
        .filter((l) => l.quantity > 0);

      const res = await apiClient.post("/sales/dispatches", {
        salesOrderId: selectedOrder.id,
        vehicleNumber: vehicleNumber.trim() || undefined,
        driverName: driverName.trim() || undefined,
        driverPhone: driverPhone.trim() || undefined,
        notes: notes.trim() || undefined,
        lines,
      });
      return res.data;
    },
    onSuccess: (resData) => {
      queryClient.invalidateQueries({ queryKey: ["dispatches"] });
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-balances"] });
      const dspId = resData?.dispatch?.id ?? resData?.id;
      const dspNum = resData?.dispatch?.dispatchNumber ?? resData?.dispatchNumber ?? "";
      toast.success(`Dispatch ${dspNum} posted and finished stock deducted.`);
      if (dspId) {
        navigate(`/dispatch/${dspId}`);
      } else {
        navigate("/dispatch");
      }
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to post dispatch."));
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
          title="Unable to load eligible orders"
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
        backLabel="Back to Dispatch queue"
        reference="Prepare physical dispatch"
        subtitle="Select an approved order, enter actual dispatch quantities, and deduct physical finished-goods stock."
      />

      {eligibleOrders.length === 0 ? (
        <EmptyState
          title="No orders awaiting dispatch"
          description="Approved orders with remaining unfulfilled quantities will appear here."
          action={
            <Button variant="primary" onClick={() => navigate("/dispatch")}>
              Back to Dispatch
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border border-border bg-card p-4 sm:p-5 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="dispatch-order-select">Approved order</Label>
            <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
              <SelectTrigger id="dispatch-order-select" className="max-w-lg">
                <SelectValue placeholder="Choose an order to dispatch..." />
              </SelectTrigger>
              <SelectContent>
                {eligibleOrders.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.orderNumber} — {o.customer.name} ({o.fulfilmentStatus.replaceAll("_", " ")})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedOrder && (
            <>
              <div className="overflow-x-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Approved</TableHead>
                      <TableHead className="text-right">Already dispatched</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                      <TableHead className="text-right">Dispatch now</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedOrder.lines.map((line) => {
                      const approved = Number(line.approvedQuantity ?? line.quotedQuantity);
                      const dispatched = Number(line.dispatchedQuantity ?? 0);
                      const remaining = Math.max(0, approved - dispatched);
                      return (
                        <TableRow key={line.id}>
                          <TableCell>
                            <div className="font-medium">{line.productVariant.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {line.productVariant.sku}
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatQuantity(approved, { unit: "pkts" })}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatQuantity(dispatched, { unit: "pkts" })}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatQuantity(remaining, { unit: "pkts" })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min={0}
                              max={remaining}
                              step="1"
                              aria-label={`Dispatch quantity for ${line.productVariant.name}`}
                              value={lineQuantities[line.id] ?? "0"}
                              onChange={(e) =>
                                setLineQuantities((prev) => ({
                                  ...prev,
                                  [line.id]: e.target.value,
                                }))
                              }
                              className="ml-auto h-9 w-24 text-right tabular-nums"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="vehicle-no">Vehicle number</Label>
                  <Input
                    id="vehicle-no"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    placeholder="e.g., TN-01-AB-1234"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="driver-name">Driver name</Label>
                  <Input
                    id="driver-name"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    placeholder="Driver name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="driver-phone">Driver phone</Label>
                  <Input
                    id="driver-phone"
                    value={driverPhone}
                    onChange={(e) => setDriverPhone(e.target.value)}
                    placeholder="10-digit mobile"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dispatch-notes">Dispatch notes</Label>
                <Textarea
                  id="dispatch-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Gate pass or delivery instructions"
                />
              </div>

              <div className="flex flex-col gap-3 rounded-md border border-border bg-muted/40 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="font-medium">Physical stock impact: </span>
                  <span className="tabular-nums">
                    Deducts {formatQuantity(totalToDispatch, { unit: "pkts" })} from finished goods and releases corresponding reservation.
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    onClick={() => navigate("/dispatch")}
                    disabled={postDispatchMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => postDispatchMutation.mutate()}
                    disabled={totalToDispatch <= 0 || postDispatchMutation.isPending}
                    className="gap-1.5"
                  >
                    <TruckIcon className="size-4" aria-hidden="true" />
                    {postDispatchMutation.isPending ? "Posting..." : "Post dispatch"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
