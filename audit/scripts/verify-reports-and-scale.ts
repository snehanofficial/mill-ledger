import { prisma } from "../../server/src/db/client.js";
import { reportingService } from "../../server/src/modules/reporting/reporting.service.js";
import { financeService } from "../../server/src/modules/finance/finance.service.js";

async function testReconciliations() {
  console.log("=== 1. TESTING INDEPENDENT SQL RECONCILIATIONS ON CURRENT DATA ===");
  const org = await prisma.organization.findFirstOrThrow({ where: { code: "MILL" } });

  // A. Sales Register vs SQL
  const salesRep = await reportingService.getSalesReport({ organizationId: org.id });
  const salesSql = await prisma.$queryRaw<any[]>`
    SELECT 
      COUNT(*)::int as count,
      COALESCE(SUM("taxableAmount"), 0) as taxable,
      COALESCE(SUM("cgstAmount"), 0) as cgst,
      COALESCE(SUM("sgstAmount"), 0) as sgst,
      COALESCE(SUM("igstAmount"), 0) as igst,
      COALESCE(SUM("totalTaxAmount"), 0) as tax,
      COALESCE(SUM("totalAmount"), 0) as total
    FROM "sales_invoice"
    WHERE "organizationId" = ${org.id} AND "status" != 'DRAFT'
  `;
  const sSql = salesSql[0];
  console.log("Sales Register Reconciliation:");
  console.log(`  Report Grand Total: ₹${salesRep.summary.grandTotal} | SQL Grand Total: ₹${sSql.total}`);
  console.log(`  Report Invoices Count: ${salesRep.summary.totalInvoicesCount} | SQL Invoices Count: ${sSql.count}`);
  const salesMatch = Math.abs(salesRep.summary.grandTotal - Number(sSql.total)) < 0.01;
  console.log(`  Sales Register matches SQL: ${salesMatch}`);

  // B. Stock Summary vs SQL Movements
  const stockRep = await reportingService.getStockSummaryReport({ organizationId: org.id });
  const stockSql = await prisma.$queryRaw<any[]>`
    SELECT 
      COALESCE(SUM("currentStock" * "weightedAverageCost"), 0) as on_hand_valuation,
      COALESCE(SUM("currentStock"), 0) as total_on_hand
    FROM "inventory_item"
    WHERE "organizationId" = ${org.id} AND "isActive" = true
  `;
  const stSql = stockSql[0];
  console.log("\nStock Valuation Reconciliation:");
  console.log(`  Report Total Valuation: ₹${stockRep.summary.totalValuation} | SQL Valuation: ₹${stSql.on_hand_valuation}`);
  console.log(`  Report All Items Reconciled with Ledger: ${stockRep.summary.allReconciled}`);
  const stockMatch = Math.abs(stockRep.summary.totalValuation - Number(stSql.on_hand_valuation)) < 0.01;
  console.log(`  Stock Valuation matches SQL: ${stockMatch}`);

  // C. Collections vs SQL Payments
  const collRep = await reportingService.getCollectionsReport({ organizationId: org.id });
  const collSql = await prisma.$queryRaw<any[]>`
    SELECT 
      COALESCE(SUM("amount"), 0) as total_amount,
      COALESCE(SUM("unallocatedAmount"), 0) as total_unallocated
    FROM "payment"
    WHERE "organizationId" = ${org.id} AND "status" = 'POSTED'
  `;
  const cSql = collSql[0];
  console.log("\nCollections Register Reconciliation:");
  console.log(`  Report Total Collections: ₹${collRep.summary.totalAmount} | SQL Total Payments: ₹${cSql.total_amount}`);
  const collMatch = Math.abs(collRep.summary.totalAmount - Number(cSql.total_amount)) < 0.01;
  console.log(`  Collections Register matches SQL: ${collMatch}`);

  // D. Receivables vs SQL Net Balance
  const recRep = await reportingService.getReceivablesReport({ organizationId: org.id });
  const recSql = await prisma.$queryRaw<any[]>`
    SELECT 
      (SELECT COALESCE(SUM("totalAmount"), 0) FROM "sales_invoice" WHERE "organizationId" = ${org.id} AND "status" != 'DRAFT')
      - (SELECT COALESCE(SUM("totalAmount"), 0) FROM "credit_note" WHERE "organizationId" = ${org.id})
      - (SELECT COALESCE(SUM("amount"), 0) FROM "payment" WHERE "organizationId" = ${org.id} AND "status" = 'POSTED') as net_outstanding
  `;
  const rSql = recSql[0];
  console.log("\nReceivables Reconciliation:");
  console.log(`  Report Total Outstanding: ₹${recRep.summary.totalOutstanding} | SQL Net Balance: ₹${rSql.net_outstanding}`);
  const recMatch = Math.abs(recRep.summary.totalOutstanding - Number(rSql.net_outstanding)) < 0.01;
  console.log(`  Receivables matches SQL: ${recMatch}`);
}

