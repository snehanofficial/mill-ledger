import { useState, useId } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useSyncManager } from "@/offline/use-offline";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { formatINR } from "@/lib/formatters";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
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
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react";
import { toast } from "sonner";

interface ProductItem {
  id: string;
  sku: string;
  name: string;
  productName?: string;
  defaultPrice: number;
  taxRate: number;
  hsnCode?: string;
  uom?: string;
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
}

interface StockBalance {
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

  const [selectedCustomerId, setSelectedCustomerId] = useState("CUST-RET-A");
  const [quantities, setQuantities] = useState<Record<string, number>>({
    "VAR-MURUKKU-200G": 150,
  });
  const [orderNotes, setOrderNotes] = useState("Wholesale store delivery");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const [productCache, setProductCache] = useState<Record<string, ProductItem>>({
    "VAR-MURUKKU-200G": {
      id: "VAR-MURUKKU-200G",
      sku: "VAR-MURUKKU-200G",
      name: "Murukku 200 g",
      productName: "Murukku Standard Pack",
      defaultPrice: 50.0,
      taxRate: 5.0,
      uom: "PKT",
      imageUrl: "/products/murukku.svg",
    },
  });

  // Fetch customers
  const { data: customersData } = useQuery<{ customers: CustomerItem[] }>({
    queryKey: ["sales-customers"],
    queryFn: async () => {
      const res = await apiClient.get("/sales/customers");
      return res.data;
    },
  });

  // Fetch paginated products
  const {
    data: productsData,
    isLoading: isProductsLoading,
    isError: isProductsError,
    error: productsError,
    isFetching: isProductsFetching,
    refetch: refetchProducts,
  } = useQuery<ProductsResponse>({
    queryKey: ["sales-products", page, pageSize],
    queryFn: async () => {
      const offset = (page - 1) * pageSize;
      const res = await apiClient.get<ProductsResponse>(
        `/sales/products?organizationId=MILL&limit=${pageSize}&offset=${offset}`,
      );
      return res.data;
    },
    placeholderData: keepPreviousData,
  });

  // Fetch stock balances
  const { data: stockData } = useQuery<{ balances: StockBalance[] }>({
    queryKey: ["inventory-balances"],
    queryFn: async () => {
      const res = await apiClient.get(
        "/inventory/balances?organizationId=MILL",
      );
      return res.data;
    },
  });

  const customersList: CustomerItem[] = customersData?.customers || [
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

  const productsList: ProductItem[] = productsData?.products ?? [];
  const totalProducts = productsData?.pagination?.total ?? productsList.length;
  const totalPages = Math.max(1, Math.ceil(totalProducts / pageSize));
  const rangeStart = totalProducts === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalProducts);

  const visiblePageNumbers = (() => {
    const maxButtons = 5;
    if (totalPages <= maxButtons) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const start = Math.max(1, Math.min(page - 2, totalPages - maxButtons + 1));
    return Array.from({ length: maxButtons }, (_, i) => start + i);
  })();

  const balances = stockData?.balances || [];

  const activeCustomer =
    customersList.find(
      (c) => c.id === selectedCustomerId || c.code === selectedCustomerId,
    ) || customersList[0];

  const customerState = activeCustomer?.state || "Tamil Nadu";
  const isIntraState = customerState.trim().toLowerCase() === "tamil nadu";

  const getProductStock = (sku: string) => {
    return balances.find((b) => b.sku === sku)?.available ?? 0;
  };

  const updateQuantity = (product: ProductItem, qty: number) => {
    const validQty = Math.max(0, Math.floor(qty || 0));
    setProductCache((prev) => ({
      ...prev,
      [product.id]: product,
      [product.sku]: product,
    }));
    setQuantities((prev) => ({
      ...prev,
      [product.id]: validQty,
    }));
  };

  const handleStep = (product: ProductItem, delta: number) => {
    const current = quantities[product.id] ?? quantities[product.sku] ?? 0;
    updateQuantity(product, current + delta);
  };

