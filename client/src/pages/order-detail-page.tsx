import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatINR, formatQuantity, formatDateTime } from "@/lib/formatters";
import { RecordHeader, LifecycleSteps, type LifecycleStep } from "@/components/ui/page-header";
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
  AlertTriangleIcon,
  CheckCircle2Icon,
  FileTextIcon,
  PencilIcon,
  TruckIcon,
  XCircleIcon,
} from "lucide-react";
import { toast } from "sonner";

interface OrderLine {
  id: string;
  productVariantId: string;
  quotedQuantity: number;
  approvedQuantity: number | null;
  quotedUnitPrice: number;
  approvedUnitPrice: number | null;
  taxRate: number;
  taxableAmount: number;
  taxAmount: number;
  lineTotal: number;
  liveShortage?: number;
  productVariant: {
    id?: string;
    sku: string;
    name: string;
    finishedGoodsItemId?: string | null;
  };
}

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "CLOSED";
  fulfilmentStatus: "UNFULFILLED" | "PARTIALLY_FULFILLED" | "FULFILLED";
  deliveryState: string;
  notes: string | null;
  rejectionReason: string | null;
  overrideReason?: string | null;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTaxAmount: number;
  totalAmount: number;
  totalShortage?: number;
  createdAt: string;
  submittedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  customer: {
    id: string;
    code: string;
    name: string;
    state: string;
    gstin?: string | null;
  };
  salesman: {
    id?: string;
    name: string;
    email: string;
  };
  lines: OrderLine[];
  reservations?: Array<{
    id: string;
    reservedQuantity: number;
    status: string;
    expiresAt?: string;
  }>;
  invoices?: Array<{
    id: string;
    invoiceNumber: string;
    status: string;
    totalAmount: number;
  }>;
  dispatches?: Array<{
    id: string;
    dispatchNumber: string;
    status: string;
    dispatchedAt: string;
  }>;
}

interface StockBalance {
  id: string;
  sku: string;
  name: string;
  onHand: number;
  reserved: number;
  available: number;
}

