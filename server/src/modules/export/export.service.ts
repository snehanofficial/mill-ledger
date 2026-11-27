import { prisma } from "../../db/client.js";
import type { UserContext } from "@mill-ledger/shared";
import { AppError } from "../../middleware/error.middleware.js";
import { auditService } from "../reporting/audit.service.js";
import type {
  ExportColumn,
  ExportDocumentMeta,
  ExportOrganization,
} from "./export.types.js";
import { renderTabularCsv } from "./csv.renderer.js";
import { renderExcelWorkbook } from "./excel.renderer.js";
import { renderTabularPdf } from "./pdf.renderer.js";
import { formatExportCurrency, formatPeriodLabel } from "./export.theme.js";
import {
  generateCustomerStatementPdfBuffer,
  generateOrderPdfBuffer,
  generatePaymentReceiptPdfBuffer,
  generateRecipeSheetPdfBuffer,
} from "./templates/commercial-pdfs.js";

export type ExportFormat = "pdf" | "xlsx" | "csv";

export interface EntityExportFilters {
  organizationId: string;
  q?: string;
  status?: string;
  paymentMode?: string;
  startDate?: Date;
  endDate?: Date;
  ids?: string[];
  user: UserContext;
}

export class ExportService {
  private async resolveOrg(
    orgIdOrCode: string,
  ): Promise<ExportOrganization & { id: string }> {
    const org = await prisma.organization.findFirst({
      where: { OR: [{ id: orgIdOrCode }, { code: orgIdOrCode }] },
      select: { id: true, code: true, name: true, gstin: true, state: true },
    });
    if (!org) {
      throw new AppError("Organization not found", 404);
    }
    return org;
  }

  private async formatOutput(
    format: ExportFormat,
    meta: ExportDocumentMeta,
    sheetName: string,
    columns: ExportColumn<any>[],
    rows: Record<string, unknown>[],
    totalsRow?: Record<string, unknown>,
  ): Promise<Buffer | string> {
    if (format === "csv") {
      return renderTabularCsv(columns, rows);
    }
    if (format === "xlsx") {
      return await renderExcelWorkbook(meta, [
        { name: sheetName, columns, rows, totalsRow },
      ]);
    }
    return await renderTabularPdf(meta, [{ columns, rows, totalsRow }]);
  }

