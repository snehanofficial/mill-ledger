#!/usr/bin/env bash
set -e

exec > audit/evidence/verify/F-009/05-adversarial-probes.txt 2>&1

echo "=== STEP 5: ADVERSARIAL PROBES FOR F-009 ==="
echo "Timestamp: $(date -Iseconds)"

DB="mill_ledger"
export PGPASSWORD=postgres

echo "--- Setting up test invoice with POSTED status ---"
psql -U postgres -h localhost -d "$DB" -c "
  BEGIN;
  SET LOCAL mill_ledger.bypass_immutability = 'on';
  DELETE FROM sales_invoice_line WHERE \"invoiceId\" = 'adv-inv-posted';
  DELETE FROM sales_invoice WHERE id = 'adv-inv-posted';
  COMMIT;
"

psql -U postgres -h localhost -d "$DB" -c "
  INSERT INTO sales_invoice (
    id, \"organizationId\", \"invoiceNumber\", \"financialYear\", \"customerId\",
    \"customerNameSnapshot\", \"deliveryStateSnapshot\", \"companyGstinSnapshot\",
    status, \"taxableAmount\", \"cgstAmount\", \"sgstAmount\", \"igstAmount\",
    \"totalTaxAmount\", \"totalAmount\", \"outstandingAmount\", \"createdAt\", \"updatedAt\"
  ) VALUES (
    'adv-inv-posted', (SELECT id FROM organization LIMIT 1), 'INV-ADV-POSTED-001', '2026-27',
    (SELECT id FROM customer LIMIT 1), 'Original Customer Name', 'Tamil Nadu', '33AAAAA0000A1Z5',
    'POSTED', 100, 2.5, 2.5, 0, 5, 105, 105, NOW(), NOW()
  );
"

echo "--- PROBE 1: Can an attacker downgrade status from 'POSTED' to 'DRAFT'? ---"
set +e
psql -U postgres -h localhost -d "$DB" -c "UPDATE sales_invoice SET status = 'DRAFT' WHERE id = 'adv-inv-posted';"
STATUS_DOWNGRADE_EXIT=$?
set -e
echo "Status downgrade exit code: $STATUS_DOWNGRADE_EXIT (non-zero expected)"
STATUS_AFTER=$(psql -U postgres -h localhost -d "$DB" -t -A -c "SELECT status FROM sales_invoice WHERE id = 'adv-inv-posted';")
echo "Status of invoice in DB after downgrade attempt: $STATUS_AFTER"
if [ "$STATUS_AFTER" = "POSTED" ]; then
  echo "PASSED: Status downgrade from POSTED to DRAFT was prevented by trigger."
else
  echo "FAILED: Status downgrade vulnerability exists!"
  exit 1
fi

echo "--- PROBE 2: Tampering with customerNameSnapshot and companyGstinSnapshot on POSTED invoice ---"
set +e
psql -U postgres -h localhost -d "$DB" -c "
  UPDATE sales_invoice 
  SET \"customerNameSnapshot\" = 'Forged Shell Company', 
      \"companyGstinSnapshot\" = '33FORGED0000Z1Z9'
  WHERE id = 'adv-inv-posted';
"
TAMPER_SNAPSHOT_EXIT=$?
set -e
echo "Snapshot tamper exit code: $TAMPER_SNAPSHOT_EXIT (non-zero expected)"
FORGED_NAME=$(psql -U postgres -h localhost -d "$DB" -t -A -c "SELECT \"customerNameSnapshot\" FROM sales_invoice WHERE id = 'adv-inv-posted';")
echo "customerNameSnapshot after tamper attempt: $FORGED_NAME"
if [ "$FORGED_NAME" = "Original Customer Name" ]; then
  echo "PASSED: Snapshot tampering was prevented by trigger."
else
  echo "FAILED: Snapshot tampering vulnerability exists!"
  exit 1
fi

echo "--- PROBE 3: Legitimate payment allocations: Updating outstandingAmount and valid status transitions ---"
set +e
# Legitimate transition: POSTED -> PARTIALLY_PAID with updated outstandingAmount
psql -U postgres -h localhost -d "$DB" -c "
  UPDATE sales_invoice 
  SET \"outstandingAmount\" = 55, 
      status = 'PARTIALLY_PAID'
  WHERE id = 'adv-inv-posted';
"
LEGIT_PARTIAL_EXIT=$?
# Legitimate transition: PARTIALLY_PAID -> PAID with zero outstandingAmount
psql -U postgres -h localhost -d "$DB" -c "
  UPDATE sales_invoice 
  SET \"outstandingAmount\" = 0, 
      status = 'PAID'
  WHERE id = 'adv-inv-posted';
