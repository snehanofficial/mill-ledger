import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import type { PaginationMeta } from "@mill-ledger/shared";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { useUrlState } from "@/hooks/use-url-state";
import { usePagination } from "@/hooks/use-pagination";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useSyncManager } from "@/offline/use-offline";
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
import {
  AlertTriangleIcon,
  PlusCircleIcon,
  RefreshCwIcon,
  SearchIcon,
} from "lucide-react";

interface SalesOrder {
  id: string;
  orderNumber: string;
  status: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "CLOSED";
  fulfilmentStatus: "UNFULFILLED" | "PARTIALLY_FULFILLED" | "FULFILLED";
  deliveryState: string;
  totalAmount: number;
  totalShortage?: number;
  createdAt: string;
  customer: {
    id: string;
    code: string;
    name: string;
    state: string;
  };
  salesman: {
    name: string;
  };
  invoices?: Array<{ id: string; invoiceNumber: string }>;
}

const STATUS_FILTERS = [
  { value: "ALL", label: "All" },
  { value: "SUBMITTED", label: "Needs review" },
  { value: "APPROVED", label: "Approved" },
  { value: "DRAFT", label: "Drafts" },
  { value: "REJECTED", label: "Rejected" },
] as const;

function getNextActionLabel(order: SalesOrder, role?: string): string {
  if (role === "ADMIN") {
    if (order.status === "SUBMITTED" || order.status === "UNDER_REVIEW") {
      return "Review order";
    }
    if (order.status === "APPROVED" && (!order.invoices || order.invoices.length === 0)) {
      return "Create invoice";
    }
    if (order.status === "APPROVED" && order.fulfilmentStatus !== "FULFILLED") {
      return "Prepare dispatch";
    }
  }
  if (role === "SALESMAN" && order.status === "DRAFT") {
    return "Continue draft";
  }
  return "View detail";
}

