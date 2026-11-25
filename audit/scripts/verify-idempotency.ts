import { prisma } from "../../server/src/db/client.js";
import { salesService } from "../../server/src/modules/sales/sales.service.js";
import { financeService } from "../../server/src/modules/finance/finance.service.js";
import { paymentService } from "../../server/src/modules/finance/payment.service.js";
import type { UserContext } from "@mill-ledger/shared";

async function main() {
  console.log("=== CHECKING DOUBLE SUBMIT IDEMPOTENCY ===");
  const adminDb = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
  const adminUser: UserContext = {
    id: adminDb.id,
    email: adminDb.email,
    role: "ADMIN",
    organizationId: adminDb.organizationId,
  };
  const cust = await prisma.customer.findFirstOrThrow({ where: { organizationId: adminDb.organizationId } });
  const variant = await prisma.productVariant.findFirstOrThrow();

  // 1. Double submit Sales Order create
  const orderKey = `IDEM-ORDER-${Date.now()}`;
  console.log(`Testing Order Create with key: ${orderKey}`);
  const orderReq = {
    customerId: cust.id,
    idempotencyKey: orderKey,
    lines: [{ productVariantId: variant.id, quantity: 10, unitPrice: 50 }],
  };

  const [order1, order2] = await Promise.all([
    salesService.createSalesOrder(orderReq, adminUser),
    salesService.createSalesOrder(orderReq, adminUser),
  ]);

  console.log(`Order 1 ID: ${order1.order.id}, Order 2 ID: ${order2.order.id}`);
  const orderIdempotent = order1.order.id === order2.order.id;
  console.log(`Order creation idempotent: ${orderIdempotent}`);

  // Approve order so we can invoice it
  await salesService.approveSalesOrder(order1.order.id, {}, adminUser);

  // 2. Double submit Invoice post
  const invoiceKey = `IDEM-INV-${Date.now()}`;
  console.log(`Testing Invoice Post with key: ${invoiceKey}`);
  const invReq = {
    salesOrderId: order1.order.id,
    idempotencyKey: invoiceKey,
  };

  const [inv1, inv2] = await Promise.all([
    financeService.createInvoiceFromOrder(invReq),
    financeService.createInvoiceFromOrder(invReq),
  ]);

  console.log(`Invoice 1 ID: ${inv1.id}, Invoice 2 ID: ${inv2.id}`);
  console.log(`Invoice 1 Number: ${inv1.invoiceNumber}, Invoice 2 Number: ${inv2.invoiceNumber}`);
  const invIdempotent = inv1.id === inv2.id;
  console.log(`Invoice posting idempotent: ${invIdempotent}`);

  // 3. Double submit Payment record
  const paymentKey = `IDEM-PAY-${Date.now()}`;
  console.log(`Testing Payment Record with key: ${paymentKey}`);
  const payReq = {
    customerId: cust.id,
    amount: 100,
    idempotencyKey: paymentKey,
    allocations: [{ salesInvoiceId: inv1.id, amount: 100 }],
  };

  const [pay1, pay2] = await Promise.all([
    paymentService.recordPayment(payReq),
    paymentService.recordPayment(payReq),
  ]);

  console.log(`Payment 1 ID: ${pay1.id}, Payment 2 ID: ${pay2.id}`);
  console.log(`Payment 1 Number: ${pay1.paymentNumber}, Payment 2 Number: ${pay2.paymentNumber}`);
  const payIdempotent = pay1.id === pay2.id;
  console.log(`Payment recording idempotent: ${payIdempotent}`);

  const allPassed = orderIdempotent && invIdempotent && payIdempotent;
  console.log(`\nALL IDEMPOTENCY CHECKS PASSED: ${allPassed}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
