import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { formatINR, formatQuantity } from "@/lib/formatters";
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
  const { data, isLoading, isError, refetch, isFetching } = useQuery<{
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
          <span>Refresh Balances</span>
        </Button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <div className="flex flex-col justify-between gap-2 rounded-xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Total Items
          </span>
          <span className="text-2xl font-bold text-foreground">
            {isLoading ? "—" : totalItems}
          </span>
        </div>

        <div className="flex flex-col justify-between gap-2 rounded-xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Raw Materials
          </span>
          <span className="text-2xl font-bold text-foreground">
            {isLoading ? "—" : rawMaterialCount}
          </span>
        </div>

        <div className="flex flex-col justify-between gap-2 rounded-xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Packaging
          </span>
          <span className="text-2xl font-bold text-foreground">
            {isLoading ? "—" : packagingCount}
          </span>
        </div>

        <div className="flex flex-col justify-between gap-2 rounded-xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Finished Goods
          </span>
          <span className="text-2xl font-bold text-foreground">
            {isLoading ? "—" : finishedGoodsCount}
          </span>
        </div>

        <div className="flex flex-col justify-between gap-2 rounded-xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Valued Stock Total
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
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <PackageIcon
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <h2 className="text-sm font-semibold text-foreground">
              Current Stock on Hand
            </h2>
          </div>
          <Badge variant="outline" className="gap-1.5 text-xs text-emerald-600">
            <CheckCircleIcon className="size-3.5" aria-hidden="true" />
            <span>Movements Reconciled</span>
          </Badge>
        </div>

        {isLoading ? (
          <div className="flex min-h-48 items-center justify-center p-8 text-sm text-muted-foreground">
            <RefreshCwIcon
              className="mr-2 size-4 animate-spin"
              aria-hidden="true"
            />
            Loading stock balances...
          </div>
        ) : isError ? (
          <div className="flex min-h-48 flex-col items-center justify-center p-8 text-center text-sm text-destructive">
            <AlertTriangleIcon className="mb-2 size-6" aria-hidden="true" />
            <p className="font-medium">Failed to load inventory balances</p>
            <p className="text-xs text-muted-foreground">
              Ensure the server is running and database seed is completed.
            </p>
          </div>
        ) : balances.length === 0 ? (
          <div className="flex min-h-48 items-center justify-center p-8 text-sm text-muted-foreground">
            No inventory items registered. Run database seed to populate
            benchmark masters.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">SKU</TableHead>
                <TableHead>Item Name</TableHead>
                <TableHead className="w-[140px]">Category</TableHead>
                <TableHead className="text-right">On Hand</TableHead>
                <TableHead className="text-right">Avg Unit Cost</TableHead>
                <TableHead className="text-right">Total Value</TableHead>
                <TableHead className="w-[120px] text-center">
                  Ledger Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {balances.map((item) => {
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
        )}
      </div>
    </div>
  );
}
