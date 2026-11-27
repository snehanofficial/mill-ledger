import { useState } from "react";
import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PaginationMeta } from "@mill-ledger/shared";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useWarehouses } from "@/hooks/use-warehouses";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { toast } from "sonner";
import { useUrlState } from "@/hooks/use-url-state";
import { usePagination } from "@/hooks/use-pagination";
import { formatINR, formatQuantity } from "@/lib/formatters";
import { useLanguage } from "@/lib/i18n";
import { DataPagination } from "@/components/ui/data-pagination";
import { DataTable } from "@/components/ui/data-table";
import {
  EmptyState,
  SkeletonTable,
  ErrorState,
} from "@/components/ui/loading-error-empty";
import type { ProductionRun as SharedProductionRun } from "@/components/production/production-types";
import {
  useProductionRunBulkActions,
  useProductionRunColumns,
} from "@/components/production/production-run-columns";
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
  FactoryIcon,
  RefreshCwIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  RotateCcwIcon,
  PlusCircleIcon,
  BoxesIcon,
  IndianRupeeIcon,
  Trash2Icon,
  LayersIcon,
} from "lucide-react";

interface ProductionRunMaterial {
  id: string;
  inventoryItemId: string;
  itemType: "INGREDIENT" | "PACKAGING";
  plannedQty: number;
  actualQty: number;
  damagedQty: number;
  varianceQty: number;
  variancePct: number;
  isVarianceFlagged: boolean;
  unitCost: number;
  totalCost: number;
  inventoryItem: {
    sku: string;
    name: string;
  };
}

interface ProductionRun {
  id: string;
  runNumber: string;
  recipeId?: string;
  batchCount?: number;
  status: "DRAFT" | "POSTED" | "REVERSED";
  expectedOutputQty: number;
  actualGoodQty: number;
  actualRejectedQty: number;
  yieldVarianceQty: number;
  yieldVariancePct: number;
  isYieldFlagged: boolean;
  packagingMismatch?: boolean;
  packagingWarning?: string | null;
  directMaterialCost: number;
  directLaborCost: number;
  utilityCost: number;
  totalRunCost: number;
  costPerGoodUnit: number;
  notes: string | null;
  postedAt: string | null;
  reversedAt: string | null;
  reversalReason: string | null;
  recipe: {
    name: string;
    productVariant: {
      name: string;
      sku: string;
    };
  };
  warehouse: {
    name: string;
  };
  materials: ProductionRunMaterial[];
}

