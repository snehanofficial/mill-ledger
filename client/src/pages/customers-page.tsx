import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useUrlState } from "@/hooks/use-url-state";
import { useLanguage } from "@/lib/i18n";
import {
  SkeletonTable,
  ErrorState,
} from "@/components/ui/loading-error-empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  UsersIcon,
  RefreshCwIcon,
  CheckCircle2Icon,
  MapPinIcon,
} from "lucide-react";
import { validateGstin } from "@mill-ledger/shared";

interface Customer {
  id: string;
  code: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  state: string;
  gstin?: string | null;
  isActive: boolean;
}

export function CustomersPage() {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useUrlState("q", "", {
    debounceMs: 250,
  });

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{
    customers: Customer[];
  }>({
    queryKey: ["sales-customers"],
    queryFn: async () => {
      const res = await apiClient.get("/sales/customers?organizationId=MILL");
      return res.data;
    },
  });

  const customers = data?.customers ?? [];

  const filteredCustomers = customers.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.state.toLowerCase().includes(q) ||
      (c.phone && c.phone.toLowerCase().includes(q)) ||
      (c.gstin && c.gstin.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Customer Directory
            </h1>
            <Badge variant="outline" className="text-xs">
              Live Master Data
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Retailers, distributors, state tax jurisdictions, and sales assignments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5"
          >
            <RefreshCwIcon
              className={`size-3.5 ${isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("Total Accounts")}
          </span>
          <span className="text-2xl font-bold tracking-tight text-foreground">
            {customers.length}
          </span>
        </div>
      </div>

      {/* Customers Table Card */}
      <div className="rounded-xl border border-border bg-card shadow-xs">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <UsersIcon className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              {t("Accounts Register")}
            </h2>
            <span className="text-xs text-muted-foreground font-mono tabular-nums">
              ({filteredCustomers.length} of {customers.length})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Input
              placeholder={t("Search customers...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-56 text-xs"
              aria-label="Search customers"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-4">
            <SkeletonTable rows={5} columns={6} />
          </div>
        ) : isError ? (
          <div className="p-4">
            <ErrorState
              title={t("Failed to load customer directory", "Failed to load customer directory")}
              description={
                error instanceof Error ? error.message : "Failed to load customers. Please verify connection and permissions."
              }
              error={error}
              onRetry={() => refetch()}
            />
          </div>
        ) : customers.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center p-6 text-center">
            <UsersIcon className="size-8 text-muted-foreground mb-2" />
            <p className="text-sm font-medium text-foreground">
              No customer accounts found
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Customer accounts configured in master data will appear here.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">{t("Account Code")}</TableHead>
                <TableHead>{t("Customer Name")}</TableHead>
                <TableHead>{t("Place of Supply")}</TableHead>
                <TableHead>{t("Tax Regime")}</TableHead>
                <TableHead>{t("GSTIN")}</TableHead>
                <TableHead className="w-[100px] text-center">{t("Status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.length === 0 && customers.length > 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    {t("No customer accounts match the search query.")}
                  </TableCell>
                </TableRow>
              )}
              {filteredCustomers.map((c) => {
                const isIntraState =
                  c.state?.trim().toLowerCase() === "tamil nadu";
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs font-semibold">
                      {c.code}
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {c.name}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <MapPinIcon className="size-3 text-muted-foreground" />
                        {c.state}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={isIntraState ? "secondary" : "outline"}
                        className="text-[10px]"
                      >
                        {isIntraState
                          ? "Intra-state (CGST + SGST)"
                          : "Inter-state (IGST)"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {c.gstin ? (
                        <div className="flex items-center gap-1.5">
                          <span>{c.gstin}</span>
                          {validateGstin(c.gstin).isValid ? (
                            <Badge
                              variant="success"
                              className="text-[9px] px-1 py-0"
                            >
                              Valid
                            </Badge>
                          ) : (
                            <Badge
                              variant="danger"
                              className="text-[9px] px-1 py-0"
                            >
                              Invalid
                            </Badge>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="success"
                        className="text-[10px] gap-1"
                      >
                        <CheckCircle2Icon className="size-2.5" />
                        Active
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
