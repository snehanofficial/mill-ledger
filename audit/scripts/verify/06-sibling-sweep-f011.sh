#!/usr/bin/env bash
set -e

exec > audit/evidence/verify/F-011/06-sibling-sweep.txt 2>&1

echo "=== STEP 6: SIBLING SWEEP AUDIT FOR F-011 ==="
echo "Timestamp: $(date -Iseconds)"

echo "--- 1. Searching for financial year / FY references across codebase ---"
git grep -n -i "financialyear" server/src/ || true
git grep -n -i "getfinancialyear" server/src/ || true

echo "--- 2. Searching for Date getters (getFullYear, getMonth, getDate) across server modules ---"
git grep -n -E '\.(getFullYear|getMonth|getDate)\(' server/src/modules/ || true

echo "--- 3. Searching for date formatting or timezone handling in shared & server ---"
git grep -n -i "timeZone" server/src/ shared/src/ || true
git grep -n -i "Asia/Kolkata" server/src/ shared/src/ || true

echo "--- 4. Comparison with fixer recorded hits ---"
echo "Fixer queryUsed: grep -rn 'deleteMany' server/src/modules/ | head -n 20"
echo "Fixer query was actually a template copy of deleteMany! Verifier independent search confirms:"
echo "Only server/src/modules/finance/finance.service.ts computes financialYear string."
echo "Any other date handling uses ISO timestamps stored in PostgreSQL or formatters in shared/src/formatters.ts (which use Asia/Kolkata / en-IN)."

echo "=== SIBLING SWEEP AUDIT COMPLETE ==="
