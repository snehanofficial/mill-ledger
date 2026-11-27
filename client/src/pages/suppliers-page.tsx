import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useUrlState } from "@/hooks/use-url-state";
import { useLanguage } from "@/lib/i18n";
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
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{
    suppliers: Supplier[];
  }>({
    queryKey: ["inventory-suppliers"],
    queryFn: async () => {
      const res = await apiClient.get(
        "/inventory/suppliers?includeInactive=true",
      );
      return res.data;
    },
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
      toast.success(`Supplier ${data.supplier?.name ?? code} added successfully`);
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

  const filteredSuppliers = suppliers.filter((s) => {
    if (statusFilter === "ACTIVE" && !s.isActive) return false;
    if (statusFilter === "INACTIVE" && s.isActive) return false;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      s.code.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.state.toLowerCase().includes(q) ||
      (s.gstin && s.gstin.toLowerCase().includes(q))
    );
  });

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
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 pl-9 pr-3"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={setStatusFilter}
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
              title={t("Failed to load supplier directory", "Failed to load supplier directory")}
              description={
                error instanceof Error ? error.message : "Failed to load supplier records. Please refresh."
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Vendor Code")}</TableHead>
                <TableHead>{t("Legal / Trade Name")}</TableHead>
                <TableHead>{t("State / Jurisdiction")}</TableHead>
                <TableHead>{t("GSTIN Status")}</TableHead>
                <TableHead>{t("Contact Info")}</TableHead>
                <TableHead>{t("Status")}</TableHead>
                <TableHead className="text-right">{t("Action")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.map((s) => {
                const gstinValidation = s.gstin ? validateGstin(s.gstin) : null;
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs font-semibold text-foreground">
                      {s.code}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-foreground">{s.name}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPinIcon className="size-3.5 text-primary" />
                        <span>{s.state}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {s.gstin ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-xs text-foreground font-medium">
                            {s.gstin}
                          </span>
                          {gstinValidation?.isValid ? (
                            <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                              <CheckCircle2Icon className="size-2.5" />
                              Valid GSTIN
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-600 flex items-center gap-1">
                              Unverified GSTIN
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Unregistered Mandi Trader
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                        {s.phone && (
                          <div className="flex items-center gap-1">
                            <PhoneIcon className="size-3" />
                            <span>{s.phone}</span>
                          </div>
                        )}
                        {s.email && (
                          <div className="flex items-center gap-1">
                            <MailIcon className="size-3" />
                            <span>{s.email}</span>
                          </div>
                        )}
                        {!s.phone && !s.email && (
                          <span className="italic">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={s.isActive ? "success" : "secondary"}
                        className="text-xs"
                      >
                        {s.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDetailSupplier(s)}
                          className="h-8 min-h-[32px] px-2 gap-1 text-xs sm:h-7 sm:min-h-[28px]"
                        >
                          <EyeIcon className="size-3" />
                          View
                        </Button>
                        {canManageSuppliers && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleStartEdit(s)}
                              className="h-8 min-h-[32px] px-2.5 gap-1 text-xs sm:h-7 sm:min-h-[28px] sm:px-2"
                            >
                              <Edit2Icon className="size-3" />
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
                              className="h-8 min-h-[32px] px-2 gap-1 text-xs text-muted-foreground sm:h-7 sm:min-h-[28px]"
                            >
                              <ArchiveIcon className="size-3" />
                              {s.isActive ? "Archive" : "Restore"}
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Add Supplier Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Raw Material Supplier</DialogTitle>
            <DialogDescription>
              Register a new mandi vendor, farmer, or mill supplier for
              purchase intake receipts.
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
                  {createSupplierMutation.isPending ? "Adding..." : "Save Supplier"}
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
