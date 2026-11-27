import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import type { PaginationMeta } from "@mill-ledger/shared";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { assertCollectionResponse } from "@/lib/api-contracts";
import { usePagination } from "@/hooks/use-pagination";
import { formatINR, formatQuantity, formatDateTime } from "@/lib/formatters";
import { RecordHeader } from "@/components/ui/page-header";
import { DataPagination } from "@/components/ui/data-pagination";
import {
  DataTable,
  DataTableColumnHeader,
  type DataTableColumnMeta,
} from "@/components/ui/data-table";
import {
  ErrorState,
  EmptyState,
  SkeletonTable,
} from "@/components/ui/loading-error-empty";
import { Badge } from "@/components/ui/badge";

interface LedgerMovement {
  id: string;
  movementType: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  runningBalance: number;
  referenceDocumentType: string | null;
  referenceDocumentId: string | null;
  notes: string | null;
  warehouseName: string;
  postedAt: string;
}

interface StockBalance {
  id: string;
  sku: string;
  name: string;
  category: string;
  onHand: number;
  reserved: number;
  available: number;
  weightedAverageCost: number;
  totalValuation: number;
  baseUom?: { code: string; name: string };
}

function getSourceDocHref(
  type: string | null,
  id: string | null,
): string | null {
  if (!type || !id) return null;
  switch (type) {
    case "PURCHASE_RECEIPT":
      return `/purchases/${id}`;
    case "PRODUCTION_RUN":
      return `/production/runs/${id}`;
    case "DISPATCH":
    case "SALES_DISPATCH":
      return `/dispatch/${id}`;
    default:
      return null;
  }
}

