import { prisma } from "../../db/client.js";
import { InvoiceStatus, PaymentMode, PaymentStatus } from "@prisma/client";
import { AppError } from "../../middleware/error.middleware.js";
export class PaymentService {
    /**
     * Record a customer payment receipt and allocate to invoices
     */
    async recordPayment(input) {
        if (!input.customerId) {
            throw new AppError("Customer ID is required", 400);
        }
        if (!input.amount || input.amount <= 0) {
            throw new AppError("Payment amount must be greater than zero", 400);
        }
        return await prisma.$transaction(async (tx) => {
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
            // 3. Generate receipt number: REC-YYYY-0001
            const currentYear = new Date().getFullYear();
            const count = await tx.payment.count({
                where: { organizationId },
            });
            const paymentNumber = `REC-${currentYear}-${(count + 1).toString().padStart(4, "0")}`;
            const allocationsToCreate = [];
            let unallocated = input.amount;
            // 4. Handle allocations
            if (input.allocations && input.allocations.length > 0) {
                const totalAllocated = input.allocations.reduce((sum, a) => sum + Number(a.amount), 0);
                if (totalAllocated > input.amount) {
                    throw new AppError(`Total allocated amount (₹${totalAllocated}) cannot exceed total payment amount (₹${input.amount})`, 400);
                }
                for (const alloc of input.allocations) {
                    const allocAmount = Number(alloc.amount);
                    if (allocAmount <= 0) {
                        throw new AppError("Allocation amount must be greater than zero", 400);
                    }
                    const invoice = await tx.salesInvoice.findUnique({
                        where: { id: alloc.salesInvoiceId },
                    });
                    if (!invoice) {
                        throw new AppError(`Invoice ${alloc.salesInvoiceId} not found`, 404);
                    }
                    if (invoice.customerId !== input.customerId) {
                        throw new AppError(`Invoice ${invoice.invoiceNumber} does not belong to customer ${customer.name}`, 400);
                    }
                    if (invoice.status !== InvoiceStatus.POSTED &&
                        invoice.status !== InvoiceStatus.PARTIALLY_PAID) {
                        throw new AppError(`Cannot allocate payment to invoice ${invoice.invoiceNumber} in status ${invoice.status}`, 400);
                    }
                    const outstanding = Number(invoice.outstandingAmount);
                    if (allocAmount > outstanding) {
                        throw new AppError(`Allocation of ₹${allocAmount} exceeds invoice ${invoice.invoiceNumber} outstanding balance of ₹${outstanding}`, 400);
                    }
                    const newPaid = Number(invoice.paidAmount) + allocAmount;
                    const newOutstanding = outstanding - allocAmount;
                    const newStatus = newOutstanding <= 0.001
                        ? InvoiceStatus.PAID
                        : InvoiceStatus.PARTIALLY_PAID;
                    await tx.salesInvoice.update({
                        where: { id: invoice.id },
                        data: {
                            paidAmount: newPaid,
                            outstandingAmount: Math.max(0, newOutstanding),
                            status: newStatus,
                        },
                    });
                    allocationsToCreate.push({
                        salesInvoiceId: invoice.id,
                        amount: allocAmount,
                    });
                }
                unallocated = input.amount - totalAllocated;
            }
            else {
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
                let remaining = input.amount;
                for (const inv of openInvoices) {
                    if (remaining <= 0)
                        break;
                    const invOutstanding = Number(inv.outstandingAmount);
                    const allocAmt = Math.min(remaining, invOutstanding);
                    const newPaid = Number(inv.paidAmount) + allocAmt;
                    const newOutstanding = invOutstanding - allocAmt;
                    const newStatus = newOutstanding <= 0.001
                        ? InvoiceStatus.PAID
                        : InvoiceStatus.PARTIALLY_PAID;
                    await tx.salesInvoice.update({
                        where: { id: inv.id },
                        data: {
                            paidAmount: newPaid,
                            outstandingAmount: Math.max(0, newOutstanding),
                            status: newStatus,
                        },
                    });
                    allocationsToCreate.push({
                        salesInvoiceId: inv.id,
                        amount: allocAmt,
                    });
                    remaining -= allocAmt;
                }
                unallocated = remaining;
            }
            // 5. Create Payment record
            const payment = await tx.payment.create({
                data: {
                    organizationId,
                    paymentNumber,
                    customerId: input.customerId,
                    amount: input.amount,
                    unallocatedAmount: Math.max(0, unallocated),
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
    }
    /**
     * Helper to resolve organization id from id or code
     */
    async resolveOrgId(orgIdOrCode) {
        const org = await prisma.organization.findFirst({
            where: {
                OR: [{ id: orgIdOrCode }, { code: orgIdOrCode }],
            },
        });
        return org ? org.id : orgIdOrCode;
    }
    /**
     * List payments with customer and allocations
     */
    async getPayments(organizationId, customerId) {
        const orgId = await this.resolveOrgId(organizationId);
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
        });
    }
    /**
     * Get single payment by ID
     */
    async getPaymentById(id) {
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
    async getCustomerLedger(_organizationId, customerId) {
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
        const rawEvents = [];
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
        const ledgerEntries = rawEvents.map((evt) => {
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
                const ageDays = Math.floor((now - new Date(inv.postedAt).getTime()) / (1000 * 60 * 60 * 24));
                if (ageDays <= 30) {
                    ageing.current0to30 += openAmount;
                }
                else if (ageDays <= 60) {
                    ageing.days31to60 += openAmount;
                }
                else if (ageDays <= 90) {
                    ageing.days61to90 += openAmount;
                }
                else {
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
    async getReceivablesSummary(organizationId) {
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
            const totalInvoiced = c.invoices.reduce((sum, inv) => sum + Number(inv.totalAmount), 0);
            const totalCreditNotes = c.invoices.reduce((sum, inv) => sum +
                inv.creditNotes.reduce((csum, cn) => csum + Number(cn.totalAmount), 0), 0);
            const totalPaid = c.payments.reduce((sum, p) => sum + Number(p.amount), 0);
            const outstanding = totalInvoiced - totalCreditNotes - totalPaid;
            const openInvoicesCount = c.invoices.filter((inv) => Number(inv.outstandingAmount) > 0).length;
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
}
export const paymentService = new PaymentService();
