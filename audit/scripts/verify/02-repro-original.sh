#!/usr/bin/env bash
set -e

exec > audit/evidence/verify/F-009/02-original-repro.txt 2>&1

echo "=== STEP 2: ORIGINAL REPRO VERIFICATION FOR F-009 ==="
echo "Timestamp: $(date -Iseconds)"

DB="mill_ledger"
export PGPASSWORD=postgres

echo "--- 1. Testing original repro: UPDATE on stock_movement ---"
set +e
psql -U postgres -h localhost -d "$DB" -c 'UPDATE "stock_movement" SET "quantity" = 0 WHERE id = (SELECT id FROM "stock_movement" LIMIT 1);'
SM_UPDATE_EXIT=$?
set -e
echo "stock_movement UPDATE exit code: $SM_UPDATE_EXIT"

echo "--- 2. Testing DELETE on stock_movement ---"
set +e
psql -U postgres -h localhost -d "$DB" -c 'DELETE FROM "stock_movement" WHERE id = (SELECT id FROM "stock_movement" LIMIT 1);'
SM_DELETE_EXIT=$?
set -e
echo "stock_movement DELETE exit code: $SM_DELETE_EXIT"

echo "--- 3. Testing POSTED sales_invoice UPDATE and DELETE ---"
psql -U postgres -h localhost -d "$DB" -c "
  BEGIN;
  SET LOCAL mill_ledger.bypass_immutability = 'on';
  DELETE FROM sales_invoice_line WHERE \"invoiceId\" IN ('repro-inv-posted', 'repro-inv-draft');
  DELETE FROM sales_invoice WHERE id IN ('repro-inv-posted', 'repro-inv-draft');
  COMMIT;
"

psql -U postgres -h localhost -d "$DB" -c "
  INSERT INTO sales_invoice (
    id, \"organizationId\", \"invoiceNumber\", \"financialYear\", \"customerId\",
    \"customerNameSnapshot\", \"deliveryStateSnapshot\", \"companyGstinSnapshot\",
    status, \"taxableAmount\", \"cgstAmount\", \"sgstAmount\", \"igstAmount\",
    \"totalTaxAmount\", \"totalAmount\", \"outstandingAmount\", \"createdAt\", \"updatedAt\"
  ) VALUES (
    'repro-inv-posted', (SELECT id FROM organization LIMIT 1), 'INV-REPRO-POSTED', '2026-27',
    (SELECT id FROM customer LIMIT 1), 'Repro Cust', 'Tamil Nadu', '33AAAAA0000A1Z5',
    'POSTED', 100, 2.5, 2.5, 0, 5, 105, 105, NOW(), NOW()
  );
"

set +e
echo "Attempting UPDATE on POSTED sales_invoice totalAmount:"
psql -U postgres -h localhost -d "$DB" -c "UPDATE sales_invoice SET \"totalAmount\" = 9999 WHERE id = 'repro-inv-posted';"
INV_UPDATE_EXIT=$?
echo "Attempting DELETE on POSTED sales_invoice:"
psql -U postgres -h localhost -d "$DB" -c "DELETE FROM sales_invoice WHERE id = 'repro-inv-posted';"
INV_DELETE_EXIT=$?
echo "Attempting status downgrade on POSTED sales_invoice:"
psql -U postgres -h localhost -d "$DB" -c "UPDATE sales_invoice SET status = 'DRAFT' WHERE id = 'repro-inv-posted';"
INV_DOWNGRADE_EXIT=$?
echo "Attempting snapshot tampering on POSTED sales_invoice:"
psql -U postgres -h localhost -d "$DB" -c "UPDATE sales_invoice SET \"customerNameSnapshot\" = 'Tampered' WHERE id = 'repro-inv-posted';"
INV_SNAPSHOT_EXIT=$?
set -e
echo "POSTED sales_invoice UPDATE exit code: $INV_UPDATE_EXIT"
echo "POSTED sales_invoice DELETE exit code: $INV_DELETE_EXIT"
echo "POSTED sales_invoice DOWNGRADE exit code: $INV_DOWNGRADE_EXIT"
echo "POSTED sales_invoice SNAPSHOT exit code: $INV_SNAPSHOT_EXIT"

echo "--- 4. Testing sales_invoice_line on POSTED invoice ---"
psql -U postgres -h localhost -d "$DB" -c "
  BEGIN;
  SET LOCAL mill_ledger.bypass_immutability = 'on';
  INSERT INTO sales_invoice_line (
    id, \"invoiceId\", \"productVariantId\", \"productNameSnapshot\",
    \"hsnCodeSnapshot\", quantity, \"unitPrice\", \"taxRate\", \"taxableAmount\",
    \"taxAmount\", \"lineTotal\", \"createdAt\", \"updatedAt\"
  ) VALUES (
    'repro-line-posted', 'repro-inv-posted', (SELECT id FROM product_variant LIMIT 1), 'Test Product',
    '21069099', 1, 100, 5, 100, 5, 105, NOW(), NOW()
  );
  COMMIT;
