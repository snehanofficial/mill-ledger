import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../db/client.js";
import { resetOperationalData } from "../db/reset.js";
import { seedBenchmarkMasters } from "../db/seed.js";
import { salesService } from "../modules/sales/sales.service.js";
import { financeService } from "../modules/finance/finance.service.js";
import { paymentService } from "../modules/finance/payment.service.js";
import { inventoryService } from "../modules/inventory/inventory.service.js";
import { productionService } from "../modules/production/production.service.js";
import type { UserContext } from "@mill-ledger/shared";

describe("F-015 Regression: Concurrent Idempotency Race Condition Resolution", () => {
  let orgId: string;
  let adminUser: UserContext;

  beforeEach(async () => {
    await resetOperationalData();
    await seedBenchmarkMasters();

    const admin = await prisma.user.findFirstOrThrow({
      where: { role: "ADMIN" },
    });
    orgId = admin.organizationId ?? "MILL";
    adminUser = {
      id: admin.id,
      email: admin.email ?? "admin@millledger.local",
      role: "ADMIN",
      organizationId: admin.organizationId ?? "MILL",
      isActive: true,
    };
  });

  it("handles 5 concurrent sales order submissions with the same idempotency key without P2002 error", async () => {
    const customer = await prisma.customer.findFirstOrThrow({
      where: { organizationId: orgId },
    });
    const variant = await prisma.productVariant.findFirstOrThrow();
    const runKey = `IDEMP-ORDER-${Date.now()}`;

    const orderInput = {
      customerId: customer.id,
      idempotencyKey: runKey,
      lines: [
        {
          productVariantId: variant.id,
          quantity: 5,
          unitPrice: 50,
        },
      ],
    };

    // Fire 5 simultaneous create requests
    const promises = Array.from({ length: 5 }, () =>
      salesService.createSalesOrder(orderInput, adminUser),
    );

    const results = await Promise.all(promises);

    // All 5 must succeed and return the exact same order id
    const firstOrderId = results[0].order.id;
    for (const r of results) {
      expect(r.order.id).toBe(firstOrderId);
    }

    // Verify exactly one order exists in DB with this idempotency key
    const count = await prisma.salesOrder.count({
      where: { idempotencyKey: runKey },
    });
    expect(count).toBe(1);
  });

  it("handles 5 concurrent sales invoice creation requests with the same idempotency key", async () => {
    const customer = await prisma.customer.findFirstOrThrow({
      where: { code: "CUST-RET-A" },
    });
    const variant = await prisma.productVariant.findFirstOrThrow({
      where: { sku: "VAR-MURUKKU-200G" },
    });

    // Create and approve an order first (opening stock is 50 packets)
    const { order } = await salesService.createSalesOrder(
      {
        customerId: customer.id,
        lines: [
          {
            productVariantId: variant.id,
            quantity: 2,
            unitPrice: 50,
          },
        ],
      },
      adminUser,
    );

    await salesService.approveSalesOrder(order.id, {}, adminUser);

    const invKey = `IDEMP-INV-${Date.now()}`;
    const invInput = {
      salesOrderId: order.id,
      idempotencyKey: invKey,
    };

    // Fire 5 simultaneous invoice creations
    const promises = Array.from({ length: 5 }, () =>
      financeService.createInvoiceFromOrder(invInput),
    );

    const results = await Promise.all(promises);

    const firstInv = results[0];
    expect(firstInv).toBeDefined();
    const firstInvId = firstInv!.id;
    for (const inv of results) {
      expect(inv).toBeDefined();
      expect(inv!.id).toBe(firstInvId);
      expect(inv!.invoiceNumber).toBe(firstInv!.invoiceNumber);
    }

    const count = await prisma.salesInvoice.count({
      where: { idempotencyKey: invKey },
    });
    expect(count).toBe(1);
  });

  it("handles 5 concurrent payment records with the same idempotency key", async () => {
    const customer = await prisma.customer.findFirstOrThrow({
      where: { organizationId: orgId },
    });
    const payKey = `IDEMP-PAY-${Date.now()}`;

    const payInput = {
      customerId: customer.id,
      amount: 500,
      idempotencyKey: payKey,
      notes: "Concurrent test payment",
    };

    // Fire 5 simultaneous payment receipts
    const promises = Array.from({ length: 5 }, () =>
      paymentService.recordPayment(payInput),
    );

    const results = await Promise.all(promises);

    const firstPayId = results[0].id;
    for (const pay of results) {
      expect(pay.id).toBe(firstPayId);
      expect(pay.paymentNumber).toBe(results[0].paymentNumber);
    }

    const count = await prisma.payment.count({
      where: { idempotencyKey: payKey },
    });
    expect(count).toBe(1);
  });

  it("handles concurrent purchase receipt posts with the same idempotency key", async () => {
    const supplier = await prisma.supplier.findFirstOrThrow({
      where: { organizationId: orgId },
    });
    const warehouse = await prisma.warehouse.findFirstOrThrow({
      where: { code: "WH-1" },
    });
    const flour = await prisma.inventoryItem.findFirstOrThrow({
      where: { sku: "RM-FLOUR" },
    });
    const receiptKey = `IDEMP-RCPT-${Date.now()}`;

    const rcptInput = {
      organizationId: orgId,
      supplierId: supplier.id,
      warehouseId: warehouse.id,
      receiptNumber: `PR-CONCUR-${Date.now()}`,
      idempotencyKey: receiptKey,
      items: [
        {
          inventoryItemId: flour.id,
          quantity: 10,
          uomId: flour.baseUomId,
          unitPrice: 40,
        },
      ],
    };

    const promises = Array.from({ length: 3 }, () =>
      inventoryService.postPurchaseReceipt(rcptInput),
    );

    const results = await Promise.all(promises);

    const firstRcptId = results[0].id;
    for (const r of results) {
      expect(r.id).toBe(firstRcptId);
    }

    const count = await prisma.purchaseReceipt.count({
      where: { idempotencyKey: receiptKey },
    });
    expect(count).toBe(1);
  });

  it("handles concurrent production run creations with the same idempotency key", async () => {
    const warehouse = await prisma.warehouse.findFirstOrThrow({
      where: { code: "WH-1" },
    });
    const recipe = await prisma.recipe.findFirstOrThrow({
      where: { organizationId: orgId },
    });
    const runKey = `IDEMP-RUN-${Date.now()}`;

    const runInput = {
      organizationId: orgId,
      warehouseId: warehouse.id,
      recipeId: recipe.id,
      runNumber: `RUN-CONCUR-${Date.now()}`,
      batchCount: 1,
      idempotencyKey: runKey,
    };

    const promises = Array.from({ length: 3 }, () =>
      productionService.createDraftRun(runInput),
    );

    const results = await Promise.all(promises);

    const firstRun = results[0];
    expect(firstRun).toBeDefined();
    const firstRunId = firstRun!.id;
    for (const r of results) {
      expect(r).toBeDefined();
      expect(r!.id).toBe(firstRunId);
    }

    const count = await prisma.productionRun.count({
      where: { idempotencyKey: runKey },
    });
    expect(count).toBe(1);
  });
});
