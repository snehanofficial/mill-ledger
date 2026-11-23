import { describe, expect, it } from "vitest";
import { hasRbacPermission } from "./rbac.js";
import type { Action, Resource } from "@mill-ledger/shared";

describe("RBAC policy permissions", () => {
  it("grants ADMIN full permissions across all core resources", () => {
    expect(hasRbacPermission("ADMIN", "order", "approve")).toBe(true);
    expect(hasRbacPermission("ADMIN", "order", "dispatch")).toBe(true);
    expect(hasRbacPermission("ADMIN", "invoice", "create")).toBe(true);
    expect(hasRbacPermission("ADMIN", "production_run", "approve")).toBe(true);
    expect(hasRbacPermission("ADMIN", "inventory", "create")).toBe(true);
    expect(hasRbacPermission("ADMIN", "purchase", "create")).toBe(true);
    expect(hasRbacPermission("ADMIN", "payment", "create")).toBe(true);
    expect(hasRbacPermission("ADMIN", "report", "read")).toBe(true);
    expect(hasRbacPermission("ADMIN", "user", "create")).toBe(true);
    expect(hasRbacPermission("ADMIN", "customer", "create")).toBe(true);
  });

  it("grants SALESMAN order creation and read access only", () => {
    expect(hasRbacPermission("SALESMAN", "order", "create")).toBe(true);
    expect(hasRbacPermission("SALESMAN", "order", "read")).toBe(true);
    expect(hasRbacPermission("SALESMAN", "order", "update")).toBe(true);
    expect(hasRbacPermission("SALESMAN", "inventory", "read")).toBe(true);
    expect(hasRbacPermission("SALESMAN", "customer", "read")).toBe(true);
    expect(hasRbacPermission("SALESMAN", "report", "read")).toBe(true);

    // Salesman must not approve or dispatch orders
    expect(hasRbacPermission("SALESMAN", "order", "approve")).toBe(false);
    expect(hasRbacPermission("SALESMAN", "order", "dispatch")).toBe(false);

    // Salesman must not create invoices, purchases, payments, or users
    expect(hasRbacPermission("SALESMAN", "invoice", "create")).toBe(false);
    expect(hasRbacPermission("SALESMAN", "purchase", "create")).toBe(false);
    expect(hasRbacPermission("SALESMAN", "payment", "create")).toBe(false);
    expect(hasRbacPermission("SALESMAN", "user", "create")).toBe(false);
  });

  it("grants PRODUCTION permission to create, update, and approve production runs", () => {
    expect(hasRbacPermission("PRODUCTION", "production_run", "create")).toBe(
      true,
    );
    expect(hasRbacPermission("PRODUCTION", "production_run", "update")).toBe(
      true,
    );
    expect(hasRbacPermission("PRODUCTION", "production_run", "approve")).toBe(
      true,
    );
    expect(hasRbacPermission("PRODUCTION", "inventory", "read")).toBe(true);
    expect(hasRbacPermission("PRODUCTION", "purchase", "create")).toBe(true);

    // Production must not create invoices or orders
    expect(hasRbacPermission("PRODUCTION", "invoice", "create")).toBe(false);
    expect(hasRbacPermission("PRODUCTION", "order", "create")).toBe(false);
    expect(hasRbacPermission("PRODUCTION", "payment", "create")).toBe(false);
  });

  it("strictly enforces that ACCOUNTANT has no write endpoints (auditor write prevention)", () => {
    // Read access is allowed
    expect(hasRbacPermission("ACCOUNTANT", "order", "read")).toBe(true);
    expect(hasRbacPermission("ACCOUNTANT", "invoice", "read")).toBe(true);
    expect(hasRbacPermission("ACCOUNTANT", "payment", "read")).toBe(true);
    expect(hasRbacPermission("ACCOUNTANT", "purchase", "read")).toBe(true);
    expect(hasRbacPermission("ACCOUNTANT", "inventory", "read")).toBe(true);
    expect(hasRbacPermission("ACCOUNTANT", "report", "read")).toBe(true);
    expect(hasRbacPermission("ACCOUNTANT", "customer", "read")).toBe(true);

    // Write actions are strictly prohibited across all resources
    const writeActions: Action[] = [
      "create",
      "update",
      "delete",
      "approve",
      "dispatch",
    ];
    const allResources: Resource[] = [
      "order",
      "invoice",
      "production_run",
      "inventory",
      "purchase",
      "payment",
      "report",
      "user",
      "customer",
    ];

    for (const resource of allResources) {
      for (const action of writeActions) {
        expect(hasRbacPermission("ACCOUNTANT", resource, action)).toBe(false);
      }
    }
  });

  it("grants OWNER read access across resources but no write endpoints by default", () => {
    expect(hasRbacPermission("OWNER", "order", "read")).toBe(true);
    expect(hasRbacPermission("OWNER", "invoice", "read")).toBe(true);
    expect(hasRbacPermission("OWNER", "production_run", "read")).toBe(true);
    expect(hasRbacPermission("OWNER", "inventory", "read")).toBe(true);
    expect(hasRbacPermission("OWNER", "payment", "read")).toBe(true);
    expect(hasRbacPermission("OWNER", "report", "read")).toBe(true);

    // Owner is not a superuser without explicit assignment
    expect(hasRbacPermission("OWNER", "order", "create")).toBe(false);
    expect(hasRbacPermission("OWNER", "order", "approve")).toBe(false);
    expect(hasRbacPermission("OWNER", "invoice", "create")).toBe(false);
    expect(hasRbacPermission("OWNER", "payment", "create")).toBe(false);
  });

  it("returns false for unknown resources or unregistered permissions", () => {
    expect(hasRbacPermission("SALESMAN", "user", "delete")).toBe(false);
    expect(hasRbacPermission("PRODUCTION", "user", "update")).toBe(false);
  });
});
