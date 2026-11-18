export type Role = "ADMIN" | "SALESMAN" | "PRODUCTION" | "ACCOUNTANT" | "OWNER";

export type Action =
  "create" | "read" | "update" | "delete" | "approve" | "dispatch";

export type Resource =
  | "order"
  | "invoice"
  | "production_run"
  | "inventory"
  | "purchase"
  | "payment"
  | "report"
  | "user"
  | "customer";

export interface Permission {
  action: Action;
  resource: Resource;
}

export interface UserContext {
  id: string;
  name?: string;
  email: string;
  role: Role;
  isActive: boolean;
  organizationId?: string;
  image?: string | null;
}
