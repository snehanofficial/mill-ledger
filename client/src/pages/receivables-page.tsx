import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import type { PaginationMeta } from "@mill-ledger/shared";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { assertCollectionResponse } from "@/lib/api-contracts";
import { useUrlState } from "@/hooks/use-url-state";
import { usePagination } from "@/hooks/use-pagination";
import { formatINR } from "@/lib/formatters";
import { PageHeader } from "@/components/ui/page-header";
import { DataPagination } from "@/components/ui/data-pagination";
import {
  DataTable,
  DataTableColumnHeader,
  type DataTableColumnMeta,
} from "@/components/ui/data-table";
import { EmptyState, SkeletonTable, ErrorState } from "@/components/ui/loading-error-empty";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCwIcon, SearchIcon } from "lucide-react";

interface CustomerReceivable {
  customerId: string;
  customerCode: string;
  customerName: string;
  totalInvoiced: number;
  totalCredited?: number;
  totalPaid: number;
  netOutstanding: number;
  unallocatedCredit?: number;
  ageing?: {
    current: number;
    days31to60: number;
    days61to90: number;
    over90: number;
  };
}

export function ReceivablesPage() {
  const [searchQuery, setSearchQuery] = useUrlState("q", "", { debounceMs: 200 });
  const [onlyDue, setOnlyDue] = useUrlState("due", "ALL");
  const { page, pageSize, offset, setPage, setPageSize, resetPage } =
    usePagination({ defaultPageSize: 20 });

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{
    receivables: CustomerReceivable[];
    totalOutstanding?: number;
    pagination: PaginationMeta;
  }>({
    queryKey: ["receivables-summary", page, pageSize, onlyDue, searchQuery.trim()],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset),
      });
      if (onlyDue === "DUE") {
        params.set("due", "DUE");
      }
      if (searchQuery.trim()) {
        params.set("q", searchQuery.trim());
      }
      const res = await apiClient.get(
        `/payments/receivables/summary?${params.toString()}`,
      );
      return assertCollectionResponse(
        res.data,
        "receivables",
        "/payments/receivables/summary",
      );
    },
    placeholderData: keepPreviousData,
  });

  const rows = data?.receivables ?? [];
  const filtered = rows;
  const totalOutstanding =
    data?.totalOutstanding ??
    rows.reduce((s, r) => s + Number(r.netOutstanding || 0), 0);

  const receivableColumns = useMemo<ColumnDef<CustomerReceivable, unknown>[]>(
    () => [
      {
        accessorKey: "customerName",
        enableHiding: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Customer" />
        ),
        cell: ({ row }) => (
          <div className="min-w-[160px]">
            <div className="font-medium">{row.original.customerName}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.customerCode}
            </div>
          </div>
        ),
        meta: {
          label: "Customer",
          exportValue: (r) => `${r.customerName} (${r.customerCode})`,
        } satisfies DataTableColumnMeta<CustomerReceivable>,
      },
      {
        id: "totalInvoiced",
        accessorFn: (row) => Number(row.totalInvoiced) || 0,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Invoiced" align="right" />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums whitespace-nowrap">
            {formatINR(row.original.totalInvoiced)}
          </span>
        ),
        meta: {
          label: "Invoiced",
          align: "right",
          exportValue: (r) => Number(r.totalInvoiced),
        } satisfies DataTableColumnMeta<CustomerReceivable>,
      },
      {
        id: "totalPaid",
        accessorFn: (row) => Number(row.totalPaid) || 0,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Collected"
            align="right"
          />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums whitespace-nowrap">
            {formatINR(row.original.totalPaid)}
          </span>
        ),
        meta: {
          label: "Collected",
          align: "right",
          exportValue: (r) => Number(r.totalPaid),
        } satisfies DataTableColumnMeta<CustomerReceivable>,
      },
      {
        id: "netOutstanding",
        accessorFn: (row) => Number(row.netOutstanding) || 0,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Net outstanding"
            align="right"
          />
        ),
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums whitespace-nowrap">
            {formatINR(row.original.netOutstanding)}
          </span>
        ),
        meta: {
          label: "Net outstanding",
          align: "right",
          exportValue: (r) => Number(r.netOutstanding),
        } satisfies DataTableColumnMeta<CustomerReceivable>,
      },
      {
        id: "unallocatedCredit",
        accessorFn: (row) => Number(row.unallocatedCredit ?? 0),
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Unallocated credit"
            align="right"
          />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground whitespace-nowrap">
            {formatINR(row.original.unallocatedCredit ?? 0)}
          </span>
        ),
        meta: {
          label: "Unallocated credit",
          align: "right",
          exportValue: (r) => Number(r.unallocatedCredit ?? 0),
        } satisfies DataTableColumnMeta<CustomerReceivable>,
      },
      {
        id: "actions",
        enableSorting: false,
        enableHiding: false,
        header: () => <span>Ledger</span>,
        cell: ({ row }) => (
          <Link
            to={`/receivables/${row.original.customerId}`}
            className="text-xs font-medium text-primary hover:underline whitespace-nowrap"
          >
            Open ledger
          </Link>
        ),
        meta: {
          label: "Ledger",
          align: "right",
        } satisfies DataTableColumnMeta<CustomerReceivable>,
      },
    ],
    [],
  );

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Customer balances"
        description="Derived customer receivables, open invoice ageing, and unallocated advances."
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
            Refresh
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant={onlyDue === "ALL" ? "primary" : "outline"}
            size="sm"
            onClick={() => {
              setOnlyDue("ALL");
              resetPage();
            }}
            className="h-8 text-xs"
          >
            All customers
          </Button>
          <Button
            variant={onlyDue === "DUE" ? "primary" : "outline"}
            size="sm"
            onClick={() => {
              setOnlyDue("DUE");
              resetPage();
            }}
            className="h-8 text-xs"
          >
            With balance due
          </Button>
          <span className="ml-2 text-xs text-muted-foreground">
            Total due:{" "}
            <strong className="text-foreground tabular-nums">
              {formatINR(totalOutstanding)}
            </strong>
          </span>
        </div>

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
            placeholder="Search customer..."
            aria-label="Search customer balances"
            className="h-9 pl-8"
          />
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable rows={6} columns={6} />
      ) : isError ? (
        <ErrorState
          title="Unable to load customer balances"
          description={extractErrorMessage(error)}
          onRetry={() => refetch()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No matching customer balances"
          description="Customer balances are derived automatically from posted invoices, credit notes, and payments."
        />
      ) : (
        <>
          <DataTable
            tableId="receivables-summary"
            data={filtered}
            columns={receivableColumns}
            getRowId={(r) => r.customerId}
            ariaLabel="Customer balances"
            csvFilename="customer-balances"
          />

          <DataPagination
            pagination={data?.pagination}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            isFetching={isFetching}
            itemLabel="customers"
          />
        </>
      )}
    </div>
  );
}
