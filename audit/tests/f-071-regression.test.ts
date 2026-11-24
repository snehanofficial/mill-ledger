import { describe, it, expect } from "vitest";
import { prisma } from "../../server/src/db/client.js";

describe("F-071 Regression: Foreign Key & Composite Indexing Architecture", () => {
  it("confirms all 7 foreign key and composite indexes exist in pg_indexes", async () => {
    const rows = await prisma.$queryRaw<
      Array<{ indexname: string; tablename: string }>
    >`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'sales_order_line_salesOrderId_idx',
          'sales_invoice_line_invoiceId_idx',
          'sales_invoice_customerId_status_postedAt_idx',
          'sales_invoice_organizationId_postedAt_idx',
          'sales_invoice_organizationId_status_idx',
          'sales_order_organizationId_createdAt_idx',
          'sales_order_customerId_idx',
          'stock_movement_inventoryItemId_postedAt_idx'
        );
    `;

    const indexNames = rows.map((r) => r.indexname);
    expect(indexNames).toContain("sales_order_line_salesOrderId_idx");
    expect(indexNames).toContain("sales_invoice_line_invoiceId_idx");
    expect(indexNames).toContain(
      "sales_invoice_customerId_status_postedAt_idx",
    );
    expect(indexNames).toContain("sales_invoice_organizationId_postedAt_idx");
    expect(indexNames).toContain("sales_invoice_organizationId_status_idx");
    expect(indexNames).toContain("sales_order_organizationId_createdAt_idx");
    expect(indexNames).toContain("sales_order_customerId_idx");
    expect(indexNames).toContain("stock_movement_inventoryItemId_postedAt_idx");
    expect(rows.length).toBeGreaterThanOrEqual(8);
  });

  it("proves PostgreSQL created btree indexes for foreign key lookups", async () => {
    const rows = await prisma.$queryRaw<
      Array<{ indexname: string; indexdef: string }>
    >`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'sales_order_line_salesOrderId_idx',
          'sales_invoice_line_invoiceId_idx'
        );
    `;

    for (const row of rows) {
      expect(row.indexdef).toContain("USING btree");
      if (row.indexname === "sales_order_line_salesOrderId_idx") {
        expect(row.indexdef).toContain('"salesOrderId"');
      }
      if (row.indexname === "sales_invoice_line_invoiceId_idx") {
        expect(row.indexdef).toContain('"invoiceId"');
      }
    }
  });

  it("proves PostgreSQL created composite btree index with sort order for stock ledger traversal", async () => {
    const rows = await prisma.$queryRaw<
      Array<{ indexname: string; indexdef: string }>
    >`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'stock_movement_inventoryItemId_postedAt_idx';
    `;

    expect(rows.length).toBe(1);
    expect(rows[0].indexdef).toContain('"inventoryItemId"');
    expect(rows[0].indexdef).toContain('"postedAt" DESC');
    expect(rows[0].indexdef).toContain("USING btree");
  });
});
