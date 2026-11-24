import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useUrlState } from "@/hooks/use-url-state";
import { formatINR, formatQuantity } from "@/lib/formatters";
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
import { DomainTooltip } from "@/components/ui/domain-tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ShoppingCartIcon,
  RefreshCwIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  PlusCircleIcon,
  ShieldCheckIcon,
  IndianRupeeIcon,
  DatabaseIcon,
  WifiOffIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useSyncManager } from "@/offline/use-offline";
import { toast } from "sonner";

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
  invoices?: Array<{
    id: string;
    invoiceNumber: string;
    status: string;
    totalAmount: number;
  }>;
}

export function OrdersPage() {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const { t } = useLanguage();
  const syncManager = useSyncManager(user?.id);
  const {
    isOnline,
    outboxOrders,
    pendingCount,
    queueOrder,
    retryOrder,
    removeOrder,
  } = syncManager;

  const [activeTab, setActiveTab] = useUrlState<"stream" | "outbox">("tab", "stream", { replace: false });
  const [statusFilter, setStatusFilter] = useUrlState("status", "ALL");
  const [searchQuery, setSearchQuery] = useUrlState("q", "");
  const canCreateOrder = user?.role === "ADMIN" || user?.role === "SALESMAN";
  const canApproveOrder = user?.role === "ADMIN";
  const canCreateInvoice = user?.role === "ADMIN";
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [selectedOrderForAction, setSelectedOrderForAction] =
    useState<SalesOrder | null>(null);
  const [actionType, setActionType] = useState<"APPROVE" | "REJECT" | null>(
    null,
  );
  const [rejectionReason, setRejectionReason] = useState("Stock unavailable");

  // Form states
  const [selectedCustomerId, setSelectedCustomerId] = useState("CUST-RET-A");
  const [selectedProductId, setSelectedProductId] = useState("VAR-MURUKKU-200G");
  const [orderQuantity, setOrderQuantity] = useState(150);
  const [orderNotes, setOrderNotes] = useState("Benchmark wholesale order");

  // Fetch orders
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{
    orders: SalesOrder[];
  }>({
    queryKey: ["sales-orders"],
    queryFn: async () => {
      const res = await apiClient.get("/sales/orders?organizationId=MILL");
      return res.data;
    },
  });

  // Fetch customers dynamically (MLD-010)
  const { data: customersData } = useQuery({
    queryKey: ["sales-customers"],
    queryFn: async () => {
      const res = await apiClient.get<{
        customers: Array<{
          id: string;
          code: string;
          name: string;
          state: string;
          gstin?: string;
        }>;
      }>("/sales/customers");
      return res.data.customers;
    },
  });

  // Fetch products dynamically (MLD-010)
  const { data: productsData } = useQuery({
    queryKey: ["sales-products"],
    queryFn: async () => {
      const res = await apiClient.get<{
        products: Array<{
          id: string;
          sku: string;
          name: string;
          defaultPrice: number;
          taxRate: number;
        }>;
      }>("/sales/products");
      return res.data.products;
    },
  });

  const customersList = customersData || [
    {
      id: "CUST-RET-A",
      code: "CUST-RET-A",
      name: "Retailer A",
      state: "Tamil Nadu",
    },
    {
      id: "CUST-DIST-B",
      code: "CUST-DIST-B",
      name: "Distributor B",
      state: "Karnataka",
    },
  ];

  const productsList = productsData || [
    {
      id: "VAR-MURUKKU-200G",
      sku: "VAR-MURUKKU-200G",
      name: "Murukku 200 g",
      defaultPrice: 50.0,
      taxRate: 5.0,
    },
  ];

  const activeCustomer =
    customersList.find(
      (c) => c.id === selectedCustomerId || c.code === selectedCustomerId,
    ) || customersList[0];

  const activeProduct =
    productsList.find(
      (p) => p.id === selectedProductId || p.sku === selectedProductId,
    ) || productsList[0];

  // Fetch current available stock for selected product
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

  const productStock = stockData?.balances.find(
    (b) =>
      b.sku === activeProduct.sku ||
      (b.sku === "FG-MURUKKU-200G" &&
        activeProduct.sku.includes("MURUKKU")),
  );
  const availablePackets = productStock?.available ?? 0;
  const currentShortage = Math.max(0, orderQuantity - availablePackets);

  // Dynamic tax calculation
  const customerState = activeCustomer.state || "Tamil Nadu";
  const isIntraState = customerState.trim().toLowerCase() === "tamil nadu";

  const unitPrice = Number(activeProduct.defaultPrice || 50.0);
  const taxPct = Number(activeProduct.taxRate || 5.0) / 100;
  const calculatedTaxable = orderQuantity * unitPrice;
  const calculatedTax = calculatedTaxable * taxPct;
  const calculatedTotal = calculatedTaxable + calculatedTax;

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post("/sales/orders", {
        organizationId: "MILL",
        customerId: activeCustomer.id,
        orderNumber: `SO-2026-${Date.now().toString().slice(-4)}`,
        notes: orderNotes,
        lines: [
          {
            productVariantId: activeProduct.id,
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

  const handleCreateOrder = async () => {
    const customerId = activeCustomer.id;
    const customerName = activeCustomer.name;
    const items = [
      {
        productVariantId: activeProduct.id,
        sku: activeProduct.sku,
        name: activeProduct.name,
        quantity: orderQuantity,
        quotedUnitPrice: unitPrice,
      },
    ];

    if (!isOnline) {
      await queueOrder(
        {
          customerId,
          customerName,
          customerState,
          notes: orderNotes,
          items,
        },
        user?.id || "guest",
      );
      toast.info(
        "Offline: Order saved locally in device outbox. No stock reserved until synced.",
      );
      setShowNewOrderModal(false);
      return;
    }

    setIsSubmittingOrder(true);
    try {
      await createOrderMutation.mutateAsync();
      toast.success("Sales order created successfully.");
    } catch (err: any) {
      if (!err.response) {
        // Network drop during submit: queue into outbox
        await queueOrder(
          {
            customerId,
            customerName,
            customerState,
            notes: orderNotes,
            items,
          },
          user?.id || "guest",
        );
        toast.warning(
          "Network connection lost. Order queued locally in device outbox.",
        );
        setShowNewOrderModal(false);
      } else {
        toast.error(
          err.response?.data?.message ||
            err.response?.data?.error ||
            "Failed to create order",
        );
      }
    } finally {
      setIsSubmittingOrder(false);
    }
  };

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

  // Create invoice mutation (F-037)
  const createInvoiceMutation = useMutation({
    mutationFn: async (salesOrderId: string) => {
      const res = await apiClient.post("/finance/invoices", { salesOrderId });
      return res.data;
    },
    onSuccess: (invoice) => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      queryClient.invalidateQueries({ queryKey: ["finance-invoices"] });
      toast.success(
        `Invoice ${invoice.invoiceNumber ?? "generated"} posted successfully`,
      );
    },
    onError: (err: any) => {
      toast.error(
        err.response?.data?.message || err.message || "Failed to create invoice",
      );
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

  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchNum = o.orderNumber.toLowerCase().includes(q);
      const matchCust =
        o.customer.name.toLowerCase().includes(q) ||
        o.customer.code.toLowerCase().includes(q);
      const matchNotes = (o.notes || "").toLowerCase().includes(q);
      if (!matchNum && !matchCust && !matchNotes) return false;
    }
    return true;
  });

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
              {t("Orders")}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("Salesman mobile orders, admin approval, shortages, and atomic stock reservations")}
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

          {canCreateOrder && (
            <Button
              size="sm"
              onClick={() => setShowNewOrderModal(true)}
              className="gap-2"
            >
              <PlusCircleIcon className="h-4 w-4" />
              {t("New sales order")}
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">
              {t("Total orders")}
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
              {t("Approved bookings")}
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
              {t("Booked value")}
            </span>
            <IndianRupeeIcon className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold">
            {formatINR(totalRevenueBooked)}
          </div>
          <div className="text-xs text-muted-foreground">
            Approved orders inclusive of GST
          </div>
        </div>

        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <DomainTooltip term="ATP">
              <span className="text-xs font-medium uppercase tracking-wider">
                Available to promise (ATP)
              </span>
            </DomainTooltip>
            <CheckCircle2Icon className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono">
            {formatQuantity(availablePackets, { unit: "pkts" })}
          </div>
          <div className="text-xs text-muted-foreground">
            Murukku 200g net of active reservations
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-xl border bg-card shadow-xs">
        <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === "stream" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("stream")}
              className="text-xs h-7 font-medium cursor-pointer"
            >
              All orders ({orders.length})
            </Button>
            <Button
              variant={activeTab === "outbox" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("outbox")}
              className="text-xs h-7 font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <DatabaseIcon className="size-3" />
              Device outbox
              {pendingCount > 0 && (
                <span className="rounded-full bg-amber-500/20 px-1.5 py-0.2 text-2xs font-bold text-amber-700 dark:text-amber-400">
                  {pendingCount}
                </span>
              )}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder={t("Search orders...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-44 text-xs"
              aria-label="Search orders"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-label="Filter orders by status"
            >
              <option value="ALL">All statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="DISPATCHED">Dispatched</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <span className="text-xs text-muted-foreground ml-1">
              {activeTab === "stream"
                ? `${filteredOrders.length} of ${orders.length} orders`
                : `${outboxOrders.length} local orders`}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="p-4">
            <SkeletonTable rows={6} columns={8} />
          </div>
        ) : isError ? (
          <div className="p-4">
            <ErrorState
              title={t("Failed to load sales orders", "Failed to load sales orders")}
              description={
                error instanceof Error ? error.message : "An unexpected server error occurred."
              }
              error={error}
              onRetry={() => refetch()}
            />
          </div>
        ) : activeTab === "stream" &&
          orders.length === 0 &&
          outboxOrders.filter((o) => o.status !== "synced").length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12 text-center text-sm text-muted-foreground">
            <ShoppingCartIcon className="h-8 w-8 stroke-1 text-muted-foreground/60" />
            <p>No sales orders created yet.</p>
            {canCreateOrder && (
              <Button
                size="sm"
                onClick={() => setShowNewOrderModal(true)}
                className="gap-2"
              >
                <PlusCircleIcon className="h-4 w-4" />
                Create first order
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Card Layout (<md viewports per F-047) */}
            <div
              className="divide-y divide-border md:hidden"
              data-slot="mobile-cards"
            >
              {/* Local outbox items shown on mobile */}
              {(activeTab === "outbox"
                ? outboxOrders
                : outboxOrders.filter((o) => o.status !== "synced")
              ).map((ord) => {
                const qty = ord.items.reduce((s, it) => s + it.quantity, 0);
                const taxable = ord.items.reduce(
                  (s, it) => s + it.quantity * it.quotedUnitPrice,
                  0,
                );
                const total = taxable * 1.05;
                return (
                  <div key={ord.id} className="p-4 bg-amber-500/5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-mono text-sm font-semibold text-foreground">
                        <DatabaseIcon className="size-3.5 text-amber-600 shrink-0" />
                        <span>Local: {ord.id.slice(-6).toUpperCase()}</span>
                      </div>
                      <Badge
                        variant="outline"
                        className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-xs"
                      >
                        {ord.status === "queued" ? "Waiting to sync" : ord.status}
                      </Badge>
                    </div>

                    <div className="flex justify-between items-baseline text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {ord.customerName} ({ord.customerState})
                      </span>
                      <span>You (Outbox)</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 rounded-lg bg-card/60 p-2.5 border text-xs">
                      <div>
                        <span className="text-muted-foreground text-2xs uppercase">
                          Ordered
                        </span>
                        <p className="font-medium text-foreground">
                          {formatQuantity(qty, { unit: "pkts" })}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-muted-foreground text-2xs uppercase">
                          Total
                        </span>
                        <p className="font-bold text-foreground">
                          {formatINR(total)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      {ord.status === "queued" && isOnline && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => retryOrder(ord.id)}
                          className="min-h-[44px] px-4 text-xs gap-1.5"
                        >
                          <RefreshCwIcon className="size-3.5" />
                          Sync Now
                        </Button>
                      )}
                      {ord.status !== "syncing" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOrder(ord.id)}
                          className="min-h-[44px] px-3 text-xs text-muted-foreground hover:text-destructive"
                          aria-label="Remove outbox order"
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Server orders shown on mobile */}
              {activeTab === "stream" &&
                filteredOrders.length === 0 &&
                orders.length > 0 && (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    {t("No orders match the selected filters.")}
                  </div>
                )}

              {activeTab === "stream" &&
                filteredOrders.map((o) => {
                  const line = o.lines[0];
                  const qty = Number(line?.quotedQuantity ?? 0);
                  const shortage = o.totalShortage ?? 0;

                  return (
                    <div key={o.id} className="p-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-semibold text-foreground">
                          {o.orderNumber}
                        </span>
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
                      </div>

                      <div className="flex justify-between items-baseline text-xs">
                        <span className="font-medium text-foreground">
                          {o.customer.name}
                        </span>
                        <span className="text-muted-foreground">
                          {o.salesman.name}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-2.5 text-xs">
                        <div>
                          <span className="text-muted-foreground text-2xs uppercase">
                            Ordered
                          </span>
                          <p className="font-medium text-foreground">
                            {formatQuantity(qty, { unit: "pkts" })}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-2xs uppercase">
                            Shortage
                          </span>
                          <p
                            className={
                              shortage > 0
                                ? "font-semibold text-amber-600"
                                : "text-muted-foreground"
                            }
                          >
                            {shortage > 0 ? `${shortage} pkts` : "None"}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-muted-foreground text-2xs uppercase">
                            Total
                          </span>
                          <p className="font-bold text-foreground">
                            {formatINR(o.totalAmount)}
                          </p>
                        </div>
                      </div>

                      {/* Action buttons (min 44px tap target height) */}
                      <div className="flex items-center justify-end gap-2 pt-1">
                        {o.status === "SUBMITTED" && canApproveOrder ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedOrderForAction(o);
                                setActionType("APPROVE");
                              }}
                              className="min-h-[44px] px-4 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
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
                              className="min-h-[44px] px-4 text-xs text-destructive hover:bg-destructive/10"
                            >
                              Reject
                            </Button>
                          </>
                        ) : (
                          o.status === "APPROVED" &&
                          (o.invoices && o.invoices.length > 0 ? (
                            <Badge variant="secondary" className="text-xs">
                              Invoiced ({o.invoices[0].invoiceNumber})
                            </Badge>
                          ) : canCreateInvoice ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => createInvoiceMutation.mutate(o.id)}
                              disabled={createInvoiceMutation.isPending}
                              className="min-h-[44px] px-4 text-xs font-semibold text-primary hover:bg-primary/10 border-primary/30"
                            >
                              {createInvoiceMutation.isPending
                                ? "Invoicing..."
                                : "Invoice Order"}
                            </Button>
                          ) : null)
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Desktop Table View (md+ viewports) */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Order number")}</TableHead>
                  <TableHead>{t("Status")}</TableHead>
                  <TableHead>{t("Customer")}</TableHead>
                  <TableHead>{t("Salesman")}</TableHead>
                  <TableHead className="text-right">{t("Ordered")}</TableHead>
                  <TableHead className="text-right">{t("Taxable")}</TableHead>
                  <TableHead className="text-right">{t("GST")}</TableHead>
                  <TableHead className="text-right">{t("Total")}</TableHead>
                  <TableHead>{t("Shortage status")}</TableHead>
                  <TableHead className="text-right">{t("Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Local outbox items shown at the top of stream or in outbox tab */}
                {(activeTab === "outbox"
                  ? outboxOrders
                  : outboxOrders.filter((o) => o.status !== "synced")
                ).map((ord) => {
                  const qty = ord.items.reduce((s, it) => s + it.quantity, 0);
                  const taxable = ord.items.reduce(
                    (s, it) => s + it.quantity * it.quotedUnitPrice,
                    0,
                  );
                  const gst = taxable * 0.05;
                  const total = taxable + gst;

                  return (
                    <TableRow key={ord.id} className="bg-amber-500/5">
                      <TableCell className="font-mono font-medium">
                        <div className="flex items-center gap-1.5">
                          <DatabaseIcon className="size-3.5 text-amber-600 shrink-0" />
                          <span>Local: {ord.id.slice(-6).toUpperCase()}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {ord.status === "queued" && (
                          <Badge
                            variant="outline"
                            className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
                          >
                            Waiting to sync
                          </Badge>
                        )}
                        {ord.status === "syncing" && (
                          <Badge
                            variant="outline"
                            className="animate-pulse bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20"
                          >
                            Syncing...
                          </Badge>
                        )}
                        {ord.status === "conflict" && (
                          <Badge variant="danger">
                            Conflict: {ord.lastErrorCode ?? "Error"}
                          </Badge>
                        )}
                        {ord.status === "synced" && (
                          <Badge variant="success">
                            Synced: {ord.serverOrderNumber ?? "OK"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {ord.customerName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {ord.customerState}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        You (Device outbox)
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatQuantity(qty, { unit: "pkts" })}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatINR(taxable)}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {formatINR(gst)}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatINR(total)}
                      </TableCell>
                      <TableCell>
                        <span className="text-2xs text-amber-700 dark:text-amber-400 font-medium">
                          Awaiting server acceptance
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {ord.status === "conflict" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => retryOrder(ord.id)}
                              className="h-6 px-2 text-2xs gap-1"
                            >
                              <RotateCcwIcon className="size-3" />
                              Retry
                            </Button>
                          )}
                          {ord.status === "queued" && isOnline && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => retryOrder(ord.id)}
                              className="h-6 px-2 text-2xs gap-1"
                            >
                              <RefreshCwIcon className="size-3" />
                              Sync
                            </Button>
                          )}
                          {ord.status !== "syncing" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeOrder(ord.id)}
                              className="h-6 px-2 text-2xs text-muted-foreground hover:text-destructive"
                            >
                              <Trash2Icon className="size-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {/* Server orders stream */}
                {activeTab === "stream" &&
                  filteredOrders.length === 0 &&
                  orders.length > 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={10}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        {t("No orders match the selected filters.")}
                      </TableCell>
                    </TableRow>
                  )}
                {activeTab === "stream" &&
                  filteredOrders.map((o) => {
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
                          {formatQuantity(qty, { unit: "pkts" })}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatINR(o.taxableAmount)}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {Number(o.igstAmount) > 0 ? (
                            <span>
                              IGST: {formatINR(o.igstAmount)}
                            </span>
                          ) : (
                            <span>
                              CGST/SGST:{" "}
                              {formatINR(
                                Number(o.cgstAmount) + Number(o.sgstAmount)
                              )}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-bold text-foreground">
                          {formatINR(o.totalAmount)}
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
                          {o.status === "SUBMITTED" && canApproveOrder ? (
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
                          ) : o.status === "APPROVED" ? (
                            <div className="flex items-center justify-end gap-1.5">
                              {o.invoices && o.invoices.length > 0 ? (
                                <Badge variant="secondary" className="text-xs">
                                  Invoiced ({o.invoices[0].invoiceNumber})
                                </Badge>
                              ) : canCreateInvoice ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    createInvoiceMutation.mutate(o.id)
                                  }
                                  disabled={createInvoiceMutation.isPending}
                                  className="h-7 text-xs text-primary hover:bg-primary/10 border-primary/30"
                                >
                                  {createInvoiceMutation.isPending
                                    ? "Invoicing..."
                                    : "Invoice Order"}
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">
                                  Approved
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              {o.status === "SUBMITTED"
                                ? "Pending approval"
                                : o.status === "REJECTED"
                                  ? "Rejected"
                                  : "Completed"}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>

      {/* New Order Modal */}
      <Dialog open={showNewOrderModal} onOpenChange={setShowNewOrderModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create sales order</DialogTitle>
            <DialogDescription>
              Select customer and enter order quantities
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 flex flex-col gap-4">
            {/* Offline mode banner */}
              {!isOnline && (
                <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 border border-amber-500/20">
                  <WifiOffIcon className="size-4 shrink-0 text-amber-600" />
                  <span>
                    Offline mode active: Order will be saved locally in device
                    outbox. No stock reserved until synchronized.
                  </span>
                </div>
              )}

              {/* Customer selection */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="order-customer-select"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  Customer
                </label>
                <select
                  id="order-customer-select"
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="rounded-md border bg-background px-3 py-2 text-sm font-medium"
                >
                  {customersList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.state},{" "}
                      {c.state?.trim().toLowerCase() === "tamil nadu"
                        ? "Intra-state"
                        : "Inter-state"}
                      )
                    </option>
                  ))}
                </select>
                <span className="text-xs text-muted-foreground">
                  Place of supply: {customerState} (
                  {isIntraState ? "CGST 2.5% + SGST 2.5%" : "IGST 5.0%"})
                </span>
              </div>

              {/* Product and Quantity */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="order-product-select"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Product item
                  </label>
                  <select
                    id="order-product-select"
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="rounded-md border bg-background px-3 py-2 text-sm font-medium"
                  >
                    {productsList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({formatINR(p.defaultPrice)})
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-muted-foreground">
                    Standard price: {formatINR(unitPrice)} / pkt
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="order-quantity-input"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Order quantity (pkts)
                  </label>
                  <input
                    id="order-quantity-input"
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
                <label
                  htmlFor="order-notes-input"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  Order notes
                </label>
                <input
                  id="order-notes-input"
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
                    {formatINR(calculatedTaxable)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    GST (5% {isIntraState ? "CGST + SGST" : "IGST"}):
                  </span>
                  <span className="font-semibold">
                    {formatINR(calculatedTax)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-1 font-bold text-sm">
                  <span>Total order amount:</span>
                  <span className="text-foreground">
                    {formatINR(calculatedTotal)}
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter className="mt-6 border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNewOrderModal(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreateOrder}
                disabled={isSubmittingOrder || createOrderMutation.isPending}
                className="gap-2 cursor-pointer"
              >
                {isSubmittingOrder || createOrderMutation.isPending ? (
                  <>
                    <RefreshCwIcon className="h-4 w-4 animate-spin" />
                    {isOnline ? "Submitting order..." : "Saving locally..."}
                  </>
                ) : (
                  <>
                    <CheckCircle2Icon className="h-4 w-4" />
                    {isOnline ? "Submit sales order" : "Save to device outbox"}
                  </>
                )}
              </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rejection Confirmation Dialog for Irreversible Action (F-048) */}
      {selectedOrderForAction && actionType === "REJECT" && (
        <ConfirmationDialog
          open={selectedOrderForAction !== null && actionType === "REJECT"}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedOrderForAction(null);
              setActionType(null);
            }
          }}
          title={
            <div className="flex items-center gap-2 text-destructive font-semibold">
              <AlertTriangleIcon className="h-5 w-5" />
              Confirm Sales Order Rejection?
            </div>
          }
          description={
            <div className="space-y-3 pt-1 text-sm text-foreground">
              <p>
                Rejecting this order will permanently cancel order{" "}
                <span className="font-mono font-semibold">
                  {selectedOrderForAction.orderNumber}
                </span>{" "}
                for{" "}
                <span className="font-semibold">
                  {selectedOrderForAction.customer.name}
                </span>{" "}
                and release all stock reservations back to inventory.
              </p>
              <div className="rounded-lg bg-destructive/10 p-2.5 text-xs font-medium text-destructive border border-destructive/20">
                Warning: This action is irreversible. The customer booking will be permanently cancelled.
              </div>
            </div>
          }
          confirmLabel={
            rejectMutation.isPending ? "Rejecting..." : "Confirm Rejection"
          }
          cancelLabel="Cancel"
          onConfirm={() =>
            rejectMutation.mutate({
              orderId: selectedOrderForAction.id,
              reason: rejectionReason,
            })
          }
          disabled={rejectMutation.isPending}
          destructive
        >
          <div className="flex flex-col gap-1.5 pt-2">
            <label
              htmlFor="rejection-reason"
              className="text-xs font-semibold text-muted-foreground"
            >
              Reason for rejection
            </label>
            <Input
              id="rejection-reason"
              type="text"
              placeholder="e.g. Credit limit exceeded, invalid delivery location..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="text-sm"
            />
          </div>
        </ConfirmationDialog>
      )}

      {/* Approve Dialog */}
      <Dialog
        open={selectedOrderForAction !== null && actionType === "APPROVE"}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOrderForAction(null);
            setActionType(null);
          }
        }}
      >
        {selectedOrderForAction && actionType === "APPROVE" && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Approve sales order</DialogTitle>
              <DialogDescription>
                Order {selectedOrderForAction.orderNumber} for{" "}
                {selectedOrderForAction.customer.name} (
                {Number(selectedOrderForAction.lines[0]?.quotedQuantity)} packets)
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3">
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

            <DialogFooter className="mt-6 border-t pt-4">
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
              <Button
                size="sm"
                onClick={() =>
                  approveMutation.mutate(selectedOrderForAction.id)
                }
                disabled={approveMutation.isPending}
                className="gap-2"
              >
                <CheckCircle2Icon className="h-4 w-4" />
                Confirm approval
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
