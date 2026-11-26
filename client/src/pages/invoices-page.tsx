import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useUrlState } from "@/hooks/use-url-state";
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

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{
    invoices: SalesInvoice[];
  }>({
    queryKey: ["sales-invoices"],
    queryFn: async () => {
      const res = await apiClient.get("/finance/invoices?limit=100&offset=0");
      return res.data;
    },
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
  const filtered = invoices.filter((inv) => {
    if (statusFilter !== "ALL" && inv.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      if (
        !inv.invoiceNumber.toLowerCase().includes(q) &&
        !inv.customerNameSnapshot.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

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
                onClick={() => setStatusFilter(st)}
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
            onChange={(e) => setSearchQuery(e.target.value)}
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
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Place of supply</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Taxable</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Posted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium tabular-nums">
                    <Link
                      to={`/invoices/${inv.id}`}
                      className="text-primary hover:underline"
                    >
                      {inv.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{inv.customerNameSnapshot}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {inv.deliveryStateSnapshot}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {inv.status.replaceAll("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatINR(inv.taxableAmount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatINR(inv.totalTaxAmount)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatINR(inv.totalAmount)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatINR(inv.outstandingAmount)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {formatDateTime(inv.postedAt)}
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
