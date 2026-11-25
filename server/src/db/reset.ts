import { prisma } from "./client.js";

/**
 * Reset operational and transactional tables between test suites,
 * preserving master data and opening balances while bypassing immutability triggers.
 */
export async function resetOperationalData() {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET LOCAL mill_ledger.bypass_immutability = 'on'");
    await tx.auditLog.deleteMany();
    await tx.paymentAllocation.deleteMany();
    await tx.payment.deleteMany();
    await tx.creditNote.deleteMany();
    await tx.debitNoteLine.deleteMany();
    await tx.debitNote.deleteMany();
    await tx.dispatchLine.deleteMany();
    await tx.dispatch.deleteMany();
    await tx.salesInvoiceLine.deleteMany();
    await tx.salesInvoice.deleteMany();
    await tx.stockReservation.deleteMany();
    await tx.salesOrderLine.deleteMany();
    await tx.salesOrder.deleteMany();
    await tx.productionRunReversal.deleteMany();
    await tx.productionRunMaterial.deleteMany();
    await tx.productionRun.deleteMany();
    await tx.purchaseReceiptLine.deleteMany();
    await tx.purchaseReceipt.deleteMany();
    await tx.stockMovement.deleteMany({
      where: {
        movementType: { not: "OPENING_BALANCE" },
      },
    });
    await tx.inventoryItem.updateMany({
      data: {
        currentStock: 0,
        weightedAverageCost: 0,
      },
    });
    const openingBalances = await tx.stockMovement.groupBy({
      by: ["inventoryItemId"],
      where: { movementType: "OPENING_BALANCE" },
      _sum: { quantity: true, totalCost: true },
    });
    for (const ob of openingBalances) {
      const qty = Number(ob._sum.quantity ?? 0);
      const total = Number(ob._sum.totalCost ?? 0);
      await tx.inventoryItem.update({
        where: { id: ob.inventoryItemId },
        data: {
          currentStock: qty,
          weightedAverageCost: qty > 0 ? total / qty : 0,
        },
      });
    }
  });
}