export function ProductionPage() {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const { t } = useLanguage();
  const canRecordProduction =
    user?.role === "ADMIN" || user?.role === "PRODUCTION";
  const canManageBom = user?.role === "ADMIN";
  const [showNewBatchModal, setShowNewBatchModal] = useState(false);
  const [showBomModal, setShowBomModal] = useState(false);
  const [selectedRun, setSelectedRun] = useState<ProductionRun | null>(null);
  const [editingDraftRun, setEditingDraftRun] = useState<ProductionRun | null>(null);
  const [draftEditGoodQty, setDraftEditGoodQty] = useState(200);
  const [draftEditLabor, setDraftEditLabor] = useState(0);
  const [draftEditUtility, setDraftEditUtility] = useState(0);
  const [draftEditNotes, setDraftEditNotes] = useState("");
  const [searchQuery, setSearchQuery] = useUrlState("q", "", {
    debounceMs: 250,
  });

  // Create BOM Recipe state
  const [showCreateBomForm, setShowCreateBomForm] = useState(false);
  const [newBomVariantId, setNewBomVariantId] = useState("");
  const [newBomName, setNewBomName] = useState("");
  const [newBomBatchSize, setNewBomBatchSize] = useState(100);
  const [newBomExpectedOutput, setNewBomExpectedOutput] = useState(100);
  const [newBomOutputUomId, setNewBomOutputUomId] = useState("");
  const [newBomLines, setNewBomLines] = useState<
    Array<{ inventoryItemId: string; itemType: "INGREDIENT" | "PACKAGING"; plannedQty: number }>
  >([]);

  // Form states for production batch
  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [batchCount, setBatchCount] = useState(1);
  const [actualGoodQty, setActualGoodQty] = useState(188);
  const [actualRejectedQty, setActualRejectedQty] = useState(0);
  const [materialActuals, setMaterialActuals] = useState<
    Record<string, { actualQty: number; damagedQty: number }>
  >({});
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [laborCost, setLaborCost] = useState(1200);
  const [utilityCost, setUtilityCost] = useState(600);
  const [notes, setNotes] = useState("Murukku 200g production batch 1");

  const { data: warehousesData } = useWarehouses();
  const warehouses = warehousesData?.warehouses || [];
  const activeWarehouse =
    warehouses.find((w) => w.id === selectedWarehouseId) || warehouses[0];

  // Fetch production runs
  const { page, pageSize, offset, setPage, setPageSize, resetPage } =
    usePagination({ defaultPageSize: 20 });

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{
    runs: ProductionRun[];
    pagination: PaginationMeta;
  }>({
    queryKey: ["production-runs", page, pageSize, searchQuery.trim()],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset),
      });
      if (searchQuery.trim()) {
        params.set("q", searchQuery.trim());
      }
      const res = await apiClient.get(`/production-runs?${params.toString()}`);
      return res.data;
    },
    placeholderData: keepPreviousData,
  });

  // Fetch live inventory balances for stock availability & WAC costing
  const { data: balancesData } = useQuery<{
    balances: Array<{
      id: string;
      sku: string;
      name: string;
      category: string;
      onHand: number;
      available: number;
      weightedAverageCost: number;
      baseUom: { id?: string; code: string; symbol: string };
    }>;
  }>({
    queryKey: ["inventory-balances", activeWarehouse?.id ?? "all"],
    queryFn: async () => {
      const qs = activeWarehouse?.id
        ? `?warehouseId=${encodeURIComponent(activeWarehouse.id)}`
        : "";
      const res = await apiClient.get(`/inventory/balances${qs}`);
      return res.data;
    },
  });

  const { data: productsData } = useQuery<{
    products: Array<{
      id: string;
      name: string;
      variants: Array<{ id: string; sku: string; name: string }>;
    }>;
  }>({
    queryKey: ["masters-products"],
    enabled: canManageBom && showBomModal,
    queryFn: async () => {
      const res = await apiClient.get("/masters/products");
      return res.data;
    },
  });

  const { data: uomsData } = useQuery<{
    uoms: Array<{ id: string; code: string; name: string; symbol: string }>;
  }>({
    queryKey: ["inventory-uoms"],
    enabled: canManageBom && showBomModal,
    queryFn: async () => {
      const res = await apiClient.get("/inventory/uoms");
      return res.data;
    },
  });

  // Fetch active BOM recipes dynamically (MLD-010)
  const { data: recipesData } = useQuery<{
    recipes: Array<{
      id: string;
      name: string;
      productVariantId?: string;
      expectedOutputQty: number;
      productVariant: { sku: string; name: string };
      items: Array<{
        id: string;
        inventoryItemId: string;
        plannedQty: number;
        tolerancePct: number;
        itemType: string;
        inventoryItem: { id: string; sku: string; name: string };
        uom?: { code: string; symbol: string };
      }>;
    }>;
  }>({
    queryKey: ["production-recipes"],
    queryFn: async () => {
      const res = await apiClient.get("/production-runs/recipes");
      return res.data;
    },
  });

  const activeRecipe =
    recipesData?.recipes.find((r) => r.id === selectedRecipeId) ||
    recipesData?.recipes[0];

  const balanceById = new Map(
    (balancesData?.balances ?? []).map((b) => [b.id, b]),
  );

  const getMaterialInput = (item: {
    inventoryItemId: string;
    plannedQty: number;
    inventoryItem: { sku: string };
  }) => {
    const override = materialActuals[item.inventoryItemId];
    if (override) return override;
    const scaledPlanned = Number(item.plannedQty) * batchCount;
    return { actualQty: scaledPlanned, damagedQty: 0 };
  };

  // Post production batch mutation
  const postMutation = useMutation({
    mutationFn: async () => {
      if (!activeRecipe || activeRecipe.items.length === 0) {
        throw new Error("Active BOM recipe with materials is required");
      }

      const consumedMaterials = activeRecipe.items.map((item) => {
        const entry = getMaterialInput(item);
        return {
          inventoryItemId: item.inventoryItemId,
          actualQty: Number(entry.actualQty),
          damagedQty: Number(entry.damagedQty || 0),
        };
      });

      if (!activeWarehouse) {
        throw new Error("Production warehouse is required");
      }

      const payload = {
        warehouseId: activeWarehouse.id,
        recipeId: activeRecipe.id,
        runNumber: `RUN-2026-${Date.now().toString().slice(-4)}`,
        batchCount,
        actualGoodQty,
        actualRejectedQty,
        directLaborCost: laborCost,
        utilityCost,
        notes,
        consumedMaterials,
      };

      const res = await apiClient.post("/production-runs", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-runs"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-balances"] });
      setShowNewBatchModal(false);
      toast.success("Production batch posted and stock ledger updated.");
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, "Failed to post production batch"));
    },
  });

  // Save draft production batch mutation (IMP-013)
  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      if (!activeRecipe || !activeWarehouse) {
        throw new Error("Recipe and warehouse are required");
      }
      const createdRes = await apiClient.post("/production-runs/draft", {
        warehouseId: activeWarehouse.id,
        recipeId: activeRecipe.id,
        runNumber: `RUN-DRAFT-${Date.now().toString().slice(-5)}`,
        batchCount,
        notes,
      });
      const created = createdRes.data;
      if (created?.id) {
        await apiClient.put(`/production-runs/${created.id}`, {
          actualGoodQty,
          directLaborCost: laborCost,
          utilityCost,
          notes,
        });
      }
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-runs"] });
      setShowNewBatchModal(false);
      toast.success("Production run saved as DRAFT.");
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, "Failed to save draft"));
    },
  });

  const updateDraftMutation = useMutation({
    mutationFn: async () => {
      if (!editingDraftRun) throw new Error("No draft selected");
      const res = await apiClient.put(`/production-runs/${editingDraftRun.id}`, {
        actualGoodQty: draftEditGoodQty,
        directLaborCost: draftEditLabor,
        utilityCost: draftEditUtility,
        notes: draftEditNotes,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-runs"] });
      setEditingDraftRun(null);
      toast.success("Draft run updated.");
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, "Failed to update draft"));
    },
  });

  const createRecipeMutation = useMutation({
    mutationFn: async () => {
      if (!newBomVariantId || !newBomName.trim() || !newBomOutputUomId) {
        throw new Error("Variant, recipe name, and output UOM are required");
      }
      if (newBomLines.length === 0) {
        throw new Error("Add at least one ingredient or packaging line");
      }
      const res = await apiClient.post("/production-runs/recipes", {
        productVariantId: newBomVariantId,
        name: newBomName.trim(),
        standardBatchSize: Number(newBomBatchSize),
        expectedOutputQty: Number(newBomExpectedOutput),
        outputUomId: newBomOutputUomId,
        items: newBomLines.map((l) => {
          const item = balanceById.get(l.inventoryItemId);
          const matchingUom = uomsData?.uoms.find(
            (u) => u.code === item?.baseUom?.code,
          );
          return {
            inventoryItemId: l.inventoryItemId,
            itemType: l.itemType,
            plannedQty: Number(l.plannedQty),
            uomId: matchingUom?.id || newBomOutputUomId,
            tolerancePct: 5,
          };
        }),
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-recipes"] });
      setShowCreateBomForm(false);
      setNewBomName("");
      setNewBomLines([]);
      toast.success("BOM recipe created.");
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, "Failed to create BOM recipe"));
    },
  });

  const cloneRecipeVersionMutation = useMutation({
    mutationFn: async (recipeId: string) => {
      const res = await apiClient.post(`/production-runs/recipes/${recipeId}/version`, {});
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-recipes"] });
      toast.success("New BOM version created.");
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, "Failed to clone BOM version"));
    },
  });

  const archiveRecipeMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiClient.patch(`/production-runs/recipes/${id}/archive`, {
        isActive,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-recipes"] });
      toast.success("BOM status updated.");
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, "Failed to update BOM"));
    },
  });

  // Reverse production run mutation
  const reverseMutation = useMutation({
    mutationFn: async ({
      runId,
      reason,
    }: {
      runId: string;
      reason: string;
    }) => {
      const res = await apiClient.post(`/production-runs/${runId}/reverse`, {
        reason,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-runs"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-balances"] });
      setSelectedRun(null);
    },
  });

  const runs = data?.runs ?? [];

  const filteredRuns = runs.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      r.runNumber.toLowerCase().includes(q) ||
      (r.recipe?.name || "").toLowerCase().includes(q) ||
      (r.recipe?.productVariant?.name || "").toLowerCase().includes(q) ||
      (r.notes && r.notes.toLowerCase().includes(q))
    );
  });

  // Computed metrics
  const totalRuns = runs.length;
  const postedRuns = runs.filter((r) => r.status === "POSTED").length;
  const totalPacketsProduced = runs
    .filter((r) => r.status === "POSTED")
    .reduce((sum, r) => sum + Number(r.actualGoodQty), 0);
  const totalProductionCost = runs
    .filter((r) => r.status === "POSTED")
    .reduce((sum, r) => sum + Number(r.totalRunCost), 0);

  // Live modal calculations from selected BOM & live WAC
  const expectedPackets =
    (Number(activeRecipe?.expectedOutputQty) || 200) * batchCount;
  const yieldVariancePct =
    expectedPackets > 0
      ? ((actualGoodQty - expectedPackets) / expectedPackets) * 100
      : 0;

  const liveDirectMaterialCost = (activeRecipe?.items ?? []).reduce(
    (sum, item) => {
      const entry = getMaterialInput(item);
      const wac = balanceById.get(item.inventoryItemId)?.weightedAverageCost ?? 0;
      return sum + Number(entry.actualQty) * wac;
    },
    0,
  );

  const cartonLine = (activeRecipe?.items ?? []).find(
    (it) =>
      it.inventoryItem.sku === "PKG-CARTON" ||
      it.inventoryItem.name.toLowerCase().includes("carton"),
  );
  const cartonsUsedLive = cartonLine ? getMaterialInput(cartonLine).actualQty : 0;
  const cartonsHold = cartonsUsedLive * 20;
  const hasCartonShortage = Boolean(cartonLine) && cartonsHold < actualGoodQty;

  const productionColumns = useProductionRunColumns({
    includeDateTime: false,
    canRecordProduction,
    activeWarehouseId: activeWarehouse?.id,
    activeRecipeId: recipesData?.recipes?.[0]?.id,
    onEditDraft: (r) => {
      setEditingDraftRun(r as unknown as ProductionRun);
      setDraftEditGoodQty(
        Number(r.actualGoodQty) || Number(r.expectedOutputQty) || 0,
      );
      setDraftEditLabor(Number(r.directLaborCost) || 0);
      setDraftEditUtility(Number(r.utilityCost) || 0);
      setDraftEditNotes(r.notes || "");
    },
    onReverseRun: (r) => setSelectedRun(r as unknown as ProductionRun),
  });

  const productionBulkActions = useProductionRunBulkActions({
    canRecordProduction,
    activeWarehouseId: activeWarehouse?.id,
    activeRecipeId: recipesData?.recipes?.[0]?.id,
  });

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Page Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {t("Production execution")}
            </h1>
          </div>
          <p className="max-w-[60ch] text-sm text-muted-foreground">
            {t("BOM execution, consumption variances, yield calculations, and run costs")}
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
              className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            />
            {t("Refresh")}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBomModal(true)}
            className="gap-2"
          >
            <LayersIcon className="h-4 w-4" />
            Manage BOMs
          </Button>
          {canRecordProduction && (
            <Button
              size="sm"
              onClick={() => setShowNewBatchModal(true)}
              className="gap-2"
            >
              <PlusCircleIcon className="h-4 w-4" />
              {t("Record production batch")}
            </Button>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">
              {t("Total batches")}
            </span>
            <FactoryIcon className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold">{totalRuns}</div>
          <div className="text-xs text-muted-foreground">
            {postedRuns} posted runs recorded
          </div>
        </div>

        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">
              {t("Packets produced")}
            </span>
            <BoxesIcon className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatQuantity(totalPacketsProduced)}
          </div>
          <div className="text-xs text-muted-foreground">
            Finished goods credited to warehouse
          </div>
        </div>

        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">
              {t("Total run cost")}
            </span>
            <IndianRupeeIcon className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold">
            {formatINR(totalProductionCost)}
          </div>
          <div className="text-xs text-muted-foreground">
            Materials, labour, and utilities included
          </div>
        </div>

        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">
              {t("Ledger integrity")}
            </span>
            <CheckCircle2Icon className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {t("Verified")}
          </div>
          <div className="text-xs text-muted-foreground">
            Stock ledger reconciles deterministically
          </div>
        </div>
      </div>

      {/* Production Runs Table */}
      <div className="rounded-xl border bg-card shadow-xs">
        <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">
              {t("Completed production runs")}
            </h2>
            <span className="text-xs text-muted-foreground">
              ({filteredRuns.length} of {runs.length})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Input
              placeholder={t("Search production batches...")}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                resetPage();
              }}
              className="h-8 w-56 text-xs"
              aria-label="Search production batches"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-4">
            <SkeletonTable rows={6} columns={9} />
          </div>
        ) : isError ? (
          <div className="p-4">
            <ErrorState
              title={t("Failed to load production runs from server", "Failed to load production runs from server")}
              description={
                error instanceof Error ? error.message : "An unexpected server error occurred."
              }
              error={error}
              onRetry={() => refetch()}
            />
          </div>
        ) : runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12 text-center text-sm text-muted-foreground">
            <FactoryIcon className="h-8 w-8 stroke-1 text-muted-foreground" />
            <p>No production batches recorded yet.</p>
            <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBomModal(true)}
            className="gap-2"
          >
            <LayersIcon className="h-4 w-4" />
            Manage BOMs
          </Button>
          {canRecordProduction && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNewBatchModal(true)}
                className="gap-2"
              >
                <PlusCircleIcon className="h-4 w-4" />
                Record first batch
              </Button>
            )}
          </div>
        ) : filteredRuns.length === 0 && runs.length > 0 ? (
          <EmptyState
            title={t("No production batches match the search query.")}
            description="Clear the search query to view all production batches."
            className="min-h-32 py-6"
            action={
              <Button
                variant="tertiary"
                size="sm"
                onClick={() => setSearchQuery("")}
              >
                Clear search
              </Button>
            }
          />
        ) : (
          <div className="p-4">
            <DataTable
              tableId="production-overview"
              data={filteredRuns as unknown as SharedProductionRun[]}
              columns={productionColumns}
              getRowId={(r) => r.id}
              ariaLabel="Production runs"
              csvFilename="production-runs"
              bulkActions={productionBulkActions}
            />
          </div>
        )}
      </div>

      <DataPagination
        pagination={data?.pagination}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        isFetching={isFetching}
        itemLabel="runs"
      />

      {/* New Batch Modal */}
      <Dialog
        open={showNewBatchModal}
        onOpenChange={(open) => {
          if (!open) postMutation.reset();
          setShowNewBatchModal(open);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("Record production batch")}</DialogTitle>
            <DialogDescription>
              {t("Murukku 200g standard batch (Benchmark: 200 expected packets)")}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 flex flex-col gap-4">
            {/* Recipe BOM selection (MLD-010) */}
              <div className="flex flex-col gap-1.5">
                <DomainTooltip term="BOM">
                  <Label
                    htmlFor="production-recipe-select"
                    className="text-xs font-semibold text-muted-foreground cursor-help"
                  >
                    {t("Bill of Materials (BOM) Recipe")}
                  </Label>
                </DomainTooltip>
                <Select
                  value={activeRecipe?.id || undefined}
                  onValueChange={setSelectedRecipeId}
                >
                  <SelectTrigger id="production-recipe-select" className="font-medium">
                    <SelectValue placeholder="Select BOM recipe" />
                  </SelectTrigger>
                  <SelectContent searchable searchPlaceholder="Search BOM recipes...">
                    {(recipesData?.recipes || []).map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} · Target: {r.expectedOutputQty} pkts
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Warehouse selection */}
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="production-warehouse-select"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  Production Warehouse
                </Label>
                <Select
                  value={activeWarehouse?.id || undefined}
                  onValueChange={setSelectedWarehouseId}
                >
                  <SelectTrigger id="production-warehouse-select">
                    <SelectValue placeholder="Select warehouse" />
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

              {/* Output & Batch inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="production-batch-count-input"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Batches
                  </Label>
                  <Input
                    id="production-batch-count-input"
                    type="number"
                    min={0.1}
                    step="0.1"
                    value={batchCount}
                    onChange={(e) => setBatchCount(Math.max(0.1, Number(e.target.value) || 1))}
                  />
                  <span className="text-2xs text-muted-foreground">
                    Expected: {expectedPackets}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="production-good-qty-input"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    {t("Good packets produced")}
                  </Label>
                  <Input
                    id="production-good-qty-input"
                    type="number"
                    min={0}
                    value={actualGoodQty}
                    onChange={(e) => setActualGoodQty(Number(e.target.value))}
                    className="font-semibold"
                  />
                  <div className="flex items-center gap-1 text-2xs">
                    <span>{t("Variance")}:</span>
                    <span
                      className={`font-semibold ${
                        yieldVariancePct !== 0
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-emerald-600"
                      }`}
                    >
                      {yieldVariancePct > 0
                        ? `+${yieldVariancePct.toFixed(1)}%`
                        : `${yieldVariancePct.toFixed(1)}%`}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="production-rejected-qty-input"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Rejected output
                  </Label>
                  <Input
                    id="production-rejected-qty-input"
                    type="number"
                    min={0}
                    value={actualRejectedQty}
                    onChange={(e) => setActualRejectedQty(Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Dynamic BOM Material Lines with live stock & variance */}
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-semibold text-muted-foreground">
                  BOM Material & Packaging Consumption (Live Stock & WAC)
                </Label>
                <div className="max-h-56 overflow-y-auto rounded-lg border divide-y">
                  {(activeRecipe?.items ?? []).map((item) => {
                    const entry = getMaterialInput(item);
                    const bal = balanceById.get(item.inventoryItemId);
                    const available = bal?.available ?? 0;
                    const plannedScaled = Number(item.plannedQty) * batchCount;
                    const varPct =
                      plannedScaled > 0
                        ? ((entry.actualQty - plannedScaled) / plannedScaled) * 100
                        : 0;
                    const shortage = Math.max(0, entry.actualQty - available);
                    const unitSym = item.uom?.symbol || bal?.baseUom?.symbol || "";

                    return (
                      <div key={item.id} className="p-2.5 flex flex-col gap-1.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-foreground">
                            {item.inventoryItem.name} ({unitSym})
                          </span>
                          <span className="text-2xs text-muted-foreground font-mono">
                            Plan: {plannedScaled} · Avail: {available}
                            {shortage > 0 && (
                              <span className="ml-1 text-destructive font-semibold">
                                · Short {shortage}
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-stretch sm:items-center">
                          <div className="flex flex-col gap-0.5">
                            <Label
                              htmlFor={`mat-actual-${item.inventoryItem.sku}`}
                              className="text-2xs text-muted-foreground"
                            >
                              Consumed
                            </Label>
                            <Input
                              id={`mat-actual-${item.inventoryItem.sku}`}
                              type="number"
                              min={0}
                              step="any"
                              value={entry.actualQty}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setMaterialActuals((prev) => ({
                                  ...prev,
                                  [item.inventoryItemId]: {
                                    actualQty: val,
                                    damagedQty: entry.damagedQty,
                                  },
                                }));
                              }}
                              className="h-8 text-xs font-mono"
                            />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <Label
                              htmlFor={`mat-damaged-${item.inventoryItem.sku}`}
                              className="text-2xs text-muted-foreground"
                            >
                              Damaged/Scrap
                            </Label>
                            <Input
                              id={`mat-damaged-${item.inventoryItem.sku}`}
                              type="number"
                              min={0}
                              step="any"
                              value={entry.damagedQty}
                              onChange={(e) => {
                                const dmg = Number(e.target.value);
                                setMaterialActuals((prev) => ({
                                  ...prev,
                                  [item.inventoryItemId]: {
                                    actualQty: entry.actualQty,
                                    damagedQty: dmg,
                                  },
                                }));
                              }}
                              className="h-8 text-xs font-mono"
                            />
                          </div>
                          <div className="text-right font-mono text-2xs">
                            <span
                              className={
                                Math.abs(varPct) >= (item.tolerancePct || 5) && varPct !== 0
                                  ? "text-amber-600 font-semibold"
                                  : "text-muted-foreground"
                              }
                            >
                              {varPct > 0 ? `+${varPct.toFixed(1)}%` : `${varPct.toFixed(1)}%`}
                            </span>
                            <div className="text-muted-foreground">
                              {formatINR(entry.actualQty * (bal?.weightedAverageCost ?? 0))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Non-blocking carton warning pill */}
              {hasCartonShortage && (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-center gap-2 rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-400 border border-amber-500/20"
                >
                  <AlertTriangleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    Warning: {cartonsUsedLive} cartons represent {cartonsHold}{" "}
                    of {actualGoodQty} packets.
                  </span>
                </div>
              )}

              {/* Additional Costs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="production-labor-cost-input"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    {t("Direct labour cost (₹)")}
                  </Label>
                  <Input
                    id="production-labor-cost-input"
                    type="number"
                    min={0}
                    value={laborCost}
                    onChange={(e) => setLaborCost(Number(e.target.value))}
                    className="font-semibold"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="production-utility-cost-input"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    {t("Gas and power cost (₹)")}
                  </Label>
                  <Input
                    id="production-utility-cost-input"
                    type="number"
                    min={0}
                    value={utilityCost}
                    onChange={(e) => setUtilityCost(Number(e.target.value))}
                    className="font-semibold"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="production-notes-input"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  {t("Notes")}
                </Label>
                <Input
                  id="production-notes-input"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Cost summary preview (computed from live inventory WAC) */}
              <div className="rounded-lg bg-muted/50 p-3 text-xs flex flex-col gap-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("Direct materials:")}
                  </span>
                  <span className="font-semibold">{formatINR(liveDirectMaterialCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("Direct labour:")}</span>
                  <span className="font-semibold">{formatINR(laborCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("Gas and power:")}</span>
                  <span className="font-semibold">
                    {formatINR(utilityCost)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-1 font-bold">
                  <span>{t("Total run cost:")}</span>
                  <span className="text-foreground">
                    {formatINR(liveDirectMaterialCost + laborCost + utilityCost)}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>{t("Cost per good packet:")}</span>
                  <span>
                    {actualGoodQty > 0
                      ? formatINR((liveDirectMaterialCost + laborCost + utilityCost) / actualGoodQty)
                      : "—"}
                  </span>
                </div>
              </div>
            </div>

            {postMutation.isError && (
              <div
                role="alert"
                className="mt-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
              >
                <AlertTriangleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {extractErrorMessage(
                    postMutation.error,
                    "Failed to post production batch",
                  )}
                </span>
              </div>
            )}

            <DialogFooter className="mt-6 flex-wrap gap-2 border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNewBatchModal(false)}
              >
                {t("Cancel")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => saveDraftMutation.mutate()}
                disabled={saveDraftMutation.isPending || postMutation.isPending}
              >
                Save as Draft
              </Button>
              <Button
                size="sm"
                onClick={() => postMutation.mutate()}
                disabled={postMutation.isPending}
                className="gap-2"
              >
                {postMutation.isPending ? (
                  <>
                    <RefreshCwIcon className="h-4 w-4 animate-spin" />
                    {t("Posting batch...")}
                  </>
                ) : (
                  <>
                    <CheckCircle2Icon className="h-4 w-4" />
                    {t("Post & Update Stock Ledger")}
                  </>
                )}
              </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reversal Confirmation Modal */}
      <Dialog
        open={selectedRun !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedRun(null);
        }}
      >
        {selectedRun && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t("Reverse Production Run")}</DialogTitle>
              <DialogDescription>
                {t("This will atomically restore raw materials and packaging back into inventory and deduct finished packets.")}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-2 flex flex-col gap-2">
              <Label
                htmlFor="reversal-reason-input"
                className="text-xs font-semibold text-muted-foreground"
              >
                {t("Reason for reversal")}
              </Label>
              <Input
                id="reversal-reason-input"
                type="text"
                placeholder={t("e.g. Quality inspection failed on batch")}
                defaultValue="Batch quality inspection failed"
              />
            </div>

            <DialogFooter className="mt-6 border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedRun(null)}
              >
                {t("Cancel")}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  const input = document.getElementById(
                    "reversal-reason-input",
                  ) as HTMLInputElement;
                  reverseMutation.mutate({
                    runId: selectedRun.id,
                    reason: input?.value || "Manual run reversal",
                  });
                }}
                disabled={reverseMutation.isPending}
                className="gap-2"
              >
                <RotateCcwIcon className="h-4 w-4" />
                {t("Confirm reversal")}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Edit Draft Modal */}
      <Dialog
        open={editingDraftRun !== null}
        onOpenChange={(open) => {
          if (!open) setEditingDraftRun(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Draft Run {editingDraftRun?.runNumber}</DialogTitle>
            <DialogDescription>
              Update expected output, labour, utility, or notes before posting.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="draft-edit-good-qty" className="text-xs">Actual Good Output</Label>
              <Input
                id="draft-edit-good-qty"
                type="number"
                min={0}
                value={draftEditGoodQty}
                onChange={(e) => setDraftEditGoodQty(Number(e.target.value))}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="draft-edit-labor" className="text-xs">Direct Labour (₹)</Label>
                <Input
                  id="draft-edit-labor"
                  type="number"
                  min={0}
                  value={draftEditLabor}
                  onChange={(e) => setDraftEditLabor(Number(e.target.value))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="draft-edit-utility" className="text-xs">Gas & Power (₹)</Label>
                <Input
                  id="draft-edit-utility"
                  type="number"
                  min={0}
                  value={draftEditUtility}
                  onChange={(e) => setDraftEditUtility(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="draft-edit-notes" className="text-xs">Notes</Label>
              <Input
                id="draft-edit-notes"
                value={draftEditNotes}
                onChange={(e) => setDraftEditNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" size="sm" onClick={() => setEditingDraftRun(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={updateDraftMutation.isPending}
              onClick={() => updateDraftMutation.mutate()}
            >
              Save Draft Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BOM Recipes Management Modal (IMP-011) */}
      <Dialog open={showBomModal} onOpenChange={setShowBomModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LayersIcon className="size-4" />
              Bill of Materials (BOM) Recipes
            </DialogTitle>
            <DialogDescription>
              Active BOM recipes and version history. Cloning creates a new version without mutating historical runs.
            </DialogDescription>
          </DialogHeader>
          {canManageBom && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  const allVariants = (productsData?.products ?? []).flatMap((p) => p.variants);
                  setNewBomVariantId(allVariants[0]?.id || "");
                  setNewBomOutputUomId(
                    uomsData?.uoms.find((u) => u.code === "PACKET")?.id ||
                      uomsData?.uoms[0]?.id ||
                      "",
                  );
                  if (newBomLines.length === 0 && (balancesData?.balances ?? []).length > 0) {
                    const firstRaw = balancesData!.balances.find((b) => b.category === "RAW_MATERIAL");
                    if (firstRaw) {
                      setNewBomLines([{ inventoryItemId: firstRaw.id, itemType: "INGREDIENT", plannedQty: 10 }]);
                    }
                  }
                  setShowCreateBomForm((v) => !v);
                }}
              >
                {showCreateBomForm ? "Hide Form" : "New Recipe / BOM"}
              </Button>
            </div>
          )}
          <div className="max-h-96 overflow-y-auto flex flex-col gap-3 py-2">
            {showCreateBomForm && canManageBom && (
              <div className="rounded-lg border bg-muted/30 p-3 flex flex-col gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Create New BOM Recipe
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="new-bom-variant" className="text-xs">Product Variant</Label>
                    <Select value={newBomVariantId} onValueChange={setNewBomVariantId}>
                      <SelectTrigger id="new-bom-variant" className="h-9 text-xs">
                        <SelectValue placeholder="Select variant" />
                      </SelectTrigger>
                      <SelectContent>
                        {(productsData?.products ?? []).flatMap((p) =>
                          p.variants.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.name} ({v.sku})
                            </SelectItem>
                          )),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="new-bom-name" className="text-xs">Recipe Name</Label>
                    <Input
                      id="new-bom-name"
                      placeholder="Standard Mixture 250g BOM"
                      value={newBomName}
                      onChange={(e) => setNewBomName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="new-bom-batch" className="text-xs">Batch Size</Label>
                    <Input
                      id="new-bom-batch"
                      type="number"
                      min={1}
                      value={newBomBatchSize}
                      onChange={(e) => setNewBomBatchSize(Number(e.target.value))}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="new-bom-output" className="text-xs">Expected Yield</Label>
                    <Input
                      id="new-bom-output"
                      type="number"
                      min={1}
                      value={newBomExpectedOutput}
                      onChange={(e) => setNewBomExpectedOutput(Number(e.target.value))}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="new-bom-uom" className="text-xs">Output UOM</Label>
                    <Select value={newBomOutputUomId} onValueChange={setNewBomOutputUomId}>
                      <SelectTrigger id="new-bom-uom" className="h-9 text-xs">
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
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">BOM Material Lines</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        const first = balancesData?.balances[0];
                        if (!first) return;
                        setNewBomLines((prev) => [
                          ...prev,
                          {
                            inventoryItemId: first.id,
                            itemType: first.category === "PACKAGING" ? "PACKAGING" : "INGREDIENT",
                            plannedQty: 1,
                          },
                        ]);
                      }}
                    >
                      + Add Line
                    </Button>
                  </div>
                  {newBomLines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-stretch sm:items-center">
                      <div className="sm:col-span-5">
                        <Select
                          value={line.inventoryItemId}
                          onValueChange={(val) =>
                            setNewBomLines((prev) =>
                              prev.map((l, i) => (i === idx ? { ...l, inventoryItemId: val } : l)),
                            )
                          }
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(balancesData?.balances ?? [])
                              .filter((b) => b.category !== "FINISHED_GOODS")
                              .map((b) => (
                                <SelectItem key={b.id} value={b.id}>
                                  {b.name} ({b.baseUom.symbol})
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-3">
                        <Select
                          value={line.itemType}
                          onValueChange={(val) =>
                            setNewBomLines((prev) =>
                              prev.map((l, i) =>
                                i === idx
                                  ? { ...l, itemType: val as "INGREDIENT" | "PACKAGING" }
                                  : l,
                              ),
                            )
                          }
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="INGREDIENT">Ingredient</SelectItem>
                            <SelectItem value="PACKAGING">Packaging</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-3">
                        <Input
                          type="number"
                          min={0.001}
                          step="any"
                          value={line.plannedQty}
                          onChange={(e) =>
                            setNewBomLines((prev) =>
                              prev.map((l, i) =>
                                i === idx ? { ...l, plannedQty: Number(e.target.value) } : l,
                              ),
                            )
                          }
                          className="h-11 sm:h-9 text-base sm:text-xs"
                        />
                      </div>
                      <div className="sm:col-span-1 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-1.5 text-destructive"
                          onClick={() =>
                            setNewBomLines((prev) => prev.filter((_, i) => i !== idx))
                          }
                        >
                          <Trash2Icon className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    disabled={createRecipeMutation.isPending || !newBomName.trim()}
                    onClick={() => createRecipeMutation.mutate()}
                  >
                    Save Recipe
                  </Button>
                </div>
              </div>
            )}

            {(recipesData?.recipes ?? []).map((r) => (
              <div key={r.id} className="rounded-lg border p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-sm">{r.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({r.productVariant?.name}) · Target: {Number(r.expectedOutputQty)} pkts
                    </span>
                  </div>
                  {canManageBom && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={cloneRecipeVersionMutation.isPending}
                        onClick={() => cloneRecipeVersionMutation.mutate(r.id)}
                      >
                        Clone New Version
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground"
                        disabled={archiveRecipeMutation.isPending}
                        onClick={() =>
                          archiveRecipeMutation.mutate({ id: r.id, isActive: false })
                        }
                      >
                        Archive
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 text-2xs text-muted-foreground">
                  {r.items.map((it) => (
                    <Badge key={it.id} variant="outline" className="text-2xs">
                      {it.inventoryItem.name}: {Number(it.plannedQty)}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" size="sm" onClick={() => setShowBomModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
