import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatINR } from "@/lib/formatters";
import { SkeletonTable, ErrorState } from "@/components/ui/loading-error-empty";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PackageIcon,
  PlusCircleIcon,
  PencilIcon,
  RefreshCwIcon,
  TagIcon,
  ArchiveIcon,
} from "lucide-react";
import { toast } from "sonner";

interface UomItem {
  id: string;
  code: string;
  name: string;
  symbol: string;
}

interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  name: string;
  packSize: number | string;
  uomId: string;
  inventoryItemId?: string | null;
  isActive: boolean;
  uom: UomItem;
  priceLines: Array<{
    id: string;
    price: number | string;
    priceList: { id: string; code: string; name: string; isDefault: boolean };
  }>;
}

interface Product {
  id: string;
  code: string;
  name: string;
  hsnCode: string;
  taxRate: number | string;
  isActive: boolean;
  variants: ProductVariant[];
}

interface PriceList {
  id: string;
  code: string;
  name: string;
  isDefault: boolean;
  isActive: boolean;
  lines: Array<{
    id: string;
    productVariantId: string;
    price: number | string;
    productVariant: { id: string; sku: string; name: string };
  }>;
}

export function ProductsPage() {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const canManage = user?.role === "ADMIN";
  const [activeTab, setActiveTab] = useState<"products" | "pricelists">("products");

  // Product modal state
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodCode, setProdCode] = useState("");
  const [prodName, setProdName] = useState("");
  const [prodHsn, setProdHsn] = useState("21069099");
  const [prodTaxRate, setProdTaxRate] = useState(5);

  // Variant modal state
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [varProductId, setVarProductId] = useState("");
  const [varSku, setVarSku] = useState("");
  const [varName, setVarName] = useState("");
  const [varPackSize, setVarPackSize] = useState(500);
  const [varUomId, setVarUomId] = useState("");
  const [varDefaultPrice, setVarDefaultPrice] = useState(100);

  // Price list modal state
  const [showPriceListModal, setShowPriceListModal] = useState(false);
  const [plCode, setPlCode] = useState("");
  const [plName, setPlName] = useState("");
  const [editingPriceLine, setEditingPriceLine] = useState<{
    priceListId: string;
    priceListName: string;
    variantId: string;
    variantName: string;
    price: number;
  } | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{
    products: Product[];
    uoms: UomItem[];
    priceLists: PriceList[];
  }>({
    queryKey: ["masters-products"],
    queryFn: async () => {
      const res = await apiClient.get("/masters/products?organizationId=MILL");
      return res.data;
    },
  });

  const products = data?.products ?? [];
  const uoms = data?.uoms ?? [];
  const priceLists = data?.priceLists ?? [];
  const allVariants = products.flatMap((p) => p.variants);

  const saveProductMutation = useMutation({
    mutationFn: async () => {
      if (editingProduct) {
        return (
          await apiClient.put(`/masters/products/${editingProduct.id}`, {
            name: prodName.trim(),
            hsnCode: prodHsn.trim(),
            taxRate: Number(prodTaxRate),
          })
        ).data;
      }
      return (
        await apiClient.post("/masters/products", {
          organizationId: "MILL",
          code: prodCode.trim(),
          name: prodName.trim(),
          hsnCode: prodHsn.trim(),
          taxRate: Number(prodTaxRate),
        })
      ).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["masters-products"] });
      queryClient.invalidateQueries({ queryKey: ["sales-products"] });
      setShowProductModal(false);
      setEditingProduct(null);
      toast.success(editingProduct ? "Product updated." : "Product created.");
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to save product"));
    },
  });

  const toggleProductArchiveMutation = useMutation({
    mutationFn: async (p: Product) => {
      return (
        await apiClient.put(`/masters/products/${p.id}`, {
          isActive: !p.isActive,
        })
      ).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["masters-products"] });
      toast.success("Product status updated.");
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to update product status"));
    },
  });

  const saveVariantMutation = useMutation({
    mutationFn: async () => {
      if (editingVariant) {
        return (
          await apiClient.put(`/masters/variants/${editingVariant.id}`, {
            name: varName.trim(),
            packSize: Number(varPackSize),
            uomId: varUomId,
          })
        ).data;
      }
      return (
        await apiClient.post("/masters/variants", {
          productId: varProductId,
          sku: varSku.trim(),
          name: varName.trim(),
          packSize: Number(varPackSize),
          uomId: varUomId,
          defaultPrice: Number(varDefaultPrice),
        })
      ).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["masters-products"] });
      queryClient.invalidateQueries({ queryKey: ["sales-products"] });
      setShowVariantModal(false);
      setEditingVariant(null);
      toast.success(editingVariant ? "Variant updated." : "Variant created.");
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to save variant"));
    },
  });

  const createPriceListMutation = useMutation({
    mutationFn: async () => {
      return (
        await apiClient.post("/masters/price-lists", {
          organizationId: "MILL",
          code: plCode.trim(),
          name: plName.trim(),
        })
      ).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["masters-products"] });
      setShowPriceListModal(false);
      toast.success("Price list created.");
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to create price list"));
    },
  });

  const upsertPriceLineMutation = useMutation({
    mutationFn: async () => {
      if (!editingPriceLine) return;
      return (
        await apiClient.put(
          `/masters/price-lists/${editingPriceLine.priceListId}/lines`,
          {
            productVariantId: editingPriceLine.variantId,
            price: Number(editingPriceLine.price),
          },
        )
      ).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["masters-products"] });
      queryClient.invalidateQueries({ queryKey: ["sales-products"] });
      setEditingPriceLine(null);
      toast.success("Price updated.");
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to update price"));
    },
  });

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Products, Pack Sizes & Price Lists
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage sellable product lines, pack sizes, HSN/GST rates, and wholesale price lists.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5"
          >
            <RefreshCwIcon className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {canManage && activeTab === "products" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingVariant(null);
                  setVarProductId(products[0]?.id || "");
                  setVarSku("");
                  setVarName("");
                  setVarPackSize(500);
                  setVarUomId(uoms[0]?.id || "");
                  setVarDefaultPrice(100);
                  setShowVariantModal(true);
                }}
                disabled={products.length === 0}
                className="gap-1.5"
              >
                <PlusCircleIcon className="size-4" />
                Add Pack Size
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setEditingProduct(null);
                  setProdCode("");
                  setProdName("");
                  setProdHsn("21069099");
                  setProdTaxRate(5);
                  setShowProductModal(true);
                }}
                className="gap-1.5"
              >
                <PlusCircleIcon className="size-4" />
                Add Product
              </Button>
            </>
          )}
          {canManage && activeTab === "pricelists" && (
            <Button
              size="sm"
              onClick={() => {
                setPlCode("");
                setPlName("");
                setShowPriceListModal(true);
              }}
              className="gap-1.5"
            >
              <PlusCircleIcon className="size-4" />
              New Price List
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab("products")}
          className={`border-b-2 px-4 py-2 text-sm font-medium cursor-pointer ${
            activeTab === "products"
              ? "border-primary text-foreground font-semibold"
              : "border-transparent text-muted-foreground"
          }`}
        >
          Products & Variants ({allVariants.length})
        </button>
        <button
          onClick={() => setActiveTab("pricelists")}
          className={`border-b-2 px-4 py-2 text-sm font-medium cursor-pointer ${
            activeTab === "pricelists"
              ? "border-primary text-foreground font-semibold"
              : "border-transparent text-muted-foreground"
          }`}
        >
          Price Lists ({priceLists.length})
        </button>
      </div>

      {isLoading ? (
        <SkeletonTable rows={5} columns={6} />
      ) : isError ? (
        <ErrorState
          title="Failed to load products"
          description={error instanceof Error ? error.message : "Server error"}
          onRetry={() => refetch()}
        />
      ) : activeTab === "products" ? (
        <div className="flex flex-col gap-4">
          {products.map((prod) => (
            <div key={prod.id} className="rounded-xl border bg-card shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                <div className="flex items-center gap-2">
                  <PackageIcon className="size-4 text-muted-foreground" />
                  <span className="font-mono text-xs font-semibold">{prod.code}</span>
                  <span className="font-semibold text-sm">{prod.name}</span>
                  <Badge variant="outline" className="font-mono text-2xs">
                    HSN {prod.hsnCode} • {Number(prod.taxRate)}% GST
                  </Badge>
                  <Badge variant={prod.isActive ? "success" : "neutral"} className="text-2xs">
                    {prod.isActive ? "Active" : "Archived"}
                  </Badge>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs gap-1"
                      onClick={() => {
                        setEditingProduct(prod);
                        setProdCode(prod.code);
                        setProdName(prod.name);
                        setProdHsn(prod.hsnCode);
                        setProdTaxRate(Number(prod.taxRate));
                        setShowProductModal(true);
                      }}
                    >
                      <PencilIcon className="size-3" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs gap-1 text-muted-foreground"
                      onClick={() => toggleProductArchiveMutation.mutate(prod)}
                    >
                      <ArchiveIcon className="size-3" />
                      {prod.isActive ? "Archive" : "Restore"}
                    </Button>
                  </div>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Variant Name</TableHead>
                    <TableHead className="text-right">Pack Size</TableHead>
                    <TableHead className="text-right">Default Price</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prod.variants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-4">
                        No pack sizes configured for this product.
                      </TableCell>
                    </TableRow>
                  ) : (
                    prod.variants.map((v) => {
                      const defPrice = v.priceLines.find((pl) => pl.priceList.isDefault)?.price;
                      return (
                        <TableRow key={v.id}>
                          <TableCell className="font-mono text-xs">{v.sku}</TableCell>
                          <TableCell className="font-medium text-sm">{v.name}</TableCell>
                          <TableCell className="text-right text-xs">
                            {Number(v.packSize)} {v.uom?.symbol || ""}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-sm">
                            {defPrice !== undefined ? formatINR(Number(defPrice)) : "—"}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={v.isActive ? "success" : "neutral"} className="text-2xs">
                              {v.isActive ? "Active" : "Archived"}
                            </Badge>
                          </TableCell>
                          {canManage && (
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-xs gap-1"
                                onClick={() => {
                                  setEditingVariant(v);
                                  setVarProductId(v.productId);
                                  setVarSku(v.sku);
                                  setVarName(v.name);
                                  setVarPackSize(Number(v.packSize));
                                  setVarUomId(v.uomId);
                                  setShowVariantModal(true);
                                }}
                              >
                                <PencilIcon className="size-3" />
                                Edit
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {priceLists.map((pl) => (
            <div key={pl.id} className="rounded-xl border bg-card shadow-xs">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-2">
                  <TagIcon className="size-4 text-muted-foreground" />
                  <span className="font-mono text-xs font-semibold">{pl.code}</span>
                  <span className="font-semibold text-sm">{pl.name}</span>
                  {pl.isDefault && <Badge variant="success">Default</Badge>}
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Product Variant</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    {canManage && <TableHead className="text-right">Action</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allVariants.map((v) => {
                    const existingLine = pl.lines.find((l) => l.productVariantId === v.id);
                    const currentPrice = existingLine ? Number(existingLine.price) : 0;
                    return (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono text-xs">{v.sku}</TableCell>
                        <TableCell className="text-sm">{v.name}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {existingLine ? formatINR(currentPrice) : "Not set"}
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() =>
                                setEditingPriceLine({
                                  priceListId: pl.id,
                                  priceListName: pl.name,
                                  variantId: v.id,
                                  variantName: v.name,
                                  price: currentPrice,
                                })
                              }
                            >
                              Set Price
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ))}
        </div>
      )}

      {/* Product Modal */}
      <Dialog open={showProductModal} onOpenChange={setShowProductModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit Product" : "Add Product"}</DialogTitle>
            <DialogDescription>Configure product HSN code and GST rate.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            {!editingProduct && (
              <div className="flex flex-col gap-1">
                <Label htmlFor="prod-code" className="text-xs">Product Code</Label>
                <Input id="prod-code" value={prodCode} onChange={(e) => setProdCode(e.target.value)} placeholder="PROD-MURUKKU" />
              </div>
            )}
            <div className="flex flex-col gap-1">
              <Label htmlFor="prod-name" className="text-xs">Product Name</Label>
              <Input id="prod-name" value={prodName} onChange={(e) => setProdName(e.target.value)} placeholder="Murukku" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="prod-hsn" className="text-xs">HSN Code</Label>
                <Input id="prod-hsn" value={prodHsn} onChange={(e) => setProdHsn(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="prod-tax" className="text-xs">GST Rate (%)</Label>
                <Input id="prod-tax" type="number" step="0.5" value={prodTaxRate} onChange={(e) => setProdTaxRate(Number(e.target.value))} />
              </div>
            </div>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" size="sm" onClick={() => setShowProductModal(false)}>Cancel</Button>
            <Button size="sm" disabled={saveProductMutation.isPending} onClick={() => saveProductMutation.mutate()}>
              Save Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Variant Modal */}
      <Dialog open={showVariantModal} onOpenChange={setShowVariantModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingVariant ? "Edit Pack Size" : "Add Pack Size / Variant"}</DialogTitle>
            <DialogDescription>Define SKU, pack size, UOM, and default selling price.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            {!editingVariant && (
              <>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Product</Label>
                  <Select value={varProductId} onValueChange={setVarProductId}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="var-sku" className="text-xs">SKU</Label>
                  <Input id="var-sku" value={varSku} onChange={(e) => setVarSku(e.target.value)} placeholder="VAR-MURUKKU-500G" />
                </div>
              </>
            )}
            <div className="flex flex-col gap-1">
              <Label htmlFor="var-name" className="text-xs">Variant Name</Label>
              <Input id="var-name" value={varName} onChange={(e) => setVarName(e.target.value)} placeholder="Murukku 500 g" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="var-pack" className="text-xs">Pack Size</Label>
                <Input id="var-pack" type="number" value={varPackSize} onChange={(e) => setVarPackSize(Number(e.target.value))} />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Unit (UOM)</Label>
                <Select value={varUomId} onValueChange={setVarUomId}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {uoms.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name} ({u.symbol})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!editingVariant && (
              <div className="flex flex-col gap-1">
                <Label htmlFor="var-price" className="text-xs">Default Unit Price (₹)</Label>
                <Input id="var-price" type="number" step="0.01" value={varDefaultPrice} onChange={(e) => setVarDefaultPrice(Number(e.target.value))} />
              </div>
            )}
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" size="sm" onClick={() => setShowVariantModal(false)}>Cancel</Button>
            <Button size="sm" disabled={saveVariantMutation.isPending} onClick={() => saveVariantMutation.mutate()}>
              Save Variant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Price List Modal */}
      <Dialog open={showPriceListModal} onOpenChange={setShowPriceListModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Price List</DialogTitle>
            <DialogDescription>Add a new wholesale or retail price list.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="pl-code" className="text-xs">Code</Label>
              <Input id="pl-code" value={plCode} onChange={(e) => setPlCode(e.target.value)} placeholder="PL-RETAIL" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="pl-name" className="text-xs">Name</Label>
              <Input id="pl-name" value={plName} onChange={(e) => setPlName(e.target.value)} placeholder="Retail MRP" />
            </div>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" size="sm" onClick={() => setShowPriceListModal(false)}>Cancel</Button>
            <Button size="sm" disabled={createPriceListMutation.isPending} onClick={() => createPriceListMutation.mutate()}>
              Create Price List
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Price Line Modal */}
      <Dialog open={editingPriceLine !== null} onOpenChange={(o) => { if (!o) setEditingPriceLine(null); }}>
        {editingPriceLine && (
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Set Unit Price</DialogTitle>
              <DialogDescription>
                {editingPriceLine.priceListName} — {editingPriceLine.variantName}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1 py-2">
              <Label htmlFor="pl-line-price" className="text-xs">Unit Price (₹)</Label>
              <Input
                id="pl-line-price"
                type="number"
                step="0.01"
                min={0}
                value={editingPriceLine.price}
                onChange={(e) =>
                  setEditingPriceLine((prev) =>
                    prev ? { ...prev, price: Number(e.target.value) } : null,
                  )
                }
              />
            </div>
            <DialogFooter className="border-t pt-4">
              <Button variant="outline" size="sm" onClick={() => setEditingPriceLine(null)}>Cancel</Button>
              <Button size="sm" disabled={upsertPriceLineMutation.isPending} onClick={() => upsertPriceLineMutation.mutate()}>
                Save Price
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
