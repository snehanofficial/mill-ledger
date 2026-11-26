import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { useWarehouses } from "@/hooks/use-warehouses";
import { formatINR, formatQuantity } from "@/lib/formatters";
import { RecordHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PackageCheckIcon } from "lucide-react";
import { toast } from "sonner";

interface Supplier {
  id: string;
  name: string;
  code: string;
}

interface InventoryBalance {
  id: string;
  sku: string;
  name: string;
  category: string;
  onHand: number;
  weightedAverageCost: number;
  baseUom?: { code: string };
}

export function NewPurchasePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: warehousesData } = useWarehouses();
  const warehouses = warehousesData?.warehouses ?? [];

  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [itemId, setItemId] = useState("");
  const [receiptNumber, setReceiptNumber] = useState(
    `PR-2026-${Date.now().toString().slice(-4)}`,
  );
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState("");
  const [quantity, setQuantity] = useState("60");
  const [unitPrice, setUnitPrice] = useState("45");
  const [notes, setNotes] = useState("");

  const { data: suppliersData } = useQuery<{ suppliers: Supplier[] }>({
    queryKey: ["inventory-suppliers"],
    queryFn: async () => {
      const res = await apiClient.get("/inventory/suppliers");
      return res.data;
    },
  });

  const { data: itemsData } = useQuery<{ balances: InventoryBalance[] }>({
    queryKey: ["inventory-balances"],
    queryFn: async () => {
      const res = await apiClient.get("/inventory/balances");
      return res.data;
    },
  });

  const suppliers = suppliersData?.suppliers ?? [];
  const rawItems = (itemsData?.balances ?? []).filter(
    (i) => i.category === "RAW_MATERIAL" || i.category === "PACKAGING",
  );

  const activeSupplier =
    suppliers.find((s) => s.id === supplierId) ?? suppliers[0];
  const activeWarehouse =
    warehouses.find((w) => w.id === warehouseId) ?? warehouses[0];
  const activeItem = rawItems.find((i) => i.id === itemId) ?? rawItems[0];

  const qtyNum = Number(quantity) || 0;
  const priceNum = Number(unitPrice) || 0;
  const lineTotal = qtyNum * priceNum;

  const postReceiptMutation = useMutation({
    mutationFn: async () => {
      if (!activeSupplier || !activeWarehouse || !activeItem) {
        throw new Error("Supplier, warehouse, and material item are required.");
      }
      const res = await apiClient.post("/inventory/purchase-receipts", {
        supplierId: activeSupplier.id,
        warehouseId: activeWarehouse.id,
        receiptNumber: receiptNumber.trim(),
        supplierInvoiceNumber: supplierInvoiceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        items: [
          {
            inventoryItemId: activeItem.id,
            quantity: qtyNum,
            unitPrice: priceNum,
            uomId: activeItem.baseUom?.code || "KG",
          },
        ],
      });
      return res.data;
    },
    onSuccess: (resData) => {
      queryClient.invalidateQueries({ queryKey: ["purchase-receipts"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-balances"] });
      const id = resData?.receipt?.id ?? resData?.id;
      toast.success("Purchase receipt posted and stock updated.");
      navigate(id ? `/purchases/${id}` : "/purchases");
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to post purchase receipt."));
    },
  });

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-4xl">
      <RecordHeader
        backTo="/purchases"
        backLabel="Back to Purchase receipts"
        reference="Receive materials"
        subtitle="Record a supplier material receipt. Posting updates stock balances and moving weighted-average cost."
      />

      <div className="rounded-lg border border-border bg-card p-4 sm:p-6 space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pr-supplier">Supplier</Label>
            <Select
              value={activeSupplier?.id ?? ""}
              onValueChange={setSupplierId}
            >
              <SelectTrigger id="pr-supplier">
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pr-warehouse">Destination warehouse</Label>
            <Select
              value={activeWarehouse?.id ?? ""}
              onValueChange={setWarehouseId}
            >
              <SelectTrigger id="pr-warehouse">
                <SelectValue placeholder="Select warehouse" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pr-number">Receipt number</Label>
            <Input
              id="pr-number"
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pr-sup-inv">Supplier invoice / bill ref</Label>
            <Input
              id="pr-sup-inv"
              value={supplierInvoiceNumber}
              onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
              placeholder="e.g., INV-SUP-102"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="pr-item">Material / Packaging item</Label>
            <Select value={activeItem?.id ?? ""} onValueChange={setItemId}>
              <SelectTrigger id="pr-item">
                <SelectValue placeholder="Select item" />
              </SelectTrigger>
              <SelectContent>
                {rawItems.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name} ({i.baseUom?.code ?? "unit"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pr-qty">
              Quantity ({activeItem?.baseUom?.code ?? "unit"})
            </Label>
            <Input
              id="pr-qty"
              type="number"
              min={0.01}
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="tabular-nums"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pr-rate">Rate per {activeItem?.baseUom?.code ?? "unit"} (₹)</Label>
            <Input
              id="pr-rate"
              type="number"
              min={0}
              step="0.01"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              className="tabular-nums"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pr-notes">Notes (optional)</Label>
          <Textarea
            id="pr-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Vehicle, quality check, or mandi batch notes"
          />
        </div>

        {/* Impact Preview */}
        <div className="rounded-md border border-border bg-muted/40 p-4 text-sm space-y-1">
          <div className="font-semibold text-foreground">Posting impact preview</div>
          {activeItem && (
            <div className="text-muted-foreground">
              {activeItem.name}: On-hand changes from{" "}
              <strong className="text-foreground tabular-nums">
                {formatQuantity(activeItem.onHand, { unit: activeItem.baseUom?.code ?? "unit" })}
              </strong>{" "}
              to{" "}
              <strong className="text-foreground tabular-nums">
                {formatQuantity(
                  Number(activeItem.onHand) + qtyNum,
                  { unit: activeItem.baseUom?.code ?? "unit" },
                )}
              </strong>
              . Receipt value:{" "}
              <strong className="text-foreground tabular-nums">
                {formatINR(lineTotal)}
              </strong>
              .
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => navigate("/purchases")}
            disabled={postReceiptMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => postReceiptMutation.mutate()}
            disabled={
              qtyNum <= 0 ||
              priceNum < 0 ||
              !activeSupplier ||
              !activeItem ||
              postReceiptMutation.isPending
            }
            className="gap-1.5"
          >
            <PackageCheckIcon className="size-4" aria-hidden="true" />
            {postReceiptMutation.isPending ? "Posting..." : "Post receipt"}
          </Button>
        </div>
      </div>
    </div>
  );
}
