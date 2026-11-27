import { useState } from "react";
import { Link } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { PaginationMeta } from "@mill-ledger/shared";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useWarehouses } from "@/hooks/use-warehouses";
import { apiClient } from "@/lib/api-client";
import { assertCollectionResponse } from "@/lib/api-contracts";
import { useUrlState } from "@/hooks/use-url-state";
import { usePagination } from "@/hooks/use-pagination";
import { formatINR, formatQuantity } from "@/lib/formatters";
import { useLanguage } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/page-header";
import { DataPagination } from "@/components/ui/data-pagination";
import { DataTable } from "@/components/ui/data-table";
import {
  EmptyState,
  SkeletonTable,
  ErrorState,
} from "@/components/ui/loading-error-empty";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BarChart2Icon,
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

const STATUS_FILTERS = [
  { value: "ALL", label: "All runs" },
  { value: "POSTED", label: "Posted" },
  { value: "DRAFT", label: "Drafts" },
  { value: "REVERSED", label: "Reversed" },
] as const;

export function ProductionHistoryPage() {
  const { user } = useCurrentUser();
  const { t } = useLanguage();
  const canRecordProduction =
    user?.role === "ADMIN" || user?.role === "PRODUCTION";

  const [statusFilter, setStatusFilter] = useUrlState("status", "ALL");
  const [searchQuery, setSearchQuery] = useUrlState("q", "", {
    debounceMs: 250,
  });
  const { page, pageSize, offset, setPage, setPageSize, resetPage } =
    usePagination({ defaultPageSize: 20 });

  const [showNewBatchModal, setShowNewBatchModal] = useState(false);
  const [selectedRun, setSelectedRun] = useState<ProductionRun | null>(null);
  const [editingDraftRun, setEditingDraftRun] = useState<ProductionRun | null>(
    null,
  );
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");

  const { data: warehousesData } = useWarehouses();
  const warehouses = warehousesData?.warehouses || [];
  const activeWarehouse =
    warehouses.find((w) => w.id === selectedWarehouseId) || warehouses[0];

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{
    runs: ProductionRun[];
    pagination: PaginationMeta;
  }>({
    queryKey: [
      "production-runs",
      "history",
      page,
      pageSize,
      statusFilter,
      searchQuery.trim(),
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset),
      });
      if (statusFilter && statusFilter !== "ALL") {
        params.set("status", statusFilter);
      }
      if (searchQuery.trim()) {
        params.set("q", searchQuery.trim());
      }
      const res = await apiClient.get(`/production-runs?${params.toString()}`);
      return assertCollectionResponse(res.data, "runs", "/production-runs");
    },
    placeholderData: keepPreviousData,
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

  const runs = data?.runs ?? [];
  const totalMatching = data?.pagination?.total ?? runs.length;
  const postedInPage = runs.filter((r) => r.status === "POSTED");
  const packetsInPage = postedInPage.reduce(
    (sum, r) => sum + Number(r.actualGoodQty),
    0,
  );
  const costInPage = postedInPage.reduce(
    (sum, r) => sum + Number(r.totalRunCost),
    0,
  );

  const columns = useProductionRunColumns({
    includeDateTime: true,
    canRecordProduction,
    activeWarehouseId: activeWarehouse?.id,
    activeRecipeId: recipesData?.recipes?.[0]?.id,
    onEditDraft: setEditingDraftRun,
    onReverseRun: setSelectedRun,
  });

  const bulkActions = useProductionRunBulkActions({
    canRecordProduction,
    activeWarehouseId: activeWarehouse?.id,
    activeRecipeId: recipesData?.recipes?.[0]?.id,
  });

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t("Production run history")}
        description="Complete historical ledger of all production batches, yield variances, unit costs, and reversals."
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
              to="/reports/production"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <BarChart2Icon className="h-4 w-4" aria-hidden="true" />
              Production report
            </Link>
          </>
        }
        primaryAction={
          canRecordProduction ? (
            <Button
              size="sm"
              onClick={() => setShowNewBatchModal(true)}
              className="gap-2"
            >
              <PlusCircleIcon className="h-4 w-4" aria-hidden="true" />
              {t("Start production run")}
            </Button>
          ) : undefined
        }
      />

      {/* Compact historical summary strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground">Matching runs</div>
          <div className="text-lg font-bold tabular-nums">{totalMatching}</div>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground">
            Posted packets (this page)
          </div>
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {formatQuantity(packetsInPage)}
          </div>
        </div>
        <div className="rounded-lg border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground">
            Posted run cost (this page)
          </div>
          <div className="text-lg font-bold tabular-nums">
            {formatINR(costInPage)}
          </div>
        </div>
      </div>

      {/* Filter & Table Card */}
      <div className="rounded-xl border bg-card shadow-xs">
        <div className="flex flex-col gap-3 border-b px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label="Filter runs by status"
          >
            {STATUS_FILTERS.map((opt) => {
              const active = statusFilter === opt.value;
              return (
                <Button
                  key={opt.value}
                  variant={active ? "primary" : "outline"}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setStatusFilter(opt.value);
                    resetPage();
                  }}
                >
                  {opt.label}
                </Button>
              );
            })}
          </div>

          <Input
            placeholder={t("Search run #, product, or SKU...")}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              resetPage();
            }}
            className="h-9 w-full md:w-64 text-xs"
            aria-label="Search production run history"
          />
        </div>

        {isLoading ? (
          <div className="p-4">
            <SkeletonTable rows={8} columns={10} />
          </div>
        ) : isError ? (
          <div className="p-4">
            <ErrorState
              title="Failed to load production run history"
              description={
                error instanceof Error
                  ? error.message
                  : "An unexpected server error occurred."
              }
              error={error}
              onRetry={() => refetch()}
            />
          </div>
        ) : runs.length === 0 ? (
          <EmptyState
            title="No production runs found"
            description={
              searchQuery.trim() || statusFilter !== "ALL"
                ? "Try clearing your status filter or search query."
                : "No production batches have been recorded yet."
            }
            className="min-h-44 py-10"
            action={
              searchQuery.trim() || statusFilter !== "ALL" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStatusFilter("ALL");
                    setSearchQuery("");
                    resetPage();
                  }}
                >
                  Reset filters
                </Button>
              ) : canRecordProduction ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewBatchModal(true)}
                  className="gap-2"
                >
                  <PlusCircleIcon className="h-4 w-4" aria-hidden="true" />
                  Record first batch
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="p-4">
            <DataTable
              tableId="production-history"
              data={runs}
              columns={columns}
              getRowId={(r) => r.id}
              ariaLabel="Production run history"
              csvFilename="production-run-history"
              bulkActions={bulkActions}
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

      <RecordProductionBatchDialog
        open={showNewBatchModal}
        onOpenChange={setShowNewBatchModal}
        recipes={recipesData?.recipes ?? []}
        balances={balancesData?.balances ?? []}
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