  // Order summary calculations across all paginated selections
  const orderLines = Object.entries(quantities)
    .filter(([, qty]) => qty > 0)
    .map(([key, qty]) => {
      const product =
        productsList.find((p) => p.id === key || p.sku === key) ??
        productCache[key];
      if (!product) return null;
      const unitPrice = Number(product.defaultPrice || 50.0);
      const taxable = qty * unitPrice;
      const taxRate = Number(product.taxRate || 5.0) / 100;
      const tax = taxable * taxRate;
      const total = taxable + tax;
      const stock = getProductStock(product.sku);
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

  // Submit order mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!activeCustomer) {
        throw new Error("Please select a customer before placing an order.");
      }
      const payload = {
        organizationId: "MILL",
        customerId: activeCustomer.id,
        orderNumber: generateOrderNumber(),
        notes: orderNotes,
        lines: orderLines.map((l) => ({
          productVariantId: l.product.id,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
      };
      const res = await apiClient.post("/sales/orders", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-balances"] });
      toast.success("Sales order placed successfully!");
      navigate("/orders");
    },
    onError: (err: unknown) => {
      toast.error(`Order failed: ${extractErrorMessage(err, "Failed to place order")}`);
    },
  });

  const handleSubmit = async () => {
    if (!activeCustomer) {
      toast.error("Please select a customer before placing an order.");
      return;
    }
    if (totalItemCount === 0) {
      toast.error("Please add at least one product packet to your order.");
      return;
    }

    if (!isOnline) {
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
      await createOrderMutation.mutateAsync();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col pb-32">
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

      <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full flex flex-col gap-6">
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
                <SelectContent>
                  {customersList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.code}) — {c.state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span>Place of Supply: <strong>{customerState}</strong></span>
                <span>•</span>
                <span className="text-primary font-medium">
                  {isIntraState ? "Intra-state (CGST 2.5% + SGST 2.5%)" : "Inter-state (IGST 5.0%)"}
                </span>
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
                Product Catalog ({totalProducts} {totalProducts === 1 ? "item" : "items"})
              </h2>
              <p className="text-xs text-muted-foreground">
                Touch <strong>+</strong> or <strong>−</strong> steppers (min 44px) to adjust batch packet quantity
              </p>
            </div>
            {totalProducts > 0 && (
              <div className="text-xs text-muted-foreground" aria-live="polite">
                Showing {rangeStart}–{rangeEnd} of {totalProducts}
                {isProductsFetching && !isProductsLoading ? " (Updating...)" : ""}
              </div>
            )}
          </div>

          {isProductsLoading ? (
            <div
              role="status"
              aria-live="polite"
              className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground"
            >
              Loading product catalog...
            </div>
          ) : isProductsError ? (
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
          ) : productsList.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center flex flex-col items-center gap-3">
              <p className="text-sm font-semibold text-foreground">
                No products found on this page
              </p>
              <p className="text-xs text-muted-foreground">
                {page > 1
                  ? "Return to the first page to view available products."
                  : "No active sellable product variants are configured for this organization."}
              </p>
              {page > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPage(1)}
                  className="min-h-[44px] cursor-pointer"
                >
                  Go to Page 1
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
                {productsList.map((product) => {
                  const qty = quantities[product.id] ?? quantities[product.sku] ?? 0;
                  const unitPrice = Number(product.defaultPrice || 50.0);
                  const availableStock = getProductStock(product.sku);
                  const isShort = qty > availableStock;
                  const hasOrder = qty > 0;

                  return (
                    <article
                      key={product.id}
                      className={`product-card group relative flex flex-col justify-between rounded-xl border bg-card p-4 sm:p-5 shadow-xs transition-all duration-200 hover:shadow-md ${
                        hasOrder
                          ? "border-primary/40 ring-1 ring-primary/20 bg-primary/[0.02]"
                          : "border-border"
                      }`}
                    >
                      <div className="flex flex-col gap-3">
                        {/* Visual Product Thumbnail with semantic img element */}
                        <div className="relative aspect-video w-full rounded-lg bg-muted/40 border border-border/60 overflow-hidden flex items-center justify-center p-2">
                          <img
                            src={product.imageUrl || "/products/murukku.svg"}
                            alt={`${product.name} packaging pouch`}
                            width={112}
                            height={112}
                            className="h-28 w-28 object-contain transition-transform duration-300 group-hover:scale-105 drop-shadow-xs"
                          />
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
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">
                          {product.sku}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          HSN: {product.hsnCode || "21069099"}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-foreground mt-0.5">
                        {product.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {product.productName || "Standard Retail Milling Pack"} ({product.uom || "PKT"})
                      </p>
                    </div>

                    {/* Pricing */}
                    <div className="flex items-baseline justify-between pt-1 border-t border-border/50">
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

                  {/* Quantity Stepper & Shortage Notice */}
                  <div className="mt-4 pt-3 border-t border-border flex flex-col gap-2">
                    {isShort && (
                      <div
                        role="status"
                        aria-live="polite"
                        className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md p-2"
                      >
                        <AlertTriangleIcon className="size-3.5 shrink-0" aria-hidden="true" />
                        <span>
                          Shortage: {qty - availableStock} pkts exceeds stock
                        </span>
                      </div>
                    )}

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

                    {qty > 0 && (
                      <div className="flex items-center justify-between text-xs pt-1 text-muted-foreground">
                        <span>Line Total:</span>
                        <span className="font-mono font-bold text-foreground">
                          {formatINR(qty * unitPrice * 1.05)} (incl. GST)
                        </span>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
              </div>

              {totalPages > 1 && (
                <nav
                  aria-label="Product catalog pagination"
                  className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <div className="text-xs text-muted-foreground">
                    Page <span className="font-semibold text-foreground">{page}</span> of{" "}
                    <span className="font-semibold text-foreground">{totalPages}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1 || isProductsFetching}
                      aria-label="Go to previous page"
                      className="min-h-[44px] px-3 gap-1 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <ChevronLeftIcon className="size-4" aria-hidden="true" />
                      <span>Previous</span>
                    </Button>

                    {visiblePageNumbers.map((pageNum) => (
                      <Button
                        key={pageNum}
                        type="button"
                        variant={pageNum === page ? "primary" : "outline"}
                        onClick={() => setPage(pageNum)}
                        disabled={isProductsFetching}
                        aria-label={`Go to page ${pageNum}`}
                        aria-current={pageNum === page ? "page" : undefined}
                        className="min-w-[44px] min-h-[44px] px-3 cursor-pointer disabled:cursor-not-allowed"
                      >
                        {pageNum}
                      </Button>
                    ))}

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages || isProductsFetching}
                      aria-label="Go to next page"
                      className="min-h-[44px] px-3 gap-1 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <span>Next</span>
                      <ChevronRightIcon className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </nav>
              )}
            </>
          )}
        </section>
      </div>

      {/* Sticky Bottom Summary Checkout Bar */}
      <footer className="fixed bottom-0 left-0 right-0 z-30 border-t bg-card/95 backdrop-blur-md px-4 py-3 sm:px-8 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShoppingCartIcon className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">
                    {totalItemCount} {totalItemCount === 1 ? "Packet" : "Packets"}
                  </span>
                  {anyShortage && (
                    <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/20">
                      Shortage flagged
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Subtotal: {formatINR(totalTaxable)}</span>
                  <span>•</span>
                  <span>GST: {formatINR(totalTax)}</span>
                </div>
              </div>
            </div>

            <div className="sm:hidden text-right">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Total</span>
              <div className="text-base font-extrabold text-foreground font-mono">
                {formatINR(grandTotal)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs text-muted-foreground">Grand Total (incl. GST)</span>
              <span className="text-xl font-extrabold text-foreground font-mono">
                {formatINR(grandTotal)}
              </span>
            </div>

            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={totalItemCount === 0 || isSubmitting || createOrderMutation.isPending}
              className="w-full sm:w-auto h-12 min-w-[170px] px-6 text-sm font-bold gap-2 shadow-md cursor-pointer"
            >
              {isSubmitting || createOrderMutation.isPending ? (
                <>
                  <RefreshCwIcon className="size-4 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <CheckCircle2Icon className="size-4" />
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
