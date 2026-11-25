import { prisma } from "../../db/client.js";
import {
  InvoiceStatus,
  PaymentStatus,
  PaymentMode,
  type Prisma,
} from "@prisma/client";
import type { UserContext } from "@mill-ledger/shared";
import { AppError } from "../../middleware/error.middleware.js";
import { auditService } from "./audit.service.js";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

export interface ReportFilterParams {
  organizationId?: string;
  startDate?: Date;
  endDate?: Date;
  customerId?: string;
  salesmanId?: string;
  supplierId?: string;
  recipeId?: string;
  warehouseId?: string;
  paymentMode?: string;
}

export interface SalesReportRow {
  invoiceId: string;
  invoiceNumber: string;
  financialYear: string;
  invoiceDate: Date | null;
  customerCode: string;
  customerName: string;
  customerGstin: string;
  deliveryState: string;
  salesmanName: string;
  orderNumber: string;
  productSku: string;
  productName: string;
  hsnCode: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  taxAmount: number;
  lineTotal: number;
  paymentStatus?: PaymentStatus;
  status?: InvoiceStatus;
}

export interface GSTSupplyRecord {
  invoiceNumber: string;
  invoiceDate: Date | null;
  customerName: string;
  customerGstin: string | null;
  placeOfSupply: string;
  supplyType: string;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTaxAmount: number;
  invoiceTotal: number;
}

export interface GSTCreditNoteRecord {
  creditNoteNumber: string;
  creditNoteDate?: Date | null;
  date?: Date | null;
  originalInvoiceNumber: string;
  customerName: string;
  customerGstin?: string | null;
  reason: string;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
}

export interface PurchaseReportRow {
  receiptNumber: string;
  receivedAt: Date | null;
  supplierInvoiceNumber: string | null;
  supplierCode: string;
  supplierName: string;
  warehouseCode: string;
  itemSku: string;
  itemName: string;
  unitOfMeasure: string;
  receivedQuantity: number;
  unitCost: number;
  totalCost: number;
  status: string;
}

export interface ReportExportData {
  reportTitle?: string;
  companyGstin?: string;
  generatedAt?: string | Date;
  filters?: ReportFilterParams;
  summary?: Record<string, unknown>;
  rows?: unknown[];
  b2bSupplies?: unknown[];
  b2cSupplies?: unknown[];
  creditNotes?: unknown[];
  rateWiseBreakdown?: unknown[];
  hsnSummary?: unknown[];
  [key: string]: unknown;
}

export class ReportingService {
  private async resolveOrgId(orgIdOrCode?: string): Promise<string> {
    if (!orgIdOrCode) return "MILL";
    const org = await prisma.organization.findFirst({
      where: {
        OR: [{ id: orgIdOrCode }, { code: orgIdOrCode }],
      },
    });
    return org ? org.id : orgIdOrCode;
  }

  /**
   * 1. Sales Register Report
   */
  async getSalesReport(params: ReportFilterParams) {
    const orgId = await this.resolveOrgId(params.organizationId);

    const where: Prisma.SalesInvoiceWhereInput = {
      organizationId: orgId,
      status: { not: InvoiceStatus.DRAFT },
    };

    if (params.startDate || params.endDate) {
      where.postedAt = {};
      if (params.startDate) where.postedAt.gte = params.startDate;
      if (params.endDate) where.postedAt.lte = params.endDate;
    }

    if (params.customerId) {
      where.customerId = params.customerId;
    }

    if (params.salesmanId) {
      where.salesOrder = {
        salesmanId: params.salesmanId,
      };
    }

    const invoices = await prisma.salesInvoice.findMany({
      where,
      include: {
        customer: true,
        salesOrder: {
          include: { salesman: true },
        },
        lines: true,
      },
      orderBy: { postedAt: "desc" },
    });

    const rows: SalesReportRow[] = [];
    let totalTaxable = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;
    let totalTax = 0;
    let grandTotal = 0;
    let totalQuantity = 0;

    for (const inv of invoices) {
      if (!inv.lines || inv.lines.length === 0) {
        const taxable = Number(inv.taxableAmount);
        const cgst = Number(inv.cgstAmount);
        const sgst = Number(inv.sgstAmount);
        const igst = Number(inv.igstAmount);
        const lineTax = Number(inv.totalTaxAmount);
        const total = Number(inv.totalAmount);

        totalTaxable = Number((totalTaxable + taxable).toFixed(2));
        totalCGST = Number((totalCGST + cgst).toFixed(2));
        totalSGST = Number((totalSGST + sgst).toFixed(2));
        totalIGST = Number((totalIGST + igst).toFixed(2));
        totalTax = Number((totalTax + lineTax).toFixed(2));
        grandTotal = Number((grandTotal + total).toFixed(2));

        rows.push({
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          financialYear: inv.financialYear,
          invoiceDate: inv.postedAt,
          customerCode: inv.customer?.code || "N/A",
          customerName: inv.customerNameSnapshot,
          customerGstin: inv.customerGstinSnapshot || "Unregistered",
          deliveryState: inv.deliveryStateSnapshot,
          salesmanName: inv.salesOrder?.salesman?.name || "Direct",
          orderNumber: inv.salesOrder?.orderNumber || "Direct",
          productSku: "N/A",
          productName: "Direct / Line-less Invoice",
          hsnCode: "N/A",
          quantity: 0,
          unitPrice: taxable,
          taxRate: 0,
          taxableAmount: taxable,
          cgstAmount: cgst,
          sgstAmount: sgst,
          igstAmount: igst,
          taxAmount: lineTax,
          lineTotal: total,
          status: inv.status,
        });
      } else {
        for (const line of inv.lines) {
          const taxable = Number(line.taxableAmount);
          const cgst = Number(line.cgstAmount);
          const sgst = Number(line.sgstAmount);
          const igst = Number(line.igstAmount);
          const lineTax = Number(line.taxAmount);
          const total = Number(line.lineTotal);
          const qty = Number(line.quantity);

          totalTaxable = Number((totalTaxable + taxable).toFixed(2));
          totalCGST = Number((totalCGST + cgst).toFixed(2));
          totalSGST = Number((totalSGST + sgst).toFixed(2));
          totalIGST = Number((totalIGST + igst).toFixed(2));
          totalTax = Number((totalTax + lineTax).toFixed(2));
          grandTotal = Number((grandTotal + total).toFixed(2));
          totalQuantity += qty;

          rows.push({
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber,
            financialYear: inv.financialYear,
            invoiceDate: inv.postedAt,
            customerCode: inv.customer?.code || "N/A",
            customerName: inv.customerNameSnapshot,
            customerGstin: inv.customerGstinSnapshot || "Unregistered",
            deliveryState: inv.deliveryStateSnapshot,
            salesmanName: inv.salesOrder?.salesman?.name || "Direct",
            orderNumber: inv.salesOrder?.orderNumber || "Direct",
            productSku: line.productVariantId || "VAR-MURUKKU-200G",
            productName: line.productNameSnapshot,
            hsnCode: line.hsnCodeSnapshot,
            quantity: qty,
            unitPrice: Number(line.unitPrice),
            taxRate: Number(line.taxRate),
            taxableAmount: taxable,
            cgstAmount: cgst,
            sgstAmount: sgst,
            igstAmount: igst,
            taxAmount: lineTax,
            lineTotal: total,
            status: inv.status,
          });
        }
      }
    }

    return {
      reportTitle: "Sales Register",
      generatedAt: new Date(),
      filters: params,
      summary: {
        totalInvoicesCount: invoices.length,
        totalQuantity,
        totalTaxable,
        totalCGST,
        totalSGST,
        totalIGST,
        totalTax,
        grandTotal,
      },
      rows,
    };
  }

