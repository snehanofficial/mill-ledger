-- ============================================================================
-- MillLedger Domain Invariant Verification Suite (Phase 2)
-- Execute against PostgreSQL: psql -f invariants.sql
-- Every check must return 0 violating rows to PASS.
-- ============================================================================

\echo '----------------------------------------------------------------------'
\echo 'INVARIANT 1: Inventory Current Stock Non-Negative'
\echo 'Condition: currentStock >= 0'
\echo '----------------------------------------------------------------------'
SELECT id, sku, name, "currentStock"
FROM "inventory_item"
WHERE "currentStock" < 0;

\echo '----------------------------------------------------------------------'
\echo 'INVARIANT 2: Stock Balance Reconciliation (currentStock vs Ledger Sum)'
\echo 'Condition: ABS(currentStock - SUM(stock_movement.quantity)) < 0.0001'
\echo '----------------------------------------------------------------------'
SELECT 
    i.id, 
    i.sku, 
    i.name, 
    i."currentStock", 
    COALESCE(SUM(sm.quantity), 0) AS ledger_sum,
    ROUND(i."currentStock" - COALESCE(SUM(sm.quantity), 0), 4) AS delta
FROM "inventory_item" i
LEFT JOIN "stock_movement" sm ON i.id = sm."inventoryItemId"
GROUP BY i.id, i.sku, i.name, i."currentStock"
HAVING ABS(i."currentStock" - COALESCE(SUM(sm.quantity), 0)) >= 0.0001;

\echo '----------------------------------------------------------------------'
\echo 'INVARIANT 3: Reservation Integrity'
\echo 'Condition: releasedQuantity <= reservedQuantity AND reservedQuantity > 0'
\echo '----------------------------------------------------------------------'
SELECT id, "salesOrderId", "inventoryItemId", "reservedQuantity", "releasedQuantity", status
FROM "stock_reservation"
WHERE "releasedQuantity" > "reservedQuantity" OR "reservedQuantity" <= 0;

\echo '----------------------------------------------------------------------'
\echo 'INVARIANT 4: Active Stock Reservations Not Exceeding Current Stock'
\echo 'Condition: SUM(active reservations) <= currentStock'
\echo '----------------------------------------------------------------------'
SELECT 
    i.id, 
    i.sku, 
    i.name, 
    i."currentStock", 
    COALESCE(SUM(r."reservedQuantity" - r."releasedQuantity"), 0) as net_reserved,
    ROUND(COALESCE(SUM(r."reservedQuantity" - r."releasedQuantity"), 0) - i."currentStock", 4) as oversold_units
FROM "inventory_item" i
JOIN "stock_reservation" r ON i.id = r."inventoryItemId" AND r.status = 'ACTIVE'
GROUP BY i.id, i.sku, i.name, i."currentStock"
HAVING COALESCE(SUM(r."reservedQuantity" - r."releasedQuantity"), 0) > i."currentStock";

\echo '----------------------------------------------------------------------'
\echo 'INVARIANT 5: Sales Invoice Header Math Integrity'
\echo 'Condition: totalAmount = taxableAmount + totalTaxAmount'
\echo '----------------------------------------------------------------------'
SELECT id, "invoiceNumber", "taxableAmount", "totalTaxAmount", "totalAmount",
       ROUND("totalAmount" - ("taxableAmount" + "totalTaxAmount"), 4) AS discrepancy
FROM "sales_invoice"
WHERE ABS("totalAmount" - ("taxableAmount" + "totalTaxAmount")) >= 0.01;

\echo '----------------------------------------------------------------------'
\echo 'INVARIANT 6: Sales Invoice Tax Breakdown Integrity'
\echo 'Condition: totalTaxAmount = cgstAmount + sgstAmount + igstAmount'
\echo '----------------------------------------------------------------------'
SELECT id, "invoiceNumber", "cgstAmount", "sgstAmount", "igstAmount", "totalTaxAmount",
       ROUND("totalTaxAmount" - ("cgstAmount" + "sgstAmount" + "igstAmount"), 4) AS tax_discrepancy
