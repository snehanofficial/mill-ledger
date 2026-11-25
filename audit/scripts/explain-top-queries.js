/**
 * AUDIT-ONLY SCRIPT
 * Runs EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) on the top 20 queries
 * against mill_ledger_audit_throwaway (seeded with 100k movements, 10k orders, 5k invoices).
 */

import pg from "../../server/node_modules/pg/lib/index.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = path.resolve(__dirname, "../evidence/performance/explain/top-20-queries-explain.json");
const OUTPUT_MD = path.resolve(__dirname, "../evidence/performance/explain/top-20-queries-explain.md");

const DB_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/mill_ledger_audit_throwaway";
const ORG_ID = "cmwnfu9g300003mabr2uqrelp";
const ITEM_ID = "cmwnfua14000e3mabrdkopcsz";
const WH_ID = "cmwnfu9zy00023mab22cjz2ww";
const CUST_ID = "cmwnfua0m00093mabuugfbvmy";
const SALESMAN_ID = "mHVJCLbgKekSFFVY9aq81JbCEE56qdlc";

const QUERIES = [
  {
    id: "Q01",
    name: "Sales Register Aggregation",
    category: "Reporting",
    sql: `SELECT count(*)::int as count, sum("taxableAmount") as taxable, sum("totalAmount") as total FROM "sales_invoice" WHERE "organizationId" = '${ORG_ID}' AND "status" != 'DRAFT'`,
    purpose: "Generates summary metrics for sales register report",
  },
  {
    id: "Q02",
    name: "Sales Register Invoices Fetch",
    category: "Reporting",
    sql: `SELECT * FROM "sales_invoice" WHERE "organizationId" = '${ORG_ID}' AND "status" != 'DRAFT' ORDER BY "postedAt" DESC`,
    purpose: "Fetches detailed invoice list for sales register export",
  },
  {
    id: "Q03",
    name: "GSTR-1 Outward Supplies Aggregation",
    category: "Reporting / Statutory",
    sql: `SELECT "deliveryStateSnapshot", count(*)::int, sum("taxableAmount"), sum("cgstAmount"), sum("sgstAmount"), sum("igstAmount") FROM "sales_invoice" WHERE "organizationId" = '${ORG_ID}' AND "status" != 'DRAFT' GROUP BY "deliveryStateSnapshot"`,
    purpose: "Aggregates intra/inter-state supplies for GST outward report",
  },
  {
    id: "Q04",
    name: "Stock Summary Item Master",
    category: "Inventory",
    sql: `SELECT "id", "sku", "name", "currentStock", "weightedAverageCost" FROM "inventory_item" WHERE "organizationId" = '${ORG_ID}' AND "isActive" = true`,
    purpose: "Fetches inventory items and balances for stock valuation",
  },
  {
    id: "Q05",
    name: "Stock Movement Ledger By Item (100k Table)",
    category: "Inventory / Ledger",
    sql: `SELECT * FROM "stock_movement" WHERE "inventoryItemId" = '${ITEM_ID}' ORDER BY "postedAt" DESC`,
    purpose: "Fetches movement history for item ledger card",
  },
  {
    id: "Q06",
    name: "Stock Movement Sum & Count Aggregation (100k Table)",
    category: "Inventory / Ledger",
    sql: `SELECT "inventoryItemId", sum("quantity") as total_qty, count(*)::int as movement_count FROM "stock_movement" WHERE "inventoryItemId" = '${ITEM_ID}' GROUP BY "inventoryItemId"`,
    purpose: "Cross-checks ledger movements against currentStock balance",
  },
  {
    id: "Q07",
    name: "ATP Check Active Stock Reservations",
    category: "Sales / Inventory",
    sql: `SELECT coalesce(sum("reservedQuantity" - "releasedQuantity"), 0) as active_reserved FROM "stock_reservation" WHERE "inventoryItemId" = '${ITEM_ID}' AND "warehouseId" = '${WH_ID}' AND "status" = 'ACTIVE'`,
    purpose: "Calculates Available-to-Promise stock deduction",
  },
  {
    id: "Q08",
    name: "Sales Orders List (Admin View - 10k Orders)",
    category: "Sales",
    sql: `SELECT * FROM "sales_order" WHERE "organizationId" = '${ORG_ID}' ORDER BY "createdAt" DESC`,
    purpose: "Admin orders list view unpaginated",
  },
  {
    id: "Q09",
    name: "Sales Orders Filtered by Status (10k Orders)",
    category: "Sales",
    sql: `SELECT * FROM "sales_order" WHERE "organizationId" = '${ORG_ID}' AND "status" = 'APPROVED' ORDER BY "createdAt" DESC`,
    purpose: "Filters approved orders for dispatch scheduling",
  },
  {
    id: "Q10",
    name: "Sales Orders by Salesman (Field Sales)",
    category: "Sales",
    sql: `SELECT * FROM "sales_order" WHERE "salesmanId" = '${SALESMAN_ID}' AND "status" = 'SUBMITTED' ORDER BY "createdAt" DESC`,
    purpose: "Salesman field order list",
  },
  {
    id: "Q11",
    name: "Sales Order Lines By Order ID",
    category: "Sales",
    sql: `SELECT * FROM "sales_order_line" WHERE "salesOrderId" = 'so-scale-1'`,
    purpose: "Fetches lines for an order detail or approval modal",
  },
  {
    id: "Q12",
    name: "Sales Invoices List (Admin View - 5k Invoices)",
    category: "Finance",
    sql: `SELECT * FROM "sales_invoice" WHERE "organizationId" = '${ORG_ID}' ORDER BY "postedAt" DESC`,
    purpose: "Admin invoices list view unpaginated",
  },
  {
    id: "Q13",
    name: "Customer Invoices List (5k Invoices)",
    category: "Finance",
    sql: `SELECT * FROM "sales_invoice" WHERE "customerId" = '${CUST_ID}' AND "organizationId" = '${ORG_ID}' ORDER BY "postedAt" DESC`,
    purpose: "Customer billing history",
  },
  {
    id: "Q14",
    name: "FIFO Allocation - Open Invoices (5k Invoices)",
    category: "Finance",
    sql: `SELECT "id", "invoiceNumber", "totalAmount", "paidAmount", "outstandingAmount", "postedAt" FROM "sales_invoice" WHERE "customerId" = '${CUST_ID}' AND "outstandingAmount" > 0 AND "status" IN ('POSTED', 'PARTIALLY_PAID') ORDER BY "postedAt" ASC`,
    purpose: "Identifies oldest open invoices for FIFO payment allocation",
  },
  {
    id: "Q15",
    name: "Customer Payment Allocations Join",
    category: "Finance",
    sql: `SELECT pa.* FROM "payment_allocation" pa JOIN "sales_invoice" si ON pa."salesInvoiceId" = si."id" WHERE si."customerId" = '${CUST_ID}'`,
    purpose: "Fetches historical allocations for customer receivables ledger",
  },
  {
    id: "Q16",
    name: "Collections Register Payments Query",
    category: "Finance / Reporting",
    sql: `SELECT "id", "paymentNumber", "amount", "unallocatedAmount", "paymentMode", "paymentDate" FROM "payment" WHERE "organizationId" = '${ORG_ID}' AND "status" = 'POSTED' ORDER BY "paymentDate" DESC`,
    purpose: "Collections register report list",
  },
  {
    id: "Q17",
    name: "Receivables Overdue Invoices Query (5k Invoices)",
    category: "Finance / Reporting",
    sql: `SELECT "id", "customerId", "outstandingAmount", "postedAt", "dueDate" FROM "sales_invoice" WHERE "organizationId" = '${ORG_ID}' AND "outstandingAmount" > 0 AND "status" != 'DRAFT'`,
    purpose: "Receivables aging buckets calculation",
  },
  {
    id: "Q18",
    name: "Production Runs List",
    category: "Production",
    sql: `SELECT * FROM "production_run" WHERE "organizationId" = '${ORG_ID}' ORDER BY "createdAt" DESC`,
    purpose: "Floor production runs history",
  },
  {
    id: "Q19",
    name: "Dispatches List with Organization Filter",
    category: "Dispatch",
    sql: `SELECT * FROM "dispatch" WHERE "organizationId" = '${ORG_ID}' ORDER BY "dispatchedAt" DESC`,
    purpose: "Dispatch tracking list",
  },
  {
    id: "Q20",
    name: "Audit Log Paginated Query",
    category: "Audit",
    sql: `SELECT * FROM "audit_log" WHERE "organizationId" = '${ORG_ID}' ORDER BY "timestamp" DESC LIMIT 100`,
    purpose: "System audit log inspection",
  },
];

