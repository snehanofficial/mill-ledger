import { prisma } from "../../server/src/db/client.js";
import { paymentService } from "../../server/src/modules/finance/payment.service.js";

async function main() {
  console.log("=== CHECKING PAYMENTS, FIFO ALLOCATION & INVARIANTS ===");

  const org = await prisma.organization.findFirstOrThrow({ where: { code: "MILL" } });
  
  // Create an isolated customer for clean payment testing
  const cust = await prisma.customer.create({
    data: {
      organizationId: org.id,
      code: `CUST-PAY-TEST-${Date.now()}`,
      name: "Payment Test Customer",
      state: "Tamil Nadu",
      gstin: "33AABCT0000Z1Z9",
    }
  });

  console.log(`Created test customer: ${cust.name} (${cust.id})`);

  // Create 3 open invoices with different dates:
  // Inv 1: ₹1,000, posted 3 days ago
  // Inv 2: ₹2,000, posted 2 days ago
  // Inv 3: ₹3,000, posted 1 day ago
  // Total outstanding: ₹6,000
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const inv1 = await prisma.salesInvoice.create({
    data: {
      organizationId: org.id,
      invoiceNumber: `INV-PAY-1-${now}`,
      financialYear: "2026-27",
      customerId: cust.id,
      customerNameSnapshot: cust.name,
      deliveryStateSnapshot: cust.state,
      companyGstinSnapshot: "33AAAAA0000A1Z5",
      status: "POSTED",
      taxableAmount: 952.38,
      cgstAmount: 23.81,
      sgstAmount: 23.81,
      igstAmount: 0,
      totalTaxAmount: 47.62,
      totalAmount: 1000.00,
      outstandingAmount: 1000.00,
      postedAt: new Date(now - 3 * dayMs),
    }
  });

  const inv2 = await prisma.salesInvoice.create({
    data: {
      organizationId: org.id,
      invoiceNumber: `INV-PAY-2-${now}`,
      financialYear: "2026-27",
      customerId: cust.id,
      customerNameSnapshot: cust.name,
      deliveryStateSnapshot: cust.state,
      companyGstinSnapshot: "33AAAAA0000A1Z5",
      status: "POSTED",
      taxableAmount: 1904.76,
      cgstAmount: 47.62,
      sgstAmount: 47.62,
      igstAmount: 0,
      totalTaxAmount: 95.24,
      totalAmount: 2000.00,
      outstandingAmount: 2000.00,
      postedAt: new Date(now - 2 * dayMs),
    }
  });

  const inv3 = await prisma.salesInvoice.create({
    data: {
      organizationId: org.id,
      invoiceNumber: `INV-PAY-3-${now}`,
      financialYear: "2026-27",
      customerId: cust.id,
      customerNameSnapshot: cust.name,
      deliveryStateSnapshot: cust.state,
      companyGstinSnapshot: "33AAAAA0000A1Z5",
      status: "POSTED",
      taxableAmount: 2857.14,
      cgstAmount: 71.43,
      sgstAmount: 71.43,
      igstAmount: 0,
      totalTaxAmount: 142.86,
      totalAmount: 3000.00,
      outstandingAmount: 3000.00,
      postedAt: new Date(now - 1 * dayMs),
    }
  });

  console.log(`Created 3 invoices: Inv1=1000, Inv2=2000, Inv3=3000. Total=6000.`);

  // Test 1: Underpayment (Payment 1 = ₹500, auto-FIFO)
  // Expected: Inv1 outstanding reduces to 500. Inv2 & Inv3 untouched.
  console.log("\n--- Test 1: Underpayment (₹500 auto-FIFO) ---");
  const pay1 = await paymentService.recordPayment({
    customerId: cust.id,
    amount: 500,
  });
  console.log(`Payment 1 ID: ${pay1.id}, amount=${pay1.amount}, unallocated=${pay1.unallocatedAmount}`);

  const inv1AfterPay1 = await prisma.salesInvoice.findUniqueOrThrow({ where: { id: inv1.id } });
  console.log(`Inv 1 after Pay 1: outstanding=${inv1AfterPay1.outstandingAmount}, status=${inv1AfterPay1.status}`);

  // Test 2: Overpayment across multiple invoices (Payment 2 = ₹7,000 auto-FIFO)
  // Remaining debt: Inv1=500, Inv2=2000, Inv3=3000 -> Total remaining debt = 5500.
  // Payment is 7000. Expected:
  // Inv1 fully paid (alloc 500)
  // Inv2 fully paid (alloc 2000)
  // Inv3 fully paid (alloc 3000)
  // Total allocated: 5500. Unallocated credit: 1500!
  console.log("\n--- Test 2: Overpayment (₹7,000 auto-FIFO against ₹5,500 debt) ---");
  const pay2 = await paymentService.recordPayment({
    customerId: cust.id,
    amount: 7000,
  });
  console.log(`Payment 2 ID: ${pay2.id}, amount=${pay2.amount}, allocated=${pay2.allocatedAmount}, unallocated=${pay2.unallocatedAmount}`);

  const [inv1Final, inv2Final, inv3Final] = await Promise.all([
    prisma.salesInvoice.findUniqueOrThrow({ where: { id: inv1.id } }),
    prisma.salesInvoice.findUniqueOrThrow({ where: { id: inv2.id } }),
    prisma.salesInvoice.findUniqueOrThrow({ where: { id: inv3.id } }),
  ]);

  console.log(`Inv 1 final: outstanding=${inv1Final.outstandingAmount}, status=${inv1Final.status}`);
  console.log(`Inv 2 final: outstanding=${inv2Final.outstandingAmount}, status=${inv2Final.status}`);
  console.log(`Inv 3 final: outstanding=${inv3Final.outstandingAmount}, status=${inv3Final.status}`);

  // Verify Invariants:
  console.log("\n--- Checking Invariants in DB ---");
  // Invariant 1: sum(allocations) + unallocated = payment.amount
  const pay2AllocAgg = await prisma.paymentAllocation.aggregate({
    where: { paymentId: pay2.id },
    _sum: { amount: true },
  });
  const pay2AllocSum = Number(pay2AllocAgg._sum.amount ?? 0);
  const pay2TotalCheck = pay2AllocSum + Number(pay2.unallocatedAmount);
  console.log(`Pay 2 sum(allocations) (${pay2AllocSum}) + unallocated (${pay2.unallocatedAmount}) = ${pay2TotalCheck} (Expected ${pay2.amount}):`, pay2TotalCheck === Number(pay2.amount));

  // Invariant 2: outstanding = totalAmount - sum(allocations)
  const inv2AllocAgg = await prisma.paymentAllocation.aggregate({
    where: { salesInvoiceId: inv2.id },
    _sum: { amount: true },
  });
  const inv2AllocSum = Number(inv2AllocAgg._sum.amount ?? 0);
  const expectedInv2Outstanding = Number(inv2.totalAmount) - inv2AllocSum;
  console.log(`Inv 2 total (${inv2.totalAmount}) - alloc (${inv2AllocSum}) = ${expectedInv2Outstanding} (Actual outstanding ${inv2Final.outstandingAmount}):`, expectedInv2Outstanding === Number(inv2Final.outstandingAmount));

  // Test 3: Check Customer Receivables Ledger
  const ledger = await paymentService.getCustomerLedger(org.id, cust.id);
  console.log(`\nCustomer Ledger Net Outstanding: ${ledger.summary.netOutstanding} (Expected -1500 cash credit):`, ledger.summary.netOutstanding);

  // Test 4: Check if Payment Reversal or Bounce function exists
  const hasBounce = typeof (paymentService as any).bouncePayment === "function" || typeof (paymentService as any).reversePayment === "function";
  console.log(`Payment bounce/reversal function exists on service: ${hasBounce}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
