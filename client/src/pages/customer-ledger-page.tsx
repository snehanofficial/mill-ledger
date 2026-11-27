import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { assertEntityResponse } from "@/lib/api-contracts";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatINR, formatDateTime } from "@/lib/formatters";
import { RecordHeader } from "@/components/ui/page-header";
import { EntityLifecycleTimeline } from "@/components/timeline/entity-lifecycle-timeline";
import { ErrorState, SkeletonTable } from "@/components/ui/loading-error-empty";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreditCardIcon } from "lucide-react";

interface CustomerLedgerData {
  customer: {
    id: string;
    code: string;
    name: string;
    state: string;
    gstin?: string | null;
  };
  summary: {
    totalInvoiced: number;
    totalCredited?: number;
    totalCreditNotes?: number;
    totalPaid: number;
    netOutstanding: number;
    unallocatedCredit?: number;
  };
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    postedAt: string;
    totalAmount: number;
    paidAmount: number;
    outstandingAmount: number;
    status: string;
  }>;
  payments: Array<{
    id: string;
    receiptNumber: string;
    paymentDate: string;
    paymentMode: string;
    amount: number;
    unallocatedAmount: number;
    status: string;
  }>;
}

export function CustomerLedgerPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const isAdmin = user?.role === "ADMIN";

  const { data, isLoading, isError, error, refetch } =
    useQuery<CustomerLedgerData>({
      queryKey: ["customer-ledger", customerId],
      queryFn: async () => {
        const endpoint = `/payments/ledger/${customerId}`;
        const res = await apiClient.get(endpoint);
        return assertEntityResponse<
          CustomerLedgerData & Record<string, unknown>
        >(res.data, null, ["invoices", "payments"], endpoint);
      },
      enabled: Boolean(customerId),
    });

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <SkeletonTable rows={6} columns={5} />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <ErrorState
          title="Unable to load customer ledger"
          description={extractErrorMessage(error)}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const { customer, summary, invoices, payments } = data;

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-6xl">
      <RecordHeader
        backTo="/receivables"
        backLabel="Back to Customer balances"
        reference={`${customer.name} (${customer.code})`}
        subtitle={`${customer.state}${customer.gstin ? ` • GSTIN: ${customer.gstin}` : ""}`}
        primaryAction={
          isAdmin ? (
            <Button
              variant="primary"
              onClick={() =>
                navigate(`/payments/new?customerId=${customer.id}`)
              }
              className="gap-1.5"
            >
              <CreditCardIcon className="size-4" aria-hidden="true" />
              Record payment
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 text-sm">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">Total invoiced</div>
          <div className="text-lg font-semibold tabular-nums">
            {formatINR(summary.totalInvoiced)}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">Credit notes</div>
          <div className="text-lg font-semibold tabular-nums">
            {formatINR(summary.totalCredited ?? summary.totalCreditNotes ?? 0)}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">Collections</div>
          <div className="text-lg font-semibold tabular-nums">
            {formatINR(summary.totalPaid)}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">Net outstanding</div>
          <div className="text-lg font-semibold tabular-nums">
            {formatINR(summary.netOutstanding)}
          </div>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Invoices</h2>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Posted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-6 text-center text-xs text-muted-foreground"
                  >
                    No invoices posted for this customer yet.
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium tabular-nums">
                      <Link
                        to={`/invoices/${inv.id}`}
                        className="text-primary hover:underline"
                      >
                        {inv.invoiceNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{inv.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatINR(inv.totalAmount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatINR(inv.paidAmount)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatINR(inv.outstandingAmount)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {formatDateTime(inv.postedAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Payments</h2>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt #</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Unallocated</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-6 text-center text-xs text-muted-foreground"
                  >
                    No payments recorded for this customer yet.
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium tabular-nums">
                      <Link
                        to={`/payments/${p.id}`}
                        className="text-primary hover:underline"
                      >
                        {p.receiptNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs">{p.paymentMode}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{p.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatINR(p.amount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatINR(p.unallocatedAmount)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {formatDateTime(p.paymentDate)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <EntityLifecycleTimeline
        entityType="customer"
        entityId={customer.id}
        description="Customer account updates, orders, invoices, and payment activity."
      />
    </div>
  );
}
