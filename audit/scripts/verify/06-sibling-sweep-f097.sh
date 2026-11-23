#!/usr/bin/env bash
set -e

EVIDENCE_FILE="/home/snehan/projects/web/mill-ledger/audit/evidence/verify/F-097/06-sibling-sweep.txt"
exec > "$EVIDENCE_FILE" 2>&1

echo "=== STEP 6: SIBLING SWEEP AUDIT FOR F-097 ==="
echo "Timestamp: $(date -Iseconds)"

cd /home/snehan/projects/web/mill-ledger

echo "--- 1. Searching for all toLocale* methods across client/src and shared/src ---"
git grep -n -E '\.toLocale(String|DateString|TimeString)\(' client/src/ shared/src/ || true

echo "--- 2. Searching for all toFixed calls across client/src and shared/src ---"
git grep -n -E '\.toFixed\(' client/src/ shared/src/ || true

echo "--- 3. Searching for raw currency symbol '₹' string interpolations in client/src ---"
git grep -n -E '₹' client/src/ | grep -v 'formatters' || true

echo "--- 4. Searching for all Intl formatter instances across client, server, and shared ---"
git grep -n -E 'Intl\.(NumberFormat|DateTimeFormat)' client/src/ server/src/ shared/src/ || true

echo "--- 5. Searching for Date getter formatting patterns in client/src ---"
git grep -n -E '\.(getFullYear|getMonth|getDate)\(' client/src/ || true

echo "--- 6. Searching for toFixed in server code (excluding node_modules) ---"
git grep -n -E '\.toFixed\(' server/src/ || true

echo "=== SIBLING SWEEP AUDIT COMPLETE ==="
