import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, extractErrorMessage } from "@/lib/api-client";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  useFacilities,
  useWarehouses,
  type FacilityRecord,
  type WarehouseRecord,
} from "@/hooks/use-warehouses";
import { formatDate } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Building2Icon,
  UsersIcon,
  ShieldCheckIcon,
  PlusIcon,
  RefreshCwIcon,
  LockIcon,
  FileTextIcon,
  PauseIcon,
  PlayIcon,
  PencilIcon,
  WarehouseIcon,
} from "lucide-react";
import { useMotion } from "@/hooks/use-motion";
import { ErrorState } from "@/components/ui/loading-error-empty";
import { toast } from "sonner";
import type { Role } from "@mill-ledger/shared";

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useCurrentUser();
  const { isMotionPaused, toggleMotion } = useMotion();
  const [activeTab, setActiveTab] = useState<
    "mill" | "warehouses" | "users" | "dpdp"
  >("mill");
  const [showFacilityModal, setShowFacilityModal] = useState(false);
  const [editingFacility, setEditingFacility] = useState<FacilityRecord | null>(
    null,
  );
  const [facCode, setFacCode] = useState("");
  const [facName, setFacName] = useState("");
  const [facState, setFacState] = useState("Tamil Nadu");

  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [editingWarehouse, setEditingWarehouse] =
    useState<WarehouseRecord | null>(null);
  const [whCode, setWhCode] = useState("");
  const [whName, setWhName] = useState("");
  const [whFacilityId, setWhFacilityId] = useState("");

  const { data: facilitiesData } = useFacilities(true);
  const { data: warehousesData } = useWarehouses({ includeInactive: true });
  const facilitiesList = facilitiesData?.facilities ?? [];
  const warehousesList = warehousesData?.warehouses ?? [];

  const saveFacilityMutation = useMutation({
    mutationFn: async () => {
      if (editingFacility) {
        return (
          await apiClient.put(`/masters/facilities/${editingFacility.id}`, {
            name: facName.trim(),
            state: facState.trim(),
          })
        ).data;
      }
      return (
        await apiClient.post("/masters/facilities", {
          code: facCode.trim().toUpperCase(),
          name: facName.trim(),
          state: facState.trim() || "Tamil Nadu",
        })
      ).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["masters-facilities"] });
      queryClient.invalidateQueries({ queryKey: ["masters-warehouses"] });
      setShowFacilityModal(false);
      setEditingFacility(null);
      toast.success(editingFacility ? "Facility updated." : "Facility created.");
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to save facility"));
    },
  });

  const toggleFacilityActiveMutation = useMutation({
    mutationFn: async (f: FacilityRecord) => {
      return (
        await apiClient.put(`/masters/facilities/${f.id}`, {
          isActive: !f.isActive,
        })
      ).data;
    },
    onSuccess: (_data, f) => {
      queryClient.invalidateQueries({ queryKey: ["masters-facilities"] });
      toast.success(
        f.isActive ? "Facility deactivated." : "Facility reactivated.",
      );
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Cannot update facility status"));
    },
  });

  const saveWarehouseMutation = useMutation({
    mutationFn: async () => {
      if (editingWarehouse) {
        return (
          await apiClient.put(`/masters/warehouses/${editingWarehouse.id}`, {
            facilityId: whFacilityId,
            name: whName.trim(),
          })
        ).data;
      }
      return (
        await apiClient.post("/masters/warehouses", {
          facilityId: whFacilityId,
          code: whCode.trim().toUpperCase(),
          name: whName.trim(),
        })
      ).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["masters-warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["masters-facilities"] });
      setShowWarehouseModal(false);
      setEditingWarehouse(null);
      toast.success(
        editingWarehouse ? "Warehouse updated." : "Warehouse created.",
      );
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to save warehouse"));
    },
  });

  const toggleWarehouseActiveMutation = useMutation({
    mutationFn: async (w: WarehouseRecord) => {
      return (
        await apiClient.put(`/masters/warehouses/${w.id}`, {
          isActive: !w.isActive,
        })
      ).data;
    },
    onSuccess: (_data, w) => {
      queryClient.invalidateQueries({ queryKey: ["masters-warehouses"] });
      toast.success(
        w.isActive ? "Warehouse deactivated." : "Warehouse reactivated.",
      );
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Cannot update warehouse status"));
    },
  });
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [editUserName, setEditUserName] = useState("");
  const [editUserRole, setEditUserRole] = useState<Role>("SALESMAN");
  const [showEditOrgModal, setShowEditOrgModal] = useState(false);
  const [orgNameInput, setOrgNameInput] = useState("");
  const [orgStateInput, setOrgStateInput] = useState("");
  const [orgGstinInput, setOrgGstinInput] = useState("");
  const [showAddTaxModal, setShowAddTaxModal] = useState(false);
  const [taxHsn, setTaxHsn] = useState("21069099");
  const [taxRateVal, setTaxRateVal] = useState(5);
  const canEditSettings = currentUser?.role === "ADMIN";

  const { data: orgData } = useQuery<{
    organization: {
      id: string;
      code: string;
      name: string;
      state: string;
      gstin: string | null;
    };
  }>({
    queryKey: ["masters-organization"],
    queryFn: async () => {
      const res = await apiClient.get("/masters/organization");
      return res.data;
    },
  });

  const { data: taxRatesData } = useQuery<{
    taxRates: Array<{
      id: string;
      hsnCode: string;
      rate: number | string;
      cgstRate: number | string;
      sgstRate: number | string;
      igstRate: number | string;
      effectiveFrom: string;
    }>;
  }>({
    queryKey: ["finance-tax-rates"],
    queryFn: async () => {
      const res = await apiClient.get("/finance/tax-rates");
      return res.data;
    },
  });

  const updateOrgMutation = useMutation({
    mutationFn: async () => {
      return (
        await apiClient.put("/masters/organization", {
          name: orgNameInput.trim(),
          state: orgStateInput.trim(),
          gstin: orgGstinInput.trim() || null,
        })
      ).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["masters-organization"] });
      setShowEditOrgModal(false);
      toast.success("Organization settings updated.");
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to update organization"));
    },
  });

  const addTaxRateMutation = useMutation({
    mutationFn: async () => {
      const rate = Number(taxRateVal);
      return (
        await apiClient.post("/finance/tax-rates", {
          hsnCode: taxHsn.trim(),
          rate,
          cgstRate: rate / 2,
          sgstRate: rate / 2,
          igstRate: rate,
        })
      ).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-tax-rates"] });
      setShowAddTaxModal(false);
      toast.success("Tax rate added.");
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to add tax rate"));
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async () => {
      if (!editingUser) return;
      return (
        await apiClient.put(`/users/${editingUser.id}`, {
          name: editUserName.trim(),
          role: editUserRole,
        })
      ).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-users"] });
      setEditingUser(null);
      toast.success("User updated.");
    },
    onError: (err: unknown) => {
      toast.error(extractErrorMessage(err, "Failed to update user"));
    },
  });

  // Add User Form State
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<Role>("SALESMAN");

  // Query users
  const {
    data: usersData,
    isLoading: isLoadingUsers,
    isError: isErrorUsers,
    error: errorUsers,
    refetch: refetchUsers,
  } = useQuery<{
    users: UserRecord[];
  }>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await apiClient.get("/users");
      return res.data;
    },
    enabled: activeTab === "users",
  });

  const usersList = usersData?.users || [];

  // Create User Mutation
  const createUserMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post("/users", {
        name: newUserName,
        email: newUserEmail,
        password: newUserPassword,
        role: newUserRole,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User created successfully!");
      setShowAddUserModal(false);
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
    },
    onError: (err: unknown) => {
      toast.error(`Error: ${extractErrorMessage(err, "Failed to create user")}`);
    },
  });

  // Toggle User Active Status Mutation (F-067: Optimistic update with cache rollback)
  const toggleUserMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiClient.put(`/users/${id}`, { isActive });
      return res.data;
    },
    onMutate: async ({ id, isActive }) => {
      await queryClient.cancelQueries({ queryKey: ["admin-users"] });
      const previousUsers = queryClient.getQueryData<{ users: UserRecord[] }>([
        "admin-users",
      ]);
      queryClient.setQueryData<{ users: UserRecord[] }>(
        ["admin-users"],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            users: old.users.map((u) => (u.id === id ? { ...u, isActive } : u)),
          };
        },
      );
      return { previousUsers };
    },
    onError: (err: any, _vars, context) => {
      if (context?.previousUsers) {
        queryClient.setQueryData(["admin-users"], context.previousUsers);
      }
      toast.error(`Failed to update user: ${err.message}. Reverted changes.`);
    },
    onSuccess: () => {
      toast.success("User status updated successfully");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      toast.error("Please fill in all required user fields");
      return;
    }
    await createUserMutation.mutateAsync();
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6 md:p-8 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-page-title text-foreground">
              Mill Settings & Administration
            </h1>
            <Badge variant="outline" className="text-xs">
              System Admin
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground max-w-[60ch]">
            Configure enterprise parameters, manage staff access roles, and maintain statutory GST settings.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="success" className="text-xs">
            <ShieldCheckIcon className="size-3.5" />
            RBAC & ABAC Enforced
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Settings sections" className="flex flex-wrap border-b border-border">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "mill"}
          onClick={() => setActiveTab("mill")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${
            activeTab === "mill"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Building2Icon className="size-4" aria-hidden="true" />
          Mill & Statutory GST
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "warehouses"}
          onClick={() => setActiveTab("warehouses")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${
            activeTab === "warehouses"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <WarehouseIcon className="size-4" aria-hidden="true" />
          Facilities & Warehouses
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "users"}
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${
            activeTab === "users"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <UsersIcon className="size-4" aria-hidden="true" />
          User & Role Management
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "dpdp"}
          onClick={() => setActiveTab("dpdp")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${
            activeTab === "dpdp"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <LockIcon className="size-4" aria-hidden="true" />
          Data Protection (DPDP 2023)
        </button>
      </div>

      {/* TAB 1: Mill & Statutory Parameters */}
      {activeTab === "mill" && (
        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-border/80 bg-card shadow-xs">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Building2Icon className="size-4 text-primary" />
                  Mill Organization Profile
                </h2>
                <p className="text-xs text-muted-foreground">
                  Official entity registration and place of supply configurations
                </p>
              </div>
              {canEditSettings && orgData?.organization && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setOrgNameInput(orgData.organization.name);
                    setOrgStateInput(orgData.organization.state);
                    setOrgGstinInput(orgData.organization.gstin || "");
                    setShowEditOrgModal(true);
                  }}
                  className="h-8 gap-1.5 text-xs"
                >
                  <PencilIcon className="size-3.5" />
                  Edit Profile
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 px-5 py-4 sm:px-6 sm:pb-6">
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/30 border border-border/50">
                <span className="text-xs text-muted-foreground font-semibold">Legal Entity Name</span>
                <span className="text-sm font-bold text-foreground">
                  {orgData?.organization?.name || "MillLedger Foods Pvt Ltd"}
                </span>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/30 border border-border/50">
                <span className="text-xs text-muted-foreground font-semibold">Organization Code</span>
                <span className="text-sm font-mono font-bold text-foreground">
                  {orgData?.organization?.code || "—"}
                </span>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/30 border border-border/50">
                <span className="text-xs text-muted-foreground font-semibold">Principal Place of Business</span>
                <span className="text-sm font-bold text-foreground">
                  {orgData?.organization?.state || "Tamil Nadu"}
                </span>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/30 border border-border/50">
                <span className="text-xs text-muted-foreground font-semibold">Statutory GSTIN</span>
                <span className="text-sm font-mono font-bold text-foreground">
                  {orgData?.organization?.gstin || "Unregistered"}
                </span>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/30 border border-border/50">
                <span className="text-xs text-muted-foreground font-semibold">Primary Milling HSN</span>
                <span className="text-sm font-mono font-bold text-foreground">21069099 (Food Preparations)</span>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/30 border border-border/50">
                <span className="text-xs text-muted-foreground font-semibold">Benchmark GST Tax Rate</span>
                <span className="text-sm font-bold text-emerald-600">5.00% (2.5% CGST + 2.5% SGST)</span>
              </div>
            </div>
          </div>

          {/* Statutory Tax Rates Schedule (IMP-016) */}
          <div className="rounded-xl border border-border/80 bg-card shadow-xs">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Statutory GST Tax Rate Schedule
                </h2>
                <p className="text-xs text-muted-foreground">
                  Effective-dated HSN tax rates enforced during invoicing
                </p>
              </div>
              {canEditSettings && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddTaxModal(true)}
                  className="h-8 gap-1.5 text-xs"
                >
                  <PlusIcon className="size-3.5" />
                  Add Tax Rate
                </Button>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>HSN Code</TableHead>
                  <TableHead className="text-right">Total Rate</TableHead>
                  <TableHead className="text-right">CGST</TableHead>
                  <TableHead className="text-right">SGST</TableHead>
                  <TableHead className="text-right">IGST</TableHead>
                  <TableHead>Effective From</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(taxRatesData?.taxRates ?? []).map((tr) => (
                  <TableRow key={tr.id}>
                    <TableCell className="font-mono text-xs font-semibold">{tr.hsnCode}</TableCell>
                    <TableCell className="text-right text-xs font-bold">{Number(tr.rate)}%</TableCell>
                    <TableCell className="text-right text-xs">{Number(tr.cgstRate)}%</TableCell>
                    <TableCell className="text-right text-xs">{Number(tr.sgstRate)}%</TableCell>
                    <TableCell className="text-right text-xs">{Number(tr.igstRate)}%</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(tr.effectiveFrom)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="rounded-xl border border-border/80 bg-card shadow-xs">
            <div className="border-b border-border/60 px-5 py-4 sm:px-6">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <FileTextIcon className="size-4 text-primary" />
                Accounting & Decimal Standards
              </h2>
              <p className="text-xs text-muted-foreground">
                Statutory precision and document sequence configurations
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 px-5 py-4 sm:px-6 sm:pb-6">
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/30 border border-border/50">
                <span className="text-xs text-muted-foreground font-semibold">Inventory Costing Method</span>
                <span className="text-sm font-bold text-foreground">Weighted-Average Costing (WAC)</span>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/30 border border-border/50">
                <span className="text-xs text-muted-foreground font-semibold">Statutory Rounding Rule</span>
                <span className="text-sm font-bold text-foreground">Section 170 CGST Act (Nearest ₹1.00)</span>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/30 border border-border/50">
                <span className="text-xs text-muted-foreground font-semibold">Financial Year Timezone</span>
                <span className="text-sm font-bold text-foreground">Asia/Kolkata (IST +05:30)</span>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/30 border border-border/50">
                <span className="text-xs text-muted-foreground font-semibold">Invoice Sequence Series</span>
                <span className="text-sm font-mono font-bold text-foreground">INV/2025-26/XXXX</span>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/30 border border-border/50">
                <span className="text-xs text-muted-foreground font-semibold">Sales Order Series</span>
                <span className="text-sm font-mono font-bold text-foreground">SO/YYYY/XXXX</span>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/30 border border-border/50">
                <span className="text-xs text-muted-foreground font-semibold">Purchase Receipt Series</span>
                <span className="text-sm font-mono font-bold text-foreground">PR/YYYY/XXXX</span>
              </div>
            </div>
          </div>

          {/* Accessibility & Motion Control (F-062: WCAG 2.2 SC 2.2.2 Pause, Stop, Hide) */}
          <div className="rounded-xl border border-border/80 bg-card shadow-xs">
            <div className="border-b border-border/60 px-5 py-4 sm:px-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <PlayIcon className="size-4 text-primary" />
                  Interface Motion & Accessibility
                </h2>
                <p className="text-xs text-muted-foreground">
                  User preference controls for WCAG 2.2 Success Criterion 2.2.2 (Pause, Stop, Hide)
                </p>
              </div>
              <Button
                variant={isMotionPaused ? "primary" : "outline"}
                size="sm"
                data-pause-motion
                onClick={toggleMotion}
                className="gap-1.5 cursor-pointer"
              >
                {isMotionPaused ? (
                  <>
                    <PlayIcon className="size-3.5" />
                    Resume Animations
                  </>
                ) : (
                  <>
                    <PauseIcon className="size-3.5" />
                    Pause Animations
                  </>
                )}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 px-5 py-4 sm:px-6 sm:pb-6">
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/30 border border-border/50">
                <span className="text-xs text-muted-foreground font-semibold">Continuous Animation State</span>
                <span className="text-sm font-bold text-foreground">
                  {isMotionPaused ? "Paused (Animations Suppressed)" : "Active (Continuous Animations Allowed)"}
                </span>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/30 border border-border/50">
                <span className="text-xs text-muted-foreground font-semibold">Pulsing Badges & Indicators</span>
                <span className="text-sm font-bold text-foreground">
                  Finite Pulse (Auto-stops within 4.0 seconds)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: User and Role Management */}
      {activeTab === "users" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-foreground">System Users & Access Roles</h2>
              <p className="text-xs text-muted-foreground">
                Manage credentials, role assignments, and account active states.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchUsers()}
                className="gap-1.5 cursor-pointer"
              >
                <RefreshCwIcon className="size-3.5" />
                Refresh
              </Button>
              <Button
                size="sm"
                onClick={() => setShowAddUserModal(true)}
                className="gap-1.5 cursor-pointer"
              >
                <PlusIcon className="size-3.5" />
                Add User
              </Button>
            </div>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden shadow-xs">
            {isErrorUsers ? (
              <ErrorState
                title="Could not load users"
                description={extractErrorMessage(errorUsers)}
                error={errorUsers}
                onRetry={() => refetchUsers()}
                className="border-0 rounded-none"
              />
            ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-semibold text-xs">Name</TableHead>
                  <TableHead className="font-semibold text-xs">Email</TableHead>
                  <TableHead className="font-semibold text-xs">Role</TableHead>
                  <TableHead className="font-semibold text-xs">Status</TableHead>
                  <TableHead className="font-semibold text-xs">Created At</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingUsers ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-xs">
                      Loading users directory...
                    </TableCell>
                  </TableRow>
                ) : usersList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-6 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <p className="text-xs text-muted-foreground">No users found.</p>
                        {canEditSettings && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowAddUserModal(true)}
                          >
                            Add User
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  usersList.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-semibold text-foreground text-xs">
                        {u.name}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {u.email}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            u.role === "ADMIN" || u.role === "OWNER"
                              ? "default"
                              : u.role === "ACCOUNTANT"
                                ? "info"
                                : u.role === "PRODUCTION"
                                  ? "warning"
                                  : "secondary"
                          }
                          className="text-[10px] font-semibold"
                        >
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {u.isActive ? (
                          <Badge variant="success" className="text-[10px]">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="danger" className="text-[10px]">
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(u.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canEditSettings && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingUser(u);
                                setEditUserName(u.name);
                                setEditUserRole(u.role);
                              }}
                              className="text-xs cursor-pointer"
                            >
                              Edit
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={u.id === currentUser?.id || toggleUserMutation.isPending}
                            onClick={() =>
                              toggleUserMutation.mutate({
                                id: u.id,
                                isActive: !u.isActive,
                              })
                            }
                            className="text-xs cursor-pointer"
                          >
                            {u.isActive ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: DPDP Act 2023 Compliance */}
      {activeTab === "dpdp" && (
        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-border/80 bg-card shadow-xs">
            <div className="border-b border-border/60 px-5 py-4 sm:px-6">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <ShieldCheckIcon className="size-4 text-emerald-600" />
                Data Protection & Privacy Policy (DPDP Act 2023)
              </h2>
              <p className="text-xs text-muted-foreground">
                Statutory customer personal data governance, retention cycles, and deletion rules
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-5 py-4 sm:px-6 sm:pb-6">
              <div className="p-4 rounded-lg border bg-muted/20 flex flex-col gap-1.5">
                <span className="text-xs font-bold text-foreground">Section 11: Right to Access</span>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Data fiduciaries must provide portable JSON export of customer personal data and linked transactions upon verified request.
                </p>
                <div className="mt-2 text-[11px] font-mono text-emerald-600 font-semibold">
                  API: /api/v1/sales/customers/:id/export
                </div>
              </div>

              <div className="p-4 rounded-lg border bg-muted/20 flex flex-col gap-1.5">
                <span className="text-xs font-bold text-foreground">Section 12: Right to Erasure</span>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Right to erasure is balanced against statutory tax retention. Contact PII is anonymized while preserving financial ledgers.
                </p>
                <div className="mt-2 text-[11px] font-mono text-emerald-600 font-semibold">
                  API: /api/v1/sales/customers/:id/anonymize
                </div>
              </div>

              <div className="p-4 rounded-lg border bg-muted/20 flex flex-col gap-1.5">
                <span className="text-xs font-bold text-foreground">Statutory 7-Year Tax Lock</span>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Under Section 36 CGST Act 2017, invoice headers, line amounts, and tax credits must be retained for at least 72 months.
                </p>
                <div className="mt-2 text-[11px] font-mono text-indigo-600 font-semibold">
                  Enforced via PostgreSQL Ledger Rules
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      <Dialog open={showAddUserModal} onOpenChange={setShowAddUserModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Staff Member</DialogTitle>
            <DialogDescription>
              Create credentials and assign operational role
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateUser} className="mt-2 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="settings-user-name"
                className="text-xs font-semibold text-muted-foreground"
              >
                Full Name
              </Label>
              <Input
                id="settings-user-name"
                type="text"
                required
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="e.g. Senthil Kumar"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="settings-user-email"
                className="text-xs font-semibold text-muted-foreground"
              >
                Email Address
              </Label>
              <Input
                id="settings-user-email"
                type="email"
                required
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="e.g. senthil@millledger.local"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="settings-user-password"
                className="text-xs font-semibold text-muted-foreground"
              >
                Password
              </Label>
              <Input
                id="settings-user-password"
                type="password"
                required
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder="Minimum 8 characters"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="settings-user-role"
                className="text-xs font-semibold text-muted-foreground"
              >
                Role Assignment
              </Label>
              <Select
                value={newUserRole}
                onValueChange={(value) => setNewUserRole(value as Role)}
              >
                <SelectTrigger id="settings-user-role" className="font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SALESMAN">Salesman (Field sales & bookings)</SelectItem>
                  <SelectItem value="PRODUCTION">Production Manager (Shop floor & runs)</SelectItem>
                  <SelectItem value="ACCOUNTANT">Accountant (Invoices, reports & taxes)</SelectItem>
                  <SelectItem value="ADMIN">Administrator (Full operational management)</SelectItem>
                  <SelectItem value="OWNER">Owner (Executive & financial oversight)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="mt-4 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddUserModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createUserMutation.isPending}
                className="cursor-pointer"
              >
                {createUserMutation.isPending ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Organization Modal (IMP-016) */}
      <Dialog open={showEditOrgModal} onOpenChange={setShowEditOrgModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Organization Profile</DialogTitle>
            <DialogDescription>Update legal entity name, state, and GSTIN.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="org-name" className="text-xs">Legal Entity Name</Label>
              <Input id="org-name" value={orgNameInput} onChange={(e) => setOrgNameInput(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="org-state" className="text-xs">State</Label>
              <Input id="org-state" value={orgStateInput} onChange={(e) => setOrgStateInput(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="org-gstin" className="text-xs">GSTIN</Label>
              <Input id="org-gstin" value={orgGstinInput} onChange={(e) => setOrgGstinInput(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" size="sm" onClick={() => setShowEditOrgModal(false)}>Cancel</Button>
            <Button size="sm" disabled={updateOrgMutation.isPending} onClick={() => updateOrgMutation.mutate()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Tax Rate Modal (IMP-016) */}
      <Dialog open={showAddTaxModal} onOpenChange={setShowAddTaxModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Statutory Tax Rate</DialogTitle>
            <DialogDescription>Configure effective-dated GST rate for an HSN code.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="tax-hsn" className="text-xs">HSN Code</Label>
              <Input id="tax-hsn" value={taxHsn} onChange={(e) => setTaxHsn(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="tax-rate" className="text-xs">Total GST Rate (%)</Label>
              <Input id="tax-rate" type="number" step="0.5" value={taxRateVal} onChange={(e) => setTaxRateVal(Number(e.target.value))} />
            </div>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" size="sm" onClick={() => setShowAddTaxModal(false)}>Cancel</Button>
            <Button size="sm" disabled={addTaxRateMutation.isPending} onClick={() => addTaxRateMutation.mutate()}>Save Tax Rate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal (IMP-017) */}
      <Dialog open={editingUser !== null} onOpenChange={(o) => { if (!o) setEditingUser(null); }}>
        {editingUser && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>{editingUser.email}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 py-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="edit-user-name" className="text-xs">Full Name</Label>
                <Input id="edit-user-name" value={editUserName} onChange={(e) => setEditUserName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Role</Label>
                <Select value={editUserRole} onValueChange={(v) => setEditUserRole(v as Role)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SALESMAN">Salesman</SelectItem>
                    <SelectItem value="PRODUCTION">Production Manager</SelectItem>
                    <SelectItem value="ACCOUNTANT">Accountant</SelectItem>
                    <SelectItem value="ADMIN">Administrator</SelectItem>
                    <SelectItem value="OWNER">Owner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="border-t pt-4">
              <Button variant="outline" size="sm" onClick={() => setEditingUser(null)}>Cancel</Button>
              <Button size="sm" disabled={updateUserMutation.isPending} onClick={() => updateUserMutation.mutate()}>Save User</Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* TAB 2: Facilities & Warehouses */}
      {activeTab === "warehouses" && (
        <div className="flex flex-col gap-6">
          {/* Facilities Card */}
          <div className="rounded-xl border border-border/80 bg-card shadow-xs">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-base font-bold text-foreground">Facilities</h2>
                <p className="text-xs text-muted-foreground">
                  Physical mill plants and regional hubs within your organization
                </p>
              </div>
              {canEditSettings && (
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingFacility(null);
                    setFacCode("");
                    setFacName("");
                    setFacState("Tamil Nadu");
                    setShowFacilityModal(true);
                  }}
                  className="h-8 gap-1.5 text-xs"
                >
                  <PlusIcon className="size-3.5" />
                  Add Facility
                </Button>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Facility Name</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead className="text-right">Warehouses</TableHead>
                  <TableHead>Status</TableHead>
                  {canEditSettings && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {facilitiesList.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-mono text-xs font-semibold">{f.code}</TableCell>
                    <TableCell className="font-medium">{f.name}</TableCell>
                    <TableCell className="text-xs">{f.state}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{f._count?.warehouses ?? 0}</TableCell>
                    <TableCell>
                      <Badge variant={f.isActive ? "success" : "secondary"}>
                        {f.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    {canEditSettings && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => {
                              setEditingFacility(f);
                              setFacCode(f.code);
                              setFacName(f.name);
                              setFacState(f.state);
                              setShowFacilityModal(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => toggleFacilityActiveMutation.mutate(f)}
                          >
                            {f.isActive ? "Deactivate" : "Reactivate"}
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Warehouses Card */}
          <div className="rounded-xl border border-border/80 bg-card shadow-xs">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-base font-bold text-foreground">Warehouses</h2>
                <p className="text-xs text-muted-foreground">
                  Storage locations for raw materials, production output, and order fulfilment
                </p>
              </div>
              {canEditSettings && (
                <Button
                  size="sm"
                  disabled={facilitiesList.filter((f) => f.isActive).length === 0}
                  onClick={() => {
                    setEditingWarehouse(null);
                    setWhCode("");
                    setWhName("");
                    setWhFacilityId(
                      facilitiesList.find((f) => f.isActive)?.id || "",
                    );
                    setShowWarehouseModal(true);
                  }}
                  className="h-8 gap-1.5 text-xs"
                >
                  <PlusIcon className="size-3.5" />
                  Add Warehouse
                </Button>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Warehouse Name</TableHead>
                  <TableHead>Facility</TableHead>
                  <TableHead>Status</TableHead>
                  {canEditSettings && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {warehousesList.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-mono text-xs font-semibold">{w.code}</TableCell>
                    <TableCell className="font-medium">{w.name}</TableCell>
                    <TableCell className="text-xs">
                      {w.facility ? `${w.facility.code} · ${w.facility.name}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={w.isActive ? "success" : "secondary"}>
                        {w.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    {canEditSettings && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => {
                              setEditingWarehouse(w);
                              setWhCode(w.code);
                              setWhName(w.name);
                              setWhFacilityId(w.facilityId);
                              setShowWarehouseModal(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => toggleWarehouseActiveMutation.mutate(w)}
                          >
                            {w.isActive ? "Deactivate" : "Reactivate"}
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Facility Modal */}
      <Dialog open={showFacilityModal} onOpenChange={setShowFacilityModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingFacility ? "Edit Facility" : "Add Facility"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            {!editingFacility && (
              <div className="flex flex-col gap-1">
                <Label htmlFor="fac-code" className="text-xs">Code</Label>
                <Input id="fac-code" value={facCode} onChange={(e) => setFacCode(e.target.value)} placeholder="FAC-2" />
              </div>
            )}
            <div className="flex flex-col gap-1">
              <Label htmlFor="fac-name" className="text-xs">Name</Label>
              <Input id="fac-name" value={facName} onChange={(e) => setFacName(e.target.value)} placeholder="Chennai Packaging Plant" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="fac-state" className="text-xs">State</Label>
              <Input id="fac-state" value={facState} onChange={(e) => setFacState(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" size="sm" onClick={() => setShowFacilityModal(false)}>Cancel</Button>
            <Button size="sm" disabled={saveFacilityMutation.isPending || !facName.trim() || (!editingFacility && !facCode.trim())} onClick={() => saveFacilityMutation.mutate()}>
              Save Facility
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Warehouse Modal */}
      <Dialog open={showWarehouseModal} onOpenChange={setShowWarehouseModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingWarehouse ? "Edit Warehouse" : "Add Warehouse"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            {!editingWarehouse && (
              <div className="flex flex-col gap-1">
                <Label htmlFor="wh-code" className="text-xs">Code</Label>
                <Input id="wh-code" value={whCode} onChange={(e) => setWhCode(e.target.value)} placeholder="WH-2" />
              </div>
            )}
            <div className="flex flex-col gap-1">
              <Label htmlFor="wh-name" className="text-xs">Name</Label>
              <Input id="wh-name" value={whName} onChange={(e) => setWhName(e.target.value)} placeholder="Finished Goods Store" />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="wh-facility" className="text-xs">Facility</Label>
              <Select value={whFacilityId} onValueChange={setWhFacilityId}>
                <SelectTrigger id="wh-facility" className="h-9 text-xs"><SelectValue placeholder="Select facility" /></SelectTrigger>
                <SelectContent>
                  {facilitiesList.filter((f) => f.isActive).map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.code} · {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" size="sm" onClick={() => setShowWarehouseModal(false)}>Cancel</Button>
            <Button size="sm" disabled={saveWarehouseMutation.isPending || !whName.trim() || !whFacilityId || (!editingWarehouse && !whCode.trim())} onClick={() => saveWarehouseMutation.mutate()}>
              Save Warehouse
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
