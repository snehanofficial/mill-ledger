import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  PencilIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { formatDateTime, formatINR, formatQuantity } from "@/lib/formatters";
import { useLanguage } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DomainTooltip } from "@/components/ui/domain-tooltip";
import {
  DataTableColumnHeader,
  type DataTableBulkAction,
  type DataTableColumnMeta,
} from "@/components/ui/data-table";
import type { ProductionRun } from "./production-types";

interface RunActionsCellProps {
  run: ProductionRun;
  canRecordProduction: boolean;
  activeWarehouseId?: string;
  activeRecipeId?: string;
  onEditDraft: (run: ProductionRun) => void;
  onReverseRun: (run: ProductionRun) => void;
}

function RunActionsCell({
  run,
  canRecordProduction,
  activeWarehouseId,
  activeRecipeId,
  onEditDraft,
  onReverseRun,
}: RunActionsCellProps) {
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
            Number(m.actualQty) > 0 ? Number(m.actualQty) : Number(m.plannedQty),
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

  if (run.status === "DRAFT" && canRecordProduction) {
    return (
      <div className="flex items-center justify-end gap-1 whitespace-nowrap">
        <Button
          variant="outline"
          size="sm"
          aria-label={`Edit draft ${run.runNumber}`}
          onClick={() => onEditDraft(run)}
          className="h-8 px-2 text-xs"
        >
          <PencilIcon className="size-3.5" aria-hidden="true" />
          Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => postDraftMutation.mutate()}
          disabled={postDraftMutation.isPending}
          className="h-8 px-2 text-xs text-emerald-700 dark:text-emerald-400"
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
          <Trash2Icon className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  if (run.status === "POSTED" && canRecordProduction) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onReverseRun(run)}
        className="h-8 gap-1 text-xs text-destructive hover:bg-destructive/10 whitespace-nowrap"
      >
        <RotateCcwIcon className="size-3.5" aria-hidden="true" />
        Reverse
      </Button>
    );
  }

  if (run.status === "REVERSED") {
    return (
      <span className="text-xs text-muted-foreground italic whitespace-nowrap">
        Reversed
      </span>
    );
  }

  return (
    <Link
      to={`/production/runs/${run.id}`}
      className="text-xs font-medium text-primary hover:underline whitespace-nowrap"
    >
      View detail
    </Link>
  );
}

export interface UseProductionRunColumnsOptions {
  includeDateTime?: boolean;
  canRecordProduction: boolean;
  activeWarehouseId?: string;
  activeRecipeId?: string;
  onEditDraft: (run: ProductionRun) => void;
  onReverseRun: (run: ProductionRun) => void;
}