  /**
   * 2. GST Outward Supply Summary (GSTR 1 reconciliation shape)
   */
  async getGSTOutwardSummary(params: ReportFilterParams) {
    const orgId = await this.resolveOrgId(params.organizationId);

    const where: Prisma.SalesInvoiceWhereInput = {
      organizationId: orgId,
      status: { not: InvoiceStatus.DRAFT },
    };

    if (params.startDate || params.endDate) {
      where.postedAt = {};
      if (params.startDate) where.postedAt.gte = params.startDate;
      if (params.endDate) where.postedAt.lte = params.endDate;
    }

    const invoices = await prisma.salesInvoice.findMany({
      where,
      include: {
        customer: true,
        lines: true,
        creditNotes: true,
      },
      orderBy: { postedAt: "asc" },
    });

    // 1. Table 4: B2B Taxable Supplies (Registered customers with GSTIN)
    const b2bSupplies: GSTSupplyRecord[] = [];
    // 2. Table 5 & 7: B2C Supplies (Unregistered customers)
    const b2cSupplies: GSTSupplyRecord[] = [];
    // 3. Table 9: Credit Notes
    const creditNotes: GSTCreditNoteRecord[] = [];

    // Rate wise aggregation
    const rateWiseMap: Record<
      number,
      {
        taxable: number;
        cgst: number;
        sgst: number;
        igst: number;
        totalTax: number;
      }
    > = {};

    // HSN aggregation
    const hsnMap: Record<
      string,
      {
        hsnCode: string;
        description: string;
        quantity: number;
        taxable: number;
        cgst: number;
        sgst: number;
        igst: number;
      }
    > = {};

    let totalB2BTaxable = 0;
    let totalB2BTax = 0;
    let totalB2CTaxable = 0;
    let totalB2CTax = 0;
    let totalCreditNotesAmount = 0;

    for (const inv of invoices) {
      const isB2B =
        !!inv.customerGstinSnapshot &&
        inv.customerGstinSnapshot.trim().length > 0;
      const taxable = Number(inv.taxableAmount);
      const tax = Number(inv.totalTaxAmount);
      const total = Number(inv.totalAmount);

      const supplyRecord = {
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.postedAt,
        customerName: inv.customerNameSnapshot,
        customerGstin: inv.customerGstinSnapshot,
        placeOfSupply: inv.deliveryStateSnapshot,
        supplyType:
          inv.deliveryStateSnapshot === "Tamil Nadu"
            ? "Intra State"
            : "Inter State",
        taxableAmount: taxable,
        cgstAmount: Number(inv.cgstAmount),
        sgstAmount: Number(inv.sgstAmount),
        igstAmount: Number(inv.igstAmount),
        totalTaxAmount: tax,
        invoiceTotal: total,
      };

      if (isB2B) {
        b2bSupplies.push(supplyRecord);
        totalB2BTaxable += taxable;
        totalB2BTax += tax;
      } else {
        b2cSupplies.push(supplyRecord);
        totalB2CTaxable += taxable;
        totalB2CTax += tax;
      }

      for (const line of inv.lines) {
        const rate = Number(line.taxRate);
        if (!rateWiseMap[rate]) {
          rateWiseMap[rate] = {
            taxable: 0,
            cgst: 0,
            sgst: 0,
            igst: 0,
            totalTax: 0,
          };
        }
        rateWiseMap[rate].taxable += Number(line.taxableAmount);
        rateWiseMap[rate].cgst += Number(line.cgstAmount);
        rateWiseMap[rate].sgst += Number(line.sgstAmount);
        rateWiseMap[rate].igst += Number(line.igstAmount);
        rateWiseMap[rate].totalTax += Number(line.taxAmount);

        const hsn = line.hsnCodeSnapshot;
        if (!hsnMap[hsn]) {
          hsnMap[hsn] = {
            hsnCode: hsn,
            description: line.productNameSnapshot,
            quantity: 0,
            taxable: 0,
            cgst: 0,
            sgst: 0,
            igst: 0,
          };
        }
        hsnMap[hsn].quantity += Number(line.quantity);
        hsnMap[hsn].taxable += Number(line.taxableAmount);
        hsnMap[hsn].cgst += Number(line.cgstAmount);
        hsnMap[hsn].sgst += Number(line.sgstAmount);
        hsnMap[hsn].igst += Number(line.igstAmount);
      }

      for (const cn of inv.creditNotes) {
        const cnTotal = Number(cn.totalAmount);
        totalCreditNotesAmount += cnTotal;
        creditNotes.push({
          creditNoteNumber: cn.creditNoteNumber,
          originalInvoiceNumber: inv.invoiceNumber,
          customerName: inv.customerNameSnapshot,
          date: cn.postedAt,
          reason: cn.reason,
          taxableAmount: Number(cn.taxableAmount),
          taxAmount: Number(cn.taxAmount),
          totalAmount: cnTotal,
        });
      }
    }

    return {
      reportTitle: "GST Outward Summary (GSTR 1 Reconciliation)",
      companyGstin: "33AAAAA0000A1Z5",
      generatedAt: new Date(),
      filters: params,
      summary: {
        totalInvoices: invoices.length,
        totalTaxable: totalB2BTaxable + totalB2CTaxable,
        totalB2BTaxable,
        totalB2BTax,
        totalB2CTaxable,
        totalB2CTax,
        totalCreditNotesAmount,
        netTaxableValue: totalB2BTaxable + totalB2CTaxable,
        totalTaxAmount: totalB2BTax + totalB2CTax,
      },
      b2bSupplies,
      b2cSupplies,
      creditNotes,
      rateBreakup: Object.entries(rateWiseMap).map(([rate, data]) => ({
        ratePct: Number(rate),
        ...data,
      })),
      hsnSummary: Object.values(hsnMap),
    };
  }