function getOrderStatusTone(status: OrderDetail["status"]) {
  switch (status) {
    case "APPROVED":
    case "CLOSED":
      return "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";
    case "REJECTED":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "SUBMITTED":
    case "UNDER_REVIEW":
      return "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  const isAdmin = user?.role === "ADMIN";
  const isSalesman = user?.role === "SALESMAN";

  const [lineEdits, setLineEdits] = useState<
    Record<string, { approvedQuantity: string; approvedUnitPrice: string }>
  >({});
  const [overrideReason, setOverrideReason] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const {
    data: orderData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<OrderDetail | { order: OrderDetail }>({
    queryKey: ["sales-order", orderId],
    queryFn: async () => {
      const res = await apiClient.get(`/sales/orders/${orderId}`);
      return res.data;
    },
    enabled: Boolean(orderId),
  });

  const order =
    orderData && "order" in orderData ? orderData.order : orderData;

  const { data: balancesData } = useQuery<{ balances: StockBalance[] }>({
    queryKey: ["inventory-balances"],
    queryFn: async () => {
      const res = await apiClient.get("/inventory/balances");
      return res.data;
    },
    enabled: isAdmin && (order?.status === "SUBMITTED" || order?.status === "UNDER_REVIEW"),
  });

  useEffect(() => {
    if (!order) return;
    const initial: Record<string, { approvedQuantity: string; approvedUnitPrice: string }> = {};
    for (const line of order.lines) {
      initial[line.id] = {
        approvedQuantity: String(line.approvedQuantity ?? line.quotedQuantity),
        approvedUnitPrice: String(line.approvedUnitPrice ?? line.quotedUnitPrice),
      };
    }
    setLineEdits(initial);
  }, [order]);

  const hasOverrides = Boolean(
    order?.lines.some((line) => {
      const edit = lineEdits[line.id];
      if (!edit) return false;
      return (
        Number(edit.approvedQuantity) !== Number(line.quotedQuantity) ||
        Number(edit.approvedUnitPrice) !== Number(line.quotedUnitPrice)
      );
    }),
  );

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!order) return;
      const lineOverrides = order.lines
        .map((line) => {
          const edit = lineEdits[line.id];
          if (!edit) return null;
          const qty = Number(edit.approvedQuantity);
          const price = Number(edit.approvedUnitPrice);
          if (
            qty === Number(line.quotedQuantity) &&
            price === Number(line.quotedUnitPrice)
          ) {
            return null;
          }
          return {
            lineId: line.id,
            approvedQuantity: qty,
            approvedUnitPrice: price,
          };
        })
        .filter(Boolean);

      const res = await apiClient.post(`/sales/orders/${order.id}/approve`, {
        lineOverrides: lineOverrides.length > 0 ? lineOverrides : undefined,
        overrideReason: hasOverrides ? overrideReason.trim() : undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-balances"] });
      toast.success("Order approved and stock reserved.");
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to approve order."));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!order) return;
      const res = await apiClient.post(`/sales/orders/${order.id}/reject`, {
        rejectionReason: rejectionReason.trim(),
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      setRejectOpen(false);
      setRejectionReason("");
      toast.success("Order rejected.");
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to reject order."));
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <SkeletonTable rows={6} columns={5} />
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <ErrorState
          title="Unable to load order"
          description={extractErrorMessage(error, "Order record could not be loaded.")}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const canReview =
    isAdmin && (order.status === "SUBMITTED" || order.status === "UNDER_REVIEW");
  const canEditDraft = isSalesman && order.status === "DRAFT";
  const canCreateInvoice =
    isAdmin &&
    order.status === "APPROVED" &&
    (!order.invoices || order.invoices.length === 0);
  const canPrepareDispatch =
    isAdmin &&
    order.status === "APPROVED" &&
    order.fulfilmentStatus !== "FULFILLED";

  const balances = balancesData?.balances ?? [];
  const getStockForLine = (line: OrderLine) => {
    return balances.find(
      (b) =>
        (line.productVariant.finishedGoodsItemId &&
          b.id === line.productVariant.finishedGoodsItemId) ||
        b.sku === line.productVariant.sku.replace(/^VAR-/, "FG-"),
    );
  };

  const hasShortage =
    (order.totalShortage ?? 0) > 0 ||
    order.lines.some((line) => {
      if ((line.liveShortage ?? 0) > 0) return true;
      const stock = getStockForLine(line);
      const requested = Number(
        lineEdits[line.id]?.approvedQuantity ?? line.approvedQuantity ?? line.quotedQuantity,
      );
      return stock ? requested > stock.available : false;
    });

  const steps: LifecycleStep[] = [
    {
      label: "Order submitted",
      state:
        order.status === "DRAFT"
          ? "current"
          : "completed",
      detail: order.status === "DRAFT" ? "Local/Server draft" : formatDateTime(order.submittedAt ?? order.createdAt),
    },
    {
      label: "Commercial approval",
      state:
        order.status === "REJECTED"
          ? "blocked"
          : order.status === "APPROVED" || order.status === "CLOSED"
            ? "completed"
            : order.status === "DRAFT"
              ? "upcoming"
              : "current",
      detail:
        order.status === "REJECTED"
          ? "Rejected"
          : order.approvedAt
            ? formatDateTime(order.approvedAt)
            : "Awaiting admin review",
    },
    {
      label: "GST invoice",
      state:
        order.invoices && order.invoices.length > 0
          ? "completed"
          : order.status === "APPROVED"
            ? "current"
            : "upcoming",
      detail:
        order.invoices && order.invoices.length > 0
          ? order.invoices[0].invoiceNumber
          : "Pending invoice",
    },
    {
      label: "Physical dispatch",
      state:
        order.fulfilmentStatus === "FULFILLED"
          ? "completed"
          : order.fulfilmentStatus === "PARTIALLY_FULFILLED"
            ? "current"
            : "upcoming",
      detail: order.fulfilmentStatus.replaceAll("_", " "),
    },
  ];

  let primaryAction = null;
  if (canEditDraft) {
    primaryAction = (
      <Button
        variant="primary"
        onClick={() => navigate(`/orders/new?draftId=${order.id}`)}
        className="gap-1.5"
      >
        <PencilIcon className="size-4" aria-hidden="true" />
        Edit draft
      </Button>
    );
  } else if (canCreateInvoice) {
    primaryAction = (
      <Button
        variant="primary"
        onClick={() => navigate(`/invoices/new?orderId=${order.id}`)}
        className="gap-1.5"
      >
        <FileTextIcon className="size-4" aria-hidden="true" />
        Create invoice
      </Button>
    );
  } else if (canPrepareDispatch) {
    primaryAction = (
      <Button
        variant="primary"
        onClick={() => navigate(`/dispatch/new?orderId=${order.id}`)}
        className="gap-1.5"
      >
        <TruckIcon className="size-4" aria-hidden="true" />
        Prepare dispatch
      </Button>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-6xl">
      <RecordHeader
        backTo="/orders"
        backLabel={isSalesman ? "Back to My orders" : "Back to Order inbox"}
        reference={order.orderNumber}
        subtitle={`${order.customer.name} (${order.customer.code}) • Delivery: ${order.deliveryState} • Salesman: ${order.salesman.name}`}
        statuses={
          <>
            <Badge
              variant="outline"
              className={getOrderStatusTone(order.status)}
            >
              Order: {order.status.replaceAll("_", " ")}
            </Badge>
            <Badge variant="outline">
              Fulfilment: {order.fulfilmentStatus.replaceAll("_", " ")}
            </Badge>
          </>
        }
        primaryAction={primaryAction}
        secondaryActions={
          canPrepareDispatch && canCreateInvoice ? (
            <Button
              variant="outline"
              onClick={() => navigate(`/dispatch/new?orderId=${order.id}`)}
              className="gap-1.5"
            >
              <TruckIcon className="size-4" aria-hidden="true" />
              Prepare dispatch
            </Button>
          ) : null
        }
      />

      <LifecycleSteps steps={steps} />

      {order.status === "REJECTED" && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm"
        >
          <XCircleIcon className="size-5 shrink-0 text-destructive mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold text-destructive">Order rejected</p>
            <p className="text-foreground">
              {order.rejectionReason || "No rejection reason recorded."}
            </p>
            {isSalesman && (
              <p className="text-xs text-muted-foreground pt-1">
                Next step: Create a new order with adjusted quantities or contact the admin desk.
              </p>
            )}
          </div>
        </div>
      )}

      {canReview && hasShortage && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50/70 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/30"
        >
          <AlertTriangleIcon
            className="size-5 shrink-0 text-amber-700 dark:text-amber-400 mt-0.5"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              Available-to-promise (ATP) stock shortage detected
            </p>
            <p className="text-amber-800 dark:text-amber-300">
              One or more requested quantities exceed available finished stock. Adjust approved quantities to match available stock (with an override reason), wait for production, or reject the order.
            </p>
          </div>
        </div>
      )}

      {/* Order Lines */}
      <section aria-labelledby="order-lines-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="order-lines-heading" className="text-base font-semibold text-foreground">
            Order lines
          </h2>
          <span className="text-xs text-muted-foreground">
            Created {formatDateTime(order.createdAt)}
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Quoted qty</TableHead>
                <TableHead className="text-right">
                  {canReview ? "Approve qty" : "Approved qty"}
                </TableHead>
                <TableHead className="text-right">Quoted price</TableHead>
                <TableHead className="text-right">
                  {canReview ? "Approve price" : "Approved price"}
                </TableHead>
                {canReview && <TableHead className="text-right">ATP / Shortage</TableHead>}
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Line total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.lines.map((line) => {
                const edit = lineEdits[line.id];
                const stock = getStockForLine(line);
                const reqQty = Number(
                  edit?.approvedQuantity ?? line.approvedQuantity ?? line.quotedQuantity,
                );
                const available = stock?.available;
                const shortage =
                  available !== undefined
                    ? Math.max(0, reqQty - available)
                    : line.liveShortage ?? 0;

                return (
                  <TableRow key={line.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">
                        {line.productVariant.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {line.productVariant.sku}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatQuantity(line.quotedQuantity, { unit: "pkts" })}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {canReview ? (
                        <Input
                          type="number"
                          min={0}
                          step="1"
                          aria-label={`Approved quantity for ${line.productVariant.name}`}
                          value={edit?.approvedQuantity ?? String(line.quotedQuantity)}
                          onChange={(e) =>
                            setLineEdits((prev) => ({
                              ...prev,
                              [line.id]: {
                                ...prev[line.id],
                                approvedQuantity: e.target.value,
                              },
                            }))
                          }
                          className="ml-auto h-9 w-24 text-right tabular-nums"
                        />
                      ) : (
                        formatQuantity(
                          line.approvedQuantity ?? line.quotedQuantity,
                          { unit: "pkts" },
                        )
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatINR(line.quotedUnitPrice)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {canReview ? (
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          aria-label={`Approved unit price for ${line.productVariant.name}`}
                          value={edit?.approvedUnitPrice ?? String(line.quotedUnitPrice)}
                          onChange={(e) =>
                            setLineEdits((prev) => ({
                              ...prev,
                              [line.id]: {
                                ...prev[line.id],
                                approvedUnitPrice: e.target.value,
                              },
                            }))
                          }
                          className="ml-auto h-9 w-28 text-right tabular-nums"
                        />
                      ) : (
                        formatINR(line.approvedUnitPrice ?? line.quotedUnitPrice)
                      )}
                    </TableCell>
                    {canReview && (
                      <TableCell className="text-right tabular-nums text-xs">
                        {available !== undefined ? (
                          <div>
                            <span className="font-medium">
                              ATP: {formatQuantity(available, { unit: "pkts" })}
                            </span>
                            {shortage > 0 && (
                              <div className="text-destructive font-medium">
                                Short: {formatQuantity(shortage, { unit: "pkts" })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                      {line.taxRate}% ({formatINR(line.taxAmount)})
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatINR(line.lineTotal)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Admin Review Decision Panel */}
      {canReview && (
        <section
          aria-labelledby="review-decision-heading"
          className="rounded-lg border border-border bg-card p-4 sm:p-5 space-y-4"
        >
          <div className="space-y-1">
            <h2 id="review-decision-heading" className="text-base font-semibold">
              Commercial review & reservation
            </h2>
            <p className="text-xs text-muted-foreground">
              Approving reserves available finished stock atomically. Invoice posting and physical dispatch happen as separate steps afterwards.
            </p>
          </div>

          {hasOverrides && (
            <div className="space-y-1.5">
              <Label htmlFor="override-reason">
                Override reason <span className="text-destructive">*</span>
              </Label>
              <Input
                id="override-reason"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Explain why approved quantity or price differs from quoted values"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <Button
              variant="destructive"
              onClick={() => setRejectOpen(true)}
              disabled={approveMutation.isPending || rejectMutation.isPending}
              className="gap-1.5"
            >
              <XCircleIcon className="size-4" aria-hidden="true" />
              Reject order
            </Button>
            <Button
              variant="primary"
              onClick={() => approveMutation.mutate()}
              disabled={
                approveMutation.isPending ||
                rejectMutation.isPending ||
                (hasOverrides && !overrideReason.trim())
              }
              className="gap-1.5"
            >
              <CheckCircle2Icon className="size-4" aria-hidden="true" />
              {approveMutation.isPending ? "Approving..." : "Approve order"}
            </Button>
          </div>
        </section>
      )}

      {/* Totals & Linked Records */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-4 space-y-2.5">
          <h2 className="text-sm font-semibold text-foreground">
            Commercial summary
          </h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Taxable value</dt>
              <dd className="tabular-nums">{formatINR(order.taxableAmount)}</dd>
            </div>
            {Number(order.cgstAmount) > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">CGST</dt>
                <dd className="tabular-nums">{formatINR(order.cgstAmount)}</dd>
              </div>
            )}
            {Number(order.sgstAmount) > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">SGST</dt>
                <dd className="tabular-nums">{formatINR(order.sgstAmount)}</dd>
              </div>
            )}
            {Number(order.igstAmount) > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">IGST</dt>
                <dd className="tabular-nums">{formatINR(order.igstAmount)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-2 font-semibold">
              <dt>Total order value</dt>
              <dd className="tabular-nums">{formatINR(order.totalAmount)}</dd>
            </div>
          </dl>
          {order.notes && (
            <div className="border-t border-border pt-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Notes: </span>
              {order.notes}
            </div>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            Linked documents & reservations
          </h2>
          <div className="space-y-2 text-sm">
            {order.invoices && order.invoices.length > 0 ? (
              order.invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                >
                  <div>
                    <span className="font-medium">{inv.invoiceNumber}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({inv.status})
                    </span>
                  </div>
                  <Link
                    to={`/invoices/${inv.id}`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Open invoice
                  </Link>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">
                No GST invoice posted yet.
              </p>
            )}

            {order.dispatches && order.dispatches.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {order.dispatches.map((dsp) => (
                  <div
                    key={dsp.id}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                  >
                    <div>
                      <span className="font-medium">{dsp.dispatchNumber}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({dsp.status})
                      </span>
                    </div>
                    <Link
                      to={`/dispatch/${dsp.id}`}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Open dispatch
                    </Link>
                  </div>
                ))}
              </div>
            )}

            {order.reservations && order.reservations.length > 0 && (
              <p className="text-xs text-muted-foreground pt-1">
                Active stock reservations:{" "}
                <span className="font-medium text-foreground tabular-nums">
                  {order.reservations
                    .filter((r) => r.status === "ACTIVE")
                    .reduce((sum, r) => sum + Number(r.reservedQuantity), 0)}{" "}
                  pkts
                </span>
              </p>
            )}
          </div>
        </section>
      </div>

      <EntityLifecycleTimeline
        entityType="order"
        entityId={order.id}
        description="Complete order story including edits, approvals, dispatches, generated invoices, and allocated payments."
      />

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject order {order.orderNumber}</DialogTitle>
            <DialogDescription>
              Provide a clear reason so the salesman knows what to correct.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="reject-reason">
              Rejection reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reject-reason"
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g., Insufficient stock until Friday batch, or customer credit hold"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectOpen(false)}
              disabled={rejectMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate()}
              disabled={!rejectionReason.trim() || rejectMutation.isPending}
            >
              {rejectMutation.isPending ? "Rejecting..." : "Confirm rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
