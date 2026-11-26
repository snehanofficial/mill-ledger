import { prisma } from "../../db/client.js";
import { InvoiceStatus, type Prisma } from "@prisma/client";
import { AppError } from "../../middleware/error.middleware.js";
import { sequenceService } from "./sequence.service.js";
import { calculateLineTax } from "./tax.util.js";
import type { UserContext } from "@mill-ledger/shared";
import { auditService } from "../reporting/audit.service.js";

export interface CreateInvoiceInput {
  salesOrderId: string;
  notes?: string;
  dueDate?: Date;
  invoiceDate?: Date;
  idempotencyKey?: string;
}

export interface IssueCreditNoteInput {
  reason: string;
  taxableAmount?: number;
  taxAmount?: number;
  totalAmount?: number;
}

export interface IssueDebitNoteLineInput {
  inventoryItemId?: string;
  description?: string;
  quantity?: number;
  uomId?: string;
  unitPrice?: number;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
}

export interface IssueDebitNoteInput {
  organizationId?: string;
  supplierId: string;
  purchaseReceiptId?: string;
  reason: string;
  lines?: IssueDebitNoteLineInput[];
  taxableAmount?: number;
  taxAmount?: number;
  totalAmount?: number;
}

export class FinanceService {
  /**
   * Resolve an organization ID from either its primary key or organization code (e.g. "MILL")
   */
  private async resolveOrgId(orgIdOrCode: string): Promise<string> {
    const org = await prisma.organization.findFirst({
      where: {
        OR: [{ id: orgIdOrCode }, { code: orgIdOrCode }],
      },
    });
    return org ? org.id : orgIdOrCode;
  }