export function useProductionRunColumns({
  includeDateTime = false,
  canRecordProduction,
  activeWarehouseId,
  activeRecipeId,
  onEditDraft,
  onReverseRun,
}: UseProductionRunColumnsOptions): ColumnDef<ProductionRun, unknown>[] {
  const { t } = useLanguage();

  return useMemo(() => {
    const cols: ColumnDef<ProductionRun, unknown>[] = [
      {
        accessorKey: "runNumber",
        enableHiding: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("Run number")} />
        ),
        cell: ({ row }) => (
          <Link
            to={`/production/runs/${row.original.id}`}
            className="font-mono font-medium text-primary hover:underline whitespace-nowrap"
          >
            {row.original.runNumber}
          </Link>
        ),
        meta: {
          label: "Run number",
          cellClassName: "whitespace-nowrap",
        } satisfies DataTableColumnMeta<ProductionRun>,
      },
    ];

    if (includeDateTime) {
      cols.push({
        id: "dateTime",
        accessorFn: (row) =>
          new Date(row.postedAt || row.createdAt).getTime() || 0,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("Date / Time")} />
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
            {formatDateTime(row.original.postedAt || row.original.createdAt)}
          </span>
        ),
        meta: {
          label: "Date / Time",
          cellClassName: "whitespace-nowrap",
          exportValue: (r) => formatDateTime(r.postedAt || r.createdAt),
        } satisfies DataTableColumnMeta<ProductionRun>,
      });
    }

    cols.push(
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("Status")} />
        ),
        cell: ({ row }) => (
          <Badge
            variant={
              row.original.status === "POSTED"
                ? "success"
                : row.original.status === "REVERSED"
                  ? "danger"
                  : "outline"
            }
          >
            {row.original.status}
          </Badge>
        ),
        meta: {
          label: "Status",
          cellClassName: "whitespace-nowrap",
        } satisfies DataTableColumnMeta<ProductionRun>,
      },
      {
        id: "product",
        accessorFn: (row) => row.recipe.productVariant.name,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("Product")} />
        ),
        cell: ({ row }) => {
          const run = row.original;
          return (
            <div className="flex min-w-[220px] max-w-[340px] flex-col gap-0.5">
              <span className="font-medium text-foreground">
                {run.recipe.productVariant.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {run.recipe.name}
              </span>
              {run.packagingMismatch && (
                <span
                  className="mt-0.5 inline-flex items-start gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400"
                  title={run.packagingWarning || "Packaging capacity mismatch"}
                >
                  <AlertTriangleIcon
                    className="mt-0.5 size-3 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{run.packagingWarning || "Packaging mismatch"}</span>
                </span>
              )}
            </div>
          );
        },
        meta: {
          label: "Product",
          exportValue: (r) =>
            `${r.recipe.productVariant.name} (${r.recipe.name})`,
        } satisfies DataTableColumnMeta<ProductionRun>,
      },
      {
        id: "actualGoodQty",
        accessorFn: (row) => Number(row.actualGoodQty) || 0,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("Good packets")}
            align="right"
          />
        ),
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums whitespace-nowrap">
            {formatQuantity(row.original.actualGoodQty)}
          </span>
        ),
        meta: {
          label: "Good packets",
          align: "right",
          cellClassName: "whitespace-nowrap",
          exportValue: (r) => Number(r.actualGoodQty),
        } satisfies DataTableColumnMeta<ProductionRun>,
      },
      {
        id: "yieldVariancePct",
        accessorFn: (row) => Number(row.yieldVariancePct) || 0,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={
              <DomainTooltip term="YIELD_VARIANCE">
                {t("Yield variance")}
              </DomainTooltip>
            }
            align="right"
          />
        ),
        cell: ({ row }) => {
          const run = row.original;
          const yieldPct = Number(run.yieldVariancePct);
          return (
            <div className="flex items-center justify-end gap-1.5 whitespace-nowrap tabular-nums">
              <span
                className={
                  run.isYieldFlagged
                    ? "font-semibold text-amber-700 dark:text-amber-400"
                    : "text-muted-foreground"
                }
              >
                {yieldPct > 0 ? `+${yieldPct}%` : `${yieldPct}%`}
              </span>
              {run.isYieldFlagged && (
                <AlertTriangleIcon
                  className="size-3.5 text-amber-700 dark:text-amber-400"
                  aria-hidden="true"
                />
              )}
            </div>
          );
        },
        meta: {
          label: "Yield variance",
          align: "right",
          cellClassName: "whitespace-nowrap",
          exportValue: (r) => `${Number(r.yieldVariancePct)}%`,
        } satisfies DataTableColumnMeta<ProductionRun>,
      },
      {
        id: "directMaterialCost",
        accessorFn: (row) => Number(row.directMaterialCost) || 0,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("Materials cost")}
            align="right"
          />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums whitespace-nowrap">
            {formatINR(row.original.directMaterialCost)}
          </span>
        ),
        meta: {
          label: "Materials cost",
          align: "right",
          cellClassName: "whitespace-nowrap",
          exportValue: (r) => Number(r.directMaterialCost),
        } satisfies DataTableColumnMeta<ProductionRun>,
      },
      {
        id: "totalRunCost",
        accessorFn: (row) => Number(row.totalRunCost) || 0,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("Total cost")}
            align="right"
          />
        ),
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums whitespace-nowrap">
            {formatINR(row.original.totalRunCost)}
          </span>
        ),
        meta: {
          label: "Total cost",
          align: "right",
          cellClassName: "whitespace-nowrap",
          exportValue: (r) => Number(r.totalRunCost),
        } satisfies DataTableColumnMeta<ProductionRun>,
      },
      {
        id: "costPerGoodUnit",
        accessorFn: (row) => Number(row.costPerGoodUnit) || 0,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("Cost / packet")}
            align="right"
          />
        ),
        cell: ({ row }) => (
          <span className="font-mono font-medium text-emerald-700 dark:text-emerald-400 tabular-nums whitespace-nowrap">
            {formatINR(row.original.costPerGoodUnit)}
          </span>
        ),
        meta: {
          label: "Cost / packet",
          align: "right",
          cellClassName: "whitespace-nowrap",
          exportValue: (r) => Number(r.costPerGoodUnit),
        } satisfies DataTableColumnMeta<ProductionRun>,
      },
      {
        id: "actions",
        enableSorting: false,
        enableHiding: false,
        header: () => <span>{t("Actions")}</span>,
        cell: ({ row }) => (
          <RunActionsCell
            run={row.original}
            canRecordProduction={canRecordProduction}
            activeWarehouseId={activeWarehouseId}
            activeRecipeId={activeRecipeId}
            onEditDraft={onEditDraft}
            onReverseRun={onReverseRun}
          />
        ),
        meta: {
          label: "Actions",
          align: "right",
          cellClassName: "whitespace-nowrap",
        } satisfies DataTableColumnMeta<ProductionRun>,
      },
    );

    return cols;
  }, [
    t,
    includeDateTime,
    canRecordProduction,
    activeWarehouseId,
    activeRecipeId,
    onEditDraft,
    onReverseRun,
  ]);
}

