import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "../db/client.js";
import { salesService } from "../modules/sales/sales.service.js";
import { financeService } from "../modules/finance/finance.service.js";
import { seedBenchmarkMasters } from "../db/seed.js";
import type { UserContext } from "@mill-ledger/shared";

describe("F-014: Dynamic Statutory TaxRate Master Resolution and Effective Date Scheduling", () => {
  let orgId: string;
  let customerId: string;
  let warehouseId: string;
  let adminUser: UserContext;
  let testVariantId: string;
  let testHsn: string;
  const runId = Date.now().toString().slice(-6);

  beforeAll(async () => {
    await seedBenchmarkMasters();

    const org = await prisma.organization.findUniqueOrThrow({
      where: { code: "MILL" },
    });
    orgId = org.id;

    const warehouse = await prisma.warehouse.findFirstOrThrow({
      where: { code: "WH-1" },
    });
    warehouseId = warehouse.id;

    const customer = await prisma.customer.findFirstOrThrow({
      where: { organizationId: orgId, code: "CUST-RET-A" },
    });
    customerId = customer.id;

    const uom = await prisma.unitOfMeasure.findFirstOrThrow({
      where: { organizationId: orgId, code: "PACKET" },
    });

    const user = await prisma.user.findFirstOrThrow({
      where: { email: "owner@millledger.local" },
    });
    adminUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: "OWNER",
      organizationId: orgId,
      isActive: true,
    };

    // Create a product with specific HSN code
    testHsn = `2106${runId}`;
    const product = await prisma.product.create({
      data: {
        organizationId: orgId,
        code: `PRD-TAX-${runId}`,
        name: `Tax Schedule Test Product ${runId}`,
        hsnCode: testHsn,
        taxRate: 5.0, // Legacy static column
      },
    });

    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: `SKU-TAX-${runId}`,
        name: `Variant Tax ${runId}`,
        packSize: 1,
        uomId: uom.id,
      },
    });
    testVariantId = variant.id;

    // Seed baseline 5% rate effective Jan 1, 2026
    await financeService.setTaxRate(orgId, {
      hsnCode: testHsn,
      rate: 5.0,
      cgstRate: 2.5,
      sgstRate: 2.5,
      igstRate: 5.0,
      effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    });
  });

  it("1. Dynamically resolves statutory rate from TaxRate master table on sales order creation", async () => {
    const { order } = await salesService.createSalesOrder(
      {
        organizationId: orgId,
        customerId,
        warehouseId,
        orderNumber: `SO-TAX-BASE-${runId}`,
        lines: [
          { productVariantId: testVariantId, quantity: 10, unitPrice: 100 },
        ],
      },
      adminUser,
    );

    expect(order.lines).toHaveLength(1);
    expect(Number(order.lines[0].taxRate)).toBe(5.0);
    // 10 * 100 = 1000 taxable; intra-state 5% -> CGST 25, SGST 25 -> Total Tax 50
    expect(Number(order.taxableAmount)).toBe(1000.0);
    expect(Number(order.totalTaxAmount)).toBe(50.0);
    expect(Number(order.totalAmount)).toBe(1050.0);
  });

  it("2. Fails safely with TAX_CONFIGURATION_ERROR when product HSN has no active statutory rate", async () => {
    const unconfiguredHsn = `9999${runId}`;
    const unconfiguredProduct = await prisma.product.create({
      data: {
        organizationId: orgId,
        code: `PRD-UNCONF-${runId}`,
        name: "Unconfigured Tax Product",
        hsnCode: unconfiguredHsn,
        taxRate: 18.0,
      },
    });

    const unconfVariant = await prisma.productVariant.create({
      data: {
        productId: unconfiguredProduct.id,
        sku: `SKU-UNCONF-${runId}`,
        name: "Unconfigured Variant",
        packSize: 1,
        uomId: (
          await prisma.unitOfMeasure.findFirstOrThrow({
            where: { organizationId: orgId, code: "PACKET" },
          })
        ).id,
      },
    });

    await expect(
      salesService.createSalesOrder(
        {
          organizationId: orgId,
          customerId,
          warehouseId,
          orderNumber: `SO-TAX-FAIL-${runId}`,
          lines: [
            { productVariantId: unconfVariant.id, quantity: 1, unitPrice: 100 },
          ],
        },
        adminUser,
      ),
    ).rejects.toThrow(/TAX_CONFIGURATION_ERROR/);
  });

  it("3. Resolves scheduled future rate based on effective date and preserves historical invoice snapshot", async () => {
    // 1. Create and approve order 1 today (effective rate: 5%)
    const { order: order1 } = await salesService.createSalesOrder(
      {
        organizationId: orgId,
        customerId,
        warehouseId,
        orderNumber: `SO-TAX-HIST-${runId}`,
        notes: runId,
        lines: [
          { productVariantId: testVariantId, quantity: 10, unitPrice: 100 },
        ],
      },
      adminUser,
    );

    await salesService.approveSalesOrder(order1.id, {}, adminUser);

    // Post invoice 1 today (uses current 5% rate)
    const invoice1 = await financeService.createInvoiceFromOrder({
      salesOrderId: order1.id,
      invoiceDate: new Date("2026-03-01T10:00:00Z"),
      notes: runId,
    });
    expect(invoice1).toBeDefined();

    expect(Number(invoice1!.lines[0].taxRate)).toBe(5.0);
    expect(Number(invoice1!.taxableAmount)).toBe(1000.0);
    expect(Number(invoice1!.totalTaxAmount)).toBe(50.0);
    expect(Number(invoice1!.totalAmount)).toBe(1050.0);

    // 2. GST Council notifies statutory rate hike from 5% to 12% effective April 1, 2026
    await financeService.setTaxRate(orgId, {
      hsnCode: testHsn,
      rate: 12.0,
      effectiveFrom: new Date("2026-04-01T00:00:00Z"),
    });

    // Verify prior schedule was auto-closed at 2026-04-01
    const schedules = await financeService.getTaxRates(orgId, testHsn);
    expect(schedules).toHaveLength(2);
    const oldSchedule = schedules.find((s) => Number(s.rate) === 5.0);
    expect(oldSchedule?.effectiveTo?.toISOString()).toBe(
      new Date("2026-04-01T00:00:00Z").toISOString(),
    );

    // 3. Create and approve order 2 for execution in April 2026
    const { order: order2 } = await salesService.createSalesOrder(
      {
        organizationId: orgId,
        customerId,
        warehouseId,
        orderNumber: `SO-TAX-FUTURE-${runId}`,
        orderDate: new Date("2026-04-05T10:00:00Z"),
        notes: runId,
        lines: [
          { productVariantId: testVariantId, quantity: 10, unitPrice: 100 },
        ],
      },
      adminUser,
    );

    expect(Number(order2.lines[0].taxRate)).toBe(12.0);
    expect(Number(order2.totalTaxAmount)).toBe(120.0);
    expect(Number(order2.totalAmount)).toBe(1120.0);

    await salesService.approveSalesOrder(order2.id, {}, adminUser);

    // Post invoice 2 with April date (uses new 12% rate)
    const invoice2 = await financeService.createInvoiceFromOrder({
      salesOrderId: order2.id,
      invoiceDate: new Date("2026-04-05T10:00:00Z"),
      notes: runId,
    });
    expect(invoice2).toBeDefined();

    expect(Number(invoice2!.lines[0].taxRate)).toBe(12.0);
    expect(Number(invoice2!.taxableAmount)).toBe(1000.0);
    expect(Number(invoice2!.totalTaxAmount)).toBe(120.0);
    expect(Number(invoice2!.totalAmount)).toBe(1120.0);

    // 4. Verify historical invoice 1 was NOT mutated
    const fetchedInvoice1 = await financeService.getInvoiceById(invoice1!.id);
    expect(fetchedInvoice1).toBeDefined();
    expect(Number(fetchedInvoice1!.lines[0].taxRate)).toBe(5.0);
    expect(Number(fetchedInvoice1!.totalTaxAmount)).toBe(50.0);
    expect(Number(fetchedInvoice1!.totalAmount)).toBe(1050.0);
  });

  it("4. Rejects overlapping tax rate schedules with TAX_CONFIGURATION_ERROR", async () => {
    // Attempt to insert an overlapping schedule covering March 2026 to May 2026 while an active schedule exists
    await expect(
      financeService.setTaxRate(orgId, {
        hsnCode: testHsn,
        rate: 18.0,
        effectiveFrom: new Date("2026-03-15T00:00:00Z"),
        effectiveTo: new Date("2026-05-15T00:00:00Z"),
      }),
    ).rejects.toThrow(
      /TAX_CONFIGURATION_ERROR: Overlapping tax rate schedule detected/,
    );
  });
});
