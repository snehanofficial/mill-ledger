import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { formatINR, formatQuantity } from "@/lib/formatters";
import { useLanguage } from "@/lib/i18n";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertTriangleIcon,
  PencilIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react";
import type { ProductionRun } from "./production-types";

interface ProductionRunRowProps {
  run: ProductionRun;
  canRecordProduction: boolean;
  activeWarehouseId?: string;
  activeRecipeId?: string;
  onEditDraft: (run: ProductionRun) => void;
  onReverseRun: (run: ProductionRun) => void;
  extraColumns?: React.ReactNode;
}

export function ProductionRunRow({
  run,
  canRecordProduction,
  activeWarehouseId,
  activeRecipeId,
  onEditDraft,
  onReverseRun,
  extraColumns,
}: ProductionRunRowProps) {
  const queryClient = useQueryClient();

  const postDraftMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/production-runs/${run.id}/post`, {
        warehouseId: activeWarehouseId || "",
        recipeId: run.recipeId || activeRecipeId || "",
        runNumber: run.runNumber,
        batchCount: Number(run.batchCount) || 1,
        actualGoodQty:
          Number(run.actualGoodQty) || Number(run.expectedOutputQty) || 200,
        actualRejectedQty: Number(run.actualRejectedQty) || 0,
        directLaborCost: Number(run.directLaborCost) || 0,
        utilityCost: Number(run.utilityCost) || 0,
        notes: run.notes || undefined,
        consumedMaterials: (run.materials ?? []).map((m) => ({
          inventoryItemId: m.inventoryItemId,
          actualQty:
            Number(m.actualQty) > 0
              ? Number(m.actualQty)
              : Number(m.plannedQty),
          damagedQty: Number(m.damagedQty) || 0,
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
    mutationFn: async () => {
      const res = await apiClient.delete(`/production-runs/${run.id}`);
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

  const yieldPct = Number(run.yieldVariancePct);

  return (
    <TableRow>
      <TableCell className="font-mono font-medium">
        <Link
          to={`/production/runs/${run.id}`}
          className="text-primary hover:underline"
        >
          {run.runNumber}
        </Link>
      </TableCell>
      {extraColumns}
      <TableCell>
        <Badge
          variant={
            run.status === "POSTED"
              ? "success"
              : run.status === "REVERSED"
                ? "danger"
                : "outline"
          }
        >
          {run.status}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium text-foreground">
            {run.recipe.productVariant.name}
          </span>
          <span className="text-xs text-muted-foreground">
            {run.recipe.name}
          </span>
          {run.packagingMismatch && (
            <span
              className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400"
              title={run.packagingWarning || "Packaging capacity mismatch"}
            >
              <AlertTriangleIcon className="h-3 w-3 shrink-0" />
              {run.packagingWarning || "Packaging mismatch"}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right font-semibold tabular-nums">
        {formatQuantity(run.actualGoodQty)}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <div className="flex items-center justify-end gap-1.5">
          <span
            className={
              run.isYieldFlagged
                ? "font-semibold text-amber-600 dark:text-amber-400"
                : "text-muted-foreground"
            }
          >
            {yieldPct > 0 ? `+${yieldPct}%` : `${yieldPct}%`}
          </span>
          {run.isYieldFlagged && (
            <AlertTriangleIcon className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          )}
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatINR(run.directMaterialCost)}
      </TableCell>
      <TableCell className="text-right font-semibold tabular-nums">
        {formatINR(run.totalRunCost)}
      </TableCell>
      <TableCell className="text-right font-mono font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">
        {formatINR(run.costPerGoodUnit)}
      </TableCell>
      <TableCell className="text-right">
        {run.status === "DRAFT" && canRecordProduction ? (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="outline"
              size="sm"
              aria-label={`Edit draft ${run.runNumber}`}
              onClick={() => onEditDraft(run)}
              className="h-8 px-2 text-xs"
            >
              <PencilIcon className="h-3 w-3 mr-1" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => postDraftMutation.mutate()}
              disabled={postDraftMutation.isPending}
              className="h-8 px-2 text-xs text-emerald-600"
            >
              Post Draft
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => deleteDraftMutation.mutate()}
              disabled={deleteDraftMutation.isPending}
              className="h-8 px-2 text-xs text-destructive"
              aria-label={`Delete draft ${run.runNumber}`}
            >
              <Trash2Icon className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : run.status === "POSTED" && canRecordProduction ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onReverseRun(run)}
            className="gap-1 text-xs text-destructive hover:bg-destructive/10"
          >
            <RotateCcwIcon className="h-3.5 w-3.5" />
            Reverse
          </Button>
        ) : run.status === "REVERSED" ? (
          <span className="text-xs text-muted-foreground italic">Reversed</span>
        ) : (
          <Link
            to={`/production/runs/${run.id}`}
            className="text-xs font-medium text-primary hover:underline"
          >
            View detail
          </Link>
        )}
      </TableCell>
    </TableRow>
  );
}

interface EditDraftRunDialogProps {
  run: ProductionRun | null;
  onClose: () => void;
}

export function EditDraftRunDialog({ run, onClose }: EditDraftRunDialogProps) {
  const queryClient = useQueryClient();
  const [goodQty, setGoodQty] = useState(200);
  const [labor, setLabor] = useState(0);
  const [utility, setUtility] = useState(0);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (run) {
      setGoodQty(
        Number(run.actualGoodQty) || Number(run.expectedOutputQty) || 0,
      );
      setLabor(Number(run.directLaborCost) || 0);
      setUtility(Number(run.utilityCost) || 0);
      setNotes(run.notes || "");
    }
  }, [run]);

  const updateDraftMutation = useMutation({
    mutationFn: async () => {
      if (!run) throw new Error("No draft selected");
      const res = await apiClient.put(`/production-runs/${run.id}`, {
        actualGoodQty: goodQty,
        directLaborCost: labor,
        utilityCost: utility,
        notes,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-runs"] });
      onClose();
      toast.success("Draft run updated.");
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, "Failed to update draft"));
    },
  });

  return (
    <Dialog
      open={run !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Draft Run {run?.runNumber}</DialogTitle>
          <DialogDescription>
            Adjust draft quantities or direct costs before posting to the stock
            ledger.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="draft-edit-good-qty" className="text-xs">
              Good Output Quantity
            </Label>
            <Input
              id="draft-edit-good-qty"
              type="number"
              min={1}
              value={goodQty}
              onChange={(e) => setGoodQty(Number(e.target.value))}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="draft-edit-labor" className="text-xs">
                Direct Labour (₹)
              </Label>
              <Input
                id="draft-edit-labor"
                type="number"
                min={0}
                value={labor}
                onChange={(e) => setLabor(Number(e.target.value))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="draft-edit-utility" className="text-xs">
                Utilities (₹)
              </Label>
              <Input
                id="draft-edit-utility"
                type="number"
                min={0}
                value={utility}
                onChange={(e) => setUtility(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="draft-edit-notes" className="text-xs">
              Notes
            </Label>
            <Input
              id="draft-edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="border-t pt-4">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={updateDraftMutation.isPending}
            onClick={() => updateDraftMutation.mutate()}
          >
            {updateDraftMutation.isPending ? "Saving..." : "Save Draft Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ReverseRunDialogProps {
  run: ProductionRun | null;
  onClose: () => void;
}

export function ReverseRunDialog({ run, onClose }: ReverseRunDialogProps) {
  const queryClient = useQueryClient();
  const { t } = useLanguage();

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
      onClose();
      toast.success("Production run reversed.");
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, "Failed to reverse production run"));
    },
  });

  return (
    <Dialog
      open={run !== null}
      onOpenChange={(open) => {
        if (!open) {
          reverseMutation.reset();
          onClose();
        }
      }}
    >
      {run && (
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Reverse Production Run")}</DialogTitle>
            <DialogDescription>
              Reversing{" "}
              <span className="font-mono font-bold">{run.runNumber}</span> will
              execute exact inverse stock movements to deduct{" "}
              {run.actualGoodQty} finished packets and restore consumed raw
              materials.
            </DialogDescription>
          </DialogHeader>

          {reverseMutation.isError && (
            <div
              role="alert"
              className="mt-2 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
            >
              <AlertTriangleIcon
                className="h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span>
                {extractErrorMessage(
                  reverseMutation.error,
                  "Failed to reverse production run",
                )}
              </span>
            </div>
          )}

          <DialogFooter className="mt-6 border-t pt-4">
            <Button variant="outline" size="sm" onClick={onClose}>
              {t("Cancel")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={reverseMutation.isPending}
              onClick={() =>
                reverseMutation.mutate({
                  runId: run.id,
                  reason: "Reversed from production workspace",
                })
              }
            >
              {reverseMutation.isPending ? "Reversing..." : "Confirm Reversal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
