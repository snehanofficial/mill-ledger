import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useLanguage } from "@/lib/i18n";
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
  const { data, isLoading, isError, refetch, isFetching } = useQuery<{
    customers: Customer[];
  }>({
    queryKey: ["sales-customers"],
    queryFn: async () => {
      const res = await apiClient.get("/sales/customers?organizationId=MILL");
      return res.data;
    },
  });

  const customers = data?.customers ?? [];

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

      {/* Customers Table Card */}
      <div className="rounded-xl border border-border bg-card shadow-xs">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <UsersIcon className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              Accounts Register
            </h2>
          </div>
          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            {customers.length} total accounts
          </span>
        </div>

        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <RefreshCwIcon className="size-6 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Loading customer directory...</span>
            </div>
          </div>
        ) : isError ? (
          <div className="flex h-48 items-center justify-center p-6 text-center">
            <p className="text-sm text-destructive">
              Failed to load customers. Please verify connection and permissions.
            </p>
          </div>
        ) : customers.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center p-6 text-center">
            <UsersIcon className="size-8 text-muted-foreground/50 mb-2" />
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
              {customers.map((c) => {
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
                        <MapPinIcon className="size-3 text-muted-foreground/70" />
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
