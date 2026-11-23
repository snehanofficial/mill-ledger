#!/usr/bin/env bash
set -e

exec > audit/evidence/verify/F-007/03-test-validity.txt 2>&1

echo "=== STEP 3: TEST VALIDITY (REVERT CHECK) FOR F-007 ==="
echo "Timestamp: $(date -Iseconds)"

SCRATCH_DIR="/tmp/mill-ledger-revert-check-f007"
DB_NAME="mill_ledger_revert_f007"

echo "1. Cleaning up scratch directory and database if any..."
cd /home/snehan/projects/web/mill-ledger
git worktree remove --force "$SCRATCH_DIR" 2>/dev/null || rm -rf "$SCRATCH_DIR"
PGPASSWORD=postgres dropdb -U postgres -h localhost --if-exists "$DB_NAME"
PGPASSWORD=postgres createdb -U postgres -h localhost "$DB_NAME"

echo "2. Checking out commit HEAD into scratch worktree $SCRATCH_DIR..."
git worktree add --detach "$SCRATCH_DIR" HEAD
cd "$SCRATCH_DIR"

echo "3. Installing dependencies and generating Prisma client..."
pnpm install --frozen-lockfile
pnpm --filter server prisma generate

export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/${DB_NAME}?schema=public"
pnpm --filter server prisma migrate deploy
pnpm --filter server db:seed

echo "4. Running regression test WITH fix (should PASS)..."
set +e
npx vitest run server/src/sales-concurrency.test.ts
WITH_FIX_EXIT=$?
set -e
echo "Exit code with fix: $WITH_FIX_EXIT (expected 0 / PASS)"

echo "5. Reverting ONLY the fix in server/src/modules/sales/sales.service.ts to 7c81a65~1..."
git checkout 7c81a65d49ae7d10d3b028e13cea071e7e0fd22e~1 server/src/modules/sales/sales.service.ts

echo "6. Running regression test WITHOUT fix (should FAIL)..."
set +e
npx vitest run server/src/sales-concurrency.test.ts
WITHOUT_FIX_EXIT=$?
set -e
echo "Exit code without fix: $WITHOUT_FIX_EXIT (expected non-zero / FAIL)"

echo "7. Restoring fix in server/src/modules/sales/sales.service.ts..."
git checkout HEAD server/src/modules/sales/sales.service.ts

echo "8. Re-running regression test WITH restored fix (should PASS)..."
set +e
npx vitest run server/src/sales-concurrency.test.ts
RESTORED_FIX_EXIT=$?
set -e
echo "Exit code with restored fix: $RESTORED_FIX_EXIT (expected 0 / PASS)"

echo "9. Cleaning up scratch worktree and db..."
cd /home/snehan/projects/web/mill-ledger
git worktree remove --force "$SCRATCH_DIR"
PGPASSWORD=postgres dropdb -U postgres -h localhost "$DB_NAME"

echo "=== SUMMARY OF STEP 3 FOR F-007 ==="
if [ $WITHOUT_FIX_EXIT -ne 0 ] && [ $WITH_FIX_EXIT -eq 0 ] && [ $RESTORED_FIX_EXIT -eq 0 ]; then
  echo "PASSED: Regression test fails without fix ($WITHOUT_FIX_EXIT) and passes with fix ($WITH_FIX_EXIT)."
else
  echo "FAILED: Test behavior invalid: without fix exit=$WITHOUT_FIX_EXIT, with fix exit=$WITH_FIX_EXIT, restored exit=$RESTORED_FIX_EXIT"
  exit 1
fi
