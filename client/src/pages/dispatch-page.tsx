import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/use-current-user";
import { apiClient } from "@/lib/api-client";
import { useUrlState } from "@/hooks/use-url-state";
import { formatDateTime, formatQuantity } from "@/lib/formatters";
import { useLanguage } from "@/lib/i18n";
import {
  SkeletonTable,
  ErrorState,
} from "@/components/ui/loading-error-empty";
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
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TruckIcon,
  RefreshCwIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  PlusCircleIcon,
  PackageCheckIcon,
  FileTextIcon,
} from "lucide-react";

interface DispatchLine {
  id: string;
  inventoryItemId: string;
  quantity: number;
  inventoryItem?: {
    sku: string;
    name: string;
    unitOfMeasure: string;
  };
}

interface Dispatch {
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
  lines: DispatchLine[];
}

interface EligibleOrder {
  id: string;
  orderNumber: string;
  status: string;
  fulfilmentStatus: string;
  customer?: {
    name: string;
    state: string;
  };
  lines: Array<{
    id: string;
    approvedQuantity: number;
    dispatchedQuantity: number;
    productVariant?: {
      name: string;
      sku: string;
    };
  }>;
}

export function DispatchPage() {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const { t } = useLanguage();
  const canRecordDispatch = user?.role === "ADMIN";
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [showConfirmDispatchDialog, setShowConfirmDispatchDialog] =
    useState(false);
  const [searchQuery, setSearchQuery] = useUrlState("q", "");

  // 1. Fetch posted dispatches
  const {
    data: dispatchesData,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<{ dispatches: Dispatch[] }>({
    queryKey: ["dispatches"],
    queryFn: async () => {
      const res = await apiClient.get("/sales/dispatches?organizationId=MILL");
      return res.data;
    },
  });

  // 2. Fetch approved orders eligible for dispatch
  const { data: ordersData } = useQuery<{ orders: EligibleOrder[] }>({
    queryKey: ["sales-orders", "eligible-dispatch"],
    queryFn: async () => {
      const res = await apiClient.get("/sales/orders?organizationId=MILL");
      return res.data;
    },
    enabled: showCreateModal,
  });

  const eligibleOrders = (ordersData?.orders ?? []).filter(
    (o) => o.status === "APPROVED" && o.fulfilmentStatus !== "FULFILLED",
  );

  // 3. Create dispatch mutation
  const dispatchMutation = useMutation({
    mutationFn: async (payload: {
      salesOrderId: string;
      vehicleNumber?: string;
      driverName?: string;
      driverPhone?: string;
      notes?: string;
    }) => {
      const res = await apiClient.post("/sales/dispatches", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dispatches"] });
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      setShowConfirmDispatchDialog(false);
      setShowCreateModal(false);
      setSelectedOrderId("");
      setVehicleNumber("");
      setDriverName("");
      setDriverPhone("");
      setNotes("");
      setDispatchError(null);
    },
    onError: (err: any) => {
      setDispatchError(
        err.response?.data?.message ||
          err.message ||
          "Failed to record dispatch",
      );
    },
  });

  const dispatches = dispatchesData?.dispatches ?? [];

  const filteredDispatches = dispatches.filter((d) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      d.dispatchNumber.toLowerCase().includes(q) ||
      d.salesOrder.orderNumber.toLowerCase().includes(q) ||
      d.salesOrder.customer.name.toLowerCase().includes(q) ||
      (d.vehicleNumber && d.vehicleNumber.toLowerCase().includes(q)) ||
      (d.driverName && d.driverName.toLowerCase().includes(q))
    );
  });

  // Summary counts
  const totalDispatches = dispatches.length;
  const totalUnitsDispatched = dispatches.reduce((acc, d) => {
    return (
      acc + d.lines.reduce((lacc, line) => lacc + Number(line.quantity || 0), 0)
    );
  }, 0);

  const handleSubmitDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId) {
      setDispatchError("Please select an approved sales order to dispatch");
      return;
    }
    setDispatchError(null);
    setShowConfirmDispatchDialog(true);
  };

  const handleExecuteDispatch = () => {
    setShowConfirmDispatchDialog(false);
    dispatchMutation.mutate({
      salesOrderId: selectedOrderId,
      vehicleNumber: vehicleNumber.trim() || undefined,
      driverName: driverName.trim() || undefined,
      driverPhone: driverPhone.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {t("Dispatch")}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("Physical stock movements, reservation release, and warehouse fulfillment records")}
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
            {t("Refresh")}
          </Button>
          {canRecordDispatch && (
            <Button
              size="sm"
              onClick={() => {
                setDispatchError(null);
                setShowCreateModal(true);
              }}
              className="gap-2"
            >
              <PlusCircleIcon className="h-4 w-4" />
              {t("Record dispatch")}
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">
              {t("Total dispatches")}
            </span>
            <TruckIcon className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold">{totalDispatches}</div>
          <div className="text-xs text-muted-foreground">
            Completed warehouse dispatches
          </div>
        </div>

        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">
              Quantity dispatched
            </span>
            <PackageCheckIcon className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold">
            {formatQuantity(totalUnitsDispatched, { unit: "units" })}
          </div>
          <div className="text-xs text-muted-foreground">
            Deducted from finished goods stock
          </div>
        </div>

        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">
              Reservations released
            </span>
            <CheckCircle2Icon className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatQuantity(totalUnitsDispatched, { unit: "units" })}
          </div>
          <div className="text-xs text-muted-foreground">
            Atomic reservation release on dispatch
          </div>
        </div>
      </div>

      {/* Dispatches Table */}
      <div className="rounded-xl border bg-card shadow-xs">
        <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">
              {t("Dispatches ledger")}
            </h2>
            <span className="text-xs text-muted-foreground">
              ({filteredDispatches.length} of {dispatches.length})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Input
              placeholder={t("Search dispatches...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-56 text-xs"
              aria-label="Search dispatches"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-4">
            <SkeletonTable rows={5} columns={8} />
          </div>
        ) : isError ? (
          <div className="p-4">
            <ErrorState
              title={t("Failed to load dispatches", "Failed to load dispatches")}
              description={
                error instanceof Error ? error.message : "Failed to load dispatches."
              }
              error={error}
              onRetry={() => refetch()}
            />
          </div>
        ) : dispatches.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-sm text-muted-foreground">
            <TruckIcon className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium text-foreground">No dispatches yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Record a physical dispatch for an approved sales order to deduct
              inventory.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Card Layout (<md viewports per F-047) */}
            <div
              className="divide-y divide-border md:hidden"
              data-slot="mobile-cards"
            >
              {filteredDispatches.length === 0 && dispatches.length > 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  {t("No dispatches match the search query.")}
                </div>
              )}
              {filteredDispatches.map((disp) => (
                <div key={disp.id} className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-semibold text-foreground">
                      {disp.dispatchNumber}
                    </span>
                    <Badge
                      variant={disp.status === "POSTED" ? "success" : "default"}
                    >
                      {disp.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-baseline text-xs">
                    <div>
                      <span className="font-medium text-foreground">
                        {disp.salesOrder?.customer?.name ?? "Unknown"}
                      </span>
                      <span className="ml-1 text-muted-foreground">
                        ({disp.salesOrder?.customer?.city})
                      </span>
                    </div>
                    <span className="text-muted-foreground font-mono text-2xs">
                      {formatDateTime(disp.dispatchedAt)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-2.5 text-xs">
                    <div>
                      <span className="text-muted-foreground text-2xs uppercase">
                        Order & Invoice
                      </span>
                      <p className="font-mono font-medium text-foreground">
                        SO: {disp.salesOrder?.orderNumber ?? "N/A"}
                      </p>
                      {disp.salesInvoice ? (
                        <p className="font-mono text-2xs text-emerald-600 dark:text-emerald-400">
                          INV: {disp.salesInvoice.invoiceNumber}
                        </p>
                      ) : (
                        <p className="text-2xs text-muted-foreground">Direct dispatch</p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-muted-foreground text-2xs uppercase">
                        Vehicle / Driver
                      </span>
                      <p className="font-mono font-medium text-foreground">
                        {disp.vehicleNumber || "None"}
                      </p>
                      {disp.driverName && (
                        <p className="text-2xs text-muted-foreground">
                          {disp.driverName}
                        </p>
                      )}
                    </div>
                  </div>
                  {disp.lines.length > 0 && (
                    <div className="text-2xs text-muted-foreground pt-1">
                      <span className="font-medium">Items: </span>
                      {disp.lines.map((l) => (
                        <span key={l.id} className="inline-block bg-muted px-2 py-0.5 rounded mr-1">
                          {l.inventoryItem?.name} × {l.quantity}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop Table View (md+ viewports) */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Dispatch number")}</TableHead>
                    <TableHead>{t("Date and time")}</TableHead>
                    <TableHead>{t("Sales order")}</TableHead>
                    <TableHead>{t("Customer")}</TableHead>
                    <TableHead>{t("Vehicle and driver")}</TableHead>
                    <TableHead>{t("Dispatched items")}</TableHead>
                    <TableHead>{t("Invoice link")}</TableHead>
                    <TableHead className="text-right">{t("Status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDispatches.length === 0 && dispatches.length > 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        {t("No dispatches match the search query.")}
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredDispatches.map((disp) => (
                    <TableRow key={disp.id}>
                      <TableCell className="font-mono text-sm font-semibold text-foreground">
                        {disp.dispatchNumber}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(disp.dispatchedAt)}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs font-medium">
                          {disp.salesOrder?.orderNumber ?? "N/A"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {disp.salesOrder?.customer?.name ?? "Unknown"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {disp.salesOrder?.customer?.city},{" "}
                            {disp.salesOrder?.customer?.state}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-xs">
                          <span className="font-mono font-medium">
                            {disp.vehicleNumber || "No vehicle specified"}
                          </span>
                          {disp.driverName && (
                            <span className="text-muted-foreground">
                              {disp.driverName}
                              {disp.driverPhone ? ` (${disp.driverPhone})` : ""}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {disp.lines.map((line) => (
                            <div
                              key={line.id}
                              className="flex items-center gap-1.5 text-xs"
                            >
                              <span className="font-medium">
                                {line.inventoryItem?.name || "Product"}
                              </span>
                              <span className="font-mono text-muted-foreground">
                                x {line.quantity}{" "}
                                {line.inventoryItem?.unitOfMeasure || "units"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {disp.salesInvoice ? (
                          <div className="flex items-center gap-1 font-mono text-xs text-emerald-600 dark:text-emerald-400">
                            <FileTextIcon className="h-3 w-3" />
                            {disp.salesInvoice.invoiceNumber}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Direct dispatch
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={
                            disp.status === "POSTED" ? "success" : "default"
                          }
                        >
                          {disp.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>

      {/* Record Dispatch Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <TruckIcon className="h-5 w-5 text-foreground" />
              <DialogTitle>Record physical dispatch</DialogTitle>
            </div>
            <DialogDescription className="sr-only">
              Record physical dispatch and warehouse inventory deduction
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handleSubmitDispatch}
            className="mt-2 flex flex-col gap-4"
          >
              {dispatchError && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertTriangleIcon className="h-4 w-4 shrink-0" />
                  <span>{dispatchError}</span>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="dispatch-order-select"
                  className="text-xs font-semibold text-foreground"
                >
                  Select approved sales order *
                </label>
                {eligibleOrders.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                    No approved orders ready for dispatch. Please approve an
                    order first.
                  </div>
                ) : (
                  <select
                    id="dispatch-order-select"
                    value={selectedOrderId}
                    onChange={(e) => setSelectedOrderId(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
                    required
                  >
                    <option value="">Choose an order to dispatch...</option>
                    {eligibleOrders.map((order) => {
                      const totalQty = order.lines.reduce(
                        (sum, l) =>
                          sum + (l.approvedQuantity - l.dispatchedQuantity),
                        0,
                      );
                      return (
                        <option key={order.id} value={order.id}>
                          {order.orderNumber} (
                          {order.customer?.name || "Customer"}) | Remaining:{" "}
                          {totalQty} units
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="dispatch-vehicle-input"
                    className="text-xs font-semibold text-foreground"
                  >
                    Vehicle number
                  </label>
                  <Input
                    id="dispatch-vehicle-input"
                    placeholder="e.g. TN 38 AB 1234"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="dispatch-driver-name-input"
                    className="text-xs font-semibold text-foreground"
                  >
                    Driver name
                  </label>
                  <Input
                    id="dispatch-driver-name-input"
                    placeholder="e.g. Ravi Kumar"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="dispatch-driver-phone-input"
                  className="text-xs font-semibold text-foreground"
                >
                  Driver phone number
                </label>
                <Input
                  id="dispatch-driver-phone-input"
                  placeholder="e.g. 9876543210"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="dispatch-notes-input"
                  className="text-xs font-semibold text-foreground"
                >
                  Dispatch notes
                </label>
                <Input
                  id="dispatch-notes-input"
                  placeholder="e.g. Dispatched via standard carrier"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div className="mt-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <div className="font-semibold text-foreground">
                  Inventory impact notice:
                </div>
                Posting this dispatch will deduct finished goods from stock on
                hand and release active stock reservations atomically.
              </div>

              <DialogFooter className="border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    dispatchMutation.isPending || eligibleOrders.length === 0
                  }
                  className="gap-2"
                >
                  {dispatchMutation.isPending ? (
                    <RefreshCwIcon className="h-4 w-4 animate-spin" />
                  ) : (
                    <TruckIcon className="h-4 w-4" />
                  )}
                  Confirm dispatch
                </Button>
              </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Irreversible Dispatch (F-048) */}
      {showConfirmDispatchDialog && (
        <ConfirmationDialog
          open={showConfirmDispatchDialog}
          onOpenChange={setShowConfirmDispatchDialog}
          title={
            <div className="flex items-center gap-2 text-foreground font-semibold">
              <AlertTriangleIcon className="h-5 w-5 text-amber-500" />
              Confirm Physical Dispatch?
            </div>
          }
          description={
            <div className="space-y-3 pt-1 text-sm text-foreground">
              <p>
                This action will permanently deduct finished goods from physical
                inventory and generate an immutable dispatch record.
              </p>
              <div className="rounded-lg bg-muted/60 p-3 text-xs space-y-1">
                {eligibleOrders.find((o) => o.id === selectedOrderId) && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sales Order:</span>
                      <span className="font-mono font-medium text-foreground">
                        {
                          eligibleOrders.find((o) => o.id === selectedOrderId)
                            ?.orderNumber
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Customer:</span>
                      <span className="font-medium text-foreground">
                        {
                          eligibleOrders.find((o) => o.id === selectedOrderId)
                            ?.customer?.name
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Quantity to Deduct:
                      </span>
                      <span className="font-semibold text-foreground">
                        {eligibleOrders
                          .find((o) => o.id === selectedOrderId)
                          ?.lines.reduce(
                            (sum, l) =>
                              sum + (l.approvedQuantity - l.dispatchedQuantity),
                            0,
                          )}{" "}
                        packets
                      </span>
                    </div>
                  </>
                )}
                {vehicleNumber.trim() && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vehicle:</span>
                    <span className="font-mono text-foreground">
                      {vehicleNumber.trim()}
                    </span>
                  </div>
                )}
              </div>
              <div className="rounded-md bg-destructive/10 p-2.5 text-xs font-medium text-destructive border border-destructive/20">
                Warning: This operational action cannot be undone. Physical on-hand stock balances will be deducted immediately.
              </div>
            </div>
          }
          confirmLabel={
            dispatchMutation.isPending
              ? "Dispatching..."
              : "Confirm & Deduct Stock"
          }
          cancelLabel="Review details"
          onConfirm={handleExecuteDispatch}
          disabled={dispatchMutation.isPending}
          destructive
        />
      )}
    </div>
  );
}
