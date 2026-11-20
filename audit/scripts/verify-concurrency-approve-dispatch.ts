import { prisma } from "../../server/src/db/client.js";
import { salesService } from "../../server/src/modules/sales/sales.service.js";
import { dispatchService } from "../../server/src/modules/sales/dispatch.service.js";
import type { UserContext } from "@mill-ledger/shared";

async function runTestIteration(iteration: number, adminUser: UserContext) {
  console.log(`\n--- Concurrency Test Iteration ${iteration} ---`);
  
  // 1. Setup an isolated test inventory item with exactly 50 units
  const org = await prisma.organization.findFirstOrThrow({ where: { code: "MILL" } });
  const wh = await prisma.warehouse.findFirstOrThrow({ where: { facility: { organizationId: org.id } } });
  const cust = await prisma.customer.findFirstOrThrow({ where: { organizationId: org.id } });
  const uom = await prisma.unitOfMeasure.findFirstOrThrow({ where: { code: "PACKET" } });

  const sku = `CONC-ITEM-${Date.now()}-${iteration}`;
  const invItem = await prisma.inventoryItem.create({
    data: {
      organizationId: org.id,
      sku,
      name: `Concurrency Item ${iteration}`,
      category: "FINISHED_GOODS",
      baseUomId: uom.id,
      currentStock: 50.000000,
      weightedAverageCost: 10.000000,
    }
  });

  const prd = await prisma.product.create({
    data: {
      organizationId: org.id,
      code: `PRD-${sku}`,
      name: `Product ${sku}`,
      taxRate: 5.0,
      hsnCode: "21069099"
    }
  });

  const variant = await prisma.productVariant.create({
    data: {
      productId: prd.id,
      sku: `VAR-${sku}`,
      name: `Variant ${sku}`,
      uomId: uom.id,
      inventoryItemId: invItem.id,
      packSize: 0.2
    }
  });

  // Create 30 SUBMITTED sales orders requesting 10 units each
  // Total demanded: 30 * 10 = 300 units. Available stock: 50 units.
  // Maximum allowed approvals: exactly 5 orders (5 * 10 = 50).
  const orderCount = 30;
  const qtyPerOrder = 10;
  const createdOrders = [];

  for (let i = 0; i < orderCount; i++) {
    const orderRes = await salesService.createSalesOrder(
      {
        organizationId: org.id,
        customerId: cust.id,
        warehouseId: wh.id,
        orderNumber: `SO-CONC-${Date.now()}-${iteration}-${i}`,
        lines: [
          {
            productVariantId: variant.id,
            quantity: qtyPerOrder,
            unitPrice: 50,
          }
        ]
      },
      adminUser
    );
    createdOrders.push(orderRes.order);
  }

  // 2. Launch 30 parallel approval requests against the 50 units of stock
  const approvePromises = createdOrders.map((o) =>
    salesService
      .approveSalesOrder(o.id, {}, adminUser)
      .then((res) => ({ success: true, orderId: o.id, error: null }))
      .catch((err) => ({ success: false, orderId: o.id, error: err.message }))
  );

  const approveResults = await Promise.all(approvePromises);
  const approvedCount = approveResults.filter((r) => r.success).length;
  const rejectedCount = approveResults.filter((r) => !r.success).length;

  // Check active reservations created in DB
  const resAgg = await prisma.stockReservation.aggregate({
    where: {
      inventoryItemId: invItem.id,
      status: "ACTIVE",
    },
    _sum: {
      reservedQuantity: true,
    }
  });
  const totalReserved = Number(resAgg._sum.reservedQuantity ?? 0);

  console.log(`Approvals: ${approvedCount} succeeded, ${rejectedCount} rejected.`);
  console.log(`Total Reserved: ${totalReserved} units (Expected <= 50). Available stock was 50.`);

  const oversold = totalReserved > 50;
  if (oversold) {
    console.error(`🚨 CRITICAL RACE CONDITION DETECTED! Stock oversold: ${totalReserved} > 50! Approved orders: ${approvedCount}`);
  }

  // 3. Test parallel dispatches on the approved orders
  const approvedOrderIds = approveResults.filter((r) => r.success).map((r) => r.orderId);
  console.log(`Attempting parallel dispatches on ${approvedOrderIds.length} approved orders...`);
  
  const dispatchPromises = approvedOrderIds.map((orderId) =>
    dispatchService
      .postDispatch({
        salesOrderId: orderId,
        warehouseId: wh.id,
      })
      .then((res) => ({ success: true, orderId, error: null }))
      .catch((err) => ({ success: false, orderId, error: err.message }))
  );

  const dispatchResults = await Promise.all(dispatchPromises);
  const dispatchedCount = dispatchResults.filter((r) => r.success).length;
  const failedDispatches = dispatchResults.filter((r) => !r.success);

  // Check ending current stock
  const endingItem = await prisma.inventoryItem.findUniqueOrThrow({
    where: { id: invItem.id }
  });
  const endingStock = Number(endingItem.currentStock);
  console.log(`Dispatches: ${dispatchedCount} succeeded, ${failedDispatches.length} failed.`);
  console.log(`Ending currentStock: ${endingStock} (Must be >= 0).`);

  return {
    iteration,
    approvedCount,
    rejectedCount,
    totalReserved,
    oversold,
    dispatchedCount,
    endingStock,
    deadlocks: approveResults.some(r => r.error?.includes("deadlock")) || dispatchResults.some(r => r.error?.includes("deadlock")),
  };
}

async function main() {
  console.log("=== RUNNING 10 ITERATIONS OF PARALLEL APPROVE & DISPATCH (30 PARALLEL REQS) ===");
  const adminDb = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
  const adminUser: UserContext = {
    id: adminDb.id,
    email: adminDb.email,
    role: "ADMIN",
    organizationId: adminDb.organizationId,
  };

  const results = [];
  for (let i = 1; i <= 10; i++) {
    const res = await runTestIteration(i, adminUser);
    results.push(res);
  }

  console.log("\n=== CONCURRENCY SUMMARY (10 ITERATIONS) ===");
  console.table(results);
}

main().catch(console.error).finally(() => prisma.$disconnect());
