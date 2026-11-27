import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useWarehouses } from "@/hooks/use-warehouses";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { formatINR, formatQuantity } from "@/lib/formatters";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import {
  EmptyState,
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
import { Button, buttonVariants } from "@/components/ui/button";
import { ExportMenu } from "@/components/ui/export-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArchiveIcon,
  ChevronDownIcon,
  CopyIcon,
  LayersIcon,
  PlusCircleIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type {
  BomRecipe,
  InventoryBalanceItem,
} from "@/components/production/production-types";
import { RecordProductionBatchDialog } from "@/components/production/record-batch-dialog";

export function ProductionRecipesPage() {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const canManageBom = user?.role === "ADMIN";
  const canRecordProduction =
    user?.role === "ADMIN" || user?.role === "PRODUCTION";

  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateBomForm, setShowCreateBomForm] = useState(false);
  const [newBomVariantId, setNewBomVariantId] = useState("");
  const [newBomName, setNewBomName] = useState("");
  const [newBomBatchSize, setNewBomBatchSize] = useState(100);
  const [newBomExpectedOutput, setNewBomExpectedOutput] = useState(100);
  const [newBomOutputUomId, setNewBomOutputUomId] = useState("");
  const [newBomLines, setNewBomLines] = useState<
    Array<{
      inventoryItemId: string;
      itemType: "INGREDIENT" | "PACKAGING";
      plannedQty: number;
    }>
  >([]);

  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [batchRecipeId, setBatchRecipeId] = useState<string | undefined>(
    undefined,
  );
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [expandedRecipeIds, setExpandedRecipeIds] = useState<
    Record<string, boolean>
  >({});

  const toggleRecipeExpanded = (recipeId: string) => {
    setExpandedRecipeIds((prev) => ({
      ...prev,
      [recipeId]: !prev[recipeId],
    }));
  };

  const { data: warehousesData } = useWarehouses();
  const warehouses = warehousesData?.warehouses || [];
  const activeWarehouse =
    warehouses.find((w) => w.id === selectedWarehouseId) || warehouses[0];

  const {
    data: recipesData,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<{ recipes: BomRecipe[] }>({
    queryKey: ["production-recipes"],
    queryFn: async () => {
      const res = await apiClient.get("/production-runs/recipes");
      return res.data;
    },
  });

  const { data: balancesData } = useQuery<{
    balances: InventoryBalanceItem[];
  }>({
    queryKey: ["inventory-balances", activeWarehouse?.id ?? "all"],
    queryFn: async () => {
      const qs = activeWarehouse?.id
        ? `?warehouseId=${encodeURIComponent(activeWarehouse.id)}`
        : "";
      const res = await apiClient.get(`/inventory/balances${qs}`);
      return res.data;
    },
  });

  const { data: productsData } = useQuery<{
    products: Array<{
      id: string;
      name: string;
      variants: Array<{ id: string; sku: string; name: string }>;
    }>;
  }>({
    queryKey: ["masters-products"],
    enabled: canManageBom && showCreateBomForm,
    queryFn: async () => {
      const res = await apiClient.get("/masters/products");
      return res.data;
    },
  });

  const { data: uomsData } = useQuery<{
    uoms: Array<{ id: string; code: string; name: string; symbol: string }>;
  }>({
    queryKey: ["inventory-uoms"],
    enabled: canManageBom && showCreateBomForm,
    queryFn: async () => {
      const res = await apiClient.get("/inventory/uoms");
      return res.data;
    },
  });

  const recipes = recipesData?.recipes ?? [];
  const balances = balancesData?.balances ?? [];
  const balanceById = new Map(balances.map((b) => [b.id, b]));

  const filteredRecipes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.productVariant.name.toLowerCase().includes(q) ||
        r.productVariant.sku.toLowerCase().includes(q),
    );
  }, [recipes, searchQuery]);

  const createRecipeMutation = useMutation({
    mutationFn: async () => {
      if (!newBomVariantId || !newBomName.trim() || !newBomOutputUomId) {
        throw new Error("Variant, recipe name, and output UOM are required");
      }
      if (newBomLines.length === 0) {
        throw new Error("Add at least one ingredient or packaging line");
      }
      const res = await apiClient.post("/production-runs/recipes", {
        productVariantId: newBomVariantId,
        name: newBomName.trim(),
        standardBatchSize: Number(newBomBatchSize),
        expectedOutputQty: Number(newBomExpectedOutput),
        outputUomId: newBomOutputUomId,
        items: newBomLines.map((l) => {
          const item = balanceById.get(l.inventoryItemId);
          const matchingUom = uomsData?.uoms.find(
            (u) => u.code === item?.baseUom?.code,
          );
          return {
            inventoryItemId: l.inventoryItemId,
            itemType: l.itemType,
            plannedQty: Number(l.plannedQty),
            uomId: matchingUom?.id || newBomOutputUomId,
            tolerancePct: 5,
          };
        }),
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-recipes"] });
      setShowCreateBomForm(false);
      setNewBomName("");
      setNewBomLines([]);
      toast.success("BOM recipe created.");
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, "Failed to create BOM recipe"));
    },
  });

  const cloneRecipeVersionMutation = useMutation({
    mutationFn: async (recipeId: string) => {
      const res = await apiClient.post(
        `/production-runs/recipes/${recipeId}/version`,
        {},
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-recipes"] });
      toast.success("New BOM version created.");
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, "Failed to clone BOM version"));
    },
  });

  const archiveRecipeMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiClient.patch(
        `/production-runs/recipes/${id}/archive`,
        { isActive },
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production-recipes"] });
      toast.success("BOM status updated.");
    },
    onError: (err) => {
      toast.error(extractErrorMessage(err, "Failed to update BOM"));
    },
  });

  const openCreateForm = () => {
    const allVariants = (productsData?.products ?? []).flatMap(
      (p) => p.variants,
    );
    if (!newBomVariantId && allVariants[0]?.id) {
      setNewBomVariantId(allVariants[0].id);
    }
    if (!newBomOutputUomId && uomsData?.uoms.length) {
      setNewBomOutputUomId(
        uomsData.uoms.find((u) => u.code === "PACKET")?.id ||
          uomsData.uoms[0].id,
      );
    }
    if (newBomLines.length === 0 && balances.length > 0) {
      const firstRaw = balances.find((b) => b.category === "RAW_MATERIAL");
      if (firstRaw) {
        setNewBomLines([
          {
            inventoryItemId: firstRaw.id,
            itemType: "INGREDIENT",
            plannedQty: 10,
          },
        ]);
      }
    }
    setShowCreateBomForm((v) => !v);
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Recipes & Bills of Materials"
        description="Standard ingredients, packaging, expected batch yield, and live WAC cost estimates. Cloning creates a new version without mutating historical runs."
        secondaryActions={
          <>
            <ExportMenu entity="recipes" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-2"
            >
              <RefreshCwIcon
                className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              Refresh
            </Button>
            <Link
              to="/production/today"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Today's runs
            </Link>
          </>
        }
        primaryAction={
          canManageBom ? (
            <Button size="sm" onClick={openCreateForm} className="gap-2">
              <PlusCircleIcon className="h-4 w-4" aria-hidden="true" />
              {showCreateBomForm ? "Close recipe form" : "New Recipe / BOM"}
            </Button>
          ) : undefined
        }
      />

      {/* Create BOM Recipe Form (Admin only) */}
      {showCreateBomForm && canManageBom && (
        <section
          aria-labelledby="create-bom-heading"
          className="rounded-xl border bg-card p-4 shadow-xs flex flex-col gap-4"
        >
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <h2
                id="create-bom-heading"
                className="text-sm font-semibold text-foreground"
              >
                Create new BOM recipe
              </h2>
              <p className="text-xs text-muted-foreground">
                Define standard batch output and required raw/packaging lines.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCreateBomForm(false)}
            >
              Cancel
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="new-bom-variant" className="text-xs">
                Product Variant
              </Label>
              <Select value={newBomVariantId} onValueChange={setNewBomVariantId}>
                <SelectTrigger id="new-bom-variant" className="h-9 text-xs">
                  <SelectValue placeholder="Select variant" />
                </SelectTrigger>
                <SelectContent
                  searchable
                  searchPlaceholder="Search product variants..."
                >
                  {(productsData?.products ?? []).flatMap((p) =>
                    p.variants.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name} ({v.sku})
                      </SelectItem>
                    )),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="new-bom-name" className="text-xs">
                Recipe Name
              </Label>
              <Input
                id="new-bom-name"
                placeholder="Standard Mixture 250g BOM"
                value={newBomName}
                onChange={(e) => setNewBomName(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="new-bom-batch" className="text-xs">
                Batch Size
              </Label>
              <Input
                id="new-bom-batch"
                type="number"
                min={1}
                value={newBomBatchSize}
                onChange={(e) => setNewBomBatchSize(Number(e.target.value))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="new-bom-output" className="text-xs">
                Expected Yield
              </Label>
              <Input
                id="new-bom-output"
                type="number"
                min={1}
                value={newBomExpectedOutput}
                onChange={(e) => setNewBomExpectedOutput(Number(e.target.value))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="new-bom-uom" className="text-xs">
                Output UOM
              </Label>
              <Select
                value={newBomOutputUomId}
                onValueChange={setNewBomOutputUomId}
              >
                <SelectTrigger id="new-bom-uom" className="h-9 text-xs">
                  <SelectValue placeholder="Select UOM" />
                </SelectTrigger>
                <SelectContent>
                  {(uomsData?.uoms ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.code} ({u.symbol})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">BOM Material Lines</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  const first = balances[0];
                  if (!first) return;
                  setNewBomLines((prev) => [
                    ...prev,
                    {
                      inventoryItemId: first.id,
                      itemType:
                        first.category === "PACKAGING"
                          ? "PACKAGING"
                          : "INGREDIENT",
                      plannedQty: 1,
                    },
                  ]);
                }}
              >
                + Add Line
              </Button>
            </div>

            {newBomLines.map((line, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-stretch sm:items-center"
              >
                <div className="sm:col-span-5">
                  <Select
                    value={line.inventoryItemId}
                    onValueChange={(val) =>
                      setNewBomLines((prev) =>
                        prev.map((l, i) =>
                          i === idx ? { ...l, inventoryItemId: val } : l,
                        ),
                      )
                    }
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent
                      searchable
                      searchPlaceholder="Search raw or packaging items..."
                    >
                      {balances
                        .filter((b) => b.category !== "FINISHED_GOODS")
                        .map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name} ({b.baseUom.symbol})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-3">
                  <Select
                    value={line.itemType}
                    onValueChange={(val) =>
                      setNewBomLines((prev) =>
                        prev.map((l, i) =>
                          i === idx
                            ? {
                                ...l,
                                itemType: val as "INGREDIENT" | "PACKAGING",
                              }
                            : l,
                        ),
                      )
                    }
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INGREDIENT">Ingredient</SelectItem>
                      <SelectItem value="PACKAGING">Packaging</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-3">
                  <Input
                    type="number"
                    min={0.001}
                    step="any"
                    value={line.plannedQty}
                    onChange={(e) =>
                      setNewBomLines((prev) =>
                        prev.map((l, i) =>
                          i === idx
                            ? { ...l, plannedQty: Number(e.target.value) }
                            : l,
                        ),
                      )
                    }
                    className="h-9 text-xs"
                  />
                </div>
                <div className="sm:col-span-1 text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Remove BOM line"
                    className="h-9 px-2 text-destructive"
                    onClick={() =>
                      setNewBomLines((prev) =>
                        prev.filter((_, i) => i !== idx),
                      )
                    }
                  >
                    <Trash2Icon className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 border-t pt-3">
            <Button
              size="sm"
              disabled={createRecipeMutation.isPending || !newBomName.trim()}
              onClick={() => createRecipeMutation.mutate()}
            >
              {createRecipeMutation.isPending ? "Saving..." : "Save Recipe"}
            </Button>
          </div>
        </section>
      )}

      {/* Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground">
          Showing {filteredRecipes.length} of {recipes.length} active recipes
        </div>
        <Input
          placeholder="Search recipes by name, variant, or SKU..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-9 w-full sm:w-72 text-xs"
          aria-label="Search BOM recipes"
        />
      </div>

      {/* Recipes List */}
      {isLoading ? (
        <div className="rounded-xl border bg-card p-4">
          <SkeletonTable rows={5} columns={5} />
        </div>
      ) : isError ? (
        <ErrorState
          title="Failed to load BOM recipes"
          description={
            error instanceof Error
              ? error.message
              : "An unexpected server error occurred."
          }
          error={error}
          onRetry={() => refetch()}
        />
      ) : filteredRecipes.length === 0 ? (
        <EmptyState
          title={
            searchQuery.trim()
              ? "No recipes match your search"
              : "No active BOM recipes found"
          }
          description={
            searchQuery.trim()
              ? "Clear the search query to view all active recipes."
              : "Create a Bill of Materials recipe to define batch ingredients and expected output."
          }
          action={
            searchQuery.trim() ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchQuery("")}
              >
                Clear search
              </Button>
            ) : canManageBom ? (
              <Button variant="outline" size="sm" onClick={openCreateForm}>
                New Recipe / BOM
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-5">
          {filteredRecipes.map((recipe) => {
            const batchMaterialCost = recipe.items.reduce((sum, item) => {
              const wac =
                balanceById.get(item.inventoryItemId)?.weightedAverageCost ?? 0;
              return sum + Number(item.plannedQty) * wac;
            }, 0);
            const expectedOut = Number(recipe.expectedOutputQty) || 0;
            const estCostPerUnit =
              expectedOut > 0 ? batchMaterialCost / expectedOut : 0;

            const isExpanded = Boolean(expandedRecipeIds[recipe.id]);

            return (
              <Collapsible
                key={recipe.id}
                open={isExpanded}
                onOpenChange={() => toggleRecipeExpanded(recipe.id)}
                className="rounded-xl border bg-card shadow-xs overflow-hidden"
              >
                <div className="flex flex-col gap-3 bg-muted/20 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex flex-1 items-start gap-2.5 text-left cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <ChevronDownIcon
                        className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                        aria-hidden="true"
                      />
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <LayersIcon
                            className="h-4 w-4 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <span className="text-base font-semibold text-foreground">
                            {recipe.name}
                          </span>
                          {recipe.version !== undefined && (
                            <Badge variant="outline" className="text-xs font-mono">
                              v{recipe.version}
                            </Badge>
                          )}
                          <Badge variant="success" className="text-xs">
                            Active
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            · {recipe.items.length} materials
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Output: <span className="font-medium text-foreground">{recipe.productVariant.name}</span>{" "}
                          (<span className="font-mono">{recipe.productVariant.sku}</span>)
                          {" · "}
                          Expected yield: <span className="font-semibold text-foreground">{formatQuantity(expectedOut)}</span>{" "}
                          {recipe.outputUom?.symbol || "pkts"} / batch
                          {" · "}
                          Est. material cost: <span className="font-semibold text-foreground">{formatINR(batchMaterialCost)}</span>{" "}
                          ({formatINR(estCostPerUnit)}/pkt)
                        </div>
                      </div>
                    </button>
                  </CollapsibleTrigger>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/production/recipes/${recipe.id}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Lifecycle & details
                    </Link>
                    {canRecordProduction && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setBatchRecipeId(recipe.id);
                          setShowBatchDialog(true);
                        }}
                      >
                        Start batch
                      </Button>
                    )}
                    {canManageBom && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          disabled={cloneRecipeVersionMutation.isPending}
                          onClick={() =>
                            cloneRecipeVersionMutation.mutate(recipe.id)
                          }
                        >
                          <CopyIcon className="h-3.5 w-3.5" aria-hidden="true" />
                          Clone New Version
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-muted-foreground"
                          disabled={archiveRecipeMutation.isPending}
                          onClick={() =>
                            archiveRecipeMutation.mutate({
                              id: recipe.id,
                              isActive: false,
                            })
                          }
                        >
                          <ArchiveIcon
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          Archive
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <CollapsibleContent className="border-t">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Material / Item</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">
                            Planned / Batch
                          </TableHead>
                          <TableHead className="text-right">Tolerance</TableHead>
                          <TableHead className="text-right">
                            Available Stock
                          </TableHead>
                          <TableHead className="text-right">
                            Est. WAC Cost
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recipe.items.map((item) => {
                          const bal = balanceById.get(item.inventoryItemId);
                          const unitSym =
                            item.uom?.symbol || bal?.baseUom?.symbol || "";
                          const planned = Number(item.plannedQty);
                          const available = Number(bal?.available ?? 0);
                          const isShort = available < planned;
                          const lineCost =
                            planned * Number(bal?.weightedAverageCost ?? 0);

                          return (
                            <TableRow key={item.id}>
                              <TableCell>
                                <div className="font-medium text-foreground">
                                  {item.inventoryItem.name}
                                </div>
                                <div className="text-xs font-mono text-muted-foreground">
                                  {item.inventoryItem.sku}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {item.itemType === "PACKAGING"
                                    ? "Packaging"
                                    : "Ingredient"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono tabular-nums">
                                {formatQuantity(planned)} {unitSym}
                              </TableCell>
                              <TableCell className="text-right font-mono text-muted-foreground tabular-nums">
                                ±{Number(item.tolerancePct || 5)}%
                              </TableCell>
                              <TableCell
                                className={`text-right font-mono tabular-nums ${
                                  isShort
                                    ? "text-destructive font-semibold"
                                    : "text-foreground"
                                }`}
                              >
                                {formatQuantity(available)} {unitSym}
                              </TableCell>
                              <TableCell className="text-right font-mono tabular-nums">
                                {formatINR(lineCost)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      )}

      <RecordProductionBatchDialog
        open={showBatchDialog}
        onOpenChange={setShowBatchDialog}
        recipes={recipes}
        balances={balances}
        initialRecipeId={batchRecipeId}
        selectedWarehouseId={selectedWarehouseId}
        onWarehouseChange={setSelectedWarehouseId}
      />
    </div>
  );
}
