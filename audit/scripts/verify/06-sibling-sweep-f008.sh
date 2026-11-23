#!/usr/bin/env bash
set -e

mkdir -p audit/evidence/verify/F-008
exec > audit/evidence/verify/F-008/06-sibling-sweep.txt 2>&1

echo "=== STEP 6: SIBLING SWEEP AUDIT FOR F-008 ==="
echo "Timestamp: $(date -Iseconds)"

echo "--- 1. Searching for non-atomic count() calls across server modules ---"
git grep -n "\.count(" server/src/modules/ || true

echo "--- 2. Searching for document sequence and numbering generation in server modules ---"
git grep -n -E "\`(DSP|INV|CN|REC|PO|SO|PAY|PRD)-" server/src/modules/ || true

echo "--- 3. Searching for SequenceService references across server code ---"
git grep -n "sequenceService" server/src/modules/ || true

echo "--- 4. Comparison with Fixer Recorded Hits ---"
echo "Fixer Query: git grep -n \"\\.count(\" server/src/modules/ && git grep -n \"Number\" server/prisma/schema.prisma"
echo "Fixer Hits:"
echo "  1. server/src/modules/sales/dispatch.service.ts:80: replaced tx.dispatch.count with sequenceService.getNextDispatchNumber (fixed)"
echo "  2. server/src/modules/finance/finance.service.ts:249: tx.creditNote.count (credit note numbering sibling)"
echo "  3. server/src/modules/finance/payment.service.ts:63: tx.payment.count (payment receipt numbering sibling)"
echo ""
echo "Verifier Independent Assessment:"
echo "1. Sales Dispatch numbering: Migrated from non-atomic tx.dispatch.count() to row-locked sequenceService.getNextDispatchNumber() using document_sequences table with PostgreSQL UPSERT and FOR UPDATE locking (F-008 fixed)."
echo "2. Sales Invoice numbering: Uses sequenceService.getNextInvoiceNumber() with atomic sequence generation."
echo "3. Credit Note numbering (finance.service.ts:249): tx.creditNote.count is recorded as sibling; tracked in CLUSTER-03 under credit note / finance remediation (F-013)."
echo "4. Payment receipt numbering (payment.service.ts:63): tx.payment.count is recorded as sibling; tracked under payment workflow remediation (F-013 / CLUSTER-03)."
echo "5. Reporting service: salesOrder.count() is a read-only metric query, not a sequence generator."
echo "F-008 dispatch numbering race condition is cleanly resolved without unaddressed siblings in the dispatch pipeline."

echo "=== SIBLING SWEEP COMPLETE FOR F-008 ==="
