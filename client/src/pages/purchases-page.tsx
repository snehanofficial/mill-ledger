import { useState } from "react";
import { Link } from "react-router-dom";
import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PaginationMeta } from "@mill-ledger/shared";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useWarehouses } from "@/hooks/use-warehouses";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { useUrlState } from "@/hooks/use-url-state";
import { usePagination } from "@/hooks/use-pagination";
import { formatDate, formatINR, formatQuantity } from "@/lib/formatters";
import { useLanguage } from "@/lib/i18n";
import type { ColumnDef } from "@tanstack/react-table";
import { DataPagination } from "@/components/ui/data-pagination";
import {
  DataTable,
  DataTableColumnHeader,
  type DataTableColumnMeta,
} from "@/components/ui/data-table";
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
  PlusIcon,
  RefreshCwIcon,
  TruckIcon,
  CheckCircle2Icon,
  EyeIcon,
  FileWarningIcon,
  RotateCcwIcon,
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
  status?: string;
  postedAt: string;
  notes?: string;
  supplier: { id: string; code: string; name: string };
  warehouse: { id: string; name: string };
  lines: PurchaseReceiptLine[];
}

interface DebitNoteItem {
  id: string;
  debitNoteNumber: string;
  postedAt: string;
  reason: string;
  taxableAmount: number | string;
  taxAmount: number | string;
  totalAmount: number | string;
  supplier: { id: string; code: string; name: string };
  purchaseReceipt?: { id: string; receiptNumber: string } | null;
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
  const { t } = useLanguage();
  const canRecordPurchase =
    user?.role === "ADMIN" || user?.role === "PRODUCTION";
  const canManageAdminPurchase = user?.role === "ADMIN";
  const [showModal, setShowModal] = useState(false);
  const [receiptStep, setReceiptStep] = useState<"form" | "confirm">("form");
  const [detailReceipt, setDetailReceipt] = useState<PurchaseReceipt | null>(null);
  const [debitNoteTarget, setDebitNoteTarget] = useState<PurchaseReceipt | null>(null);
  const [debitNoteReason, setDebitNoteReason] = useState("");
  const [debitNoteAmount, setDebitNoteAmount] = useState(0);
  const [reverseReason, setReverseReason] = useState("");
  const [searchQuery, setSearchQuery] = useUrlState("q", "", {
    debounceMs: 250,
  });

  // Form states
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [quantity, setQuantity] = useState<number>(60);
  const [unitPrice, setUnitPrice] = useState<number>(45);
  const [receiptNumber, setReceiptNumber] = useState(
    () => `PR-2026-${Date.now().toString().slice(-4)}`,
  );
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState("INV-MANDI-01");
  const [notes, setNotes] = useState("Direct mandi intake");

  const { data: warehousesData } = useWarehouses();
  const warehouses = warehousesData?.warehouses || [];
  const activeWarehouse =
    warehouses.find((w) => w.id === selectedWarehouseId) || warehouses[0];

