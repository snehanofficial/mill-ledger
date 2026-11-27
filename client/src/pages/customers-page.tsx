import { useState } from "react";
import { keepPreviousData, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PaginationMeta } from "@mill-ledger/shared";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useUrlState } from "@/hooks/use-url-state";
import { usePagination } from "@/hooks/use-pagination";
import { useLanguage } from "@/lib/i18n";
import { DataPagination } from "@/components/ui/data-pagination";
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
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  UsersIcon,
  RefreshCwIcon,
  CheckCircle2Icon,
  MapPinIcon,
  PlusCircleIcon,
  PencilIcon,
  EyeIcon,
  UserPlusIcon,
  ArchiveIcon,
  Trash2Icon,
} from "lucide-react";
import { validateGstin } from "@mill-ledger/shared";
import { toast } from "sonner";

interface SalesmanRef {
  id: string;
  name: string;
  email: string;
}

interface Customer {
  id: string;
  code: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  state: string;
  gstin?: string | null;
  isActive: boolean;
  assignments?: Array<{
    id: string;
    salesmanId: string;
    salesman: SalesmanRef;
  }>;
}

export function CustomersPage() {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const { t } = useLanguage();
  const canManageCustomers = user?.role === "ADMIN";

  const [searchQuery, setSearchQuery] = useUrlState("q", "", {
    debounceMs: 250,
  });
  const { page, pageSize, offset, setPage, setPageSize, resetPage } =
    usePagination({ defaultPageSize: 20 });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Customer | null>(null);
  const [selectedSalesmanId, setSelectedSalesmanId] = useState("");

  // Form fields
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formState, setFormState] = useState("Tamil Nadu");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formGstin, setFormGstin] = useState("");

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{
    customers: Customer[];
    pagination: PaginationMeta;
  }>({
    queryKey: ["sales-customers", page, pageSize, searchQuery.trim()],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String(offset),
      });
      if (searchQuery.trim()) {
        params.set("q", searchQuery.trim());
      }
      const res = await apiClient.get(`/sales/customers?${params.toString()}`);
      return res.data;
    },
    placeholderData: keepPreviousData,
  });

  const { data: salesmenData } = useQuery<{ salesmen: SalesmanRef[] }>({
    queryKey: ["sales-salesmen"],
    enabled: canManageCustomers,
    queryFn: async () => {
      const res = await apiClient.get("/sales/salesmen");
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post("/sales/customers", {
        code: formCode.trim(),
        name: formName.trim(),
        state: formState.trim() || "Tamil Nadu",
        phone: formPhone.trim() || null,
        email: formEmail.trim() || null,
        gstin: formGstin.trim() ? formGstin.trim().toUpperCase() : null,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-customers"] });
      setShowCreateModal(false);
      toast.success("Customer created successfully.");
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to create customer"));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      data: Record<string, unknown>;
    }) => {
      const res = await apiClient.put(
        `/sales/customers/${payload.id}`,
        payload.data,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-customers"] });
      setEditingCustomer(null);
      setArchiveTarget(null);
      toast.success("Customer updated successfully.");
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to update customer"));
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (payload: { customerId: string; salesmanId: string }) => {
      const res = await apiClient.post(
        `/sales/customers/${payload.customerId}/assignments`,
        { salesmanId: payload.salesmanId },
      );
      return res.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sales-customers"] });
      setSelectedSalesmanId("");
      if (detailCustomer) {
        const res = await apiClient.get<{ customer: Customer }>(
          `/sales/customers/${detailCustomer.id}`,
        );
        setDetailCustomer(res.data.customer);
      }
      toast.success("Salesman assigned.");
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to assign salesman"));
    },
  });

  const unassignMutation = useMutation({
    mutationFn: async (payload: { customerId: string; salesmanId: string }) => {
      const res = await apiClient.delete(
        `/sales/customers/${payload.customerId}/assignments/${payload.salesmanId}`,
      );
      return res.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sales-customers"] });
      if (detailCustomer) {
        const res = await apiClient.get<{ customer: Customer }>(
          `/sales/customers/${detailCustomer.id}`,
        );
        setDetailCustomer(res.data.customer);
      }
      toast.success("Salesman unassigned.");
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to unassign salesman"));
    },
  });

  const openCreateModal = () => {
    setFormCode("");
    setFormName("");
    setFormState("Tamil Nadu");
    setFormPhone("");
    setFormEmail("");
    setFormGstin("");
    setShowCreateModal(true);
  };

  const openEditModal = (c: Customer) => {
    setFormCode(c.code);
    setFormName(c.name);
    setFormState(c.state);
    setFormPhone(c.phone || "");
    setFormEmail(c.email || "");
    setFormGstin(c.gstin || "");
    setEditingCustomer(c);
  };

  const customers = data?.customers ?? [];
  const salesmen = salesmenData?.salesmen ?? [];

  const filteredCustomers = customers.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      c.name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.state.toLowerCase().includes(q) ||
      (c.phone && c.phone.toLowerCase().includes(q)) ||
      (c.gstin && c.gstin.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Customer Directory
            </h1>
            <Badge variant="outline" className="text-xs">
              Live Master Data
            </Badge>
          </div>
          <p className="max-w-[60ch] text-sm text-muted-foreground">
            Retailers, distributors, state tax jurisdictions, and sales assignments.
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
            Refresh
          </Button>
          {canManageCustomers && (
            <Button size="sm" onClick={openCreateModal} className="gap-1.5">
              <PlusCircleIcon className="size-4" />
              Add Customer
            </Button>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("Total Accounts")}
          </span>
          <span className="text-2xl font-bold tracking-tight text-foreground">
            {customers.length}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Active Accounts
          </span>
          <span className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {customers.filter((c) => c.isActive).length}
          </span>
        </div>
      </div>

      {/* Customers Table Card */}
      <div className="rounded-xl border border-border bg-card shadow-xs">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <UsersIcon className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              {t("Accounts Register")}
            </h2>
            <span className="text-xs text-muted-foreground font-mono tabular-nums">
              ({filteredCustomers.length} of {customers.length})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Input
              placeholder={t("Search customers...")}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                resetPage();
              }}
              className="h-8 w-56 text-xs"
              aria-label="Search customers"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-4">
            <SkeletonTable rows={5} columns={7} />
          </div>
        ) : isError ? (
          <div className="p-4">
            <ErrorState
              title={t("Failed to load customer directory", "Failed to load customer directory")}
              description={
                error instanceof Error
                  ? error.message
                  : "Failed to load customers. Please verify connection and permissions."
              }
              error={error}
              onRetry={() => refetch()}
            />
          </div>
        ) : customers.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title="No customer accounts found"
            description="Add a customer account to create orders, invoices, and track receivables."
            action={
              canManageCustomers ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateModal(true)}
                  className="gap-1.5"
                >
                  <PlusCircleIcon className="size-4" aria-hidden="true" />
                  Add Customer
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">{t("Account Code")}</TableHead>
                  <TableHead>{t("Customer Name")}</TableHead>
                  <TableHead>{t("Place of Supply")}</TableHead>
                  <TableHead>{t("Tax Regime")}</TableHead>
                  <TableHead>{t("GSTIN")}</TableHead>
                  <TableHead className="w-[100px] text-center">{t("Status")}</TableHead>
                  <TableHead className="text-right">{t("Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.length === 0 && customers.length > 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="p-0">
                      <EmptyState
                        title={t("No customer accounts match the search query.")}
                        description="Clear the search query to view all customer accounts."
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
                    </TableCell>
                  </TableRow>
                )}
                {filteredCustomers.map((c) => {
                  const isIntraState =
                    c.state?.trim().toLowerCase() === "tamil nadu";
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs font-semibold">
                        {c.code}
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        <div className="flex flex-col">
                          <span>{c.name}</span>
                          {c.assignments && c.assignments.length > 0 && (
                            <span className="text-2xs text-muted-foreground">
                              Assigned:{" "}
                              {c.assignments.map((a) => a.salesman.name).join(", ")}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <MapPinIcon className="size-3 text-muted-foreground" />
                          {c.state}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={isIntraState ? "secondary" : "outline"}
                          className="text-[10px]"
                        >
                          {isIntraState
                            ? "Intra-state (CGST + SGST)"
                            : "Inter-state (IGST)"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {c.gstin ? (
                          <div className="flex items-center gap-1.5">
                            <span>{c.gstin}</span>
                            {validateGstin(c.gstin).isValid ? (
                              <Badge
                                variant="success"
                                className="text-[9px] px-1 py-0"
                              >
                                Valid
                              </Badge>
                            ) : (
                              <Badge
                                variant="danger"
                                className="text-[9px] px-1 py-0"
                              >
                                Invalid
                              </Badge>
                            )}
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {c.isActive ? (
                          <Badge variant="success" className="text-[10px] gap-1">
                            <CheckCircle2Icon className="size-2.5" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="neutral" className="text-[10px]">
                            Archived
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDetailCustomer(c)}
                            className="h-7 px-2 text-xs gap-1"
                            aria-label={`View ${c.name}`}
                          >
                            <EyeIcon className="size-3" />
                            View
                          </Button>
                          {canManageCustomers && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditModal(c)}
                                className="h-7 px-2 text-xs gap-1"
                                aria-label={`Edit ${c.name}`}
                              >
                                <PencilIcon className="size-3" />
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setArchiveTarget(c)}
                                className="h-7 px-2 text-xs gap-1 text-muted-foreground"
                                aria-label={
                                  c.isActive
                                    ? `Archive ${c.name}`
                                    : `Restore ${c.name}`
                                }
                              >
                                <ArchiveIcon className="size-3" />
                                {c.isActive ? "Archive" : "Restore"}
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
        itemLabel="customers"
      />

      {/* Create / Edit Customer Modal */}
      <Dialog
        open={showCreateModal || editingCustomer !== null}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateModal(false);
            setEditingCustomer(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCustomer ? "Edit Customer" : "Add Customer"}
            </DialogTitle>
            <DialogDescription>
              {editingCustomer
                ? `Update profile and GST details for ${editingCustomer.code}`
                : "Register a new retailer or distributor account."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            {!editingCustomer && (
              <div className="flex flex-col gap-1">
                <Label htmlFor="cust-code" className="text-xs">
                  Customer Code
                </Label>
                <Input
                  id="cust-code"
                  placeholder="CUST-RET-C"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                />
              </div>
            )}
            <div className="flex flex-col gap-1">
              <Label htmlFor="cust-name" className="text-xs">
                Customer Name
              </Label>
              <Input
                id="cust-name"
                placeholder="Sri Murugan Stores"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="cust-state" className="text-xs">
                Place of Supply (State)
              </Label>
              <Input
                id="cust-state"
                placeholder="Tamil Nadu"
                value={formState}
                onChange={(e) => setFormState(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="cust-phone" className="text-xs">
                  Phone
                </Label>
                <Input
                  id="cust-phone"
                  placeholder="+91 9876543210"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="cust-email" className="text-xs">
                  Email
                </Label>
                <Input
                  id="cust-email"
                  type="email"
                  placeholder="orders@store.in"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="cust-gstin" className="text-xs">
                GSTIN (15-character, optional)
              </Label>
              <Input
                id="cust-gstin"
                placeholder="33AABCM1234F1Z1"
                value={formGstin}
                onChange={(e) => setFormGstin(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowCreateModal(false);
                setEditingCustomer(null);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={
                createMutation.isPending ||
                updateMutation.isPending ||
                !formName.trim() ||
                (!editingCustomer && !formCode.trim())
              }
              onClick={() => {
                if (editingCustomer) {
                  updateMutation.mutate({
                    id: editingCustomer.id,
                    data: {
                      name: formName.trim(),
                      state: formState.trim() || "Tamil Nadu",
                      phone: formPhone.trim() || null,
                      email: formEmail.trim() || null,
                      gstin: formGstin.trim()
                        ? formGstin.trim().toUpperCase()
                        : null,
                    },
                  });
                } else {
                  createMutation.mutate();
                }
              }}
            >
              {editingCustomer ? "Save Changes" : "Create Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer Detail & Salesman Assignment Modal */}
      <Dialog
        open={detailCustomer !== null}
        onOpenChange={(open) => {
          if (!open) setDetailCustomer(null);
        }}
      >
        {detailCustomer && (
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{detailCustomer.name}</DialogTitle>
              <DialogDescription>
                {detailCustomer.code} · {detailCustomer.state}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 text-sm">
              <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Phone</span>
                  <p className="font-medium">{detailCustomer.phone || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Email</span>
                  <p className="font-medium">{detailCustomer.email || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">GSTIN</span>
                  <p className="font-mono font-medium">
                    {detailCustomer.gstin || "Unregistered"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <p className="font-medium">
                    {detailCustomer.isActive ? "Active" : "Archived"}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                  Assigned Salesmen
                </h4>
                {detailCustomer.assignments &&
                detailCustomer.assignments.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {detailCustomer.assignments.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between rounded-md border px-3 py-1.5 text-xs"
                      >
                        <div>
                          <span className="font-medium">{a.salesman.name}</span>
                          <span className="ml-2 text-muted-foreground">
                            ({a.salesman.email})
                          </span>
                        </div>
                        {canManageCustomers && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              unassignMutation.mutate({
                                customerId: detailCustomer.id,
                                salesmanId: a.salesmanId,
                              })
                            }
                            disabled={unassignMutation.isPending}
                            className="h-6 px-2 text-destructive"
                            aria-label={`Unassign ${a.salesman.name}`}
                          >
                            <Trash2Icon className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No salesmen currently assigned.
                  </p>
                )}

                {canManageCustomers && (
                  <div className="flex items-center gap-2 pt-2">
                    <Select
                      value={selectedSalesmanId}
                      onValueChange={setSelectedSalesmanId}
                    >
                      <SelectTrigger className="h-8 flex-1 text-xs">
                        <SelectValue placeholder="Select salesman to assign..." />
                      </SelectTrigger>
                      <SelectContent searchable searchPlaceholder="Search salesmen...">
                        {salesmen.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} ({s.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      disabled={!selectedSalesmanId || assignMutation.isPending}
                      onClick={() =>
                        assignMutation.mutate({
                          customerId: detailCustomer.id,
                          salesmanId: selectedSalesmanId,
                        })
                      }
                      className="h-8 gap-1 text-xs"
                    >
                      <UserPlusIcon className="size-3.5" />
                      Assign
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter className="border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDetailCustomer(null)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Archive / Restore Confirmation */}
      {archiveTarget && (
        <ConfirmationDialog
          open={archiveTarget !== null}
          onOpenChange={(open) => {
            if (!open) setArchiveTarget(null);
          }}
          title={
            archiveTarget.isActive
              ? `Archive ${archiveTarget.name}?`
              : `Restore ${archiveTarget.name}?`
          }
          description={
            archiveTarget.isActive
              ? "Archived customers remain in historical invoices and ledgers but are marked inactive."
              : "Restoring this customer marks the account active again."
          }
          confirmLabel={archiveTarget.isActive ? "Archive" : "Restore"}
          cancelLabel="Cancel"
          onConfirm={() =>
            updateMutation.mutate({
              id: archiveTarget.id,
              data: { isActive: !archiveTarget.isActive },
            })
          }
          disabled={updateMutation.isPending}
          destructive={archiveTarget.isActive}
        />
      )}
    </div>
  );
}