export function StockLedgerPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const { page, pageSize, offset, setPage, setPageSize } = usePagination({
    defaultPageSize: 20,
  });

  const { data: balancesData } = useQuery<{ balances: StockBalance[] }>({
    queryKey: ["inventory-balances", "all-for-ledger"],
    queryFn: async () => {
      const res = await apiClient.get("/inventory/balances?limit=100");
      return assertCollectionResponse(
        res.data,
        "balances",
        "/inventory/balances",
      );
    },
  });

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{
    ledger: LedgerMovement[];
    pagination: PaginationMeta;
  }>({
    queryKey: ["inventory-item-ledger", itemId, page, pageSize],
    queryFn: async () => {
      const endpoint = `/inventory/items/${itemId}/ledger?limit=${pageSize}&offset=${offset}`;
      const res = await apiClient.get(endpoint);
      return assertCollectionResponse(res.data, "ledger", endpoint);
    },
    enabled: Boolean(itemId),
    placeholderData: keepPreviousData,
  });

  const item = balancesData?.balances.find((b) => b.id === itemId);
  const unit = item?.baseUom?.code ?? "units";
  const ledger = data?.ledger ?? [];

  const ledgerColumns = useMemo<ColumnDef<LedgerMovement, unknown>[]>(
    () => [
      {
        id: "postedAt",
        accessorFn: (row) => new Date(row.postedAt).getTime() || 0,
        enableHiding: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Posted at" />
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
            {formatDateTime(row.original.postedAt)}
          </span>
        ),
        meta: {
          label: "Posted at",
          exportValue: (r) => formatDateTime(r.postedAt),
        } satisfies DataTableColumnMeta<LedgerMovement>,
      },
      {
        accessorKey: "movementType",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Type" />
        ),
        cell: ({ row }) => (
          <Badge variant="outline" className="whitespace-nowrap">
            {row.original.movementType.replaceAll("_", " ")}
          </Badge>
        ),
        meta: {
          label: "Type",
          exportValue: (r) => r.movementType.replaceAll("_", " "),
        } satisfies DataTableColumnMeta<LedgerMovement>,
      },
      {
        accessorKey: "warehouseName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Warehouse" />
        ),
        cell: ({ row }) => (
          <span className="text-xs whitespace-nowrap">
            {row.original.warehouseName}
          </span>
        ),
        meta: {
          label: "Warehouse",
        } satisfies DataTableColumnMeta<LedgerMovement>,
      },
      {
        id: "quantity",
        accessorFn: (row) => Number(row.quantity) || 0,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Quantity"
            align="right"
          />
        ),
        cell: ({ row }) => {
          const mov = row.original;
          return (
            <span
              className={`font-medium tabular-nums whitespace-nowrap ${
                mov.quantity >= 0
                  ? "text-emerald-700 dark:text-emerald-400"
                  : "text-destructive"
              }`}
            >
              {mov.quantity >= 0 ? "+" : ""}
              {formatQuantity(mov.quantity, { unit })}
            </span>
          );
        },
        meta: {
          label: "Quantity",
          align: "right",
          exportValue: (r) => Number(r.quantity),
        } satisfies DataTableColumnMeta<LedgerMovement>,
      },
      {
        id: "unitCost",
        accessorFn: (row) => Number(row.unitCost) || 0,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Unit cost"
            align="right"
          />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums whitespace-nowrap">
            {formatINR(row.original.unitCost)}
          </span>
        ),
        meta: {
          label: "Unit cost",
          align: "right",
          exportValue: (r) => Number(r.unitCost),
        } satisfies DataTableColumnMeta<LedgerMovement>,
      },
      {
        id: "runningBalance",
        accessorFn: (row) => Number(row.runningBalance) || 0,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Running balance"
            align="right"
          />
        ),
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums whitespace-nowrap">
            {formatQuantity(row.original.runningBalance, { unit })}
          </span>
        ),
        meta: {
          label: "Running balance",
          align: "right",
          exportValue: (r) => Number(r.runningBalance),
        } satisfies DataTableColumnMeta<LedgerMovement>,
      },
      {
        id: "source",
        accessorFn: (row) => row.referenceDocumentType || row.notes || "",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Source document" />
        ),
        cell: ({ row }) => {
          const mov = row.original;
          const href = getSourceDocHref(
            mov.referenceDocumentType,
            mov.referenceDocumentId,
          );
          return href ? (
            <Link
              to={href}
              className="text-xs text-primary hover:underline whitespace-nowrap"
            >
              {mov.referenceDocumentType?.replaceAll("_", " ")}
            </Link>
          ) : (
            <span className="text-xs text-muted-foreground">
              {mov.notes || mov.referenceDocumentType || "—"}
            </span>
          );
        },
        meta: {
          label: "Source document",
          exportValue: (r) =>
            r.referenceDocumentType?.replaceAll("_", " ") || r.notes || "",
        } satisfies DataTableColumnMeta<LedgerMovement>,
      },
    ],
    [unit],
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-6xl">
      <RecordHeader
        backTo="/stock"
        backLabel="Back to Stock overview"
        reference={item ? `${item.name} (${item.sku})` : "Item stock ledger"}
        subtitle={
          item
            ? `Category: ${item.category.replaceAll("_", " ")} • Base UOM: ${unit}`
            : "Traceable inventory movement ledger"
        }
        statuses={
          item ? (
            <>
              <Badge variant="outline">
                On hand: {formatQuantity(item.onHand, { unit })}
              </Badge>
              <Badge variant="outline">
                Reserved: {formatQuantity(item.reserved, { unit })}
              </Badge>
              <Badge variant="outline">
                ATP: {formatQuantity(item.available, { unit })}
              </Badge>
            </>
          ) : null
        }
      />

      {item && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 text-sm">
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">On hand</div>
            <div className="text-lg font-semibold tabular-nums">
              {formatQuantity(item.onHand, { unit })}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">Reserved</div>
            <div className="text-lg font-semibold tabular-nums">
              {formatQuantity(item.reserved, { unit })}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">Available (ATP)</div>
            <div className="text-lg font-semibold tabular-nums">
              {formatQuantity(item.available, { unit })}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">WAC / Valuation</div>
            <div className="text-lg font-semibold tabular-nums">
              {formatINR(item.weightedAverageCost)}
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
              Total: {formatINR(item.totalValuation)}
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <SkeletonTable rows={6} columns={6} />
      ) : isError ? (
        <ErrorState
          title="Unable to load stock ledger"
          description={extractErrorMessage(error)}
          onRetry={() => refetch()}
        />
      ) : ledger.length === 0 ? (
        <EmptyState
          title="No stock movements recorded"
          description="Movements will appear here as purchases, production runs, dispatches, or adjustments are posted."
        />
      ) : (
        <>
          <DataTable
            tableId="stock-ledger"
            data={ledger}
            columns={ledgerColumns}
            getRowId={(r) => r.id}
            ariaLabel="Item stock ledger"
            csvFilename={`stock-ledger-${item?.sku || itemId || "item"}`}
          />

          <DataPagination
            pagination={data?.pagination}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            isFetching={isFetching}
            itemLabel="movements"
          />
        </>
      )}
    </div>
  );
}
