import { describe, expect, it, beforeAll } from "vitest";
import { prisma } from "../db/client.js";
import { resetOperationalData } from "../db/reset.js";
import { seedBenchmarkMasters } from "../db/seed.js";
import { financeService } from "../modules/finance/finance.service.js";
import {
  calculateLineTax,
  calculateOrderOrInvoiceTax,
} from "../modules/finance/tax.util.js";

describe("F-010 Regression Test: Statutory GST Decimal Rounding (Section 170 CGST Act)", () => {
  let orgId: string;
  let customerTnId: string;
  let customerKaId: string;
  let uomId: string;
  const runId = Date.now();

  beforeAll(async () => {
    await resetOperationalData();
    await seedBenchmarkMasters();

    const org = await prisma.organization.findUniqueOrThrow({
      where: { code: "MILL" },
    });
    orgId = org.id;

    const uom = await prisma.unitOfMeasure.findFirstOrThrow({
      where: { organizationId: org.id, code: "PACKET" },
    });
    uomId = uom.id;

    const custTn = await prisma.customer.findFirstOrThrow({
      where: { code: "CUST-RET-A" },
    });
    customerTnId = custTn.id;

    // Create an inter-state customer in Karnataka if not already present
    let custKa = await prisma.customer.findFirst({
      where: { gstin: "29AAAAA0000A1Z5" },
    });
    if (!custKa) {
      custKa = await prisma.customer.create({
        data: {
          organizationId: org.id,
          code: `CUST-KA-${runId}`,
          name: "Bengaluru Retailers",
          gstin: "29AAAAA0000A1Z5",
          state: "Karnataka",
          phone: "9876543210",
        },
      });
    }
    customerKaId = custKa.id;
  });

  it("calculates exact statutory paise rounding on single-line intra-state invoice (Case 2: 14 pkts @ ₹54.21 @ 18% GST)", async () => {
    // 14 * 54.21 = 758.94
    // CGST @ 9% = 68.3046 -> 68.30
    // SGST @ 9% = 68.3046 -> 68.30
    // Total tax = 136.60
    // Total amount = 895.54

    const product = await prisma.product.create({
      data: {
        organizationId: orgId,
        code: `PROD-TAX18-${runId}`,
        name: "Test 18% Snack",
        hsnCode: "21069098",
        taxRate: 18.0,
      },
    });

    const testVariant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: `VAR-TAX18-PKT-${runId}`,
        name: "Test 18% Packet",
        packSize: 1,
        uomId,
      },
    });

    const warehouse = await prisma.warehouse.findFirstOrThrow({
      where: { code: "WH-1" },
    });
    const salesman = await prisma.user.findFirstOrThrow({
      where: { email: "salesman1@millledger.local" },
    });

    // Create approved sales order directly
    const order = await prisma.salesOrder.create({
      data: {
        organizationId: orgId,
        customerId: customerTnId,
        salesmanId: salesman.id,
        warehouseId: warehouse.id,
        orderNumber: `SO-TEST-ROUNDING-1-${runId}`,
        status: "APPROVED",
        deliveryState: "Tamil Nadu",
        taxableAmount: 758.94,
        cgstAmount: 68.3,
        sgstAmount: 68.3,
        igstAmount: 0.0,
        totalTaxAmount: 136.6,
        totalAmount: 895.54,
        lines: {
          create: {
            productVariantId: testVariant.id,
            quotedQuantity: 14,
            approvedQuantity: 14,
            quotedUnitPrice: 54.21,
            approvedUnitPrice: 54.21,
            taxRate: 18.0,
            taxableAmount: 758.94,
            taxAmount: 136.6,
            lineTotal: 895.54,
          },
        },
      },
    });

    const invoice = await financeService.createInvoiceFromOrder({
      salesOrderId: order.id,
      notes: "Rounding Test Case 2",
    });

    expect(invoice).toBeDefined();
    if (!invoice) throw new Error("Invoice was not created");

    expect(Number(invoice.taxableAmount)).toBe(758.94);
    expect(Number(invoice.cgstAmount)).toBe(68.3);
    expect(Number(invoice.sgstAmount)).toBe(68.3);
    expect(Number(invoice.igstAmount)).toBe(0);
    expect(Number(invoice.totalTaxAmount)).toBe(136.6);
    expect(Number(invoice.totalAmount)).toBe(895.54);

    const line = invoice.lines[0];
    expect(Number(line.taxableAmount)).toBe(758.94);
    expect(Number(line.cgstAmount)).toBe(68.3);
    expect(Number(line.sgstAmount)).toBe(68.3);
    expect(Number(line.taxAmount)).toBe(136.6);
    expect(Number(line.lineTotal)).toBe(895.54);
  });

  it("calculates exact statutory paise rounding on multi-line intra-state invoice (Case 4: 4 lines with 5%, 18%, 12% GST)", async () => {
    // Line 1: 29 @ 121.96 @ 5% -> Taxable 3536.84, CGST 88.42, SGST 88.42, Tax 176.84, Total 3713.68
    // Line 2: 49 @ 163.11 @ 18% -> Taxable 7992.39, CGST 719.32, SGST 719.32, Tax 1438.64, Total 9431.03
    // Line 3: 28 @ 74.65 @ 5% -> Taxable 2090.20, CGST 52.26, SGST 52.26, Tax 104.52, Total 2194.72
    // Line 4: 14 @ 191.87 @ 12% -> Taxable 2686.18, CGST 161.17, SGST 161.17, Tax 322.34, Total 3008.52
    // Header Totals:
    // Taxable: 16305.61, CGST: 1021.17, SGST: 1021.17, Total Tax: 2042.34, Grand Total: 18347.95

    const p5 = await prisma.product.create({
      data: {
        organizationId: orgId,
        code: `PROD-5-${runId}`,
        name: "P5",
        taxRate: 5.0,
        hsnCode: "21069099",
      },
    });
    const v5 = await prisma.productVariant.create({
      data: {
        productId: p5.id,
        sku: `VAR-P5-${runId}`,
        name: "V5",
        packSize: 1,
        uomId,
      },
    });

    const p18 = await prisma.product.create({
      data: {
        organizationId: orgId,
        code: `PROD-18-${runId}`,
        name: "P18",
        taxRate: 18.0,
        hsnCode: "21069098",
      },
    });
    const v18 = await prisma.productVariant.create({
      data: {
        productId: p18.id,
        sku: `VAR-P18-${runId}`,
        name: "V18",
        packSize: 1,
        uomId,
      },
    });

    const p12 = await prisma.product.create({
      data: {
        organizationId: orgId,
        code: `PROD-12-${runId}`,
        name: "P12",
        taxRate: 12.0,
        hsnCode: "21069097",
      },
    });
    const v12 = await prisma.productVariant.create({
      data: {
        productId: p12.id,
        sku: `VAR-P12-${runId}`,
        name: "V12",
        packSize: 1,
        uomId,
      },
    });

    const warehouse = await prisma.warehouse.findFirstOrThrow({
      where: { code: "WH-1" },
    });
    const salesman = await prisma.user.findFirstOrThrow({
      where: { email: "salesman1@millledger.local" },
    });

    const order = await prisma.salesOrder.create({
      data: {
        organizationId: orgId,
        customerId: customerTnId,
        salesmanId: salesman.id,
        warehouseId: warehouse.id,
        orderNumber: `SO-TEST-ROUNDING-4LINES-${runId}`,
        status: "APPROVED",
        deliveryState: "Tamil Nadu",
        taxableAmount: 16305.61,
        cgstAmount: 1021.17,
        sgstAmount: 1021.17,
        igstAmount: 0.0,
        totalTaxAmount: 2042.34,
        totalAmount: 18347.95,
        lines: {
          create: [
            {
              productVariantId: v5.id,
              quotedQuantity: 29,
              approvedQuantity: 29,
              quotedUnitPrice: 121.96,
              approvedUnitPrice: 121.96,
              taxRate: 5.0,
              taxableAmount: 3536.84,
              taxAmount: 176.84,
              lineTotal: 3713.68,
            },
            {
              productVariantId: v18.id,
              quotedQuantity: 49,
              approvedQuantity: 49,
              quotedUnitPrice: 163.11,
              approvedUnitPrice: 163.11,
              taxRate: 18.0,
              taxableAmount: 7992.39,
              taxAmount: 1438.64,
              lineTotal: 9431.03,
            },
            {
              productVariantId: v5.id,
              quotedQuantity: 28,
              approvedQuantity: 28,
              quotedUnitPrice: 74.65,
              approvedUnitPrice: 74.65,
              taxRate: 5.0,
              taxableAmount: 2090.2,
              taxAmount: 104.52,
              lineTotal: 2194.72,
            },
            {
              productVariantId: v12.id,
              quotedQuantity: 14,
              approvedQuantity: 14,
              quotedUnitPrice: 191.87,
              approvedUnitPrice: 191.87,
              taxRate: 12.0,
              taxableAmount: 2686.18,
              taxAmount: 322.34,
              lineTotal: 3008.52,
            },
          ],
        },
      },
    });

    const invoice = await financeService.createInvoiceFromOrder({
      salesOrderId: order.id,
      notes: "Rounding Multi-line Test Case 4",
    });

    expect(invoice).toBeDefined();
    if (!invoice) throw new Error("Invoice was not created");

    expect(Number(invoice.taxableAmount)).toBe(16305.61);
    expect(Number(invoice.cgstAmount)).toBe(1021.17);
    expect(Number(invoice.sgstAmount)).toBe(1021.17);
    expect(Number(invoice.igstAmount)).toBe(0);
    expect(Number(invoice.totalTaxAmount)).toBe(2042.34);
    expect(Number(invoice.totalAmount)).toBe(18347.95);

    // Verify all header sums exactly equal line sums
    const linesCgstSum = Number(
      invoice.lines.reduce((s, l) => s + Number(l.cgstAmount), 0).toFixed(2),
    );
    const linesSgstSum = Number(
      invoice.lines.reduce((s, l) => s + Number(l.sgstAmount), 0).toFixed(2),
    );
    const linesTaxSum = Number(
      invoice.lines.reduce((s, l) => s + Number(l.taxAmount), 0).toFixed(2),
    );
    const linesTotalSum = Number(
      invoice.lines.reduce((s, l) => s + Number(l.lineTotal), 0).toFixed(2),
    );

    expect(linesCgstSum).toBe(1021.17);
    expect(linesSgstSum).toBe(1021.17);
    expect(linesTaxSum).toBe(2042.34);
    expect(linesTotalSum).toBe(18347.95);
  });

  it("calculates exact statutory paise rounding on inter-state invoice (Case 6: TN to KA IGST)", async () => {
    // 5 lines TN -> KA
    // Line 1: 3 @ 148.65 @ 18% -> Taxable 445.95, IGST 80.27, Total 526.22
    // Line 2: 8 @ 194.89 @ 12% -> Taxable 1559.12, IGST 187.09, Total 1746.21
    // Line 3: 6 @ 114.89 @ 18% -> Taxable 689.34, IGST 124.08, Total 813.42
    // Line 4: 40 @ 178.24 @ 12% -> Taxable 7129.60, IGST 855.55, Total 7985.15
    // Line 5: 37 @ 46.53 @ 5% -> Taxable 1721.61, IGST 86.08, Total 1807.69
    // Header Totals:
    // Taxable: 11545.62, IGST: 1333.07, Total Tax: 1333.07, Grand Total: 12878.69

    const p5 = await prisma.product.create({
      data: {
        organizationId: orgId,
        code: `PROD-KA-5-${runId}`,
        name: "P5",
        taxRate: 5.0,
        hsnCode: "21069099",
      },
    });
    const v5 = await prisma.productVariant.create({
      data: {
        productId: p5.id,
        sku: `VAR-KA-5-${runId}`,
        name: "V5",
        packSize: 1,
        uomId,
      },
    });

    const p18 = await prisma.product.create({
      data: {
        organizationId: orgId,
        code: `PROD-KA-18-${runId}`,
        name: "P18",
        taxRate: 18.0,
        hsnCode: "21069098",
      },
    });
    const v18 = await prisma.productVariant.create({
      data: {
        productId: p18.id,
        sku: `VAR-KA-18-${runId}`,
        name: "V18",
        packSize: 1,
        uomId,
      },
    });

    const p12 = await prisma.product.create({
      data: {
        organizationId: orgId,
        code: `PROD-KA-12-${runId}`,
        name: "P12",
        taxRate: 12.0,
        hsnCode: "21069097",
      },
    });
    const v12 = await prisma.productVariant.create({
      data: {
        productId: p12.id,
        sku: `VAR-KA-12-${runId}`,
        name: "V12",
        packSize: 1,
        uomId,
      },
    });

    const warehouse = await prisma.warehouse.findFirstOrThrow({
      where: { code: "WH-1" },
    });
    const salesman = await prisma.user.findFirstOrThrow({
      where: { email: "salesman1@millledger.local" },
    });

    const order = await prisma.salesOrder.create({
      data: {
        organizationId: orgId,
        customerId: customerKaId,
        salesmanId: salesman.id,
        warehouseId: warehouse.id,
        orderNumber: `SO-TEST-ROUNDING-INTERSTATE-${runId}`,
        status: "APPROVED",
        deliveryState: "Karnataka",
        taxableAmount: 11545.62,
        cgstAmount: 0.0,
        sgstAmount: 0.0,
        igstAmount: 1333.07,
        totalTaxAmount: 1333.07,
        totalAmount: 12878.69,
        lines: {
          create: [
            {
              productVariantId: v18.id,
              quotedQuantity: 3,
              approvedQuantity: 3,
              quotedUnitPrice: 148.65,
              approvedUnitPrice: 148.65,
              taxRate: 18.0,
              taxableAmount: 445.95,
              taxAmount: 80.27,
              lineTotal: 526.22,
            },
            {
              productVariantId: v12.id,
              quotedQuantity: 8,
              approvedQuantity: 8,
              quotedUnitPrice: 194.89,
              approvedUnitPrice: 194.89,
              taxRate: 12.0,
              taxableAmount: 1559.12,
              taxAmount: 187.09,
              lineTotal: 1746.21,
            },
            {
              productVariantId: v18.id,
              quotedQuantity: 6,
              approvedQuantity: 6,
              quotedUnitPrice: 114.89,
              approvedUnitPrice: 114.89,
              taxRate: 18.0,
              taxableAmount: 689.34,
              taxAmount: 124.08,
              lineTotal: 813.42,
            },
            {
              productVariantId: v12.id,
              quotedQuantity: 40,
              approvedQuantity: 40,
              quotedUnitPrice: 178.24,
              approvedUnitPrice: 178.24,
              taxRate: 12.0,
              taxableAmount: 7129.6,
              taxAmount: 855.55,
              lineTotal: 7985.15,
            },
            {
              productVariantId: v5.id,
              quotedQuantity: 37,
              approvedQuantity: 37,
              quotedUnitPrice: 46.53,
              approvedUnitPrice: 46.53,
              taxRate: 5.0,
              taxableAmount: 1721.61,
              taxAmount: 86.08,
              lineTotal: 1807.69,
            },
          ],
        },
      },
    });

    const invoice = await financeService.createInvoiceFromOrder({
      salesOrderId: order.id,
      notes: "Rounding Inter-state Test Case 6",
    });

    expect(invoice).toBeDefined();
    if (!invoice) throw new Error("Invoice was not created");

    expect(Number(invoice.taxableAmount)).toBe(11545.62);
    expect(Number(invoice.cgstAmount)).toBe(0);
    expect(Number(invoice.sgstAmount)).toBe(0);
    expect(Number(invoice.igstAmount)).toBe(1333.07);
    expect(Number(invoice.totalTaxAmount)).toBe(1333.07);
    expect(Number(invoice.totalAmount)).toBe(12878.69);
  });

  it("matches statutory Decimal half-up reference across randomized configurations", () => {
    // Test Case 7 from verify_rounding_1000.py: 50 @ 64.98 @ 5% intra-state
    // Taxable = 3249.00
    // CGST = 81.225 -> 81.23
    // SGST = 81.225 -> 81.23
    // Tax = 162.46
    // Total = 3411.46
    const line7 = calculateLineTax(
      { quantity: 50, unitPrice: 64.98, taxRate: 5 },
      true,
    );
    expect(line7.taxableAmount.toFixed(2)).toBe("3249.00");
    expect(line7.cgstAmount.toFixed(2)).toBe("81.23");
    expect(line7.sgstAmount.toFixed(2)).toBe("81.23");
    expect(line7.taxAmount.toFixed(2)).toBe("162.46");
    expect(line7.lineTotal.toFixed(2)).toBe("3411.46");

    // Test Case 3: 46 @ 133.48 @ 18% intra-state
    // Taxable = 6140.08
    // CGST = 552.6072 -> 552.61
    // SGST = 552.6072 -> 552.61
    // Tax = 1105.22
    // Total = 7245.30
    const line3 = calculateLineTax(
      { quantity: 46, unitPrice: 133.48, taxRate: 18 },
      true,
    );
    expect(line3.taxableAmount.toFixed(2)).toBe("6140.08");
    expect(line3.cgstAmount.toFixed(2)).toBe("552.61");
    expect(line3.sgstAmount.toFixed(2)).toBe("552.61");
    expect(line3.taxAmount.toFixed(2)).toBe("1105.22");
    expect(line3.lineTotal.toFixed(2)).toBe("7245.30");

    // Aggregate totals via calculateOrderOrInvoiceTax
    const totals = calculateOrderOrInvoiceTax(
      [
        { quantity: 50, unitPrice: 64.98, taxRate: 5 },
        { quantity: 46, unitPrice: 133.48, taxRate: 18 },
      ],
      true,
    );
    expect(totals.taxableAmount.toFixed(2)).toBe("9389.08");
    expect(totals.cgstAmount.toFixed(2)).toBe("633.84");
    expect(totals.sgstAmount.toFixed(2)).toBe("633.84");
    expect(totals.totalTaxAmount.toFixed(2)).toBe("1267.68");
    expect(totals.totalAmount.toFixed(2)).toBe("10656.76");
  });
});