async function runExplainAudit() {
  const pool = new pg.Pool({ connectionString: DB_URL });
  const results = [];

  console.log("=== EXPLAIN (ANALYZE, BUFFERS) BENCHMARK ON SEEDED DATABASE ===");

  for (const q of QUERIES) {
    const explainSql = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${q.sql}`;
    try {
      const res = await pool.query(explainSql);
      const planRoot = res.rows[0]["QUERY PLAN"][0];
      const plan = planRoot.Plan;

      // Extract scan types
      const scanTypes = new Set();
      function traverse(node) {
        if (node["Node Type"]) scanTypes.add(node["Node Type"]);
        if (node.Plans) {
          for (const sub of node.Plans) traverse(sub);
        }
      }
      traverse(plan);

      const hasSeqScan = Array.from(scanTypes).some((t) => t.includes("Seq Scan"));
      const executionTimeMs = planRoot["Execution Time"];
      const planningTimeMs = planRoot["Planning Time"];
      const sharedHitBlocks = planRoot["Shared Hit Blocks"] || plan["Shared Hit Blocks"] || 0;
      const sharedReadBlocks = planRoot["Shared Read Blocks"] || plan["Shared Read Blocks"] || 0;

      results.push({
        id: q.id,
        name: q.name,
        category: q.category,
        purpose: q.purpose,
        sql: q.sql,
        executionTimeMs,
        planningTimeMs,
        sharedHitBlocks,
        sharedReadBlocks,
        nodeTypes: Array.from(scanTypes),
        hasSeqScan,
        planJson: planRoot,
      });

      console.log(
        `[${q.id}] ${q.name.padEnd(48)} Execution: ${executionTimeMs.toFixed(2).padStart(7)} ms | SeqScan: ${hasSeqScan ? "🚨 YES" : "✓ No "} | Nodes: ${Array.from(scanTypes).join(", ")}`
      );
    } catch (err) {
      console.error(`Error on ${q.id}:`, err.message);
      results.push({
        id: q.id,
        name: q.name,
        error: err.message,
      });
    }
  }

  await pool.end();

  // Save JSON
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), "utf8");
  console.log(`\nSaved raw EXPLAIN plans to: ${OUTPUT_FILE}`);

  // Generate Markdown Summary
  let md = `# PostgreSQL Query Performance & EXPLAIN (ANALYZE, BUFFERS) Report\n\n`;
  md += `- **Database**: \`mill_ledger_audit_throwaway\`\n`;
  md += `- **Scale Baseline**: 100,007 Stock Movements, 10,011 Sales Orders, 5,006 Sales Invoices\n`;
  md += `- **Date**: 2026-11-19\n\n`;
  md += `| Query ID | Name | Category | Execution (ms) | Planning (ms) | Node Types | Seq Scan Detected? |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

  for (const r of results) {
    if (r.error) {
      md += `| **${r.id}** | ${r.name} | ERROR | - | - | - | ${r.error} |\n`;
    } else {
      md += `| **${r.id}** | ${r.name} | ${r.category} | ${r.executionTimeMs.toFixed(2)} | ${r.planningTimeMs.toFixed(2)} | \`${r.nodeTypes.join(", ")}\` | ${r.hasSeqScan ? "🚨 **YES (Missing Index)**" : "✓ No"} |\n`;
    }
  }

  fs.writeFileSync(OUTPUT_MD, md, "utf8");
  console.log(`Saved Markdown summary to: ${OUTPUT_MD}`);
}

runExplainAudit().catch(console.error);
