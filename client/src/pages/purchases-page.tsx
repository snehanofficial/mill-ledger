import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/use-current-user";
import { apiClient } from "@/lib/api-client";
import { formatDate, formatINR, formatQuantity } from "@/lib/formatters";
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
  PlusIcon,
  RefreshCwIcon,
  TruckIcon,
  CheckCircle2Icon,
} from "lucide-react";
import { toast } from "sonner";

interface PurchaseReceiptLine {
  id: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  inventoryItem: {
    id: string;
    sku: string;
    name: string;
    baseUom: { code: string; symbol: string };
  };
}

interface PurchaseReceipt {
  id: string;
  receiptNumber: string;
  supplierInvoiceNumber?: string;
  postedAt: string;
  notes?: string;
  supplier: { id: string; code: string; name: string };
  warehouse: { id: string; name: string };
  lines: PurchaseReceiptLine[];
}

interface InventoryItemBalance {
  id: string;
  sku: string;
  name: string;
  category: string;
  baseUom: { code: string; symbol: string };
}

interface Supplier {
  id: string;
  code: string;
  name: string;
}

export function PurchasesPage() {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const canRecordPurchase =
    user?.role === "ADMIN" || user?.role === "PRODUCTION";
  const [showModal, setShowModal] = useState(false);

  // Form states
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [quantity, setQuantity] = useState<number>(60);
  const [unitPrice, setUnitPrice] = useState<number>(45);
  const [receiptNumber, setReceiptNumber] = useState(
    () => `PR-2026-${Date.now().toString().slice(-4)}`,
  );
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState("INV-MANDI-01");
  const [notes, setNotes] = useState("Direct mandi intake");

  // Query receipts
  const { data, isLoading, isError, refetch, isFetching } = useQuery<{
    receipts: PurchaseReceipt[];
  }>({
    queryKey: ["purchase-receipts"],
    queryFn: async () => {
      const res = await apiClient.get(
        "/inventory/purchase-receipts?organizationId=MILL",
      );
      return res.data;
    },
  });

  // Query suppliers
  const { data: suppliersData } = useQuery<{ suppliers: Supplier[] }>({
    queryKey: ["inventory-suppliers"],
    queryFn: async () => {
      const res = await apiClient.get(
        "/inventory/suppliers?organizationId=MILL",
      );
      return res.data;
    },
  });

  // Query inventory items for raw materials
  const { data: itemsData } = useQuery<{ balances: InventoryItemBalance[] }>({
    queryKey: ["inventory-balances"],
    queryFn: async () => {
      const res = await apiClient.get(
        "/inventory/balances?organizationId=MILL",
      );
      return res.data;
    },
  });

  const suppliers = suppliersData?.suppliers || [];
  const rawItems =
    itemsData?.balances?.filter(
      (i) => i.category === "RAW_MATERIAL" || i.category === "PACKAGING",
    ) || [];

  const activeSupplier =
    suppliers.find((s) => s.id === selectedSupplierId) || suppliers[0];
  const activeItem =
    rawItems.find((i) => i.id === selectedItemId) || rawItems[0];

  const lineTotal = (Number(quantity) || 0) * (Number(unitPrice) || 0);

  // Submit purchase mutation
  const createReceiptMutation = useMutation({
    mutationFn: async () => {
      if (!activeSupplier || !activeItem) {
        throw new Error("Supplier and Inventory item are required");
      }

      const payload = {
        organizationId: "MILL",
        supplierId: activeSupplier.id,
        warehouseId: "WH-1",
        receiptNumber,
        supplierInvoiceNumber: supplierInvoiceNumber || undefined,
        notes: notes || undefined,
        items: [
          {
            inventoryItemId: activeItem.id,
            quantity: Number(quantity),
            unitPrice: Number(unitPrice),
            uomId: activeItem.baseUom?.code || "KG",
          },
        ],
      };

      const res = await apiClient.post(
        "/inventory/purchase-receipts",
        payload,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-receipts"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-balances"] });
      toast.success("Purchase receipt posted successfully.");
      setShowModal(false);
      setReceiptNumber(`PR-2026-${Date.now().toString().slice(-4)}`);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || err.message || "Failed to post receipt";
      toast.error(msg);
    },
  });

  const receipts = data?.receipts ?? [];

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Procurement & Mandi Intake
            </h1>
            <Badge variant="outline" className="text-xs">
              Live Ledger
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Mandi raw material receipts, supplier invoicing, and automated weighted-average cost updating.
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

          {canRecordPurchase && (
            <Button
              size="sm"
              onClick={() => setShowModal(true)}
              className="gap-1.5"
            >
              <PlusIcon className="size-4" />
              Record Purchase Receipt
            </Button>
          )}
        </div>
      </div>

      {/* Receipts Table Card */}
      <div className="rounded-xl border border-border bg-card shadow-xs">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <TruckIcon className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              Purchase Receipts Ledger
            </h2>
          </div>
          <span className="text-xs text-muted-foreground font-mono tabular-nums">
            {receipts.length} total recorded
          </span>
        </div>

        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <RefreshCwIcon className="size-6 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Loading receipts...</span>
            </div>
          </div>
        ) : isError ? (
          <div className="flex h-48 items-center justify-center p-6 text-center">
            <p className="text-sm text-destructive">
              Failed to load purchase receipts. Please verify network connection.
            </p>
          </div>
        ) : receipts.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center p-6 text-center">
            <TruckIcon className="size-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium text-foreground">
              No purchase receipts recorded yet
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Click &quot;Record Purchase Receipt&quot; to intake flour, oil, or raw materials.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Receipt #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Unit Rate</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
                <TableHead className="w-[100px] text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts.map((rec) => {
                const firstLine = rec.lines[0];
                const totalAmount = rec.lines.reduce(
                  (sum, l) => sum + Number(l.totalPrice),
                  0,
                );
                return (
                  <TableRow key={rec.id}>
                    <TableCell className="font-mono text-xs font-semibold">
                      {rec.receiptNumber}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(rec.postedAt)}
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {rec.supplier.name}
                    </TableCell>
                    <TableCell className="text-xs">
                      {firstLine?.inventoryItem.name || "Multiple items"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {formatQuantity(firstLine?.quantity || 0)}{" "}
                      {firstLine?.inventoryItem.baseUom?.symbol || "kg"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {formatINR(firstLine?.unitPrice || 0)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold tabular-nums">
                      {formatINR(totalAmount)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="success" className="text-[10px] gap-1">
                        <CheckCircle2Icon className="size-2.5" />
                        Posted
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Record Purchase Receipt Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Record Purchase Receipt
                </h3>
                <p className="text-xs text-muted-foreground">
                  Intake raw materials, update stock, and recalculate WAC.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowModal(false)}
              >
                ✕
              </Button>
            </div>

            <div className="mt-4 flex flex-col gap-4">
              {/* Supplier Selection */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Supplier / Mandi Vendor
                  </label>
                  <Link
                    to="/suppliers"
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    + Manage Suppliers
                  </Link>
                </div>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="rounded-md border bg-background px-3 py-2 text-sm font-medium"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                  {suppliers.length === 0 && (
                    <option value="">Supplier 1 (SUP-FLOUR-1)</option>
                  )}
                </select>
              </div>

              {/* Receipt Number & Invoice */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Receipt #
                  </label>
                  <input
                    type="text"
                    value={receiptNumber}
                    onChange={(e) => setReceiptNumber(e.target.value)}
                    className="rounded-md border bg-background px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Supplier Invoice #
                  </label>
                  <input
                    type="text"
                    value={supplierInvoiceNumber}
                    onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                    className="rounded-md border bg-background px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>

              {/* Item selection */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Raw Material Item
                </label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="rounded-md border bg-background px-3 py-2 text-sm font-medium"
                >
                  {rawItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.sku}) — {item.baseUom?.symbol || "units"}
                    </option>
                  ))}
                  {rawItems.length === 0 && (
                    <option value="">Flour (RM-FLOUR)</option>
                  )}
                </select>
              </div>

              {/* Quantity and Rate */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Quantity received
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="rounded-md border bg-background px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Unit Purchase Rate (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(Number(e.target.value))}
                    className="rounded-md border bg-background px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>

              {/* Calculated Line Total */}
              <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                <span className="text-xs font-medium text-muted-foreground">
                  Total Payable:
                </span>
                <span className="text-sm font-bold text-foreground font-mono tabular-nums">
                  {formatINR(lineTotal)}
                </span>
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Notes / Vehicle Details
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Mandi Lot #481, Truck TN-38-AX-1029"
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowModal(false)}
                disabled={createReceiptMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => createReceiptMutation.mutate()}
                disabled={createReceiptMutation.isPending}
              >
                {createReceiptMutation.isPending ? "Posting..." : "Post Purchase Receipt"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
