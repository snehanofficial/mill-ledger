import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import type { PaginationMeta } from "@mill-ledger/shared";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useUrlState } from "@/hooks/use-url-state";
import { usePagination } from "@/hooks/use-pagination";
import { formatINR, formatDateTime } from "@/lib/formatters";
import { PageHeader } from "@/components/ui/page-header";
import { DataPagination } from "@/components/ui/data-pagination";
import {
  DataTable,
  DataTableColumnHeader,
  type DataTableColumnMeta,
} from "@/components/ui/data-table";
import { EmptyState, SkeletonTable, ErrorState } from "@/components/ui/loading-error-empty";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusCircleIcon, RefreshCwIcon, SearchIcon } from "lucide-react";

interface SalesInvoice {
  id: string;
  invoiceNumber: string;
  financialYear: string;
  customerNameSnapshot: string;
  deliveryStateSnapshot: string;
  status: "DRAFT" | "POSTED" | "CANCELLED_BY_CREDIT_NOTE" | "PAID" | "PARTIALLY_PAID";
  taxableAmount: number;
  totalTaxAmount: number;
  totalAmount: number;
  outstandingAmount: number;
  postedAt: string;
}

export function InvoicesPage() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const canCreateInvoice = user?.role === "ADMIN";
  const [searchQuery, setSearchQuery] = useUrlState("q", "", { debounceMs: 200 });
  const [statusFilter, setStatusFilter] = useUrlState("status", "ALL");
  const { page, pageSize, offset, setPage, setPageSize, resetPage } =
    usePagination({ defaultPageSize: 20 });

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{
    invoices: SalesInvoice[];
    pagination: PaginationMeta;
  }>({
    queryKey: ["sales-invoices", page, pageSize, statusFilter, searchQuery.trim()],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset),
      });
      if (statusFilter !== "ALL") {
        params.set("status", statusFilter);
      }
      if (searchQuery.trim()) {
        params.set("q", searchQuery.trim());
      }
      const res = await apiClient.get(`/finance/invoices?${params.toString()}`);
      return res.data;
    },
    placeholderData: keepPreviousData,
  });

  const { data: approvedOrdersData } = useQuery<{
    orders: Array<{
      id: string;
      orderNumber: string;
      totalAmount: number;
      customer: { name: string };
      invoices?: Array<{ id: string }>;
    }>;
  }>({
    queryKey: ["approved-orders-for-invoice"],
    queryFn: async () => {
      const res = await apiClient.get("/sales/orders?status=APPROVED");
      return res.data;
    },
    enabled: canCreateInvoice,
  });

  const awaitingInvoice = (approvedOrdersData?.orders ?? []).filter(
    (o) => !o.invoices || o.invoices.length === 0,
  );

  const invoices = data?.invoices ?? [];
  const filtered = invoices;

  const invoiceColumns = useMemo<ColumnDef<SalesInvoice, unknown>[]>(
    () => [
      {
        accessorKey: "invoiceNumber",
        enableHiding: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Invoice #" />
        ),
        cell: ({ row }) => (
          <Link
            to={`/invoices/${row.original.id}`}
            className="font-medium text-primary hover:underline tabular-nums whitespace-nowrap"
          >
            {row.original.invoiceNumber}
          </Link>
        ),
        meta: { label: "Invoice #" } satisfies DataTableColumnMeta<SalesInvoice>,
      },
      {
        accessorKey: "customerNameSnapshot",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Customer" />
        ),
        cell: ({ row }) => (
          <span className="font-medium min-w-[160px] block">
            {row.original.customerNameSnapshot}
          </span>
        ),
        meta: { label: "Customer" } satisfies DataTableColumnMeta<SalesInvoice>,
      },
      {
        accessorKey: "deliveryStateSnapshot",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Place of supply" />
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {row.original.deliveryStateSnapshot}
          </span>
        ),
        meta: {
          label: "Place of supply",
        } satisfies DataTableColumnMeta<SalesInvoice>,
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => (
          <Badge variant="outline" className="whitespace-nowrap">
            {row.original.status.replaceAll("_", " ")}
          </Badge>
        ),
        meta: {
          label: "Status",
          exportValue: (r) => r.status.replaceAll("_", " "),
        } satisfies DataTableColumnMeta<SalesInvoice>,
      },
      {
        id: "taxableAmount",
        accessorFn: (row) => Number(row.taxableAmount) || 0,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Taxable" align="right" />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums whitespace-nowrap">
            {formatINR(row.original.taxableAmount)}
          </span>
        ),
        meta: {
          label: "Taxable",
          align: "right",
          exportValue: (r) => Number(r.taxableAmount),
        } satisfies DataTableColumnMeta<SalesInvoice>,
      },
      {
        id: "totalTaxAmount",
        accessorFn: (row) => Number(row.totalTaxAmount) || 0,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Tax" align="right" />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums whitespace-nowrap">
            {formatINR(row.original.totalTaxAmount)}
          </span>
        ),
        meta: {
          label: "Tax",
          align: "right",
          exportValue: (r) => Number(r.totalTaxAmount),
        } satisfies DataTableColumnMeta<SalesInvoice>,
      },
      {
        id: "totalAmount",
        accessorFn: (row) => Number(row.totalAmount) || 0,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Total" align="right" />
        ),
        cell: ({ row }) => (
          <span className="font-medium tabular-nums whitespace-nowrap">
            {formatINR(row.original.totalAmount)}
          </span>
        ),
        meta: {
          label: "Total",
          align: "right",
          exportValue: (r) => Number(r.totalAmount),
        } satisfies DataTableColumnMeta<SalesInvoice>,
      },
      {
        id: "outstandingAmount",
        accessorFn: (row) => Number(row.outstandingAmount) || 0,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Outstanding"
            align="right"
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium tabular-nums whitespace-nowrap">
            {formatINR(row.original.outstandingAmount)}
          </span>
        ),
        meta: {
          label: "Outstanding",
          align: "right",
          exportValue: (r) => Number(r.outstandingAmount),
        } satisfies DataTableColumnMeta<SalesInvoice>,
      },
      {
        id: "postedAt",
        accessorFn: (row) => new Date(row.postedAt).getTime() || 0,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Posted" />
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
            {formatDateTime(row.original.postedAt)}
          </span>
        ),
        meta: {
          label: "Posted",
          exportValue: (r) => formatDateTime(r.postedAt),
        } satisfies DataTableColumnMeta<SalesInvoice>,
      },
    ],
    [],
  );

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Invoices"
        description="Immutable GST tax invoices and approved orders awaiting billing."
        primaryAction={
          canCreateInvoice ? (
            <Button
              variant="primary"
              onClick={() => navigate("/invoices/new")}
              className="gap-1.5"
            >
              <PlusCircleIcon className="size-4" aria-hidden="true" />
              Create invoice
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
            Refresh
          </Button>
        }
      />

      {canCreateInvoice && awaitingInvoice.length > 0 && (
        <section className="rounded-lg border border-amber-300 bg-amber-50/60 p-3.5 dark:border-amber-800 dark:bg-amber-950/30 space-y-2">
          <div className="text-xs font-semibold text-amber-900 dark:text-amber-200">
            Approved orders awaiting GST invoice ({awaitingInvoice.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {awaitingInvoice.map((ord) => (
              <Link
                key={ord.id}
                to={`/invoices/new?orderId=${ord.id}`}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:border-primary/50"
              >
                <span>{ord.orderNumber}</span>
                <span className="text-muted-foreground">{ord.customer.name}</span>
                <span className="tabular-nums font-semibold">
                  {formatINR(ord.totalAmount)}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {["ALL", "POSTED", "PARTIALLY_PAID", "PAID", "CANCELLED_BY_CREDIT_NOTE"].map(
            (st) => (
              <Button
                key={st}
                variant={statusFilter === st ? "primary" : "outline"}
                size="sm"
                onClick={() => {
                  setStatusFilter(st);
                  resetPage();
                }}
                className="h-8 text-xs"
              >
                {st === "ALL" ? "All" : st.replaceAll("_", " ")}
              </Button>
            ),
          )}
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
            placeholder="Search invoice # or customer..."
            aria-label="Search invoices"
            className="h-9 pl-8"
          />
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable rows={6} columns={6} />
      ) : isError ? (
        <ErrorState
          title="Failed to load invoices"
          description={extractErrorMessage(error)}
          onRetry={() => refetch()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No invoices found"
          description="Posted GST invoices will appear here."
        />
      ) : (
        <>
        <DataTable
          tableId="sales-invoices"
          data={filtered}
          columns={invoiceColumns}
          getRowId={(r) => r.id}
          ariaLabel="Sales invoices"
          csvFilename="sales-invoices"
        />

        <DataPagination
          pagination={data?.pagination}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          isFetching={isFetching}
          itemLabel="invoices"
        />
        </>
      )}
    </div>
  );
}