  async exportEntity(
    entity: string,
    format: ExportFormat,
    filters: EntityExportFilters,
  ): Promise<{ content: Buffer | string; orgName?: string | null }> {
    const org = await this.resolveOrg(filters.organizationId);
    const scopeLabel =
      filters.ids && filters.ids.length > 0
        ? `Selected (${filters.ids.length} records)`
        : filters.q || filters.status
          ? "Filtered View"
          : "All Records";
    const periodLabel =
      filters.startDate || filters.endDate
        ? formatPeriodLabel(filters.startDate, filters.endDate)
        : undefined;

    await auditService.log({
      organizationId: org.id,
      userId: filters.user.id,
      userEmail: filters.user.email,
      action: "EXPORT",
      entity: entity.toUpperCase(),
      details: {
        format: format.toUpperCase(),
        scope: scopeLabel,
        selectedCount: filters.ids?.length ?? 0,
      },
    });

    switch (entity.toLowerCase()) {
      case "products": {
        const variants = await prisma.productVariant.findMany({
          where: {
            product: { organizationId: org.id },
            ...(filters.ids?.length ? { id: { in: filters.ids } } : {}),
            ...(filters.q
              ? {
                  OR: [
                    { sku: { contains: filters.q, mode: "insensitive" } },
                    { name: { contains: filters.q, mode: "insensitive" } },
                    {
                      product: {
                        name: { contains: filters.q, mode: "insensitive" },
                      },
                    },
                  ],
                }
              : {}),
          },
          include: {
            product: true,
            uom: true,
            priceLines: { where: { priceList: { isDefault: true } } },
          },
          orderBy: { sku: "asc" },
        });

        const rows = variants.map((v) => ({
          sku: v.sku,
          name: v.name,
          productName: v.product.name,
          hsnCode: v.product.hsnCode,
          packSize: Number(v.packSize),
          uom: v.uom?.code || "PKT",
          defaultPrice: Number(v.priceLines[0]?.price ?? 0),
          isActive: v.isActive,
        }));

        const columns: ExportColumn[] = [
          { key: "sku", header: "SKU", type: "text", width: 85 },
          { key: "name", header: "Variant Name", type: "text", width: 150 },
          {
            key: "productName",
            header: "Product Family",
            type: "text",
            width: 120,
          },
          { key: "hsnCode", header: "HSN Code", type: "text", width: 70 },
          { key: "packSize", header: "Pack Size", type: "quantity", width: 72 },
          { key: "uom", header: "UOM", type: "text", width: 48 },
          {
            key: "defaultPrice",
            header: "Base Price",
            type: "currency",
            width: 85,
          },
          { key: "isActive", header: "Active", type: "boolean", width: 52 },
        ];

        const meta: ExportDocumentMeta = {
          title: "Product Catalogue",
          documentType: "Master Data",
          scopeLabel,
          generatedAt: new Date(),
          organization: org,
          summaryItems: [
            { label: "Total SKUs", value: String(rows.length) },
            {
              label: "Active SKUs",
              value: String(rows.filter((r) => r.isActive).length),
            },
          ],
        };
        return {
          content: await this.formatOutput(
            format,
            meta,
            "Products",
            columns,
            rows,
          ),
          orgName: org.name,
        };
      }

      case "customers": {
        const isSalesman = filters.user.role === "SALESMAN";
        const customers = await prisma.customer.findMany({
          where: {
            organizationId: org.id,
            ...(filters.ids?.length ? { id: { in: filters.ids } } : {}),
            ...(isSalesman
              ? { assignments: { some: { salesmanId: filters.user.id } } }
              : {}),
            ...(filters.q
              ? {
                  OR: [
                    { code: { contains: filters.q, mode: "insensitive" } },
                    { name: { contains: filters.q, mode: "insensitive" } },
                    { gstin: { contains: filters.q, mode: "insensitive" } },
                  ],
                }
              : {}),
          },
          orderBy: { name: "asc" },
        });

        const rows = customers.map((c) => ({
          code: c.code,
          name: c.name,
          state: c.state,
          taxRegime: c.gstin ? "Registered (B2B)" : "Unregistered (B2C)",
          gstin: c.gstin || "",
          phone: c.phone || "",
          email: c.email || "",
          isActive: c.isActive,
        }));

        const columns: ExportColumn[] = [
          { key: "code", header: "Account Code", type: "text", width: 75 },
          { key: "name", header: "Customer Name", type: "text", width: 145 },
          { key: "state", header: "Place of Supply", type: "text", width: 85 },
          { key: "taxRegime", header: "Tax Regime", type: "text", width: 95 },
          { key: "gstin", header: "GSTIN", type: "text", width: 95 },
          { key: "phone", header: "Phone", type: "text", width: 80 },
          { key: "email", header: "Email", type: "text", width: 115 },
          { key: "isActive", header: "Active", type: "boolean", width: 50 },
        ];

        const meta: ExportDocumentMeta = {
          title: "Customer Directory",
          documentType: "Master Data",
          scopeLabel,
          generatedAt: new Date(),
          organization: org,
          summaryItems: [{ label: "Customers", value: String(rows.length) }],
        };
        return {
          content: await this.formatOutput(
            format,
            meta,
            "Customers",
            columns,
            rows,
          ),
          orgName: org.name,
        };
      }

      case "orders": {
        const isSalesman = filters.user.role === "SALESMAN";
        const orders = await prisma.salesOrder.findMany({
          where: {
            organizationId: org.id,
            ...(filters.ids?.length ? { id: { in: filters.ids } } : {}),
            ...(isSalesman ? { salesmanId: filters.user.id } : {}),
            ...(filters.status && filters.status !== "ALL"
              ? { status: filters.status as any }
              : {}),
            ...(filters.startDate || filters.endDate
              ? {
                  createdAt: {
                    ...(filters.startDate ? { gte: filters.startDate } : {}),
                    ...(filters.endDate ? { lte: filters.endDate } : {}),
                  },
                }
              : {}),
            ...(filters.q
              ? {
                  OR: [
                    {
                      orderNumber: { contains: filters.q, mode: "insensitive" },
                    },
                    {
                      customer: {
                        name: { contains: filters.q, mode: "insensitive" },
                      },
                    },
                  ],
                }
              : {}),
          },
          include: { customer: true, salesman: true },
          orderBy: { createdAt: "desc" },
        });

        const rows = orders.map((o) => ({
          orderNumber: o.orderNumber,
          createdAt: o.createdAt,
          customerName: `${o.customer.name} (${o.customer.code})`,
          salesmanName: o.salesman?.name || "—",
          status: o.status.replaceAll("_", " "),
          fulfilmentStatus: o.fulfilmentStatus.replaceAll("_", " "),
          taxableAmount: Number(o.taxableAmount),
          totalTaxAmount: Number(o.totalTaxAmount),
          totalAmount: Number(o.totalAmount),
        }));

        const totalAmount = rows.reduce((s, r) => s + r.totalAmount, 0);
        const columns: ExportColumn[] = [
          { key: "orderNumber", header: "Order #", type: "text", width: 88 },
          { key: "createdAt", header: "Order Date", type: "date", width: 68 },
          { key: "customerName", header: "Customer", type: "text", width: 145 },
          { key: "salesmanName", header: "Salesman", type: "text", width: 95 },
          { key: "status", header: "Status", type: "text", width: 78 },
          {
            key: "fulfilmentStatus",
            header: "Fulfilment",
            type: "text",
            width: 82,
          },
          {
            key: "taxableAmount",
            header: "Taxable",
            type: "currency",
            width: 82,
          },
          { key: "totalTaxAmount", header: "Tax", type: "currency", width: 68 },
          { key: "totalAmount", header: "Total", type: "currency", width: 88 },
        ];
        const totalsRow = {
          orderNumber: "Total",
          taxableAmount: rows.reduce((s, r) => s + r.taxableAmount, 0),
          totalTaxAmount: rows.reduce((s, r) => s + r.totalTaxAmount, 0),
          totalAmount,
        };
        const meta: ExportDocumentMeta = {
          title: "Sales Orders",
          documentType: "Commercial Register",
          periodLabel,
          scopeLabel,
          generatedAt: new Date(),
          organization: org,
          summaryItems: [
            { label: "Orders", value: String(rows.length) },
            {
              label: "Total Value",
              value: formatExportCurrency(totalAmount, true),
              bold: true,
            },
          ],
        };
        return {
          content: await this.formatOutput(
            format,
            meta,
            "Sales Orders",
            columns,
            rows,
            totalsRow,
          ),
          orgName: org.name,
        };
      }

      case "invoices": {
        const invoices = await prisma.salesInvoice.findMany({
          where: {
            organizationId: org.id,
            ...(filters.ids?.length ? { id: { in: filters.ids } } : {}),
            ...(filters.status && filters.status !== "ALL"
              ? { status: filters.status as any }
              : {}),
            ...(filters.startDate || filters.endDate
              ? {
                  postedAt: {
                    ...(filters.startDate ? { gte: filters.startDate } : {}),
                    ...(filters.endDate ? { lte: filters.endDate } : {}),
                  },
                }
              : {}),
            ...(filters.q
              ? {
                  OR: [
                    {
                      invoiceNumber: {
                        contains: filters.q,
                        mode: "insensitive",
                      },
                    },
                    {
                      customerNameSnapshot: {
                        contains: filters.q,
                        mode: "insensitive",
                      },
                    },
                  ],
                }
              : {}),
          },
          orderBy: { postedAt: "desc" },
        });

        const rows = invoices.map((inv) => ({
          invoiceNumber: inv.invoiceNumber,
          postedAt: inv.postedAt,
          customerName: inv.customerNameSnapshot,
          deliveryState: inv.deliveryStateSnapshot,
          status: inv.status.replaceAll("_", " "),
          taxableAmount: Number(inv.taxableAmount),
          totalTaxAmount: Number(inv.totalTaxAmount),
          totalAmount: Number(inv.totalAmount),
          outstandingAmount: Number(inv.outstandingAmount),
        }));

        const totalAmount = rows.reduce((s, r) => s + r.totalAmount, 0);
        const totalOut = rows.reduce((s, r) => s + r.outstandingAmount, 0);
        const columns: ExportColumn[] = [
          {
            key: "invoiceNumber",
            header: "Invoice #",
            type: "text",
            width: 88,
          },
          { key: "postedAt", header: "Posted Date", type: "date", width: 68 },
          { key: "customerName", header: "Customer", type: "text", width: 140 },
          {
            key: "deliveryState",
            header: "Place of Supply",
            type: "text",
            width: 85,
          },
          { key: "status", header: "Status", type: "text", width: 78 },
          {
            key: "taxableAmount",
            header: "Taxable",
            type: "currency",
            width: 80,
          },
          { key: "totalTaxAmount", header: "Tax", type: "currency", width: 68 },
          { key: "totalAmount", header: "Total", type: "currency", width: 85 },
          {
            key: "outstandingAmount",
            header: "Outstanding",
            type: "currency",
            width: 85,
          },
        ];
        const totalsRow = {
          invoiceNumber: "Total",
          taxableAmount: rows.reduce((s, r) => s + r.taxableAmount, 0),
          totalTaxAmount: rows.reduce((s, r) => s + r.totalTaxAmount, 0),
          totalAmount,
          outstandingAmount: totalOut,
        };
        const meta: ExportDocumentMeta = {
          title: "Sales Invoices",
          documentType: "Commercial Register",
          periodLabel,
          scopeLabel,
          generatedAt: new Date(),
          organization: org,
          summaryItems: [
            { label: "Invoices", value: String(rows.length) },
            {
              label: "Total Invoiced",
              value: formatExportCurrency(totalAmount, true),
              bold: true,
            },
            {
              label: "Outstanding",
              value: formatExportCurrency(totalOut, true),
            },
          ],
        };
        return {
          content: await this.formatOutput(
            format,
            meta,
            "Invoices",
            columns,
            rows,
            totalsRow,
          ),
          orgName: org.name,
        };
      }

      case "payments": {
        const payments = await prisma.payment.findMany({
          where: {
            organizationId: org.id,
            ...(filters.ids?.length ? { id: { in: filters.ids } } : {}),
            ...(filters.status && filters.status !== "ALL"
              ? { status: filters.status as any }
              : {}),
            ...(filters.paymentMode && filters.paymentMode !== "ALL"
              ? { paymentMode: filters.paymentMode as any }
              : {}),
            ...(filters.startDate || filters.endDate
              ? {
                  paymentDate: {
                    ...(filters.startDate ? { gte: filters.startDate } : {}),
                    ...(filters.endDate ? { lte: filters.endDate } : {}),
                  },
                }
              : {}),
            ...(filters.q
              ? {
                  OR: [
                    {
                      paymentNumber: {
                        contains: filters.q,
                        mode: "insensitive",
                      },
                    },
                    {
                      customer: {
                        name: { contains: filters.q, mode: "insensitive" },
                      },
                    },
                    {
                      referenceNumber: {
                        contains: filters.q,
                        mode: "insensitive",
                      },
                    },
                  ],
                }
              : {}),
          },
          include: { customer: true },
          orderBy: { paymentDate: "desc" },
        });

        const rows = payments.map((p) => ({
          paymentNumber: p.paymentNumber,
          paymentDate: p.paymentDate,
          customerName: `${p.customer.name} (${p.customer.code})`,
          paymentMode: p.paymentMode,
          referenceNumber: p.referenceNumber || "—",
          amount: Number(p.amount),
          allocatedAmount: Number(p.amount) - Number(p.unallocatedAmount),
          unallocatedAmount: Number(p.unallocatedAmount),
          status: p.status,
        }));

        const totalAmt = rows.reduce((s, r) => s + r.amount, 0);
        const columns: ExportColumn[] = [
          {
            key: "paymentNumber",
            header: "Payment #",
            type: "text",
            width: 88,
          },
          { key: "paymentDate", header: "Date", type: "date", width: 68 },
          { key: "customerName", header: "Customer", type: "text", width: 145 },
          { key: "paymentMode", header: "Mode", type: "text", width: 70 },
          {
            key: "referenceNumber",
            header: "Reference",
            type: "text",
            width: 90,
          },
          { key: "amount", header: "Amount", type: "currency", width: 85 },
          {
            key: "allocatedAmount",
            header: "Allocated",
            type: "currency",
            width: 82,
          },
          {
            key: "unallocatedAmount",
            header: "Unallocated",
            type: "currency",
            width: 82,
          },
          { key: "status", header: "Status", type: "text", width: 65 },
        ];
        const totalsRow = {
          paymentNumber: "Total",
          amount: totalAmt,
          allocatedAmount: rows.reduce((s, r) => s + r.allocatedAmount, 0),
          unallocatedAmount: rows.reduce((s, r) => s + r.unallocatedAmount, 0),
        };
        const meta: ExportDocumentMeta = {
          title: "Customer Payments",
          documentType: "Collections Register",
          periodLabel,
          scopeLabel,
          generatedAt: new Date(),
          organization: org,
          summaryItems: [
            { label: "Payments", value: String(rows.length) },
            {
              label: "Total Amount",
              value: formatExportCurrency(totalAmt, true),
              bold: true,
            },
          ],
        };
        return {
          content: await this.formatOutput(
            format,
            meta,
            "Payments",
            columns,
            rows,
            totalsRow,
          ),
          orgName: org.name,
        };
      }

      case "recipes": {
        const recipes = await prisma.recipe.findMany({
          where: {
            organizationId: org.id,
            ...(filters.ids?.length ? { id: { in: filters.ids } } : {}),
            ...(filters.q
              ? {
                  OR: [
                    { name: { contains: filters.q, mode: "insensitive" } },
                    {
                      productVariant: {
                        sku: { contains: filters.q, mode: "insensitive" },
                      },
                    },
                  ],
                }
              : {}),
          },
          include: {
            productVariant: true,
            outputUom: true,
            _count: { select: { items: true } },
          },
          orderBy: { name: "asc" },
        });

        const rows = recipes.map((r) => ({
          name: r.name,
          version: `v${r.version}`,
          productSku: r.productVariant.sku,
          productName: r.productVariant.name,
          standardBatchSize: Number(r.standardBatchSize),
          expectedOutputQty: Number(r.expectedOutputQty),
          outputUom: r.outputUom.code,
          ingredientCount: r._count.items,
          isActive: r.isActive,
        }));

        const columns: ExportColumn[] = [
          { key: "name", header: "Recipe Name", type: "text", width: 145 },
          { key: "version", header: "Version", type: "text", width: 55 },
          { key: "productSku", header: "Output SKU", type: "text", width: 85 },
          {
            key: "productName",
            header: "Output Product",
            type: "text",
            width: 135,
          },
          {
            key: "standardBatchSize",
            header: "Batch Size",
            type: "quantity",
            width: 72,
          },
          {
            key: "expectedOutputQty",
            header: "Expected Output",
            type: "quantity",
            width: 78,
          },
          { key: "outputUom", header: "UOM", type: "text", width: 50 },
          {
            key: "ingredientCount",
            header: "Ingredients",
            type: "number",
            width: 65,
          },
          { key: "isActive", header: "Active", type: "boolean", width: 52 },
        ];
        const meta: ExportDocumentMeta = {
          title: "Product Recipes",
          documentType: "Bill of Materials",
          scopeLabel,
          generatedAt: new Date(),
          organization: org,
          summaryItems: [{ label: "Recipes", value: String(rows.length) }],
        };
        return {
          content: await this.formatOutput(
            format,
            meta,
            "Recipes",
            columns,
            rows,
          ),
          orgName: org.name,
        };
      }

      case "suppliers": {
        const suppliers = await prisma.supplier.findMany({
          where: {
            organizationId: org.id,
            ...(filters.ids?.length ? { id: { in: filters.ids } } : {}),
          },
          orderBy: { name: "asc" },
        });

        const rows = suppliers.map((s) => ({
          code: s.code,
          name: s.name,
          state: s.state,
          gstin: s.gstin || "Unregistered",
          phone: s.phone || "",
          email: s.email || "",
          isActive: s.isActive,
        }));
        const columns: ExportColumn[] = [
          { key: "code", header: "Supplier Code", type: "text", width: 85 },
          { key: "name", header: "Supplier Name", type: "text", width: 150 },
          { key: "state", header: "State", type: "text", width: 90 },
          { key: "gstin", header: "GSTIN", type: "text", width: 100 },
          { key: "phone", header: "Phone", type: "text", width: 85 },
          { key: "email", header: "Email", type: "text", width: 120 },
          { key: "isActive", header: "Active", type: "boolean", width: 55 },
        ];
        const meta: ExportDocumentMeta = {
          title: "Supplier Directory",
          documentType: "Master Data",
          scopeLabel,
          generatedAt: new Date(),
          organization: org,
        };
        return {
          content: await this.formatOutput(
            format,
            meta,
            "Suppliers",
            columns,
            rows,
          ),
          orgName: org.name,
        };
      }

      default:
        throw new AppError(`Unsupported export entity: ${entity}`, 400);
    }
  }

