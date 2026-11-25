import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../db/client.js";
import { resetOperationalData } from "../db/reset.js";
import { seedBenchmarkMasters } from "../db/seed.js";
import { paymentService } from "../modules/finance/payment.service.js";
import { financeService } from "../modules/finance/finance.service.js";
import { InvoiceStatus, PaymentStatus } from "@prisma/client";

describe("F-013 Regression: Payment Bounce, Reversals and Supplier Debit Notes", () => {
  let orgId: string;

  beforeEach(async () => {
    await resetOperationalData();
    await seedBenchmarkMasters();
    const org = await prisma.organization.findFirstOrThrow({
      where: { code: "MILL" },
    });
    orgId = org.id;
  });

  it("atomically bounces a fully paid invoice, restoring outstanding balance and POSTED status", async () => {
    const runId = Date.now();
    const customer = await prisma.customer.create({
      data: {
        organizationId: orgId,
        code: `CUST-BN-1-${runId}`,
        name: "Bounce Test Customer 1",
        state: "Tamil Nadu",
      },
    });

    const invoice = await prisma.salesInvoice.create({
      data: {
        organizationId: orgId,
        invoiceNumber: `INV-BN-1-${runId}`,
        financialYear: "2026-27",
        customerId: customer.id,
        customerNameSnapshot: customer.name,
        deliveryStateSnapshot: customer.state,
        companyGstinSnapshot: "33AAAAA0000A1Z5",
        status: InvoiceStatus.POSTED,
        taxableAmount: 4761.9,
        cgstAmount: 119.05,
        sgstAmount: 119.05,
        igstAmount: 0,
        totalTaxAmount: 238.1,
        totalAmount: 5000.0,
        paidAmount: 0,
        outstandingAmount: 5000.0,
        postedAt: new Date(),
      },
    });

    // 1. Record payment of ₹5,000 in full
    const payment = await paymentService.recordPayment({
      customerId: customer.id,
      amount: 5000,
      paymentMode: "CHEQUE",
      referenceNumber: "CHQ-10001",
      notes: "Payment for full invoice",
      allocations: [{ salesInvoiceId: invoice.id, amount: 5000 }],
    });

    const paidInv = await prisma.salesInvoice.findUniqueOrThrow({
      where: { id: invoice.id },
    });
    expect(Number(paidInv.paidAmount)).toBe(5000);
    expect(Number(paidInv.outstandingAmount)).toBe(0);
    expect(paidInv.status).toBe(InvoiceStatus.PAID);

    // 2. Bounce the payment
    const bounced = await paymentService.bouncePayment(payment.id, {
      reason: "Cheque dishonoured: Insufficient funds (CTS-2010)",
      referenceNumber: "RET-CTS-001",
    });

    expect(bounced.status).toBe(PaymentStatus.BOUNCED);
    expect(bounced.reversalReason).toBe(
      "Cheque dishonoured: Insufficient funds (CTS-2010)",
    );
    expect(bounced.reversalReference).toBe("RET-CTS-001");
    expect(bounced.reversedAt).toBeDefined();

    // 3. Verify invoice is restored to POSTED with full outstanding amount
    const restoredInv = await prisma.salesInvoice.findUniqueOrThrow({
      where: { id: invoice.id },
    });
    expect(Number(restoredInv.paidAmount)).toBe(0);
    expect(Number(restoredInv.outstandingAmount)).toBe(5000);
    expect(restoredInv.status).toBe(InvoiceStatus.POSTED);

    // 4. Verify allocations are preserved but marked isReversed = true
    const allocations = await prisma.paymentAllocation.findMany({
      where: { paymentId: payment.id },
    });
    expect(allocations).toHaveLength(1);
    expect(allocations[0].isReversed).toBe(true);
    expect(allocations[0].reversedAt).not.toBeNull();

    // 5. Verify customer ledger restores full debt
    const ledger = await paymentService.getCustomerLedger(orgId, customer.id);
    expect(ledger.summary.netOutstanding).toBe(5000);
    expect(ledger.summary.totalPaid).toBe(0);
  });

  it("correctly reverses multi-invoice partial FIFO allocations and restores respective invoice balances", async () => {
    const runId = Date.now();
    const customer = await prisma.customer.create({
      data: {
        organizationId: orgId,
        code: `CUST-BN-2-${runId}`,
        name: "Bounce Test Customer 2",
        state: "Tamil Nadu",
      },
    });

    const invA = await prisma.salesInvoice.create({
      data: {
        organizationId: orgId,
        invoiceNumber: `INV-A-${runId}`,
        financialYear: "2026-27",
        customerId: customer.id,
        customerNameSnapshot: customer.name,
        deliveryStateSnapshot: customer.state,
        companyGstinSnapshot: "33AAAAA0000A1Z5",
        status: InvoiceStatus.POSTED,
        taxableAmount: 2857.14,
        cgstAmount: 71.43,
        sgstAmount: 71.43,
        igstAmount: 0,
        totalTaxAmount: 142.86,
        totalAmount: 3000.0,
        paidAmount: 0,
        outstandingAmount: 3000.0,
        postedAt: new Date(Date.now() - 2 * 86400000), // 2 days ago
      },
    });

    const invB = await prisma.salesInvoice.create({
      data: {
        organizationId: orgId,
        invoiceNumber: `INV-B-${runId}`,
        financialYear: "2026-27",
        customerId: customer.id,
        customerNameSnapshot: customer.name,
        deliveryStateSnapshot: customer.state,
        companyGstinSnapshot: "33AAAAA0000A1Z5",
        status: InvoiceStatus.POSTED,
        taxableAmount: 3809.52,
        cgstAmount: 95.24,
        sgstAmount: 95.24,
        igstAmount: 0,
        totalTaxAmount: 190.48,
        totalAmount: 4000.0,
        paidAmount: 0,
        outstandingAmount: 4000.0,
        postedAt: new Date(Date.now() - 1 * 86400000), // 1 day ago
      },
    });

    // Pay ₹4,500 using FIFO: InvA gets 3000 (fully paid), InvB gets 1500 (partially paid, 2500 outstanding)
    const payment = await paymentService.recordPayment({
      customerId: customer.id,
      amount: 4500,
      paymentMode: "CHEQUE",
      referenceNumber: "CHQ-MULTI-01",
    });

    const invAAfter = await prisma.salesInvoice.findUniqueOrThrow({
      where: { id: invA.id },
    });
    const invBAfter = await prisma.salesInvoice.findUniqueOrThrow({
      where: { id: invB.id },
    });
    expect(invAAfter.status).toBe(InvoiceStatus.PAID);
    expect(Number(invAAfter.outstandingAmount)).toBe(0);
    expect(invBAfter.status).toBe(InvoiceStatus.PARTIALLY_PAID);
    expect(Number(invBAfter.outstandingAmount)).toBe(2500);

    // Bounce the ₹4,500 payment
    await paymentService.bouncePayment(payment.id, {
      reason: "Account closed",
    });

    // Both invoices must revert to POSTED with full amounts
    const invAReverted = await prisma.salesInvoice.findUniqueOrThrow({
      where: { id: invA.id },
    });
    const invBReverted = await prisma.salesInvoice.findUniqueOrThrow({
      where: { id: invB.id },
    });

    expect(invAReverted.status).toBe(InvoiceStatus.POSTED);
    expect(Number(invAReverted.paidAmount)).toBe(0);
    expect(Number(invAReverted.outstandingAmount)).toBe(3000);

    expect(invBReverted.status).toBe(InvoiceStatus.POSTED);
    expect(Number(invBReverted.paidAmount)).toBe(0);
    expect(Number(invBReverted.outstandingAmount)).toBe(4000);

    const ledger = await paymentService.getCustomerLedger(orgId, customer.id);
    expect(ledger.summary.netOutstanding).toBe(7000);
  });

  it("handles unallocated overpayment bounce and restores ledger correctly", async () => {
    const runId = Date.now();
    const customer = await prisma.customer.create({
      data: {
        organizationId: orgId,
        code: `CUST-BN-3-${runId}`,
        name: "Bounce Test Customer 3",
        state: "Tamil Nadu",
      },
    });

    const invoice = await prisma.salesInvoice.create({
      data: {
        organizationId: orgId,
        invoiceNumber: `INV-C-${runId}`,
        financialYear: "2026-27",
        customerId: customer.id,
        customerNameSnapshot: customer.name,
        deliveryStateSnapshot: customer.state,
        companyGstinSnapshot: "33AAAAA0000A1Z5",
        status: InvoiceStatus.POSTED,
        taxableAmount: 1904.76,
        cgstAmount: 47.62,
        sgstAmount: 47.62,
        igstAmount: 0,
        totalTaxAmount: 95.24,
        totalAmount: 2000.0,
        paidAmount: 0,
        outstandingAmount: 2000.0,
        postedAt: new Date(),
      },
    });

    // Pay ₹3,500 against ₹2,000 invoice (₹1,500 unallocated cash credit)
    const pay = await paymentService.recordPayment({
      customerId: customer.id,
      amount: 3500,
      paymentMode: "CHEQUE",
    });

    expect(Number(pay.unallocatedAmount)).toBe(1500);

    let ledger = await paymentService.getCustomerLedger(orgId, customer.id);
    expect(ledger.summary.netOutstanding).toBe(-1500); // customer is in credit

    // Bounce the payment
    await paymentService.bouncePayment(pay.id, {
      reason: "Payment stopped by drawer",
    });

    ledger = await paymentService.getCustomerLedger(orgId, customer.id);
    expect(ledger.summary.netOutstanding).toBe(2000); // customer now owes ₹2000
    expect(ledger.summary.totalPaid).toBe(0);

    const restoredInv = await prisma.salesInvoice.findUniqueOrThrow({
      where: { id: invoice.id },
    });
    expect(Number(restoredInv.outstandingAmount)).toBe(2000);
    expect(restoredInv.status).toBe(InvoiceStatus.POSTED);
  });

  it("enforces idempotency and prevents duplicate bounces", async () => {
    const runId = Date.now();
    const customer = await prisma.customer.create({
      data: {
        organizationId: orgId,
        code: `CUST-BN-4-${runId}`,
        name: "Bounce Test Customer 4",
        state: "Tamil Nadu",
      },
    });

    const payment = await paymentService.recordPayment({
      customerId: customer.id,
      amount: 1000,
      paymentMode: "CHEQUE",
    });

    const bounced = await paymentService.bouncePayment(payment.id, {
      reason: "Cheque bounced",
      idempotencyKey: "IDEMP-BOUNCE-001",
    });
    expect(bounced.status).toBe(PaymentStatus.BOUNCED);

    // Repeated call with same idempotencyKey returns existing without error
    const duplicateIdemp = await paymentService.bouncePayment(payment.id, {
      reason: "Cheque bounced",
      idempotencyKey: "IDEMP-BOUNCE-001",
    });
    expect(duplicateIdemp.id).toBe(bounced.id);

    // Call without matching idempotency key throws error
    await expect(
      paymentService.bouncePayment(payment.id, {
        reason: "Cheque bounced again",
      }),
    ).rejects.toThrow(/already been bounced/i);
  });

  it("creates and retrieves dedicated supplier debit notes with line items", async () => {
    const runId = Date.now();
    const supplier = await prisma.supplier.create({
      data: {
        organizationId: orgId,
        code: `SUPP-DN-${runId}`,
        name: "Packaging Supplier Ltd",
        state: "Tamil Nadu",
      },
    });

    const debitNote = await financeService.issueDebitNote({
      organizationId: orgId,
      supplierId: supplier.id,
      reason: "Goods returned: Damaged packaging material during unloading",
      totalAmount: 1180.0,
      taxableAmount: 1000.0,
      taxAmount: 180.0,
      lines: [
        {
          description: "50kg HDPE Woven Sacks - Torn batch",
          quantity: 100,
          unitPrice: 10,
          taxableAmount: 1000.0,
          taxAmount: 180.0,
          totalAmount: 1180.0,
        },
      ],
    });

    expect(debitNote.debitNoteNumber).toMatch(/^DN-\d{4}-\d{4}$/);
    expect(Number(debitNote.totalAmount)).toBe(1180.0);
    expect(debitNote.lines).toHaveLength(1);
    expect(debitNote.lines[0].description).toBe(
      "50kg HDPE Woven Sacks - Torn batch",
    );

    // Verify retrieval via getDebitNotes
    const dnList = await financeService.getDebitNotes(orgId, supplier.id);
    expect(dnList).toHaveLength(1);
    expect(dnList[0].id).toBe(debitNote.id);
  });
});