export function useProductionRunBulkActions({
  canRecordProduction,
  activeWarehouseId,
  activeRecipeId,
}: {
  canRecordProduction: boolean;
  activeWarehouseId?: string;
  activeRecipeId?: string;
}): DataTableBulkAction<ProductionRun>[] {
  const queryClient = useQueryClient();

  return useMemo(() => {
    if (!canRecordProduction) return [];

    return [
      {
        id: "post-drafts",
        label: "Post selected drafts",
        icon: CheckCircle2Icon,
        variant: "primary",
        hidden: (rows) => !rows.some((r) => r.status === "DRAFT"),
        onClick: async (rows, clearSelection) => {
          const drafts = rows.filter((r) => r.status === "DRAFT");
          const results = await Promise.allSettled(
            drafts.map((run) =>
              apiClient.post(`/production-runs/${run.id}/post`, {
                warehouseId: activeWarehouseId || "",
                recipeId: run.recipeId || activeRecipeId || "",
                runNumber: run.runNumber,
                batchCount: Number(run.batchCount) || 1,
                actualGoodQty:
                  Number(run.actualGoodQty) ||
                  Number(run.expectedOutputQty) ||
                  200,
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
              }),
            ),
          );
          const succeeded = results.filter((r) => r.status === "fulfilled").length;
          const failed = results.length - succeeded;
          queryClient.invalidateQueries({ queryKey: ["production-runs"] });
          queryClient.invalidateQueries({ queryKey: ["inventory-balances"] });
          if (succeeded > 0) {
            toast.success(`Posted ${succeeded} draft ${succeeded === 1 ? "run" : "runs"}.`);
          }
          if (failed > 0) {
            toast.error(`Failed to post ${failed} draft ${failed === 1 ? "run" : "runs"}.`);
          }
          clearSelection();
        },
      },
      {
        id: "delete-drafts",
        label: "Delete selected drafts",
        icon: Trash2Icon,
        variant: "destructive",
        hidden: (rows) => !rows.some((r) => r.status === "DRAFT"),
        onClick: async (rows, clearSelection) => {
          const drafts = rows.filter((r) => r.status === "DRAFT");
          const results = await Promise.allSettled(
            drafts.map((run) => apiClient.delete(`/production-runs/${run.id}`)),
          );
          const succeeded = results.filter((r) => r.status === "fulfilled").length;
          const failed = results.length - succeeded;
          queryClient.invalidateQueries({ queryKey: ["production-runs"] });
          if (succeeded > 0) {
            toast.success(`Deleted ${succeeded} draft ${succeeded === 1 ? "run" : "runs"}.`);
          }
          if (failed > 0) {
            toast.error(`Failed to delete ${failed} draft ${failed === 1 ? "run" : "runs"}.`);
          }
          clearSelection();
        },
      },
    ];
  }, [canRecordProduction, activeWarehouseId, activeRecipeId, queryClient]);
}
