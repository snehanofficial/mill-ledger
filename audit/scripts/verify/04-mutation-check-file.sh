#!/usr/bin/env bash
set -e

exec > audit/evidence/verify/F-009/04-mutation-check-file.txt 2>&1

echo "=== STEP 4b: MUTATION CHECK WITH MUTATED MIGRATION FILE ==="
echo "Timestamp: $(date -Iseconds)"

SCRATCH_DIR="/tmp/mill-ledger-mutant-f009"
DB_NAME="mill_ledger_mutant_f009"

echo "1. Cleaning up scratch directory and db..."
cd /home/snehan/projects/web/mill-ledger
git worktree remove --force "$SCRATCH_DIR" 2>/dev/null || rm -rf "$SCRATCH_DIR"
PGPASSWORD=postgres dropdb -U postgres -h localhost --if-exists "$DB_NAME"
PGPASSWORD=postgres createdb -U postgres -h localhost "$DB_NAME"

echo "2. Setting up scratch worktree..."
git worktree add --detach "$SCRATCH_DIR" af12729225d5acc2312118d99080a1c8a72f557f
cd "$SCRATCH_DIR"
pnpm install --frozen-lockfile
pnpm --filter server prisma generate
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/${DB_NAME}?schema=public"
pnpm --filter server prisma migrate deploy
pnpm --filter server db:seed

echo "3. Mutant A: Invert stock_movement UPDATE prohibition (allow UPDATE)"
sed -i 's/RAISE EXCEPTION '\''Stock movements are immutable/RETURN NEW; --/' server/prisma/migrations/20261120000002_ledger_immutability_triggers/migration.sql

set +e
npx vitest run server/src/db-immutability.test.ts
MA_EXIT=$?
set -e
echo "Mutant A exit code: $MA_EXIT"
if [ $MA_EXIT -ne 0 ]; then
  echo "Mutant A was KILLED by test suite."
else
  echo "Mutant A SURVIVED!"
fi

echo "4. Restoring and testing Mutant B: Allow totalAmount UPDATE on POSTED invoice"
git checkout -- server/prisma/migrations/20261120000002_ledger_immutability_triggers/migration.sql
sed -i 's/OLD."totalAmount" IS DISTINCT FROM NEW."totalAmount"/FALSE/' server/prisma/migrations/20261120000002_ledger_immutability_triggers/migration.sql

set +e
npx vitest run server/src/db-immutability.test.ts
MB_EXIT=$?
set -e
echo "Mutant B exit code: $MB_EXIT"
if [ $MB_EXIT -ne 0 ]; then
  echo "Mutant B was KILLED by test suite."
else
  echo "Mutant B SURVIVED!"
fi

echo "5. Restoring and testing Mutant C: Mutate sales_invoice_line logic"
git checkout -- server/prisma/migrations/20261120000002_ledger_immutability_triggers/migration.sql
sed -i 's/Lines belonging to posted sales invoices are immutable/ALLOWED/' server/prisma/migrations/20261120000002_ledger_immutability_triggers/migration.sql
sed -i 's/RAISE EXCEPTION '\''ALLOWED'\'';/RETURN NEW;/' server/prisma/migrations/20261120000002_ledger_immutability_triggers/migration.sql

set +e
npx vitest run server/src/db-immutability.test.ts
MC_EXIT=$?
set -e
echo "Mutant C exit code: $MC_EXIT"
if [ $MC_EXIT -eq 0 ]; then
  echo "Mutant C SURVIVED! (sales_invoice_line has no coverage in db-immutability.test.ts)"
else
  echo "Mutant C was KILLED."
fi

echo "6. Cleanup..."
cd /home/snehan/projects/web/mill-ledger
git worktree remove --force "$SCRATCH_DIR"
PGPASSWORD=postgres dropdb -U postgres -h localhost "$DB_NAME"

echo "=== STEP 4b COMPLETE ==="