  /**
   * Helper to derive Indian financial year (e.g. 2025-26) from a date, strictly in IST (Asia/Kolkata)
   */
  getFinancialYear(date: Date = new Date()): string {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
    });
    const parts = formatter.formatToParts(date);
    const year = parseInt(parts.find((p) => p.type === "year")!.value, 10);
    const month = parseInt(parts.find((p) => p.type === "month")!.value, 10); // 1-indexed: 4 = April
    if (month >= 4) {
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
  async createInvoiceFromOrder(input: CreateInvoiceInput, user?: UserContext) {
    try {
      const result = await prisma.$transaction(async (tx) => {
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

        if (!order.lines || order.lines.length === 0) {
          throw new AppError(
            `Cannot invoice order ${order.orderNumber} with zero line items`,
            400,
          );
        }

        const invoiceDate = input.invoiceDate ?? new Date();
        const fy = this.getFinancialYear(invoiceDate);
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
          const hsnCode = line.productVariant.product.hsnCode;
          if (!hsnCode) {
            throw new AppError(
              `TAX_CONFIGURATION_ERROR: Product ${line.productVariant.product.name} is missing an HSN code`,
              422,
            );
          }

          const taxRateRecord = await tx.taxRate.findFirst({
            where: {
              organizationId: order.organizationId,
              hsnCode,
              effectiveFrom: { lte: invoiceDate },
              OR: [
                { effectiveTo: null },
                { effectiveTo: { gte: invoiceDate } },
              ],
            },
            orderBy: {
              effectiveFrom: "desc",
            },
          });

          if (!taxRateRecord) {
            throw new AppError(
              `TAX_CONFIGURATION_ERROR: No active statutory GST rate found for HSN ${hsnCode}`,
              422,
            );
          }

          const lineTaxRate = Number(taxRateRecord.rate);

          const taxRes = calculateLineTax(
            {
              quantity: line.approvedQuantity.toString(),
              unitPrice: line.approvedUnitPrice.toString(),
              taxRate: lineTaxRate,
            },
            isIntraState,
          );

          const lineQty = taxRes.quantity.toNumber();
          const linePrice = taxRes.unitPrice.toNumber();
          const lineTaxable = taxRes.taxableAmount.toNumber();
          const lineCgst = taxRes.cgstAmount.toNumber();
          const lineSgst = taxRes.sgstAmount.toNumber();
          const lineIgst = taxRes.igstAmount.toNumber();
          const lineTax = taxRes.taxAmount.toNumber();
          const lineTotal = taxRes.lineTotal.toNumber();

          cgstAmount = Number((cgstAmount + lineCgst).toFixed(2));
          sgstAmount = Number((sgstAmount + lineSgst).toFixed(2));
          igstAmount = Number((igstAmount + lineIgst).toFixed(2));
          taxableAmount = Number((taxableAmount + lineTaxable).toFixed(2));
          totalTaxAmount = Number((totalTaxAmount + lineTax).toFixed(2));

          preparedLines.push({
            salesOrderLineId: line.id,
            productVariantId: line.productVariantId,
            productNameSnapshot: line.productVariant.name,
            hsnCodeSnapshot: hsnCode,
            quantity: lineQty,
            unitPrice: linePrice,
            taxRate: lineTaxRate,
            taxableAmount: lineTaxable,
            cgstAmount: lineCgst,
            sgstAmount: lineSgst,
            igstAmount: lineIgst,
            taxAmount: lineTax,
            lineTotal: lineTotal,
          });
        }

        const totalAmount = Number((taxableAmount + totalTaxAmount).toFixed(2));

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
            postedAt: invoiceDate,
            dueDate: input.dueDate,
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

      if (result) {
        await auditService.log({
          organizationId: result.organizationId,
          userId: user?.id,
          userEmail: user?.email,
          action: "POST",
          entity: "SalesInvoice",
          entityId: result.id,
          details: {
            invoiceNumber: result.invoiceNumber,
            salesOrderId: result.salesOrderId,
            customerId: result.customerId,
            totalAmount: result.totalAmount,
          },
        });
      }

      return result;
    } catch (err: unknown) {
      if (
        input.idempotencyKey &&
        typeof err === "object" &&
        err !== null &&
        (err as { code?: string }).code === "P2002"
      ) {
        const existing = await prisma.salesInvoice.findUnique({
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
      throw err;
    }
  }

  /**
   * Issue a credit note against a posted sales invoice
   */
  async issueCreditNote(
    invoiceId: string,
    input: IssueCreditNoteInput,
    user?: UserContext,
  ) {
    if (!input.reason) {
      throw new AppError("Credit note reason is required", 400);
    }

    const creditNote = await prisma.$transaction(async (tx) => {
      const invoice = await tx.salesInvoice.findUnique({
        where: { id: invoiceId },
      });

      if (!invoice) {
        throw new AppError(`Invoice ${invoiceId} not found`, 404);
      }

      const totalAmount = Number(
        (input.totalAmount ?? Number(invoice.outstandingAmount)).toFixed(2),
      );
      const taxableAmount = Number(
        (input.taxableAmount ?? totalAmount / 1.05).toFixed(2),
      );
      const taxAmount = Number(
        (input.taxAmount ?? totalAmount - taxableAmount).toFixed(2),
      );

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
        Number((Number(invoice.outstandingAmount) - totalAmount).toFixed(2)),
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

    if (creditNote) {
      await auditService.log({
        organizationId: creditNote.organizationId,
        userId: user?.id,
        userEmail: user?.email,
        action: "CREATE",
        entity: "CreditNote",
        entityId: creditNote.id,
        reason: input.reason,
        details: {
          creditNoteNumber: creditNote.creditNoteNumber,
          salesInvoiceId: creditNote.salesInvoiceId,
          totalAmount: creditNote.totalAmount,
        },
      });
    }

    return creditNote;
  }

  /**
   * List invoices for an organization (paginated - F-074)
   */
  async getInvoices(
    organizationId: string,
    customerId?: string,
    options?: { limit?: number; offset?: number },
  ) {
    const orgId = await this.resolveOrgId(organizationId);
    const where: Prisma.SalesInvoiceWhereInput = {
      organizationId: orgId,
    };
    if (customerId) {
      where.customerId = customerId;
    }

    const limit =
      options?.limit !== undefined
        ? Math.min(Math.max(Number(options.limit) || 50, 1), 100)
        : 50;
    const offset =
      options?.offset !== undefined
        ? Math.max(Number(options.offset) || 0, 0)
        : undefined;

    return await prisma.salesInvoice.findMany({
      where,
      include: {
        customer: true,
        lines: true,
        dispatches: true,
        creditNotes: true,
      },
      orderBy: { postedAt: "desc" },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Get single invoice by ID
   */
  async getInvoiceById(invoiceId: string) {
    const invoice = await prisma.salesInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        organization: true,
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

  /**
   * Issue an immutable debit note against a supplier (e.g. purchase returns, damage deductions)
   */
  async issueDebitNote(input: IssueDebitNoteInput, user?: UserContext) {
    if (!input.supplierId) {
      throw new AppError("Supplier ID is required", 400);
    }
    if (!input.reason || input.reason.trim() === "") {
      throw new AppError("Debit note reason is required", 400);
    }

    return await prisma.$transaction(async (tx) => {
      const supplier = await tx.supplier.findUnique({
        where: { id: input.supplierId },
      });
      if (!supplier) {
        throw new AppError(`Supplier ${input.supplierId} not found`, 404);
      }

      const organizationId = input.organizationId
        ? await this.resolveOrgId(input.organizationId)
        : supplier.organizationId;

      if (input.purchaseReceiptId) {
        const receipt = await tx.purchaseReceipt.findUnique({
          where: { id: input.purchaseReceiptId },
        });
        if (!receipt) {
          throw new AppError(
            `Purchase receipt ${input.purchaseReceiptId} not found`,
            404,
          );
        }
      }

      // Compute total amounts from lines or inputs
      let taxableAmount = 0;
      let taxAmount = 0;
      let totalAmount = 0;

      if (input.lines && input.lines.length > 0) {
        for (const line of input.lines) {
          taxableAmount += Number(line.taxableAmount);
          taxAmount += Number(line.taxAmount);
          totalAmount += Number(line.totalAmount);
        }
      } else {
        totalAmount = Number(input.totalAmount ?? 0);
        taxableAmount = Number(input.taxableAmount ?? totalAmount / 1.05);
        taxAmount = Number(input.taxAmount ?? totalAmount - taxableAmount);
      }

      taxableAmount = Number(taxableAmount.toFixed(2));
      taxAmount = Number(taxAmount.toFixed(2));
      totalAmount = Number(totalAmount.toFixed(2));

      if (totalAmount <= 0) {
        throw new AppError(
          "Debit note total amount must be greater than zero",
          400,
        );
      }

      const count = await tx.debitNote.count({
        where: { organizationId },
      });
      const currentYear = new Date().getFullYear();
      const debitNoteNumber = `DN-${currentYear}-${(count + 1).toString().padStart(4, "0")}`;

      const debitNote = await tx.debitNote.create({
        data: {
          organizationId,
          debitNoteNumber,
          supplierId: input.supplierId,
          purchaseReceiptId: input.purchaseReceiptId,
          reason: input.reason,
          status: "POSTED",
          taxableAmount,
          taxAmount,
          totalAmount,
          postedAt: new Date(),
          lines:
            input.lines && input.lines.length > 0
              ? {
                  create: input.lines.map((l) => ({
                    inventoryItemId: l.inventoryItemId,
                    description: l.description,
                    quantity: l.quantity,
                    uomId: l.uomId,
                    unitPrice: l.unitPrice,
                    taxableAmount: Number(l.taxableAmount.toFixed(2)),
                    taxAmount: Number(l.taxAmount.toFixed(2)),
                    totalAmount: Number(l.totalAmount.toFixed(2)),
                  })),
                }
              : undefined,
        },
        include: {
          supplier: true,
          purchaseReceipt: true,
          lines: true,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          userId: user?.id,
          userEmail: user?.email,
          action: "DEBIT_NOTE_ISSUED",
          entity: "debit_note",
          entityId: debitNote.id,
          reason: input.reason,
          details: JSON.stringify({
            debitNoteNumber,
            supplierId: input.supplierId,
            totalAmount,
          }),
        },
      });

      return debitNote;
    });
  }

  /**
   * Get debit notes for an organization
   */
  async getDebitNotes(organizationId: string, supplierId?: string) {
    const orgId = await this.resolveOrgId(organizationId);

    return await prisma.debitNote.findMany({
      where: {
        organizationId: orgId,
        ...(supplierId ? { supplierId } : {}),
      },
      include: {
        supplier: true,
        purchaseReceipt: true,
        lines: true,
      },
      orderBy: { postedAt: "desc" },
    });
  }

  /**
   * List statutory tax rates for an organization, optionally filtered by HSN
   */
  async getTaxRates(organizationId: string, hsnCode?: string) {
    const orgId = await this.resolveOrgId(organizationId);

    return await prisma.taxRate.findMany({
      where: {
        organizationId: orgId,
        ...(hsnCode ? { hsnCode } : {}),
      },
      orderBy: [{ hsnCode: "asc" }, { effectiveFrom: "desc" }],
    });
  }

  /**
   * Set or update a statutory tax rate schedule with overlap prevention
   */
  async setTaxRate(
    organizationId: string,
    input: {
      hsnCode: string;
      rate: number;
      cgstRate?: number;
      sgstRate?: number;
      igstRate?: number;
      effectiveFrom: Date;
      effectiveTo?: Date | null;
    },
  ) {
    const orgId = await this.resolveOrgId(organizationId);

    return await prisma.$transaction(async (tx) => {
      const hsnCode = input.hsnCode.trim();
      const rate = input.rate;
      const effectiveFrom = new Date(input.effectiveFrom);
      const effectiveTo = input.effectiveTo
        ? new Date(input.effectiveTo)
        : null;

      if (effectiveTo && effectiveTo <= effectiveFrom) {
        throw new AppError(
          "effectiveTo must be strictly after effectiveFrom",
          400,
        );
      }

      const igstRate = input.igstRate !== undefined ? input.igstRate : rate;
      const cgstRate = input.cgstRate !== undefined ? input.cgstRate : rate / 2;
      const sgstRate = input.sgstRate !== undefined ? input.sgstRate : rate / 2;

      // Check existing rates for overlap
      const existing = await tx.taxRate.findMany({
        where: {
          organizationId: orgId,
          hsnCode,
        },
      });

      for (const rec of existing) {
        const recFrom = new Date(rec.effectiveFrom);
        const recTo = rec.effectiveTo ? new Date(rec.effectiveTo) : null;

        // If exact same effectiveFrom, update it
        if (recFrom.getTime() === effectiveFrom.getTime()) {
          continue;
        }

        // If existing record is open-ended and started before new effectiveFrom, auto-close it
        if (!recTo && recFrom < effectiveFrom) {
          await tx.taxRate.update({
            where: { id: rec.id },
            data: { effectiveTo: effectiveFrom },
          });
          continue;
        }

        // Check for general overlap:
        const overlaps =
          (!recTo || recTo > effectiveFrom) &&
          (!effectiveTo || recFrom < effectiveTo);

        if (overlaps) {
          throw new AppError(
            `TAX_CONFIGURATION_ERROR: Overlapping tax rate schedule detected for HSN ${hsnCode}`,
            422,
          );
        }
      }

      return await tx.taxRate.upsert({
        where: {
          organizationId_hsnCode_effectiveFrom: {
            organizationId: orgId,
            hsnCode,
            effectiveFrom,
          },
        },
        update: {
          rate,
          cgstRate,
          sgstRate,
          igstRate,
          effectiveTo,
        },
        create: {
          organizationId: orgId,
          hsnCode,
          rate,
          cgstRate,
          sgstRate,
          igstRate,
          effectiveFrom,
          effectiveTo,
        },
      });
    });
  }
}

export const financeService = new FinanceService();
