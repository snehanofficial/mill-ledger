import { useState } from "react";
import {
  keepPreviousData,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import type { PaginationMeta } from "@mill-ledger/shared";
import { apiClient } from "@/lib/api-client";
import { assertCollectionResponse } from "@/lib/api-contracts";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useUrlState } from "@/hooks/use-url-state";
import { usePagination } from "@/hooks/use-pagination";
import { useLanguage } from "@/lib/i18n";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExportMenu } from "@/components/ui/export-menu";
import { Checkbox } from "@/components/ui/checkbox";
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
  RefreshCwIcon,
  CheckCircle2Icon,
  MapPinIcon,
  PlusCircleIcon,
  PhoneIcon,
  MailIcon,
  SearchIcon,
  Edit2Icon,
  EyeIcon,
  ArchiveIcon,
} from "lucide-react";
import { toast } from "sonner";
import { validateGstin } from "@mill-ledger/shared";

interface Supplier {
  id: string;
  code: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  state: string;
  gstin?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function SuppliersPage() {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const { t } = useLanguage();
  const canManageSuppliers =
    user?.role === "ADMIN" || user?.role === "PRODUCTION";
  const [detailSupplier, setDetailSupplier] = useState<Supplier | null>(null);

  const [searchQuery, setSearchQuery] = useUrlState("q", "", {
    debounceMs: 250,
  });
  const [statusFilter, setStatusFilter] = useUrlState<
    "ALL" | "ACTIVE" | "INACTIVE"
  >("status", "ALL");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Form states for Add Supplier
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [state, setState] = useState("Tamil Nadu");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gstin, setGstin] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Fetch suppliers
  const { page, pageSize, offset, setPage, setPageSize, resetPage } =
    usePagination({ defaultPageSize: 20 });

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{
    suppliers: Supplier[];
    pagination: PaginationMeta;
  }>({
    queryKey: [
      "inventory-suppliers",
      page,
      pageSize,
      statusFilter,
      searchQuery.trim(),
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        includeInactive: "true",
        limit: String(pageSize),
        offset: String(offset),
      });
      if (statusFilter !== "ALL") {
        params.set("status", statusFilter);
      }
      if (searchQuery.trim()) {
        params.set("q", searchQuery.trim());
      }
      const res = await apiClient.get(
        `/inventory/suppliers?${params.toString()}`,
      );
      return assertCollectionResponse(
        res.data,
        "suppliers",
        "/inventory/suppliers",
      );
    },
    placeholderData: keepPreviousData,
  });

  // Create supplier mutation
  const createSupplierMutation = useMutation({
    mutationFn: async (payload: {
      code: string;
      name: string;
      state: string;
      phone?: string;
      email?: string;
      gstin?: string;
      isActive: boolean;
    }) => {
      const res = await apiClient.post("/inventory/suppliers", payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["inventory-suppliers"] });
      setShowAddModal(false);
      resetForm();
      toast.success(
        `Supplier ${data.supplier?.name ?? code} added successfully`,
      );
    },
    onError: (err: any) => {
      toast.error(
        err.response?.data?.message || err.message || "Failed to add supplier",
      );
    },
  });

  // Update supplier mutation
  const updateSupplierMutation = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<Supplier>;
    }) => {
      const res = await apiClient.put(`/inventory/suppliers/${id}`, payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["inventory-suppliers"] });
      setEditingSupplier(null);
      toast.success(
        `Supplier ${data.supplier?.name ?? "details"} updated successfully`,
      );
    },
    onError: (err: any) => {
      toast.error(
        err.response?.data?.message ||
          err.message ||
          "Failed to update supplier",
      );
    },
  });

  const resetForm = () => {
    setCode("");
    setName("");
    setState("Tamil Nadu");
    setPhone("");
    setEmail("");
    setGstin("");
    setIsActive(true);
  };

  const handleStartEdit = (sup: Supplier) => {
    setEditingSupplier(sup);
    setName(sup.name);
    setState(sup.state);
    setPhone(sup.phone || "");
    setEmail(sup.email || "");
    setGstin(sup.gstin || "");
    setIsActive(sup.isActive);
  };

  const suppliers = data?.suppliers ?? [];
  const filteredSuppliers = suppliers;

  const totalSuppliers = suppliers.length;
  const activeSuppliers = suppliers.filter((s) => s.isActive).length;
  const inStateCount = suppliers.filter(
    (s) => s.state.toLowerCase() === "tamil nadu",
  ).length;
  const gstinCount = suppliers.filter((s) => Boolean(s.gstin)).length;

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Supplier Directory
            </h1>
            <Badge variant="outline" className="text-xs">
              Live Master Data
            </Badge>
          </div>
          <p className="max-w-[60ch] text-sm text-muted-foreground">
            Raw material suppliers, mandi vendors, state tax jurisdictions, and
            procurement contracts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ExportMenu entity="suppliers" />
          {canManageSuppliers && (
            <Button
              size="sm"
              onClick={() => {
                resetForm();
                setShowAddModal(true);
              }}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <PlusCircleIcon className="size-4" />
              Add Supplier
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCwIcon
              className={`size-4 ${isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">
            Total Vendors
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {totalSuppliers}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">
            Active Procurement
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-emerald-600">
            {activeSuppliers}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">
            Tamil Nadu (Intra-State)
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            {inStateCount}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">
            GST Registered
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-primary">
            {gstinCount}
          </p>
        </div>
      </div>

      {/* Search Bar & Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search suppliers by name, code, state, GSTIN..."
            aria-label="Search suppliers by name, code, state, GSTIN"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              resetPage();
            }}
            className="h-10 pl-9 pr-3"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(val) => {
            setStatusFilter(val);
            resetPage();
          }}
        >
          <SelectTrigger
            className="h-10 w-auto min-w-36 px-3.5 py-1.5 text-sm"
            aria-label="Filter suppliers by status"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All status</SelectItem>
            <SelectItem value="ACTIVE">Active only</SelectItem>
            <SelectItem value="INACTIVE">Inactive only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
        {isLoading ? (
          <div className="p-4">
            <SkeletonTable rows={5} columns={6} />
          </div>
        ) : isError ? (
          <div className="p-4">
            <ErrorState
              title={t(
                "Failed to load supplier directory",
                "Failed to load supplier directory",
              )}
              description={
                error instanceof Error
                  ? error.message
                  : "Failed to load supplier records. Please refresh."
              }
              error={error}
              onRetry={() => refetch()}
            />
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <EmptyState
            title={
              suppliers.length === 0
                ? "No suppliers added yet"
                : "No suppliers match the selected filters"
            }
            description={
              suppliers.length === 0
                ? "Add a supplier to record raw material purchase receipts."
                : "Clear the search or status filter to view all suppliers."
            }
            action={
              suppliers.length === 0 ? (
                canManageSuppliers ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddModal(true)}
                    className="gap-1.5"
                  >
                    <PlusCircleIcon className="size-4" aria-hidden="true" />
                    Add Supplier
                  </Button>
                ) : undefined
              ) : (
                <Button
                  variant="tertiary"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("ALL");
                  }}
                >
                  Clear filters
                </Button>
              )
            }
          />
        ) : (
          <div className="p-4">
            <DataTable
              tableId="suppliers"
              data={filteredSuppliers}
              getRowId={(r) => r.id}
              ariaLabel="Suppliers"
              csvFilename="suppliers"
              bulkActions={
                canManageSuppliers
                  ? [
                      {
                        id: "archive-suppliers",
                        label: "Archive selected",
                        icon: ArchiveIcon,
                        variant: "outline",
                        hidden: (rows) => !rows.some((r) => r.isActive),
                        onClick: async (rows, clearSelection) => {
                          const active = rows.filter((r) => r.isActive);
                          await Promise.allSettled(
                            active.map((s) =>
                              updateSupplierMutation.mutateAsync({
                                id: s.id,
                                payload: { isActive: false },
                              }),
                            ),
                          );
                          clearSelection();
                        },
                      },
                    ]
                  : []
              }
              columns={
                [
                  {
                    accessorKey: "code",
                    enableHiding: false,
                    header: ({ column }) => (
                      <DataTableColumnHeader
                        column={column}
                        title={t("Vendor Code")}
                      />
                    ),
                    cell: ({ row }) => (
                      <span className="font-mono text-xs font-semibold text-foreground whitespace-nowrap">
                        {row.original.code}
                      </span>
                    ),
                    meta: {
                      label: "Vendor Code",
                    } satisfies DataTableColumnMeta<Supplier>,
                  },
                  {
                    accessorKey: "name",
                    header: ({ column }) => (
                      <DataTableColumnHeader
                        column={column}
                        title={t("Legal / Trade Name")}
                      />
                    ),
                    cell: ({ row }) => (
                      <div className="font-medium text-foreground min-w-[160px]">
                        {row.original.name}
                      </div>
                    ),
                    meta: {
                      label: "Legal / Trade Name",
                    } satisfies DataTableColumnMeta<Supplier>,
                  },
                  {
                    accessorKey: "state",
                    header: ({ column }) => (
                      <DataTableColumnHeader
                        column={column}
                        title={t("State / Jurisdiction")}
                      />
                    ),
                    cell: ({ row }) => (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                        <MapPinIcon
                          className="size-3.5 text-primary"
                          aria-hidden="true"
                        />
                        <span>{row.original.state}</span>
                      </div>
                    ),
                    meta: {
                      label: "State / Jurisdiction",
                    } satisfies DataTableColumnMeta<Supplier>,
                  },
                  {
                    accessorKey: "gstin",
                    header: ({ column }) => (
                      <DataTableColumnHeader
                        column={column}
                        title={t("GSTIN Status")}
                      />
                    ),
                    cell: ({ row }) => {
                      const s = row.original;
                      const gstinValidation = s.gstin
                        ? validateGstin(s.gstin)
                        : null;
                      return s.gstin ? (
                        <div className="flex flex-col gap-0.5 whitespace-nowrap">
                          <span className="font-mono text-xs text-foreground font-medium">
                            {s.gstin}
                          </span>
                          {gstinValidation?.isValid ? (
                            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                              <CheckCircle2Icon
                                className="size-2.5"
                                aria-hidden="true"
                              />
                              Valid GSTIN
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-700 dark:text-amber-400 flex items-center gap-1">
                              Unverified GSTIN
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic whitespace-nowrap">
                          Unregistered Mandi Trader
                        </span>
                      );
                    },
                    meta: {
                      label: "GSTIN Status",
                      exportValue: (r) => r.gstin || "Unregistered",
                    } satisfies DataTableColumnMeta<Supplier>,
                  },
                  {
                    id: "contact",
                    accessorFn: (row) => row.phone || row.email || "",
                    header: ({ column }) => (
                      <DataTableColumnHeader
                        column={column}
                        title={t("Contact Info")}
                      />
                    ),
                    cell: ({ row }) => {
                      const s = row.original;
                      return (
                        <div className="flex flex-col gap-1 text-xs text-muted-foreground whitespace-nowrap">
                          {s.phone && (
                            <div className="flex items-center gap-1">
                              <PhoneIcon
                                className="size-3"
                                aria-hidden="true"
                              />
                              <span>{s.phone}</span>
                            </div>
                          )}
                          {s.email && (
                            <div className="flex items-center gap-1">
                              <MailIcon className="size-3" aria-hidden="true" />
                              <span>{s.email}</span>
                            </div>
                          )}
                          {!s.phone && !s.email && (
                            <span className="italic">—</span>
                          )}
                        </div>
                      );
                    },
                    meta: {
                      label: "Contact Info",
                      exportValue: (r) =>
                        [r.phone, r.email].filter(Boolean).join(" / "),
                    } satisfies DataTableColumnMeta<Supplier>,
                  },
                  {
                    id: "isActive",
                    accessorFn: (row) => (row.isActive ? "Active" : "Inactive"),
                    header: ({ column }) => (
                      <DataTableColumnHeader
                        column={column}
                        title={t("Status")}
                      />
                    ),
                    cell: ({ row }) => (
                      <Badge
                        variant={
                          row.original.isActive ? "success" : "secondary"
                        }
                        className="text-xs whitespace-nowrap"
                      >
                        {row.original.isActive ? "Active" : "Inactive"}
                      </Badge>
                    ),
                    meta: {
                      label: "Status",
                    } satisfies DataTableColumnMeta<Supplier>,
                  },
                  {
                    id: "actions",
                    enableSorting: false,
                    enableHiding: false,
                    header: () => <span>{t("Action")}</span>,
                    cell: ({ row }) => {
                      const s = row.original;
                      return (
                        <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDetailSupplier(s)}
                            className="h-8 px-2 gap-1 text-xs"
                          >
                            <EyeIcon className="size-3" aria-hidden="true" />
                            View
                          </Button>
                          {canManageSuppliers && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleStartEdit(s)}
                                className="h-8 px-2 gap-1 text-xs"
                              >
                                <Edit2Icon
                                  className="size-3"
                                  aria-hidden="true"
                                />
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  updateSupplierMutation.mutate({
                                    id: s.id,
                                    payload: { isActive: !s.isActive },
                                  })
                                }
                                className="h-8 px-2 gap-1 text-xs text-muted-foreground"
                              >
                                <ArchiveIcon
                                  className="size-3"
                                  aria-hidden="true"
                                />
                                {s.isActive ? "Archive" : "Restore"}
                              </Button>
                            </>
                          )}
                        </div>
                      );
                    },
                    meta: {
                      label: "Action",
                      align: "right",
                    } satisfies DataTableColumnMeta<Supplier>,
                  },
                ] satisfies ColumnDef<Supplier, unknown>[]
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
        itemLabel="suppliers"
      />

      {/* Add Supplier Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Raw Material Supplier</DialogTitle>
            <DialogDescription>
              Register a new mandi vendor, farmer, or mill supplier for purchase
              intake receipts.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              createSupplierMutation.mutate({
                code: code.trim(),
                name: name.trim(),
                state: state.trim(),
                phone: phone.trim() || undefined,
                email: email.trim() || undefined,
                gstin: gstin.trim() || undefined,
                isActive,
              });
            }}
            className="mt-2 flex flex-col gap-3"
          >
            <div className="flex flex-col gap-1">
              <Label
                htmlFor="supplier-new-code"
                className="text-xs font-semibold text-muted-foreground"
              >
                Vendor Code *
              </Label>
              <Input
                id="supplier-new-code"
                type="text"
                required
                placeholder="e.g. SUP-MANDI-02"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="font-medium"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label
                htmlFor="supplier-new-name"
                className="text-xs font-semibold text-muted-foreground"
              >
                Supplier / Vendor Name *
              </Label>
              <Input
                id="supplier-new-name"
                type="text"
                required
                placeholder="e.g. Thanjavur Agro Mandi"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="font-medium"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label
                  htmlFor="supplier-new-state"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  State *
                </Label>
                <Input
                  id="supplier-new-state"
                  type="text"
                  required
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="font-medium"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label
                  htmlFor="supplier-new-phone"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  Phone (Optional)
                </Label>
                <Input
                  id="supplier-new-phone"
                  type="text"
                  placeholder="9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label
                  htmlFor="supplier-new-email"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  Email (Optional)
                </Label>
                <Input
                  id="supplier-new-email"
                  type="email"
                  placeholder="mandi@agro.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="font-medium"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label
                  htmlFor="supplier-new-gstin"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  GSTIN (Optional)
                </Label>
                <Input
                  id="supplier-new-gstin"
                  type="text"
                  placeholder="33AAAAA0000A1Z5"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <Checkbox
                id="isActiveNew"
                checked={isActive}
                onCheckedChange={(checked) => setIsActive(checked === true)}
              />
              <Label
                htmlFor="isActiveNew"
                className="text-xs font-normal text-foreground cursor-pointer"
              >
                Active for purchase receipts
              </Label>
            </div>

            <DialogFooter className="mt-4 border-t pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!code || !name || createSupplierMutation.isPending}
              >
                {createSupplierMutation.isPending
                  ? "Adding..."
                  : "Save Supplier"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Supplier Modal */}
      <Dialog
        open={editingSupplier !== null}
        onOpenChange={(open) => {
          if (!open) setEditingSupplier(null);
        }}
      >
        {editingSupplier && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Supplier: {editingSupplier.code}</DialogTitle>
              <DialogDescription>
                Update contact info, jurisdiction state, or active status.
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateSupplierMutation.mutate({
                  id: editingSupplier.id,
                  payload: {
                    name: name.trim(),
                    state: state.trim(),
                    phone: phone.trim() || null,
                    email: email.trim() || null,
                    gstin: gstin.trim() || null,
                    isActive,
                  },
                });
              }}
              className="mt-4 flex flex-col gap-3"
            >
              <div className="flex flex-col gap-1">
                <Label
                  htmlFor="supplier-edit-name"
                  className="text-xs font-semibold text-muted-foreground"
                >
                  Supplier Name *
                </Label>
                <Input
                  id="supplier-edit-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <Label
                    htmlFor="supplier-edit-state"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    State *
                  </Label>
                  <Input
                    id="supplier-edit-state"
                    type="text"
                    required
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="font-medium"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label
                    htmlFor="supplier-edit-phone"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Phone
                  </Label>
                  <Input
                    id="supplier-edit-phone"
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <Label
                    htmlFor="supplier-edit-email"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    Email
                  </Label>
                  <Input
                    id="supplier-edit-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="font-medium"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label
                    htmlFor="supplier-edit-gstin"
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    GSTIN
                  </Label>
                  <Input
                    id="supplier-edit-gstin"
                    type="text"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <Checkbox
                  id="isActiveEdit"
                  checked={isActive}
                  onCheckedChange={(checked) => setIsActive(checked === true)}
                />
                <Label
                  htmlFor="isActiveEdit"
                  className="text-xs font-normal text-foreground cursor-pointer"
                >
                  Active for purchase receipts
                </Label>
              </div>

              <DialogFooter className="mt-4 border-t pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingSupplier(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!name || updateSupplierMutation.isPending}
                >
                  {updateSupplierMutation.isPending
                    ? "Updating..."
                    : "Update Supplier"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>

      {/* Supplier Detail Modal (IMP-017) */}
      <Dialog
        open={detailSupplier !== null}
        onOpenChange={(open) => {
          if (!open) setDetailSupplier(null);
        }}
      >
        {detailSupplier && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{detailSupplier.name}</DialogTitle>
              <DialogDescription>
                {detailSupplier.code} · {detailSupplier.state}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3 text-xs">
              <div>
                <span className="text-muted-foreground">GSTIN</span>
                <p className="font-mono font-medium">
                  {detailSupplier.gstin || "Unregistered"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Status</span>
                <p className="font-medium">
                  {detailSupplier.isActive ? "Active" : "Archived"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Phone</span>
                <p className="font-medium">{detailSupplier.phone || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Email</span>
                <p className="font-medium">{detailSupplier.email || "—"}</p>
              </div>
            </div>
            <DialogFooter className="border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDetailSupplier(null)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
