import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatDate } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
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
  const [activeTab, setActiveTab] = useState<"mill" | "users" | "dpdp">("mill");
  const [showAddUserModal, setShowAddUserModal] = useState(false);

  // Add User Form State
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<Role>("SALESMAN");

  // Query users
  const { data: usersData, isLoading: isLoadingUsers, refetch: refetchUsers } = useQuery<{
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
    onError: (err: any) => {
      const msg = err.response?.data?.error?.message || err.message || "Failed to create user";
      toast.error(`Error: ${msg}`);
    },
  });

  // Toggle User Active Status Mutation
  const toggleUserMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiClient.put(`/users/${id}`, { isActive });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User status updated successfully");
    },
    onError: (err: any) => {
      toast.error(`Failed to update user: ${err.message}`);
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Mill Settings & Administration
            </h1>
            <Badge variant="outline" className="text-xs">
              System Admin
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure enterprise parameters, manage staff access roles, and maintain statutory GST settings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 text-xs flex items-center gap-1.5"
          >
            <ShieldCheckIcon className="size-3.5" />
            RBAC & ABAC Enforced
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("mill")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${
            activeTab === "mill"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Building2Icon className="size-4" />
          Mill & Statutory GST
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${
            activeTab === "users"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <UsersIcon className="size-4" />
          User & Role Management
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("dpdp")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${
            activeTab === "dpdp"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <LockIcon className="size-4" />
          Data Protection (DPDP 2023)
        </button>
      </div>

      {/* TAB 1: Mill & Statutory Parameters */}
      {activeTab === "mill" && (
        <div className="flex flex-col gap-6">
          <div className="rounded-xl border bg-card p-5 sm:p-6 shadow-xs flex flex-col gap-5">
            <div className="border-b pb-4">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Building2Icon className="size-4 text-primary" />
                Mill Organization Profile
              </h2>
              <p className="text-xs text-muted-foreground">
                Official entity registration and place of supply configurations
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/30 border border-border/50">
                <span className="text-xs text-muted-foreground font-semibold">Legal Entity Name</span>
                <span className="text-sm font-bold text-foreground">MillLedger Foods Pvt Ltd</span>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/30 border border-border/50">
                <span className="text-xs text-muted-foreground font-semibold">Organization Code</span>
                <span className="text-sm font-mono font-bold text-foreground">MILL</span>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/30 border border-border/50">
                <span className="text-xs text-muted-foreground font-semibold">Principal Place of Business</span>
                <span className="text-sm font-bold text-foreground">Tamil Nadu (State Code 33)</span>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-muted/30 border border-border/50">
                <span className="text-xs text-muted-foreground font-semibold">Statutory GSTIN</span>
                <span className="text-sm font-mono font-bold text-foreground">33AAAAA0000A1Z5</span>
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

          <div className="rounded-xl border bg-card p-5 sm:p-6 shadow-xs flex flex-col gap-5">
            <div className="border-b pb-4">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <FileTextIcon className="size-4 text-primary" />
                Accounting & Decimal Standards
              </h2>
              <p className="text-xs text-muted-foreground">
                Statutory precision and document sequence configurations
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-xs">
                      No users found.
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
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* TAB 3: DPDP Act 2023 Compliance */}
      {activeTab === "dpdp" && (
        <div className="flex flex-col gap-6">
          <div className="rounded-xl border bg-card p-5 sm:p-6 shadow-xs flex flex-col gap-4">
            <div className="border-b pb-4">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <ShieldCheckIcon className="size-4 text-emerald-600" />
                Data Protection & Privacy Policy (DPDP Act 2023)
              </h2>
              <p className="text-xs text-muted-foreground">
                Statutory customer personal data governance, retention cycles, and deletion rules
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl border">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Add New Staff Member</h3>
                <p className="text-xs text-muted-foreground">
                  Create credentials and assign operational role
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddUserModal(false)}
              >
                ✕
              </Button>
            </div>

            <form onSubmit={handleCreateUser} className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. Senthil Kumar"
                  className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="e.g. senthil@millledger.local"
                  className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Role Assignment
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as Role)}
                  className="rounded-md border bg-background px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="SALESMAN">Salesman (Field sales & bookings)</option>
                  <option value="PRODUCTION">Production Manager (Shop floor & runs)</option>
                  <option value="ACCOUNTANT">Accountant (Invoices, reports & taxes)</option>
                  <option value="ADMIN">Administrator (Full operational management)</option>
                  <option value="OWNER">Owner (Executive & financial oversight)</option>
                </select>
              </div>

              <div className="mt-4 flex items-center justify-end gap-3 border-t pt-4">
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
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
