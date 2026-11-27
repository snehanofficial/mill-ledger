import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useUrlState } from "@/hooks/use-url-state";
import { formatINR } from "@/lib/formatters";
import { SkeletonTable, ErrorState } from "@/components/ui/loading-error-empty";
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
import { Checkbox } from "@/components/ui/checkbox";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PackageIcon,
  PlusCircleIcon,
  PencilIcon,
  RefreshCwIcon,
  TagIcon,
  ArchiveIcon,
  RotateCcwIcon,
  Trash2Icon,
  SearchIcon,
} from "lucide-react";
import { toast } from "sonner";

interface UomItem {
  id: string;
  code: string;
  name: string;
  symbol: string;
}

interface FinishedGoodsItem {
  id: string;
  code: string;
  name: string;
}

interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  name: string;
  packSize: number | string;
  uomId: string;
  inventoryItemId?: string | null;
  inventoryItem?: FinishedGoodsItem | null;
  isActive: boolean;
  uom: UomItem;
  priceLines: Array<{
    id: string;
    price: number | string;
    priceList: { id: string; code: string; name: string; isDefault: boolean };
  }>;
}

interface Product {
  id: string;
  code: string;
  name: string;
  hsnCode: string;
  taxRate: number | string;
  isActive: boolean;
  variants: ProductVariant[];
}

interface PriceList {
  id: string;
  code: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  lines: Array<{
    id: string;
    productVariantId: string;
    price: number | string;
    productVariant: { id: string; sku: string; name: string };
  }>;
}

const UNLINKED_INVENTORY_VALUE = "__NONE__";

