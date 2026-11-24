import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../db/client.js";
import { resetOperationalData } from "../db/reset.js";
import { seedBenchmarkMasters } from "../db/seed.js";

const migrationFile = resolve(
  __dirname,
  "../../prisma/migrations/20261120000002_ledger_immutability_triggers/migration.sql"
);

describe("F-009: Database-Level Immutability Enforcement", () => {
  beforeAll(async () => {
    expect(existsSync(migrationFile)).toBe(true);
    const sql = readFileSync(migrationFile, "utf-8");
    await prisma.$executeRawUnsafe(sql);
    await resetOperationalData();
    await seedBenchmarkMasters();
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

  it("rejects status downgrade from POSTED to DRAFT on sales_invoice", async () => {
    const org = await prisma.organization.findFirstOrThrow();
    const cust = await prisma.customer.findFirstOrThrow();

    const testInv = await prisma.salesInvoice.create({
      data: {
        organizationId: org.id,
        invoiceNumber: `INV-DOWNGRADE-${Date.now()}`,
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

    // Status downgrade must be blocked
    await expect(
      prisma.$executeRaw`UPDATE "sales_invoice" SET "status" = 'DRAFT' WHERE "id" = ${testInv.id}`
    ).rejects.toThrow();
  });

  it("rejects mutation of snapshot fields on POSTED sales_invoice", async () => {
    const org = await prisma.organization.findFirstOrThrow();
    const cust = await prisma.customer.findFirstOrThrow();

    const testInv = await prisma.salesInvoice.create({
      data: {
        organizationId: org.id,
        invoiceNumber: `INV-SNAPSHOT-${Date.now()}`,
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

    // Forging GSTIN snapshot must be blocked
    await expect(
      prisma.$executeRaw`UPDATE "sales_invoice" SET "companyGstinSnapshot" = 'FORGED123' WHERE "id" = ${testInv.id}`
    ).rejects.toThrow();
  });

  it("rejects DELETE on a line belonging to a POSTED sales_invoice", async () => {
    const org = await prisma.organization.findFirstOrThrow();
    const cust = await prisma.customer.findFirstOrThrow();
    const variant = await prisma.productVariant.findFirstOrThrow();

    const testInv = await prisma.salesInvoice.create({
      data: {
        organizationId: org.id,
        invoiceNumber: `INV-LINE-DEL-${Date.now()}`,
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

    const testLine = await prisma.salesInvoiceLine.create({
      data: {
        invoiceId: testInv.id,
        productVariantId: variant.id,
        productNameSnapshot: variant.name,
        hsnCodeSnapshot: "21069099",
        quantity: 10,
        unitPrice: 10,
        taxRate: 5,
        taxableAmount: 100,
        cgstAmount: 2.5,
        sgstAmount: 2.5,
        igstAmount: 0,
        taxAmount: 5,
        lineTotal: 105,
      },
    });

    // DELETE on line of a POSTED invoice must be blocked
    await expect(
      prisma.$executeRaw`DELETE FROM "sales_invoice_line" WHERE "id" = ${testLine.id}`
    ).rejects.toThrow();
  });

  it("rejects UPDATE on a line belonging to a POSTED sales_invoice", async () => {
    const org = await prisma.organization.findFirstOrThrow();
    const cust = await prisma.customer.findFirstOrThrow();
    const variant = await prisma.productVariant.findFirstOrThrow();

    const testInv = await prisma.salesInvoice.create({
      data: {
        organizationId: org.id,
        invoiceNumber: `INV-LINE-UPD-${Date.now()}`,
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

    const testLine = await prisma.salesInvoiceLine.create({
      data: {
        invoiceId: testInv.id,
        productVariantId: variant.id,
        productNameSnapshot: variant.name,
        hsnCodeSnapshot: "21069099",
        quantity: 10,
        unitPrice: 10,
        taxRate: 5,
        taxableAmount: 100,
        cgstAmount: 2.5,
        sgstAmount: 2.5,
        igstAmount: 0,
        taxAmount: 5,
        lineTotal: 105,
      },
    });

    // UPDATE on line of a POSTED invoice must be blocked
    await expect(
      prisma.$executeRaw`UPDATE "sales_invoice_line" SET "lineTotal" = 9999 WHERE "id" = ${testLine.id}`
    ).rejects.toThrow();
  });
});
