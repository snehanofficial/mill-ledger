import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { formatDateTime, formatQuantity } from "@/lib/formatters";
import { RecordHeader } from "@/components/ui/page-header";
import { ErrorState, SkeletonTable } from "@/components/ui/loading-error-empty";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EntityLifecycleTimeline } from "@/components/timeline/entity-lifecycle-timeline";

interface RecipeDetailResponse {
  recipe: {
    id: string;
    name: string;
    version: number;
    standardBatchSize: number | string;
    expectedOutputQty: number | string;
    isActive: boolean;
    createdAt: string;
    outputUom?: { id: string; symbol: string; name: string };
    productVariant: {
      id: string;
      sku: string;
      name: string;
      product: { id: string; code: string; name: string };
      recipes: Array<{
        id: string;
        name: string;
        version: number;
        isActive: boolean;
        createdAt: string;
      }>;
    };
    items: Array<{
      id: string;
      itemType: "INGREDIENT" | "PACKAGING";
      plannedQty: number | string;
      tolerancePct?: number | string | null;
      inventoryItem: { id: string; sku: string; name: string };
      uom?: { id: string; symbol: string };
    }>;
    productionRuns: Array<{
      id: string;
      runNumber: string;
      recipeVersion: number;
      status: string;
      actualGoodQty: number | string;
      createdAt: string;
    }>;
  };
}

export function RecipeDetailPage() {
  const { recipeId } = useParams<{ recipeId: string }>();

  const { data, isLoading, isError, error, refetch } =
    useQuery<RecipeDetailResponse>({
      queryKey: ["recipe-detail", recipeId],
      queryFn: async () => {
        const res = await apiClient.get(`/production-runs/recipes/${recipeId}`);
        return res.data;
      },
      enabled: Boolean(recipeId),
    });

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <SkeletonTable rows={6} columns={4} />
      </div>
    );
  }

  if (isError || !data?.recipe) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <ErrorState
          title="Unable to load recipe"
          description={extractErrorMessage(error)}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const recipe = data.recipe;

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-6xl">
      <RecordHeader
        backTo="/production/recipes"
        backLabel="Back to Recipes & BOMs"
        reference={`${recipe.name} (v${recipe.version})`}
        subtitle={`Output: ${recipe.productVariant.name} (${recipe.productVariant.sku}) · Expected yield: ${formatQuantity(Number(recipe.expectedOutputQty))} ${recipe.outputUom?.symbol || "pkts"}`}
        statuses={
          <Badge variant={recipe.isActive ? "success" : "neutral"}>
            {recipe.isActive ? "Active" : "Archived"}
          </Badge>
        }
      />

      <div className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-card p-4 text-sm sm:grid-cols-3">
        <div>
          <div className="text-xs text-muted-foreground">Output product</div>
          <Link
            to={`/products/${recipe.productVariant.product.id}`}
            className="font-medium text-primary hover:underline"
          >
            {recipe.productVariant.product.name}
          </Link>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Standard batch size</div>
          <div className="font-medium tabular-nums">
            {formatQuantity(Number(recipe.standardBatchSize))} kg
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Revisions for variant</div>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {recipe.productVariant.recipes.map((r) => (
              <Link
                key={r.id}
                to={`/production/recipes/${r.id}`}
                className={`text-xs font-mono ${
                  r.id === recipe.id
                    ? "font-semibold text-foreground underline"
                    : "text-primary hover:underline"
                }`}
              >
                v{r.version}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">
          Bill of materials
        </h2>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material / Item</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Planned / Batch</TableHead>
                <TableHead className="text-right">Tolerance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recipe.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium">{item.inventoryItem.name}</div>
                    <div className="text-xs font-mono text-muted-foreground">
                      {item.inventoryItem.sku}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {item.itemType === "PACKAGING" ? "Packaging" : "Ingredient"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatQuantity(Number(item.plannedQty))} {item.uom?.symbol || ""}
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground tabular-nums">
                    ±{Number(item.tolerancePct ?? 5)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {recipe.productionRuns.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">
            Production batches using v{recipe.version}
          </h2>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run #</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Good output</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipe.productionRuns.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium">
                      <Link
                        to={`/production/runs/${run.id}`}
                        className="text-primary hover:underline"
                      >
                        {run.runNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{run.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatQuantity(Number(run.actualGoodQty))}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {formatDateTime(run.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      <EntityLifecycleTimeline
        entityType="recipe"
        entityId={recipe.id}
        description="Recipe creation, sibling revisions, and production batches that used this exact revision."
      />
    </div>
  );
}