export function OrdersPage() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const isSalesman = user?.role === "SALESMAN";
  const isAdmin = user?.role === "ADMIN";
  const canCreateOrder = isSalesman || isAdmin;

  const { pendingCount, conflictCount } = useSyncManager(user?.id);
  const [statusFilter, setStatusFilter] = useUrlState("status", "ALL");
  const [searchQuery, setSearchQuery] = useUrlState("q", "", { debounceMs: 200 });
  const { page, pageSize, offset, setPage, setPageSize, resetPage } =
    usePagination({ defaultPageSize: 20 });

  const serverStatus =
    statusFilter === "SUBMITTED" ? "NEEDS_REVIEW" : statusFilter;

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{
    orders: SalesOrder[];
    pagination: PaginationMeta;
  }>({
    queryKey: ["sales-orders", page, pageSize, serverStatus, searchQuery.trim()],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset),
      });
      if (serverStatus !== "ALL") {
        params.set("status", serverStatus);
      }
      if (searchQuery.trim()) {
        params.set("q", searchQuery.trim());
      }
      const res = await apiClient.get(`/sales/orders?${params.toString()}`);
      return res.data;
    },
    placeholderData: keepPreviousData,
  });

  const orders = data?.orders ?? [];
  const filteredOrders = orders;

  const draftOrders = orders.filter((o) => o.status === "DRAFT");
  const submittedCount = orders.filter(
    (o) => o.status === "SUBMITTED" || o.status === "UNDER_REVIEW",
  ).length;
  const approvedCount = orders.filter((o) => o.status === "APPROVED").length;

  const orderColumns = useMemo<ColumnDef<SalesOrder, unknown>[]>(() => {
    const cols: ColumnDef<SalesOrder, unknown>[] = [
      {
        accessorKey: "orderNumber",
        enableHiding: false,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Order #" />
        ),
        cell: ({ row }) => (
          <Link
            to={`/orders/${row.original.id}`}
            className="font-medium text-primary hover:underline tabular-nums whitespace-nowrap"
          >
            {row.original.orderNumber}
          </Link>
        ),
        meta: {
          label: "Order #",
          cellClassName: "whitespace-nowrap",
        } satisfies DataTableColumnMeta<SalesOrder>,
      },
      {
        id: "customer",
        accessorFn: (row) => row.customer.name,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Customer" />
        ),
        cell: ({ row }) => (
          <div className="min-w-[180px]">
            <div className="font-medium">{row.original.customer.name}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.customer.code} • {row.original.deliveryState}
            </div>
          </div>
        ),
        meta: {
          label: "Customer",
          exportValue: (r) => `${r.customer.name} (${r.customer.code})`,
        } satisfies DataTableColumnMeta<SalesOrder>,
      },
    ];

    if (!isSalesman) {
      cols.push({
        id: "salesman",
        accessorFn: (row) => row.salesman.name,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Salesman" />
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {row.original.salesman.name}
          </span>
        ),
        meta: {
          label: "Salesman",
          exportValue: (r) => r.salesman.name,
        } satisfies DataTableColumnMeta<SalesOrder>,
      });
    }

    cols.push(
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Order status" />
        ),
        cell: ({ row }) => {
          const order = row.original;
          return (
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <Badge variant="outline">
                {order.status.replaceAll("_", " ")}
              </Badge>
              {(order.totalShortage ?? 0) > 0 &&
                (order.status === "SUBMITTED" ||
                  order.status === "UNDER_REVIEW") && (
                  <span
                    className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400"
                    title="Stock shortage"
                  >
                    <AlertTriangleIcon className="size-3.5" aria-hidden="true" />
                    Shortage
                  </span>
                )}
            </div>
          );
        },
        meta: {
          label: "Order status",
          exportValue: (r) => r.status.replaceAll("_", " "),
        } satisfies DataTableColumnMeta<SalesOrder>,
      },
      {
        accessorKey: "fulfilmentStatus",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Fulfilment" />
        ),
        cell: ({ row }) => (
          <Badge variant="outline" className="whitespace-nowrap">
            {row.original.fulfilmentStatus.replaceAll("_", " ")}
          </Badge>
        ),
        meta: {
          label: "Fulfilment",
          exportValue: (r) => r.fulfilmentStatus.replaceAll("_", " "),
        } satisfies DataTableColumnMeta<SalesOrder>,
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
        } satisfies DataTableColumnMeta<SalesOrder>,
      },
      {
        id: "createdAt",
        accessorFn: (row) => new Date(row.createdAt).getTime() || 0,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Created" />
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
            {formatDateTime(row.original.createdAt)}
          </span>
        ),
        meta: {
          label: "Created",
          exportValue: (r) => formatDateTime(r.createdAt),
        } satisfies DataTableColumnMeta<SalesOrder>,
      },
      {
        id: "actions",
        enableSorting: false,
        enableHiding: false,
        header: () => <span>Next action</span>,
        cell: ({ row }) => (
          <Link
            to={`/orders/${row.original.id}`}
            className="text-xs font-medium text-primary hover:underline whitespace-nowrap"
          >
            {getNextActionLabel(row.original, user?.role)}
          </Link>
        ),
        meta: {
          label: "Next action",
          align: "right",
        } satisfies DataTableColumnMeta<SalesOrder>,
      },
    );

    return cols;
  }, [isSalesman, user?.role]);

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={
          isSalesman
            ? "My work & orders"
            : isAdmin
              ? "Order inbox"
              : "Sales orders"
        }
        description={
          isSalesman
            ? "Create orders for your assigned customers and track factory approval and dispatch."
            : isAdmin
              ? "Review submitted orders, verify available-to-promise stock, and approve or reject."
              : "Read-only register of wholesale sales orders."
        }
        primaryAction={
          canCreateOrder ? (
            <Button
              variant="primary"
              onClick={() => navigate("/orders/new")}
              className="gap-1.5"
            >
              <PlusCircleIcon className="size-4" aria-hidden="true" />
              New order
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

      {/* Compact Operational Context Strip */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="rounded-md border border-border bg-card px-2.5 py-1.5">
          Drafts: <strong className="tabular-nums">{draftOrders.length}</strong>
        </span>
        <span className="rounded-md border border-border bg-card px-2.5 py-1.5">
          Awaiting review: <strong className="tabular-nums">{submittedCount}</strong>
        </span>
        <span className="rounded-md border border-border bg-card px-2.5 py-1.5">
          Approved: <strong className="tabular-nums">{approvedCount}</strong>
        </span>
        {isSalesman && draftOrders.length > 0 && (
          <Link
            to={`/orders/new?draftId=${draftOrders[0].id}`}
            className="rounded-md border border-primary/40 bg-primary/5 px-2.5 py-1.5 font-medium text-primary hover:bg-primary/10"
          >
            Continue draft ({draftOrders[0].orderNumber})
          </Link>
        )}
        {(pendingCount > 0 || conflictCount > 0) && (
          <span className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            Device outbox: {pendingCount} pending{conflictCount > 0 ? `, ${conflictCount} conflict` : ""} (use header Sync indicator)
          </span>
        )}
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by order status">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={statusFilter === f.value ? "primary" : "outline"}
              size="sm"
              onClick={() => {
                setStatusFilter(f.value);
                resetPage();
              }}
              className="h-8 text-xs"
            >
              {f.label}
            </Button>
          ))}
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
            placeholder="Search order # or customer..."
            aria-label="Search orders"
            className="h-9 pl-8"
          />
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable rows={6} columns={5} />
      ) : isError ? (
        <ErrorState
          title="Failed to load orders"
          description={extractErrorMessage(error)}
          onRetry={() => refetch()}
        />
      ) : filteredOrders.length === 0 ? (
        <EmptyState
          title="No matching orders"
          description={
            orders.length === 0
              ? "No sales orders have been recorded yet."
              : "Adjust your status filter or search query to see orders."
          }
          action={
            canCreateOrder && orders.length === 0 ? (
              <Button variant="primary" onClick={() => navigate("/orders/new")}>
                Create first order
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Mobile card list (320px-639px) */}
          <div className="flex flex-col gap-3 sm:hidden">
            {filteredOrders.map((order) => (
              <Link
                key={order.id}
                to={`/orders/${order.id}`}
                className="block rounded-lg border border-border bg-card p-3.5 space-y-2 hover:border-primary/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-foreground tabular-nums">
                    {order.orderNumber}
                  </span>
                  <Badge variant="outline">{order.status.replaceAll("_", " ")}</Badge>
                </div>
                <div className="text-sm text-foreground">{order.customer.name}</div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{order.fulfilmentStatus.replaceAll("_", " ")}</span>
                  <span className="font-semibold text-foreground tabular-nums">
                    {formatINR(order.totalAmount)}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop / Tablet table */}
          <div className="hidden sm:block">
            <DataTable
              tableId="sales-orders"
              data={filteredOrders}
              columns={orderColumns}
              getRowId={(r) => r.id}
              ariaLabel="Sales orders"
              csvFilename="sales-orders"
            />
          </div>

          <DataPagination
            pagination={data?.pagination}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            isFetching={isFetching}
            itemLabel="orders"
          />
        </>
      )}
    </div>
  );
}