  /**
   * 3. Purchase Register Report
   */
  async getPurchaseReport(params: ReportFilterParams) {
    const orgId = await this.resolveOrgId(params.organizationId);

    const where: Prisma.PurchaseReceiptWhereInput = {
      organizationId: orgId,
    };

    if (params.startDate || params.endDate) {
      where.postedAt = {};
      if (params.startDate) where.postedAt.gte = params.startDate;
      if (params.endDate) where.postedAt.lte = params.endDate;
    }

    if (params.supplierId) {
      where.supplierId = params.supplierId;
    }

    const receipts = await prisma.purchaseReceipt.findMany({
      where,
      include: {
        supplier: true,
        warehouse: true,
        lines: {
          include: {
            inventoryItem: {
              include: { baseUom: true },
            },
          },
        },
      },
      orderBy: { postedAt: "desc" },
    });

    const rows: PurchaseReportRow[] = [];
    let totalSpend = 0;
    let totalQty = 0;

    for (const rec of receipts) {
      for (const line of rec.lines) {
        const qty = Number(line.quantity);
        const cost = Number(line.unitPrice);
        const lineTotal = Number(line.totalPrice);

        totalSpend += lineTotal;
        totalQty += qty;

        rows.push({
          receiptNumber: rec.receiptNumber,
          receivedAt: rec.postedAt,
          supplierInvoiceNumber: rec.supplierInvoiceNumber,
          supplierCode: rec.supplier.code,
          supplierName: rec.supplier.name,
          warehouseCode: rec.warehouse.code,
          itemSku: line.inventoryItem.sku,
          itemName: line.inventoryItem.name,
          unitOfMeasure: line.inventoryItem.baseUom.code,
          receivedQuantity: qty,
          unitCost: cost,
          totalCost: lineTotal,
          status: rec.status,
        });
      }
    }

    return {
      reportTitle: "Purchase Register",
      generatedAt: new Date(),
      filters: params,
      summary: {
        totalReceiptsCount: receipts.length,
        totalItemsCount: rows.length,
        totalQuantity: totalQty,
        totalPurchaseAmount: totalSpend,
      },
      rows,
    };
  }

  /**
   * 4. Stock Summary and Valuation Report
   */
  async getStockSummaryReport(params: ReportFilterParams) {
    const orgId = await this.resolveOrgId(params.organizationId);

    const items = await prisma.inventoryItem.findMany({
      where: { organizationId: orgId },
      include: {
        baseUom: true,
      },
      orderBy: { sku: "asc" },
    });

    const itemIds = items.map((i) => i.id);

    // Group movements in SQL to prevent streaming unbounded ledger into memory
    const movementAggs =
      itemIds.length > 0
        ? await prisma.stockMovement.groupBy({
            by: ["inventoryItemId"],
            where: { inventoryItemId: { in: itemIds } },
            _sum: { quantity: true },
          })
        : [];

    const movementMap = new Map<string, number>();
    for (const m of movementAggs) {
      movementMap.set(m.inventoryItemId, Number(m._sum.quantity ?? 0));
    }

    // Group active reservations in SQL
    const reservationAggs =
      itemIds.length > 0
        ? await prisma.stockReservation.groupBy({
            by: ["inventoryItemId"],
            where: {
              inventoryItemId: { in: itemIds },
              status: "ACTIVE",
            },
            _sum: {
              reservedQuantity: true,
              releasedQuantity: true,
            },
          })
        : [];

    const reservationMap = new Map<string, number>();
    for (const r of reservationAggs) {
      const gross = Number(r._sum.reservedQuantity ?? 0);
      const released = Number(r._sum.releasedQuantity ?? 0);
      reservationMap.set(r.inventoryItemId, Math.max(0, gross - released));
    }

    let totalValuation = 0;
    let totalItems = 0;
    let unreconciledCount = 0;

    const rows = items.map((item) => {
      const onHand = Number(item.currentStock);
      const reserved = reservationMap.get(item.id) ?? 0;
      const available = onHand - reserved;
      const unitCost = Number(item.weightedAverageCost);
      const valuation = onHand * unitCost;

      // Reconcile append-only movements from database aggregation
      const ledgerSum = movementMap.get(item.id) ?? 0;
      const isReconciled = Math.abs(onHand - ledgerSum) < 0.0001;

      if (!isReconciled) {
        unreconciledCount++;
      }

      totalValuation += valuation;
      totalItems++;

      return {
        sku: item.sku,
        name: item.name,
        category: item.category,
        unitOfMeasure: item.baseUom.code,
        onHand,
        reserved,
        available,
        weightedAverageCost: unitCost,
        totalValuation: Math.round(valuation * 100) / 100,
        ledgerSum,
        isReconciled,
      };
    });

    return {
      reportTitle: "Stock Summary and Inventory Valuation",
      generatedAt: new Date(),
      summary: {
        totalItems,
        totalValuation: Math.round(totalValuation * 100) / 100,
        unreconciledCount,
        allReconciled: unreconciledCount === 0,
      },
      rows,
    };
  }

