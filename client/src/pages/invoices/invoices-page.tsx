import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { ColumnDef } from "@tanstack/react-table";
import type { PaginationMeta } from "@mill-ledger/shared";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { assertCollectionResponse } from "@/lib/api-contracts";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useUrlState } from "@/hooks/use-url-state";
import { usePagination } from "@/hooks/use-pagination";
import { useFormatters } from "@/hooks/use-formatters";
import { getStatusLabel } from "@/lib/enum-labels";
import { PageHeader } from "@/components/ui/page-header";
import { DataPagination } from "@/components/ui/data-pagination";
import {
  DataTable,
  DataTableColumnHeader,
  type DataTableColumnMeta,
} from "@/components/ui/data-table";
import {
  EmptyState,
  SkeletonTable,
  ErrorState,
} from "@/components/ui/loading-error-empty";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExportMenu } from "@/components/ui/export-menu";
import { Input } from "@/components/ui/input";
import { PlusCircleIcon, RefreshCwIcon, SearchIcon } from "lucide-react";

interface SalesInvoice {
  id: string;
  invoiceNumber: string;
  financialYear: string;
  customerNameSnapshot: string;
  deliveryStateSnapshot: string;
  status:
    "DRAFT" | "POSTED" | "CANCELLED_BY_CREDIT_NOTE" | "PAID" | "PARTIALLY_PAID";
  taxableAmount: number;
  totalTaxAmount: number;
  totalAmount: number;
  outstandingAmount: number;
  postedAt: string;
}