async function testTimezoneAndFYBoundary() {
  console.log("\n=== 2. TESTING FINANCIAL YEAR BOUNDARY & IST TIMEZONE HANDLING ===");
  // Test case 1: April 1 at 01:30 AM IST (UTC: March 31 20:00)
  // In IST: This is FY 2026-27 (since it is April 1, 2026).
  // If evaluated in UTC: date.getMonth() is 2 (March), so it produces FY 2025-26!
  const april1_IST = new Date("2026-04-01T01:30:00+05:30");
  const fyApril1 = financeService.getFinancialYear(april1_IST);
  console.log(`Date: 2026-04-01 01:30 AM IST (UTC: ${april1_IST.toISOString()})`);
  console.log(`Derived FY: ${fyApril1} (Statutory Expected in IST: 2026-27)`);

  const fyCorrect = fyApril1 === "2026-27";
  if (!fyCorrect) {
    console.error(`🚨 TIMEZONE BUG CONFIRMED: Evaluated in local/UTC timezone instead of IST! Produced ${fyApril1} instead of 2026-27.`);
  } else {
    console.log(`Financial year in local runtime: ${fyApril1}`);
  }
}

async function test100kMovementsScale() {
  console.log("\n=== 3. TESTING PERFORMANCE AND RECONCILIATION ON 100K+ MOVEMENTS ===");
  const org = await prisma.organization.findFirstOrThrow({ where: { code: "MILL" } });
  const wh = await prisma.warehouse.findFirstOrThrow({ where: { facility: { organizationId: org.id } } });
  const uom = await prisma.unitOfMeasure.findFirstOrThrow({ where: { code: "KG" } });

  // Create dedicated scale test item
  const sku = `SCALE-100K-${Date.now()}`;
  const item = await prisma.inventoryItem.create({
    data: {
      organizationId: org.id,
      sku,
      name: "100k Movements Scale Item",
      category: "RAW_MATERIAL",
      baseUomId: uom.id,
      currentStock: 0,
      weightedAverageCost: 10,
    }
  });

  console.log(`Created scale test item: ${item.name} (${item.id})`);
  console.log("Generating 100,000 stock movements in bulk batches of 10,000...");

  const startTime = Date.now();
  const batchSize = 10000;
  const totalMovements = 100000;
  let totalQty = 0;

  for (let batch = 0; batch < totalMovements / batchSize; batch++) {
    const movements = [];
    for (let i = 0; i < batchSize; i++) {
      const qty = 1.0;
      totalQty += qty;
      movements.push({
        id: `SM-SCALE-${batch}-${i}-${Date.now()}`,
        inventoryItemId: item.id,
        warehouseId: wh.id,
        movementType: "PURCHASE_RECEIPT" as const,
        quantity: qty,
        unitCost: 10,
        totalCost: 10,
        referenceDocumentType: "SCALE_TEST",
        referenceDocumentId: `SCALE-${batch}`,
        notes: "Automated 100k audit scale test",
      });
    }
    await prisma.stockMovement.createMany({ data: movements });
    process.stdout.write(`  Inserted ${((batch + 1) * batchSize).toLocaleString()} movements...\r`);
  }

  const insertDuration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\nSuccessfully inserted 100,000 movements in ${insertDuration}s.`);

  // Update item currentStock to match totalQty
  await prisma.inventoryItem.update({
    where: { id: item.id },
    data: { currentStock: totalQty }
  });

  // Test SQL ledger reconciliation query performance
  console.log("Executing SQL ledger reconciliation query across 100k+ movements...");
  const queryStart = Date.now();
  const ledgerSumRes = await prisma.$queryRaw<any[]>`
    SELECT 
      "inventoryItemId",
      SUM("quantity") as total_qty,
      COUNT(*)::int as movement_count
    FROM "stock_movement"
    WHERE "inventoryItemId" = ${item.id}
    GROUP BY "inventoryItemId"
  `;
  const queryDuration = Date.now() - queryStart;
  const ledgerSum = Number(ledgerSumRes[0]?.total_qty ?? 0);
  const count = Number(ledgerSumRes[0]?.movement_count ?? 0);

  console.log(`Query completed in ${queryDuration}ms.`);
  console.log(`  Counted movements: ${count.toLocaleString()}`);
  console.log(`  Sum of movement quantities: ${ledgerSum.toLocaleString()} (Expected: ${totalQty.toLocaleString()})`);
  console.log(`  Reconciliation exact match: ${ledgerSum === totalQty}`);

  // Clean up scale movements to keep throwaway DB clean
  console.log("Cleaning up scale test rows...");
  await prisma.stockMovement.deleteMany({ where: { inventoryItemId: item.id } });
  await prisma.inventoryItem.delete({ where: { id: item.id } });
  console.log("Cleanup complete.");
}

async function main() {
  await testReconciliations();
  await testTimezoneAndFYBoundary();
  await test100kMovementsScale();
}

main().catch(console.error).finally(() => prisma.$disconnect());
