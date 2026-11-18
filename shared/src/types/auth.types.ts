export type Role =
  | "admin"
  | "salesman"
  | "production_manager"
  | "store_manager"
  | "accounts"
  | "auditor";

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
  | "user";

export interface Permission {
  action: Action;
  resource: Resource;
}

export interface UserContext {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
}
