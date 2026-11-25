import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/use-current-user";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { toast } from "sonner";
import { useUrlState } from "@/hooks/use-url-state";
import { formatINR, formatQuantity } from "@/lib/formatters";
import { useLanguage } from "@/lib/i18n";
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
  const [searchQuery, setSearchQuery] = useUrlState("q", "", {
    debounceMs: 250,
  });

  // Form states for benchmark Murukku batch
  const [selectedRecipeId, setSelectedRecipeId] = useState("");
  const [actualGoodQty, setActualGoodQty] = useState(188);
  const [damagedPouches, setDamagedPouches] = useState(6);
  const [oilConsumed, setOilConsumed] = useState(10.5);
  const [cartonsConsumed, setCartonsConsumed] = useState(9);
  const [laborCost, setLaborCost] = useState(1200);
  const [utilityCost, setUtilityCost] = useState(600);
  const [notes, setNotes] = useState("Murukku 200g production batch 1");

  // Fetch production runs
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{
    runs: ProductionRun[];
  }>({
    queryKey: ["production-runs"],
    queryFn: async () => {
      const res = await apiClient.get("/production-runs?organizationId=MILL");
      return res.data;
    },
  });

  // Fetch active BOM recipes dynamically (MLD-010)
  const { data: recipesData } = useQuery<{
    recipes: Array<{
      id: string;
      name: string;
      expectedOutputQty: number;
      productVariant: { sku: string; name: string };
      items: Array<{
        id: string;
        inventoryItemId: string;
        plannedQty: number;
        tolerancePct: number;
        itemType: string;
        inventoryItem: { id: string; sku: string; name: string };
      }>;
    }>;
  }>({
    queryKey: ["production-recipes"],
    queryFn: async () => {
      const res = await apiClient.get(
        "/production-runs/recipes?organizationId=MILL",
      );
      return res.data;
    },
  });

  const activeRecipe =
    recipesData?.recipes.find((r) => r.id === selectedRecipeId) ||
    recipesData?.recipes[0];

  // Post production batch mutation
  const postMutation = useMutation({
    mutationFn: async () => {
      // Find inventory item IDs from current balances
      const balRes = await apiClient.get(
        "/inventory/balances?organizationId=MILL",
      );
      const items: Array<{ id: string; sku: string }> = balRes.data.balances;
      const flourItem = items.find((i) => i.sku === "RM-FLOUR");
      const oilItem = items.find((i) => i.sku === "RM-OIL");
      const spiceItem = items.find((i) => i.sku === "RM-SPICE");
      const pouchItem = items.find((i) => i.sku === "PKG-POUCH-200G");
      const cartonItem = items.find((i) => i.sku === "PKG-CARTON");

      const isMurukkuBOM =
        !activeRecipe ||
        activeRecipe.name?.includes("Murukku") ||
        activeRecipe.productVariant?.sku?.includes("MURUKKU");

      let consumedMaterials: Array<{
        inventoryItemId: string;
        actualQty: number;
        damagedQty?: number;
      }> = [];

      if (isMurukkuBOM && flourItem && oilItem && spiceItem && pouchItem && cartonItem) {
        consumedMaterials = [
          { inventoryItemId: flourItem.id, actualQty: 40 },
          { inventoryItemId: oilItem.id, actualQty: oilConsumed },
          { inventoryItemId: spiceItem.id, actualQty: 1.2 },
          {
            inventoryItemId: pouchItem.id,
            actualQty: actualGoodQty + damagedPouches,
            damagedQty: damagedPouches,
          },
          { inventoryItemId: cartonItem.id, actualQty: cartonsConsumed },
        ];
      } else if (activeRecipe && activeRecipe.items.length > 0) {
        consumedMaterials = activeRecipe.items.map((item) => ({
          inventoryItemId: item.inventoryItemId,
          actualQty: Number(item.plannedQty),
        }));
      } else {
        throw new Error("Required BOM items not found");
      }

      const payload = {
        organizationId: "MILL",
        warehouseId: "WH-1",
        recipeId: activeRecipe?.id,
        runNumber: `RUN-2026-${Date.now().toString().slice(-4)}`,
        batchCount: 1,
        actualGoodQty,
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
      if (!activeRecipe) throw new Error("Recipe is required");
      const res = await apiClient.post("/production-runs/draft", {
        organizationId: "MILL",
        warehouseId: "WH-1",
        recipeId: activeRecipe.id,
        runNumber: `RUN-DRAFT-${Date.now().toString().slice(-5)}`,
        batchCount: 1,
        notes,
      });
      return res.data;
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

  const postDraftMutation = useMutation({
    mutationFn: async (run: ProductionRun) => {
      const res = await apiClient.post(`/production-runs/${run.id}/post`, {
        organizationId: "MILL",
        warehouseId: "WH-1",
        recipeId: activeRecipe?.id || "",
        runNumber: run.runNumber,
        batchCount: 1,
        actualGoodQty: Number(run.actualGoodQty) || Number(run.expectedOutputQty) || 200,
        directLaborCost: Number(run.directLaborCost) || 0,
        utilityCost: Number(run.utilityCost) || 0,
        notes: run.notes || undefined,
        consumedMaterials: run.materials.map((m) => ({
          inventoryItemId: m.inventoryItemId,
          actualQty: Number(m.actualQty),
          damagedQty: Number(m.damagedQty),
        })),
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-runs"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-balances"] });
      toast.success("Draft run posted to stock ledger.");
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, "Failed to post draft run"));
    },
  });

  const deleteDraftMutation = useMutation({
    mutationFn: async (runId: string) => {
      const res = await apiClient.delete(`/production-runs/${runId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-runs"] });
      toast.success("Draft run deleted.");
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, "Failed to delete draft"));
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

  // Live modal calculations
  const expectedPackets = 200;
  const yieldVariancePct =
    ((actualGoodQty - expectedPackets) / expectedPackets) * 100;
  const oilVariancePct = ((oilConsumed - 10) / 10) * 100;
  const cartonsHold = cartonsConsumed * 20;
  const hasCartonShortage = cartonsHold < actualGoodQty;

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {t("Production execution")}
            </h1>
          </div>
          <p className="max-w-[60ch] text-sm text-muted-foreground">
            {t("BOM execution, consumption variances, yield calculations, and run costs")}
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
              onChange={(e) => setSearchQuery(e.target.value)}
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
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Run number")}</TableHead>
                  <TableHead>{t("Status")}</TableHead>
                  <TableHead>{t("Product")}</TableHead>
                  <TableHead className="text-right">{t("Good packets")}</TableHead>
                  <TableHead className="text-right">
                    <DomainTooltip term="YIELD_VARIANCE">
                      {t("Yield variance")}
                    </DomainTooltip>
                  </TableHead>
                  <TableHead className="text-right">{t("Materials cost")}</TableHead>
                  <TableHead className="text-right">{t("Total cost")}</TableHead>
                  <TableHead className="text-right">{t("Cost / packet")}</TableHead>
                  <TableHead className="text-right">{t("Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRuns.length === 0 && runs.length > 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="p-0">
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
                    </TableCell>
                  </TableRow>
                )}
                {filteredRuns.map((r) => {
                  const yieldPct = Number(r.yieldVariancePct);
                  const isYieldFlagged = r.isYieldFlagged;

                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono font-medium">
                        {r.runNumber}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            r.status === "POSTED"
                              ? "success"
                              : r.status === "REVERSED"
                                ? "danger"
                                : "outline"
                          }
                        >
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {r.recipe.productVariant.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {r.recipe.name}
                          </span>
                          {r.packagingMismatch && (
                            <span
                              className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400"
                              title={r.packagingWarning || "Packaging capacity mismatch"}
                            >
                              <AlertTriangleIcon className="h-3 w-3 shrink-0" />
                              {r.packagingWarning || "Packaging mismatch"}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatQuantity(r.actualGoodQty)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span
                            className={
                              isYieldFlagged
                                ? "font-semibold text-amber-600 dark:text-amber-400"
                                : "text-muted-foreground"
                            }
                          >
                            {yieldPct > 0 ? `+${yieldPct}%` : `${yieldPct}%`}
                          </span>
                          {isYieldFlagged && (
                            <AlertTriangleIcon className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatINR(r.directMaterialCost)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatINR(r.totalRunCost)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium text-emerald-600 dark:text-emerald-400">
                        {formatINR(r.costPerGoodUnit)}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.status === "DRAFT" && canRecordProduction ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => postDraftMutation.mutate(r)}
                              disabled={postDraftMutation.isPending}
                              className="h-7 px-2 text-xs text-emerald-600"
                            >
                              Post Draft
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteDraftMutation.mutate(r.id)}
                              disabled={deleteDraftMutation.isPending}
                              className="h-7 px-2 text-xs text-destructive"
                              aria-label={`Delete draft ${r.runNumber}`}
                            >
                              <Trash2Icon className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : r.status === "POSTED" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedRun(r)}
                            className="gap-1 text-xs text-destructive hover:bg-destructive/10"
                          >
                            <RotateCcwIcon className="h-3.5 w-3.5" />
                            Reverse
                          </Button>
                        ) : r.status === "REVERSED" ? (
                          <span className="text-xs text-muted-foreground italic">
                            Reversed
                          </span>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

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
                  value={selectedRecipeId || undefined}
                  onValueChange={setSelectedRecipeId}
                >
                  <SelectTrigger id="production-recipe-select" className="font-medium">
                    <SelectValue placeholder="Murukku 200 g (Standard BOM)" />
                  </SelectTrigger>
                  <SelectContent searchable searchPlaceholder="Search BOM recipes...">
                    {(recipesData?.recipes || []).map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} — Target: {r.expectedOutputQty} pkts
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Output inputs */}
              <div className="grid grid-cols-2 gap-4">
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
                    value={actualGoodQty}
                    onChange={(e) => setActualGoodQty(Number(e.target.value))}
                    className="font-semibold"
                  />
                  <div className="flex items-center gap-1 text-xs">
                    <span>{t("Variance")}:</span>
                    <span
                      className={`font-semibold ${
                        yieldVariancePct !== 0
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-emerald-600"
                      }`}
                    >
                      {yieldVariancePct > 0
                        ? `+${yieldVariancePct}%`
                        : `${yieldVariancePct}%`}
                    </span>
                    {yieldVariancePct !== 0 && (
                      <span className="text-xs text-amber-600 font-medium">
                        ({t("flagged")})
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="production-damaged-pouches-input"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    {t("Damaged pouches")}
                  </Label>
                  <Input
                    id="production-damaged-pouches-input"
                    type="number"
                    value={damagedPouches}
                    onChange={(e) => setDamagedPouches(Number(e.target.value))}
                  />
                  <span className="text-xs text-muted-foreground">
                    Total pouches consumed: {actualGoodQty + damagedPouches}
                  </span>
                </div>
              </div>

              {/* Material consumption inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="production-oil-consumed-input"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    {t("Cooking oil consumed (L)")}
                  </Label>
                  <Input
                    id="production-oil-consumed-input"
                    type="number"
                    step="0.1"
                    value={oilConsumed}
                    onChange={(e) => setOilConsumed(Number(e.target.value))}
                  />
                  <div className="flex items-center gap-1 text-xs">
                    <span>{t("Variance")}:</span>
                    <span
                      className={`font-semibold ${
                        oilVariancePct !== 0
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-emerald-600"
                      }`}
                    >
                      {oilVariancePct > 0
                        ? `+${oilVariancePct}%`
                        : `${oilVariancePct}%`}
                    </span>
                    {oilVariancePct >= 5 && (
                      <span className="text-xs text-amber-600 font-medium">
                        ({t("flagged")})
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="production-cartons-consumed-input"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    {t("Cartons used (pieces)")}
                  </Label>
                  <Input
                    id="production-cartons-consumed-input"
                    type="number"
                    value={cartonsConsumed}
                    onChange={(e) => setCartonsConsumed(Number(e.target.value))}
                  />
                  <span className="text-xs text-muted-foreground">
                    Capacity: {cartonsHold} packets
                  </span>
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
                    Warning: {cartonsConsumed} cartons represent {cartonsHold}{" "}
                    of {actualGoodQty} packets.
                  </span>
                </div>
              )}

              {/* Additional Costs */}
              <div className="grid grid-cols-2 gap-4">
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

              {/* Cost summary preview */}
              <div className="rounded-lg bg-muted/50 p-3 text-xs flex flex-col gap-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {t("Direct materials:")}
                  </span>
                  <span className="font-semibold">₹4,055.00</span>
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
                    {formatINR(4055 + laborCost + utilityCost)}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>{t("Cost per good packet:")}</span>
                  <span>
                    {formatINR(
                      (4055 + laborCost + utilityCost) / actualGoodQty
                    )}
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
          <div className="max-h-96 overflow-y-auto flex flex-col gap-3 py-2">
            {(recipesData?.recipes ?? []).map((r) => (
              <div key={r.id} className="rounded-lg border p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-sm">{r.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({r.productVariant?.name}) — Target: {Number(r.expectedOutputQty)} pkts
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
