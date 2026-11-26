import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { useUrlState } from "@/hooks/use-url-state";
import { formatINR } from "@/lib/formatters";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, SkeletonTable, ErrorState } from "@/components/ui/loading-error-empty";
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

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{
    receivables: CustomerReceivable[];
  }>({
    queryKey: ["receivables-summary"],
    queryFn: async () => {
      const res = await apiClient.get("/payments/receivables/summary");
      return res.data;
    },
  });

  const rows = data?.receivables ?? [];
  const filtered = rows.filter((r) => {
    if (onlyDue === "DUE" && Number(r.netOutstanding) <= 0) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      if (
        !r.customerName.toLowerCase().includes(q) &&
        !r.customerCode.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const totalOutstanding = rows.reduce((s, r) => s + Number(r.netOutstanding || 0), 0);

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
            onClick={() => setOnlyDue("ALL")}
            className="h-8 text-xs"
          >
            All customers
          </Button>
          <Button
            variant={onlyDue === "DUE" ? "primary" : "outline"}
            size="sm"
            onClick={() => setOnlyDue("DUE")}
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
            onChange={(e) => setSearchQuery(e.target.value)}
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
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Invoiced</TableHead>
                <TableHead className="text-right">Collected</TableHead>
                <TableHead className="text-right">Net outstanding</TableHead>
                <TableHead className="text-right">Unallocated credit</TableHead>
                <TableHead className="text-right">Ledger</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.customerId}>
                  <TableCell>
                    <div className="font-medium">{r.customerName}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.customerCode}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatINR(r.totalInvoiced)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatINR(r.totalPaid)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatINR(r.netOutstanding)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatINR(r.unallocatedCredit ?? 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      to={`/receivables/${r.customerId}`}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Open ledger
                    </Link>
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
