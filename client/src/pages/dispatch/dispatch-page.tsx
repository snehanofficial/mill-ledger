import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ColumnDef } from "@tanstack/react-table";
import type { PaginationMeta } from "@mill-ledger/shared";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { assertCollectionResponse } from "@/lib/api-contracts";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useUrlState } from "@/hooks/use-url-state";
import { usePagination } from "@/hooks/use-pagination";
import { useFormatters } from "@/hooks/use-formatters";
import { getStatusLabel } from "@/lib/enum-labels";
import { PageHeader } from "@/components/ui/page-header";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCwIcon, SearchIcon, TruckIcon } from "lucide-react";

interface Dispatch {
  id: string;
  dispatchNumber: string;
  dispatchedAt: string;
  vehicleNumber: string | null;
  driverName: string | null;
  status: "DRAFT" | "POSTED" | "CANCELLED";
  salesOrder?: {
    id: string;
    orderNumber: string;
    customer?: { name: string; state: string };
  };
}

export function DispatchPage() {
  const { t } = useTranslation(["finance", "common"]);
  const { formatDateTime } = useFormatters();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const canDispatch = user?.role === "ADMIN";
  const [searchQuery, setSearchQuery] = useUrlState("q", "", {
    debounceMs: 200,
  });
  const { page, pageSize, offset, setPage, setPageSize, resetPage } =
    usePagination({ defaultPageSize: 20 });

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{
    dispatches: Dispatch[];
    pagination: PaginationMeta;
  }>({
    queryKey: ["dispatches", page, pageSize, searchQuery.trim()],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset),
      });
      if (searchQuery.trim()) {
        params.set("q", searchQuery.trim());
      }
      const res = await apiClient.get(`/sales/dispatches?${params.toString()}`);
      return assertCollectionResponse(
        res.data,
        "dispatches",
        "/sales/dispatches",
      );
    },
    placeholderData: keepPreviousData,
  });

  const { data: ordersData } = useQuery<{
    orders: Array<{
      id: string;
      orderNumber: string;
      status: string;
      fulfilmentStatus: string;
      customer?: { name: string };
    }>;
  }>({
    queryKey: ["sales-orders", "eligible-dispatch"],
    queryFn: async () => {
      const res = await apiClient.get("/sales/orders");
      return assertCollectionResponse(res.data, "orders", "/sales/orders");
    },
    enabled: canDispatch,
  });

  const readyToDispatch = (ordersData?.orders ?? []).filter(
    (o) => o.status === "APPROVED" && o.fulfilmentStatus !== "FULFILLED",
  );

  const dispatches = data?.dispatches ?? [];
  const filtered = dispatches;

  const dispatchColumns = useMemo<ColumnDef<Dispatch, unknown>[]>(
    () => [
      {
        accessorKey: "dispatchNumber",
        enableHiding: false,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("finance:dispatch.dispatchNumber")}
          />
        ),
        cell: ({ row }) => (
          <Link
            to={`/dispatch/${row.original.id}`}
            className="font-medium text-primary hover:underline tabular-nums whitespace-nowrap"
          >
            {row.original.dispatchNumber}
          </Link>
        ),
        meta: {
          label: t("finance:dispatch.dispatchNumber"),
        } satisfies DataTableColumnMeta<Dispatch>,
      },
      {
        id: "orderNumber",
        accessorFn: (row) => row.salesOrder?.orderNumber ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("common:terms.orderNumber")}
          />
        ),
        cell: ({ row }) =>
          row.original.salesOrder ? (
            <Link
              to={`/orders/${row.original.salesOrder.id}`}
              className="hover:underline tabular-nums whitespace-nowrap"
            >
              {row.original.salesOrder.orderNumber}
            </Link>
          ) : (
            "—"
          ),
        meta: {
          label: t("common:terms.orderNumber"),
        } satisfies DataTableColumnMeta<Dispatch>,
      },
      {
        id: "customer",
        accessorFn: (row) => row.salesOrder?.customer?.name ?? "",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("common:terms.customer")}
          />
        ),
        cell: ({ row }) => (
          <span>{row.original.salesOrder?.customer?.name ?? "—"}</span>
        ),
        meta: {
          label: t("common:terms.customer"),
        } satisfies DataTableColumnMeta<Dispatch>,
      },
      {
        id: "vehicleDriver",
        accessorFn: (row) =>
          `${row.vehicleNumber || ""} ${row.driverName || ""}`.trim(),
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("finance:dispatch.vehicleDriver")}
          />
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.vehicleNumber || "—"}{" "}
            {row.original.driverName ? `(${row.original.driverName})` : ""}
          </span>
        ),
        meta: {
          label: t("finance:dispatch.vehicleDriver"),
        } satisfies DataTableColumnMeta<Dispatch>,
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("common:terms.status")}
          />
        ),
        cell: ({ row }) => (
          <Badge variant="outline" className="whitespace-nowrap">
            {getStatusLabel(row.original.status)}
          </Badge>
        ),
        meta: {
          label: t("common:terms.status"),
        } satisfies DataTableColumnMeta<Dispatch>,
      },
      {
        id: "dispatchedAt",
        accessorFn: (row) => new Date(row.dispatchedAt).getTime() || 0,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("finance:dispatch.dispatchedAt")}
          />
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
            {formatDateTime(row.original.dispatchedAt)}
          </span>
        ),
        meta: {
          label: t("finance:dispatch.dispatchedAt"),
          exportValue: (r) => formatDateTime(r.dispatchedAt),
        } satisfies DataTableColumnMeta<Dispatch>,
      },
    ],
    [t, formatDateTime],
  );

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t("finance:dispatch.readyTitle")}
        description={t("finance:dispatch.subtitle")}
        primaryAction={
          canDispatch ? (
            <Button
              variant="primary"
              onClick={() => navigate("/dispatch/new")}
              className="gap-1.5"
            >
              <TruckIcon className="size-4" aria-hidden="true" />
              {t("finance:dispatch.prepareBtn")}
            </Button>
          ) : null
        }
        secondaryActions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5"
          >
            <RefreshCwIcon
              className={`size-4 ${isFetching ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            {t("common:actions.refresh")}
          </Button>
        }
      />

      {canDispatch && readyToDispatch.length > 0 && (
        <section className="rounded-lg border border-amber-300 bg-amber-50/60 p-3.5 dark:border-amber-800 dark:bg-amber-950/30 space-y-2">
          <div className="text-xs font-semibold text-amber-900 dark:text-amber-200">
            {t("finance:dispatch.awaitingDispatch", {
              count: readyToDispatch.length,
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            {readyToDispatch.map((ord) => (
              <Link
                key={ord.id}
                to={`/dispatch/new?orderId=${ord.id}`}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:border-primary/50"
              >
                <span>{ord.orderNumber}</span>
                <span className="text-muted-foreground">
                  {ord.customer?.name}
                </span>
                <Badge variant="outline" className="h-4 text-[10px]">
                  {getStatusLabel(ord.fulfilmentStatus)}
                </Badge>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="flex justify-end">
        <div className="relative w-full sm:w-64">
          <SearchIcon
            className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              resetPage();
            }}
            placeholder={t("finance:dispatch.searchPlaceholder")}
            aria-label={t("finance:dispatch.searchPlaceholder")}
            className="h-9 pl-8"
          />
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable rows={5} columns={5} />
      ) : isError ? (
        <ErrorState
          title={t("finance:dispatch.failedToLoad")}
          description={extractErrorMessage(error)}
          onRetry={() => refetch()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={t("finance:dispatch.noDispatches")}
          description={t("finance:dispatch.noDispatchesDesc")}
        />
      ) : (
        <>
          <DataTable
            tableId="dispatches"
            data={filtered}
            columns={dispatchColumns}
            getRowId={(r) => r.id}
            ariaLabel={t("finance:dispatch.header")}
            csvFilename="dispatches"
          />

          <DataPagination
            pagination={data?.pagination}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            isFetching={isFetching}
            itemLabel={t("finance:dispatch.itemLabel")}
          />
        </>
      )}
    </div>
  );
}
