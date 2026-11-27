import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { formatINR, formatQuantity, formatDateTime } from "@/lib/formatters";
import { RecordHeader } from "@/components/ui/page-header";
import { ErrorState, EmptyState, SkeletonTable } from "@/components/ui/loading-error-empty";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface LedgerMovement {
  id: string;
  movementType: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  runningBalance: number;
  referenceDocumentType: string | null;
  referenceDocumentId: string | null;
  notes: string | null;
  warehouseName: string;
  postedAt: string;
}

interface StockBalance {
  id: string;
  sku: string;
  name: string;
  category: string;
  onHand: number;
  reserved: number;
  available: number;
  weightedAverageCost: number;
  totalValuation: number;
  baseUom?: { code: string; name: string };
}

function getSourceDocHref(type: string | null, id: string | null): string | null {
  if (!type || !id) return null;
  switch (type) {
    case "PURCHASE_RECEIPT":
      return `/purchases/${id}`;
    case "PRODUCTION_RUN":
      return `/production/runs/${id}`;
    case "DISPATCH":
    case "SALES_DISPATCH":
      return `/dispatch/${id}`;
    default:
      return null;
  }
}

export function StockLedgerPage() {
  const { itemId } = useParams<{ itemId: string }>();

  const { data: balancesData } = useQuery<{ balances: StockBalance[] }>({
    queryKey: ["inventory-balances"],
    queryFn: async () => {
      const res = await apiClient.get("/inventory/balances");
      return res.data;
    },
  });

  const { data, isLoading, isError, error, refetch } = useQuery<{
    ledger: LedgerMovement[];
  }>({
    queryKey: ["inventory-item-ledger", itemId],
    queryFn: async () => {
      const res = await apiClient.get(`/inventory/items/${itemId}/ledger`);
      return res.data;
    },
    enabled: Boolean(itemId),
  });

  const item = balancesData?.balances.find((b) => b.id === itemId);
  const unit = item?.baseUom?.code ?? "units";
  const ledger = data?.ledger ?? [];

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-6xl">
      <RecordHeader
        backTo="/stock"
        backLabel="Back to Stock overview"
        reference={item ? `${item.name} (${item.sku})` : "Item stock ledger"}
        subtitle={
          item
            ? `Category: ${item.category.replaceAll("_", " ")} • Base UOM: ${unit}`
            : "Traceable inventory movement ledger"
        }
        statuses={
          item ? (
            <>
              <Badge variant="outline">
                On hand: {formatQuantity(item.onHand, { unit })}
              </Badge>
              <Badge variant="outline">
                Reserved: {formatQuantity(item.reserved, { unit })}
              </Badge>
              <Badge variant="outline">
                ATP: {formatQuantity(item.available, { unit })}
              </Badge>
            </>
          ) : null
        }
      />

      {item && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 text-sm">
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">On hand</div>
            <div className="text-lg font-semibold tabular-nums">
              {formatQuantity(item.onHand, { unit })}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">Reserved</div>
            <div className="text-lg font-semibold tabular-nums">
              {formatQuantity(item.reserved, { unit })}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">Available (ATP)</div>
            <div className="text-lg font-semibold tabular-nums">
              {formatQuantity(item.available, { unit })}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">WAC / Valuation</div>
            <div className="text-lg font-semibold tabular-nums">
              {formatINR(item.weightedAverageCost)}
            </div>
            <div className="text-xs text-muted-foreground tabular-nums">
              Total: {formatINR(item.totalValuation)}
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <SkeletonTable rows={6} columns={6} />
      ) : isError ? (
        <ErrorState
          title="Unable to load stock ledger"
          description={extractErrorMessage(error)}
          onRetry={() => refetch()}
        />
      ) : ledger.length === 0 ? (
        <EmptyState
          title="No stock movements recorded"
          description="Movements will appear here as purchases, production runs, dispatches, or adjustments are posted."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Posted at</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Unit cost</TableHead>
                <TableHead className="text-right">Running balance</TableHead>
                <TableHead>Source document</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.map((mov) => {
                const href = getSourceDocHref(
                  mov.referenceDocumentType,
                  mov.referenceDocumentId,
                );
                return (
                  <TableRow key={mov.id}>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {formatDateTime(mov.postedAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {mov.movementType.replaceAll("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{mov.warehouseName}</TableCell>
                    <TableCell
                      className={`text-right font-medium tabular-nums ${
                        mov.quantity >= 0
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-destructive"
                      }`}
                    >
                      {mov.quantity >= 0 ? "+" : ""}
                      {formatQuantity(mov.quantity, { unit })}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatINR(mov.unitCost)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatQuantity(mov.runningBalance, { unit })}
                    </TableCell>
                    <TableCell className="text-xs">
                      {href ? (
                        <Link to={href} className="text-primary hover:underline">
                          {mov.referenceDocumentType?.replaceAll("_", " ")}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">
                          {mov.notes || mov.referenceDocumentType || "—"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