export function ProductsPage() {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const canManage = user?.role === "ADMIN";
  const [activeTab, setActiveTab] = useUrlState<"products" | "pricelists">(
    "tab",
    "products",
  );
  const [searchQuery, setSearchQuery] = useUrlState("q", "", {
    debounceMs: 200,
  });
  const [statusFilter, setStatusFilter] = useUrlState<
    "ALL" | "ACTIVE" | "ARCHIVED"
  >("status", "ACTIVE");

  // Product modal state
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodCode, setProdCode] = useState("");
  const [prodName, setProdName] = useState("");
  const [prodHsn, setProdHsn] = useState("21069099");
  const [prodTaxRate, setProdTaxRate] = useState("5");

  // Variant modal state
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(
    null,
  );
  const [varProductId, setVarProductId] = useState("");
  const [varSku, setVarSku] = useState("");
  const [varName, setVarName] = useState("");
  const [varPackSize, setVarPackSize] = useState("500");
  const [varUomId, setVarUomId] = useState("");
  const [varInventoryItemId, setVarInventoryItemId] = useState(
    UNLINKED_INVENTORY_VALUE,
  );
  const [varDefaultPrice, setVarDefaultPrice] = useState("100");

  // Delete variant confirmation state
  const [deletingVariant, setDeletingVariant] =
    useState<ProductVariant | null>(null);

  // Price list modal state
  const [showPriceListModal, setShowPriceListModal] = useState(false);
  const [plCode, setPlCode] = useState("");
  const [plName, setPlName] = useState("");
  const [plIsDefault, setPlIsDefault] = useState(false);
  const [editingPriceLine, setEditingPriceLine] = useState<{
    priceListId: string;
    priceListName: string;
    variantId: string;
    variantName: string;
    price: string;
  } | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{
    products: Product[];
    uoms: UomItem[];
    finishedGoodsItems: FinishedGoodsItem[];
    priceLists: PriceList[];
  }>({
    queryKey: ["masters-products"],
    queryFn: async () => {
      const res = await apiClient.get("/masters/products");
      return res.data;
    },
  });

  const products = useMemo(() => data?.products ?? [], [data?.products]);
  const uoms = useMemo(() => data?.uoms ?? [], [data?.uoms]);
  const finishedGoodsItems = useMemo(
    () => data?.finishedGoodsItems ?? [],
    [data?.finishedGoodsItems],
  );
  const priceLists = useMemo(() => data?.priceLists ?? [], [data?.priceLists]);
  const allVariants = useMemo(
    () => products.flatMap((p) => p.variants),
    [products],
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredProducts = useMemo(() => {
    return products
      .filter((prod) => {
        if (statusFilter === "ACTIVE" && !prod.isActive) return false;
        if (statusFilter === "ARCHIVED" && prod.isActive) return false;
        if (!normalizedQuery) return true;
        const matchesProduct =
          prod.code.toLowerCase().includes(normalizedQuery) ||
          prod.name.toLowerCase().includes(normalizedQuery) ||
          prod.hsnCode.toLowerCase().includes(normalizedQuery);
        const matchesVariant = prod.variants.some(
          (v) =>
            v.sku.toLowerCase().includes(normalizedQuery) ||
            v.name.toLowerCase().includes(normalizedQuery),
        );
        return matchesProduct || matchesVariant;
      })
      .map((prod) => {
        if (!normalizedQuery) return prod;
        const prodMatched =
          prod.code.toLowerCase().includes(normalizedQuery) ||
          prod.name.toLowerCase().includes(normalizedQuery) ||
          prod.hsnCode.toLowerCase().includes(normalizedQuery);
        if (prodMatched) return prod;
        return {
          ...prod,
          variants: prod.variants.filter(
            (v) =>
              v.sku.toLowerCase().includes(normalizedQuery) ||
              v.name.toLowerCase().includes(normalizedQuery),
          ),
        };
      });
  }, [products, statusFilter, normalizedQuery]);

  const filteredVariantsForPricing = useMemo(() => {
    return allVariants.filter((v) => {
      if (statusFilter === "ACTIVE" && !v.isActive) return false;
      if (statusFilter === "ARCHIVED" && v.isActive) return false;
      if (!normalizedQuery) return true;
      return (
        v.sku.toLowerCase().includes(normalizedQuery) ||
        v.name.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [allVariants, statusFilter, normalizedQuery]);

  const invalidateProducts = () => {
    queryClient.invalidateQueries({ queryKey: ["masters-products"] });
    queryClient.invalidateQueries({ queryKey: ["sales-products"] });
  };

  const saveProductMutation = useMutation({
    mutationFn: async () => {
      const parsedTax = Number(prodTaxRate);
      if (editingProduct) {
        return (
          await apiClient.put(`/masters/products/${editingProduct.id}`, {
            name: prodName.trim(),
            hsnCode: prodHsn.trim(),
            taxRate: parsedTax,
          })
        ).data;
      }
      return (
        await apiClient.post("/masters/products", {
          code: prodCode.trim().toUpperCase(),
          name: prodName.trim(),
          hsnCode: prodHsn.trim(),
          taxRate: parsedTax,
        })
      ).data;
    },
    onSuccess: () => {
      invalidateProducts();
      setShowProductModal(false);
      setEditingProduct(null);
      toast.success(editingProduct ? "Product updated." : "Product created.");
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to save product"));
    },
  });

  const toggleProductArchiveMutation = useMutation({
    mutationFn: async (p: Product) => {
      return (
        await apiClient.put(`/masters/products/${p.id}`, {
          isActive: !p.isActive,
        })
      ).data;
    },
    onSuccess: (_data, p) => {
      invalidateProducts();
      toast.success(p.isActive ? "Product archived." : "Product restored.");
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to update product status"));
    },
  });

  const saveVariantMutation = useMutation({
    mutationFn: async () => {
      const linkedInventoryId =
        varInventoryItemId === UNLINKED_INVENTORY_VALUE
          ? null
          : varInventoryItemId;

      if (editingVariant) {
        return (
          await apiClient.put(`/masters/variants/${editingVariant.id}`, {
            name: varName.trim(),
            packSize: Number(varPackSize),
            uomId: varUomId,
            inventoryItemId: linkedInventoryId,
          })
        ).data;
      }
      return (
        await apiClient.post("/masters/variants", {
          productId: varProductId,
          sku: varSku.trim().toUpperCase(),
          name: varName.trim(),
          packSize: Number(varPackSize),
          uomId: varUomId,
          inventoryItemId: linkedInventoryId,
          defaultPrice: Number(varDefaultPrice),
        })
      ).data;
    },
    onSuccess: () => {
      invalidateProducts();
      setShowVariantModal(false);
      setEditingVariant(null);
      toast.success(
        editingVariant ? "Pack size updated." : "Pack size created.",
      );
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to save pack size"));
    },
  });

  const toggleVariantArchiveMutation = useMutation({
    mutationFn: async (v: ProductVariant) => {
      return (
        await apiClient.put(`/masters/variants/${v.id}`, {
          isActive: !v.isActive,
        })
      ).data;
    },
    onSuccess: (_data, v) => {
      invalidateProducts();
      toast.success(v.isActive ? "Pack size archived." : "Pack size restored.");
    },
    onError: (err: unknown) => {
      toast.error(
        extractErrorMessage(err, "Failed to update pack size status"),
      );
    },
  });

  const deleteVariantMutation = useMutation({
    mutationFn: async (id: string) => {
      return (await apiClient.delete(`/masters/variants/${id}`)).data;
    },
    onSuccess: () => {
      invalidateProducts();
      setDeletingVariant(null);
      toast.success("Pack size deleted.");
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to delete pack size"));
    },
  });

  const createPriceListMutation = useMutation({
    mutationFn: async () => {
      return (
        await apiClient.post("/masters/price-lists", {
          code: plCode.trim().toUpperCase(),
          name: plName.trim(),
          isDefault: plIsDefault,
        })
      ).data;
    },
    onSuccess: () => {
      invalidateProducts();
      setShowPriceListModal(false);
      toast.success("Price list created.");
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to create price list"));
    },
  });

  const upsertPriceLineMutation = useMutation({
    mutationFn: async () => {
      if (!editingPriceLine) return;
      return (
        await apiClient.put(
          `/masters/price-lists/${editingPriceLine.priceListId}/lines`,
          {
            productVariantId: editingPriceLine.variantId,
            price: Number(editingPriceLine.price),
          },
        )
      ).data;
    },
    onSuccess: () => {
      invalidateProducts();
      setEditingPriceLine(null);
      toast.success("Unit price updated.");
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to update unit price"));
    },
  });

  const openAddProductModal = () => {
    setEditingProduct(null);
    setProdCode("");
    setProdName("");
    setProdHsn("21069099");
    setProdTaxRate("5");
    setShowProductModal(true);
  };

  const openAddVariantModal = (defaultProductId?: string) => {
    setEditingVariant(null);
    setVarProductId(defaultProductId || products[0]?.id || "");
    setVarSku("");
    setVarName("");
    setVarPackSize("500");
    setVarUomId(uoms[0]?.id || "");
    setVarInventoryItemId(UNLINKED_INVENTORY_VALUE);
    setVarDefaultPrice("100");
    setShowVariantModal(true);
  };

  const isProductFormValid =
    (editingProduct !== null || prodCode.trim().length > 0) &&
    prodName.trim().length > 0 &&
    prodHsn.trim().length >= 4 &&
    prodHsn.trim().length <= 12 &&
    prodTaxRate.trim() !== "" &&
    !Number.isNaN(Number(prodTaxRate)) &&
    Number(prodTaxRate) >= 0 &&
    Number(prodTaxRate) <= 28;

  const isVariantFormValid =
    (editingVariant !== null ||
      (varProductId.length > 0 && varSku.trim().length > 0)) &&
    varName.trim().length > 0 &&
    Number(varPackSize) > 0 &&
    varUomId.length > 0 &&
    (editingVariant !== null ||
      (varDefaultPrice.trim() !== "" && Number(varDefaultPrice) >= 0));

  const isPriceListFormValid =
    plCode.trim().length > 0 && plName.trim().length > 0;

  const isPriceLineValid =
    editingPriceLine !== null &&
    editingPriceLine.price.trim() !== "" &&
    !Number.isNaN(Number(editingPriceLine.price)) &&
    Number(editingPriceLine.price) >= 0;

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Products, Pack Sizes &amp; Price Lists
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage sellable product lines, pack sizes, HSN/GST rates, stock
            links, and wholesale price lists.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="min-h-9 gap-1.5"
          >
            <RefreshCwIcon
              aria-hidden="true"
              className={`size-3.5 ${isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          {canManage && activeTab === "products" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openAddVariantModal()}
                disabled={products.length === 0}
                className="min-h-9 gap-1.5"
              >
                <PlusCircleIcon aria-hidden="true" className="size-4" />
                Add Pack Size
              </Button>
              <Button
                size="sm"
                onClick={openAddProductModal}
                className="min-h-9 gap-1.5"
              >
                <PlusCircleIcon aria-hidden="true" className="size-4" />
                Add Product
              </Button>
            </>
          )}
          {canManage && activeTab === "pricelists" && (
            <Button
              size="sm"
              onClick={() => {
                setPlCode("");
                setPlName("");
                setPlIsDefault(false);
                setShowPriceListModal(true);
              }}
              className="min-h-9 gap-1.5"
            >
              <PlusCircleIcon aria-hidden="true" className="size-4" />
              New Price List
            </Button>
          )}
        </div>
      </div>

      {/* Tabs + Search/Filter bar */}
      <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Product catalog sections" className="flex gap-1">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "products"}
            onClick={() => setActiveTab("products")}
            className={`min-h-9 border-b-2 px-4 py-2 text-sm font-medium cursor-pointer transition-colors ${
              activeTab === "products"
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Products &amp; Variants ({allVariants.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "pricelists"}
            onClick={() => setActiveTab("pricelists")}
            className={`min-h-9 border-b-2 px-4 py-2 text-sm font-medium cursor-pointer transition-colors ${
              activeTab === "pricelists"
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Price Lists ({priceLists.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:w-64 sm:flex-initial">
            <SearchIcon
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label="Search products, SKUs, or HSN codes"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product, SKU, HSN..."
              className="h-9 pl-8 text-sm"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) =>
              setStatusFilter(v as "ALL" | "ACTIVE" | "ARCHIVED")
            }
          >
            <SelectTrigger
              aria-label="Filter by status"
              className="h-9 w-32 text-xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">Active only</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
              <SelectItem value="ALL">All statuses</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable rows={5} columns={6} />
      ) : isError ? (
        <ErrorState
          title="Failed to load products"
          description={
            error instanceof Error ? error.message : "Could not reach server."
          }
          error={error}
          onRetry={() => refetch()}
        />
      ) : activeTab === "products" ? (
        filteredProducts.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card p-8 text-center">
            <PackageIcon
              aria-hidden="true"
              className="size-8 text-muted-foreground"
            />
            <div className="max-w-sm space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {products.length === 0
                  ? "No products configured yet"
                  : "No matching products or pack sizes"}
              </p>
              <p className="text-xs text-muted-foreground">
                {products.length === 0
                  ? "Add your first product line to configure pack sizes, HSN/GST rates, and wholesale prices."
                  : "Try clearing the search query or switching the status filter."}
              </p>
            </div>
            {products.length === 0 && canManage ? (
              <Button variant="outline" size="sm" onClick={openAddProductModal} className="gap-1.5">
                <PlusCircleIcon aria-hidden="true" className="size-4" />
                Add Product
              </Button>
            ) : (
              (searchQuery || statusFilter !== "ALL") && (
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
              )
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredProducts.map((prod) => (
              <div
                key={prod.id}
                className="overflow-hidden rounded-xl border bg-card shadow-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <PackageIcon
                      aria-hidden="true"
                      className="size-4 text-muted-foreground"
                    />
                    <span className="font-mono text-xs font-semibold">
                      {prod.code}
                    </span>
                    <span className="text-sm font-semibold">{prod.name}</span>
                    <Badge variant="outline" className="font-mono text-2xs">
                      HSN {prod.hsnCode} | {Number(prod.taxRate)}% GST
                    </Badge>
                    <Badge
                      variant={prod.isActive ? "success" : "neutral"}
                      className="text-2xs"
                    >
                      {prod.isActive ? "Active" : "Archived"}
                    </Badge>
                  </div>
                  {canManage && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 px-2.5 text-xs"
                        onClick={() => openAddVariantModal(prod.id)}
                      >
                        <PlusCircleIcon aria-hidden="true" className="size-3.5" />
                        Add Pack Size
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 px-2.5 text-xs"
                        onClick={() => {
                          setEditingProduct(prod);
                          setProdCode(prod.code);
                          setProdName(prod.name);
                          setProdHsn(prod.hsnCode);
                          setProdTaxRate(String(Number(prod.taxRate)));
                          setShowProductModal(true);
                        }}
                      >
                        <PencilIcon aria-hidden="true" className="size-3.5" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={toggleProductArchiveMutation.isPending}
                        className="h-8 gap-1 px-2.5 text-xs text-muted-foreground"
                        onClick={() => toggleProductArchiveMutation.mutate(prod)}
                      >
                        {prod.isActive ? (
                          <ArchiveIcon aria-hidden="true" className="size-3.5" />
                        ) : (
                          <RotateCcwIcon aria-hidden="true" className="size-3.5" />
                        )}
                        {prod.isActive ? "Archive" : "Restore"}
                      </Button>
                    </div>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>Variant Name</TableHead>
                        <TableHead className="text-right">Pack Size</TableHead>
                        <TableHead>Finished Goods Link</TableHead>
                        <TableHead className="text-right">
                          Default Price
                        </TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        {canManage && (
                          <TableHead className="text-right">Actions</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {prod.variants.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={canManage ? 7 : 6}
                            className="py-5 text-center text-xs text-muted-foreground"
                          >
                            No pack sizes configured for this product.
                          </TableCell>
                        </TableRow>
                      ) : (
                        prod.variants.map((v) => {
                          const defPrice = v.priceLines.find(
                            (pl) => pl.priceList.isDefault,
                          )?.price;
                          return (
                            <TableRow key={v.id}>
                              <TableCell className="font-mono text-xs">
                                {v.sku}
                              </TableCell>
                              <TableCell className="text-sm font-medium">
                                {v.name}
                              </TableCell>
                              <TableCell className="text-right text-xs">
                                {Number(v.packSize)} {v.uom?.symbol || ""}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {v.inventoryItem ? (
                                  <span className="font-mono text-foreground">
                                    {v.inventoryItem.code}
                                  </span>
                                ) : (
                                  "Unlinked"
                                )}
                              </TableCell>
                              <TableCell className="text-right text-sm font-semibold">
                                {defPrice !== undefined
                                  ? formatINR(Number(defPrice))
                                  : "Not set"}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge
                                  variant={v.isActive ? "success" : "neutral"}
                                  className="text-2xs"
                                >
                                  {v.isActive ? "Active" : "Archived"}
                                </Badge>
                              </TableCell>
                              {canManage && (
                                <TableCell className="text-right">
                                  <div className="inline-flex items-center justify-end gap-1">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 gap-1 px-2 text-xs"
                                      onClick={() => {
                                        setEditingVariant(v);
                                        setVarProductId(v.productId);
                                        setVarSku(v.sku);
                                        setVarName(v.name);
                                        setVarPackSize(
                                          String(Number(v.packSize)),
                                        );
                                        setVarUomId(v.uomId);
                                        setVarInventoryItemId(
                                          v.inventoryItemId ||
                                            UNLINKED_INVENTORY_VALUE,
                                        );
                                        setShowVariantModal(true);
                                      }}
                                    >
                                      <PencilIcon
                                        aria-hidden="true"
                                        className="size-3"
                                      />
                                      Edit
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      disabled={
                                        toggleVariantArchiveMutation.isPending
                                      }
                                      className="h-8 px-2 text-xs text-muted-foreground"
                                      aria-label={
                                        v.isActive
                                          ? `Archive ${v.name}`
                                          : `Restore ${v.name}`
                                      }
                                      onClick={() =>
                                        toggleVariantArchiveMutation.mutate(v)
                                      }
                                    >
                                      {v.isActive ? (
                                        <ArchiveIcon
                                          aria-hidden="true"
                                          className="size-3.5"
                                        />
                                      ) : (
                                        <RotateCcwIcon
                                          aria-hidden="true"
                                          className="size-3.5"
                                        />
                                      )}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 px-2 text-xs text-destructive hover:text-destructive"
                                      aria-label={`Delete ${v.name}`}
                                      onClick={() => setDeletingVariant(v)}
                                    >
                                      <Trash2Icon
                                        aria-hidden="true"
                                        className="size-3.5"
                                      />
                                    </Button>
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </div>
        )
      ) : priceLists.length === 0 ? (
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card p-8 text-center">
          <TagIcon
            aria-hidden="true"
            className="size-8 text-muted-foreground"
          />
          <div className="max-w-sm space-y-1">
            <p className="text-sm font-semibold text-foreground">
              No price lists configured
            </p>
            <p className="text-xs text-muted-foreground">
              Create a wholesale or retail price list to assign unit prices to
              product variants.
            </p>
          </div>
          {canManage && (
            <Button
              size="sm"
              onClick={() => {
                setPlCode("");
                setPlName("");
                setPlIsDefault(false);
                setShowPriceListModal(true);
              }}
              className="gap-1.5"
            >
              <PlusCircleIcon aria-hidden="true" className="size-4" />
              New Price List
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {priceLists.map((pl) => (
            <div
              key={pl.id}
              className="overflow-hidden rounded-xl border bg-card shadow-xs"
            >
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-2">
                  <TagIcon
                    aria-hidden="true"
                    className="size-4 text-muted-foreground"
                  />
                  <span className="font-mono text-xs font-semibold">
                    {pl.code}
                  </span>
                  <span className="text-sm font-semibold">{pl.name}</span>
                  {pl.isDefault && <Badge variant="success">Default</Badge>}
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Product Variant</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      {canManage && (
                        <TableHead className="text-right">Action</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVariantsForPricing.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={canManage ? 5 : 4}
                          className="py-6 text-center text-xs text-muted-foreground"
                        >
                          <div className="flex flex-col items-center justify-center gap-2">
                            <span>No variants match the current filter.</span>
                            {(searchQuery || statusFilter !== "ALL") && (
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
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredVariantsForPricing.map((v) => {
                        const existingLine = pl.lines.find(
                          (l) => l.productVariantId === v.id,
                        );
                        const currentPrice = existingLine
                          ? Number(existingLine.price)
                          : 0;
                        return (
                          <TableRow key={v.id}>
                            <TableCell className="font-mono text-xs">
                              {v.sku}
                            </TableCell>
                            <TableCell className="text-sm">{v.name}</TableCell>
                            <TableCell className="text-center">
                              <Badge
                                variant={v.isActive ? "success" : "neutral"}
                                className="text-2xs"
                              >
                                {v.isActive ? "Active" : "Archived"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {existingLine
                                ? formatINR(currentPrice)
                                : "Not set"}
                            </TableCell>
                            {canManage && (
                              <TableCell className="text-right">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 px-2.5 text-xs"
                                  onClick={() =>
                                    setEditingPriceLine({
                                      priceListId: pl.id,
                                      priceListName: pl.name,
                                      variantId: v.id,
                                      variantName: v.name,
                                      price: String(currentPrice),
                                    })
                                  }
                                >
                                  Set Price
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Product Modal */}
      <Dialog open={showProductModal} onOpenChange={setShowProductModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Edit Product" : "Add Product"}
            </DialogTitle>
            <DialogDescription>
              Configure product code, HSN code, and GST rate.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="prod-code" className="text-xs">
                Product Code
              </Label>
              <Input
                id="prod-code"
                value={prodCode}
                disabled={editingProduct !== null}
                onChange={(e) => setProdCode(e.target.value)}
                placeholder="PROD-MURUKKU"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="prod-name" className="text-xs">
                Product Name
              </Label>
              <Input
                id="prod-name"
                value={prodName}
                onChange={(e) => setProdName(e.target.value)}
                placeholder="Murukku"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="prod-hsn" className="text-xs">
                  HSN Code (4-12 chars)
                </Label>
                <Input
                  id="prod-hsn"
                  value={prodHsn}
                  onChange={(e) => setProdHsn(e.target.value)}
                  placeholder="21069099"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="prod-tax" className="text-xs">
                  GST Rate (0-28%)
                </Label>
                <Input
                  id="prod-tax"
                  type="number"
                  step="0.5"
                  min={0}
                  max={28}
                  value={prodTaxRate}
                  onChange={(e) => setProdTaxRate(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowProductModal(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!isProductFormValid || saveProductMutation.isPending}
              onClick={() => saveProductMutation.mutate()}
            >
              Save Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Variant Modal */}
      <Dialog open={showVariantModal} onOpenChange={setShowVariantModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingVariant ? "Edit Pack Size" : "Add Pack Size / Variant"}
            </DialogTitle>
            <DialogDescription>
              Define SKU, pack size, unit, finished-goods stock link, and
              default selling price.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            {!editingVariant && (
              <div className="flex flex-col gap-1">
                <Label htmlFor="var-product" className="text-xs">
                  Product
                </Label>
                <Select value={varProductId} onValueChange={setVarProductId}>
                  <SelectTrigger id="var-product" className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent searchable searchPlaceholder="Search products...">
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <Label htmlFor="var-sku" className="text-xs">
                SKU
              </Label>
              <Input
                id="var-sku"
                value={varSku}
                disabled={editingVariant !== null}
                onChange={(e) => setVarSku(e.target.value)}
                placeholder="VAR-MURUKKU-500G"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="var-name" className="text-xs">
                Variant Name
              </Label>
              <Input
                id="var-name"
                value={varName}
                onChange={(e) => setVarName(e.target.value)}
                placeholder="Murukku 500 g"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="var-pack" className="text-xs">
                  Pack Size
                </Label>
                <Input
                  id="var-pack"
                  type="number"
                  min={0.001}
                  step="any"
                  value={varPackSize}
                  onChange={(e) => setVarPackSize(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="var-uom" className="text-xs">
                  Unit (UOM)
                </Label>
                <Select value={varUomId} onValueChange={setVarUomId}>
                  <SelectTrigger id="var-uom" className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {uoms.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} ({u.symbol})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="var-inv-item" className="text-xs">
                Finished Goods Stock Item (optional)
              </Label>
              <Select
                value={varInventoryItemId}
                onValueChange={setVarInventoryItemId}
              >
                <SelectTrigger id="var-inv-item" className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  searchable
                  searchPlaceholder="Search finished goods..."
                >
                  <SelectItem value={UNLINKED_INVENTORY_VALUE}>
                    Unlinked (no stock item)
                  </SelectItem>
                  {finishedGoodsItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.code} - {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!editingVariant && (
              <div className="flex flex-col gap-1">
                <Label htmlFor="var-price" className="text-xs">
                  Default Unit Price (INR)
                </Label>
                <Input
                  id="var-price"
                  type="number"
                  step="0.01"
                  min={0}
                  value={varDefaultPrice}
                  onChange={(e) => setVarDefaultPrice(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter className="border-t pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowVariantModal(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!isVariantFormValid || saveVariantMutation.isPending}
              onClick={() => saveVariantMutation.mutate()}
            >
              Save Variant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Variant Confirmation Modal */}
      <Dialog
        open={deletingVariant !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingVariant(null);
        }}
      >
        {deletingVariant && (
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete Pack Size</DialogTitle>
              <DialogDescription>
                Delete {deletingVariant.name} ({deletingVariant.sku})? Variants
                referenced by sales orders or BOM recipes cannot be deleted and
                should be archived instead.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeletingVariant(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteVariantMutation.isPending}
                onClick={() => deleteVariantMutation.mutate(deletingVariant.id)}
              >
                Delete Pack Size
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* New Price List Modal */}
      <Dialog open={showPriceListModal} onOpenChange={setShowPriceListModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Price List</DialogTitle>
            <DialogDescription>
              Add a new wholesale or retail price list.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="pl-code" className="text-xs">
                Code
              </Label>
              <Input
                id="pl-code"
                value={plCode}
                onChange={(e) => setPlCode(e.target.value)}
                placeholder="PL-RETAIL"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="pl-name" className="text-xs">
                Name
              </Label>
              <Input
                id="pl-name"
                value={plName}
                onChange={(e) => setPlName(e.target.value)}
                placeholder="Retail MRP"
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="pl-default"
                checked={plIsDefault}
                onCheckedChange={(checked) => setPlIsDefault(checked === true)}
              />
              <Label htmlFor="pl-default" className="text-xs cursor-pointer">
                Set as default price list
              </Label>
            </div>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPriceListModal(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={
                !isPriceListFormValid || createPriceListMutation.isPending
              }
              onClick={() => createPriceListMutation.mutate()}
            >
              Create Price List
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Price Line Modal */}
      <Dialog
        open={editingPriceLine !== null}
        onOpenChange={(o) => {
          if (!o) setEditingPriceLine(null);
        }}
      >
        {editingPriceLine && (
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Set Unit Price</DialogTitle>
              <DialogDescription>
                {editingPriceLine.priceListName}:{" "}
                {editingPriceLine.variantName}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1 py-2">
              <Label htmlFor="pl-line-price" className="text-xs">
                Unit Price (INR)
              </Label>
              <Input
                id="pl-line-price"
                type="number"
                step="0.01"
                min={0}
                value={editingPriceLine.price}
                onChange={(e) =>
                  setEditingPriceLine((prev) =>
                    prev ? { ...prev, price: e.target.value } : null,
                  )
                }
              />
            </div>
            <DialogFooter className="border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingPriceLine(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={
                  !isPriceLineValid || upsertPriceLineMutation.isPending
                }
                onClick={() => upsertPriceLineMutation.mutate()}
              >
                Save Price
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
