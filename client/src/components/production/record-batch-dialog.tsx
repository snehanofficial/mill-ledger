import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { formatINR } from "@/lib/formatters";
import { useLanguage } from "@/lib/i18n";
import { useWarehouses } from "@/hooks/use-warehouses";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  AlertTriangleIcon,
  CheckCircle2Icon,
  RefreshCwIcon,
} from "lucide-react";
import type { BomRecipe, InventoryBalanceItem } from "./production-types";

interface RecordProductionBatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipes: BomRecipe[];
  balances: InventoryBalanceItem[];
  initialRecipeId?: string;
  selectedWarehouseId: string;
  onWarehouseChange: (warehouseId: string) => void;
}

export function RecordProductionBatchDialog({
  open,
  onOpenChange,
  recipes,
  balances,
  initialRecipeId,
  selectedWarehouseId,
  onWarehouseChange,
}: RecordProductionBatchDialogProps) {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { data: warehousesData } = useWarehouses();
  const warehouses = warehousesData?.warehouses || [];
  const activeWarehouse =
    warehouses.find((w) => w.id === selectedWarehouseId) || warehouses[0];

  const [selectedRecipeId, setSelectedRecipeId] = useState(
    initialRecipeId || "",
  );
  const [batchCount, setBatchCount] = useState(1);
  const [actualGoodQty, setActualGoodQty] = useState(200);
  const [actualRejectedQty, setActualRejectedQty] = useState(0);
  const [materialActuals, setMaterialActuals] = useState<
    Record<string, { actualQty: number; damagedQty: number }>
  >({});
  const [laborCost, setLaborCost] = useState(1200);
  const [utilityCost, setUtilityCost] = useState(600);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open && initialRecipeId) {
      setSelectedRecipeId(initialRecipeId);
      setMaterialActuals({});
      const match = recipes.find((r) => r.id === initialRecipeId);
      if (match) {
        setActualGoodQty(Number(match.expectedOutputQty) || 200);
      }
    }
  }, [open, initialRecipeId, recipes]);

  const activeRecipe =
    recipes.find((r) => r.id === selectedRecipeId) || recipes[0];

  const balanceById = new Map(balances.map((b) => [b.id, b]));

  const getMaterialInput = (item: {
    inventoryItemId: string;
    plannedQty: number;
  }) => {
    const override = materialActuals[item.inventoryItemId];
    if (override) return override;
    const scaledPlanned = Number(item.plannedQty) * batchCount;
    return { actualQty: scaledPlanned, damagedQty: 0 };
  };

  const postMutation = useMutation({
    mutationFn: async () => {
      if (!activeRecipe || activeRecipe.items.length === 0) {
        throw new Error("Active BOM recipe with materials is required");
      }
      if (!activeWarehouse) {
        throw new Error("Production warehouse is required");
      }

      const consumedMaterials = activeRecipe.items.map((item) => {
        const entry = getMaterialInput(item);
        return {
          inventoryItemId: item.inventoryItemId,
          actualQty: Number(entry.actualQty),
          damagedQty: Number(entry.damagedQty || 0),
        };
      });

      const res = await apiClient.post("/production-runs", {
        warehouseId: activeWarehouse.id,
        recipeId: activeRecipe.id,
        runNumber: `RUN-2026-${Date.now().toString().slice(-4)}`,
        batchCount,
        actualGoodQty,
        actualRejectedQty,
        directLaborCost: laborCost,
        utilityCost,
        notes: notes.trim() || `${activeRecipe.name} batch`,
        consumedMaterials,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-runs"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-balances"] });
      onOpenChange(false);
      toast.success("Production batch posted and stock ledger updated.");
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, "Failed to post production batch"));
    },
  });

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
        notes: notes.trim() || `${activeRecipe.name} draft`,
      });
      const created = createdRes.data;
      if (created?.id) {
        await apiClient.put(`/production-runs/${created.id}`, {
          actualGoodQty,
          directLaborCost: laborCost,
          utilityCost,
          notes: notes.trim() || `${activeRecipe.name} draft`,
        });
      }
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-runs"] });
      onOpenChange(false);
      toast.success("Production run saved as DRAFT.");
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, "Failed to save draft"));
    },
  });

  const expectedPackets =
    (Number(activeRecipe?.expectedOutputQty) || 200) * batchCount;
  const yieldVariancePct =
    expectedPackets > 0
      ? ((actualGoodQty - expectedPackets) / expectedPackets) * 100
      : 0;

  const liveDirectMaterialCost = (activeRecipe?.items ?? []).reduce(
    (sum, item) => {
      const entry = getMaterialInput(item);
      const wac =
        balanceById.get(item.inventoryItemId)?.weightedAverageCost ?? 0;
      return sum + Number(entry.actualQty) * wac;
    },
    0,
  );

  const cartonLine = (activeRecipe?.items ?? []).find(
    (it) =>
      it.inventoryItem.sku === "PKG-CARTON" ||
      it.inventoryItem.name.toLowerCase().includes("carton"),
  );
  const cartonsUsedLive = cartonLine
    ? getMaterialInput(cartonLine).actualQty
    : 0;
  const cartonsHold = cartonsUsedLive * 20;
  const hasCartonShortage = Boolean(cartonLine) && cartonsHold < actualGoodQty;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) postMutation.reset();
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("Record production batch")}</DialogTitle>
          <DialogDescription>
            {activeRecipe
              ? `${activeRecipe.name} (${Number(activeRecipe.expectedOutputQty)} expected per batch)`
              : "Select an approved BOM recipe to record consumption and output."}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex flex-col gap-4">
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
              onValueChange={(val) => {
                setSelectedRecipeId(val);
                setMaterialActuals({});
                const nextRecipe = recipes.find((r) => r.id === val);
                if (nextRecipe) {
                  setActualGoodQty(
                    Number(nextRecipe.expectedOutputQty) * batchCount,
                  );
                }
              }}
            >
              <SelectTrigger
                id="production-recipe-select"
                className="font-medium"
              >
                <SelectValue placeholder="Select BOM recipe" />
              </SelectTrigger>
              <SelectContent
                searchable
                searchPlaceholder="Search BOM recipes..."
              >
                {recipes.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name} · Target: {r.expectedOutputQty} pkts
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="production-warehouse-select"
              className="text-xs font-semibold text-muted-foreground"
            >
              Production Warehouse
            </Label>
            <Select
              value={activeWarehouse?.id || undefined}
              onValueChange={onWarehouseChange}
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
                onChange={(e) => {
                  const next = Math.max(0.1, Number(e.target.value) || 1);
                  setBatchCount(next);
                }}
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
                  <div
                    key={item.id}
                    className="p-2.5 flex flex-col gap-1.5 text-xs"
                  >
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
                            Math.abs(varPct) >= (item.tolerancePct || 5) &&
                            varPct !== 0
                              ? "text-amber-600 font-semibold"
                              : "text-muted-foreground"
                          }
                        >
                          {varPct > 0
                            ? `+${varPct.toFixed(1)}%`
                            : `${varPct.toFixed(1)}%`}
                        </span>
                        <div className="text-muted-foreground">
                          {formatINR(
                            entry.actualQty * (bal?.weightedAverageCost ?? 0),
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {hasCartonShortage && (
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
                Warning: {cartonsUsedLive} cartons represent {cartonsHold} of{" "}
                {actualGoodQty} packets.
              </span>
            </div>
          )}

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
              placeholder="Optional shift or batch notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-xs flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("Direct materials:")}
              </span>
              <span className="font-semibold">
                {formatINR(liveDirectMaterialCost)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("Direct labour:")}
              </span>
              <span className="font-semibold">{formatINR(laborCost)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("Gas and power:")}
              </span>
              <span className="font-semibold">{formatINR(utilityCost)}</span>
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
                  ? formatINR(
                      (liveDirectMaterialCost + laborCost + utilityCost) /
                        actualGoodQty,
                    )
                  : "0.00"}
              </span>
            </div>
          </div>
        </div>

        {postMutation.isError && (
          <div
            role="alert"
            className="mt-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
          >
            <AlertTriangleIcon
              className="h-4 w-4 shrink-0"
              aria-hidden="true"
            />
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
            onClick={() => onOpenChange(false)}
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
  );
}
