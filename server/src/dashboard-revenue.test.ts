import { describe, expect, it, beforeAll } from "vitest";
import { prisma } from "./db/client.js";
import { resetOperationalData } from "./db/reset.js";
import { seedBenchmarkMasters } from "./db/seed.js";
import { reportingService } from "./modules/reporting/reporting.service.js";
import { financeService } from "./modules/finance/finance.service.js";
import { InvoiceStatus } from "@prisma/client";

describe("F-036 Regression Test: Dashboard Sales Revenue Line-less Invoice Reconciliation", () => {
  let orgId: string;
  let customerId: string;
  let runId = Date.now();

  beforeAll(async () => {
    await resetOperationalData();
    await seedBenchmarkMasters();

    const org = await prisma.organization.findUniqueOrThrow({ where: { code: "MILL" } });
    orgId = org.id;

    const cust = await prisma.customer.findFirstOrThrow({ where: { code: "CUST-RET-A" } });
    customerId = cust.id;
  });

  it("reconciles dashboard total revenue exactly with SQL SUM(totalAmount) even when invoices lack line items", async () => {
    // 1. Create a normal invoice with lines: ₹7,875
    const warehouse = await prisma.warehouse.findFirstOrThrow({ where: { code: "WH-1" } });
    const salesman = await prisma.user.findFirstOrThrow({ where: { email: "salesman1@millledger.local" } });
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { sku: "VAR-MURUKKU-200G" } });

    const normalOrder = await prisma.salesOrder.create({
      data: {
        organizationId: orgId,
        customerId,
        salesmanId: salesman.id,
        warehouseId: warehouse.id,
        orderNumber: `SO-F036-NORMAL-${runId}`,
        status: "APPROVED",
        deliveryState: "Tamil Nadu",
        taxableAmount: 7500.0,
        cgstAmount: 187.5,
        sgstAmount: 187.5,
        igstAmount: 0.0,
        totalTaxAmount: 375.0,
        totalAmount: 7875.0,
        lines: {
          create: {
            productVariantId: variant.id,
            quotedQuantity: 150,
            approvedQuantity: 150,
            quotedUnitPrice: 50.0,
            approvedUnitPrice: 50.0,
            taxRate: 5.0,
            taxableAmount: 7500.0,
            taxAmount: 375.0,
            lineTotal: 7875.0,
          },
        },
      },
    });

    const normalInvoice = await financeService.createInvoiceFromOrder({
      salesOrderId: normalOrder.id,
      notes: "Normal Invoice with Lines",
    });
    expect(normalInvoice).toBeDefined();

    // 2. Insert a line-less invoice directly into PostgreSQL (simulating legacy data or direct ledger invoice): ₹12,000
    const dummyOrder = await prisma.salesOrder.create({
      data: {
        organizationId: orgId,
        customerId,
        salesmanId: salesman.id,
        warehouseId: warehouse.id,
        orderNumber: `SO-F036-LEGACY-${runId}`,
        status: "APPROVED",
        deliveryState: "Tamil Nadu",
        taxableAmount: 11428.57,
        cgstAmount: 285.71,
        sgstAmount: 285.71,
        igstAmount: 0.0,
        totalTaxAmount: 571.43,
        totalAmount: 12000.0,
      },
    });

    const linelessInvoice = await prisma.salesInvoice.create({
      data: {
        organizationId: orgId,
        invoiceNumber: `INV-2026-27-LINELESS-${runId}`,
        financialYear: "2026-27",
        salesOrderId: dummyOrder.id,
        customerId,
        customerNameSnapshot: "Legacy Retailer",
        deliveryStateSnapshot: "Tamil Nadu",
        companyGstinSnapshot: "33AAAAA0000A1Z5",
        status: InvoiceStatus.POSTED,
        taxableAmount: 11428.57,
        cgstAmount: 285.71,
        sgstAmount: 285.71,
        igstAmount: 0.0,
        totalTaxAmount: 571.43,
        totalAmount: 12000.0,
        paidAmount: 0.0,
        outstandingAmount: 12000.0,
        postedAt: new Date(),
      },
    });
    expect(linelessInvoice).toBeDefined();

    // 3. Query Direct SQL Sum
    const sqlRes: any[] = await prisma.$queryRaw`
      SELECT 
        COUNT(*)::int as count,
        COALESCE(SUM("totalAmount"), 0)::numeric as total_revenue
      FROM "sales_invoice"
      WHERE "organizationId" = ${orgId}
        AND "status" != 'CANCELLED_BY_CREDIT_NOTE';
    `;
    const sqlTotalRevenue = Number(sqlRes[0].total_revenue);
    expect(sqlTotalRevenue).toBe(19875.0); // 7875 + 12000

    // 4. Query reportingService sales report
    const salesReport = await reportingService.getSalesReport({ organizationId: orgId });
    expect(salesReport.summary.grandTotal).toBe(sqlTotalRevenue);

    // 5. Query dashboard metrics
    const dashboard = await reportingService.getOwnerDashboard({ organizationId: orgId });
    expect(dashboard.metrics.totalRevenue).toBe(sqlTotalRevenue);
    expect(dashboard.metrics.totalInvoicesCount).toBe(Number(sqlRes[0].count));

    // 6. Verify line-less invoice is present in rows
    const linelessRow = salesReport.rows.find((r) => r.invoiceId === linelessInvoice.id);
    expect(linelessRow).toBeDefined();
    expect(Number(linelessRow?.lineTotal)).toBe(12000.0);
  });

  it("prevents posting new sales invoices from orders with zero line items", async () => {
    const warehouse = await prisma.warehouse.findFirstOrThrow({ where: { code: "WH-1" } });
    const salesman = await prisma.user.findFirstOrThrow({ where: { email: "salesman1@millledger.local" } });

    const emptyOrder = await prisma.salesOrder.create({
      data: {
        organizationId: orgId,
        customerId,
        salesmanId: salesman.id,
        warehouseId: warehouse.id,
        orderNumber: `SO-F036-EMPTY-${runId}`,
        status: "APPROVED",
        deliveryState: "Tamil Nadu",
        taxableAmount: 0.0,
        cgstAmount: 0.0,
        sgstAmount: 0.0,
        igstAmount: 0.0,
        totalTaxAmount: 0.0,
        totalAmount: 0.0,
      },
    });

    await expect(
      financeService.createInvoiceFromOrder({ salesOrderId: emptyOrder.id }),
    ).rejects.toThrow("zero line items");
  });
});
