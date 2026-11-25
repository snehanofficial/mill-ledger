import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { useUrlState } from "@/hooks/use-url-state";
import { formatINR, formatQuantity } from "@/lib/formatters";
import { useLanguage } from "@/lib/i18n";
import { EmptyState, SkeletonTable, ErrorState } from "@/components/ui/loading-error-empty";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  ClockIcon,
  PencilIcon,
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

interface NewOrderLineInput {
  key: string;
  productVariantId: string;
  quantity: number;
  discountPct: number;
}

function computeDiscountedUnitPrice(
  listPrice: number,
  discountPct: number,
): number {
  if (discountPct <= 0) return listPrice;
  const raw = listPrice * (1 - discountPct / 100);
  let rounded = Math.max(0, Math.round(raw * 100) / 100);
  if (discountPct <= 15 && listPrice > 0) {
    const actualPct = ((listPrice - rounded) / listPrice) * 100;
    if (actualPct > 15.0001) {
      rounded = Math.min(
        listPrice,
        Math.round((rounded + 0.01) * 100) / 100,
      );
    }
  }
  return rounded;
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

  const [activeTab, setActiveTab] = useUrlState<"stream" | "outbox">(
    "tab",
    "stream",
    { replace: false },
  );
  const [statusFilter, setStatusFilter] = useUrlState("status", "ALL");
  const [searchQuery, setSearchQuery] = useUrlState("q", "", {
    debounceMs: 250,
  });
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
  const [approvalLines, setApprovalLines] = useState<
    Array<{
      lineId: string;
      productName: string;
      quotedQuantity: number;
      quotedUnitPrice: number;
      approvedQuantity: number;
      approvedUnitPrice: number;
    }>
  >([]);
  const [overrideReason, setOverrideReason] = useState("");
  const [editingDraftOrder, setEditingDraftOrder] = useState<SalesOrder | null>(
    null,
  );
  const [draftProductId, setDraftProductId] = useState("");
  const [draftQuantity, setDraftQuantity] = useState(1);
  const [draftUnitPrice, setDraftUnitPrice] = useState(50);
  const [draftNotes, setDraftNotes] = useState("");

  const openApproveDialog = (order: SalesOrder) => {
    setSelectedOrderForAction(order);
    setActionType("APPROVE");
    setOverrideReason("");
    setApprovalLines(
      order.lines.map((l) => ({
        lineId: l.id,
        productName: l.productVariant?.name || l.productVariant?.sku || "Item",
        quotedQuantity: Number(l.quotedQuantity),
        quotedUnitPrice: Number(l.quotedUnitPrice),
        approvedQuantity: Number(l.quotedQuantity),
        approvedUnitPrice: Number(l.quotedUnitPrice),
      })),
    );
  };

  const openEditDraftDialog = (order: SalesOrder) => {
    const firstLine = order.lines[0];
    setEditingDraftOrder(order);
    setDraftProductId(firstLine?.productVariantId || productsList[0]?.id || "");
    setDraftQuantity(Number(firstLine?.quotedQuantity || 1));
    setDraftUnitPrice(Number(firstLine?.quotedUnitPrice || 50));
    setDraftNotes(order.notes || "");
  };

  // Form states
  const [selectedCustomerId, setSelectedCustomerId] = useState("CUST-RET-A");
  const [orderLines, setOrderLines] = useState<NewOrderLineInput[]>([
    {
      key: "line-initial",
      productVariantId: "VAR-MURUKKU-200G",
      quantity: 150,
      discountPct: 0,
    },
  ]);
  const [orderNotes, setOrderNotes] = useState("Benchmark wholesale order");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Fetch orders (paginated - F-074)
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{
    orders: SalesOrder[];
    pagination?: { limit: number; offset: number; count: number };
  }>({
    queryKey: ["sales-orders", page],
    queryFn: async () => {
      const res = await apiClient.get(
        `/sales/orders?organizationId=MILL&limit=${pageSize}&offset=${(page - 1) * pageSize}`,
      );
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
          imageUrl?: string;
          thumbnailUrl?: string;
          thumbHash?: string;
        }>;
      }>("/sales/products?limit=100");
      return res.data.products;
    },
  });

  const customersList = customersData?.length
    ? customersData
    : [
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

  const productsList = productsData?.length
    ? productsData
    : [
        {
          id: "VAR-MURUKKU-200G",
          sku: "VAR-MURUKKU-200G",
          name: "Murukku 200 g",
          defaultPrice: 50.0,
          taxRate: 5.0,
          imageUrl: "/products/murukku.svg",
          thumbnailUrl: "/products/murukku.svg",
          thumbHash: "1QcSHQRnh493V4dIh4eXh1h4h4h4",
        },
      ];

  const activeCustomer =
    customersList.find(
      (c) => c.id === selectedCustomerId || c.code === selectedCustomerId,
    ) || customersList[0];

  // Fetch current available stock for products
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

  const getAvailableStockForProduct = (product?: { sku: string }) => {
    if (!product) return 0;
    const stock = stockData?.balances.find(
      (b) =>
        b.sku === product.sku ||
        (b.sku === "FG-MURUKKU-200G" && product.sku.includes("MURUKKU")),
    );
    return stock?.available ?? 0;
  };

  // Dynamic tax and per-line discount calculation
  const customerState = activeCustomer?.state || "Tamil Nadu";
  const isIntraState = customerState.trim().toLowerCase() === "tamil nadu";

  const computedOrderLines = orderLines.map((line) => {
    const product =
      productsList.find(
        (p) => p.id === line.productVariantId || p.sku === line.productVariantId,
      ) || productsList[0];
    const listPrice = Number(product?.defaultPrice ?? 50.0);
    const discountPct = Number.isFinite(line.discountPct)
      ? line.discountPct
      : 0;
    const isDiscountInvalid = discountPct < 0 || discountPct > 15;
    const clampedDiscount = Math.min(15, Math.max(0, discountPct));
    const unitPrice = computeDiscountedUnitPrice(listPrice, clampedDiscount);
    const requiresManagerApproval = discountPct > 5 && discountPct <= 15;
    const quantity = Number.isFinite(line.quantity) ? line.quantity : 0;
    const isQuantityInvalid = quantity <= 0;
    const availablePackets = getAvailableStockForProduct(product);
    const shortage = Math.max(0, quantity - availablePackets);
    const taxRatePct = Number(product?.taxRate ?? 5.0);
    const taxable = quantity * unitPrice;
    const tax = taxable * (taxRatePct / 100);
    const lineTotal = taxable + tax;
    const discountSavings = Math.max(0, (listPrice - unitPrice) * quantity);

    return {
      key: line.key,
      product,
      quantity,
      discountPct,
      listPrice,
      unitPrice,
      isDiscountInvalid,
      requiresManagerApproval,
      isQuantityInvalid,
      availablePackets,
      shortage,
      taxRatePct,
      taxable,
      tax,
      lineTotal,
      discountSavings,
    };
  });

  const calculatedTaxable = computedOrderLines.reduce(
    (sum, l) => sum + l.taxable,
    0,
  );
  const calculatedTax = computedOrderLines.reduce((sum, l) => sum + l.tax, 0);
  const calculatedTotal = calculatedTaxable + calculatedTax;
  const totalDiscountSavings = computedOrderLines.reduce(
    (sum, l) => sum + l.discountSavings,
    0,
  );
  const hasManagerApprovalDiscount = computedOrderLines.some(
    (l) => l.requiresManagerApproval,
  );
  const hasInvalidOrderLine =
    computedOrderLines.length === 0 ||
    computedOrderLines.some(
      (l) => !l.product || l.isQuantityInvalid || l.isDiscountInvalid,
    );
  const remainingProducts = productsList.filter(
    (p) => !orderLines.some((l) => l.productVariantId === p.id),
  );

  const openNewOrderModal = () => {
    const defaultProduct = productsList[0];
    setOrderLines([
      {
        key: `line-${Date.now()}`,
        productVariantId: defaultProduct?.id || "VAR-MURUKKU-200G",
        quantity: 150,
        discountPct: 0,
      },
    ]);
    setShowNewOrderModal(true);
  };

  const addOrderLine = () => {
    const nextProduct = remainingProducts[0];
    if (!nextProduct) return;
    setOrderLines((prev) => [
      ...prev,
      {
        key: `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        productVariantId: nextProduct.id,
        quantity: 1,
        discountPct: 0,
      },
    ]);
  };

  const removeOrderLine = (key: string) => {
    setOrderLines((prev) =>
      prev.length > 1 ? prev.filter((l) => l.key !== key) : prev,
    );
  };

  const updateOrderLine = (
    key: string,
    patch: Partial<Omit<NewOrderLineInput, "key">>,
  ) => {
    setOrderLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    );
  };

  // Create order mutation (optimistic cache insert with rollback)
  const createOrderMutation = useMutation({
    mutationFn: async (status: "DRAFT" | "SUBMITTED" = "SUBMITTED") => {
      if (!activeCustomer || hasInvalidOrderLine) {
        throw new Error(
          "Customer and at least one valid product line are required to create an order.",
        );
      }
      const res = await apiClient.post("/sales/orders", {
        organizationId: "MILL",
        customerId: activeCustomer.id,
        status,
        notes: orderNotes,
        lines: computedOrderLines.map((l) => ({
          productVariantId: l.product!.id,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
      });
      return res.data;
    },
    onMutate: async (status: "DRAFT" | "SUBMITTED" = "SUBMITTED") => {
      if (!activeCustomer || hasInvalidOrderLine) return {};
      await queryClient.cancelQueries({ queryKey: ["sales-orders"] });
      const previousQueries = queryClient.getQueriesData<{ orders: SalesOrder[] }>({
        queryKey: ["sales-orders"],
      });

      const optimisticStatus: SalesOrder["status"] =
        status === "SUBMITTED" && hasManagerApprovalDiscount
          ? "UNDER_REVIEW"
          : status;

      const optimisticOrder: SalesOrder = {
        id: `optimistic-${Date.now()}`,
        orderNumber: `SO-${new Date().getFullYear()}-PEND`,
        status: optimisticStatus,
        fulfilmentStatus: "UNFULFILLED",
        deliveryState: customerState,
        notes: orderNotes || null,
        rejectionReason: null,
        taxableAmount: calculatedTaxable,
        cgstAmount: isIntraState ? calculatedTax / 2 : 0,
        sgstAmount: isIntraState ? calculatedTax / 2 : 0,
        igstAmount: isIntraState ? 0 : calculatedTax,
        totalTaxAmount: calculatedTax,
        totalAmount: calculatedTotal,
        customer: {
          code: activeCustomer.code,
          name: activeCustomer.name,
          state: customerState,
        },
        salesman: {
          name: user?.name || "Salesman",
          email: user?.email || "",
        },
        lines: computedOrderLines.map((l, idx) => ({
          id: `optimistic-line-${Date.now()}-${idx}`,
          productVariantId: l.product!.id,
          quotedQuantity: l.quantity,
          approvedQuantity: 0,
          quotedUnitPrice: l.unitPrice,
          approvedUnitPrice: 0,
          taxRate: l.taxRatePct,
          taxableAmount: l.taxable,
          taxAmount: l.tax,
          lineTotal: l.lineTotal,
          productVariant: {
            sku: l.product!.sku,
            name: l.product!.name,
          },
        })),
        reservations: [],
      };

      queryClient.setQueriesData<{ orders: SalesOrder[] }>(
        { queryKey: ["sales-orders"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            orders: [optimisticOrder, ...old.orders],
          };
        },
      );
      setShowNewOrderModal(false);
      return { previousQueries };
    },
    onError: (_err, _vars, context) => {
      context?.previousQueries?.forEach(([queryKey, oldData]) => {
        queryClient.setQueryData(queryKey, oldData);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-balances"] });
    },
  });

  const handleCreateOrder = async (status: "DRAFT" | "SUBMITTED" = "SUBMITTED") => {
    if (!activeCustomer || hasInvalidOrderLine) {
      toast.error("Please ensure all product lines have valid quantities and discounts (0-15%).");
      return;
    }
    const customerId = activeCustomer.id;
    const customerName = activeCustomer.name;
    const items = computedOrderLines.map((l) => ({
      productVariantId: l.product!.id,
      sku: l.product!.sku,
      name: l.product!.name,
      quantity: l.quantity,
      quotedUnitPrice: l.unitPrice,
    }));

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
      await createOrderMutation.mutateAsync(status);
      toast.success(
        status === "DRAFT"
          ? "Draft sales order saved."
          : hasManagerApprovalDiscount
            ? "Sales order submitted for manager approval (discount > 5%)."
            : "Sales order created successfully.",
      );
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
        toast.error(extractErrorMessage(err, "Failed to create order"));
      }
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Update draft order mutation (IMP-003)
  const updateDraftMutation = useMutation({
    mutationFn: async (payload: {
      orderId: string;
      status: "DRAFT" | "SUBMITTED";
      notes: string;
      lines: Array<{ productVariantId: string; quantity: number; unitPrice: number }>;
    }) => {
      const res = await apiClient.put(`/sales/orders/${payload.orderId}`, {
        status: payload.status,
        notes: payload.notes,
        lines: payload.lines,
      });
      return res.data;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      setEditingDraftOrder(null);
      toast.success(
        vars.status === "SUBMITTED"
          ? "Draft order updated and submitted."
          : "Draft order updated.",
      );
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to update draft order"));
    },
  });

  // Approve order mutation (F-067 + IMP-002 lineOverrides)
  const approveMutation = useMutation({
    mutationFn: async ({
      orderId,
      lineOverrides,
      overrideReason: reason,
    }: {
      orderId: string;
      lineOverrides?: Array<{
        lineId: string;
        approvedQuantity: number;
        approvedUnitPrice?: number;
      }>;
      overrideReason?: string;
    }) => {
      const body: Record<string, unknown> = {};
      if (lineOverrides && lineOverrides.length > 0) {
        body.lineOverrides = lineOverrides;
      }
      if (reason && reason.trim()) {
        body.overrideReason = reason.trim();
      }
      const res = await apiClient.post(`/sales/orders/${orderId}/approve`, body);
      return res.data;
    },
    onMutate: async ({ orderId }) => {
      await queryClient.cancelQueries({ queryKey: ["sales-orders"] });
      const previousQueries = queryClient.getQueriesData<{ orders: SalesOrder[] }>({
        queryKey: ["sales-orders"],
      });
      queryClient.setQueriesData<{ orders: SalesOrder[] }>(
        { queryKey: ["sales-orders"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            orders: old.orders.map((o) =>
              o.id === orderId ? { ...o, status: "APPROVED" } : o,
            ),
          };
        },
      );
      setSelectedOrderForAction(null);
      setActionType(null);
      return { previousQueries };
    },
    onError: (err: any, _orderId, context) => {
      context?.previousQueries?.forEach(([queryKey, oldData]) => {
        queryClient.setQueryData(queryKey, oldData);
      });
      toast.error(
        err.response?.data?.message ||
          err.message ||
          "Failed to approve order. Reverted to previous state.",
      );
    },
    onSuccess: () => {
      toast.success("Order approved successfully");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-balances"] });
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
        err.response?.data?.message ||
          err.message ||
          "Failed to create invoice",
      );
    },
  });

  // Reject order mutation (F-067: Optimistic update with cache rollback)
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
    onMutate: async ({ orderId, reason }) => {
      await queryClient.cancelQueries({ queryKey: ["sales-orders"] });
      const previousQueries = queryClient.getQueriesData<{ orders: SalesOrder[] }>({
        queryKey: ["sales-orders"],
      });
      queryClient.setQueriesData<{ orders: SalesOrder[] }>(
        { queryKey: ["sales-orders"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            orders: old.orders.map((o) =>
              o.id === orderId
                ? { ...o, status: "REJECTED", rejectionReason: reason }
                : o,
            ),
          };
        },
      );
      setSelectedOrderForAction(null);
      setActionType(null);
      return { previousQueries };
    },
    onError: (err: any, _vars, context) => {
      context?.previousQueries?.forEach(([queryKey, oldData]) => {
        queryClient.setQueryData(queryKey, oldData);
      });
      toast.error(
        err.response?.data?.message ||
          err.message ||
          "Failed to reject order. Reverted to previous state.",
      );
    },
    onSuccess: () => {
      toast.success("Order rejected");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-balances"] });
    },
  });

  const orders = data?.orders ?? [];

  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchNum = o.orderNumber.toLowerCase().includes(q);
      const matchCust =
        (o.customer?.name || "").toLowerCase().includes(q) ||
        (o.customer?.code || "").toLowerCase().includes(q);
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {t("Orders")}
            </h1>
          </div>
          <p className="max-w-[60ch] text-sm text-muted-foreground">
            {t(
              "Salesman mobile orders, admin approval, shortages, and atomic stock reservations",
            )}
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
              onClick={openNewOrderModal}
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
            {formatQuantity(
              getAvailableStockForProduct(
                productsList.find((p) => p.sku.includes("MURUKKU")) ||
                  productsList[0],
              ),
              { unit: "pkts" },
            )}
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
              className="text-xs h-8 min-h-[32px] px-2.5 font-medium cursor-pointer sm:h-7 sm:min-h-[28px] sm:px-2"
            >
              All orders ({orders.length})
            </Button>
            <Button
              variant={activeTab === "outbox" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("outbox")}
              className="text-xs h-8 min-h-[32px] px-2.5 font-medium flex items-center gap-1.5 cursor-pointer sm:h-7 sm:min-h-[28px] sm:px-2"
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
            <Select
              value={statusFilter}
              onValueChange={setStatusFilter}
            >
              <SelectTrigger
                className="h-9 w-auto min-w-32 px-3 py-1 text-xs font-medium"
                aria-label="Filter orders by status"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="SUBMITTED">Submitted</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="DISPATCHED">Dispatched</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
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
              title={t(
                "Failed to load sales orders",
                "Failed to load sales orders",
              )}
              description={
                error instanceof Error
                  ? error.message
                  : "An unexpected server error occurred."
              }
              error={error}
              onRetry={() => refetch()}
            />
          </div>
        ) : activeTab === "stream" &&
          orders.length === 0 &&
          outboxOrders.filter((o) => o.status !== "synced").length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12 text-center text-sm text-muted-foreground">
            <ShoppingCartIcon className="h-8 w-8 stroke-1 text-muted-foreground" />
            <p>No sales orders created yet.</p>
            {canCreateOrder && (
              <Button
                variant="outline"
                size="sm"
                onClick={openNewOrderModal}
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
                      {ord.status === "queued" && (
                        <Badge
                          variant="outline"
                          className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-xs flex items-center gap-1"
                        >
                          <ClockIcon
                            className="size-3 shrink-0"
                            aria-hidden="true"
                          />
                          <span>Waiting to sync</span>
                        </Badge>
                      )}
                      {ord.status === "syncing" && (
                        <Badge
                          variant="outline"
                          className="animate-pulse-finite bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20 text-xs flex items-center gap-1"
                        >
                          <RefreshCwIcon
                            className="size-3 shrink-0 animate-spin"
                            aria-hidden="true"
                          />
                          <span>Syncing...</span>
                        </Badge>
                      )}
                      {ord.status === "conflict" && (
                        <Badge
                          variant="danger"
                          className="text-xs flex items-center gap-1"
                        >
                          <AlertTriangleIcon
                            className="size-3 shrink-0"
                            aria-hidden="true"
                          />
                          <span>Conflict: {ord.lastErrorCode ?? "Error"}</span>
                        </Badge>
                      )}
                      {ord.status === "synced" && (
                        <Badge
                          variant="success"
                          className="text-xs flex items-center gap-1"
                        >
                          <CheckCircle2Icon
                            className="size-3 shrink-0"
                            aria-hidden="true"
                          />
                          <span>Synced: {ord.serverOrderNumber ?? "OK"}</span>
                        </Badge>
                      )}
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
                  <EmptyState
                    title={t("No orders match the selected filters.")}
                    description="Clear the search or status filter to view all orders."
                    action={
                      <Button
                        variant="tertiary"
                        size="sm"
                        onClick={() => {
                          setSearchQuery("");
                          setStatusFilter("ALL");
                        }}
                      >
                        Clear filters
                      </Button>
                    }
                  />
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
                        {o.status === "DRAFT" && canCreateOrder ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDraftDialog(o)}
                            className="min-h-[44px] px-4 text-xs gap-1.5"
                          >
                            <PencilIcon className="size-3.5" />
                            Edit Draft
                          </Button>
                        ) : o.status === "SUBMITTED" && canApproveOrder ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openApproveDialog(o)}
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
                              className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 flex items-center gap-1 w-fit"
                            >
                              <ClockIcon
                                className="size-3 shrink-0"
                                aria-hidden="true"
                              />
                              <span>Waiting to sync</span>
                            </Badge>
                          )}
                          {ord.status === "syncing" && (
                            <Badge
                              variant="outline"
                              className="animate-pulse-finite bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20 flex items-center gap-1 w-fit"
                            >
                              <RefreshCwIcon
                                className="size-3 shrink-0 animate-spin"
                                aria-hidden="true"
                              />
                              <span>Syncing...</span>
                            </Badge>
                          )}
                          {ord.status === "conflict" && (
                            <Badge
                              variant="danger"
                              className="flex items-center gap-1 w-fit"
                            >
                              <AlertTriangleIcon
                                className="size-3 shrink-0"
                                aria-hidden="true"
                              />
                              <span>
                                Conflict: {ord.lastErrorCode ?? "Error"}
                              </span>
                            </Badge>
                          )}
                          {ord.status === "synced" && (
                            <Badge
                              variant="success"
                              className="flex items-center gap-1 w-fit"
                            >
                              <CheckCircle2Icon
                                className="size-3 shrink-0"
                                aria-hidden="true"
                              />
                              <span>
                                Synced: {ord.serverOrderNumber ?? "OK"}
                              </span>
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
                                className="h-8 min-h-[32px] px-2.5 text-xs gap-1 sm:h-7 sm:min-h-[28px] sm:px-2 sm:text-2xs"
                              >
                                <RotateCcwIcon className="size-3.5 sm:size-3" />
                                Retry
                              </Button>
                            )}
                            {ord.status === "queued" && isOnline && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => retryOrder(ord.id)}
                                className="h-8 min-h-[32px] px-2.5 text-xs gap-1 sm:h-7 sm:min-h-[28px] sm:px-2 sm:text-2xs"
                              >
                                <RefreshCwIcon className="size-3.5 sm:size-3" />
                                Sync
                              </Button>
                            )}
                            {ord.status !== "syncing" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeOrder(ord.id)}
                                className="h-8 min-h-[32px] min-w-[32px] px-2.5 text-xs text-muted-foreground hover:text-destructive sm:h-7 sm:min-h-[28px] sm:min-w-[28px] sm:px-2 sm:text-2xs"
                              >
                                <Trash2Icon className="size-3.5 sm:size-3" />
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
                        <TableCell colSpan={10} className="p-0">
                          <EmptyState
                            title={t("No orders match the selected filters.")}
                            description="Clear the search or status filter to view all orders."
                            className="min-h-32 py-6"
                            action={
                              <Button
                                variant="tertiary"
                                size="sm"
                                onClick={() => {
                                  setSearchQuery("");
                                  setStatusFilter("ALL");
                                }}
                              >
                                Clear filters
                              </Button>
                            }
                          />
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
                              <span>IGST: {formatINR(o.igstAmount)}</span>
                            ) : (
                              <span>
                                CGST/SGST:{" "}
                                {formatINR(
                                  Number(o.cgstAmount) + Number(o.sgstAmount),
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
                            {o.status === "DRAFT" && canCreateOrder ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditDraftDialog(o)}
                                className="h-8 min-h-[32px] px-2.5 text-xs gap-1 sm:h-7 sm:min-h-[28px] sm:px-2"
                              >
                                <PencilIcon className="size-3" />
                                Edit Draft
                              </Button>
                            ) : o.status === "SUBMITTED" && canApproveOrder ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openApproveDialog(o)}
                                  className="h-8 min-h-[32px] px-2.5 text-xs text-emerald-600 hover:text-emerald-700 sm:h-7 sm:min-h-[28px] sm:px-2"
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
                                  className="h-8 min-h-[32px] px-2.5 text-xs text-destructive hover:bg-destructive/10 sm:h-7 sm:min-h-[28px] sm:px-2"
                                >
                                  Reject
                                </Button>
                              </div>
                            ) : o.status === "APPROVED" ? (
                              <div className="flex items-center justify-end gap-1.5">
                                {o.invoices && o.invoices.length > 0 ? (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
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
                                    className="h-8 min-h-[32px] px-2.5 text-xs text-primary hover:bg-primary/10 border-primary/30 sm:h-7 sm:min-h-[28px] sm:px-2"
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
            {/* Pagination controls (F-074) */}
            <div className="flex items-center justify-between border-t border-border px-4 py-3 sm:px-6">
              <div className="text-sm text-muted-foreground">
                {t("Page")}{" "}
                <span className="font-medium text-foreground">{page}</span>
                {data?.pagination ? ` (${data.orders.length} items)` : ""}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || isFetching}
                >
                  {t("Previous")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={
                    !data?.orders || data.orders.length < pageSize || isFetching
                  }
                >
                  {t("Next")}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* New Order Modal */}
      {showNewOrderModal && (
      <Dialog open={showNewOrderModal} onOpenChange={setShowNewOrderModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create sales order</DialogTitle>
            <DialogDescription>
              Select customer, add products with quantities and discounts (0-5% standard, &gt;5-15% manager approval)
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
              <Label
                htmlFor="order-customer-select"
                className="text-xs font-semibold text-muted-foreground"
              >
                Customer
              </Label>
              <Select
                value={selectedCustomerId || undefined}
                onValueChange={setSelectedCustomerId}
              >
                <SelectTrigger id="order-customer-select" className="font-medium">
                  <SelectValue placeholder="Select customer..." />
                </SelectTrigger>
                <SelectContent searchable searchPlaceholder="Search customers...">
                  {customersList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c?.state || "Tamil Nadu"},{" "}
                      {c?.state?.trim().toLowerCase() === "tamil nadu"
                        ? "Intra-state"
                        : "Inter-state"}
                      )
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">
                Place of supply: {customerState} (
                {isIntraState ? "CGST 2.5% + SGST 2.5%" : "IGST 5.0%"})
              </span>
            </div>

            {/* Order product lines */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-semibold text-muted-foreground">
                  Products ({computedOrderLines.length})
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addOrderLine}
                  disabled={remainingProducts.length === 0}
                  className="gap-1.5"
                >
                  <PlusCircleIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  Add product
                </Button>
              </div>

              <div className="flex flex-col gap-3">
                {computedOrderLines.map((line, index) => {
                  const productSelectId = `order-product-select-${line.key}`;
                  const qtyInputId = `order-quantity-input-${line.key}`;
                  const discountInputId = `order-discount-input-${line.key}`;
                  const selectableProducts = productsList.filter(
                    (p) =>
                      p.id === line.product?.id ||
                      !orderLines.some(
                        (other) =>
                          other.key !== line.key &&
                          other.productVariantId === p.id,
                      ),
                  );

                  return (
                    <div
                      key={line.key}
                      className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="size-11 shrink-0 overflow-hidden rounded-md border bg-background flex items-center justify-center">
                          <img
                            src={line.product?.imageUrl || "/products/murukku.svg"}
                            alt={line.product?.name || "Product Packaging"}
                            width={44}
                            height={44}
                            loading="lazy"
                            decoding="async"
                            className="size-full object-contain"
                          />
                        </div>
                        <div className="flex flex-1 flex-col gap-1 min-w-0">
                          <Label
                            htmlFor={productSelectId}
                            className="text-xs font-semibold text-muted-foreground"
                          >
                            Product {index + 1}
                          </Label>
                          <Select
                            value={line.product?.id || undefined}
                            onValueChange={(val) =>
                              updateOrderLine(line.key, { productVariantId: val })
                            }
                          >
                            <SelectTrigger
                              id={productSelectId}
                              className="font-medium"
                            >
                              <SelectValue placeholder="Select product..." />
                            </SelectTrigger>
                            <SelectContent searchable searchPlaceholder="Search products...">
                              {selectableProducts.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name} ({formatINR(p.defaultPrice)})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-xs text-muted-foreground">
                            List price: {formatINR(line.listPrice)} / pkt (SKU:{" "}
                            {line.product?.sku || "N/A"})
                          </span>
                        </div>
                        {orderLines.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeOrderLine(line.key)}
                            aria-label={`Remove product ${index + 1}`}
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2Icon className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="flex flex-col gap-1">
                          <Label
                            htmlFor={qtyInputId}
                            className="text-xs font-semibold text-muted-foreground"
                          >
                            Quantity (pkts)
                          </Label>
                          <Input
                            id={qtyInputId}
                            type="number"
                            min={1}
                            step={1}
                            value={line.quantity}
                            onChange={(e) =>
                              updateOrderLine(line.key, {
                                quantity: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                              })
                            }
                            aria-invalid={line.isQuantityInvalid}
                            className="font-semibold"
                          />
                          <span
                            className={`text-xs ${
                              line.isQuantityInvalid
                                ? "text-destructive"
                                : "text-muted-foreground"
                            }`}
                          >
                            {line.isQuantityInvalid
                              ? "Quantity must be at least 1"
                              : `Available: ${line.availablePackets} pkts`}
                          </span>
                        </div>

                        <div className="flex flex-col gap-1">
                          <Label
                            htmlFor={discountInputId}
                            className="text-xs font-semibold text-muted-foreground"
                          >
                            Discount (%)
                          </Label>
                          <Input
                            id={discountInputId}
                            type="number"
                            min={0}
                            max={15}
                            step={0.5}
                            value={line.discountPct}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              updateOrderLine(line.key, {
                                discountPct: Number.isNaN(val) ? 0 : val,
                              });
                            }}
                            aria-invalid={line.isDiscountInvalid}
                            className="font-semibold"
                          />
                          <span
                            className={`text-xs ${
                              line.isDiscountInvalid
                                ? "text-destructive"
                                : line.requiresManagerApproval
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {line.isDiscountInvalid
                              ? "Max discount is 15% (0-15%)"
                              : line.requiresManagerApproval
                                ? "Requires manager approval (>5%)"
                                : line.discountPct > 0
                                  ? "Within 5% salesman limit"
                                  : "0% (max 15%)"}
                          </span>
                        </div>

                        <div className="flex flex-col justify-center rounded-md bg-background/70 px-3 py-2 text-xs border">
                          <div className="flex justify-between gap-2">
                            <span className="text-muted-foreground">Unit price:</span>
                            <span className="font-semibold">
                              {formatINR(line.unitPrice)}
                            </span>
                          </div>
                          <div className="flex justify-between gap-2 mt-1">
                            <span className="text-muted-foreground">Line total:</span>
                            <span className="font-bold text-foreground">
                              {formatINR(line.lineTotal)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {line.shortage > 0 && (
                        <div
                          role="status"
                          aria-live="polite"
                          className="flex items-center gap-2 rounded-md bg-amber-500/10 px-2.5 py-2 text-xs text-amber-600 dark:text-amber-400 border border-amber-500/20"
                        >
                          <AlertTriangleIcon
                            className="h-4 w-4 shrink-0"
                            aria-hidden="true"
                          />
                          <span>
                            Stock shortage of {line.shortage} packets for{" "}
                            {line.product?.name}. Order requires admin review or partial allocation.
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Manager approval notice for >5% discount */}
            {hasManagerApprovalDiscount && (
              <div
                role="status"
                aria-live="polite"
                className="flex items-center gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 border border-amber-500/20"
              >
                <AlertTriangleIcon
                  className="h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  One or more items have a discount above 5% (up to 15%). Submitting will place this order Under Review for manager approval.
                </span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="order-notes-input"
                className="text-xs font-semibold text-muted-foreground"
              >
                Order notes
              </Label>
              <Input
                id="order-notes-input"
                type="text"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
              />
            </div>

            {/* Order total calculation */}
            <div className="rounded-lg bg-muted/50 p-3 text-xs flex flex-col gap-1">
              {totalDiscountSavings > 0 && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                  <span>Discount savings:</span>
                  <span className="font-semibold">
                    -{formatINR(totalDiscountSavings)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Taxable amount:</span>
                <span className="font-semibold">
                  {formatINR(calculatedTaxable)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  GST ({isIntraState ? "CGST + SGST" : "IGST"}):
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

          <DialogFooter className="mt-6 flex-wrap gap-2 border-t pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNewOrderModal(false)}
            >
              Cancel
            </Button>
            {isOnline && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCreateOrder("DRAFT")}
                disabled={
                  hasInvalidOrderLine ||
                  isSubmittingOrder ||
                  createOrderMutation.isPending
                }
              >
                Save as Draft
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => handleCreateOrder("SUBMITTED")}
              disabled={
                hasInvalidOrderLine ||
                isSubmittingOrder ||
                createOrderMutation.isPending
              }
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
      )}

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
                Warning: This action is irreversible. The customer booking will
                be permanently cancelled.
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
            <Label
              htmlFor="rejection-reason"
              className="text-xs font-semibold text-muted-foreground"
            >
              Reason for rejection
            </Label>
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

      {/* Edit Draft Order Modal (IMP-003) */}
      <Dialog
        open={editingDraftOrder !== null}
        onOpenChange={(open) => {
          if (!open) setEditingDraftOrder(null);
        }}
      >
        {editingDraftOrder && (
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Draft Order</DialogTitle>
              <DialogDescription>
                {editingDraftOrder.orderNumber} — {editingDraftOrder.customer.name}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="draft-product-select" className="text-xs font-semibold text-muted-foreground">
                  Product item
                </Label>
                <Select value={draftProductId} onValueChange={setDraftProductId}>
                  <SelectTrigger id="draft-product-select">
                    <SelectValue placeholder="Select product..." />
                  </SelectTrigger>
                  <SelectContent searchable searchPlaceholder="Search products...">
                    {productsList.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({formatINR(p.defaultPrice)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="draft-quantity-input" className="text-xs font-semibold text-muted-foreground">
                    Quantity (pkts)
                  </Label>
                  <Input
                    id="draft-quantity-input"
                    type="number"
                    min={1}
                    value={draftQuantity}
                    onChange={(e) => setDraftQuantity(Number(e.target.value))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="draft-price-input" className="text-xs font-semibold text-muted-foreground">
                    Unit Price (₹)
                  </Label>
                  <Input
                    id="draft-price-input"
                    type="number"
                    min={0}
                    step="0.01"
                    value={draftUnitPrice}
                    onChange={(e) => setDraftUnitPrice(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="draft-notes-input" className="text-xs font-semibold text-muted-foreground">
                  Notes
                </Label>
                <Input
                  id="draft-notes-input"
                  type="text"
                  value={draftNotes}
                  onChange={(e) => setDraftNotes(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter className="mt-6 flex-wrap gap-2 border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingDraftOrder(null)}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={updateDraftMutation.isPending || draftQuantity <= 0}
                onClick={() =>
                  updateDraftMutation.mutate({
                    orderId: editingDraftOrder.id,
                    status: "DRAFT",
                    notes: draftNotes,
                    lines: [
                      {
                        productVariantId: draftProductId,
                        quantity: draftQuantity,
                        unitPrice: draftUnitPrice,
                      },
                    ],
                  })
                }
              >
                Save Draft
              </Button>
              <Button
                size="sm"
                disabled={updateDraftMutation.isPending || draftQuantity <= 0}
                onClick={() =>
                  updateDraftMutation.mutate({
                    orderId: editingDraftOrder.id,
                    status: "SUBMITTED",
                    notes: draftNotes,
                    lines: [
                      {
                        productVariantId: draftProductId,
                        quantity: draftQuantity,
                        unitPrice: draftUnitPrice,
                      },
                    ],
                  })
                }
              >
                Save & Submit
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Approve Dialog (IMP-002: editable qty/price overrides + overrideReason) */}
      <Dialog
        open={selectedOrderForAction !== null && actionType === "APPROVE"}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOrderForAction(null);
            setActionType(null);
          }
        }}
      >
        {selectedOrderForAction && actionType === "APPROVE" && (() => {
          const hasOverrides = approvalLines.some(
            (l) =>
              l.approvedQuantity !== l.quotedQuantity ||
              l.approvedUnitPrice !== l.quotedUnitPrice,
          );
          const missingReason = hasOverrides && overrideReason.trim().length === 0;

          return (
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Approve sales order</DialogTitle>
              <DialogDescription>
                Order {selectedOrderForAction.orderNumber} for{" "}
                {selectedOrderForAction.customer.name}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2.5 max-h-64 overflow-y-auto pr-1">
                {approvalLines.map((line, idx) => (
                  <div
                    key={line.lineId}
                    className="rounded-lg border bg-muted/20 p-3 flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">
                        {line.productName}
                      </span>
                      <span className="text-muted-foreground">
                        Quoted: {line.quotedQuantity} @ {formatINR(line.quotedUnitPrice)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`approve-qty-${line.lineId}`} className="text-2xs text-muted-foreground">
                          Approved Qty
                        </Label>
                        <Input
                          id={`approve-qty-${line.lineId}`}
                          type="number"
                          min={1}
                          value={line.approvedQuantity}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setApprovalLines((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, approvedQuantity: val } : item,
                              ),
                            );
                          }}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`approve-price-${line.lineId}`} className="text-2xs text-muted-foreground">
                          Approved Price (₹)
                        </Label>
                        <Input
                          id={`approve-price-${line.lineId}`}
                          type="number"
                          min={0}
                          step="0.01"
                          value={line.approvedUnitPrice}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setApprovalLines((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, approvedUnitPrice: val } : item,
                              ),
                            );
                          }}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {hasOverrides && (
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="approve-override-reason"
                    className="text-xs font-semibold text-amber-700 dark:text-amber-400"
                  >
                    Override reason (required when modifying qty/price)
                  </Label>
                  <Input
                    id="approve-override-reason"
                    type="text"
                    placeholder="e.g. Partial stock allocation or agreed wholesale discount"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    className="text-xs"
                  />
                </div>
              )}

              {selectedOrderForAction.totalShortage &&
              selectedOrderForAction.totalShortage > 0 ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-center gap-2 rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-400 border border-amber-500/20"
                >
                  <AlertTriangleIcon
                    className="h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    Notice: Full quantity cannot be reserved because shortage is{" "}
                    {selectedOrderForAction.totalShortage} packets.
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
                  approveMutation.mutate({
                    orderId: selectedOrderForAction.id,
                    lineOverrides: hasOverrides
                      ? approvalLines.map((l) => ({
                          lineId: l.lineId,
                          approvedQuantity: l.approvedQuantity,
                          approvedUnitPrice: l.approvedUnitPrice,
                        }))
                      : undefined,
                    overrideReason: hasOverrides ? overrideReason : undefined,
                  })
                }
                disabled={approveMutation.isPending || missingReason}
                className="gap-2"
              >
                <CheckCircle2Icon className="h-4 w-4" />
                Confirm approval
              </Button>
            </DialogFooter>
          </DialogContent>
          );
        })()}
      </Dialog>
    </div>
  );
}
