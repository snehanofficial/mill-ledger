import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { PaginationMeta } from "@mill-ledger/shared";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useWarehouses } from "@/hooks/use-warehouses";
import { apiClient } from "@/lib/api-client";
import { assertCollectionResponse } from "@/lib/api-contracts";
import { formatINR, formatQuantity, formatDate } from "@/lib/formatters";
import { useLanguage } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import {
  EmptyState,
  SkeletonTable,
  ErrorState,
} from "@/components/ui/loading-error-empty";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertTriangleIcon,
  BoxesIcon,
  ClipboardListIcon,
  FactoryIcon,
  IndianRupeeIcon,
  LayersIcon,
  PlusCircleIcon,
  RefreshCwIcon,
} from "lucide-react";
import type {
  BomRecipe,
  InventoryBalanceItem,
  ProductionRun,
} from "@/components/production/production-types";
import { RecordProductionBatchDialog } from "@/components/production/record-batch-dialog";
import {
  EditDraftRunDialog,
  ReverseRunDialog,
} from "@/components/production/production-run-dialogs";
import {
  useProductionRunBulkActions,
  useProductionRunColumns,
} from "@/components/production/production-run-columns";

function isSameLocalDay(iso: string | null | undefined, refDate: Date): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === refDate.getFullYear() &&
    d.getMonth() === refDate.getMonth() &&
    d.getDate() === refDate.getDate()
  );
}

interface ProductionTodayPageProps {
  initialOpenNewBatch?: boolean;
}