FROM "sales_invoice"
WHERE ABS("totalTaxAmount" - ("cgstAmount" + "sgstAmount" + "igstAmount")) >= 0.01;

\echo '----------------------------------------------------------------------'
\echo 'INVARIANT 7: Sales Invoice Lines vs Header Sum'
\echo 'Condition: invoice.totalAmount = SUM(invoice_line.lineTotal)'
\echo '----------------------------------------------------------------------'
SELECT 
    inv.id, 
    inv."invoiceNumber", 
    inv."totalAmount", 
    COALESCE(SUM(line."lineTotal"), 0) as lines_sum,
    ROUND(inv."totalAmount" - COALESCE(SUM(line."lineTotal"), 0), 4) as delta
FROM "sales_invoice" inv
LEFT JOIN "sales_invoice_line" line ON inv.id = line."invoiceId"
GROUP BY inv.id, inv."invoiceNumber", inv."totalAmount"
HAVING ABS(inv."totalAmount" - COALESCE(SUM(line."lineTotal"), 0)) >= 0.01;

\echo '----------------------------------------------------------------------'
\echo 'INVARIANT 8: Payment Allocation Sum Integrity'
\echo 'Condition: payment.amount = payment.unallocatedAmount + SUM(payment_allocation.amount)'
\echo '----------------------------------------------------------------------'
SELECT 
    p.id, 
    p."paymentNumber", 
    p.amount, 
    p."unallocatedAmount", 
    COALESCE(SUM(pa.amount), 0) AS allocated_sum,
    ROUND(p.amount - (p."unallocatedAmount" + COALESCE(SUM(pa.amount), 0)), 4) AS delta
FROM "payment" p
LEFT JOIN "payment_allocation" pa ON p.id = pa."paymentId"
GROUP BY p.id, p."paymentNumber", p.amount, p."unallocatedAmount"
HAVING ABS(p.amount - (p."unallocatedAmount" + COALESCE(SUM(pa.amount), 0))) >= 0.01;

\echo '----------------------------------------------------------------------'
\echo 'INVARIANT 9: Sales Invoice Outstanding Derivability'
\echo 'Condition: outstandingAmount = totalAmount - paidAmount - COALESCE(credit_notes, 0)'
\echo '----------------------------------------------------------------------'
SELECT 
    inv.id, 
    inv."invoiceNumber", 
    inv."totalAmount", 
    inv."paidAmount", 
    inv."outstandingAmount",
    COALESCE(cn_agg.cn_total, 0) as credit_notes_total,
    ROUND(inv."outstandingAmount" - (inv."totalAmount" - inv."paidAmount" - COALESCE(cn_agg.cn_total, 0)), 4) as discrepancy
FROM "sales_invoice" inv
LEFT JOIN (
    SELECT "salesInvoiceId", SUM("totalAmount") as cn_total
    FROM "credit_note"
    GROUP BY "salesInvoiceId"
) cn_agg ON inv.id = cn_agg."salesInvoiceId"
WHERE ABS(inv."outstandingAmount" - (inv."totalAmount" - inv."paidAmount" - COALESCE(cn_agg.cn_total, 0))) >= 0.01;

\echo '----------------------------------------------------------------------'
\echo 'INVARIANT 10: Document Sequences Consistency'
\echo 'Condition: document_sequences.current_value >= max document number generated'
\echo '----------------------------------------------------------------------'
SELECT 
    ds."organization_id", 
    ds."financial_year", 
    ds."current_value" AS sequence_counter,
    COUNT(inv.id) AS posted_invoices_count
FROM "document_sequences" ds
LEFT JOIN "sales_invoice" inv 
    ON ds."organization_id" = inv."organizationId" 
   AND ds."financial_year" = inv."financialYear"
WHERE ds."type" = 'SALES_INVOICE'
GROUP BY ds."organization_id", ds."financial_year", ds."current_value"
HAVING ds."current_value" < COUNT(inv.id);
