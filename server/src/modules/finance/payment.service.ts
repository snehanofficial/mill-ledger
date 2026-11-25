import { prisma } from "../../db/client.js";
import {
  Prisma,
  InvoiceStatus,
  PaymentMode,
  PaymentStatus,
} from "@prisma/client";
import { AppError } from "../../middleware/error.middleware.js";
import type { UserContext } from "@mill-ledger/shared";
import { sequenceService } from "./sequence.service.js";
import { auditService } from "../reporting/audit.service.js";

export interface PaymentAllocationInput {
  salesInvoiceId: string;
  amount: number;
}

export interface BouncePaymentInput {
  reason: string;
  referenceNumber?: string;
  bouncedAt?: Date;
  idempotencyKey?: string;
}

export interface RecordPaymentInput {
  organizationId?: string;
  customerId: string;
  amount: number;
  paymentMode?: PaymentMode;
  referenceNumber?: string;
  paymentDate?: Date;
  notes?: string;
  idempotencyKey?: string;
  allocations?: PaymentAllocationInput[];
}

export class PaymentService {
  /**
   * Record a customer payment receipt and allocate to invoices
   */
  async recordPayment(input: RecordPaymentInput, user?: UserContext) {
    if (!input.customerId) {
      throw new AppError("Customer ID is required", 400);
    }
    if (!input.amount || input.amount <= 0) {
      throw new AppError("Payment amount must be greater than zero", 400);
    }

    try {
      const payment = await prisma.$transaction(async (tx) => {
        // 1. Idempotency check
        if (input.idempotencyKey) {
          const existing = await tx.payment.findUnique({
            where: { idempotencyKey: input.idempotencyKey },
            include: {
              customer: true,
              allocations: {
                include: { salesInvoice: true },
              },
            },
          });
          if (existing) {
            return existing;
          }
        }

        // 2. Validate customer
        const customer = await tx.customer.findUnique({
          where: { id: input.customerId },
        });
        if (!customer) {
          throw new AppError(`Customer ${input.customerId} not found`, 404);
        }

        const organizationId = customer.organizationId;

        // 3. Generate receipt number: REC-YYYY-0001 via atomic sequence
        const paymentNumber = await sequenceService.getNextPaymentNumber(
          tx,
          organizationId,
        );

        const paymentAmount = new Prisma.Decimal(input.amount.toString()).toDecimalPlaces(
          2,
          Prisma.Decimal.ROUND_HALF_UP,
        );

        const allocationsToCreate: Array<{
          salesInvoiceId: string;
          amount: Prisma.Decimal;
        }> = [];
        let unallocated = paymentAmount;

        // 4. Handle allocations
        if (input.allocations && input.allocations.length > 0) {
          let totalAllocated = new Prisma.Decimal(0);
          for (const a of input.allocations) {
            totalAllocated = totalAllocated.plus(
              new Prisma.Decimal(a.amount.toString()).toDecimalPlaces(
                2,
                Prisma.Decimal.ROUND_HALF_UP,
              ),
            );
          }

          if (totalAllocated.greaterThan(paymentAmount)) {
            throw new AppError(
              `Total allocated amount (₹${totalAllocated.toFixed(2)}) cannot exceed total payment amount (₹${paymentAmount.toFixed(2)})`,
              400,
            );
          }

          for (const alloc of input.allocations) {
            const allocAmount = new Prisma.Decimal(
              alloc.amount.toString(),
            ).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
            if (allocAmount.lessThanOrEqualTo(0)) {
              throw new AppError(
                "Allocation amount must be greater than zero",
                400,
              );
            }

            const invoice = await tx.salesInvoice.findUnique({
              where: { id: alloc.salesInvoiceId },
            });

            if (!invoice) {
              throw new AppError(
                `Invoice ${alloc.salesInvoiceId} not found`,
                404,
              );
            }
            if (invoice.customerId !== input.customerId) {
              throw new AppError(
                `Invoice ${invoice.invoiceNumber} does not belong to customer ${customer.name}`,
                400,
              );
            }
            if (
              invoice.status !== InvoiceStatus.POSTED &&
              invoice.status !== InvoiceStatus.PARTIALLY_PAID
            ) {
              throw new AppError(
                `Cannot allocate payment to invoice ${invoice.invoiceNumber} in status ${invoice.status}`,
                400,
              );
            }

            const outstanding = new Prisma.Decimal(
              invoice.outstandingAmount,
            ).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
            if (allocAmount.greaterThan(outstanding)) {
              throw new AppError(
                `Allocation of ₹${allocAmount.toFixed(2)} exceeds invoice ${invoice.invoiceNumber} outstanding balance of ₹${outstanding.toFixed(2)}`,
                400,
              );
            }

            const newPaid = new Prisma.Decimal(invoice.paidAmount)
              .plus(allocAmount)
              .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
            const newOutstanding = Prisma.Decimal.max(
              new Prisma.Decimal(0),
              outstanding.minus(allocAmount).toDecimalPlaces(
                2,
                Prisma.Decimal.ROUND_HALF_UP,
              ),
            );
            const newStatus = newOutstanding.lessThanOrEqualTo(0)
              ? InvoiceStatus.PAID
              : InvoiceStatus.PARTIALLY_PAID;

            await tx.salesInvoice.update({
              where: { id: invoice.id },
              data: {
                paidAmount: newPaid,
                outstandingAmount: newOutstanding,
                status: newStatus,
              },
            });

            allocationsToCreate.push({
              salesInvoiceId: invoice.id,
              amount: allocAmount,
            });
          }

          unallocated = Prisma.Decimal.max(
            new Prisma.Decimal(0),
            paymentAmount.minus(totalAllocated).toDecimalPlaces(
              2,
              Prisma.Decimal.ROUND_HALF_UP,
            ),
          );
        } else {
          // Auto allocate FIFO against customer open invoices
          const openInvoices = await tx.salesInvoice.findMany({
            where: {
              organizationId,
              customerId: input.customerId,
              status: {
                in: [InvoiceStatus.POSTED, InvoiceStatus.PARTIALLY_PAID],
              },
              outstandingAmount: { gt: 0 },
            },
            orderBy: { postedAt: "asc" },
          });

          let remaining = paymentAmount;
          for (const inv of openInvoices) {
            if (remaining.lessThanOrEqualTo(0)) break;
            const invOutstanding = new Prisma.Decimal(
              inv.outstandingAmount,
            ).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
            const allocAmt = Prisma.Decimal.min(remaining, invOutstanding);

            const newPaid = new Prisma.Decimal(inv.paidAmount)
              .plus(allocAmt)
              .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
            const newOutstanding = Prisma.Decimal.max(
              new Prisma.Decimal(0),
              invOutstanding.minus(allocAmt).toDecimalPlaces(
                2,
                Prisma.Decimal.ROUND_HALF_UP,
              ),
            );
            const newStatus = newOutstanding.lessThanOrEqualTo(0)
              ? InvoiceStatus.PAID
              : InvoiceStatus.PARTIALLY_PAID;

            await tx.salesInvoice.update({
              where: { id: inv.id },
              data: {
                paidAmount: newPaid,
                outstandingAmount: newOutstanding,
                status: newStatus,
              },
            });

            allocationsToCreate.push({
              salesInvoiceId: inv.id,
              amount: allocAmt,
            });

            remaining = remaining.minus(allocAmt).toDecimalPlaces(
              2,
              Prisma.Decimal.ROUND_HALF_UP,
            );
          }

          unallocated = Prisma.Decimal.max(new Prisma.Decimal(0), remaining);
        }

        // 5. Create Payment record
        const payment = await tx.payment.create({
          data: {
            organizationId,
            paymentNumber,
            customerId: input.customerId,
            amount: paymentAmount,
            unallocatedAmount: unallocated,
            paymentMode: input.paymentMode || PaymentMode.BANK_TRANSFER,
            referenceNumber: input.referenceNumber,
            paymentDate: input.paymentDate || new Date(),
            status: PaymentStatus.POSTED,
            notes: input.notes,
            idempotencyKey: input.idempotencyKey,
            allocations: {
              create: allocationsToCreate.map((a) => ({
                salesInvoiceId: a.salesInvoiceId,
                amount: a.amount,
              })),
            },
          },
          include: {
            customer: true,
            allocations: {
              include: { salesInvoice: true },
            },
          },
        });

        return payment;
      });

      if (payment) {
        await auditService.log({
          organizationId: payment.organizationId,
          userId: user?.id,
          userEmail: user?.email,
          action: "CREATE",
          entity: "Payment",
          entityId: payment.id,
          details: {
            paymentNumber: payment.paymentNumber,
            customerId: payment.customerId,
            amount: payment.amount,
            unallocatedAmount: payment.unallocatedAmount,
            paymentMode: payment.paymentMode,
          },
        });
      }

      return payment;
    } catch (err: unknown) {
      if (
        input.idempotencyKey &&
        typeof err === "object" &&
        err !== null &&
        (err as { code?: string }).code === "P2002"
      ) {
        const existing = await prisma.payment.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: {
            customer: true,
            allocations: {
              include: { salesInvoice: true },
            },
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
   * Atomically reverse a customer payment (e.g. cheque bounce or chargeback),
   * mark payment as BOUNCED or REVERSED, audit reverse reason and timestamp,
   * and restore outstanding balances on all allocated invoices.
   */
  async processPaymentReversal(
    paymentId: string,
    input: BouncePaymentInput,
    targetStatus: PaymentStatus = PaymentStatus.BOUNCED,
    user?: UserContext,
  ) {
    if (!input.reason || input.reason.trim() === "") {
      throw new AppError("Reversal reason is required", 400);
    }

    return await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: {
          customer: true,
          allocations: {
            include: { salesInvoice: true },
          },
        },
      });

      if (!payment) {
        throw new AppError(`Payment ${paymentId} not found`, 404);
      }

      // Idempotency check: if already bounced/reversed
      if (
        payment.status === PaymentStatus.BOUNCED ||
        payment.status === PaymentStatus.REVERSED
      ) {
        if (
          input.idempotencyKey &&
          payment.reversalReference === input.idempotencyKey
        ) {
          return payment;
        }
        throw new AppError(
          `Payment ${payment.paymentNumber} has already been ${payment.status.toLowerCase()}`,
          400,
        );
      }

      if (payment.status !== PaymentStatus.POSTED) {
        throw new AppError(
          `Cannot reverse payment in status ${payment.status}`,
          400,
        );
      }

      const reversalDate = input.bouncedAt || new Date();

      // Reverse each active allocation and restore invoice outstanding balance
      for (const alloc of payment.allocations) {
        if (alloc.isReversed) {
          continue;
        }

        const invoice = await tx.salesInvoice.findUnique({
          where: { id: alloc.salesInvoiceId },
        });

        if (invoice) {
          const allocAmount = new Prisma.Decimal(alloc.amount);
          const currentPaid = new Prisma.Decimal(invoice.paidAmount);
          const currentOutstanding = new Prisma.Decimal(
            invoice.outstandingAmount,
          );

          const newPaid = Prisma.Decimal.max(0, currentPaid.minus(allocAmount));
          const newOutstanding = currentOutstanding.plus(allocAmount);
          const newStatus = newPaid.lessThanOrEqualTo(0.001)
            ? InvoiceStatus.POSTED
            : newOutstanding.greaterThan(0.001)
              ? InvoiceStatus.PARTIALLY_PAID
              : InvoiceStatus.PAID;

          await tx.salesInvoice.update({
            where: { id: invoice.id },
            data: {
              paidAmount: newPaid,
              outstandingAmount: newOutstanding,
              status: newStatus,
            },
          });
        }

        await tx.paymentAllocation.update({
          where: { id: alloc.id },
          data: {
            isReversed: true,
            reversedAt: reversalDate,
          },
        });
      }

      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: targetStatus,
          reversalReason: input.reason,
          reversalReference: input.referenceNumber || input.idempotencyKey,
          reversedAt: reversalDate,
        },
        include: {
          customer: true,
          allocations: {
            include: { salesInvoice: true },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: payment.organizationId,
          userId: user?.id,
          userEmail: user?.email,
          action:
            targetStatus === PaymentStatus.BOUNCED
              ? "PAYMENT_BOUNCED"
              : "PAYMENT_REVERSED",
          entity: "payment",
          entityId: payment.id,
          reason: input.reason,
          details: JSON.stringify({
            paymentNumber: payment.paymentNumber,
            amount: Number(payment.amount),
            reversalReference: input.referenceNumber || input.idempotencyKey,
            reversedAt: reversalDate.toISOString(),
          }),
        },
      });

      return updatedPayment;
    });
  }

  /**
   * Mark a payment as bounced (e.g. cheque/NACH dishonour) and restore invoice balances
   */
  async bouncePayment(
    paymentId: string,
    input: BouncePaymentInput,
    user?: UserContext,
  ) {
    return await this.processPaymentReversal(
      paymentId,
      input,
      PaymentStatus.BOUNCED,
      user,
    );
  }

  /**
   * Reverse an online or electronic payment (e.g. chargeback or erroneous entry)
   */
  async reversePayment(
    paymentId: string,
    input: BouncePaymentInput,
    user?: UserContext,
  ) {
    return await this.processPaymentReversal(
      paymentId,
      input,
      PaymentStatus.REVERSED,
      user,
    );
  }

  /**
   * Helper to resolve organization id from id or code
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
   * List payments with customer and allocations (paginated - F-074)
   */
  async getPayments(
    organizationId: string,
    customerId?: string,
    options?: { limit?: number; offset?: number },
  ) {
    const orgId = await this.resolveOrgId(organizationId);
    const limit =
      options?.limit !== undefined
        ? Math.min(Math.max(Number(options.limit) || 50, 1), 100)
        : 50;
    const offset =
      options?.offset !== undefined
        ? Math.max(Number(options.offset) || 0, 0)
        : undefined;

    return await prisma.payment.findMany({
      where: {
        organizationId: orgId,
        ...(customerId ? { customerId } : {}),
      },
      include: {
        customer: true,
        allocations: {
          include: { salesInvoice: true },
        },
      },
      orderBy: { paymentDate: "desc" },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Get single payment by ID
   */
  async getPaymentById(id: string) {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        customer: true,
        allocations: {
          include: { salesInvoice: true },
        },
      },
    });

    if (!payment) {
      throw new AppError(`Payment ${id} not found`, 404);
    }
    return payment;
  }

  /**
   * Calculate customer outstanding ledger and ageing buckets
   */
  async getCustomerLedger(_organizationId: string, customerId: string) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer) {
      throw new AppError(`Customer ${customerId} not found`, 404);
    }

    const orgId = customer.organizationId;

    // 1. Invoices
    const invoices = await prisma.salesInvoice.findMany({
      where: {
        organizationId: orgId,
        customerId,
        status: { not: InvoiceStatus.DRAFT },
      },
      include: {
        creditNotes: true,
        paymentAllocations: true,
      },
      orderBy: { postedAt: "asc" },
    });

    // 2. Payments
    const payments = await prisma.payment.findMany({
      where: {
        organizationId: orgId,
        customerId,
        status: PaymentStatus.POSTED,
      },
      include: {
        allocations: true,
      },
      orderBy: { paymentDate: "asc" },
    });

    // 3. Build chronological entries
    interface LedgerEntry {
      date: Date;
      documentType: "INVOICE" | "CREDIT_NOTE" | "PAYMENT";
      documentNumber: string;
      referenceId: string;
      debit: number;
      credit: number;
      balance: number;
      notes?: string | null;
    }

    const rawEvents: Array<{
      date: Date;
      documentType: "INVOICE" | "CREDIT_NOTE" | "PAYMENT";
      documentNumber: string;
      referenceId: string;
      debit: number;
      credit: number;
      notes?: string | null;
    }> = [];

    let totalInvoiced = 0;
    let totalCreditNotes = 0;
    let totalPaid = 0;

    for (const inv of invoices) {
      const invTotal = Number(inv.totalAmount);
      totalInvoiced += invTotal;
      rawEvents.push({
        date: inv.postedAt,
        documentType: "INVOICE",
        documentNumber: inv.invoiceNumber,
        referenceId: inv.id,
        debit: invTotal,
        credit: 0,
        notes: inv.notes,
      });

      for (const cn of inv.creditNotes) {
        const cnTotal = Number(cn.totalAmount);
        totalCreditNotes += cnTotal;
        rawEvents.push({
          date: cn.postedAt,
          documentType: "CREDIT_NOTE",
          documentNumber: cn.creditNoteNumber,
          referenceId: cn.id,
          debit: 0,
          credit: cnTotal,
          notes: cn.reason,
        });
      }
    }

    for (const p of payments) {
      const pTotal = Number(p.amount);
      totalPaid += pTotal;
      rawEvents.push({
        date: p.paymentDate,
        documentType: "PAYMENT",
        documentNumber: p.paymentNumber,
        referenceId: p.id,
        debit: 0,
        credit: pTotal,
        notes: p.notes,
      });
    }

    // Sort chronologically
    rawEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate running balance
    let runningBalance = 0;
    const ledgerEntries: LedgerEntry[] = rawEvents.map((evt) => {
      runningBalance += evt.debit - evt.credit;
      return {
        ...evt,
        balance: runningBalance,
      };
    });

    const netOutstanding = totalInvoiced - totalCreditNotes - totalPaid;

    // Ageing analysis on open invoices
    const now = new Date().getTime();
    const ageing = {
      current0to30: 0,
      days31to60: 0,
      days61to90: 0,
      over90days: 0,
    };

    for (const inv of invoices) {
      const openAmount = Number(inv.outstandingAmount);
      if (openAmount > 0) {
        const ageDays = Math.floor(
          (now - new Date(inv.postedAt).getTime()) / (1000 * 60 * 60 * 24),
        );
        if (ageDays <= 30) {
          ageing.current0to30 += openAmount;
        } else if (ageDays <= 60) {
          ageing.days31to60 += openAmount;
        } else if (ageDays <= 90) {
          ageing.days61to90 += openAmount;
        } else {
          ageing.over90days += openAmount;
        }
      }
    }

    return {
      customer: {
        id: customer.id,
        code: customer.code,
        name: customer.name,
        state: customer.state,
        gstin: customer.gstin,
      },
      summary: {
        totalInvoiced,
        totalCreditNotes,
        totalPaid,
        netOutstanding,
        ageing,
      },
      ledgerEntries,
    };
  }

  /**
   * Receivables summary for all customers
   */
  async getReceivablesSummary(organizationId: string) {
    const orgId = await this.resolveOrgId(organizationId);
    const customers = await prisma.customer.findMany({
      where: { organizationId: orgId },
      include: {
        invoices: {
          where: { status: { not: InvoiceStatus.DRAFT } },
          include: {
            creditNotes: true,
          },
        },
        payments: {
          where: { status: PaymentStatus.POSTED },
        },
      },
    });

    return customers.map((c) => {
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

      const openInvoicesCount = c.invoices.filter(
        (inv) => Number(inv.outstandingAmount) > 0,
      ).length;

      return {
        customerId: c.id,
        customerCode: c.code,
        customerName: c.name,
        state: c.state,
        totalInvoiced,
        totalCreditNotes,
        totalPaid,
        netOutstanding: outstanding,
        openInvoicesCount,
      };
    });
  }

  /**
   * Allocate unallocated cash from an existing POSTED payment to open invoices (IMP-018)
   */
  async allocateUnallocatedPayment(
    paymentId: string,
    allocations: PaymentAllocationInput[],
    user?: UserContext,
  ) {
    if (!allocations || allocations.length === 0) {
      throw new AppError("At least one allocation is required", 400);
    }

    return await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { customer: true },
      });
      if (!payment) {
        throw new AppError(`Payment ${paymentId} not found`, 404);
      }
      if (payment.status !== PaymentStatus.POSTED) {
        throw new AppError(
          `Cannot allocate payment in status ${payment.status}`,
          400,
        );
      }

      const unallocated = new Prisma.Decimal(
        payment.unallocatedAmount,
      ).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

      let totalToAllocate = new Prisma.Decimal(0);
      for (const a of allocations) {
        const amt = new Prisma.Decimal(a.amount.toString()).toDecimalPlaces(
          2,
          Prisma.Decimal.ROUND_HALF_UP,
        );
        if (amt.lessThanOrEqualTo(0)) {
          throw new AppError("Allocation amount must be greater than zero", 400);
        }
        totalToAllocate = totalToAllocate.plus(amt);
      }

      if (totalToAllocate.greaterThan(unallocated)) {
        throw new AppError(
          `Total allocation (₹${totalToAllocate.toFixed(2)}) exceeds unallocated balance (₹${unallocated.toFixed(2)})`,
          400,
        );
      }

      for (const alloc of allocations) {
        const allocAmount = new Prisma.Decimal(
          alloc.amount.toString(),
        ).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

        const invoice = await tx.salesInvoice.findUnique({
          where: { id: alloc.salesInvoiceId },
        });
        if (!invoice) {
          throw new AppError(`Invoice ${alloc.salesInvoiceId} not found`, 404);
        }
        if (invoice.customerId !== payment.customerId) {
          throw new AppError(
            `Invoice ${invoice.invoiceNumber} does not belong to customer ${payment.customer.name}`,
            400,
          );
        }
        if (
          invoice.status !== InvoiceStatus.POSTED &&
          invoice.status !== InvoiceStatus.PARTIALLY_PAID
        ) {
          throw new AppError(
            `Cannot allocate to invoice ${invoice.invoiceNumber} in status ${invoice.status}`,
            400,
          );
        }

        const outstanding = new Prisma.Decimal(
          invoice.outstandingAmount,
        ).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
        if (allocAmount.greaterThan(outstanding)) {
          throw new AppError(
            `Allocation (₹${allocAmount.toFixed(2)}) exceeds invoice ${invoice.invoiceNumber} outstanding (₹${outstanding.toFixed(2)})`,
            400,
          );
        }

        const newPaid = new Prisma.Decimal(invoice.paidAmount)
          .plus(allocAmount)
          .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
        const newOutstanding = Prisma.Decimal.max(
          new Prisma.Decimal(0),
          outstanding.minus(allocAmount).toDecimalPlaces(
            2,
            Prisma.Decimal.ROUND_HALF_UP,
          ),
        );
        const newStatus = newOutstanding.lessThanOrEqualTo(0)
          ? InvoiceStatus.PAID
          : InvoiceStatus.PARTIALLY_PAID;

        await tx.salesInvoice.update({
          where: { id: invoice.id },
          data: {
            paidAmount: newPaid,
            outstandingAmount: newOutstanding,
            status: newStatus,
          },
        });

        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            salesInvoiceId: invoice.id,
            amount: allocAmount,
          },
        });
      }

      const nextUnallocated = Prisma.Decimal.max(
        new Prisma.Decimal(0),
        unallocated.minus(totalToAllocate).toDecimalPlaces(
          2,
          Prisma.Decimal.ROUND_HALF_UP,
        ),
      );

      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: { unallocatedAmount: nextUnallocated },
        include: {
          customer: true,
          allocations: { include: { salesInvoice: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: payment.organizationId,
          userId: user?.id,
          userEmail: user?.email,
          action: "PAYMENT_ALLOCATED",
          entity: "payment",
          entityId: payment.id,
          details: JSON.stringify({
            paymentNumber: payment.paymentNumber,
            allocatedAmount: totalToAllocate.toFixed(2),
            remainingUnallocated: nextUnallocated.toFixed(2),
          }),
        },
      });

      return updated;
    });
  }

  /**
   * Reverse a single payment allocation without bouncing the entire payment (IMP-018)
   */
  async reversePaymentAllocation(
    paymentId: string,
    allocationId: string,
    reason: string,
    user?: UserContext,
  ) {
    if (!reason || reason.trim() === "") {
      throw new AppError("Reversal reason is required", 400);
    }

    return await prisma.$transaction(async (tx) => {
      const allocation = await tx.paymentAllocation.findUnique({
        where: { id: allocationId },
        include: { payment: true, salesInvoice: true },
      });
      if (!allocation || allocation.paymentId !== paymentId) {
        throw new AppError("Payment allocation not found", 404);
      }
      if (allocation.isReversed) {
        throw new AppError("Allocation has already been reversed", 400);
      }
      if (allocation.payment.status !== PaymentStatus.POSTED) {
        throw new AppError("Can only adjust allocations on POSTED payments", 400);
      }

      const allocAmount = new Prisma.Decimal(allocation.amount).toDecimalPlaces(
        2,
        Prisma.Decimal.ROUND_HALF_UP,
      );
      const inv = allocation.salesInvoice;
      const newPaid = Prisma.Decimal.max(
        new Prisma.Decimal(0),
        new Prisma.Decimal(inv.paidAmount).minus(allocAmount).toDecimalPlaces(
          2,
          Prisma.Decimal.ROUND_HALF_UP,
        ),
      );
      const newOutstanding = new Prisma.Decimal(inv.outstandingAmount)
        .plus(allocAmount)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      const newStatus = newPaid.lessThanOrEqualTo(0)
        ? InvoiceStatus.POSTED
        : InvoiceStatus.PARTIALLY_PAID;

      await tx.salesInvoice.update({
        where: { id: inv.id },
        data: {
          paidAmount: newPaid,
          outstandingAmount: newOutstanding,
          status: newStatus,
        },
      });

      await tx.paymentAllocation.update({
        where: { id: allocation.id },
        data: { isReversed: true, reversedAt: new Date() },
      });

      const nextUnallocated = new Prisma.Decimal(
        allocation.payment.unallocatedAmount,
      )
        .plus(allocAmount)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: { unallocatedAmount: nextUnallocated },
        include: {
          customer: true,
          allocations: { include: { salesInvoice: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: allocation.payment.organizationId,
          userId: user?.id,
          userEmail: user?.email,
          action: "PAYMENT_ALLOCATION_REVERSED",
          entity: "payment",
          entityId: paymentId,
          reason: reason.trim(),
          details: JSON.stringify({
            allocationId,
            invoiceNumber: inv.invoiceNumber,
            amount: allocAmount.toFixed(2),
          }),
        },
      });

      return updated;
    });
  }
}

export const paymentService = new PaymentService();
