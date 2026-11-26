import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useUrlState } from "@/hooks/use-url-state";
import { formatDateTime } from "@/lib/formatters";
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
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const canDispatch = user?.role === "ADMIN";
  const [searchQuery, setSearchQuery] = useUrlState("q", "", { debounceMs: 200 });

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{
    dispatches: Dispatch[];
  }>({
    queryKey: ["dispatches"],
    queryFn: async () => {
      const res = await apiClient.get("/sales/dispatches");
      return res.data;
    },
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
      return res.data;
    },
    enabled: canDispatch,
  });

  const readyToDispatch = (ordersData?.orders ?? []).filter(
    (o) => o.status === "APPROVED" && o.fulfilmentStatus !== "FULFILLED",
  );

  const dispatches = data?.dispatches ?? [];
  const filtered = dispatches.filter((d) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      d.dispatchNumber.toLowerCase().includes(q) ||
      (d.salesOrder?.orderNumber ?? "").toLowerCase().includes(q) ||
      (d.salesOrder?.customer?.name ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Ready to dispatch"
        description="Physical finished-goods dispatches, partial fulfilment, and sales returns."
        primaryAction={
          canDispatch ? (
            <Button
              variant="primary"
              onClick={() => navigate("/dispatch/new")}
              className="gap-1.5"
            >
              <TruckIcon className="size-4" aria-hidden="true" />
              Prepare dispatch
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

      {canDispatch && readyToDispatch.length > 0 && (
        <section className="rounded-lg border border-amber-300 bg-amber-50/60 p-3.5 dark:border-amber-800 dark:bg-amber-950/30 space-y-2">
          <div className="text-xs font-semibold text-amber-900 dark:text-amber-200">
            Orders awaiting physical dispatch ({readyToDispatch.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {readyToDispatch.map((ord) => (
              <Link
                key={ord.id}
                to={`/dispatch/new?orderId=${ord.id}`}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:border-primary/50"
              >
                <span>{ord.orderNumber}</span>
                <span className="text-muted-foreground">{ord.customer?.name}</span>
                <Badge variant="outline" className="h-4 text-[10px]">
                  {ord.fulfilmentStatus.replaceAll("_", " ")}
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
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search dispatch # or order #..."
            aria-label="Search dispatches"
            className="h-9 pl-8"
          />
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable rows={5} columns={5} />
      ) : isError ? (
        <ErrorState
          title="Failed to load dispatches"
          description={extractErrorMessage(error)}
          onRetry={() => refetch()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No dispatches recorded"
          description="Posted dispatches will appear here once approved orders are fulfilled."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dispatch #</TableHead>
                <TableHead>Order #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Vehicle / Driver</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dispatched at</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium tabular-nums">
                    <Link
                      to={`/dispatch/${d.id}`}
                      className="text-primary hover:underline"
                    >
                      {d.dispatchNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {d.salesOrder ? (
                      <Link
                        to={`/orders/${d.salesOrder.id}`}
                        className="hover:underline"
                      >
                        {d.salesOrder.orderNumber}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{d.salesOrder?.customer?.name ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {d.vehicleNumber || "—"} {d.driverName ? `(${d.driverName})` : ""}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{d.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {formatDateTime(d.dispatchedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
