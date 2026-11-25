#!/usr/bin/env bash
set -e

EVIDENCE_FILE="/home/snehan/projects/web/mill-ledger/audit/evidence/verify/F-097/02-original-repro.txt"
exec > "$EVIDENCE_FILE" 2>&1

echo "=== STEP 2: ORIGINAL REPRO VERIFICATION FOR F-097 ==="
echo "Timestamp: $(date -Iseconds)"

cd /home/snehan/projects/web/mill-ledger

echo "--- 1. Running original repro step 1: grep -rn 'toLocaleString' client/src/pages/ ---"
TO_LOCALE_HITS=$(grep -rn "toLocaleString" client/src/pages/ || true)
echo "$TO_LOCALE_HITS"
TO_LOCALE_COUNT=$(echo "$TO_LOCALE_HITS" | grep -v '^$' | wc -l)
echo "Total toLocaleString hits in client/src/pages/: $TO_LOCALE_COUNT"

echo "--- 2. Running original repro step 2: grep -rn 'toFixed' client/src/pages/ ---"
TO_FIXED_HITS=$(grep -rn "toFixed" client/src/pages/ || true)
echo "$TO_FIXED_HITS"
TO_FIXED_COUNT=$(echo "$TO_FIXED_HITS" | grep -v '^$' | wc -l)
echo "Total toFixed hits in client/src/pages/: $TO_FIXED_COUNT"

echo "--- 3. Verifying specific offending locations cited in F-097.md ---"

echo "Checking invoices-page.tsx around former lines 288 & 435:"
git grep -n "formatINR" client/src/pages/invoices-page.tsx | head -n 10

echo "Checking reports-page.tsx around former lines 241 & 260:"
git grep -n "formatINR\|formatDate" client/src/pages/reports-page.tsx | head -n 10

echo "Checking stock-page.tsx around former line 153:"
git grep -n "formatINR\|formatQuantity" client/src/pages/stock-page.tsx

echo "Checking purchases-page.tsx around former line 295:"
git grep -n "formatINR\|formatDate\|formatQuantity" client/src/pages/purchases-page.tsx

echo "Checking dispatch-page.tsx around former line 326:"
git grep -n "formatDateTime\|formatQuantity" client/src/pages/dispatch-page.tsx

echo "Checking payments-page.tsx around former line 782:"
git grep -n "formatINR\|formatDate" client/src/pages/payments-page.tsx | head -n 10

echo "Checking device-outbox-sheet.tsx around former line 185:"
git grep -n "formatINR\|formatTime" client/src/components/shell/device-outbox-sheet.tsx

echo "--- 4. Checking if any remaining toLocaleString / toFixed calls in client/src/pages/ are for currency or dates ---"
if [ "$TO_LOCALE_COUNT" -gt 0 ]; then
  echo "WARNING: Remaining toLocaleString occurrences found in client/src/pages/:"
  echo "$TO_LOCALE_HITS"
else
  echo "Zero toLocaleString occurrences remain in client/src/pages/."
fi

if [ "$TO_FIXED_COUNT" -gt 0 ]; then
  echo "Reviewing remaining toFixed occurrences in client/src/pages/:"
  echo "$TO_FIXED_HITS"
else
  echo "Zero toFixed occurrences remain in client/src/pages/."
fi

echo "=== STEP 2 VERIFICATION COMPLETE ==="
