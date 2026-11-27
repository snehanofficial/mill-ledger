import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { assertEntityResponse } from "@/lib/api-contracts";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatINR, formatQuantity, formatDateTime } from "@/lib/formatters";
import { RecordHeader } from "@/components/ui/page-header";
import { ErrorState, SkeletonTable } from "@/components/ui/loading-error-empty";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangleIcon, RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";

interface RunDetail {
  id: string;
  runNumber: string;
  status: "DRAFT" | "POSTED" | "REVERSED";
  batchCount: number;
  expectedOutputQty: number;
  actualGoodQty: number;
  actualRejectedQty: number;
  yieldVarianceQty: number;
  yieldVariancePct: number;
  isYieldFlagged: boolean;
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
    version?: number;
    productVariant: { sku: string; name: string };
  };
  materials: Array<{
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
    inventoryItem: { sku: string; name: string; baseUom?: { code: string } };
  }>;
}

export function ProductionRunDetailPage() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const canCorrect = user?.role === "PRODUCTION" || user?.role === "ADMIN";

  const [reverseOpen, setReverseOpen] = useState(false);
  const [reverseReason, setReverseReason] = useState("");

  const { data: run, isLoading, isError, error, refetch } =
    useQuery<RunDetail>({
      queryKey: ["production-run", runId],
      queryFn: async () => {
        const endpoint = `/production-runs/${runId}`;
        const res = await apiClient.get(endpoint);
        return assertEntityResponse<RunDetail & Record<string, unknown>>(
          res.data,
          "run",
          ["materials"],
          endpoint,
        );
      },
      enabled: Boolean(runId),
    });

  const reverseMutation = useMutation({
    mutationFn: async () => {
      if (!run) return;
      const res = await apiClient.post(`/production-runs/${run.id}/reverse`, {
        reason: reverseReason.trim(),
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-run", runId] });
      queryClient.invalidateQueries({ queryKey: ["production-runs"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-balances"] });
      setReverseOpen(false);
      setReverseReason("");
      toast.success("Production run reversed.");
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to reverse production run."));
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <SkeletonTable rows={6} columns={6} />
      </div>
    );
  }

  if (isError || !run) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <ErrorState
          title="Unable to load production run"
          description={extractErrorMessage(error)}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-6xl">
      <RecordHeader
        backTo="/production/history"
        backLabel="Back to Run history"
        reference={run.runNumber}
        subtitle={`${run.recipe.productVariant.name} • Recipe: ${run.recipe.name}${run.recipe.version ? ` v${run.recipe.version}` : ""} • Batches: ${run.batchCount}`}
        statuses={
          <>
            <Badge variant="outline">{run.status}</Badge>
            {run.isYieldFlagged && (
              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                Yield variance: {Number(run.yieldVariancePct).toFixed(1)}%
              </Badge>
            )}
          </>
        }
        primaryAction={
          canCorrect && run.status === "DRAFT" ? (
            <Button
              variant="primary"
              onClick={() => navigate("/production/today")}
            >
              Manage draft in Today's runs
            </Button>
          ) : null
        }
        secondaryActions={
          canCorrect && run.status === "POSTED" ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setReverseOpen(true)}
              className="gap-1.5"
            >
              <RotateCcwIcon className="size-4" aria-hidden="true" />
              Reverse run
            </Button>
          ) : null
        }
      />

      {run.packagingWarning && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50/70 p-3.5 text-sm dark:border-amber-800 dark:bg-amber-950/30"
        >
          <AlertTriangleIcon className="size-4 shrink-0 text-amber-700 mt-0.5" aria-hidden="true" />
          <span>{run.packagingWarning}</span>
        </div>
      )}

      {/* Output & Costing Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 text-sm">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">Good output</div>
          <div className="text-lg font-semibold tabular-nums">
            {formatQuantity(run.actualGoodQty, { unit: "pkts" })}
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">
            Expected: {formatQuantity(run.expectedOutputQty, { unit: "pkts" })}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">Yield variance</div>
          <div className="text-lg font-semibold tabular-nums">
            {Number(run.yieldVariancePct).toFixed(1)}%
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">
            Rejected: {formatQuantity(run.actualRejectedQty, { unit: "pkts" })}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">Total run cost</div>
          <div className="text-lg font-semibold tabular-nums">
            {formatINR(run.totalRunCost)}
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">
            Mat: {formatINR(run.directMaterialCost)} • Lab: {formatINR(run.directLaborCost)} • Util: {formatINR(run.utilityCost)}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">Cost per good packet</div>
          <div className="text-lg font-semibold tabular-nums">
            {formatINR(run.costPerGoodUnit)}
          </div>
          <div className="text-xs text-muted-foreground">
            {run.postedAt ? `Posted ${formatDateTime(run.postedAt)}` : "Not posted"}
          </div>
        </div>
      </div>

      {/* Planned vs Actual Materials */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material / Packaging</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Planned</TableHead>
              <TableHead className="text-right">Actual consumed</TableHead>
              <TableHead className="text-right">Damaged / scrap</TableHead>
              <TableHead className="text-right">Variance</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Ledger</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {run.materials.map((m) => {
              const unit = m.inventoryItem.baseUom?.code ?? "unit";
              return (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="font-medium">{m.inventoryItem.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {m.inventoryItem.sku}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{m.itemType}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatQuantity(m.plannedQty, { unit })}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatQuantity(m.actualQty, { unit })}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatQuantity(m.damagedQty, { unit })}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span
                      className={
                        m.isVarianceFlagged
                          ? "font-semibold text-amber-700 dark:text-amber-400"
                          : ""
                      }
                    >
                      {Number(m.variancePct) >= 0 ? "+" : ""}
                      {Number(m.variancePct).toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatINR(m.totalCost)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      to={`/stock/${m.inventoryItemId}/ledger`}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Ledger
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={reverseOpen} onOpenChange={setReverseOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reverse production run {run.runNumber}</DialogTitle>
            <DialogDescription>
              Reverses raw material deductions and finished-goods output in the stock ledger without deleting the original run.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="run-rev-reason">
              Reversal reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="run-rev-reason"
              rows={3}
              value={reverseReason}
              onChange={(e) => setReverseReason(e.target.value)}
              placeholder="Explain why this posted production run is being reversed"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReverseOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => reverseMutation.mutate()}
              disabled={!reverseReason.trim() || reverseMutation.isPending}
            >
              {reverseMutation.isPending ? "Reversing..." : "Confirm reversal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