export function InvoicesPage() {
  const { t } = useTranslation(["finance", "common"]);
  const { formatINR, formatDateTime } = useFormatters();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const canCreateInvoice = user?.role === "ADMIN";
  const [searchQuery, setSearchQuery] = useUrlState("q", "", {
    debounceMs: 200,
  });
  const [statusFilter, setStatusFilter] = useUrlState("status", "ALL");
  const { page, pageSize, offset, setPage, setPageSize, resetPage } =
    usePagination({ defaultPageSize: 20 });

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{
    invoices: SalesInvoice[];
    pagination: PaginationMeta;
  }>({
    queryKey: [
      "sales-invoices",
      page,
      pageSize,
      statusFilter,
      searchQuery.trim(),
    ],
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
      return assertCollectionResponse(
        res.data,
        "invoices",
        "/finance/invoices",
      );
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
      return assertCollectionResponse(res.data, "orders", "/sales/orders");
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
          <DataTableColumnHeader
            column={column}
            title={t("common:terms.invoiceNumber")}
          />
        ),
        cell: ({ row }) => (
          <Link
            to={`/invoices/${row.original.id}`}
            className="font-medium text-primary hover:underline tabular-nums whitespace-nowrap"
          >
            {row.original.invoiceNumber}
          </Link>
        ),
        meta: {
          label: t("common:terms.invoiceNumber"),
        } satisfies DataTableColumnMeta<SalesInvoice>,
      },
      {
        accessorKey: "customerNameSnapshot",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("common:terms.customer")}
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium min-w-[160px] block">
            {row.original.customerNameSnapshot}
          </span>
        ),
        meta: {
          label: t("common:terms.customer"),
        } satisfies DataTableColumnMeta<SalesInvoice>,
      },
      {
        accessorKey: "deliveryStateSnapshot",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("common:terms.placeOfSupply")}
          />
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {row.original.deliveryStateSnapshot}
          </span>
        ),
        meta: {
          label: t("common:terms.placeOfSupply"),
        } satisfies DataTableColumnMeta<SalesInvoice>,
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("common:terms.status")}
          />
        ),
        cell: ({ row }) => (
          <Badge variant="outline" className="whitespace-nowrap">
            {getStatusLabel(row.original.status)}
          </Badge>
        ),
        meta: {
          label: t("common:terms.status"),
          exportValue: (r) => getStatusLabel(r.status),
        } satisfies DataTableColumnMeta<SalesInvoice>,
      },
      {
        id: "taxableAmount",
        accessorFn: (row) => Number(row.taxableAmount) || 0,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("common:terms.taxable")}
            align="right"
          />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums whitespace-nowrap">
            {formatINR(row.original.taxableAmount)}
          </span>
        ),
        meta: {
          label: t("common:terms.taxable"),
          align: "right",
          exportValue: (r) => Number(r.taxableAmount),
        } satisfies DataTableColumnMeta<SalesInvoice>,
      },
      {
        id: "totalTaxAmount",
        accessorFn: (row) => Number(row.totalTaxAmount) || 0,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("common:terms.tax")}
            align="right"
          />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums whitespace-nowrap">
            {formatINR(row.original.totalTaxAmount)}
          </span>
        ),
        meta: {
          label: t("common:terms.tax"),
          align: "right",
          exportValue: (r) => Number(r.totalTaxAmount),
        } satisfies DataTableColumnMeta<SalesInvoice>,
      },
      {
        id: "totalAmount",
        accessorFn: (row) => Number(row.totalAmount) || 0,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("common:terms.total")}
            align="right"
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium tabular-nums whitespace-nowrap">
            {formatINR(row.original.totalAmount)}
          </span>
        ),
        meta: {
          label: t("common:terms.total"),
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
            title={t("common:terms.outstanding")}
            align="right"
          />
        ),
        cell: ({ row }) => (
          <span className="font-medium tabular-nums whitespace-nowrap">
            {formatINR(row.original.outstandingAmount)}
          </span>
        ),
        meta: {
          label: t("common:terms.outstanding"),
          align: "right",
          exportValue: (r) => Number(r.outstandingAmount),
        } satisfies DataTableColumnMeta<SalesInvoice>,
      },
      {
        id: "postedAt",
        accessorFn: (row) => new Date(row.postedAt).getTime() || 0,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t("finance:invoices.postedAt")}
          />
        ),
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
            {formatDateTime(row.original.postedAt)}
          </span>
        ),
        meta: {
          label: t("finance:invoices.postedAt"),
          exportValue: (r) => formatDateTime(r.postedAt),
        } satisfies DataTableColumnMeta<SalesInvoice>,
      },
    ],
    [t, formatINR, formatDateTime],
  );

  return (
    <div className="flex flex-1 flex-col gap-5 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t("finance:invoices.header")}
        description={t("finance:invoices.description")}
        primaryAction={
          canCreateInvoice ? (
            <Button
              variant="primary"
              onClick={() => navigate("/invoices/new")}
              className="gap-1.5"
            >
              <PlusCircleIcon className="size-4" aria-hidden="true" />
              {t("finance:invoices.createInvoice")}
            </Button>
          ) : null
        }
        secondaryActions={
          <div className="flex flex-wrap items-center gap-2">
            <ExportMenu entity="invoices" />
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
              {t("common:actions.refresh")}
            </Button>
          </div>
        }
      />

      {canCreateInvoice && awaitingInvoice.length > 0 && (
        <section className="rounded-lg border border-amber-300 bg-amber-50/60 p-3.5 dark:border-amber-800 dark:bg-amber-950/30 space-y-2">
          <div className="text-xs font-semibold text-amber-900 dark:text-amber-200">
            {t("finance:invoices.awaitingInvoice", {
              count: awaitingInvoice.length,
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            {awaitingInvoice.map((ord) => (
              <Link
                key={ord.id}
                to={`/invoices/new?orderId=${ord.id}`}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:border-primary/50"
              >
                <span>{ord.orderNumber}</span>
                <span className="text-muted-foreground">
                  {ord.customer.name}
                </span>
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
          {[
            "ALL",
            "POSTED",
            "PARTIALLY_PAID",
            "PAID",
            "CANCELLED_BY_CREDIT_NOTE",
          ].map((st) => (
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
              {st === "ALL" ? t("common:actions.all") : getStatusLabel(st)}
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
            placeholder={t("finance:invoices.searchPlaceholder")}
            aria-label={t("finance:invoices.searchPlaceholder")}
            className="h-9 pl-8"
          />
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable rows={6} columns={6} />
      ) : isError ? (
        <ErrorState
          title={t("finance:invoices.failedToLoad")}
          description={extractErrorMessage(error)}
          onRetry={() => refetch()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={t("finance:invoices.noInvoices")}
          description={t("finance:invoices.noInvoicesDesc")}
        />
      ) : (
        <>
          <DataTable
            tableId="sales-invoices"
            data={filtered}
            columns={invoiceColumns}
            getRowId={(r) => r.id}
            ariaLabel={t("finance:invoices.title")}
            csvFilename="sales-invoices"
          />

          <DataPagination
            pagination={data?.pagination}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            isFetching={isFetching}
            itemLabel={t("finance:invoices.itemLabel")}
          />
        </>
      )}
    </div>
  );
}
