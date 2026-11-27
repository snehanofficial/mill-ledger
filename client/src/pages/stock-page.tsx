import { useState } from "react";
import { Link } from "react-router-dom";
import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import type { PaginationMeta } from "@mill-ledger/shared";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { assertCollectionResponse } from "@/lib/api-contracts";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useWarehouses } from "@/hooks/use-warehouses";
import { useUrlState } from "@/hooks/use-url-state";
import { usePagination } from "@/hooks/use-pagination";
import { formatINR, formatQuantity } from "@/lib/formatters";
import { useLanguage } from "@/lib/i18n";
import { DataPagination } from "@/components/ui/data-pagination";
import {
  DataTable,
  DataTableColumnHeader,
  type DataTableColumnMeta,
} from "@/components/ui/data-table";
import {
  EmptyState,
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
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
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
  CheckCircleIcon,
  RefreshCwIcon,
  PackageIcon,
  AlertTriangleIcon,
  ArrowLeftRightIcon,
  BookOpenIcon,
  PlusCircleIcon,
  SlidersHorizontalIcon,
  ScaleIcon,
  PencilIcon,
} from "lucide-react";

interface InventoryBalance {
  id: string;
  sku: string;
  name: string;
  category: "RAW_MATERIAL" | "PACKAGING" | "FINISHED_GOODS";
  baseUom: {
    code: string;
    symbol: string;
  };
  onHand: number;
  reserved: number;
  available: number;
  weightedAverageCost: number;
  reconciled: boolean;
  ledgerSum: number;
}

const CATEGORY_LABELS: Record<
  InventoryBalance["category"],
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  RAW_MATERIAL: { label: "Raw Material", variant: "secondary" },
  PACKAGING: { label: "Packaging", variant: "outline" },
  FINISHED_GOODS: { label: "Finished Goods", variant: "default" },
};

