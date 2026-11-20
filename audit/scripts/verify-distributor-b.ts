import { prisma } from "../../server/src/db/client.js";
import { salesService } from "../../server/src/modules/sales/sales.service.js";
import type { UserContext } from "@mill-ledger/shared";

async function main() {
  console.log("=== REPRODUCING DISTRIBUTOR B SCENARIO ===");

  const org = await prisma.organization.findFirstOrThrow({ where: { code: "MILL" } });
  const custDistB = await prisma.customer.findFirstOrThrow({ where: { code: "CUST-DIST-B" } });
  const salesman2 = await prisma.user.findFirstOrThrow({ where: { email: "salesman2@millledger.local" } });
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
  const fgVariant = await prisma.productVariant.findFirstOrThrow({ where: { sku: "VAR-MURUKKU-200G" } });
  const fgItem = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: fgVariant.inventoryItemId! } });

  console.log(`Distributor B Customer ID: ${custDistB.id}, State: ${custDistB.state}`);
  console.log(`Current Physical Stock of Finished Goods: ${fgItem.currentStock}`);

  // Set FG stock to 88 packets (post-dispatch benchmark state: 238 produced - 150 dispatched to Retailer A = 88)
  await prisma.inventoryItem.update({
    where: { id: fgItem.id },
    data: { currentStock: 88.000000 }
  });

  // Make sure no leftover active reservations exist on FG
  await prisma.stockReservation.updateMany({
    where: { inventoryItemId: fgItem.id, status: "ACTIVE" },
    data: { status: "CANCELLED" }
  });

  // Step 1: Salesman 2 submits order for 120 packets in Karnataka
  const salesmanUser: UserContext = {
    id: salesman2.id,
    email: salesman2.email,
    role: "SALESMAN",
    organizationId: org.id,
  };

  console.log("Submitting Sales Order for Distributor B (120 packets)...");
  const createRes = await salesService.createSalesOrder(
    {
      organizationId: org.id,
      customerId: custDistB.id,
      orderNumber: `SO-DIST-B-TEST-${Date.now()}`,
      lines: [
        {
          productVariantId: fgVariant.id,
          quantity: 120,
        }
      ]
    },
    salesmanUser
  );

  console.log("Order Creation Result:");
  console.log("  Order ID:", createRes.order.id);
  console.log("  Order Number:", createRes.order.orderNumber);
  console.log("  Status:", createRes.order.status);
  console.log("  Delivery State:", createRes.order.deliveryState);
  console.log("  Taxable Amount:", createRes.order.taxableAmount);
  console.log("  IGST Amount (Inter-state):", createRes.order.igstAmount);
  console.log("  Shortages reported on creation:", JSON.stringify(createRes.shortages));

  // Step 2: Attempt approval for full 120 packets as Admin
  const adminUser: UserContext = {
    id: admin.id,
    email: admin.email,
    role: "ADMIN",
    organizationId: org.id,
  };

  console.log("\nAttempting full approval of 120 packets as Admin...");
  try {
    await salesService.approveSalesOrder(createRes.order.id, {}, adminUser);
    console.error("UNEXPECTED: Full approval succeeded when stock is only 88!");
  } catch (err: any) {
    console.log("Approval Blocked As Expected:");
    console.log("  Error Name:", err.name);
    console.log("  Status Code:", err.statusCode || 400);
    console.log("  Message:", err.message);
  }

  // Step 3: Check getSalesOrderById live shortage calculation
  const fetchedOrder = await salesService.getSalesOrderById(createRes.order.id, adminUser);
  console.log("\nFetched Order Shortage Details:");
  console.log("  totalShortage:", fetchedOrder.totalShortage);
  console.log("  line liveShortage:", fetchedOrder.lines[0]?.liveShortage);
}

main().catch(console.error).finally(() => prisma.$disconnect());
