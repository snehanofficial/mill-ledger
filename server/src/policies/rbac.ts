import type { Action, Resource, Role } from "@mill-ledger/shared";

export const ROLE_PERMISSIONS: Record<
  Role,
  Partial<Record<Resource, Action[]>>
> = {
  admin: {
    order: ["create", "read", "update", "delete", "approve", "dispatch"],
    invoice: ["create", "read", "update", "delete"],
    production_run: ["create", "read", "update", "delete", "approve"],
    inventory: ["create", "read", "update", "delete"],
    purchase: ["create", "read", "update", "delete", "approve"],
    payment: ["create", "read", "update", "delete"],
    report: ["read"],
    user: ["create", "read", "update", "delete"],
  },
  salesman: {
    order: ["create", "read"],
    inventory: ["read"],
    payment: ["create", "read"],
  },
  production_manager: {
    production_run: ["create", "read", "update", "approve"],
    inventory: ["read"],
    report: ["read"],
  },
  store_manager: {
    inventory: ["create", "read", "update"],
    purchase: ["create", "read"],
    production_run: ["read"],
  },
  accounts: {
    invoice: ["create", "read", "update"],
    payment: ["create", "read", "update"],
    purchase: ["read"],
    order: ["read"],
    report: ["read"],
  },
  auditor: {
    order: ["read"],
    invoice: ["read"],
    production_run: ["read"],
    inventory: ["read"],
    purchase: ["read"],
    payment: ["read"],
    report: ["read"],
  },
};

export function hasRbacPermission(
  role: Role,
  resource: Resource,
  action: Action,
): boolean {
  const resourcePermissions = ROLE_PERMISSIONS[role]?.[resource];
  if (!resourcePermissions) {
    return false;
  }
  return resourcePermissions.includes(action);
}
