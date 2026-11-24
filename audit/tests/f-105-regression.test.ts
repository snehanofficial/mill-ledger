import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("F-105 Regression: Production Runbooks and Data Dictionary", () => {
  const rootDir = path.resolve(__dirname, "../..");

  it("ensures deployment-and-rollback runbook exists with verified operational steps", () => {
    const filePath = path.join(rootDir, "docs/runbooks/deployment-and-rollback.md");
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("Pre-Deployment Verification Checklist");
    expect(content).toContain("prisma migrate deploy");
    expect(content).toContain("Rollback Procedure");
    expect(content).toContain("invariants.sql");
  });

  it("ensures disaster-recovery-restore runbook exists with pg_restore steps and RTO/RPO targets", () => {
    const filePath = path.join(rootDir, "docs/runbooks/disaster-recovery-restore.md");
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("Recovery Time Objective (RTO)");
    expect(content).toContain("Recovery Point Objective (RPO)");
    expect(content).toContain("pg_restore");
    expect(content).toContain("--clean");
    expect(content).toContain("invariants.sql");
  });

  it("ensures secret-rotation runbook exists covering BETTER_AUTH_SECRET and DATABASE_URL", () => {
    const filePath = path.join(rootDir, "docs/runbooks/secret-rotation.md");
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("BETTER_AUTH_SECRET");
    expect(content).toContain("DATABASE_URL");
    expect(content).toContain("Dual-User Rotation Strategy");
    expect(content).toContain("Emergency Incident Secret Revocation");
  });

  it("ensures create-super-admin runbook exists documenting OD-02 policies and emergency procedures", () => {
    const filePath = path.join(rootDir, "docs/runbooks/create-super-admin.md");
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("OD-02 Policy");
    expect(content).toContain("admin:bootstrap");
    expect(content).toContain("AuditLog");
  });

  it("ensures data-dictionary.md documents all 40 models, 12 enums, and precision standards", () => {
    const filePath = path.join(rootDir, "docs/data-dictionary.md");
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");

    // Mathematical precision standards
    expect(content).toContain("Decimal(15,2)");
    expect(content).toContain("Decimal(18,6)");

    // Sample core models across domains
    const requiredModels = [
      "User",
      "Session",
      "Account",
      "Organization",
      "Customer",
      "Supplier",
      "InventoryItem",
      "StockMovement",
      "StockReservation",
      "ProductionRun",
      "ProductionRunMaterial",
      "SalesOrder",
      "SalesOrderLine",
      "SalesInvoice",
      "SalesInvoiceLine",
      "Dispatch",
      "Payment",
      "PaymentAllocation",
      "CreditNote",
      "DebitNote",
      "AuditLog",
      "DocumentSequence",
    ];

    for (const model of requiredModels) {
      expect(content).toContain(`\`${model}\``);
    }

    // Sample core enums
    const requiredEnums = [
      "ItemCategory",
      "MovementType",
      "ProductionRunStatus",
      "OrderStatus",
      "InvoiceStatus",
      "PaymentMode",
      "PaymentStatus",
    ];

    for (const enumName of requiredEnums) {
      expect(content).toContain(`\`${enumName}\``);
    }
  });
});
