import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./db/client.js";
import { resetOperationalData } from "./db/reset.js";

const migrationFile = resolve(
  __dirname,
  "../prisma/migrations/20261120000002_ledger_immutability_triggers/migration.sql"
);

describe("F-009: Database-Level Immutability Enforcement", () => {
  beforeAll(async () => {
    expect(existsSync(migrationFile)).toBe(true);
    const sql = readFileSync(migrationFile, "utf-8");
    await prisma.$executeRawUnsafe(sql);
  });

  afterAll(async () => {
    await resetOperationalData();
  });
  it("rejects direct SQL UPDATE on stock_movement", async () => {
    const sm = await prisma.stockMovement.findFirst();
    expect(sm).toBeDefined();
    if (!sm) return;

    await expect(
      prisma.$executeRaw`UPDATE "stock_movement" SET "quantity" = 999.000000 WHERE "id" = ${sm.id}`
    ).rejects.toThrow();
  });

  it("rejects direct SQL DELETE on stock_movement", async () => {
    // Create a temporary movement to attempt deleting
    const item = await prisma.inventoryItem.findFirstOrThrow();
    const wh = await prisma.warehouse.findFirstOrThrow();

    const tempSm = await prisma.stockMovement.create({
      data: {
        inventoryItemId: item.id,
        warehouseId: wh.id,
        movementType: "ADJUSTMENT",
        quantity: 1,
        unitCost: 10,
        totalCost: 10,
        notes: "TEST-DELETE-REF",
      },
    });

    await expect(
      prisma.$executeRaw`DELETE FROM "stock_movement" WHERE "id" = ${tempSm.id}`
    ).rejects.toThrow();
  });

  it("rejects direct SQL UPDATE of financial totals on POSTED sales_invoice", async () => {
    const org = await prisma.organization.findFirstOrThrow();
    const cust = await prisma.customer.findFirstOrThrow();

    const testInv = await prisma.salesInvoice.create({
      data: {
        organizationId: org.id,
        invoiceNumber: `INV-IMMUTABLE-${Date.now()}`,
        financialYear: "2026-27",
        customerId: cust.id,
        customerNameSnapshot: cust.name,
        deliveryStateSnapshot: "Tamil Nadu",
        companyGstinSnapshot: "33AAAAA0000A1Z5",
        status: "POSTED",
        taxableAmount: 100,
        cgstAmount: 2.5,
        sgstAmount: 2.5,
        igstAmount: 0,
        totalTaxAmount: 5,
        totalAmount: 105,
        outstandingAmount: 105,
      },
    });

    await expect(
      prisma.$executeRaw`UPDATE "sales_invoice" SET "totalAmount" = 9999.00 WHERE "id" = ${testInv.id}`
    ).rejects.toThrow();
  });

  it("rejects direct SQL DELETE on POSTED sales_invoice", async () => {
    const org = await prisma.organization.findFirstOrThrow();
    const cust = await prisma.customer.findFirstOrThrow();

    const testInv = await prisma.salesInvoice.create({
      data: {
        organizationId: org.id,
        invoiceNumber: `INV-DEL-IMMUTABLE-${Date.now()}`,
        financialYear: "2026-27",
        customerId: cust.id,
        customerNameSnapshot: cust.name,
        deliveryStateSnapshot: "Tamil Nadu",
        companyGstinSnapshot: "33AAAAA0000A1Z5",
        status: "POSTED",
        taxableAmount: 100,
        cgstAmount: 2.5,
        sgstAmount: 2.5,
        igstAmount: 0,
        totalTaxAmount: 5,
        totalAmount: 105,
        outstandingAmount: 105,
      },
    });

    await expect(
      prisma.$executeRaw`DELETE FROM "sales_invoice" WHERE "id" = ${testInv.id}`
    ).rejects.toThrow();
  });
});