  /**
   * 5. Production and Variances Report
   */
  async getProductionReport(params: ReportFilterParams) {
    const orgId = await this.resolveOrgId(params.organizationId);

    const where: Prisma.ProductionRunWhereInput = {
      organizationId: orgId,
    };

    if (params.startDate || params.endDate) {
      where.postedAt = {};
      if (params.startDate) where.postedAt.gte = params.startDate;
      if (params.endDate) where.postedAt.lte = params.endDate;
    }

    if (params.recipeId) {
      where.recipeId = params.recipeId;
    }

    const runs = await prisma.productionRun.findMany({
      where,
      include: {
        recipe: {
          include: { productVariant: true },
        },
        materials: {
          include: {
            inventoryItem: {
              include: { baseUom: true },
            },
          },
        },
      },
      orderBy: { postedAt: "desc" },
    });

    let totalGoodQty = 0;
    let totalRejectedQty = 0;
    let totalRunCostSum = 0;
    let totalLaborCostSum = 0;
    let totalGasPowerCostSum = 0;

    const rows = runs.map((run) => {
      const goodQty = Number(run.actualGoodQty);
      const rejectedQty = Number(run.actualRejectedQty);
      const labor = Number(run.directLaborCost);
      const gas = Number(run.utilityCost);
      const totalCost = Number(run.totalRunCost);
      const unitCost = Number(run.costPerGoodUnit);

      if (run.status === "POSTED") {
        totalGoodQty += goodQty;
        totalRejectedQty += rejectedQty;
        totalRunCostSum += totalCost;
        totalLaborCostSum += labor;
        totalGasPowerCostSum += gas;
      }

      const materials = run.materials.map((m) => {
        const planned = Number(m.plannedQty);
        const actual = Number(m.actualQty);
        const damaged = Number(m.damagedQty);
        const varianceQty = actual - planned;
        const variancePct = planned > 0 ? (varianceQty / planned) * 100 : 0;

        return {
          sku: m.inventoryItem.sku,
          name: m.inventoryItem.name,
          uom: m.inventoryItem.baseUom.code,
          planned,
          actual,
          damaged,
          varianceQty,
          variancePct: Math.round(variancePct * 100) / 100,
          cost: Number(m.totalCost),
        };
      });

      return {
        runId: run.id,
        runNumber: run.runNumber,
        postedAt: run.postedAt,
        recipeName: run.recipe.name,
        productName: run.recipe.productVariant.name,
        batchCount: run.batchCount,
        actualGoodQty: goodQty,
        actualRejectedQty: rejectedQty,
        yieldVariancePct: Number(run.yieldVariancePct || 0),
        directLaborCost: labor,
        gasPowerCost: gas,
        totalCost,
        unitCost,
        status: run.status,
        materials,
      };
    });

    const postedRunsCount = runs.filter((r) => r.status === "POSTED").length;

    return {
      reportTitle: "Production and Variance Report",
      generatedAt: new Date(),
      filters: params,
      summary: {
        totalRunsCount: postedRunsCount,
        totalGoodQuantity: totalGoodQty,
        totalRejectedQuantity: totalRejectedQty,
        totalLaborCost: totalLaborCostSum,
        totalGasPowerCost: totalGasPowerCostSum,
        totalRunCost: totalRunCostSum,
      },
      rows,
    };
  }

