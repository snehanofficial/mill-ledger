import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { assertEntityResponse } from "@/lib/api-contracts";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatDateTime, formatINR } from "@/lib/formatters";
import { RecordHeader } from "@/components/ui/page-header";
import { ErrorState, SkeletonTable } from "@/components/ui/loading-error-empty";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EntityLifecycleTimeline } from "@/components/timeline/entity-lifecycle-timeline";

interface CustomerDetailResponse {
  customer: {
    id: string;
    code: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    state: string;
    gstin?: string | null;
    isActive: boolean;
    createdAt: string;
    assignments?: Array<{
      id: string;
      salesmanId: string;
      salesman: { id: string; name: string; email: string };
    }>;
    salesOrders?: Array<{
      id: string;
      orderNumber: string;
      status: string;
      totalAmount: number | string;
      createdAt: string;
    }>;
    invoices?: Array<{
      id: string;
      invoiceNumber: string;
      status: string;
      totalAmount: number | string;
      outstandingAmount: number | string;
      postedAt: string;
    }>;
  };
}

export function CustomerDetailPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const { user } = useCurrentUser();
  const canViewLedger =
    user?.role === "ADMIN" ||
    user?.role === "ACCOUNTANT" ||
    user?.role === "OWNER";

  const {
    data: customer,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<CustomerDetailResponse["customer"]>({
    queryKey: ["customer-detail", customerId],
    queryFn: async () => {
      const endpoint = `/sales/customers/${customerId}`;
      const res = await apiClient.get(endpoint);
      return assertEntityResponse<
        CustomerDetailResponse["customer"] & Record<string, unknown>
      >(res.data, "customer", ["assignments"], endpoint);
    },
    enabled: Boolean(customerId),
  });

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <SkeletonTable rows={6} columns={4} />
      </div>
    );
  }

  if (isError || !customer) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <ErrorState
          title="Unable to load customer"
          description={extractErrorMessage(error)}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-6xl">
      <RecordHeader
        backTo="/customers"
        backLabel="Back to Customers"
        reference={customer.name}
        subtitle={`${customer.code} · ${customer.state}${customer.gstin ? ` · GSTIN: ${customer.gstin}` : ""}`}
        statuses={
          <Badge variant={customer.isActive ? "success" : "neutral"}>
            {customer.isActive ? "Active" : "Archived"}
          </Badge>
        }
        secondaryActions={
          canViewLedger ? (
            <Link
              to={`/receivables/${customer.id}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Open financial ledger
            </Link>
          ) : null
        }
      />

      <div className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-card p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="text-xs text-muted-foreground">Phone</div>
          <div className="font-medium">{customer.phone || "Not provided"}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Email</div>
          <div className="font-medium">{customer.email || "Not provided"}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">GSTIN</div>
          <div className="font-mono font-medium">
            {customer.gstin || "Unregistered"}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Assigned salesmen</div>
          <div className="font-medium">
            {customer.assignments && customer.assignments.length > 0
              ? customer.assignments.map((a) => a.salesman.name).join(", ")
              : "Unassigned"}
          </div>
        </div>
      </div>

      {customer.salesOrders?.length || customer.invoices?.length ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {customer.salesOrders && customer.salesOrders.length > 0 && (
            <section className="rounded-lg border border-border bg-card p-4 space-y-2.5">
              <h2 className="text-sm font-semibold text-foreground">
                Recent orders
              </h2>
              <div className="space-y-2 text-sm">
                {customer.salesOrders.slice(0, 5).map((ord) => (
                  <div
                    key={ord.id}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                  >
                    <div>
                      <Link
                        to={`/orders/${ord.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {ord.orderNumber}
                      </Link>
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({ord.status}) · {formatDateTime(ord.createdAt)}
                      </span>
                    </div>
                    <span className="font-medium tabular-nums">
                      {formatINR(ord.totalAmount)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {canViewLedger &&
            customer.invoices &&
            customer.invoices.length > 0 && (
              <section className="rounded-lg border border-border bg-card p-4 space-y-2.5">
                <h2 className="text-sm font-semibold text-foreground">
                  Recent invoices
                </h2>
                <div className="space-y-2 text-sm">
                  {customer.invoices.slice(0, 5).map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                    >
                      <div>
                        <Link
                          to={`/invoices/${inv.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {inv.invoiceNumber}
                        </Link>
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({inv.status}) · {formatDateTime(inv.postedAt)}
                        </span>
                      </div>
                      <span className="font-medium tabular-nums">
                        {formatINR(inv.totalAmount)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
        </div>
      ) : null}

      <EntityLifecycleTimeline
        entityType="customer"
        entityId={customer.id}
        description="Account profile changes, salesman assignments, orders, invoices, and payment history."
      />
    </div>
  );
}