"
LEGIT_PAID_EXIT=$?
set -e
echo "Legitimate partial payment exit code: $LEGIT_PARTIAL_EXIT (0 expected)"
echo "Legitimate full payment exit code: $LEGIT_PAID_EXIT (0 expected)"
STATUS_AFTER_PAY=$(psql -U postgres -h localhost -d "$DB" -t -A -c "SELECT status, \"outstandingAmount\" FROM sales_invoice WHERE id = 'adv-inv-posted';")
echo "Invoice state after legitimate payments: $STATUS_AFTER_PAY"
if [ $LEGIT_PARTIAL_EXIT -eq 0 ] && [ $LEGIT_PAID_EXIT -eq 0 ]; then
  echo "PASSED: Legitimate payment updates and status transitions succeed without trigger interference."
else
  echo "FAILED: Trigger inappropriately blocked legitimate payment updates!"
  exit 1
fi

echo "--- PROBE 4: Concurrency: 50 parallel UPDATE attempts on stock_movement ---"
cd /home/snehan/projects/web/mill-ledger/server
pnpm exec node -e '
import("pg").then(async ({ default: pg }) => {
  const pool = new pg.Pool({ connectionString: "postgresql://postgres:postgres@localhost:5432/mill_ledger?schema=public" });
  const sm = (await pool.query("SELECT id FROM stock_movement LIMIT 1")).rows[0];
  if (!sm) {
    console.log("No stock movement found for concurrency probe");
    await pool.end();
    return;
  }
  let blockedCount = 0;
  let succeededCount = 0;
  const promises = [];
  for (let i = 0; i < 50; i++) {
    promises.push(
      pool.query("UPDATE stock_movement SET quantity = quantity + 1 WHERE id = $1", [sm.id])
        .then(() => succeededCount++)
        .catch(() => blockedCount++)
    );
  }
  await Promise.all(promises);
  console.log(`50 parallel UPDATE attempts on stock_movement: ${blockedCount} blocked, ${succeededCount} succeeded.`);
  await pool.end();
  if (succeededCount > 0) {
    process.exit(1);
  }
});
'
cd /home/snehan/projects/web/mill-ledger

echo "--- PROBE 5: Direct DELETE on POSTED invoice line ---"
psql -U postgres -h localhost -d "$DB" -c "
  BEGIN;
  SET LOCAL mill_ledger.bypass_immutability = 'on';
  INSERT INTO sales_invoice_line (
    id, \"invoiceId\", \"productVariantId\", \"productNameSnapshot\",
    \"hsnCodeSnapshot\", quantity, \"unitPrice\", \"taxRate\", \"taxableAmount\",
    \"taxAmount\", \"lineTotal\", \"createdAt\", \"updatedAt\"
  ) VALUES (
    'adv-line-posted', 'adv-inv-posted', (SELECT id FROM product_variant LIMIT 1), 'Test Product',
    '21069099', 1, 100, 5, 100, 5, 105, NOW(), NOW()
  );
  COMMIT;
"

set +e
psql -U postgres -h localhost -d "$DB" -c "DELETE FROM sales_invoice_line WHERE id = 'adv-line-posted';"
DEL_LINE_EXIT=$?
psql -U postgres -h localhost -d "$DB" -c "UPDATE sales_invoice_line SET quantity = 99 WHERE id = 'adv-line-posted';"
UPD_LINE_EXIT=$?
set -e
echo "Delete line on POSTED invoice exit: $DEL_LINE_EXIT (non-zero expected)"
echo "Update line on POSTED invoice exit: $UPD_LINE_EXIT (non-zero expected)"
if [ $DEL_LINE_EXIT -ne 0 ] && [ $UPD_LINE_EXIT -ne 0 ]; then
  echo "PASSED: Lines on posted invoice are completely immutable."
else
  echo "FAILED: Line immutability not enforced!"
  exit 1
fi

echo "--- PROBE 6: Cleanup ---"
psql -U postgres -h localhost -d "$DB" -c "
  BEGIN;
  SET LOCAL mill_ledger.bypass_immutability = 'on';
  DELETE FROM sales_invoice_line WHERE id = 'adv-line-posted';
  DELETE FROM sales_invoice WHERE id = 'adv-inv-posted';
  COMMIT;
"

echo "=== ALL ADVERSARIAL PROBES PASSED ==="
