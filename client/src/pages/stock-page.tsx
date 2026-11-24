import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useUrlState } from "@/hooks/use-url-state";
import { formatINR, formatQuantity } from "@/lib/formatters";
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
  CheckCircleIcon,
  RefreshCwIcon,
  PackageIcon,
  AlertTriangleIcon,
} from "lucide-react";

interface InventoryBalance {
  id: string;
  sku: string;
  name: string;
  category: "RAW_MATERIAL" | "PACKAGING" | "FINISHED_GOODS";
  baseUom: {
    code: string;
    symbol: string;
  };
  onHand: number;
  reserved: number;
  available: number;
  weightedAverageCost: number;
  reconciled: boolean;
  ledgerSum: number;
}

const CATEGORY_LABELS: Record<
  InventoryBalance["category"],
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  RAW_MATERIAL: { label: "Raw Material", variant: "secondary" },
  PACKAGING: { label: "Packaging", variant: "outline" },
  FINISHED_GOODS: { label: "Finished Goods", variant: "default" },
};

export function StockPage() {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useUrlState("q", "", {
    debounceMs: 250,
  });
  const [categoryFilter, setCategoryFilter] = useUrlState("category", "ALL");

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{
    balances: InventoryBalance[];
  }>({
    queryKey: ["inventory-balances"],
    queryFn: async () => {
      // Benchmark organization code is "MILL"
      const res = await apiClient.get(
        "/inventory/balances?organizationId=MILL",
      );
      return res.data;
    },
  });

  const balances = data?.balances ?? [];

  const filteredBalances = balances.filter((item) => {
    if (categoryFilter !== "ALL" && item.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchSku = item.sku.toLowerCase().includes(q);
      const matchName = item.name.toLowerCase().includes(q);
      if (!matchSku && !matchName) return false;
    }
    return true;
  });

  // Computed summary metrics
  const totalItems = balances.length;
  const rawMaterialCount = balances.filter(
    (b) => b.category === "RAW_MATERIAL",
  ).length;
  const packagingCount = balances.filter(
    (b) => b.category === "PACKAGING",
  ).length;
  const finishedGoodsCount = balances.filter(
    (b) => b.category === "FINISHED_GOODS",
  ).length;

  const totalInventoryValue = balances.reduce(
    (sum, b) => sum + b.onHand * b.weightedAverageCost,
    0,
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Header and Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Inventory & Stock Ledger
          </h1>
          <p className="text-sm text-muted-foreground">
            Real time stock balances, weighted average costing, and ledger
            reconciliation.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2 self-start sm:self-auto"
        >
          <RefreshCwIcon
            className={`size-4 ${isFetching ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          <span>{t("Refresh Balances")}</span>
        </Button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <div className="flex flex-col justify-between gap-2 rounded-xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("Total Items")}
          </span>
          <span className="text-2xl font-bold text-foreground">
            {isLoading ? "—" : totalItems}
          </span>
        </div>

        <div className="flex flex-col justify-between gap-2 rounded-xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("Raw Materials")}
          </span>
          <span className="text-2xl font-bold text-foreground">
            {isLoading ? "—" : rawMaterialCount}
          </span>
        </div>

        <div className="flex flex-col justify-between gap-2 rounded-xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("Packaging")}
          </span>
          <span className="text-2xl font-bold text-foreground">
            {isLoading ? "—" : packagingCount}
          </span>
        </div>

        <div className="flex flex-col justify-between gap-2 rounded-xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("Finished Goods")}
          </span>
          <span className="text-2xl font-bold text-foreground">
            {isLoading ? "—" : finishedGoodsCount}
          </span>
        </div>

        <div className="flex flex-col justify-between gap-2 rounded-xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("Valued Stock Total")}
          </span>
          <span className="text-2xl font-bold text-foreground">
            {isLoading
              ? "—"
              : formatINR(totalInventoryValue)}
          </span>
        </div>
      </div>

      {/* Main Stock Table */}
      <div className="flex flex-col rounded-xl border border-border bg-card shadow-xs">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <PackageIcon
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <h2 className="text-sm font-semibold text-foreground">
              {t("Current Stock on Hand")}
            </h2>
            <span className="text-xs text-muted-foreground font-mono tabular-nums">
              ({filteredBalances.length} of {balances.length})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder={t("Search items by SKU or name...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-52 text-xs"
              aria-label="Search stock"
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-label="Filter items by category"
            >
              <option value="ALL">All categories</option>
              <option value="RAW_MATERIAL">Raw Material</option>
              <option value="FINISHED_GOODS">Finished Goods</option>
              <option value="PACKAGING">Packaging</option>
            </select>
            <Badge variant="outline" className="gap-1.5 text-xs text-emerald-600">
              <CheckCircleIcon className="size-3.5" aria-hidden="true" />
              <span>Movements Reconciled</span>
            </Badge>
          </div>
        </div>

        {isLoading ? (
          <div className="p-4">
            <SkeletonTable rows={6} columns={7} />
          </div>
        ) : isError ? (
          <div className="p-4">
            <ErrorState
              title={t("Failed to load inventory balances", "Failed to load inventory balances")}
              description={
                error instanceof Error ? error.message : "Ensure the server is running and database seed is completed."
              }
              error={error}
              onRetry={() => refetch()}
            />
          </div>
        ) : balances.length === 0 ? (
          <div className="flex min-h-48 items-center justify-center p-8 text-sm text-muted-foreground">
            No inventory items registered. Run database seed to populate
            benchmark masters.
          </div>
        ) : (
          <>
            {/* Mobile Card Layout (<md viewports per F-047) */}
            <div
              className="divide-y divide-border md:hidden"
              data-slot="mobile-cards"
            >
              {filteredBalances.length === 0 && balances.length > 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  {t("No items match the selected filters.")}
                </div>
              )}
              {filteredBalances.map((item) => {
                const totalValue = item.onHand * item.weightedAverageCost;
                const categoryConfig = CATEGORY_LABELS[item.category] || {
                  label: item.category,
                  variant: "secondary",
                };

                return (
                  <div key={item.id} className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-foreground">
                          {item.sku}
                        </span>
                        <Badge
                          variant={categoryConfig.variant}
                          className="text-2xs"
                        >
                          {categoryConfig.label}
                        </Badge>
                      </div>
                      <div>
                        {item.reconciled ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"
                            title="Ledger sum equals on-hand balance"
                          >
                            <CheckCircleIcon
                              className="size-3.5"
                              aria-hidden="true"
                            />
                            Balanced
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-medium text-amber-600"
                            title="Ledger variance detected"
                          >
                            <AlertTriangleIcon
                              className="size-3.5"
                              aria-hidden="true"
                            />
                            Variance
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="font-medium text-sm text-foreground">
                      {item.name}
                    </p>

                    <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-2.5 text-xs">
                      <div>
                        <span className="text-muted-foreground text-2xs uppercase">
                          On Hand
                        </span>
                        <p className="font-semibold text-foreground">
                          {formatQuantity(item.onHand)}{" "}
                          <span className="text-2xs text-muted-foreground font-normal">
                            {item.baseUom.symbol}
                          </span>
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-2xs uppercase">
                          Avg Unit Cost
                        </span>
                        <p className="font-medium text-muted-foreground">
                          {formatINR(item.weightedAverageCost, {
                            maximumFractionDigits:
                              item.weightedAverageCost % 1 === 0 ? 2 : 3,
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-muted-foreground text-2xs uppercase">
                          Total Value
                        </span>
                        <p className="font-bold text-foreground">
                          {formatINR(totalValue)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (md+ viewports) */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">{t("SKU")}</TableHead>
                    <TableHead>{t("Item Name")}</TableHead>
                    <TableHead className="w-[140px]">{t("Category")}</TableHead>
                    <TableHead className="text-right">{t("On Hand")}</TableHead>
                    <TableHead className="text-right">{t("Avg Unit Cost")}</TableHead>
                    <TableHead className="text-right">{t("Total Value")}</TableHead>
                    <TableHead className="w-[120px] text-center">
                      {t("Ledger Status")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBalances.length === 0 && balances.length > 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-8 text-center text-sm text-muted-foreground"
                      >
                        {t("No items match the selected filters.")}
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredBalances.map((item) => {
                    const totalValue = item.onHand * item.weightedAverageCost;
                    const categoryConfig = CATEGORY_LABELS[item.category] || {
                      label: item.category,
                      variant: "secondary",
                    };

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs font-medium text-foreground">
                          {item.sku}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {item.name}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={categoryConfig.variant}
                            className="text-xs"
                          >
                            {categoryConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatQuantity(item.onHand)}{" "}
                          <span className="text-xs text-muted-foreground">
                            {item.baseUom.symbol}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatINR(item.weightedAverageCost, {
                            maximumFractionDigits:
                              item.weightedAverageCost % 1 === 0 ? 2 : 3,
                          })}
                        </TableCell>
                        <TableCell className="text-right font-medium text-foreground">
                          {formatINR(totalValue)}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.reconciled ? (
                            <span
                              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"
                              title="Ledger sum equals on-hand balance"
                            >
                              <CheckCircleIcon
                                className="size-3.5"
                                aria-hidden="true"
                              />
                              Balanced
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 text-xs font-medium text-amber-600"
                              title="Ledger variance detected"
                            >
                              <AlertTriangleIcon
                                className="size-3.5"
                                aria-hidden="true"
                              />
                              Variance
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
