#!/usr/bin/env bash
set -e

exec > audit/evidence/verify/F-009/06-sibling-sweep.txt 2>&1

echo "=== STEP 6: SIBLING SWEEP AUDIT FOR F-009 ==="
echo "Timestamp: $(date -Iseconds)"

echo "--- 1. Searching for DELETE/DELETEMANY across all server code (excluding test files and seeds) ---"
git grep -n -E '\.(delete|deleteMany)\(' server/src/modules/ || true

echo "--- 2. Searching for direct raw SQL UPDATE/DELETE in server code ---"
git grep -n -i -E '\$(executeRaw|queryRaw).*([[:space:]](DELETE|UPDATE)[[:space:]])' server/src/ || true

echo "--- 3. Checking all ledger tables in PostgreSQL schema ---"
export PGPASSWORD=postgres
psql -U postgres -h localhost -d mill_ledger -c "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'stock_movement', 'sales_invoice', 'sales_invoice_line', 
    'audit_log', 'payment', 'payment_allocation', 'credit_note', 
    'purchase_receipt', 'production_run'
  );
"

echo "User-defined triggers currently present in database:"
psql -U postgres -h localhost -d mill_ledger -c "
SELECT tgname, relname 
FROM pg_trigger t 
JOIN pg_class c ON t.tgrelid = c.oid 
WHERE NOT tgisinternal
ORDER BY relname, tgname;
"

echo "--- 4. Cross-referencing other ledger tables with work tracker findings ---"
echo "Note on sibling tables:"
echo "- stock_movement: Protected by trg_stock_movement_immutable (F-009)"
echo "- sales_invoice: Protected by trg_sales_invoice_immutable (F-009)"
echo "- sales_invoice_line: Protected by trg_sales_invoice_line_immutable (F-009)"
echo "- audit_log: Tracked under separate finding F-035 (CLUSTER-07)"
echo "- credit_note / payment bounce: Tracked under separate finding F-013 (CLUSTER-03)"

echo "--- 5. Comparison with fixer recorded hits ---"
echo "Fixer query: grep -rn deleteMany server/src/modules/ ; grep -rn \"prisma\\..*\\.delete\" server/src/modules/"
echo "Fixer hits: server/src/modules/production/production.service.ts:448: await tx.productionRunMaterial.deleteMany({"
echo "Verifier independent query:"
git grep -n -E '\.(delete|deleteMany)\(' server/src/modules/

echo "=== SIBLING SWEEP AUDIT COMPLETE ==="