"

set +e
echo "Attempting UPDATE on line of POSTED sales_invoice:"
psql -U postgres -h localhost -d "$DB" -c "UPDATE sales_invoice_line SET quantity = 2 WHERE id = 'repro-line-posted';"
POSTED_LINE_UPDATE_EXIT=$?
echo "Attempting DELETE on line of POSTED sales_invoice:"
psql -U postgres -h localhost -d "$DB" -c "DELETE FROM sales_invoice_line WHERE id = 'repro-line-posted';"
POSTED_LINE_DELETE_EXIT=$?
set -e
echo "POSTED line UPDATE exit code: $POSTED_LINE_UPDATE_EXIT"
echo "POSTED line DELETE exit code: $POSTED_LINE_DELETE_EXIT"

echo "--- 5. Testing sales_invoice_line on DRAFT invoice (SHOULD BE PERMITTED) ---"
psql -U postgres -h localhost -d "$DB" -c "
  INSERT INTO sales_invoice (
    id, \"organizationId\", \"invoiceNumber\", \"financialYear\", \"customerId\",
    \"customerNameSnapshot\", \"deliveryStateSnapshot\", \"companyGstinSnapshot\",
    status, \"taxableAmount\", \"cgstAmount\", \"sgstAmount\", \"igstAmount\",
    \"totalTaxAmount\", \"totalAmount\", \"outstandingAmount\", \"createdAt\", \"updatedAt\"
  ) VALUES (
    'repro-inv-draft', (SELECT id FROM organization LIMIT 1), 'INV-REPRO-DRAFT', '2026-27',
    (SELECT id FROM customer LIMIT 1), 'Repro Cust', 'Tamil Nadu', '33AAAAA0000A1Z5',
    'DRAFT', 100, 2.5, 2.5, 0, 5, 105, 105, NOW(), NOW()
  );
"

psql -U postgres -h localhost -d "$DB" -c "
  INSERT INTO sales_invoice_line (
    id, \"invoiceId\", \"productVariantId\", \"productNameSnapshot\",
    \"hsnCodeSnapshot\", quantity, \"unitPrice\", \"taxRate\", \"taxableAmount\",
    \"taxAmount\", \"lineTotal\", \"createdAt\", \"updatedAt\"
  ) VALUES (
    'repro-line-draft', 'repro-inv-draft', (SELECT id FROM product_variant LIMIT 1), 'Test Product',
    '21069099', 1, 100, 5, 100, 5, 105, NOW(), NOW()
  );
"

set +e
echo "Attempting legitimate UPDATE on line of DRAFT sales_invoice:"
psql -U postgres -h localhost -d "$DB" -c "UPDATE sales_invoice_line SET quantity = 2 WHERE id = 'repro-line-draft';"
DRAFT_LINE_UPDATE_EXIT=$?
echo "Attempting legitimate DELETE on line of DRAFT sales_invoice:"
psql -U postgres -h localhost -d "$DB" -c "DELETE FROM sales_invoice_line WHERE id = 'repro-line-draft';"
DRAFT_LINE_DELETE_EXIT=$?
set -e
echo "DRAFT line UPDATE exit code: $DRAFT_LINE_UPDATE_EXIT (expected 0)"
echo "DRAFT line DELETE exit code: $DRAFT_LINE_DELETE_EXIT (expected 0)"

echo "--- 6. Cleaning up test records using bypass ---"
psql -U postgres -h localhost -d "$DB" -c "
  BEGIN;
  SET LOCAL mill_ledger.bypass_immutability = 'on';
  DELETE FROM sales_invoice_line WHERE id IN ('repro-line-posted', 'repro-line-draft');
  DELETE FROM sales_invoice WHERE id IN ('repro-inv-posted', 'repro-inv-draft');
  COMMIT;
"

echo "=== CONCLUSION ==="
echo "stock_movement UPDATE exit: $SM_UPDATE_EXIT (prohibited)"
echo "stock_movement DELETE exit: $SM_DELETE_EXIT (prohibited)"
echo "POSTED invoice UPDATE exit: $INV_UPDATE_EXIT (prohibited)"
echo "POSTED invoice DELETE exit: $INV_DELETE_EXIT (prohibited)"
echo "POSTED invoice DOWNGRADE exit: $INV_DOWNGRADE_EXIT (prohibited)"
echo "POSTED invoice SNAPSHOT exit: $INV_SNAPSHOT_EXIT (prohibited)"
echo "POSTED line UPDATE exit: $POSTED_LINE_UPDATE_EXIT (prohibited)"
echo "POSTED line DELETE exit: $POSTED_LINE_DELETE_EXIT (prohibited)"
echo "DRAFT line UPDATE exit: $DRAFT_LINE_UPDATE_EXIT (allowed)"
echo "DRAFT line DELETE exit: $DRAFT_LINE_DELETE_EXIT (allowed)"
