import { prisma } from "../../db/client.js";
import { InvoiceStatus, type Prisma } from "@prisma/client";
import { AppError } from "../../middleware/error.middleware.js";
import { sequenceService } from "./sequence.service.js";

export interface CreateInvoiceInput {
  salesOrderId: string;
  notes?: string;
  dueDate?: Date;
  idempotencyKey?: string;
}

export interface IssueCreditNoteInput {
  reason: string;
  taxableAmount?: number;
  taxAmount?: number;
  totalAmount?: number;
}

export class FinanceService {
  /**
   * Helper to derive Indian financial year (e.g. 2025-26) from a date
   */
  getFinancialYear(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed: 0 = Jan, 3 = Apr
    if (month >= 3) {
      // April to Dec
      return `${year}-${(year + 1).toString().slice(-2)}`;
    } else {
      // Jan to Mar
      return `${year - 1}-${year.toString().slice(-2)}`;
    }
  }

  /**
   * Post an immutable sales invoice from an approved sales order
   */
  async createInvoiceFromOrder(input: CreateInvoiceInput) {
    return await prisma.$transaction(async (tx) => {
      // 1. Idempotency check
      if (input.idempotencyKey) {
        const existing = await tx.salesInvoice.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: {
            lines: true,
            customer: true,
            salesOrder: true,
          },
        });
        if (existing) {
          return existing;
        }
      }

      // 2. Fetch sales order
      const order = await tx.salesOrder.findUnique({
        where: { id: input.salesOrderId },
        include: {
          customer: true,
          lines: {
            include: {
              productVariant: {
                include: { product: true },
              },
            },
          },
        },
      });

      if (!order) {
        throw new AppError(`Order ${input.salesOrderId} not found`, 404);
      }

      if (order.status !== "APPROVED") {
        throw new AppError(
          `Cannot invoice order in status ${order.status}. Only APPROVED orders can be invoiced.`,
          400,
        );
      }

      const fy = this.getFinancialYear();
      const invoiceNumber = await sequenceService.getNextInvoiceNumber(
        tx,
        order.organizationId,
        fy,
      );

      // Place of supply tax calculation
      const isIntraState =
        order.deliveryState.trim().toLowerCase() === "tamil nadu";

      let taxableAmount = 0;
      let totalTaxAmount = 0;
      let cgstAmount = 0;
      let sgstAmount = 0;
      let igstAmount = 0;

      const preparedLines: Array<{
        salesOrderLineId: string;
        productVariantId: string;
        productNameSnapshot: string;
        hsnCodeSnapshot: string;
        quantity: number;
        unitPrice: number;
        taxRate: number;
        taxableAmount: number;
        cgstAmount: number;
        sgstAmount: number;
        igstAmount: number;
        taxAmount: number;
        lineTotal: number;
      }> = [];

      for (const line of order.lines) {
        const qty = Number(line.approvedQuantity);
        const price = Number(line.approvedUnitPrice);
        const taxRate = Number(line.taxRate);

        const lineTaxable = qty * price;
        const lineTax = (lineTaxable * taxRate) / 100;
        const lineTotal = lineTaxable + lineTax;

        let lineCgst = 0;
        let lineSgst = 0;
        let lineIgst = 0;

        if (isIntraState) {
          lineCgst = lineTax / 2;
          lineSgst = lineTax / 2;
          cgstAmount += lineCgst;
          sgstAmount += lineSgst;
        } else {
          lineIgst = lineTax;
          igstAmount += lineIgst;
        }

        taxableAmount += lineTaxable;
        totalTaxAmount += lineTax;

        preparedLines.push({
          salesOrderLineId: line.id,
          productVariantId: line.productVariantId,
          productNameSnapshot: line.productVariant.name,
          hsnCodeSnapshot: line.productVariant.product.hsnCode || "21069099",
          quantity: qty,
          unitPrice: price,
          taxRate,
          taxableAmount: lineTaxable,
          cgstAmount: lineCgst,
          sgstAmount: lineSgst,
          igstAmount: lineIgst,
          taxAmount: lineTax,
          lineTotal,
        });
      }

      const totalAmount = taxableAmount + totalTaxAmount;

      // Create immutable posted invoice
      const invoice = await tx.salesInvoice.create({
        data: {
          organizationId: order.organizationId,
          invoiceNumber,
          financialYear: fy,
          salesOrderId: order.id,
          customerId: order.customerId,
          customerNameSnapshot: order.customer.name,
          customerGstinSnapshot: order.customer.gstin,
          customerAddressSnapshot: order.customer.state,
          deliveryStateSnapshot: order.deliveryState,
          companyGstinSnapshot: "33AAAAA0000A1Z5", // Factory GSTIN
          status: InvoiceStatus.POSTED,
          taxableAmount,
          cgstAmount,
          sgstAmount,
          igstAmount,
          totalTaxAmount,
          totalAmount,
          paidAmount: 0,
          outstandingAmount: totalAmount,
          notes: input.notes,
          idempotencyKey: input.idempotencyKey,
          dueDate: input.dueDate,
          postedAt: new Date(),
        },
      });

      for (const pl of preparedLines) {
        await tx.salesInvoiceLine.create({
          data: {
            invoiceId: invoice.id,
            salesOrderLineId: pl.salesOrderLineId,
            productVariantId: pl.productVariantId,
            productNameSnapshot: pl.productNameSnapshot,
            hsnCodeSnapshot: pl.hsnCodeSnapshot,
            quantity: pl.quantity,
            unitPrice: pl.unitPrice,
            taxRate: pl.taxRate,
            taxableAmount: pl.taxableAmount,
            cgstAmount: pl.cgstAmount,
            sgstAmount: pl.sgstAmount,
            igstAmount: pl.igstAmount,
            taxAmount: pl.taxAmount,
            lineTotal: pl.lineTotal,
          },
        });
      }

      return await tx.salesInvoice.findUnique({
        where: { id: invoice.id },
        include: {
          lines: true,
          customer: true,
          salesOrder: true,
        },
      });
    });
  }

  /**
   * Issue a credit note against a posted sales invoice
   */
  async issueCreditNote(invoiceId: string, input: IssueCreditNoteInput) {
    if (!input.reason) {
      throw new AppError("Credit note reason is required", 400);
    }

    return await prisma.$transaction(async (tx) => {
      const invoice = await tx.salesInvoice.findUnique({
        where: { id: invoiceId },
      });

      if (!invoice) {
        throw new AppError(`Invoice ${invoiceId} not found`, 404);
      }

      const totalAmount =
        input.totalAmount ?? Number(invoice.outstandingAmount);
      const taxableAmount = input.taxableAmount ?? totalAmount / 1.05;
      const taxAmount = input.taxAmount ?? totalAmount - taxableAmount;

      const count = await tx.creditNote.count({
        where: { organizationId: invoice.organizationId },
      });
      const creditNoteNumber = `CN-${new Date().getFullYear()}-${(count + 1).toString().padStart(4, "0")}`;

      const creditNote = await tx.creditNote.create({
        data: {
          organizationId: invoice.organizationId,
          creditNoteNumber,
          salesInvoiceId: invoice.id,
          reason: input.reason,
          taxableAmount,
          taxAmount,
          totalAmount,
          postedAt: new Date(),
        },
      });

      // Update invoice outstanding amount
      const newOutstanding = Math.max(
        0,
        Number(invoice.outstandingAmount) - totalAmount,
      );
      const newStatus =
        newOutstanding === 0
          ? InvoiceStatus.CANCELLED_BY_CREDIT_NOTE
          : invoice.status;

      await tx.salesInvoice.update({
        where: { id: invoice.id },
        data: {
          outstandingAmount: newOutstanding,
          status: newStatus,
        },
      });

      return creditNote;
    });
  }

  /**
   * List invoices for an organization
   */
  async getInvoices(organizationId: string, customerId?: string) {
    const where: Prisma.SalesInvoiceWhereInput = {
      organizationId,
    };
    if (customerId) {
      where.customerId = customerId;
    }

    return await prisma.salesInvoice.findMany({
      where,
      include: {
        customer: true,
        lines: true,
        dispatches: true,
        creditNotes: true,
      },
      orderBy: { postedAt: "desc" },
    });
  }

  /**
   * Get single invoice by ID
   */
  async getInvoiceById(invoiceId: string) {
    const invoice = await prisma.salesInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
        lines: true,
        salesOrder: {
          include: {
            salesman: true,
          },
        },
        dispatches: true,
        creditNotes: true,
      },
    });

    if (!invoice) {
      throw new AppError(`Invoice ${invoiceId} not found`, 404);
    }

    return invoice;
  }
}

export const financeService = new FinanceService();
