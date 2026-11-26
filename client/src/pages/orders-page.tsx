import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { useUrlState } from "@/hooks/use-url-state";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useSyncManager } from "@/offline/use-offline";
import { formatINR, formatDateTime } from "@/lib/formatters";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, SkeletonTable, ErrorState } from "@/components/ui/loading-error-empty";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{
    orders: SalesOrder[];
  }>({
    queryKey: ["sales-orders"],
    queryFn: async () => {
      const res = await apiClient.get("/sales/orders");
      return res.data;
    },
  });

  const orders = data?.orders ?? [];
  const filteredOrders = orders.filter((order) => {
    if (statusFilter !== "ALL") {
      if (statusFilter === "SUBMITTED") {
        if (order.status !== "SUBMITTED" && order.status !== "UNDER_REVIEW") {
          return false;
        }
      } else if (order.status !== statusFilter) {
        return false;
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchNum = order.orderNumber.toLowerCase().includes(q);
      const matchCust =
        order.customer.name.toLowerCase().includes(q) ||
        order.customer.code.toLowerCase().includes(q);
      if (!matchNum && !matchCust) return false;
    }
    return true;
  });

  const draftOrders = orders.filter((o) => o.status === "DRAFT");
  const submittedCount = orders.filter(
    (o) => o.status === "SUBMITTED" || o.status === "UNDER_REVIEW",
  ).length;
  const approvedCount = orders.filter((o) => o.status === "APPROVED").length;

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
              onClick={() => setStatusFilter(f.value)}
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
            onChange={(e) => setSearchQuery(e.target.value)}
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
          <div className="hidden sm:block overflow-x-auto rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  {!isSalesman && <TableHead>Salesman</TableHead>}
                  <TableHead>Order status</TableHead>
                  <TableHead>Fulfilment</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Next action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium tabular-nums">
                      <Link
                        to={`/orders/${order.id}`}
                        className="text-primary hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{order.customer.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {order.customer.code} • {order.deliveryState}
                      </div>
                    </TableCell>
                    {!isSalesman && (
                      <TableCell className="text-sm text-muted-foreground">
                        {order.salesman.name}
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-1.5">
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
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {order.fulfilmentStatus.replaceAll("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatINR(order.totalAmount)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {formatDateTime(order.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        to={`/orders/${order.id}`}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        {getNextActionLabel(order, user?.role)}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
