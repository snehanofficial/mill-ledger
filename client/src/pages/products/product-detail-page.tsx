import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { assertEntityResponse } from "@/lib/api-contracts";
import { formatINR, formatQuantity } from "@/lib/formatters";
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

interface ProductDetailResponse {
  product: {
    id: string;
    code: string;
    name: string;
    hsnCode: string;
    taxRate: number | string;
    isActive: boolean;
    variants: Array<{
      id: string;
      sku: string;
      name: string;
      packSize: number | string;
      isActive: boolean;
      uom: { id: string; symbol: string; name: string };
      inventoryItem?: {
        id: string;
        sku: string;
        name: string;
        currentStock: number | string;
      } | null;
      priceLines: Array<{
        id: string;
        price: number | string;
        priceList: {
          id: string;
          code: string;
          name: string;
          isDefault: boolean;
        };
      }>;
      recipes: Array<{
        id: string;
        name: string;
        version: number;
        isActive: boolean;
        expectedOutputQty: number | string;
      }>;
    }>;
  };
}

export function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();

  const {
    data: product,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ProductDetailResponse["product"]>({
    queryKey: ["product-detail", productId],
    queryFn: async () => {
      const endpoint = `/masters/products/${productId}`;
      const res = await apiClient.get(endpoint);
      return assertEntityResponse<
        ProductDetailResponse["product"] & Record<string, unknown>
      >(res.data, "product", ["variants"], endpoint);
    },
    enabled: Boolean(productId),
  });

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <SkeletonTable rows={6} columns={5} />
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <ErrorState
          title="Unable to load product"
          description={extractErrorMessage(error)}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-6xl">
      <RecordHeader
        backTo="/products"
        backLabel="Back to Products & prices"
        reference={product.name}
        subtitle={`Code: ${product.code} · HSN: ${product.hsnCode} · GST ${Number(product.taxRate)}%`}
        statuses={
          <Badge variant={product.isActive ? "success" : "neutral"}>
            {product.isActive ? "Active" : "Archived"}
          </Badge>
        }
      />

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">
          Pack size variants & pricing
        </h2>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Variant</TableHead>
                <TableHead className="text-right">Pack size</TableHead>
                <TableHead>Default rate</TableHead>
                <TableHead>Recipes</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {product.variants.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-6 text-center text-xs text-muted-foreground"
                  >
                    No pack size variants configured for this product yet.
                  </TableCell>
                </TableRow>
              ) : (
                product.variants.map((v) => {
                  const defaultPrice = (v.priceLines ?? []).find(
                    (pl) => pl.priceList.isDefault,
                  );
                  const recipes = v.recipes ?? [];
                  return (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono text-xs">
                        {v.sku}
                      </TableCell>
                      <TableCell className="font-medium">{v.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatQuantity(Number(v.packSize))} {v.uom.symbol}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {defaultPrice
                          ? formatINR(defaultPrice.price)
                          : "Not set"}
                      </TableCell>
                      <TableCell>
                        {recipes.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {recipes.map((r) => (
                              <Link
                                key={r.id}
                                to={`/production/recipes/${r.id}`}
                                className="text-xs font-medium text-primary hover:underline"
                              >
                                {r.name} (v{r.version})
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            None
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={v.isActive ? "success" : "neutral"}>
                          {v.isActive ? "Active" : "Archived"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <EntityLifecycleTimeline
        entityType="product"
        entityId={product.id}
        description="Master-data edits, price updates, BOM recipes, production batches, and commercial orders."
      />
    </div>
  );
}
