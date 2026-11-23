import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/use-current-user";
import { apiClient } from "@/lib/api-client";
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
import {
  TruckIcon,
  RefreshCwIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  PlusCircleIcon,
  PackageCheckIcon,
  FileTextIcon,
  XIcon,
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
              Dispatch
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Physical stock movements, reservation release, and warehouse
            fulfillment records
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
              Record dispatch
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">
              Total dispatches
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
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">
            Dispatches ledger
          </h2>
          <span className="text-xs text-muted-foreground">
            {dispatches.length} dispatches recorded
          </span>
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
            <TruckIcon className="mb-3 h-8 w-8 text-muted-foreground/50" />
            <p className="font-medium text-foreground">No dispatches yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Record a physical dispatch for an approved sales order to deduct
              inventory.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
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
                {dispatches.map((disp) => (
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
        )}
      </div>

      {/* Record Dispatch Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2">
                <TruckIcon className="h-5 w-5 text-foreground" />
                <h3 className="text-lg font-semibold text-foreground">
                  Record physical dispatch
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCreateModal(false)}
                className="h-8 w-8 p-0"
              >
                <XIcon className="h-4 w-4" />
              </Button>
            </div>

            <form
              onSubmit={handleSubmitDispatch}
              className="mt-4 flex flex-col gap-4"
            >
              {dispatchError && (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertTriangleIcon className="h-4 w-4 shrink-0" />
                  <span>{dispatchError}</span>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Select approved sales order *
                </label>
                {eligibleOrders.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                    No approved orders ready for dispatch. Please approve an
                    order first.
                  </div>
                ) : (
                  <select
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
                  <label className="text-xs font-semibold text-foreground">
                    Vehicle number
                  </label>
                  <Input
                    placeholder="e.g. TN 38 AB 1234"
                    value={vehicleNumber}
                    onChange={(e) => setVehicleNumber(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Driver name
                  </label>
                  <Input
                    placeholder="e.g. Ravi Kumar"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Driver phone number
                </label>
                <Input
                  placeholder="e.g. 9876543210"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Dispatch notes
                </label>
                <Input
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

              <div className="flex items-center justify-end gap-2 border-t pt-4">
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
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
