#!/usr/bin/env bash
set -e

exec > audit/evidence/verify/F-009/03-test-validity.txt 2>&1

echo "=== STEP 3: TEST VALIDITY (REVERT CHECK) FOR F-009 ==="
echo "Timestamp: $(date -Iseconds)"

SCRATCH_DIR="/tmp/mill-ledger-revert-check-f009"
DB_NAME="mill_ledger_revert_check_f009"

echo "1. Cleaning up scratch directory and db..."
cd /home/snehan/projects/web/mill-ledger
git worktree remove --force "$SCRATCH_DIR" 2>/dev/null || rm -rf "$SCRATCH_DIR"
PGPASSWORD=postgres dropdb -U postgres -h localhost --if-exists "$DB_NAME"
PGPASSWORD=postgres createdb -U postgres -h localhost "$DB_NAME"

echo "2. Checking out ba71207 into scratch worktree $SCRATCH_DIR..."
git worktree add --detach "$SCRATCH_DIR" ba71207ae75581b11bd721c95c3a00cfa8730500
cd "$SCRATCH_DIR"

echo "3. Installing and generating prisma client in scratch worktree..."
pnpm install --frozen-lockfile
pnpm --filter server prisma generate

export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/${DB_NAME}?schema=public"

echo "4. Running baseline migrations (WITHOUT the F-009 migration)..."
# Revert ONLY the fix: remove the migration file/folder
rm -rf server/prisma/migrations/20261120000002_ledger_immutability_triggers
pnpm --filter server prisma migrate deploy
pnpm --filter server db:seed

echo "5. Running regression test WITHOUT the fix applied (should FAIL)..."
set +e
npx vitest run server/src/db-immutability.test.ts
WITHOUT_FIX_EXIT=$?
set -e
echo "Exit code without fix: $WITHOUT_FIX_EXIT (expected non-zero / FAIL)"

echo "6. Now restoring the fix (re-adding migration and deploying triggers)..."
git checkout ba71207ae75581b11bd721c95c3a00cfa8730500 -- server/prisma/migrations/20261120000002_ledger_immutability_triggers
pnpm --filter server prisma migrate deploy

echo "7. Running regression test WITH the fix applied (should PASS)..."
set +e
npx vitest run server/src/db-immutability.test.ts
WITH_FIX_EXIT=$?
set -e
echo "Exit code with fix: $WITH_FIX_EXIT (expected 0 / PASS)"

echo "8. Cleaning up scratch worktree and db..."
cd /home/snehan/projects/web/mill-ledger
git worktree remove --force "$SCRATCH_DIR"
PGPASSWORD=postgres dropdb -U postgres -h localhost "$DB_NAME"

echo "=== SUMMARY OF STEP 3 ==="
if [ $WITHOUT_FIX_EXIT -ne 0 ] && [ $WITH_FIX_EXIT -eq 0 ]; then
  echo "PASSED: Test fails without fix and passes with fix."
else
  echo "FAILED: Test behavior invalid: without fix exit=$WITHOUT_FIX_EXIT, with fix exit=$WITH_FIX_EXIT"
  exit 1
fi
