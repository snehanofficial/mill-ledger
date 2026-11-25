/**
 * AUDIT-ONLY SCRIPT
 * Task: Compare Dashboard API metrics against raw PostgreSQL queries
 * Standards: GEMINI.md Rule E2, E9 (Real vs Expected triple)
 */
import { PrismaClient } from "@prisma/client";
import { prisma } from "../../server/src/db/client.js";

async function run() {
  console.log("=== VERIFY DASHBOARD NUMBERS AGAINST SQL ===");

  const org = await prisma.organization.findFirst({
    where: { OR: [{ id: "MILL" }, { code: "MILL" }] },
  });
  const orgId = org ? org.id : "MILL";
  console.log(`Resolved Organization: code=MILL, id=${orgId}`);

  // 1. Fetch dashboard API
  const adminCookie = await loginAdmin();
  const res = await fetch("http://localhost:4000/api/v1/dashboard?organizationId=MILL", {
    headers: {
      Cookie: adminCookie,
    },
  });

  if (!res.ok) {
    console.error("Failed to fetch dashboard API:", res.status, await res.text());
    process.exit(1);
  }

  const apiData = await res.json();
  const apiMetrics = apiData.metrics;
  console.log("Dashboard API Metrics:", JSON.stringify(apiMetrics, null, 2));

  // 2. Direct SQL Queries
  // Revenue & Invoice count
  const sqlInvoices: any[] = await prisma.$queryRaw`
    SELECT 
      COUNT(*)::int as count,
      COALESCE(SUM("totalAmount"), 0)::numeric as total_revenue
    FROM "sales_invoice"
    WHERE "organizationId" = ${orgId}
      AND "status" != 'CANCELLED_BY_CREDIT_NOTE';
  `;

  // Stock Valuation & Reconciliation
  const sqlStock: any[] = await prisma.$queryRaw`
    SELECT 
      COALESCE(SUM(i."currentStock" * i."weightedAverageCost"), 0)::numeric as stock_valuation,
      COUNT(*)::int as total_items,
      SUM(CASE WHEN ABS(i."currentStock" - COALESCE(m.movement_sum, 0)) >= 0.0001 THEN 1 ELSE 0 END)::int as unreconciled_items
    FROM "inventory_item" i
    LEFT JOIN (
      SELECT "inventoryItemId", SUM("quantity") as movement_sum
      FROM "stock_movement"
      GROUP BY "inventoryItemId"
    ) m ON i.id = m."inventoryItemId"
    WHERE i."organizationId" = ${orgId};
  `;

  // Production Units & Cost
  const sqlProduction: any[] = await prisma.$queryRaw`
    SELECT 
      COALESCE(SUM("actualGoodQty"), 0)::numeric as total_good_qty,
      COALESCE(SUM("totalRunCost"), 0)::numeric as total_run_cost
    FROM "production_run"
    WHERE "organizationId" = ${orgId}
      AND "status" = 'POSTED';
  `;

  // Collections & Unallocated
  const sqlPayments: any[] = await prisma.$queryRaw`
    SELECT 
      COALESCE(SUM("amount"), 0)::numeric as total_collections,
      COALESCE(SUM("unallocatedAmount"), 0)::numeric as total_unallocated
    FROM "payment"
    WHERE "organizationId" = ${orgId};
  `;

  // Receivables Outstanding
  const sqlReceivables: any[] = await prisma.$queryRaw`
    SELECT 
      COALESCE(SUM("outstandingAmount"), 0)::numeric as total_outstanding
    FROM "sales_invoice"
    WHERE "organizationId" = ${orgId}
      AND "status" IN ('POSTED', 'PARTIALLY_PAID');
  `;

  // Pending Orders
  const sqlOrders: any[] = await prisma.$queryRaw`
    SELECT 
      COUNT(*)::int as pending_orders
    FROM "sales_order"
    WHERE "organizationId" = ${orgId}
      AND "status" IN ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED')
      AND "fulfilmentStatus" != 'FULFILLED';
  `;

  const comparison = [
    {
      metric: "Total Revenue",
      apiValue: apiMetrics.totalRevenue,
      sqlValue: Number(sqlInvoices[0].total_revenue),
      delta: Math.abs(apiMetrics.totalRevenue - Number(sqlInvoices[0].total_revenue)),
    },
    {
      metric: "Total Invoices Count",
      apiValue: apiMetrics.totalInvoicesCount,
      sqlValue: Number(sqlInvoices[0].count),
      delta: Math.abs(apiMetrics.totalInvoicesCount - Number(sqlInvoices[0].count)),
    },
    {
      metric: "Total Stock Valuation",
      apiValue: apiMetrics.totalStockValuation,
      sqlValue: Number(sqlStock[0].stock_valuation),
      delta: Math.abs(apiMetrics.totalStockValuation - Number(sqlStock[0].stock_valuation)),
    },
    {
      metric: "Stock Reconciliation OK",
      apiValue: apiMetrics.stockReconciliationOk,
      sqlValue: sqlStock[0].unreconciled_items === 0,
      delta: apiMetrics.stockReconciliationOk === (sqlStock[0].unreconciled_items === 0) ? 0 : 1,
    },
    {
      metric: "Total Production Units",
      apiValue: apiMetrics.totalProductionUnits,
      sqlValue: Number(sqlProduction[0].total_good_qty),
      delta: Math.abs(apiMetrics.totalProductionUnits - Number(sqlProduction[0].total_good_qty)),
    },
    {
      metric: "Total Production Cost",
      apiValue: apiMetrics.totalProductionCost,
      sqlValue: Number(sqlProduction[0].total_run_cost),
      delta: Math.abs(apiMetrics.totalProductionCost - Number(sqlProduction[0].total_run_cost)),
    },
    {
      metric: "Total Collections",
      apiValue: apiMetrics.totalCollections,
      sqlValue: Number(sqlPayments[0].total_collections),
      delta: Math.abs(apiMetrics.totalCollections - Number(sqlPayments[0].total_collections)),
    },
    {
      metric: "Total Outstanding Receivables",
      apiValue: apiMetrics.totalOutstandingReceivables,
      sqlValue: Number(sqlReceivables[0].total_outstanding),
      delta: Math.abs(apiMetrics.totalOutstandingReceivables - Number(sqlReceivables[0].total_outstanding)),
    },
    {
      metric: "Unallocated Cash Credit",
      apiValue: apiMetrics.unallocatedCashCredit,
      sqlValue: Number(sqlPayments[0].total_unallocated),
      delta: Math.abs(apiMetrics.unallocatedCashCredit - Number(sqlPayments[0].total_unallocated)),
    },
    {
      metric: "Pending Orders Count",
      apiValue: apiMetrics.pendingOrdersCount,
      sqlValue: Number(sqlOrders[0].pending_orders),
      delta: Math.abs(apiMetrics.pendingOrdersCount - Number(sqlOrders[0].pending_orders)),
    },
  ];

  console.log("\n=== RECONCILIATION RESULT ===");
  console.table(comparison);

  const mismatches = comparison.filter((c) => c.delta !== 0);
  if (mismatches.length > 0) {
    console.error(`FAILED: ${mismatches.length} metrics mismatch between Dashboard API and direct SQL!`);
  } else {
    console.log("VERIFIED-PASS: All 10 dashboard metrics match raw SQL exactly!");
  }

  await prisma.$disconnect();
}

async function loginAdmin(): Promise<string> {
  const loginRes = await fetch("http://localhost:4000/api/auth/sign-in/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:5173",
    },
    body: JSON.stringify({
      email: "admin@millledger.local",
      password: "AdminPassword123!",
    }),
  });

  const cookies = (loginRes.headers as any).getSetCookie
    ? (loginRes.headers as any).getSetCookie()
    : [loginRes.headers.get("set-cookie")];
  const cookieStr = cookies
    .map((c: string) => c.split(";")[0])
    .join("; ");
  return cookieStr;
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
