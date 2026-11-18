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
  ShoppingCartIcon,
  RefreshCwIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  PlusCircleIcon,
  XCircleIcon,
  ShieldCheckIcon,
  IndianRupeeIcon,
} from "lucide-react";

interface SalesOrderLine {
  id: string;
  productVariantId: string;
  quotedQuantity: number;
  approvedQuantity: number;
  quotedUnitPrice: number;
  approvedUnitPrice: number;
  taxRate: number;
  taxableAmount: number;
  taxAmount: number;
  lineTotal: number;
  liveShortage?: number;
  productVariant: {
    sku: string;
    name: string;
  };
}

interface SalesOrder {
  id: string;
  orderNumber: string;
  status:
    "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "CLOSED";
  fulfilmentStatus: "UNFULFILLED" | "PARTIALLY_FULFILLED" | "FULFILLED";
  deliveryState: string;
  notes: string | null;
  rejectionReason: string | null;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTaxAmount: number;
  totalAmount: number;
  totalShortage?: number;
  customer: {
    code: string;
    name: string;
    state: string;
  };
  salesman: {
    name: string;
    email: string;
  };
  lines: SalesOrderLine[];
  reservations: Array<{
    id: string;
    reservedQuantity: number;
    status: string;
  }>;
}

export function OrdersPage() {
  const queryClient = useQueryClient();
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [selectedOrderForAction, setSelectedOrderForAction] =
    useState<SalesOrder | null>(null);
  const [actionType, setActionType] = useState<"APPROVE" | "REJECT" | null>(
    null,
  );
  const [rejectionReason, setRejectionReason] = useState("Stock unavailable");

  // Form states
  const [selectedCustomerId, setSelectedCustomerId] = useState("CUST-RET-A");
  const [orderQuantity, setOrderQuantity] = useState(150);
  const [orderNotes, setOrderNotes] = useState("Benchmark wholesale order");

  // Fetch orders
  const { data, isLoading, isError, refetch, isFetching } = useQuery<{
    orders: SalesOrder[];
  }>({
    queryKey: ["sales-orders"],
    queryFn: async () => {
      const res = await apiClient.get("/sales/orders?organizationId=MILL");
      return res.data;
    },
  });

  // Fetch current available stock for Murukku 200g
  const { data: stockData } = useQuery<{
    balances: Array<{
      sku: string;
      available: number;
      onHand: number;
      reserved: number;
    }>;
  }>({
    queryKey: ["inventory-balances"],
    queryFn: async () => {
      const res = await apiClient.get(
        "/inventory/balances?organizationId=MILL",
      );
      return res.data;
    },
  });

  const murukkuStock = stockData?.balances.find(
    (b) => b.sku === "FG-MURUKKU-200G",
  );
  const availablePackets = murukkuStock?.available ?? 0;
  const currentShortage = Math.max(0, orderQuantity - availablePackets);

  // Customer options
  const isRetailerA = selectedCustomerId === "CUST-RET-A";
  const customerState = isRetailerA ? "Tamil Nadu" : "Karnataka";
  const isIntraState = customerState.toLowerCase() === "tamil nadu";

  const unitPrice = 50.0;
  const calculatedTaxable = orderQuantity * unitPrice;
  const calculatedTax = calculatedTaxable * 0.05;
  const calculatedTotal = calculatedTaxable + calculatedTax;

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      // Fetch variant ID and customer ID from database
      const res = await apiClient.post("/sales/orders", {
        organizationId: "MILL",
        customerId: isRetailerA ? "CUST-RET-A" : "CUST-DIST-B",
        orderNumber: `SO-2026-${Date.now().toString().slice(-4)}`,
        notes: orderNotes,
        lines: [
          {
            productVariantId: "VAR-MURUKKU-200G",
            quantity: orderQuantity,
            unitPrice,
          },
        ],
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-balances"] });
      setShowNewOrderModal(false);
    },
  });

  // Approve order mutation
  const approveMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await apiClient.post(`/sales/orders/${orderId}/approve`, {});
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-balances"] });
      setSelectedOrderForAction(null);
      setActionType(null);
    },
  });

  // Reject order mutation
  const rejectMutation = useMutation({
    mutationFn: async ({
      orderId,
      reason,
    }: {
      orderId: string;
      reason: string;
    }) => {
      const res = await apiClient.post(`/sales/orders/${orderId}/reject`, {
        reason,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-balances"] });
      setSelectedOrderForAction(null);
      setActionType(null);
    },
  });

  const orders = data?.orders ?? [];

  // Summary counts
  const totalOrders = orders.length;
  const approvedOrders = orders.filter((o) => o.status === "APPROVED").length;
  const submittedOrders = orders.filter((o) => o.status === "SUBMITTED").length;
  const totalRevenueBooked = orders
    .filter((o) => o.status === "APPROVED")
    .reduce((sum, o) => sum + Number(o.totalAmount), 0);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Orders
            </h1>
            <Badge variant="outline" className="font-mono text-xs">
              M5
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Salesman mobile orders, admin approval, shortages, and atomic stock
            reservations
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

          <Button
            size="sm"
            onClick={() => setShowNewOrderModal(true)}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <PlusCircleIcon className="h-4 w-4" />
            New sales order
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">
              Total orders
            </span>
            <ShoppingCartIcon className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold">{totalOrders}</div>
          <div className="text-xs text-muted-foreground">
            {submittedOrders} pending approval
          </div>
        </div>

        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">
              Approved bookings
            </span>
            <ShieldCheckIcon className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {approvedOrders}
          </div>
          <div className="text-xs text-muted-foreground">
            Stock reserved atomically
          </div>
        </div>

        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">
              Booked value
            </span>
            <IndianRupeeIcon className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold">
            ₹
            {totalRevenueBooked.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </div>
          <div className="text-xs text-muted-foreground">
            Approved orders inclusive of GST
          </div>
        </div>

        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">
              Available to promise
            </span>
            <CheckCircle2Icon className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono">
            {availablePackets.toLocaleString()} pkts
          </div>
          <div className="text-xs text-muted-foreground">
            Murukku 200g net of active reservations
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-xl border bg-card shadow-xs">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">
            Sales orders stream
          </h2>
          <span className="text-xs text-muted-foreground">
            {orders.length} orders recorded
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
            <RefreshCwIcon className="mr-2 h-4 w-4 animate-spin" />
            Loading orders...
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-2 p-12 text-sm text-destructive">
            <AlertTriangleIcon className="h-6 w-6" />
            <span>Failed to load sales orders</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12 text-center text-sm text-muted-foreground">
            <ShoppingCartIcon className="h-8 w-8 stroke-1 text-muted-foreground/60" />
            <p>No sales orders created yet.</p>
            <Button
              size="sm"
              onClick={() => setShowNewOrderModal(true)}
              className="gap-2"
            >
              <PlusCircleIcon className="h-4 w-4" />
              Create first order
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Salesman</TableHead>
                  <TableHead className="text-right">Ordered</TableHead>
                  <TableHead className="text-right">Taxable</TableHead>
                  <TableHead className="text-right">GST</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Shortage status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => {
                  const line = o.lines[0];
                  const qty = Number(line?.quotedQuantity ?? 0);
                  const shortage = o.totalShortage ?? 0;

                  return (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono font-medium">
                        {o.orderNumber}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            o.status === "APPROVED"
                              ? "success"
                              : o.status === "REJECTED"
                                ? "danger"
                                : o.status === "SUBMITTED"
                                  ? "warning"
                                  : "neutral"
                          }
                        >
                          {o.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {o.customer.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {o.deliveryState}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {o.salesman.name}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {qty.toLocaleString()} pkts
                      </TableCell>
                      <TableCell className="text-right">
                        ₹
                        {Number(o.taxableAmount).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {Number(o.igstAmount) > 0 ? (
                          <span>IGST: ₹{Number(o.igstAmount).toFixed(2)}</span>
                        ) : (
                          <span>
                            CGST/SGST: ₹
                            {(
                              Number(o.cgstAmount) + Number(o.sgstAmount)
                            ).toFixed(2)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-bold text-foreground">
                        ₹
                        {Number(o.totalAmount).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell>
                        {shortage > 0 ? (
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                            <AlertTriangleIcon className="h-3.5 w-3.5" />
                            <span>Shortage: {shortage} pkts</span>
                          </div>
                        ) : o.status === "APPROVED" ? (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2Icon className="h-3.5 w-3.5" />
                            <span>Reserved ({qty})</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Stock ready
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {o.status === "SUBMITTED" ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedOrderForAction(o);
                                setActionType("APPROVE");
                              }}
                              className="h-7 text-xs text-emerald-600 hover:text-emerald-700"
                            >
                              Approve
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedOrderForAction(o);
                                setActionType("REJECT");
                              }}
                              className="h-7 text-xs text-destructive hover:bg-destructive/10"
                            >
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">
                            Completed
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* New Order Modal */}
      {showNewOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-card p-6 shadow-xl border">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  Create sales order
                </h3>
                <p className="text-xs text-muted-foreground">
                  Select customer and enter order quantities
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNewOrderModal(false)}
              >
                ✕
              </Button>
            </div>

            <div className="mt-4 flex flex-col gap-4">
              {/* Customer selection */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Customer
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="rounded-md border bg-background px-3 py-2 text-sm font-medium"
                >
                  <option value="CUST-RET-A">
                    Retailer A (Tamil Nadu, Intra-state)
                  </option>
                  <option value="CUST-DIST-B">
                    Distributor B (Karnataka, Inter-state)
                  </option>
                </select>
                <span className="text-xs text-muted-foreground">
                  Place of supply: {customerState} (
                  {isIntraState ? "CGST 2.5% + SGST 2.5%" : "IGST 5.0%"})
                </span>
              </div>

              {/* Product and Quantity */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Product item
                  </label>
                  <input
                    type="text"
                    disabled
                    value="Murukku 200 g"
                    className="rounded-md border bg-muted px-3 py-2 text-sm font-medium"
                  />
                  <span className="text-xs text-muted-foreground">
                    Standard price: ₹50.00 / pkt
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Order quantity (pkts)
                  </label>
                  <input
                    type="number"
                    value={orderQuantity}
                    onChange={(e) => setOrderQuantity(Number(e.target.value))}
                    className="rounded-md border bg-background px-3 py-2 text-sm font-semibold"
                  />
                  <span className="text-xs text-muted-foreground">
                    Available: {availablePackets} pkts
                  </span>
                </div>
              </div>

              {/* Shortage indicator */}
              {currentShortage > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <AlertTriangleIcon className="h-4 w-4 shrink-0" />
                  <span>
                    Warning: Stock shortage of {currentShortage} packets
                    detected. Order requires admin review or partial allocation.
                  </span>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Order notes
                </label>
                <input
                  type="text"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>

              {/* Order total calculation */}
              <div className="rounded-lg bg-muted/50 p-3 text-xs flex flex-col gap-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taxable amount:</span>
                  <span className="font-semibold">
                    ₹{calculatedTaxable.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    GST (5% {isIntraState ? "CGST + SGST" : "IGST"}):
                  </span>
                  <span className="font-semibold">
                    ₹{calculatedTax.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-1 font-bold text-sm">
                  <span>Total order amount:</span>
                  <span className="text-foreground">
                    ₹{calculatedTotal.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNewOrderModal(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => createOrderMutation.mutate()}
                disabled={createOrderMutation.isPending}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {createOrderMutation.isPending ? (
                  <>
                    <RefreshCwIcon className="h-4 w-4 animate-spin" />
                    Submitting order...
                  </>
                ) : (
                  <>
                    <CheckCircle2Icon className="h-4 w-4" />
                    Submit sales order
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Approve / Reject Dialog */}
      {selectedOrderForAction && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl border">
            <h3 className="text-lg font-bold text-foreground">
              {actionType === "APPROVE"
                ? "Approve sales order"
                : "Reject sales order"}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Order {selectedOrderForAction.orderNumber} for{" "}
              {selectedOrderForAction.customer.name} (
              {Number(selectedOrderForAction.lines[0]?.quotedQuantity)} packets)
            </p>

            {actionType === "APPROVE" ? (
              <div className="mt-4 flex flex-col gap-3">
                <p className="text-xs text-foreground">
                  Approving this order will atomically reserve{" "}
                  <span className="font-semibold">
                    {Number(selectedOrderForAction.lines[0]?.quotedQuantity)}{" "}
                    packets
                  </span>{" "}
                  of finished goods Murukku 200g.
                </p>
                {selectedOrderForAction.totalShortage &&
                selectedOrderForAction.totalShortage > 0 ? (
                  <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    <AlertTriangleIcon className="h-4 w-4 shrink-0" />
                    <span>
                      Notice: Full quantity cannot be reserved because shortage
                      is {selectedOrderForAction.totalShortage} packets.
                    </span>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Reason for rejection
                </label>
                <input
                  type="text"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3 border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedOrderForAction(null);
                  setActionType(null);
                }}
              >
                Cancel
              </Button>

              {actionType === "APPROVE" ? (
                <Button
                  size="sm"
                  onClick={() =>
                    approveMutation.mutate(selectedOrderForAction.id)
                  }
                  disabled={approveMutation.isPending}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <CheckCircle2Icon className="h-4 w-4" />
                  Confirm approval
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() =>
                    rejectMutation.mutate({
                      orderId: selectedOrderForAction.id,
                      reason: rejectionReason,
                    })
                  }
                  disabled={rejectMutation.isPending}
                  className="gap-2"
                >
                  <XCircleIcon className="h-4 w-4" />
                  Confirm rejection
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