  /**
   * 6. Collections and Cash Receipts Report
   */
  async getCollectionsReport(params: ReportFilterParams) {
    const orgId = await this.resolveOrgId(params.organizationId);

    const where: Prisma.PaymentWhereInput = {
      organizationId: orgId,
    };

    if (params.startDate || params.endDate) {
      where.paymentDate = {};
      if (params.startDate) where.paymentDate.gte = params.startDate;
      if (params.endDate) where.paymentDate.lte = params.endDate;
    }

    if (params.customerId) {
      where.customerId = params.customerId;
    }

    if (params.paymentMode) {
      where.paymentMode = params.paymentMode as PaymentMode;
    }

    if (params.salesmanId) {
      where.customer = {
        OR: [
          {
            assignments: {
              some: { salesmanId: params.salesmanId },
            },
          },
          {
            salesOrders: {
              some: { salesmanId: params.salesmanId },
            },
          },
        ],
      };
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        customer: true,
        allocations: {
          include: { salesInvoice: true },
        },
      },
      orderBy: { paymentDate: "desc" },
    });

    let totalCollected = 0;
    let totalUnallocated = 0;

    const rows = payments.map((p) => {
      const amount = Number(p.amount);
      const unalloc = Number(p.unallocatedAmount);
      const alloc = amount - unalloc;

      if (p.status === "POSTED") {
        totalCollected += amount;
        totalUnallocated += unalloc;
      }

      return {
        paymentNumber: p.paymentNumber,
        paymentDate: p.paymentDate,
        customerCode: p.customer.code,
        customerName: p.customer.name,
        paymentMode: p.paymentMode,
        referenceNumber: p.referenceNumber,
        amount,
        allocatedAmount: alloc,
        unallocatedAmount: unalloc,
        status: p.status,
        allocations: p.allocations.map((a) => ({
          invoiceNumber: a.salesInvoice.invoiceNumber,
          amount: Number(a.amount),
        })),
      };
    });

    return {
      reportTitle: "Collections and Receipts Report",
      generatedAt: new Date(),
      filters: params,
      summary: {
        totalPaymentsCount: payments.length,
        totalAmount: totalCollected,
        totalAllocated: totalCollected - totalUnallocated,
        totalUnallocated,
      },
      rows,
    };
  }

  /**
   * 7. Receivables and Ageing Report
   */
  async getReceivablesReport(params: ReportFilterParams) {
    const orgId = await this.resolveOrgId(params.organizationId);

    const customerWhere: Prisma.CustomerWhereInput = {
      organizationId: orgId,
      ...(params.customerId ? { id: params.customerId } : {}),
      ...(params.salesmanId
        ? {
            OR: [
              {
                assignments: {
                  some: { salesmanId: params.salesmanId },
                },
              },
              {
                salesOrders: {
                  some: { salesmanId: params.salesmanId },
                },
              },
            ],
          }
        : {}),
    };

    const customers = await prisma.customer.findMany({
      where: customerWhere,
      include: {
        invoices: {
          where: {
            status: { not: InvoiceStatus.DRAFT },
            ...(params.salesmanId
              ? {
                  OR: [
                    { salesOrder: { salesmanId: params.salesmanId } },
                    {
                      customer: {
                        assignments: {
                          some: { salesmanId: params.salesmanId },
                        },
                      },
                    },
                  ],
                }
              : {}),
          },
          include: { creditNotes: true },
        },
        payments: {
          where: { status: PaymentStatus.POSTED },
        },
      },
      orderBy: { name: "asc" },
    });

    const now = new Date().getTime();
    let totalInvoicedSum = 0;
    let totalCreditNotesSum = 0;
    let totalPaidSum = 0;
    let totalOutstandingSum = 0;

    const overallAgeing = {
      current0to30: 0,
      days31to60: 0,
      days61to90: 0,
      over90days: 0,
    };

    const rows = customers.map((c) => {
      const totalInvoiced = c.invoices.reduce(
        (sum, inv) => sum + Number(inv.totalAmount),
        0,
      );
      const totalCreditNotes = c.invoices.reduce(
        (sum, inv) =>
          sum +
          inv.creditNotes.reduce(
            (csum, cn) => csum + Number(cn.totalAmount),
            0,
          ),
        0,
      );
      const totalPaid = c.payments.reduce(
        (sum, p) => sum + Number(p.amount),
        0,
      );
      const outstanding = totalInvoiced - totalCreditNotes - totalPaid;

      totalInvoicedSum += totalInvoiced;
      totalCreditNotesSum += totalCreditNotes;
      totalPaidSum += totalPaid;
      totalOutstandingSum += outstanding;

      const ageing = {
        current0to30: 0,
        days31to60: 0,
        days61to90: 0,
        over90days: 0,
      };

      for (const inv of c.invoices) {
        const open = Number(inv.outstandingAmount);
        if (open > 0) {
          const days = Math.floor(
            (now - new Date(inv.postedAt).getTime()) / (1000 * 60 * 60 * 24),
          );
          if (days <= 30) {
            ageing.current0to30 += open;
            overallAgeing.current0to30 += open;
          } else if (days <= 60) {
            ageing.days31to60 += open;
            overallAgeing.days31to60 += open;
          } else if (days <= 90) {
            ageing.days61to90 += open;
            overallAgeing.days61to90 += open;
          } else {
            ageing.over90days += open;
            overallAgeing.over90days += open;
          }
        }
      }

      return {
        customerId: c.id,
        customerCode: c.code,
        customerName: c.name,
        state: c.state,
        totalInvoiced,
        totalCreditNotes,
        totalPaid,
        netOutstanding: Math.round(outstanding * 100) / 100,
        ageing,
      };
    });

    return {
      reportTitle: "Receivables and Ageing Report",
      generatedAt: new Date(),
      summary: {
        totalCustomers: customers.length,
        totalInvoiced: totalInvoicedSum,
        totalCreditNotes: totalCreditNotesSum,
        totalPaid: totalPaidSum,
        totalOutstanding: Math.round(totalOutstandingSum * 100) / 100,
        overallAgeing,
      },
      rows,
    };
  }

  /**
   * 8. Owner Unified Executive Dashboard
   */
  async getOwnerDashboard(params: ReportFilterParams) {
    const orgId = await this.resolveOrgId(params.organizationId);

    const [salesRep, stockRep, prodRep, recRep, collRep] = await Promise.all([
      this.getSalesReport({ organizationId: orgId }),
      this.getStockSummaryReport({ organizationId: orgId }),
      this.getProductionReport({ organizationId: orgId }),
      this.getReceivablesReport({ organizationId: orgId }),
      this.getCollectionsReport({ organizationId: orgId }),
    ]);

    // Active pending sales orders
    const pendingOrdersCount = await prisma.salesOrder.count({
      where: {
        organizationId: orgId,
        status: { in: ["SUBMITTED", "UNDER_REVIEW", "APPROVED"] },
        fulfilmentStatus: { not: "FULFILLED" },
      },
    });

    // Today's IST start (UTC+05:30)
    const now = new Date();
    const istDateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    const todayStartIst = new Date(`${istDateStr}T00:00:00+05:30`);

    const [todayOrdersCount, todayInvoices, variantsWithCost] = await Promise.all([
      prisma.salesOrder.count({
        where: {
          organizationId: orgId,
          createdAt: { gte: todayStartIst },
        },
      }),
      prisma.salesInvoice.findMany({
        where: {
          organizationId: orgId,
          status: { not: InvoiceStatus.DRAFT },
          postedAt: { gte: todayStartIst },
        },
        select: { taxableAmount: true },
      }),
      prisma.productVariant.findMany({
        where: {
          product: { organizationId: orgId },
          isActive: true,
        },
        include: {
          priceLines: {
            where: { priceList: { isDefault: true } },
          },
          recipes: {
            include: {
              productionRuns: {
                where: { status: "POSTED" },
                orderBy: { postedAt: "desc" },
                take: 1,
              },
            },
          },
        },
      }),
    ]);

    const todayRevenue = todayInvoices.reduce(
      (sum, inv) => sum + Number(inv.taxableAmount),
      0,
    );

    const lowStockAlerts = stockRep.rows
      .filter((r) => r.available <= 50)
      .map((r) => ({
        sku: r.sku,
        name: r.name,
        available: r.available,
        onHand: r.onHand,
      }));

    const varianceAlerts = prodRep.rows
      .filter((r) => r.status === "POSTED" && Math.abs(r.yieldVariancePct) >= 5)
      .map((r) => ({
        runNumber: r.runNumber,
        productName: r.productName,
        yieldVariancePct: r.yieldVariancePct,
      }));

    const productMargins = variantsWithCost
      .map((v) => {
        const sellingPriceExclGst = Number(v.priceLines[0]?.price ?? 0);
        const latestRun = v.recipes
          .flatMap((r) => r.productionRuns)
          .sort(
            (a, b) =>
              new Date(b.postedAt ?? 0).getTime() -
              new Date(a.postedAt ?? 0).getTime(),
          )[0];
        const unitCost = latestRun ? Number(latestRun.costPerGoodUnit) : 0;
        const marginAmount =
          sellingPriceExclGst > 0 && unitCost > 0
            ? Number((sellingPriceExclGst - unitCost).toFixed(2))
            : 0;
        const marginPct =
          sellingPriceExclGst > 0 && unitCost > 0
            ? Number(((marginAmount / sellingPriceExclGst) * 100).toFixed(1))
            : 0;
        return {
          sku: v.sku,
          name: v.name,
          sellingPriceExclGst,
          unitCost,
          marginAmount,
          marginPct,
        };
      })
      .filter((m) => m.sellingPriceExclGst > 0);

    return {
      dashboardTitle: "MillLedger Operational Overview",
      asOf: new Date(),
      metrics: {
        totalRevenue: salesRep.summary.grandTotal,
        totalInvoicesCount: salesRep.summary.totalInvoicesCount,
        totalStockValuation: stockRep.summary.totalValuation,
        stockReconciliationOk: stockRep.summary.allReconciled,
        totalProductionUnits: prodRep.summary.totalGoodQuantity,
        totalProductionCost: prodRep.summary.totalRunCost,
        totalCollections: collRep.summary.totalAmount,
        totalOutstandingReceivables: recRep.summary.totalOutstanding,
        unallocatedCashCredit: collRep.summary.totalUnallocated,
        pendingOrdersCount,
        todayOrdersCount,
        todayRevenue,
      },
      lowStockAlerts,
      varianceAlerts,
      productMargins,
      recentInvoices: salesRep.rows.slice(0, 5),
      stockItems: stockRep.rows.slice(0, 8),
      recentProductionRuns: prodRep.rows.slice(0, 5),
      topReceivables: recRep.rows
        .filter((r) => r.netOutstanding > 0)
        .slice(0, 5),
    };
  }

  /**
   * 8c. Customer-wise Sales Report (IMP-020)
   */
  async getCustomerWiseSalesReport(params: ReportFilterParams) {
    const orgId = await this.resolveOrgId(params.organizationId);
    const where: Prisma.SalesInvoiceWhereInput = {
      organizationId: orgId,
      status: { not: InvoiceStatus.DRAFT },
    };
    if (params.startDate || params.endDate) {
      where.postedAt = {};
      if (params.startDate) where.postedAt.gte = params.startDate;
      if (params.endDate) where.postedAt.lte = params.endDate;
    }
    if (params.customerId) {
      where.customerId = params.customerId;
    }
    if (params.salesmanId) {
      where.salesOrder = { salesmanId: params.salesmanId };
    }

    const invoices = await prisma.salesInvoice.findMany({
      where,
      include: { customer: true },
    });

    const map = new Map<
      string,
      {
        customerCode: string;
        customerName: string;
        state: string;
        invoicesCount: number;
        taxableAmount: number;
        totalTaxAmount: number;
        totalAmount: number;
        outstandingAmount: number;
      }
    >();

    for (const inv of invoices) {
      const entry = map.get(inv.customerId) || {
        customerCode: inv.customer.code,
        customerName: inv.customerNameSnapshot,
        state: inv.deliveryStateSnapshot,
        invoicesCount: 0,
        taxableAmount: 0,
        totalTaxAmount: 0,
        totalAmount: 0,
        outstandingAmount: 0,
      };
      entry.invoicesCount += 1;
      entry.taxableAmount += Number(inv.taxableAmount);
      entry.totalTaxAmount += Number(inv.totalTaxAmount);
      entry.totalAmount += Number(inv.totalAmount);
      entry.outstandingAmount += Number(inv.outstandingAmount);
      map.set(inv.customerId, entry);
    }

    const rows = Array.from(map.values()).sort(
      (a, b) => b.totalAmount - a.totalAmount,
    );
    return {
      reportTitle: "Customer-Wise Sales Summary",
      generatedAt: new Date().toISOString(),
      rows,
    };
  }

  /**
   * 8d. Product-wise Sales Report (IMP-020)
   */
  async getProductWiseSalesReport(params: ReportFilterParams) {
    const orgId = await this.resolveOrgId(params.organizationId);
    const invoiceWhere: Prisma.SalesInvoiceWhereInput = {
      organizationId: orgId,
      status: { not: InvoiceStatus.DRAFT },
    };
    if (params.startDate || params.endDate) {
      invoiceWhere.postedAt = {};
      if (params.startDate) invoiceWhere.postedAt.gte = params.startDate;
      if (params.endDate) invoiceWhere.postedAt.lte = params.endDate;
    }
    if (params.customerId) {
      invoiceWhere.customerId = params.customerId;
    }
    if (params.salesmanId) {
      invoiceWhere.salesOrder = { salesmanId: params.salesmanId };
    }

    const lines = await prisma.salesInvoiceLine.findMany({
      where: { salesInvoice: invoiceWhere },
    });

    const map = new Map<
      string,
      {
        productName: string;
        hsnCode: string;
        totalQuantity: number;
        taxableAmount: number;
        totalTaxAmount: number;
        totalAmount: number;
      }
    >();

    for (const l of lines) {
      const key = `${l.productNameSnapshot}::${l.hsnCodeSnapshot}`;
      const entry = map.get(key) || {
        productName: l.productNameSnapshot,
        hsnCode: l.hsnCodeSnapshot,
        totalQuantity: 0,
        taxableAmount: 0,
        totalTaxAmount: 0,
        totalAmount: 0,
      };
      entry.totalQuantity += Number(l.quantity);
      entry.taxableAmount += Number(l.taxableAmount);
      entry.totalTaxAmount += Number(l.taxAmount);
      entry.totalAmount += Number(l.lineTotal);
      map.set(key, entry);
    }

    const rows = Array.from(map.values()).sort(
      (a, b) => b.totalAmount - a.totalAmount,
    );
    return {
      reportTitle: "Product-Wise Sales Summary",
      generatedAt: new Date().toISOString(),
      rows,
    };
  }

  /**
   * 8e. Stock Ledger Report (IMP-020)
   */
  async getStockLedgerReport(params: ReportFilterParams) {
    const orgId = await this.resolveOrgId(params.organizationId);
    const where: Prisma.StockMovementWhereInput = {
      inventoryItem: { organizationId: orgId },
    };
    if (params.startDate || params.endDate) {
      where.postedAt = {};
      if (params.startDate) where.postedAt.gte = params.startDate;
      if (params.endDate) where.postedAt.lte = params.endDate;
    }

    const movements = await prisma.stockMovement.findMany({
      where,
      include: {
        inventoryItem: { include: { baseUom: true } },
        warehouse: true,
      },
      orderBy: { postedAt: "desc" },
      take: 1000,
    });

    const rows = movements.map((m) => ({
      postedAt: m.postedAt.toISOString(),
      sku: m.inventoryItem.sku,
      itemName: m.inventoryItem.name,
      uom: m.inventoryItem.baseUom.symbol,
      warehouse: m.warehouse.name,
      movementType: m.movementType,
      quantity: Number(m.quantity),
      unitCost: Number(m.unitCost),
      totalCost: Number(m.totalCost),
      referenceType: m.referenceDocumentType || "",
      notes: m.notes || "",
    }));

    return {
      reportTitle: "Stock Movement Ledger",
      generatedAt: new Date().toISOString(),
      rows,
    };
  }

  /**
   * 8b. System Audit Trail Report
   */
  async getAuditReport(params: ReportFilterParams) {
    const orgId = await this.resolveOrgId(params.organizationId);
    const logs = await auditService.getLogs({
      organizationId: orgId,
      startDate: params.startDate,
      endDate: params.endDate,
      limit: 1000,
    });

    const rows = logs.map((log) => ({
      timestamp: log.timestamp.toISOString(),
      userEmail: log.userEmail || "System",
      action: log.action,
      entity: log.entity,
      entityId: log.entityId || "",
      requestId: log.requestId || "",
      ipAddress: log.ipAddress || "",
      details: log.details || "",
    }));

    return {
      reportTitle: "System Audit Trail",
      generatedAt: new Date().toISOString(),
      rows,
      summary: {
        totalRecords: rows.length,
      },
    };
  }

  /**
   * Neutralize potential formula injection characters for CSV export per CWE-1236 & OWASP
   */
  sanitizeCSVCell(val: unknown): string {
    if (val === null || val === undefined) return '""';
    let str = String(val).replace(/"/g, '""');
    if (
      typeof val !== "number" &&
      typeof val !== "boolean" &&
      /^[=+\-@\t\r]/.test(str)
    ) {
      str = `'${str}`;
    }
    return `"${str}"`;
  }

  /**
   * 9. Export Report to CSV format
   */
  private async resolveReportData(
    reportType: string,
    params: ReportFilterParams,
  ): Promise<ReportExportData> {
    switch (reportType.toLowerCase()) {
      case "sales":
        return await this.getSalesReport(params);
      case "customer-sales":
        return await this.getCustomerWiseSalesReport(params);
      case "product-sales":
        return await this.getProductWiseSalesReport(params);
      case "stock-ledger":
        return await this.getStockLedgerReport(params);
      case "gst":
        return await this.getGSTOutwardSummary(params);
      case "purchase":
        return await this.getPurchaseReport(params);
      case "stock":
        return await this.getStockSummaryReport(params);
      case "production":
        return await this.getProductionReport(params);
      case "collections":
        return await this.getCollectionsReport(params);
      case "receivables":
        return await this.getReceivablesReport(params);
      case "audit":
        return await this.getAuditReport(params);
      default:
        throw new AppError(`Unknown report type: ${reportType}`, 400);
    }
  }

  private extractTabularRows(reportData: ReportExportData): {
    headers: string[];
    rows: Record<string, unknown>[];
  } {
    const rows: Record<string, unknown>[] =
      (reportData.rows as Record<string, unknown>[]) ||
      (reportData.b2bSupplies as Record<string, unknown>[]) ||
      [];
    if (rows.length === 0) {
      return { headers: [], rows: [] };
    }
    const headers = Object.keys(rows[0]).filter(
      (k) => typeof rows[0][k] !== "object" || rows[0][k] instanceof Date,
    );
    return { headers, rows };
  }

  async exportToCSV(
    reportType: string,
    params: ReportFilterParams,
    userContext?:
      | UserContext
      | { id?: string; email?: string; [key: string]: unknown },
  ) {
    const reportData = await this.resolveReportData(reportType, params);

    await auditService.log({
      organizationId: params.organizationId,
      userId: userContext?.id,
      userEmail: userContext?.email,
      action: "EXPORT",
      entity: "REPORT",
      details: { reportType, format: "CSV" },
    });

    const { headers, rows } = this.extractTabularRows(reportData);
    if (rows.length === 0) {
      return `Report: ${reportData.reportTitle}\nGenerated At: ${reportData.generatedAt}\nNo records found`;
    }

    const csvLines = [
      `# Report: ${reportData.reportTitle}`,
      `# Generated At: ${new Date().toISOString()}`,
      headers.join(","),
    ];

    for (const r of rows) {
      const line = headers.map((h) => this.sanitizeCSVCell(r[h]));
      csvLines.push(line.join(","));
    }

    return csvLines.join("\n");
  }

  async exportToXLSX(
    reportType: string,
    params: ReportFilterParams,
    userContext?:
      | UserContext
      | { id?: string; email?: string; [key: string]: unknown },
  ): Promise<Buffer> {
    const reportData = await this.resolveReportData(reportType, params);

    await auditService.log({
      organizationId: params.organizationId,
      userId: userContext?.id,
      userEmail: userContext?.email,
      action: "EXPORT",
      entity: "REPORT",
      details: { reportType, format: "XLSX" },
    });

    const { headers, rows } = this.extractTabularRows(reportData);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "MillLedger ERP";
    workbook.created = new Date();

    const title = reportData.reportTitle || `${reportType.toUpperCase()} Report`;
    const sheet = workbook.addWorksheet(title.slice(0, 31));
    sheet.addRow([title]);
    sheet.addRow([`Generated At: ${new Date().toISOString()}`]);
    sheet.addRow([]);

    if (headers.length === 0) {
      sheet.addRow(["No records found"]);
    } else {
      const headerRow = sheet.addRow(headers);
      headerRow.font = { bold: true };
      for (const r of rows) {
        sheet.addRow(
          headers.map((h) => {
            const v = r[h];
            return v instanceof Date ? v.toISOString() : (v ?? "");
          }),
        );
      }
      sheet.columns.forEach((col) => {
        col.width = 18;
      });
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  async exportToPDF(
    reportType: string,
    params: ReportFilterParams,
    userContext?:
      | UserContext
      | { id?: string; email?: string; [key: string]: unknown },
  ): Promise<Buffer> {
    const reportData = await this.resolveReportData(reportType, params);

    await auditService.log({
      organizationId: params.organizationId,
      userId: userContext?.id,
      userEmail: userContext?.email,
      action: "EXPORT",
      entity: "REPORT",
      details: { reportType, format: "PDF" },
    });

    const { headers, rows } = this.extractTabularRows(reportData);

    return await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: "A4",
        layout: "landscape",
        margin: 32,
      });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));

      const title = reportData.reportTitle || `${reportType.toUpperCase()} Report`;
      doc.fontSize(15).font("Helvetica-Bold").text(title);
      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor("#4b5563")
        .text(`Generated: ${new Date().toISOString()} | Records: ${rows.length}`);
      doc.moveDown(0.75);

      if (headers.length === 0) {
        doc.fontSize(10).fillColor("#111827").text("No records found.");
      } else {
        const displayHeaders = headers.slice(0, 8);
        const usableWidth = 778;
        const colWidth = Math.floor(usableWidth / displayHeaders.length);

        const drawHeader = (y: number) => {
          doc.rect(32, y - 3, usableWidth, 16).fill("#f3f4f6");
          doc.fillColor("#111827").font("Helvetica-Bold").fontSize(7.5);
          displayHeaders.forEach((h, idx) => {
            doc.text(h, 34 + idx * colWidth, y, {
              width: colWidth - 4,
              ellipsis: true,
            });
          });
        };

        let y = doc.y;
        drawHeader(y);
        y += 18;
        doc.font("Helvetica").fontSize(7.5).fillColor("#111827");

        for (const r of rows) {
          if (y > 540) {
            doc.addPage();
            y = 32;
            drawHeader(y);
            y += 18;
            doc.font("Helvetica").fontSize(7.5).fillColor("#111827");
          }
          displayHeaders.forEach((h, idx) => {
            const raw = r[h];
            const text =
              raw instanceof Date
                ? raw.toISOString().slice(0, 10)
                : raw === null || raw === undefined
                  ? ""
                  : String(raw);
            doc.text(text, 34 + idx * colWidth, y, {
              width: colWidth - 4,
              ellipsis: true,
            });
          });
          y += 15;
          doc
            .moveTo(32, y - 3)
            .lineTo(32 + usableWidth, y - 3)
            .strokeColor("#e5e7eb")
            .stroke();
        }
      }

      doc.end();
    });
  }
}

export const reportingService = new ReportingService();
