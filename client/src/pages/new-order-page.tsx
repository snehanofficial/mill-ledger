import { useState, useId, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePagination } from "@/hooks/use-pagination";
import { useUrlState } from "@/hooks/use-url-state";
import { useSyncManager } from "@/offline/use-offline";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import {
  assertCollectionResponse,
  assertEntityResponse,
} from "@/lib/api-contracts";
import { formatINR } from "@/lib/formatters";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { DataPagination } from "@/components/ui/data-pagination";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  RefreshCwIcon,
  WifiOffIcon,
  AlertTriangleIcon,
  ShoppingCartIcon,
  PlusIcon,
  MinusIcon,
  PackageIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

type ProductStockFilter =
  | "ALL"
  | "IN_STOCK"
  | "LOW_STOCK"
  | "OUT_OF_STOCK"
  | "IN_ORDER";

interface ProductItem {
  id: string;
  sku: string;
  name: string;
  productName?: string;
  defaultPrice: number;
  taxRate: number;
  hsnCode?: string;
  uom?: string;
  finishedGoodsItemId?: string | null;
  finishedGoodsSku?: string | null;
  availableStock?: number;
  imageUrl?: string;
}

interface ProductsResponse {
  products: ProductItem[];
  pagination?: {
    limit: number;
    offset: number;
    count: number;
    total: number;
  };
}

interface CustomerItem {
  id: string;
  code: string;
  name: string;
  state: string;
  gstin?: string;
  isActive?: boolean;
}

interface StockBalance {
  id?: string;
  sku: string;
  available: number;
  onHand: number;
  reserved: number;
}

function generateOrderNumber(): string {
  return `SO-2026-${Date.now().toString().slice(-4)}`;
}