  async generateOrderPdf(
    orderId: string,
    orgIdOrCode: string,
    user: UserContext,
  ) {
    const org = await this.resolveOrg(orgIdOrCode);
    const order = await prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        salesman: true,
        lines: { include: { productVariant: true } },
      },
    });
    if (!order || order.organizationId !== org.id) {
      throw new AppError("Sales order not found", 404);
    }
    if (user.role === "SALESMAN" && order.salesmanId !== user.id) {
      throw new AppError("Access denied to this sales order", 403);
    }
    await auditService.log({
      organizationId: org.id,
      userId: user.id,
      userEmail: user.email,
      action: "EXPORT",
      entity: "SALES_ORDER",
      entityId: order.id,
      details: { format: "PDF", orderNumber: order.orderNumber },
    });
    const buffer = await generateOrderPdfBuffer({
      ...order,
      organization: org,
    });
    return { buffer, orderNumber: order.orderNumber };
  }

  async generatePaymentPdf(
    paymentId: string,
    orgIdOrCode: string,
    user: UserContext,
  ) {
    const org = await this.resolveOrg(orgIdOrCode);
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        customer: true,
        allocations: { include: { salesInvoice: true } },
      },
    });
    if (!payment || payment.organizationId !== org.id) {
      throw new AppError("Payment not found", 404);
    }
    await auditService.log({
      organizationId: org.id,
      userId: user.id,
      userEmail: user.email,
      action: "EXPORT",
      entity: "PAYMENT",
      entityId: payment.id,
      details: { format: "PDF", paymentNumber: payment.paymentNumber },
    });
    const buffer = await generatePaymentReceiptPdfBuffer({
      ...payment,
      organization: org,
    });
    return { buffer, paymentNumber: payment.paymentNumber };
  }

  async generateCustomerStatementPdf(
    customerId: string,
    orgIdOrCode: string,
    user: UserContext,
  ) {
    const org = await this.resolveOrg(orgIdOrCode);
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        assignments: true,
        invoices: {
          where: { status: { not: "DRAFT" } },
          include: { creditNotes: true },
          orderBy: { postedAt: "asc" },
        },
        payments: {
          where: { status: "POSTED" },
          orderBy: { paymentDate: "asc" },
        },
      },
    });
    if (!customer || customer.organizationId !== org.id) {
      throw new AppError("Customer not found", 404);
    }
    if (
      user.role === "SALESMAN" &&
      !customer.assignments.some((a) => a.salesmanId === user.id)
    ) {
      throw new AppError("Access denied to this customer statement", 403);
    }

    type RawEntry = {
      date: Date;
      type: string;
      reference: string;
      debit: number;
      credit: number;
    };
    const rawEntries: RawEntry[] = [];
    let totalInvoiced = 0;
    let totalCreditNotes = 0;
    let totalPaid = 0;

    for (const inv of customer.invoices) {
      const amt = Number(inv.totalAmount);
      totalInvoiced += amt;
      rawEntries.push({
        date: inv.postedAt,
        type: "Sales Invoice",
        reference: inv.invoiceNumber,
        debit: amt,
        credit: 0,
      });
      for (const cn of inv.creditNotes) {
        const cnAmt = Number(cn.totalAmount);
        totalCreditNotes += cnAmt;
        rawEntries.push({
          date: cn.postedAt,
          type: "Credit Note",
          reference: cn.creditNoteNumber,
          debit: 0,
          credit: cnAmt,
        });
      }
    }
    for (const pay of customer.payments) {
      const pAmt = Number(pay.amount);
      totalPaid += pAmt;
      rawEntries.push({
        date: pay.paymentDate,
        type: `Payment (${pay.paymentMode})`,
        reference: pay.paymentNumber,
        debit: 0,
        credit: pAmt,
      });
    }

    rawEntries.sort((a, b) => a.date.getTime() - b.date.getTime());
    let runningBalance = 0;
    const entries = rawEntries.map((e) => {
      runningBalance =
        Math.round((runningBalance + e.debit - e.credit) * 100) / 100;
      return { ...e, balance: runningBalance };
    });

    await auditService.log({
      organizationId: org.id,
      userId: user.id,
      userEmail: user.email,
      action: "EXPORT",
      entity: "CUSTOMER_STATEMENT",
      entityId: customer.id,
      details: { format: "PDF", customerCode: customer.code },
    });

    const buffer = await generateCustomerStatementPdfBuffer({
      organization: org,
      customer,
      summary: {
        totalInvoiced,
        totalCreditNotes,
        totalPaid,
        netOutstanding:
          Math.round((totalInvoiced - totalCreditNotes - totalPaid) * 100) /
          100,
      },
      entries,
    });
    return { buffer, customerCode: customer.code };
  }

  async generateRecipePdf(
    recipeId: string,
    orgIdOrCode: string,
    user: UserContext,
  ) {
    const org = await this.resolveOrg(orgIdOrCode);
    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        productVariant: true,
        outputUom: true,
        items: {
          include: {
            inventoryItem: { include: { baseUom: true } },
          },
        },
      },
    });
    if (!recipe || recipe.organizationId !== org.id) {
      throw new AppError("Recipe not found", 404);
    }
    await auditService.log({
      organizationId: org.id,
      userId: user.id,
      userEmail: user.email,
      action: "EXPORT",
      entity: "RECIPE",
      entityId: recipe.id,
      details: {
        format: "PDF",
        recipeName: recipe.name,
        version: recipe.version,
      },
    });
    const buffer = await generateRecipeSheetPdfBuffer({
      ...recipe,
      organization: org,
    });
    return {
      buffer,
      recipeCode: `${recipe.productVariant.sku}_v${recipe.version}`,
    };
  }
}

export const exportService = new ExportService();
