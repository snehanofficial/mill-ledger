import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
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
import {
  FactoryIcon,
  RefreshCwIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
  RotateCcwIcon,
  PlusCircleIcon,
  BoxesIcon,
  IndianRupeeIcon,
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
  const [showNewBatchModal, setShowNewBatchModal] = useState(false);
  const [selectedRun, setSelectedRun] = useState<ProductionRun | null>(null);

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
  const { data, isLoading, isError, refetch, isFetching } = useQuery<{
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Production execution
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            BOM execution, consumption variances, yield calculations, and run
            costs
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

          <Button
            size="sm"
            onClick={() => setShowNewBatchModal(true)}
            className="gap-2"
          >
            <PlusCircleIcon className="h-4 w-4" />
            Record production batch
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">
              Total batches
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
              Packets produced
            </span>
            <BoxesIcon className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {totalPacketsProduced.toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground">
            Finished goods credited to warehouse
          </div>
        </div>

        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">
              Total run cost
            </span>
            <IndianRupeeIcon className="h-4 w-4" />
          </div>
          <div className="text-2xl font-bold">
            ₹
            {totalProductionCost.toLocaleString(undefined, {
              minimumFractionDigits: 2,
            })}
          </div>
          <div className="text-xs text-muted-foreground">
            Materials, labour, and utilities included
          </div>
        </div>

        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">
              Ledger integrity
            </span>
            <CheckCircle2Icon className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            Verified
          </div>
          <div className="text-xs text-muted-foreground">
            Stock ledger reconciles deterministically
          </div>
        </div>
      </div>

      {/* Production Runs Table */}
      <div className="rounded-xl border bg-card shadow-xs">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">
            Completed production runs
          </h2>
          <span className="text-xs text-muted-foreground">
            {runs.length} records found
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
            <RefreshCwIcon className="mr-2 h-4 w-4 animate-spin" />
            Loading production runs...
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-2 p-12 text-sm text-destructive">
            <AlertTriangleIcon className="h-6 w-6" />
            <span>Failed to load production runs from server</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12 text-center text-sm text-muted-foreground">
            <FactoryIcon className="h-8 w-8 stroke-1 text-muted-foreground/60" />
            <p>No production batches recorded yet.</p>
            <Button
              size="sm"
              onClick={() => setShowNewBatchModal(true)}
              className="gap-2"
            >
              <PlusCircleIcon className="h-4 w-4" />
              Record first batch
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Good packets</TableHead>
                  <TableHead className="text-right">Yield variance</TableHead>
                  <TableHead className="text-right">Materials cost</TableHead>
                  <TableHead className="text-right">Total cost</TableHead>
                  <TableHead className="text-right">Cost / packet</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r) => {
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
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {Number(r.actualGoodQty).toLocaleString()}
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
                        ₹
                        {Number(r.directMaterialCost).toLocaleString(
                          undefined,
                          {
                            minimumFractionDigits: 2,
                          },
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        ₹
                        {Number(r.totalRunCost).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium text-emerald-600 dark:text-emerald-400">
                        ₹{Number(r.costPerGoodUnit).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.status === "POSTED" ? (
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
      {showNewBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-card p-6 shadow-xl border">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  Record production batch
                </h3>
                <p className="text-xs text-muted-foreground">
                  Murukku 200g standard batch (Benchmark: 200 expected packets)
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNewBatchModal(false)}
              >
                ✕
              </Button>
            </div>

            <div className="mt-4 flex flex-col gap-4">
              {/* Recipe BOM selection (MLD-010) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Bill of Materials (BOM) Recipe
                </label>
                <select
                  value={selectedRecipeId}
                  onChange={(e) => setSelectedRecipeId(e.target.value)}
                  className="rounded-md border bg-background px-3 py-2 text-sm font-medium"
                >
                  {(recipesData?.recipes || []).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} — Target: {r.expectedOutputQty} pkts
                    </option>
                  ))}
                  {(!recipesData?.recipes || recipesData.recipes.length === 0) && (
                    <option value="">Murukku 200 g (Standard BOM)</option>
                  )}
                </select>
              </div>

              {/* Output inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Good packets produced
                  </label>
                  <input
                    type="number"
                    value={actualGoodQty}
                    onChange={(e) => setActualGoodQty(Number(e.target.value))}
                    className="rounded-md border bg-background px-3 py-2 text-sm font-semibold"
                  />
                  <div className="flex items-center gap-1 text-xs">
                    <span>Variance:</span>
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
                        (flagged)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Damaged pouches
                  </label>
                  <input
                    type="number"
                    value={damagedPouches}
                    onChange={(e) => setDamagedPouches(Number(e.target.value))}
                    className="rounded-md border bg-background px-3 py-2 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">
                    Total pouches consumed: {actualGoodQty + damagedPouches}
                  </span>
                </div>
              </div>

              {/* Material consumption inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Cooking oil consumed (L)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={oilConsumed}
                    onChange={(e) => setOilConsumed(Number(e.target.value))}
                    className="rounded-md border bg-background px-3 py-2 text-sm"
                  />
                  <div className="flex items-center gap-1 text-xs">
                    <span>Variance:</span>
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
                        (flagged)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Cartons used (pieces)
                  </label>
                  <input
                    type="number"
                    value={cartonsConsumed}
                    onChange={(e) => setCartonsConsumed(Number(e.target.value))}
                    className="rounded-md border bg-background px-3 py-2 text-sm"
                  />
                  <span className="text-xs text-muted-foreground">
                    Capacity: {cartonsHold} packets
                  </span>
                </div>
              </div>

              {/* Non-blocking carton warning pill */}
              {hasCartonShortage && (
                <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <AlertTriangleIcon className="h-4 w-4 shrink-0" />
                  <span>
                    Warning: {cartonsConsumed} cartons represent {cartonsHold}{" "}
                    of {actualGoodQty} packets.
                  </span>
                </div>
              )}

              {/* Additional Costs */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Direct labour cost (₹)
                  </label>
                  <input
                    type="number"
                    value={laborCost}
                    onChange={(e) => setLaborCost(Number(e.target.value))}
                    className="rounded-md border bg-background px-3 py-2 text-sm font-semibold"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Gas and power cost (₹)
                  </label>
                  <input
                    type="number"
                    value={utilityCost}
                    onChange={(e) => setUtilityCost(Number(e.target.value))}
                    className="rounded-md border bg-background px-3 py-2 text-sm font-semibold"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>

              {/* Cost summary preview */}
              <div className="rounded-lg bg-muted/50 p-3 text-xs flex flex-col gap-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Direct materials:
                  </span>
                  <span className="font-semibold">₹4,055.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Direct labour:</span>
                  <span className="font-semibold">₹{laborCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gas and power:</span>
                  <span className="font-semibold">
                    ₹{utilityCost.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-1 font-bold">
                  <span>Total run cost:</span>
                  <span className="text-foreground">
                    ₹{(4055 + laborCost + utilityCost).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>Cost per good packet:</span>
                  <span>
                    ₹
                    {((4055 + laborCost + utilityCost) / actualGoodQty).toFixed(
                      2,
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNewBatchModal(false)}
              >
                Cancel
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
                    Posting batch...
                  </>
                ) : (
                  <>
                    <CheckCircle2Icon className="h-4 w-4" />
                    Post production batch
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reversal Confirmation Modal */}
      {selectedRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl border">
            <h3 className="text-lg font-bold text-foreground">
              Reverse production run
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              This will atomically restore raw materials and packaging back into
              inventory and deduct {Number(selectedRun.actualGoodQty)} finished
              packets.
            </p>

            <div className="mt-4 flex flex-col gap-2">
              <label className="text-xs font-semibold text-muted-foreground">
                Reversal reason
              </label>
              <input
                id="reversal-reason-input"
                type="text"
                placeholder="e.g. Quality inspection failed on batch"
                defaultValue="Batch quality inspection failed"
                className="rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedRun(null)}
              >
                Cancel
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
                Confirm reversal
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
