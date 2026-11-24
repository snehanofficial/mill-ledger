import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useUrlState } from "@/hooks/use-url-state";
import { useLanguage } from "@/lib/i18n";
import {
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
import {
  RefreshCwIcon,
  CheckCircle2Icon,
  MapPinIcon,
  PlusCircleIcon,
  PhoneIcon,
  MailIcon,
  SearchIcon,
  Edit2Icon,
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
    user?.role === "ADMIN" || user?.role === "PRODUCTION" || user?.role === "OWNER";

  const [searchQuery, setSearchQuery] = useUrlState("q", "");
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
      const res = await apiClient.get("/inventory/suppliers?organizationId=MILL");
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Supplier Directory
            </h1>
            <Badge variant="outline" className="text-xs">
              Live Master Data
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Raw material suppliers, mandi vendors, state tax jurisdictions, and
            procurement contracts.
          </p>
        </div>

        <div className="flex items-center gap-2">
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
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
          <input
            type="text"
            placeholder="Search suppliers by name, code, state, GSTIN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border bg-background pl-9 pr-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Filter suppliers by status"
        >
          <option value="ALL">All status</option>
          <option value="ACTIVE">Active only</option>
          <option value="INACTIVE">Inactive only</option>
        </select>
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
          <div className="p-8 text-center text-sm text-muted-foreground">
            No suppliers found.
          </div>
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
                {canManageSuppliers && (
                  <TableHead className="text-right">{t("Action")}</TableHead>
                )}
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
                    {canManageSuppliers && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStartEdit(s)}
                          className="h-7 gap-1 text-xs"
                        >
                          <Edit2Icon className="size-3" />
                          Edit
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Add Supplier Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl border">
            <h3 className="text-lg font-bold text-foreground">
              Add New Raw Material Supplier
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Register a new mandi vendor, farmer, or mill supplier for
              purchase intake receipts.
            </p>

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
              className="mt-4 flex flex-col gap-3"
            >
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Vendor Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SUP-MANDI-02"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="rounded-md border bg-background px-3 py-2 text-sm text-foreground"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-muted-foreground">
                  Supplier / Vendor Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Thanjavur Agro Mandi"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-md border bg-background px-3 py-2 text-sm text-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    State *
                  </label>
                  <input
                    type="text"
                    required
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="rounded-md border bg-background px-3 py-2 text-sm text-foreground"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Phone (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="rounded-md border bg-background px-3 py-2 text-sm text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Email (Optional)
                  </label>
                  <input
                    type="email"
                    placeholder="mandi@agro.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="rounded-md border bg-background px-3 py-2 text-sm text-foreground"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    GSTIN (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="33AAAAA0000A1Z5"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    className="rounded-md border bg-background px-3 py-2 text-sm text-foreground font-mono"
                  />
                </div>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActiveNew"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border"
                />
                <label
                  htmlFor="isActiveNew"
                  className="text-xs text-foreground cursor-pointer"
                >
                  Active for purchase receipts
                </label>
              </div>

              <div className="mt-4 flex items-center justify-end gap-3 border-t pt-3">
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
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Supplier Modal */}
      {editingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl border">
            <h3 className="text-lg font-bold text-foreground">
              Edit Supplier: {editingSupplier.code}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Update contact info, jurisdiction state, or active status.
            </p>

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
                <label className="text-xs font-semibold text-muted-foreground">
                  Supplier Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-md border bg-background px-3 py-2 text-sm text-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    State *
                  </label>
                  <input
                    type="text"
                    required
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="rounded-md border bg-background px-3 py-2 text-sm text-foreground"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="rounded-md border bg-background px-3 py-2 text-sm text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="rounded-md border bg-background px-3 py-2 text-sm text-foreground"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    GSTIN
                  </label>
                  <input
                    type="text"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    className="rounded-md border bg-background px-3 py-2 text-sm text-foreground font-mono"
                  />
                </div>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActiveEdit"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border"
                />
                <label
                  htmlFor="isActiveEdit"
                  className="text-xs text-foreground cursor-pointer"
                >
                  Active for purchase receipts
                </label>
              </div>

              <div className="mt-4 flex items-center justify-end gap-3 border-t pt-3">
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
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