  // Query receipts
  const { page, pageSize, offset, setPage, setPageSize, resetPage } =
    usePagination({ defaultPageSize: 20 });
  const {
    page: dnPage,
    pageSize: dnPageSize,
    offset: dnOffset,
    setPage: setDnPage,
    setPageSize: setDnPageSize,
  } = usePagination({ defaultPageSize: 10, prefix: "dn" });

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{
    receipts: PurchaseReceipt[];
    pagination: PaginationMeta;
  }>({
    queryKey: ["purchase-receipts", page, pageSize, searchQuery.trim()],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset),
      });
      if (searchQuery.trim()) {
        params.set("q", searchQuery.trim());
      }
      const res = await apiClient.get(
        `/inventory/purchase-receipts?${params.toString()}`,
      );
      return res.data;
    },
    placeholderData: keepPreviousData,
  });

  // Query suppliers
  const { data: suppliersData } = useQuery<{ suppliers: Supplier[] }>({
    queryKey: ["inventory-suppliers", "all-for-select"],
    queryFn: async () => {
      const res = await apiClient.get("/inventory/suppliers?limit=100");
      return res.data;
    },
  });

  // Query inventory items for raw materials
  const { data: itemsData } = useQuery<{ balances: InventoryItemBalance[] }>({
    queryKey: ["inventory-balances", "all-for-select"],
    queryFn: async () => {
      const res = await apiClient.get("/inventory/balances?limit=100");
      return res.data;
    },
  });

  // Query debit notes
  const { data: debitNotesData, isFetching: isFetchingDebitNotes } = useQuery<{
    debitNotes: DebitNoteItem[];
    pagination: PaginationMeta;
  }>({
    queryKey: ["debit-notes", dnPage, dnPageSize],
    queryFn: async () => {
      const res = await apiClient.get(
        `/finance/debit-notes?limit=${dnPageSize}&offset=${dnOffset}`,
      );
      return res.data;
    },
    placeholderData: keepPreviousData,
  });

  const debitNotes = debitNotesData?.debitNotes || [];
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
      if (!activeSupplier || !activeItem || !activeWarehouse) {
        throw new Error("Supplier, warehouse, and inventory item are required");
      }

      const payload = {
        supplierId: activeSupplier.id,
        warehouseId: activeWarehouse.id,
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
      setReceiptStep("form");
      setShowModal(false);
      toast.success("Purchase receipt posted successfully.");
      setReceiptNumber(`PR-2026-${Date.now().toString().slice(-4)}`);
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to post receipt"));
    },
  });

  const receipts = data?.receipts ?? [];

  const filteredReceipts = receipts.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      r.receiptNumber.toLowerCase().includes(q) ||
      r.supplier.name.toLowerCase().includes(q) ||
      r.lines.some(
        (l) =>
          l.inventoryItem?.name?.toLowerCase().includes(q) ||
          l.inventoryItem?.sku?.toLowerCase().includes(q),
      ) ||
      (r.supplierInvoiceNumber && r.supplierInvoiceNumber.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {t("Procurement & Mandi Intake")}
            </h1>
            <Badge variant="outline" className="text-xs">
              {t("Live Ledger")}
            </Badge>
          </div>
          <p className="max-w-[60ch] text-sm text-muted-foreground">
            {t("Mandi raw material receipts, supplier invoicing, and automated weighted-average cost updating.")}
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
            <RefreshCwIcon
              className={`size-3.5 ${isFetching ? "animate-spin" : ""}`}
            />
            {t("Refresh")}
          </Button>

          {canRecordPurchase && (
            <Button
              size="sm"
              onClick={() => setShowModal(true)}
              className="gap-1.5"
            >
              <PlusIcon className="size-4" />
              {t("Record Purchase Receipt")}
            </Button>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("Total Recorded Receipts")}
          </span>
          <span className="text-2xl font-bold tracking-tight text-foreground">
            {receipts.length}
          </span>
        </div>
      </div>

      {/* Receipts Table Card */}
      <div className="rounded-xl border border-border bg-card shadow-xs">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <TruckIcon className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              {t("Purchase Receipts Ledger")}
            </h2>
            <span className="text-xs text-muted-foreground font-mono tabular-nums">
              ({filteredReceipts.length} of {receipts.length})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Input
              placeholder={t("Search receipts...")}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                resetPage();
              }}
              className="h-8 w-56 text-xs"
              aria-label="Search purchase receipts"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-4">
            <SkeletonTable rows={5} columns={8} />
          </div>
        ) : isError ? (
          <div className="p-4">
            <ErrorState
              title={t("Failed to load purchase receipts", "Failed to load purchase receipts")}
              description={
                error instanceof Error ? error.message : "Failed to load purchase receipts. Please verify network connection."
              }
              error={error}
              onRetry={() => refetch()}
            />
          </div>
        ) : receipts.length === 0 ? (
          <EmptyState
            icon={TruckIcon}
            title="No purchase receipts recorded yet"
            description="Record a purchase receipt to intake flour, oil, or raw materials."
            action={
              canRecordPurchase ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowModal(true)}
                  className="gap-1.5"
                >
                  <PlusIcon className="size-4" aria-hidden="true" />
                  Record Purchase Receipt
                </Button>
              ) : undefined
            }
          />
        ) : filteredReceipts.length === 0 && receipts.length > 0 ? (
          <EmptyState
            title={t("No purchase receipts match the search query.")}
            description="Clear the search query to view all purchase receipts."
            className="min-h-32 py-6"
            action={
              <Button
                variant="tertiary"
                size="sm"
                onClick={() => setSearchQuery("")}
              >
                Clear search
              </Button>
            }
          />
        ) : (
          <div className="p-4">
            <DataTable
              tableId="purchase-receipts"
              data={filteredReceipts}
              getRowId={(r) => r.id}
              ariaLabel="Purchase receipts"
              csvFilename="purchase-receipts"
              columns={
                [
                  {
                    accessorKey: "receiptNumber",
                    enableHiding: false,
                    header: ({ column }) => (
                      <DataTableColumnHeader column={column} title={t("Receipt #")} />
                    ),
                    cell: ({ row }) => (
                      <Link
                        to={`/purchases/${row.original.id}`}
                        className="font-mono text-xs font-semibold text-primary hover:underline whitespace-nowrap"
                      >
                        {row.original.receiptNumber}
                      </Link>
                    ),
                    meta: { label: "Receipt #" } satisfies DataTableColumnMeta<PurchaseReceipt>,
                  },
                  {
                    id: "postedAt",
                    accessorFn: (row) => new Date(row.postedAt).getTime() || 0,
                    header: ({ column }) => (
                      <DataTableColumnHeader column={column} title={t("Date")} />
                    ),
                    cell: ({ row }) => (
                      <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                        {formatDate(row.original.postedAt)}
                      </span>
                    ),
                    meta: {
                      label: "Date",
                      exportValue: (r) => formatDate(r.postedAt),
                    } satisfies DataTableColumnMeta<PurchaseReceipt>,
                  },
                  {
                    id: "supplier",
                    accessorFn: (row) => row.supplier.name,
                    header: ({ column }) => (
                      <DataTableColumnHeader column={column} title={t("Supplier")} />
                    ),
                    cell: ({ row }) => (
                      <span className="font-medium text-sm min-w-[140px] block">
                        {row.original.supplier.name}
                      </span>
                    ),
                    meta: { label: "Supplier" } satisfies DataTableColumnMeta<PurchaseReceipt>,
                  },
                  {
                    id: "item",
                    accessorFn: (row) =>
                      row.lines[0]?.inventoryItem.name || "Multiple items",
                    header: ({ column }) => (
                      <DataTableColumnHeader column={column} title={t("Item")} />
                    ),
                    cell: ({ row }) => (
                      <span className="text-xs">
                        {row.original.lines[0]?.inventoryItem.name || "Multiple items"}
                      </span>
                    ),
                    meta: { label: "Item" } satisfies DataTableColumnMeta<PurchaseReceipt>,
                  },
                  {
                    id: "quantity",
                    accessorFn: (row) => Number(row.lines[0]?.quantity || 0),
                    header: ({ column }) => (
                      <DataTableColumnHeader column={column} title={t("Quantity")} align="right" />
                    ),
                    cell: ({ row }) => {
                      const firstLine = row.original.lines[0];
                      return (
                        <span className="font-mono text-xs tabular-nums whitespace-nowrap">
                          {formatQuantity(firstLine?.quantity || 0)}{" "}
                          {firstLine?.inventoryItem.baseUom?.symbol || "kg"}
                        </span>
                      );
                    },
                    meta: {
                      label: "Quantity",
                      align: "right",
                      exportValue: (r) => Number(r.lines[0]?.quantity || 0),
                    } satisfies DataTableColumnMeta<PurchaseReceipt>,
                  },
                  {
                    id: "unitRate",
                    accessorFn: (row) => Number(row.lines[0]?.unitPrice || 0),
                    header: ({ column }) => (
                      <DataTableColumnHeader column={column} title={t("Unit Rate")} align="right" />
                    ),
                    cell: ({ row }) => (
                      <span className="font-mono text-xs tabular-nums whitespace-nowrap">
                        {formatINR(row.original.lines[0]?.unitPrice || 0)}
                      </span>
                    ),
                    meta: {
                      label: "Unit Rate",
                      align: "right",
                      exportValue: (r) => Number(r.lines[0]?.unitPrice || 0),
                    } satisfies DataTableColumnMeta<PurchaseReceipt>,
                  },
                  {
                    id: "totalAmount",
                    accessorFn: (row) =>
                      row.lines.reduce((sum, l) => sum + Number(l.totalPrice), 0),
                    header: ({ column }) => (
                      <DataTableColumnHeader column={column} title={t("Total Amount")} align="right" />
                    ),
                    cell: ({ row }) => {
                      const totalAmount = row.original.lines.reduce(
                        (sum, l) => sum + Number(l.totalPrice),
                        0,
                      );
                      return (
                        <span className="font-mono text-xs font-semibold tabular-nums whitespace-nowrap">
                          {formatINR(totalAmount)}
                        </span>
                      );
                    },
                    meta: {
                      label: "Total Amount",
                      align: "right",
                      exportValue: (r) =>
                        r.lines.reduce((sum, l) => sum + Number(l.totalPrice), 0),
                    } satisfies DataTableColumnMeta<PurchaseReceipt>,
                  },
                  {
                    accessorKey: "status",
                    header: ({ column }) => (
                      <DataTableColumnHeader column={column} title={t("Status")} align="center" />
                    ),
                    cell: ({ row }) =>
                      row.original.status === "REVERSED" ? (
                        <Badge variant="danger" className="text-[10px] gap-1 whitespace-nowrap">
                          <RotateCcwIcon className="size-2.5" aria-hidden="true" />
                          Reversed
                        </Badge>
                      ) : (
                        <Badge variant="success" className="text-[10px] gap-1 whitespace-nowrap">
                          <CheckCircle2Icon className="size-2.5" aria-hidden="true" />
                          Posted
                        </Badge>
                      ),
                    meta: {
                      label: "Status",
                      align: "center",
                    } satisfies DataTableColumnMeta<PurchaseReceipt>,
                  },
                  {
                    id: "actions",
                    enableSorting: false,
                    enableHiding: false,
                    header: () => <span>{t("Actions")}</span>,
                    cell: ({ row }) => {
                      const rec = row.original;
                      const totalAmount = rec.lines.reduce(
                        (sum, l) => sum + Number(l.totalPrice),
                        0,
                      );
                      return (
                        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDetailReceipt(rec)}
                            className="h-7 px-2 text-xs gap-1"
                          >
                            <EyeIcon className="size-3" aria-hidden="true" />
                            View
                          </Button>
                          {canManageAdminPurchase && rec.status !== "REVERSED" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setDebitNoteTarget(rec);
                                setDebitNoteReason("");
                                setDebitNoteAmount(totalAmount);
                              }}
                              className="h-7 px-2 text-xs gap-1"
                            >
                              <FileWarningIcon className="size-3" aria-hidden="true" />
                              Debit Note
                            </Button>
                          )}
                        </div>
                      );
                    },
                    meta: {
                      label: "Actions",
                      align: "right",
                    } satisfies DataTableColumnMeta<PurchaseReceipt>,
                  },
                ] satisfies ColumnDef<PurchaseReceipt, unknown>[]
              }
            />
          </div>
        )}
      </div>

      <DataPagination
        pagination={data?.pagination}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        isFetching={isFetching}
        itemLabel="receipts"
      />

      {/* Issued Supplier Debit Notes */}
      {debitNotes.length > 0 && (
        <div className="rounded-xl border border-border bg-card shadow-xs">
          <div className="flex items-center justify-between border-b border-border p-4">
            <div className="flex items-center gap-2">
              <FileWarningIcon className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">
                Supplier Debit Notes
              </h2>
              <span className="text-xs text-muted-foreground font-mono tabular-nums">
                ({debitNotes.length})
              </span>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Debit Note #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Receipt #</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {debitNotes.map((dn) => (
                <TableRow key={dn.id}>
                  <TableCell className="font-mono text-xs font-semibold">
                    {dn.debitNoteNumber}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(dn.postedAt)}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {dn.supplier.name}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {dn.purchaseReceipt?.receiptNumber || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {dn.reason}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-semibold tabular-nums">
                    {formatINR(Number(dn.totalAmount))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <DataPagination
            pagination={debitNotesData?.pagination}
            page={dnPage}
            pageSize={dnPageSize}
            onPageChange={setDnPage}
            onPageSizeChange={setDnPageSize}
            isFetching={isFetchingDebitNotes}
            itemLabel="debit notes"
            className="m-4"
          />
        </div>
      )}

      {/* Record Purchase Receipt Modal (single-dialog two-step flow) */}
      <Dialog
        open={showModal}
        onOpenChange={(open) => {
          setShowModal(open);
          if (!open) setReceiptStep("form");
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className={receiptStep === "confirm" ? "flex items-center gap-2" : undefined}>
              {receiptStep === "confirm" ? (
                <>
                  <TruckIcon className="h-5 w-5 text-primary shrink-0" aria-hidden="true" />
                  <span>Confirm Purchase Receipt Posting</span>
                </>
              ) : (
                "Record Purchase Receipt"
              )}
            </DialogTitle>
            <DialogDescription>
              {receiptStep === "confirm"
                ? "Review the inward goods receipt and accounts payable details before posting."
                : "Intake raw materials, update stock, and recalculate WAC."}
            </DialogDescription>
          </DialogHeader>

          {receiptStep === "form" ? (
            <>

          <div className="mt-2 flex flex-col gap-4">
              {/* Supplier Selection */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="purchase-supplier-select"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Supplier / Mandi Vendor
                  </Label>
                  <Link
                    to="/suppliers"
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    + Manage Suppliers
                  </Link>
                </div>
                <Select
                  value={activeSupplier?.id || undefined}
                  onValueChange={setSelectedSupplierId}
                >
                  <SelectTrigger id="purchase-supplier-select" className="font-medium">
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent
                    searchable
                    searchPlaceholder="Search suppliers..."
                    emptyMessage="No suppliers available."
                    emptyAction={
                      canManageAdminPurchase ? (
                        <Link
                          to="/suppliers"
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          + Add Supplier
                        </Link>
                      ) : undefined
                    }
                  >
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Warehouse selection */}
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="purchase-warehouse-select"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  Receiving Warehouse
                </Label>
                <Select
                  value={activeWarehouse?.id || undefined}
                  onValueChange={setSelectedWarehouseId}
                >
                  <SelectTrigger id="purchase-warehouse-select">
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.code} · {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Receipt Number & Invoice */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="purchase-receipt-number-input"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Receipt #
                  </Label>
                  <Input
                    id="purchase-receipt-number-input"
                    type="text"
                    value={receiptNumber}
                    onChange={(e) => setReceiptNumber(e.target.value)}
                    className="font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="purchase-supplier-invoice-input"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Supplier Invoice #
                  </Label>
                  <Input
                    id="purchase-supplier-invoice-input"
                    type="text"
                    value={supplierInvoiceNumber}
                    onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                    className="font-mono"
                  />
                </div>
              </div>

              {/* Item selection */}
              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="purchase-item-select"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  Raw Material Item
                </Label>
                <Select
                  value={activeItem?.id || undefined}
                  onValueChange={setSelectedItemId}
                >
                  <SelectTrigger id="purchase-item-select" className="font-medium">
                    <SelectValue placeholder="Select raw material or packaging item" />
                  </SelectTrigger>
                  <SelectContent
                    searchable
                    searchPlaceholder="Search raw materials..."
                    emptyMessage="No raw material items available."
                    emptyAction={
                      canManageAdminPurchase ? (
                        <Link
                          to="/stock"
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          + Add Item in Stock
                        </Link>
                      ) : undefined
                    }
                  >
                    {rawItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.sku}) · {item.baseUom?.symbol || "units"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Quantity and Rate */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="purchase-quantity-input"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Quantity received
                  </Label>
                  <Input
                    id="purchase-quantity-input"
                    type="number"
                    step="1"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="purchase-unit-price-input"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Unit Purchase Rate (₹)
                  </Label>
                  <Input
                    id="purchase-unit-price-input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(Number(e.target.value))}
                    className="font-mono"
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
                <Label
                  htmlFor="purchase-notes-input"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  Notes / Vehicle Details
                </Label>
                <Input
                  id="purchase-notes-input"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Mandi Lot #481, Truck TN-38-AX-1029"
                />
              </div>
            </div>

            <DialogFooter className="mt-6 border-t border-border pt-4">
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
                onClick={() => {
                  if (!activeSupplier) {
                    toast.error("Please select a supplier");
                    return;
                  }
                  if (!activeItem) {
                    toast.error("Please select an inventory item");
                    return;
                  }
                  if (!Number(quantity) || Number(quantity) <= 0) {
                    toast.error("Please enter a valid quantity greater than zero");
                    return;
                  }
                  if (Number(unitPrice) < 0) {
                    toast.error("Unit price cannot be negative");
                    return;
                  }
                  setReceiptStep("confirm");
                }}
                disabled={createReceiptMutation.isPending}
                className="gap-2"
              >
                <CheckCircle2Icon className="h-4 w-4" />
                Review & confirm
              </Button>
            </DialogFooter>
            </>
          ) : activeSupplier && activeItem ? (
            <>
              <div className="mt-2 flex flex-col gap-3">
                <p className="text-sm text-foreground">
                  You are about to record an inward goods receipt and book supplier accounts payable.
                </p>
                <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Receipt Number:</span>
                    <span className="font-mono font-medium text-foreground">{receiptNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Supplier:</span>
                    <span className="font-semibold text-foreground">{activeSupplier.name}</span>
                  </div>
                  {supplierInvoiceNumber && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Supplier Inv #:</span>
                      <span className="font-mono">{supplierInvoiceNumber}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Inward Item:</span>
                    <span className="font-medium text-foreground">{activeItem.name} ({activeItem.sku})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Quantity:</span>
                    <span className="font-mono font-medium">
                      {formatQuantity(Number(quantity))} {activeItem.baseUom?.code || "KG"}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-border/50 pt-1 font-semibold">
                    <span className="text-foreground">Total Inward Value:</span>
                    <span className="font-mono text-foreground">{formatINR(lineTotal)}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Legal & financial warning: This transaction increases physical inventory balances and generates an accounts payable liability in the general ledger. Posted receipts cannot be deleted.
                </p>
              </div>
              <DialogFooter className="mt-6 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setReceiptStep("form")}
                  disabled={createReceiptMutation.isPending}
                >
                  Back to Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={createReceiptMutation.isPending}
                  onClick={() => createReceiptMutation.mutate()}
                >
                  {createReceiptMutation.isPending ? "Posting..." : "Confirm & Post Inward Goods"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Purchase Receipt Detail & Reversal Modal (IMP-015) */}
      <Dialog
        open={detailReceipt !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailReceipt(null);
            setReverseReason("");
          }
        }}
      >
        {detailReceipt && (
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Purchase Receipt {detailReceipt.receiptNumber}</DialogTitle>
              <DialogDescription>
                {detailReceipt.supplier.name} ({detailReceipt.supplier.code}) · {formatDate(detailReceipt.postedAt)}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 text-xs">
              <div className="rounded-lg bg-muted/40 p-3 flex flex-col gap-1">
                <div>Warehouse: <strong>{detailReceipt.warehouse.name}</strong></div>
                <div>Supplier Invoice: <strong className="font-mono">{detailReceipt.supplierInvoiceNumber || "—"}</strong></div>
                <div>Notes: {detailReceipt.notes || "—"}</div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailReceipt.lines.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{l.inventoryItem.name}</TableCell>
                      <TableCell className="text-right font-mono">{Number(l.quantity)} {l.inventoryItem.baseUom?.symbol}</TableCell>
                      <TableCell className="text-right">{formatINR(l.unitPrice)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatINR(l.totalPrice)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {canManageAdminPurchase && detailReceipt.status !== "REVERSED" && (
                <div className="flex flex-col gap-1.5 border-t pt-3">
                  <Label htmlFor="pr-reverse-reason" className="text-xs">
                    Reversal Reason (optional, reverses stock if unconsumed)
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="pr-reverse-reason"
                      value={reverseReason}
                      onChange={(e) => setReverseReason(e.target.value)}
                      placeholder="e.g. Duplicate receipt entry"
                      className="h-8 text-xs"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={!reverseReason.trim()}
                      onClick={async () => {
                        try {
                          await apiClient.post(
                            `/inventory/purchase-receipts/${detailReceipt.id}/reverse`,
                            { reason: reverseReason.trim() },
                          );
                          queryClient.invalidateQueries({ queryKey: ["purchase-receipts"] });
                          queryClient.invalidateQueries({ queryKey: ["inventory-balances"] });
                          setDetailReceipt(null);
                          toast.success("Purchase receipt reversed.");
                        } catch (err) {
                          toast.error(extractErrorMessage(err, "Failed to reverse receipt"));
                        }
                      }}
                      className="h-8 gap-1 text-xs shrink-0"
                    >
                      <RotateCcwIcon className="size-3.5" />
                      Reverse
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="border-t pt-4">
              <Button variant="outline" size="sm" onClick={() => setDetailReceipt(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Issue Debit Note Modal (IMP-015) */}
      <Dialog
        open={debitNoteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDebitNoteTarget(null);
        }}
      >
        {debitNoteTarget && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Issue Supplier Debit Note</DialogTitle>
              <DialogDescription>
                Against {debitNoteTarget.receiptNumber} · {debitNoteTarget.supplier.name}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 py-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="dn-amount" className="text-xs">Taxable Amount (₹)</Label>
                <Input
                  id="dn-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={debitNoteAmount}
                  onChange={(e) => setDebitNoteAmount(Number(e.target.value))}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="dn-reason" className="text-xs">Reason</Label>
                <Input
                  id="dn-reason"
                  value={debitNoteReason}
                  onChange={(e) => setDebitNoteReason(e.target.value)}
                  placeholder="Quality deduction / short weight"
                />
              </div>
            </div>
            <DialogFooter className="border-t pt-4">
              <Button variant="outline" size="sm" onClick={() => setDebitNoteTarget(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!debitNoteReason.trim() || debitNoteAmount <= 0}
                onClick={async () => {
                  try {
                    await apiClient.post("/finance/debit-notes", {
                      supplierId: debitNoteTarget.supplier.id,
                      purchaseReceiptId: debitNoteTarget.id,
                      reason: debitNoteReason.trim(),
                      taxableAmount: debitNoteAmount,
                      taxAmount: 0,
                      totalAmount: debitNoteAmount,
                    });
                    queryClient.invalidateQueries({ queryKey: ["debit-notes"] });
                    setDebitNoteTarget(null);
                    toast.success("Debit note issued.");
                  } catch (err) {
                    toast.error(extractErrorMessage(err, "Failed to issue debit note"));
                  }
                }}
              >
                Issue Debit Note
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