export function NewOrderPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const { t } = useLanguage();
  const customerSelectId = useId();
  const notesInputId = useId();
  const syncManager = useSyncManager(user?.id);
  const { isOnline, queueOrder } = syncManager;

  const [searchParams, setSearchParams] = useSearchParams();
  const draftId = searchParams.get("draftId") ?? "";
  const prefillCustomerId = searchParams.get("customerId") ?? "";

  const [selectedCustomerId, setSelectedCustomerId] = useState(prefillCustomerId);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [orderNotes, setOrderNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useUrlState("q", "", {
    debounceMs: 200,
  });
  const rawStockParam = searchParams.get("stock");
  const stockFilter: ProductStockFilter =
    rawStockParam === "IN_STOCK" ||
    rawStockParam === "LOW_STOCK" ||
    rawStockParam === "OUT_OF_STOCK" ||
    rawStockParam === "IN_ORDER"
      ? rawStockParam
      : "ALL";
  const { page, pageSize, offset, setPage, setPageSize, resetPage } =
    usePagination({
      defaultPageSize: 12,
    });

  // Load existing draft if ?draftId= is provided
  type DraftOrderPayload = {
    id: string;
    status: string;
    customerId: string;
    notes: string | null;
    lines: Array<{
      productVariantId: string;
      quotedQuantity: number;
      productVariant: ProductItem;
    }>;
  };
  const { data: draftData } = useQuery<DraftOrderPayload>({
    queryKey: ["sales-order", draftId],
    queryFn: async () => {
      const endpoint = `/sales/orders/${draftId}`;
      const res = await apiClient.get(endpoint);
      return assertEntityResponse<DraftOrderPayload & Record<string, unknown>>(
        res.data,
        "order",
        ["lines"],
        endpoint,
      );
    },
    enabled: Boolean(draftId),
  });

  useEffect(() => {
    const draft = draftData;
    if (!draft || draft.status !== "DRAFT") return;
    setSelectedCustomerId(draft.customerId);
    setOrderNotes(draft.notes ?? "");
    const nextQty: Record<string, number> = {};
    const nextCache: Record<string, ProductItem> = {};
    for (const line of draft.lines) {
      nextQty[line.productVariantId] = Number(line.quotedQuantity);
      if (line.productVariant) {
        nextCache[line.productVariantId] = line.productVariant;
      }
    }
    setQuantities(nextQty);
    setProductCache((prev) => ({ ...prev, ...nextCache }));
  }, [draftData]);
  const [productCache, setProductCache] = useState<Record<string, ProductItem>>({});

  // Fetch customers
  const { data: customersData } = useQuery<{ customers: CustomerItem[] }>({
    queryKey: ["sales-customers"],
    queryFn: async () => {
      const res = await apiClient.get("/sales/customers");
      return assertCollectionResponse(
        res.data,
        "customers",
        "/sales/customers",
      );
    },
  });

  const serverStockFilter = stockFilter === "IN_ORDER" ? "ALL" : stockFilter;
  const trimmedSearch = searchQuery.trim();

  // Fetch paginated products
  const {
    data: productsData,
    isLoading: isProductsLoading,
    isError: isProductsError,
    error: productsError,
    isFetching: isProductsFetching,
    refetch: refetchProducts,
  } = useQuery<ProductsResponse>({
    queryKey: ["sales-products", page, pageSize, trimmedSearch, serverStockFilter],
    queryFn: async () => {
      const offset = (page - 1) * pageSize;
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset),
      });
      if (trimmedSearch) {
        params.set("q", trimmedSearch);
      }
      if (serverStockFilter !== "ALL") {
        params.set("stock", serverStockFilter);
      }
      const res = await apiClient.get<ProductsResponse>(
        `/sales/products?${params.toString()}`,
      );
      return assertCollectionResponse(res.data, "products", "/sales/products");
    },
    placeholderData: keepPreviousData,
  });

  // Fetch stock balances
  const { data: stockData } = useQuery<{ balances: StockBalance[] }>({
    queryKey: ["inventory-balances"],
    queryFn: async () => {
      const res = await apiClient.get("/inventory/balances");
      return assertCollectionResponse(
        res.data,
        "balances",
        "/inventory/balances",
      );
    },
  });

  const customersList: CustomerItem[] = (customersData?.customers ?? []).filter(
    (c) => c.isActive !== false,
  );

  const productsList: ProductItem[] = productsData?.products ?? [];
  const totalProducts = productsData?.pagination?.total ?? productsList.length;
  const totalPages = Math.max(1, Math.ceil(totalProducts / pageSize));
  const rangeStart = totalProducts === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(page * pageSize, totalProducts);

  const balances = stockData?.balances || [];

  const activeCustomer =
    customersList.find(
      (c) => c.id === selectedCustomerId || c.code === selectedCustomerId,
    ) ?? null;

  const customerState = activeCustomer?.state || "";
  const isIntraState = customerState.trim().toLowerCase() === "tamil nadu";

  const getProductStock = (product: ProductItem) => {
    const match = balances.find(
      (b) =>
        (product.finishedGoodsItemId && b.id === product.finishedGoodsItemId) ||
        (product.finishedGoodsSku && b.sku === product.finishedGoodsSku) ||
        b.sku === product.sku,
    );
    return match?.available ?? product.availableStock ?? 0;
  };

  const updateQuantity = (product: ProductItem, qty: number) => {
    const validQty = Math.max(0, Math.floor(qty || 0));
    setProductCache((prev) => ({
      ...prev,
      [product.id]: product,
      [product.sku]: product,
    }));
    setQuantities((prev) => {
      const next = { ...prev, [product.id]: validQty };
      if (product.sku && product.sku !== product.id) {
        delete next[product.sku];
      }
      return next;
    });
  };

  const handleStep = (product: ProductItem, delta: number) => {
    const current = quantities[product.id] ?? quantities[product.sku] ?? 0;
    updateQuantity(product, current + delta);
  };

  // Order summary calculations across all paginated selections (deduped by product.id)
  const seenProductIds = new Set<string>();
  const orderLines = Object.entries(quantities)
    .filter(([, qty]) => qty > 0)
    .map(([key, qty]) => {
      const product =
        productsList.find((p) => p.id === key || p.sku === key) ??
        productCache[key];
      if (!product || seenProductIds.has(product.id)) return null;
      if (key === product.sku && quantities[product.id] !== undefined) return null;
      seenProductIds.add(product.id);
      const unitPrice = Number(product.defaultPrice ?? 0);
      const taxable = qty * unitPrice;
      const taxRate = Number(product.taxRate ?? 0) / 100;
      const tax = taxable * taxRate;
      const total = taxable + tax;
      const stock = getProductStock(product);
      const shortage = Math.max(0, qty - stock);

      return {
        product,
        quantity: qty,
        unitPrice,
        taxable,
        taxRate: product.taxRate,
        tax,
        total,
        stock,
        shortage,
      };
    })
    .filter((line): line is NonNullable<typeof line> => line !== null);

  const totalItemCount = orderLines.reduce((acc, l) => acc + l.quantity, 0);
  const totalTaxable = orderLines.reduce((acc, l) => acc + l.taxable, 0);
  const totalTax = orderLines.reduce((acc, l) => acc + l.tax, 0);
  const grandTotal = totalTaxable + totalTax;
  const anyShortage = orderLines.some((l) => l.shortage > 0);

  const normalizedSearch = trimmedSearch.toLowerCase();
  const displayedProducts =
    stockFilter === "IN_ORDER"
      ? orderLines
          .map((l) => l.product)
          .filter((p) => {
            if (!normalizedSearch) return true;
            return (
              p.name.toLowerCase().includes(normalizedSearch) ||
              p.sku.toLowerCase().includes(normalizedSearch) ||
              (p.productName?.toLowerCase().includes(normalizedSearch) ?? false) ||
              (p.hsnCode?.toLowerCase().includes(normalizedSearch) ?? false)
            );
          })
      : productsList;

  const displayTotal =
    stockFilter === "IN_ORDER" ? displayedProducts.length : totalProducts;
  const displayRangeStart =
    displayTotal === 0 ? 0 : stockFilter === "IN_ORDER" ? 1 : rangeStart;
  const displayRangeEnd =
    stockFilter === "IN_ORDER" ? displayTotal : rangeEnd;
  const hasActiveFilters = Boolean(trimmedSearch) || stockFilter !== "ALL";

  const handleStockFilterChange = (nextStock: ProductStockFilter) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (nextStock === "ALL") {
          next.delete("stock");
        } else {
          next.set("stock", nextStock);
        }
        next.delete("page");
        return next;
      },
      { replace: true },
    );
  };

  const clearProductFilters = () => {
    setSearchQuery("");
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("q");
        next.delete("stock");
        next.delete("page");
        return next;
      },
      { replace: true },
    );
  };

  // Submit or save draft order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (submitAsDraft: boolean) => {
      if (!activeCustomer) {
        throw new Error("Please select a customer before placing an order.");
      }
      const payload = {
        customerId: activeCustomer.id,
        orderNumber: generateOrderNumber(),
        notes: orderNotes,
        status: submitAsDraft ? "DRAFT" : "SUBMITTED",
        lines: orderLines.map((l) => ({
          productVariantId: l.product.id,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
      };
      if (draftId) {
        const res = await apiClient.put(`/sales/orders/${draftId}`, {
          notes: orderNotes,
          status: submitAsDraft ? "DRAFT" : "SUBMITTED",
          lines: payload.lines,
        });
        return res.data;
      }
      const res = await apiClient.post("/sales/orders", payload);
      return res.data;
    },
    onSuccess: (resData, submitAsDraft) => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-balances"] });
      if (draftId) {
        queryClient.invalidateQueries({ queryKey: ["sales-order", draftId] });
      }
      const orderId = resData?.order?.id ?? resData?.id ?? draftId;
      toast.success(
        submitAsDraft
          ? "Order draft saved."
          : "Sales order submitted successfully!",
      );
      navigate(orderId ? `/orders/${orderId}` : "/orders");
    },
    onError: (err: unknown) => {
      toast.error(`Order failed: ${extractErrorMessage(err, "Failed to save order")}`);
    },
  });

  const handleSubmit = async (submitAsDraft = false) => {
    if (!activeCustomer) {
      toast.error("Please select a customer before placing an order.");
      return;
    }
    if (totalItemCount === 0) {
      toast.error("Please add at least one product packet to your order.");
      return;
    }

    if (!isOnline) {
      if (submitAsDraft) {
        toast.info("Offline mode: saving to device outbox for automatic sync when online.");
      }
      // Offline queueing in Dexie outbox
      try {
        await queueOrder(
          {
            customerId: activeCustomer.id,
            customerName: activeCustomer.name,
            customerState,
            notes: orderNotes,
            items: orderLines.map((l) => ({
              productVariantId: l.product.id,
              sku: l.product.sku,
              name: l.product.name,
              quantity: l.quantity,
              quotedUnitPrice: l.unitPrice,
            })),
          },
          user?.id || "salesman",
        );
        toast.info(
          "Offline: Order saved to local device outbox. It will sync automatically when online.",
        );
        navigate("/orders");
      } catch (err: any) {
        toast.error(`Failed to save offline order: ${err.message}`);
      }
      return;
    }

    setIsSubmitting(true);
    try {
      await createOrderMutation.mutateAsync(submitAsDraft);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col pb-28 sm:pb-24 md:pb-0">
      {/* Top Navigation & Breadcrumb */}
      <div className="border-b bg-card/60 backdrop-blur px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/orders"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeftIcon className="size-3.5" />
              <span>{t("Back", "Back to Orders")}</span>
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-xs font-semibold text-foreground">
              {t("New order", "New Wholesale Order")}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!isOnline ? (
              <Badge
                variant="outline"
                className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs flex items-center gap-1"
              >
                <WifiOffIcon className="size-3" />
                {t("Offline Mode")}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs flex items-center gap-1"
              >
                <span className="size-1.5 rounded-full bg-emerald-500" />
                {t("Live Stock Available")}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full flex-1 flex flex-col gap-6">
        {/* Page Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("New order")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("Select customer, browse packaged product tiles, and adjust quantities using touch-friendly steppers.")}
          </p>
        </div>

        {/* Customer & Parameters Card */}
        <div className="rounded-xl border bg-card p-4 sm:p-5 shadow-xs flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer Picker */}
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor={customerSelectId}
                className="text-xs font-semibold text-muted-foreground"
              >
                Select Customer / Retailer
              </Label>
              <Select
                value={selectedCustomerId || undefined}
                onValueChange={setSelectedCustomerId}
              >
                <SelectTrigger id={customerSelectId} className="font-medium">
                  <SelectValue placeholder="Select customer..." />
                </SelectTrigger>
                <SelectContent searchable searchPlaceholder="Search customers...">
                  {customersList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.code}) · {c.state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                {activeCustomer ? (
                  <>
                    <span>Place of Supply: <strong>{customerState}</strong></span>
                    <span>•</span>
                    <span className="text-primary font-medium">
                      {isIntraState ? "Intra-state (CGST 2.5% + SGST 2.5%)" : "Inter-state (IGST 5.0%)"}
                    </span>
                  </>
                ) : (
                  <span>Select a customer to determine place of supply and GST regime</span>
                )}
              </div>
            </div>

            {/* Order Reference Notes */}
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor={notesInputId}
                className="text-xs font-semibold text-muted-foreground"
              >
                Order Notes & Transport Reference
              </Label>
              <Input
                id={notesInputId}
                type="text"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder="e.g. Weekly shop delivery, via local van carrier"
              />
              <span className="text-xs text-muted-foreground mt-0.5">
                Included in dispatch delivery challan and invoice notes
              </span>
            </div>
          </div>
        </div>

        {/* Product Catalog Grid */}
        <section aria-labelledby="catalog-heading" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 id="catalog-heading" className="text-lg font-bold text-foreground flex items-center gap-2">
                <PackageIcon className="size-5 text-primary" aria-hidden="true" />
                Product Catalog ({displayTotal} {displayTotal === 1 ? "item" : "items"})
              </h2>
              <p className="text-xs text-muted-foreground">
                Touch <strong>+</strong> or <strong>−</strong> steppers to adjust batch packet quantity
              </p>
            </div>
            {displayTotal > 0 && (
              <div className="text-xs text-muted-foreground" aria-live="polite">
                Showing {displayRangeStart}-{displayRangeEnd} of {displayTotal}
                {isProductsFetching && !isProductsLoading ? " (Updating...)" : ""}
              </div>
            )}
          </div>

          {/* Product Search & Stock Filters */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div
              className="flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label="Filter products by stock"
            >
              {(
                [
                  { value: "ALL", label: "All" },
                  { value: "IN_STOCK", label: "In stock" },
                  { value: "LOW_STOCK", label: "Low stock" },
                  { value: "OUT_OF_STOCK", label: "Out of stock" },
                  { value: "IN_ORDER", label: `In order (${orderLines.length})` },
                ] as const
              ).map((f) => (
                <Button
                  key={f.value}
                  type="button"
                  variant={stockFilter === f.value ? "primary" : "outline"}
                  size="sm"
                  aria-pressed={stockFilter === f.value}
                  onClick={() => handleStockFilterChange(f.value)}
                  className="min-h-[44px] sm:min-h-[36px] text-xs cursor-pointer"
                >
                  {f.label}
                </Button>
              ))}
            </div>

            <div className="relative w-full lg:w-80">
              <SearchIcon
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  resetPage();
                }}
                placeholder="Search by name, SKU, or HSN..."
                aria-label="Search products"
                className="h-11 sm:h-9 pl-9 pr-9"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    resetPage();
                  }}
                  aria-label="Clear product search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <XIcon className="size-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {isProductsLoading && stockFilter !== "IN_ORDER" ? (
            <div
              role="status"
              aria-live="polite"
              className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground"
            >
              Loading product catalog...
            </div>
          ) : isProductsError && stockFilter !== "IN_ORDER" ? (
            <div
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Unable to load products
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {productsError instanceof Error
                    ? productsError.message
                    : "Check your connection and try again."}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => refetchProducts()}
                className="min-h-[44px] cursor-pointer"
              >
                Retry
              </Button>
            </div>
          ) : displayedProducts.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center flex flex-col items-center gap-3">
              <p className="text-sm font-semibold text-foreground">
                {stockFilter === "IN_ORDER" && orderLines.length === 0
                  ? "No products in your order yet"
                  : hasActiveFilters
                    ? "No matching products"
                    : "No products found on this page"}
              </p>
              <p className="text-xs text-muted-foreground">
                {stockFilter === "IN_ORDER" && orderLines.length === 0
                  ? "Use the + steppers on products in the catalog to add quantities."
                  : hasActiveFilters
                    ? "No products match your current search or stock filter."
                    : page > 1
                      ? "Return to the first page to view available products."
                      : "No active sellable product variants are configured for this organization."}
              </p>
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearProductFilters}
                  className="min-h-[44px] cursor-pointer"
                >
                  {stockFilter === "IN_ORDER" && orderLines.length === 0 && !trimmedSearch
                    ? "Show all products"
                    : "Clear filters"}
                </Button>
              ) : (
                page > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPage(1)}
                    className="min-h-[44px] cursor-pointer"
                  >
                    Go to Page 1
                  </Button>
                )
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
                {displayedProducts.map((product) => {
                  const qty = quantities[product.id] ?? quantities[product.sku] ?? 0;
                  const unitPrice = Number(product.defaultPrice ?? 0);
                  const taxRate = Number(product.taxRate ?? 0) / 100;
                  const availableStock = getProductStock(product);
                  const isShort = qty > availableStock;
                  const hasOrder = qty > 0;

                  return (
                    <article
                      key={product.id}
                      className={`product-card group relative flex flex-col justify-between rounded-xl border bg-card p-4 sm:p-5 shadow-xs transition-[border-color,box-shadow] duration-(--ml-motion-micro) ease-standard hover:shadow-md ${
                        hasOrder
                          ? "border-primary/40 ring-1 ring-primary/20 bg-primary/[0.02]"
                          : "border-border"
                      }`}
                    >
                      <div className="flex-1 flex flex-col gap-3">
                        {/* Visual Product Thumbnail with semantic img element */}
                        <div className="relative aspect-video w-full rounded-lg bg-muted/40 border border-border/60 overflow-hidden flex items-center justify-center p-2">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={`${product.name} packaging pouch`}
                              width={112}
                              height={112}
                              className="h-28 w-28 object-contain transition-transform duration-(--ml-motion-fast) ease-enter group-hover:scale-105 drop-shadow-xs"
                            />
                          ) : (
                            <PackageIcon className="size-10 text-muted-foreground/50" aria-hidden="true" />
                          )}
                      <div className="absolute top-2 right-2">
                        {availableStock > 0 ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 text-[11px] font-medium"
                          >
                            {availableStock} pkts available
                          </Badge>
                        ) : (
                          <Badge variant="danger" className="text-[11px]">
                            Out of Stock
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Product Metadata */}
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] font-semibold text-muted-foreground tracking-wider uppercase truncate">
                          {product.sku}
                        </span>
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          {product.hsnCode ? `HSN: ${product.hsnCode}` : "HSN: —"}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-foreground mt-0.5 line-clamp-2">
                        {product.name}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {[product.productName, product.uom ? `(${product.uom})` : null]
                          .filter(Boolean)
                          .join(" ") || "—"}
                      </p>
                    </div>

                    {/* Pricing */}
                    <div className="mt-auto flex items-baseline justify-between pt-2 border-t border-border/50">
                      <div>
                        <span className="text-xs text-muted-foreground">Standard wholesale:</span>
                        <div className="text-lg font-extrabold text-foreground font-mono">
                          {formatINR(unitPrice)}
                          <span className="text-xs font-normal text-muted-foreground ml-1">/ pkt</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-muted-foreground">GST:</span>
                        <div className="text-xs font-semibold text-foreground">
                          {product.taxRate}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quantity Stepper, Line Total & Reserved Shortage Slot */}
                  <div className="mt-4 pt-3 border-t border-border flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Quantity:
                      </span>

                      {/* Accessible 44x44px Touch Targets Stepper */}
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label={`Decrease quantity of ${product.name}`}
                          onClick={() => handleStep(product, -10)}
                          disabled={qty === 0}
                          className="min-w-[44px] min-h-[44px] size-11 font-bold text-base"
                        >
                          <MinusIcon className="size-4" />
                        </Button>

                        <Input
                          type="number"
                          min="0"
                          value={qty}
                          onChange={(e) => updateQuantity(product, Number(e.target.value))}
                          aria-label={`Quantity of ${product.name}`}
                          className="w-16 h-11 px-2 text-center font-mono font-bold text-base"
                        />

                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label={`Increase quantity of ${product.name}`}
                          onClick={() => handleStep(product, 10)}
                          className="min-w-[44px] min-h-[44px] size-11 font-bold text-base"
                        >
                          <PlusIcon className="size-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs min-h-[20px] text-muted-foreground">
                      <span>Line Total:</span>
                      <span
                        className={
                          qty > 0
                            ? "font-mono font-bold text-foreground"
                            : "font-mono text-muted-foreground/70"
                        }
                      >
                        {qty > 0
                          ? `${formatINR(qty * unitPrice * (1 + taxRate))} (incl. GST)`
                          : "—"}
                      </span>
                    </div>

                    <div className="min-h-[34px] flex items-center">
                      {isShort && (
                        <div
                          role="status"
                          aria-live="polite"
                          className="w-full flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md px-2 py-1.5"
                        >
                          <AlertTriangleIcon className="size-3.5 shrink-0" aria-hidden="true" />
                          <span className="truncate">
                            Shortage: {qty - availableStock} pkts exceeds stock
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
              </div>

              {stockFilter !== "IN_ORDER" && (
                <DataPagination
                  pagination={
                    productsData?.pagination ?? {
                      limit: pageSize,
                      offset,
                      count: productsList.length,
                      total: totalProducts,
                      page,
                      totalPages,
                    }
                  }
                  page={page}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  pageSizeOptions={[12, 24, 48, 96]}
                  isFetching={isProductsFetching}
                  itemLabel="products"
                />
              )}
            </>
          )}
        </section>
      </div>

      {/* Sticky / Docked Bottom Summary Checkout Bar */}
      <footer className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] left-0 right-0 z-30 md:sticky md:bottom-0 border-t bg-card/95 backdrop-blur-md px-3 py-2 sm:px-6 sm:py-3 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
          <div className="flex items-center justify-between gap-3 sm:justify-start min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="hidden sm:flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShoppingCartIcon className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="text-sm font-bold text-foreground whitespace-nowrap">
                    {totalItemCount} {totalItemCount === 1 ? "Packet" : "Packets"}
                  </span>
                  {anyShortage && (
                    <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20">
                      Shortage flagged
                    </Badge>
                  )}
                </div>
                <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Subtotal: {formatINR(totalTaxable)}</span>
                  <span>•</span>
                  <span>GST: {formatINR(totalTax)}</span>
                </div>
              </div>
            </div>

            <div className="sm:hidden text-right shrink-0">
              <span className="text-sm font-extrabold text-foreground font-mono">
                {formatINR(grandTotal)}
              </span>
              <span className="block text-[10px] text-muted-foreground leading-tight">
                incl. GST
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs text-muted-foreground">Grand Total (incl. GST)</span>
              <span className="text-xl font-extrabold text-foreground font-mono">
                {formatINR(grandTotal)}
              </span>
            </div>

            {isOnline && (
              <Button
                variant="outline"
                size="lg"
                onClick={() => handleSubmit(true)}
                disabled={totalItemCount === 0 || isSubmitting || createOrderMutation.isPending}
                className="min-h-[44px] h-11 sm:h-12 px-4 text-sm font-medium cursor-pointer"
              >
                Save draft
              </Button>
            )}

            <Button
              size="lg"
              onClick={() => handleSubmit(false)}
              disabled={totalItemCount === 0 || isSubmitting || createOrderMutation.isPending}
              className="w-full sm:w-auto min-h-[44px] h-11 sm:h-12 sm:min-w-[170px] px-4 sm:px-6 text-sm font-bold gap-2 shadow-md cursor-pointer"
            >
              {isSubmitting || createOrderMutation.isPending ? (
                <>
                  <RefreshCwIcon className="size-4 animate-spin" aria-hidden="true" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <CheckCircle2Icon className="size-4" aria-hidden="true" />
                  <span>{isOnline ? "Place Sales Order" : "Queue Offline Order"}</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}