export function StockPage() {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const { t } = useLanguage();
  const canManageInventory = user?.role === "ADMIN";
  const [searchQuery, setSearchQuery] = useUrlState("q", "", {
    debounceMs: 250,
  });
  const [categoryFilter, setCategoryFilter] = useUrlState("category", "ALL");
  const [stockFilter, setStockFilter] = useUrlState("stock", "ALL");
  const [selectedLedgerItem, setSelectedLedgerItem] =
    useState<InventoryBalance | null>(null);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showUomsModal, setShowUomsModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryBalance | null>(null);
  const [editItemName, setEditItemName] = useState("");

  // UOM & Conversion state
  const [uomCode, setUomCode] = useState("");
  const [uomName, setUomName] = useState("");
  const [uomSymbol, setUomSymbol] = useState("");
  const [convFromId, setConvFromId] = useState("");
  const [convToId, setConvToId] = useState("");
  const [convFactor, setConvFactor] = useState<number>(1);

  // Add Item state
  const [itemSku, setItemSku] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemCategory, setItemCategory] = useState<
    "RAW_MATERIAL" | "PACKAGING" | "FINISHED_GOODS"
  >("RAW_MATERIAL");
  const [itemUomId, setItemUomId] = useState("");
  const [itemOpeningStock, setItemOpeningStock] = useState(0);
  const [itemOpeningCost, setItemOpeningCost] = useState(0);

  // Stock Adjustment state
  const [adjItemId, setAdjItemId] = useState("");
  const [adjQty, setAdjQty] = useState(0);
  const [adjReason, setAdjReason] = useState("");

  const { data: warehousesData } = useWarehouses();
  const warehouses = warehousesData?.warehouses ?? [];
  const [warehouseFilter, setWarehouseFilter] = useState<string>("ALL");
  const [adjWarehouseId, setAdjWarehouseId] = useState<string>("");
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [trfFromWhId, setTrfFromWhId] = useState("");
  const [trfToWhId, setTrfToWhId] = useState("");
  const [trfItemId, setTrfItemId] = useState("");
  const [trfQty, setTrfQty] = useState<number>(1);
  const [trfNotes, setTrfNotes] = useState("");

  const { data: uomsData } = useQuery<{
    uoms: Array<{ id: string; code: string; name: string; symbol: string }>;
    conversions: Array<{
      id: string;
      factor: number | string;
      fromUom: { id: string; code: string; name: string; symbol: string };
      toUom: { id: string; code: string; name: string; symbol: string };
    }>;
  }>({
    queryKey: ["inventory-uoms"],
    enabled: canManageInventory,
    queryFn: async () => {
      const res = await apiClient.get("/inventory/uoms");
      return res.data;
    },
  });

  const createUomMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post("/inventory/uoms", {
        code: uomCode.trim(),
        name: uomName.trim(),
        symbol: uomSymbol.trim(),
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-uoms"] });
      setUomCode("");
      setUomName("");
      setUomSymbol("");
      toast.success("Unit of measure added.");
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to create UOM"));
    },
  });

  const createConversionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post("/inventory/unit-conversions", {
        fromUomId: convFromId,
        toUomId: convToId,
        factor: Number(convFactor),
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-uoms"] });
      setConvFactor(1);
      toast.success("Unit conversion added.");
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to create conversion"));
    },
  });

  const editItemMutation = useMutation({
    mutationFn: async () => {
      if (!editingItem) throw new Error("No item selected");
      const res = await apiClient.put(`/inventory/items/${editingItem.id}`, {
        name: editItemName.trim(),
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-balances"] });
      setEditingItem(null);
      toast.success("Inventory item updated.");
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to update inventory item"));
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post("/inventory/items", {
        sku: itemSku.trim(),
        name: itemName.trim(),
        category: itemCategory,
        baseUomId: itemUomId,
        openingStock: Number(itemOpeningStock),
        openingUnitCost: Number(itemOpeningCost),
        ...(warehouseFilter !== "ALL" ? { warehouseId: warehouseFilter } : {}),
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-balances"] });
      setShowAddItemModal(false);
      toast.success("Inventory item created.");
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to create inventory item"));
    },
  });

  const adjustStockMutation = useMutation({
    mutationFn: async () => {
      const targetWh =
        adjWarehouseId ||
        (warehouseFilter !== "ALL" ? warehouseFilter : warehouses[0]?.id);
      const res = await apiClient.post("/inventory/adjustments", {
        ...(targetWh ? { warehouseId: targetWh } : {}),
        inventoryItemId: adjItemId,
        quantity: Number(adjQty),
        reason: adjReason.trim(),
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-balances"] });
      setShowAdjustModal(false);
      toast.success("Stock adjustment posted.");
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to post stock adjustment"));
    },
  });

  const transferStockMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post("/inventory/transfers", {
        fromWarehouseId: trfFromWhId,
        toWarehouseId: trfToWhId,
        notes: trfNotes.trim() || undefined,
        items: [{ inventoryItemId: trfItemId, quantity: Number(trfQty) }],
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-balances"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-item-ledger"] });
      setShowTransferModal(false);
      toast.success("Inter-warehouse transfer posted.");
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to post stock transfer"));
    },
  });

  const {
    data: ledgerData,
    isLoading: isLedgerLoading,
    isError: isLedgerError,
    refetch: refetchLedger,
  } = useQuery<{
    ledger: Array<{
      id: string;
      movementType: string;
      quantity: number;
      unitCost: number;
      totalCost: number;
      runningBalance: number;
      referenceDocumentType: string | null;
      referenceDocumentId: string | null;
      notes: string | null;
      warehouseName: string;
      postedAt: string;
    }>;
  }>({
    queryKey: ["inventory-item-ledger", selectedLedgerItem?.id, warehouseFilter],
    enabled: selectedLedgerItem !== null,
    queryFn: async () => {
      const qs =
        warehouseFilter !== "ALL"
          ? `?warehouseId=${encodeURIComponent(warehouseFilter)}`
          : "";
      const res = await apiClient.get(
        `/inventory/items/${selectedLedgerItem!.id}/ledger${qs}`,
      );
      return res.data;
    },
  });

  const { page, pageSize, offset, setPage, setPageSize, resetPage } =
    usePagination({ defaultPageSize: 20 });

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{
    balances: InventoryBalance[];
    summary?: {
      totalItems: number;
      rawMaterialCount: number;
      packagingCount: number;
      finishedGoodsCount: number;
      totalInventoryValue: number;
    };
    pagination: PaginationMeta;
  }>({
    queryKey: [
      "inventory-balances",
      warehouseFilter,
      categoryFilter,
      stockFilter,
      searchQuery.trim(),
      page,
      pageSize,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset),
      });
      if (warehouseFilter !== "ALL") {
        params.set("warehouseId", warehouseFilter);
      }
      if (categoryFilter !== "ALL") {
        params.set("category", categoryFilter);
      }
      if (stockFilter !== "ALL") {
        params.set("stock", stockFilter);
      }
      if (searchQuery.trim()) {
        params.set("q", searchQuery.trim());
      }
      const res = await apiClient.get(`/inventory/balances?${params.toString()}`);
      return assertCollectionResponse(
        res.data,
        "balances",
        "/inventory/balances",
      );
    },
    placeholderData: keepPreviousData,
  });

  const balances = data?.balances ?? [];
  const filteredBalances = balances;

  // Computed summary metrics (prefer server-side totals across all pages)
  const totalItems = data?.summary?.totalItems ?? balances.length;
  const rawMaterialCount =
    data?.summary?.rawMaterialCount ??
    balances.filter((b) => b.category === "RAW_MATERIAL").length;
  const packagingCount =
    data?.summary?.packagingCount ??
    balances.filter((b) => b.category === "PACKAGING").length;
  const finishedGoodsCount =
    data?.summary?.finishedGoodsCount ??
    balances.filter((b) => b.category === "FINISHED_GOODS").length;

  const totalInventoryValue =
    data?.summary?.totalInventoryValue ??
    balances.reduce((sum, b) => sum + b.onHand * b.weightedAverageCost, 0);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Header and Controls */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Inventory & Stock Ledger
          </h1>
          <p className="max-w-[60ch] text-sm text-muted-foreground">
            Real time stock balances, weighted average costing, and ledger
            reconciliation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCwIcon
              className={`size-4 ${isFetching ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            <span>{t("Refresh Balances")}</span>
          </Button>
          {canManageInventory && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const list = uomsData?.uoms ?? [];
                  setConvFromId(list[0]?.id || "");
                  setConvToId(list[1]?.id || list[0]?.id || "");
                  setConvFactor(1);
                  setShowUomsModal(true);
                }}
                className="gap-1.5"
              >
                <ScaleIcon className="size-4" aria-hidden="true" />
                UOMs & Conversions
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAdjItemId(balances[0]?.id || "");
                  setAdjWarehouseId(
                    warehouseFilter !== "ALL"
                      ? warehouseFilter
                      : warehouses[0]?.id || "",
                  );
                  setAdjQty(0);
                  setAdjReason("");
                  setShowAdjustModal(true);
                }}
                disabled={balances.length === 0}
                className="gap-1.5"
              >
                <SlidersHorizontalIcon className="size-4" aria-hidden="true" />
                Stock Adjustment
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTrfFromWhId(
                    warehouseFilter !== "ALL"
                      ? warehouseFilter
                      : warehouses[0]?.id || "",
                  );
                  setTrfToWhId(warehouses[1]?.id || warehouses[0]?.id || "");
                  setTrfItemId(balances[0]?.id || "");
                  setTrfQty(1);
                  setTrfNotes("");
                  setShowTransferModal(true);
                }}
                disabled={balances.length === 0 || warehouses.length < 2}
                className="gap-1.5"
              >
                <ArrowLeftRightIcon className="size-4" aria-hidden="true" />
                Transfer Stock
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setItemSku("");
                  setItemName("");
                  setItemCategory("RAW_MATERIAL");
                  setItemUomId(uomsData?.uoms?.[0]?.id || "");
                  setItemOpeningStock(0);
                  setItemOpeningCost(0);
                  setShowAddItemModal(true);
                }}
                className="gap-1.5"
              >
                <PlusCircleIcon className="size-4" />
                Add Item
              </Button>
            </>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <div className="flex flex-col justify-between gap-2 rounded-xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("Total Items")}
          </span>
          <span className="text-2xl font-bold text-foreground">
            {isLoading ? "—" : totalItems}
          </span>
        </div>

        <div className="flex flex-col justify-between gap-2 rounded-xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("Raw Materials")}
          </span>
          <span className="text-2xl font-bold text-foreground">
            {isLoading ? "—" : rawMaterialCount}
          </span>
        </div>

        <div className="flex flex-col justify-between gap-2 rounded-xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("Packaging")}
          </span>
          <span className="text-2xl font-bold text-foreground">
            {isLoading ? "—" : packagingCount}
          </span>
        </div>

        <div className="flex flex-col justify-between gap-2 rounded-xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("Finished Goods")}
          </span>
          <span className="text-2xl font-bold text-foreground">
            {isLoading ? "—" : finishedGoodsCount}
          </span>
        </div>

        <div className="flex flex-col justify-between gap-2 rounded-xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("Valued Stock Total")}
          </span>
          <span className="text-2xl font-bold text-foreground">
            {isLoading
              ? "—"
              : formatINR(totalInventoryValue)}
          </span>
        </div>
      </div>

      {/* Main Stock Table */}
      <div className="flex flex-col rounded-xl border border-border bg-card shadow-xs">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <PackageIcon
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <h2 className="text-sm font-semibold text-foreground">
              {t("Current Stock on Hand")}
            </h2>
            <span className="text-xs text-muted-foreground font-mono tabular-nums">
              ({filteredBalances.length} of {balances.length})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder={t("Search items by SKU or name...")}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                resetPage();
              }}
              className="h-8 w-52 text-xs"
              aria-label="Search stock"
            />
            <Select
              value={warehouseFilter}
              onValueChange={(val) => {
                setWarehouseFilter(val);
                resetPage();
              }}
            >
              <SelectTrigger
                className="h-9 w-auto min-w-44 px-3 py-1 text-xs font-medium"
                aria-label="Filter stock by warehouse"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Warehouses (Org Total)</SelectItem>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.code} · {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={categoryFilter}
              onValueChange={(val) => {
                setCategoryFilter(val);
                resetPage();
              }}
            >
              <SelectTrigger
                className="h-9 w-auto min-w-36 px-3 py-1 text-xs font-medium"
                aria-label="Filter items by category"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All categories</SelectItem>
                <SelectItem value="RAW_MATERIAL">Raw Material</SelectItem>
                <SelectItem value="FINISHED_GOODS">Finished Goods</SelectItem>
                <SelectItem value="PACKAGING">Packaging</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={stockFilter}
              onValueChange={(val) => {
                setStockFilter(val);
                resetPage();
              }}
            >
              <SelectTrigger
                className="h-9 w-auto min-w-36 px-3 py-1 text-xs font-medium"
                aria-label="Filter items by stock status"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All stock</SelectItem>
                <SelectItem value="IN_STOCK">In stock</SelectItem>
                <SelectItem value="LOW_STOCK">Low stock (&le; 50)</SelectItem>
                <SelectItem value="OUT_OF_STOCK">Out of stock</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline" className="gap-1.5 text-xs text-emerald-600">
              <CheckCircleIcon className="size-3.5" aria-hidden="true" />
              <span>Movements Reconciled</span>
            </Badge>
          </div>
        </div>

        {isLoading ? (
          <div className="p-4">
            <SkeletonTable rows={6} columns={7} />
          </div>
        ) : isError ? (
          <div className="p-4">
            <ErrorState
              title={t("Failed to load inventory balances", "Failed to load inventory balances")}
              description={
                error instanceof Error ? error.message : "Ensure the server is running and database seed is completed."
              }
              error={error}
              onRetry={() => refetch()}
            />
          </div>
        ) : balances.length === 0 ? (
          <EmptyState
            icon={PackageIcon}
            title="No inventory items registered"
            description="Add an inventory item to start tracking stock balances and weighted average cost."
            action={
              canManageInventory ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setItemSku("");
                    setItemName("");
                    setItemCategory("RAW_MATERIAL");
                    setItemUomId(uomsData?.uoms?.[0]?.id || "");
                    setItemOpeningStock(0);
                    setItemOpeningCost(0);
                    setShowAddItemModal(true);
                  }}
                  className="gap-1.5"
                >
                  <PlusCircleIcon className="size-4" aria-hidden="true" />
                  Add Item
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* Mobile Card Layout (<md viewports per F-047) */}
            <div
              className="divide-y divide-border md:hidden"
              data-slot="mobile-cards"
            >
              {filteredBalances.length === 0 && balances.length > 0 && (
                <EmptyState
                  title={t("No items match the selected filters.")}
                  description="Clear the search or category filter to view all stock items."
                  action={
                    <Button
                      variant="tertiary"
                      size="sm"
                      onClick={() => {
                        setSearchQuery("");
                        setCategoryFilter("ALL");
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              )}
              {filteredBalances.map((item) => {
                const totalValue = item.onHand * item.weightedAverageCost;
                const categoryConfig = CATEGORY_LABELS[item.category] || {
                  label: item.category,
                  variant: "secondary",
                };

                return (
                  <div key={item.id} className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-foreground">
                          {item.sku}
                        </span>
                        <Badge
                          variant={categoryConfig.variant}
                          className="text-2xs"
                        >
                          {categoryConfig.label}
                        </Badge>
                      </div>
                      <div>
                        {item.reconciled ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"
                            title="Ledger sum equals on-hand balance"
                          >
                            <CheckCircleIcon
                              className="size-3.5"
                              aria-hidden="true"
                            />
                            Balanced
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-medium text-amber-600"
                            title="Ledger variance detected"
                          >
                            <AlertTriangleIcon
                              className="size-3.5"
                              aria-hidden="true"
                            />
                            Variance
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="font-medium text-sm text-foreground">
                      {item.name}
                    </p>

                    <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-2.5 text-xs">
                      <div>
                        <span className="text-muted-foreground text-2xs uppercase">
                          On Hand
                        </span>
                        <p className="font-semibold text-foreground">
                          {formatQuantity(item.onHand)}{" "}
                          <span className="text-2xs text-muted-foreground font-normal">
                            {item.baseUom.symbol}
                          </span>
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-2xs uppercase">
                          Reserved
                        </span>
                        <p className="font-medium text-amber-600 dark:text-amber-400">
                          {formatQuantity(item.reserved)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-muted-foreground text-2xs uppercase">
                          Available (ATP)
                        </span>
                        <p className="font-bold text-emerald-600 dark:text-emerald-400">
                          {formatQuantity(item.available)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 gap-2">
                      <span className="text-muted-foreground">
                        Value: <strong className="text-foreground">{formatINR(totalValue)}</strong>
                      </span>
                      <div className="flex items-center gap-1.5">
                        {canManageInventory && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingItem(item);
                              setEditItemName(item.name);
                            }}
                            className="min-h-[44px] px-3 text-xs gap-1.5"
                          >
                            <PencilIcon className="size-3.5" aria-hidden="true" />
                            Edit
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedLedgerItem(item)}
                          className="min-h-[44px] px-3 text-xs gap-1.5"
                        >
                          <BookOpenIcon className="size-3.5" aria-hidden="true" />
                          View Ledger
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (md+ viewports) */}
            <div className="hidden md:block p-4">
              {filteredBalances.length === 0 && balances.length > 0 ? (
                <EmptyState
                  title={t("No items match the selected filters.")}
                  description="Clear the search or category filter to view all stock items."
                  className="min-h-32 py-6"
                  action={
                    <Button
                      variant="tertiary"
                      size="sm"
                      onClick={() => {
                        setSearchQuery("");
                        setCategoryFilter("ALL");
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <DataTable
                  tableId="stock-balances"
                  data={filteredBalances}
                  getRowId={(r) => r.id}
                  ariaLabel="Stock balances"
                  csvFilename="stock-balances"
                  columns={
                    [
                      {
                        accessorKey: "sku",
                        enableHiding: false,
                        header: ({ column }) => (
                          <DataTableColumnHeader column={column} title={t("SKU")} />
                        ),
                        cell: ({ row }) => (
                          <Link
                            to={`/stock/${row.original.id}/ledger`}
                            className="font-mono text-xs font-medium text-primary hover:underline whitespace-nowrap"
                          >
                            {row.original.sku}
                          </Link>
                        ),
                        meta: { label: "SKU" } satisfies DataTableColumnMeta<InventoryBalance>,
                      },
                      {
                        accessorKey: "name",
                        header: ({ column }) => (
                          <DataTableColumnHeader column={column} title={t("Item Name")} />
                        ),
                        cell: ({ row }) => (
                          <Link
                            to={`/stock/${row.original.id}/ledger`}
                            className="font-medium text-foreground hover:underline min-w-[160px] block"
                          >
                            {row.original.name}
                          </Link>
                        ),
                        meta: { label: "Item Name" } satisfies DataTableColumnMeta<InventoryBalance>,
                      },
                      {
                        accessorKey: "category",
                        header: ({ column }) => (
                          <DataTableColumnHeader column={column} title={t("Category")} />
                        ),
                        cell: ({ row }) => {
                          const categoryConfig = CATEGORY_LABELS[
                            row.original.category as keyof typeof CATEGORY_LABELS
                          ] || {
                            label: row.original.category,
                            variant: "secondary" as const,
                          };
                          return (
                            <Badge variant={categoryConfig.variant} className="text-xs whitespace-nowrap">
                              {categoryConfig.label}
                            </Badge>
                          );
                        },
                        meta: {
                          label: "Category",
                          exportValue: (r) =>
                            CATEGORY_LABELS[r.category as keyof typeof CATEGORY_LABELS]?.label ||
                            r.category,
                        } satisfies DataTableColumnMeta<InventoryBalance>,
                      },
                      {
                        id: "onHand",
                        accessorFn: (row) => Number(row.onHand) || 0,
                        header: ({ column }) => (
                          <DataTableColumnHeader column={column} title={t("On Hand")} align="right" />
                        ),
                        cell: ({ row }) => (
                          <span className="font-medium tabular-nums whitespace-nowrap">
                            {formatQuantity(row.original.onHand)}{" "}
                            <span className="text-xs text-muted-foreground">
                              {row.original.baseUom.symbol}
                            </span>
                          </span>
                        ),
                        meta: {
                          label: "On Hand",
                          align: "right",
                          exportValue: (r) => Number(r.onHand),
                        } satisfies DataTableColumnMeta<InventoryBalance>,
                      },
                      {
                        id: "reserved",
                        accessorFn: (row) => Number(row.reserved) || 0,
                        header: ({ column }) => (
                          <DataTableColumnHeader column={column} title={t("Reserved")} align="right" />
                        ),
                        cell: ({ row }) => (
                          <span className="font-mono text-xs text-amber-700 dark:text-amber-400 tabular-nums whitespace-nowrap">
                            {formatQuantity(row.original.reserved)}
                          </span>
                        ),
                        meta: {
                          label: "Reserved",
                          align: "right",
                          exportValue: (r) => Number(r.reserved),
                        } satisfies DataTableColumnMeta<InventoryBalance>,
                      },
                      {
                        id: "available",
                        accessorFn: (row) => Number(row.available) || 0,
                        header: ({ column }) => (
                          <DataTableColumnHeader column={column} title={t("Available (ATP)")} align="right" />
                        ),
                        cell: ({ row }) => (
                          <span className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums whitespace-nowrap">
                            {formatQuantity(row.original.available)}
                          </span>
                        ),
                        meta: {
                          label: "Available (ATP)",
                          align: "right",
                          exportValue: (r) => Number(r.available),
                        } satisfies DataTableColumnMeta<InventoryBalance>,
                      },
                      {
                        id: "weightedAverageCost",
                        accessorFn: (row) => Number(row.weightedAverageCost) || 0,
                        header: ({ column }) => (
                          <DataTableColumnHeader column={column} title={t("Avg Unit Cost")} align="right" />
                        ),
                        cell: ({ row }) => (
                          <span className="text-muted-foreground tabular-nums whitespace-nowrap">
                            {formatINR(row.original.weightedAverageCost, {
                              maximumFractionDigits:
                                row.original.weightedAverageCost % 1 === 0 ? 2 : 3,
                            })}
                          </span>
                        ),
                        meta: {
                          label: "Avg Unit Cost",
                          align: "right",
                          exportValue: (r) => Number(r.weightedAverageCost),
                        } satisfies DataTableColumnMeta<InventoryBalance>,
                      },
                      {
                        id: "totalValue",
                        accessorFn: (row) => Number(row.onHand) * Number(row.weightedAverageCost),
                        header: ({ column }) => (
                          <DataTableColumnHeader column={column} title={t("Total Value")} align="right" />
                        ),
                        cell: ({ row }) => (
                          <span className="font-medium text-foreground tabular-nums whitespace-nowrap">
                            {formatINR(row.original.onHand * row.original.weightedAverageCost)}
                          </span>
                        ),
                        meta: {
                          label: "Total Value",
                          align: "right",
                          exportValue: (r) => r.onHand * r.weightedAverageCost,
                        } satisfies DataTableColumnMeta<InventoryBalance>,
                      },
                      {
                        id: "reconciled",
                        accessorFn: (row) => (row.reconciled ? "Balanced" : "Variance"),
                        header: ({ column }) => (
                          <DataTableColumnHeader column={column} title={t("Ledger Status")} align="center" />
                        ),
                        cell: ({ row }) =>
                          row.original.reconciled ? (
                            <span
                              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap"
                              title="Ledger sum equals on-hand balance"
                            >
                              <CheckCircleIcon className="size-3.5" aria-hidden="true" />
                              Balanced
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 whitespace-nowrap"
                              title="Ledger variance detected"
                            >
                              <AlertTriangleIcon className="size-3.5" aria-hidden="true" />
                              Variance
                            </span>
                          ),
                        meta: {
                          label: "Ledger Status",
                          align: "center",
                        } satisfies DataTableColumnMeta<InventoryBalance>,
                      },
                      {
                        id: "actions",
                        enableSorting: false,
                        enableHiding: false,
                        header: () => <span>{t("Actions")}</span>,
                        cell: ({ row }) => {
                          const item = row.original;
                          return (
                            <div className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap">
                              {canManageInventory && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  aria-label={`Edit ${item.name}`}
                                  onClick={() => {
                                    setEditingItem(item);
                                    setEditItemName(item.name);
                                  }}
                                  className="h-7 px-2.5 text-xs gap-1"
                                >
                                  <PencilIcon className="size-3" aria-hidden="true" />
                                  Edit
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedLedgerItem(item)}
                                className="h-7 px-2.5 text-xs gap-1"
                              >
                                <BookOpenIcon className="size-3" aria-hidden="true" />
                                Ledger
                              </Button>
                            </div>
                          );
                        },
                        meta: {
                          label: "Actions",
                          align: "right",
                        } satisfies DataTableColumnMeta<InventoryBalance>,
                      },
                    ] satisfies ColumnDef<InventoryBalance, unknown>[]
                  }
                />
              )}
            </div>

            <DataPagination
              pagination={data?.pagination}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              isFetching={isFetching}
              itemLabel="items"
              className="m-4"
            />
          </>
        )}
      </div>

      {/* Item Stock Ledger Drill-Down Modal (IMP-004) */}
      <Dialog
        open={selectedLedgerItem !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedLedgerItem(null);
        }}
      >
        {selectedLedgerItem && (
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                Stock Ledger: {selectedLedgerItem.name} ({selectedLedgerItem.sku})
              </DialogTitle>
              <DialogDescription>
                On Hand: {formatQuantity(selectedLedgerItem.onHand)} {selectedLedgerItem.baseUom.symbol} | Reserved:{" "}
                {formatQuantity(selectedLedgerItem.reserved)} | Available (ATP):{" "}
                {formatQuantity(selectedLedgerItem.available)}
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-96 overflow-y-auto">
              {isLedgerLoading ? (
                <SkeletonTable rows={4} columns={6} />
              ) : isLedgerError ? (
                <ErrorState
                  title="Failed to load item ledger"
                  description="Could not fetch stock movements."
                  onRetry={() => refetchLedger()}
                />
              ) : !ledgerData?.ledger || ledgerData.ledger.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No stock movements recorded for this item yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Movement</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">Unit Cost</TableHead>
                      <TableHead>Source / Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledgerData.ledger.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(m.postedAt).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-2xs">
                            {m.movementType}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono text-xs font-semibold ${
                            m.quantity >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {m.quantity >= 0 ? `+${m.quantity}` : m.quantity}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold">
                          {m.runningBalance}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {formatINR(m.unitCost)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                          {m.referenceDocumentType
                            ? `${m.referenceDocumentType} (${m.referenceDocumentId?.slice(-6) ?? ""})`
                            : ""}
                          {m.notes ? ` ${m.notes}` : ""}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <DialogFooter className="border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedLedgerItem(null)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Add Inventory Item Modal (IMP-012) */}
      <Dialog open={showAddItemModal} onOpenChange={setShowAddItemModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Inventory Item</DialogTitle>
            <DialogDescription>
              Create a raw material, packaging item, or finished good.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="item-sku" className="text-xs">SKU</Label>
                <Input id="item-sku" value={itemSku} onChange={(e) => setItemSku(e.target.value)} placeholder="RM-SUGAR" />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Category</Label>
                <Select value={itemCategory} onValueChange={(v) => setItemCategory(v as "RAW_MATERIAL" | "PACKAGING" | "FINISHED_GOODS")}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RAW_MATERIAL">Raw Material</SelectItem>
                    <SelectItem value="PACKAGING">Packaging</SelectItem>
                    <SelectItem value="FINISHED_GOODS">Finished Goods</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="item-name" className="text-xs">Item Name</Label>
              <Input id="item-name" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Refined Sugar" />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Base UOM</Label>
              <Select value={itemUomId} onValueChange={setItemUomId}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(uomsData?.uoms ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name} ({u.symbol})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="item-open-qty" className="text-xs">Opening Stock</Label>
                <Input id="item-open-qty" type="number" min={0} value={itemOpeningStock} onChange={(e) => setItemOpeningStock(Number(e.target.value))} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="item-open-cost" className="text-xs">Opening Unit Cost (₹)</Label>
                <Input id="item-open-cost" type="number" min={0} step="0.01" value={itemOpeningCost} onChange={(e) => setItemOpeningCost(Number(e.target.value))} />
              </div>
            </div>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" size="sm" onClick={() => setShowAddItemModal(false)}>Cancel</Button>
            <Button size="sm" disabled={addItemMutation.isPending || !itemSku.trim() || !itemName.trim()} onClick={() => addItemMutation.mutate()}>
              Create Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Adjustment Modal (IMP-012) */}
      <Dialog open={showAdjustModal} onOpenChange={setShowAdjustModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Post Stock Adjustment</DialogTitle>
            <DialogDescription>
              Creates an audited ADJUSTMENT movement in the stock ledger.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">Inventory Item</Label>
              <Select value={adjItemId} onValueChange={setAdjItemId}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent searchable searchPlaceholder="Search inventory items...">
                  {balances.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} ({b.sku}) · On Hand: {b.onHand}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="adj-qty" className="text-xs">Adjustment Quantity (+ or -)</Label>
              <Input id="adj-qty" type="number" step="1" value={adjQty} onChange={(e) => setAdjQty(Number(e.target.value))} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="adj-reason" className="text-xs">Reason</Label>
              <Input id="adj-reason" value={adjReason} onChange={(e) => setAdjReason(e.target.value)} placeholder="Physical count reconciliation" />
            </div>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" size="sm" onClick={() => setShowAdjustModal(false)}>Cancel</Button>
            <Button size="sm" disabled={adjustStockMutation.isPending || adjQty === 0 || !adjReason.trim()} onClick={() => adjustStockMutation.mutate()}>
              Post Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Inventory Item Modal */}
      <Dialog
        open={editingItem !== null}
        onOpenChange={(open) => {
          if (!open) setEditingItem(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Inventory Item</DialogTitle>
            <DialogDescription>
              Update item display name for {editingItem?.sku}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="edit-item-name" className="text-xs">Item Name</Label>
              <Input
                id="edit-item-name"
                value={editItemName}
                onChange={(e) => setEditItemName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" size="sm" onClick={() => setEditingItem(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={editItemMutation.isPending || !editItemName.trim()}
              onClick={() => editItemMutation.mutate()}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* UOMs & Unit Conversions Modal */}
      <Dialog open={showUomsModal} onOpenChange={setShowUomsModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Units of Measure & Conversions</DialogTitle>
            <DialogDescription>
              Configure base units and dimension-safe conversion factors (e.g. 1 kg = 1000 g, 1 carton = 20 packets).
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-lg border p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Add Unit of Measure
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="uom-code" className="text-xs">Code</Label>
                  <Input
                    id="uom-code"
                    placeholder="G"
                    value={uomCode}
                    onChange={(e) => setUomCode(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="uom-symbol" className="text-xs">Symbol</Label>
                  <Input
                    id="uom-symbol"
                    placeholder="g"
                    value={uomSymbol}
                    onChange={(e) => setUomSymbol(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="uom-name" className="text-xs">Unit Name</Label>
                <Input
                  id="uom-name"
                  placeholder="Gram"
                  value={uomName}
                  onChange={(e) => setUomName(e.target.value)}
                />
              </div>
              <Button
                size="sm"
                disabled={createUomMutation.isPending || !uomCode.trim() || !uomName.trim() || !uomSymbol.trim()}
                onClick={() => createUomMutation.mutate()}
              >
                Add UOM
              </Button>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(uomsData?.uoms ?? []).map((u) => (
                  <Badge key={u.id} variant="outline" className="font-mono text-2xs">
                    {u.code} ({u.symbol})
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Add Conversion Rule
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="conv-from" className="text-xs">From UOM</Label>
                  <Select value={convFromId} onValueChange={setConvFromId}>
                    <SelectTrigger id="conv-from" className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(uomsData?.uoms ?? []).map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.code} ({u.symbol})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="conv-to" className="text-xs">To UOM</Label>
                  <Select value={convToId} onValueChange={setConvToId}>
                    <SelectTrigger id="conv-to" className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(uomsData?.uoms ?? []).map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.code} ({u.symbol})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="conv-factor" className="text-xs">Factor (1 From = N To)</Label>
                <Input
                  id="conv-factor"
                  type="number"
                  min={0.000001}
                  step="any"
                  value={convFactor}
                  onChange={(e) => setConvFactor(Number(e.target.value))}
                />
              </div>
              <Button
                size="sm"
                disabled={createConversionMutation.isPending || !convFromId || !convToId || convFactor <= 0}
                onClick={() => createConversionMutation.mutate()}
              >
                Add Conversion
              </Button>
              <div className="max-h-28 overflow-y-auto space-y-1 pt-1 text-xs">
                {(uomsData?.conversions ?? []).length === 0 ? (
                  <p className="text-muted-foreground">No conversions configured.</p>
                ) : (
                  (uomsData?.conversions ?? []).map((c) => (
                    <div key={c.id} className="flex items-center justify-between rounded bg-muted/40 px-2 py-1 font-mono text-2xs">
                      <span>1 {c.fromUom.code} = {Number(c.factor)} {c.toUom.code}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" size="sm" onClick={() => setShowUomsModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inter-Warehouse Stock Transfer Modal */}
      <Dialog open={showTransferModal} onOpenChange={setShowTransferModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Inter-Warehouse Stock Transfer</DialogTitle>
            <DialogDescription>
              Move available inventory between active warehouses with traceable ledger movements.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="trf-from" className="text-xs font-semibold">From Warehouse</Label>
                <Select value={trfFromWhId} onValueChange={setTrfFromWhId}>
                  <SelectTrigger id="trf-from">
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.code} · {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="trf-to" className="text-xs font-semibold">To Warehouse</Label>
                <Select value={trfToWhId} onValueChange={setTrfToWhId}>
                  <SelectTrigger id="trf-to">
                    <SelectValue placeholder="Destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.code} · {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="trf-item" className="text-xs font-semibold">Inventory Item</Label>
              <Select value={trfItemId} onValueChange={setTrfItemId}>
                <SelectTrigger id="trf-item">
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {balances.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.sku} · {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="trf-qty" className="text-xs font-semibold">Quantity</Label>
              <Input
                id="trf-qty"
                type="number"
                min={0.000001}
                step="any"
                value={trfQty}
                onChange={(e) => setTrfQty(Number(e.target.value))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="trf-notes" className="text-xs font-semibold">Notes (Optional)</Label>
              <Input
                id="trf-notes"
                value={trfNotes}
                onChange={(e) => setTrfNotes(e.target.value)}
                placeholder="Reason for transfer"
              />
            </div>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" size="sm" onClick={() => setShowTransferModal(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={
                transferStockMutation.isPending ||
                !trfFromWhId ||
                !trfToWhId ||
                trfFromWhId === trfToWhId ||
                !trfItemId ||
                trfQty <= 0
              }
              onClick={() => transferStockMutation.mutate()}
            >
              {transferStockMutation.isPending ? "Posting..." : "Post Transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