export function ProductionTodayPage({
  initialOpenNewBatch = false,
}: ProductionTodayPageProps) {
  const { user } = useCurrentUser();
  const { t } = useLanguage();
  const canRecordProduction =
    user?.role === "ADMIN" || user?.role === "PRODUCTION";

  const [showNewBatchModal, setShowNewBatchModal] = useState(
    initialOpenNewBatch && canRecordProduction,
  );
  const [preselectedRecipeId, setPreselectedRecipeId] = useState<string | undefined>(
    undefined,
  );
  const [selectedRun, setSelectedRun] = useState<ProductionRun | null>(null);
  const [editingDraftRun, setEditingDraftRun] = useState<ProductionRun | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");

  useEffect(() => {
    if (initialOpenNewBatch && canRecordProduction) {
      setShowNewBatchModal(true);
    }
  }, [initialOpenNewBatch, canRecordProduction]);

  const { data: warehousesData } = useWarehouses();
  const warehouses = warehousesData?.warehouses || [];
  const activeWarehouse =
    warehouses.find((w) => w.id === selectedWarehouseId) || warehouses[0];

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{
    runs: ProductionRun[];
    pagination: PaginationMeta;
  }>({
    queryKey: ["production-runs", "today-feed"],
    queryFn: async () => {
      const res = await apiClient.get("/production-runs?limit=50&offset=0");
      return assertCollectionResponse(res.data, "runs", "/production-runs");
    },
  });

  const { data: balancesData } = useQuery<{
    balances: InventoryBalanceItem[];
  }>({
    queryKey: ["inventory-balances", activeWarehouse?.id ?? "all"],
    queryFn: async () => {
      const qs = activeWarehouse?.id
        ? `?warehouseId=${encodeURIComponent(activeWarehouse.id)}`
        : "";
      const res = await apiClient.get(`/inventory/balances${qs}`);
      return assertCollectionResponse(
        res.data,
        "balances",
        "/inventory/balances",
      );
    },
  });

  const { data: recipesData } = useQuery<{
    recipes: BomRecipe[];
  }>({
    queryKey: ["production-recipes"],
    queryFn: async () => {
      const res = await apiClient.get("/production-runs/recipes");
      return assertCollectionResponse(
        res.data,
        "recipes",
        "/production-runs/recipes",
      );
    },
  });

  const allRuns = data?.runs ?? [];
  const recipes = recipesData?.recipes ?? [];
  const balances = balancesData?.balances ?? [];
  const balanceById = new Map(balances.map((b) => [b.id, b]));

  const today = useMemo(() => new Date(), []);

  // Today's runs include anything created or posted today, plus any open DRAFTs awaiting posting
  const todaysRuns = useMemo(() => {
    return allRuns.filter(
      (r) =>
        r.status === "DRAFT" ||
        isSameLocalDay(r.postedAt, today) ||
        isSameLocalDay(r.createdAt, today),
    );
  }, [allRuns, today]);

  const filteredRuns = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return todaysRuns;
    return todaysRuns.filter(
      (r) =>
        r.runNumber.toLowerCase().includes(q) ||
        (r.recipe?.name || "").toLowerCase().includes(q) ||
        (r.recipe?.productVariant?.name || "").toLowerCase().includes(q) ||
        (r.notes && r.notes.toLowerCase().includes(q)),
    );
  }, [todaysRuns, searchQuery]);

  // Today's KPIs
  const draftCount = todaysRuns.filter((r) => r.status === "DRAFT").length;
  const postedToday = todaysRuns.filter((r) => r.status === "POSTED");
  const packetsToday = postedToday.reduce(
    (sum, r) => sum + Number(r.actualGoodQty),
    0,
  );
  const costToday = postedToday.reduce(
    (sum, r) => sum + Number(r.totalRunCost),
    0,
  );
  const flaggedTodayCount = todaysRuns.filter(
    (r) => r.isYieldFlagged || r.packagingMismatch,
  ).length;

  // Material readiness per active recipe
  const recipeReadiness = useMemo(() => {
    return recipes.map((recipe) => {
      let maxBatches = Infinity;
      const shortages: Array<{ name: string; available: number; needed: number; unit: string }> = [];

      for (const item of recipe.items) {
        const planned = Number(item.plannedQty);
        if (planned <= 0) continue;
        const bal = balanceById.get(item.inventoryItemId);
        const available = Number(bal?.available ?? 0);
        const possible = Math.floor(available / planned);
        if (possible < maxBatches) {
          maxBatches = possible;
        }
        if (available < planned) {
          shortages.push({
            name: item.inventoryItem.name,
            available,
            needed: planned,
            unit: item.uom?.symbol || bal?.baseUom?.symbol || "",
          });
        }
      }

      if (maxBatches === Infinity) maxBatches = 0;

      return {
        recipe,
        maxBatches,
        shortages,
      };
    });
  }, [recipes, balances]);

  const columns = useProductionRunColumns({
    includeDateTime: false,
    canRecordProduction,
    activeWarehouseId: activeWarehouse?.id,
    activeRecipeId: recipes[0]?.id,
    onEditDraft: setEditingDraftRun,
    onReverseRun: setSelectedRun,
  });

  const bulkActions = useProductionRunBulkActions({
    canRecordProduction,
    activeWarehouseId: activeWarehouse?.id,
    activeRecipeId: recipes[0]?.id,
  });

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t("Today's production runs")}
        description={`Floor workspace for ${formatDate(today)}. Track active drafts, today's posted batches, and material readiness.`}
        badge={
          <Badge variant="outline" className="text-xs font-medium">
            {activeWarehouse ? `${activeWarehouse.code} · ${activeWarehouse.name}` : "All Warehouses"}
          </Badge>
        }
        secondaryActions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-2"
            >
              <RefreshCwIcon
                className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              {t("Refresh")}
            </Button>
            <Link
              to="/production/history"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ClipboardListIcon className="h-4 w-4" aria-hidden="true" />
              Run history
            </Link>
            <Link
              to="/production/recipes"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <LayersIcon className="h-4 w-4" aria-hidden="true" />
              Recipes & BOMs
            </Link>
          </>
        }
        primaryAction={
          canRecordProduction ? (
            <Button
              size="sm"
              onClick={() => {
                setPreselectedRecipeId(undefined);
                setShowNewBatchModal(true);
              }}
              className="gap-2"
            >
              <PlusCircleIcon className="h-4 w-4" aria-hidden="true" />
              {t("Start production run")}
            </Button>
          ) : undefined
        }
      />

      {/* Today's Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">
              Today's batches
            </span>
            <FactoryIcon className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="text-2xl font-bold tabular-nums">{todaysRuns.length}</div>
          <div className="text-xs text-muted-foreground">
            {postedToday.length} posted, {draftCount} draft awaiting post
          </div>
        </div>

        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">
              Packets produced today
            </span>
            <BoxesIcon className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {formatQuantity(packetsToday)}
          </div>
          <div className="text-xs text-muted-foreground">
            Finished goods credited today
          </div>
        </div>

        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">
              Today's run cost
            </span>
            <IndianRupeeIcon className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {formatINR(costToday)}
          </div>
          <div className="text-xs text-muted-foreground">
            {packetsToday > 0
              ? `Avg ${formatINR(costToday / packetsToday)} / packet`
              : "Materials, labour, and utilities"}
          </div>
        </div>

        <div className="flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">
              Variance alerts
            </span>
            <AlertTriangleIcon
              className={`h-4 w-4 ${flaggedTodayCount > 0 ? "text-amber-600" : "text-muted-foreground"}`}
              aria-hidden="true"
            />
          </div>
          <div
            className={`text-2xl font-bold tabular-nums ${
              flaggedTodayCount > 0
                ? "text-amber-600 dark:text-amber-400"
                : "text-foreground"
            }`}
          >
            {flaggedTodayCount}
          </div>
          <div className="text-xs text-muted-foreground">
            {flaggedTodayCount > 0
              ? "Yield or packaging mismatches today"
              : "No variance flags today"}
          </div>
        </div>
      </div>

      {/* Material Readiness by Active BOM */}
      {recipes.length > 0 && (
        <section
          aria-labelledby="material-readiness-heading"
          className="rounded-xl border bg-card shadow-xs"
        >
          <div className="flex flex-col gap-1 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2
                id="material-readiness-heading"
                className="text-sm font-semibold text-foreground"
              >
                Material readiness by active recipe
              </h2>
              <p className="text-xs text-muted-foreground">
                Producible batches based on current available raw and packaging stock
              </p>
            </div>
            <Link
              to="/stock"
              className="text-xs font-medium text-primary hover:underline"
            >
              Check stock overview
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {recipeReadiness.map(({ recipe, maxBatches, shortages }) => {
              const isShort = shortages.length > 0;
              return (
                <div
                  key={recipe.id}
                  className="flex flex-col justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-foreground truncate">
                        {recipe.productVariant.name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {recipe.name} · {Number(recipe.expectedOutputQty)} pkts/batch
                      </div>
                    </div>
                    <Badge variant={isShort ? "danger" : "success"}>
                      {isShort ? "Shortage" : `${maxBatches} batches ready`}
                    </Badge>
                  </div>

                  {isShort ? (
                    <div className="text-xs text-destructive space-y-0.5">
                      {shortages.slice(0, 2).map((s) => (
                        <div key={s.name}>
                          {s.name}: {s.available} {s.unit} avail (needs {s.needed} {s.unit})
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      All {recipe.items.length} BOM materials in stock
                    </div>
                  )}

                  {canRecordProduction && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-9 text-xs"
                      onClick={() => {
                        setPreselectedRecipeId(recipe.id);
                        setShowNewBatchModal(true);
                      }}
                    >
                      Start batch
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Today's Runs & Open Drafts Table */}
      <div className="rounded-xl border bg-card shadow-xs">
        <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">
              Today's runs & pending drafts
            </h2>
            <span className="text-xs text-muted-foreground">
              ({filteredRuns.length} of {todaysRuns.length})
            </span>
          </div>

          <Input
            placeholder={t("Search today's runs...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full sm:w-56 text-xs"
            aria-label="Search today's production runs"
          />
        </div>

        {isLoading ? (
          <div className="p-4">
            <SkeletonTable rows={5} columns={9} />
          </div>
        ) : isError ? (
          <div className="p-4">
            <ErrorState
              title="Failed to load today's production runs"
              description={
                error instanceof Error
                  ? error.message
                  : "An unexpected server error occurred."
              }
              error={error}
              onRetry={() => refetch()}
            />
          </div>
        ) : todaysRuns.length === 0 ? (
          <EmptyState
            title="No production runs logged today yet"
            description="Start a new production run or view past batches in run history."
            className="min-h-48 py-10"
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                {canRecordProduction && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNewBatchModal(true)}
                    className="gap-2"
                  >
                    <PlusCircleIcon className="h-4 w-4" aria-hidden="true" />
                    Start production run
                  </Button>
                )}
                <Link
                  to="/production/history"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  View run history
                </Link>
              </div>
            }
          />
        ) : filteredRuns.length === 0 ? (
          <EmptyState
            title="No matching runs today"
            description="Clear the search query to see all of today's runs."
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
              tableId="production-today"
              data={filteredRuns}
              columns={columns}
              getRowId={(r) => r.id}
              ariaLabel="Today's production runs"
              csvFilename="production-runs-today"
              bulkActions={bulkActions}
            />
          </div>
        )}
      </div>

      <RecordProductionBatchDialog
        open={showNewBatchModal}
        onOpenChange={setShowNewBatchModal}
        recipes={recipes}
        balances={balances}
        initialRecipeId={preselectedRecipeId}
        selectedWarehouseId={selectedWarehouseId}
        onWarehouseChange={setSelectedWarehouseId}
      />

      <EditDraftRunDialog
        run={editingDraftRun}
        onClose={() => setEditingDraftRun(null)}
      />

      <ReverseRunDialog
        run={selectedRun}
        onClose={() => setSelectedRun(null)}
      />
    </div>
  );
}
