#!/usr/bin/env bash
set -e

exec > audit/evidence/verify/F-011/03-test-validity.txt 2>&1

echo "=== STEP 3: TEST VALIDITY (REVERT CHECK) FOR F-011 ==="
echo "Timestamp: $(date -Iseconds)"

SCRATCH_DIR="/tmp/mill-ledger-revert-check-f011"

echo "1. Cleaning up scratch directory if any..."
cd /home/snehan/projects/web/mill-ledger
git worktree remove --force "$SCRATCH_DIR" 2>/dev/null || rm -rf "$SCRATCH_DIR"

echo "2. Checking out commit bfd9d04 into scratch worktree $SCRATCH_DIR..."
git worktree add --detach "$SCRATCH_DIR" bfd9d04b8cf36e292ea730a502916c7e00292867
cd "$SCRATCH_DIR"

echo "3. Installing dependencies and generating Prisma client..."
pnpm install --frozen-lockfile
pnpm --filter server prisma generate

echo "4. Running regression test WITH fix under TZ=UTC (should PASS)..."
set +e
TZ=UTC npx vitest run server/src/financial-year-tz.test.ts
WITH_FIX_EXIT=$?
set -e
echo "Exit code with fix: $WITH_FIX_EXIT (expected 0 / PASS)"

echo "5. Reverting ONLY the fix in server/src/modules/finance/finance.service.ts..."
# Revert to the buggy implementation that used local Date getters
cat << 'EOF' > server/src/modules/finance/finance.service.ts
import { prisma } from "../../db/client.js";

export interface IssueCreditNoteInput {
  salesInvoiceId: string;
  reason: string;
  amount: number;
}

export class FinanceService {
  /**
   * Helper to derive Indian financial year (e.g. 2025-26) from a date
   */
  getFinancialYear(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed: 0 = Jan, 3 = Apr
    if (month >= 3) {
      return `${year}-${(year + 1).toString().slice(-2)}`;
    } else {
      return `${year - 1}-${year.toString().slice(-2)}`;
    }
  }
}

export const financeService = new FinanceService();
EOF

echo "6. Running regression test WITHOUT fix under TZ=UTC (should FAIL)..."
set +e
TZ=UTC npx vitest run server/src/financial-year-tz.test.ts
WITHOUT_FIX_EXIT=$?
set -e
echo "Exit code without fix under TZ=UTC: $WITHOUT_FIX_EXIT (expected non-zero / FAIL)"

echo "7. Cleaning up scratch worktree..."
cd /home/snehan/projects/web/mill-ledger
git worktree remove --force "$SCRATCH_DIR"

echo "=== SUMMARY OF STEP 3 ==="
if [ $WITHOUT_FIX_EXIT -ne 0 ] && [ $WITH_FIX_EXIT -eq 0 ]; then
  echo "PASSED: Test fails without fix and passes with fix."
else
  echo "FAILED: Test behavior invalid: without fix exit=$WITHOUT_FIX_EXIT, with fix exit=$WITH_FIX_EXIT"
  exit 1
fi
