#!/usr/bin/env bash
set -e

exec > audit/evidence/verify/F-009/04-mutation-check.txt 2>&1

echo "=== STEP 4: MUTATION CHECK FOR F-009 ==="
echo "Timestamp: $(date -Iseconds)"

SCRATCH_DIR="/tmp/mill-ledger-mutant-f009"
DB_NAME="mill_ledger_mutant_f009"

echo "1. Cleaning up scratch directory and db..."
cd /home/snehan/projects/web/mill-ledger
git worktree remove --force "$SCRATCH_DIR" 2>/dev/null || rm -rf "$SCRATCH_DIR"
PGPASSWORD=postgres dropdb -U postgres -h localhost --if-exists "$DB_NAME"
PGPASSWORD=postgres createdb -U postgres -h localhost "$DB_NAME"

echo "2. Setting up scratch worktree..."
git worktree add --detach "$SCRATCH_DIR" ba71207ae75581b11bd721c95c3a00cfa8730500
cd "$SCRATCH_DIR"
pnpm install --frozen-lockfile
pnpm --filter server prisma generate
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/${DB_NAME}?schema=public"
pnpm --filter server prisma migrate deploy
pnpm --filter server db:seed

echo "--- Testing Baseline (Unmutated) ---"
npx vitest run server/src/db-immutability.test.ts

echo "--- Mutant 1: Allow stock_movement UPDATE (RETURN NEW instead of RAISE EXCEPTION) ---"
sed -i 's/RAISE EXCEPTION '\''Stock movements are immutable: % on stock_movement is prohibited'\'', TG_OP;/RETURN NEW;/' server/prisma/migrations/20261120000002_ledger_immutability_triggers/migration.sql
PGPASSWORD=postgres psql -U postgres -h localhost -d "$DB_NAME" -f server/prisma/migrations/20261120000002_ledger_immutability_triggers/migration.sql

set +e
npx vitest run server/src/db-immutability.test.ts
M1_EXIT=$?
set -e
echo "Mutant 1 exit code: $M1_EXIT"
if [ $M1_EXIT -ne 0 ]; then
  echo "Mutant 1 was KILLED by test suite."
else
  echo "Mutant 1 SURVIVED!"
fi

echo "--- Mutant 2: Allow totalAmount UPDATE on POSTED invoice ---"
git checkout -- server/prisma/migrations/20261120000002_ledger_immutability_triggers/migration.sql
sed -i 's/OLD."totalAmount" IS DISTINCT FROM NEW."totalAmount"/FALSE/' server/prisma/migrations/20261120000002_ledger_immutability_triggers/migration.sql
PGPASSWORD=postgres psql -U postgres -h localhost -d "$DB_NAME" -f server/prisma/migrations/20261120000002_ledger_immutability_triggers/migration.sql

set +e
npx vitest run server/src/db-immutability.test.ts
M2_EXIT=$?
set -e
echo "Mutant 2 exit code: $M2_EXIT"
if [ $M2_EXIT -ne 0 ]; then
  echo "Mutant 2 was KILLED by test suite."
else
  echo "Mutant 2 SURVIVED!"
fi

echo "--- Mutant 3: Allow sales_invoice_line UPDATE/DELETE on POSTED invoice ---"
git checkout -- server/prisma/migrations/20261120000002_ledger_immutability_triggers/migration.sql
sed -i 's/RAISE EXCEPTION '\''Lines belonging to posted sales invoices are immutable'\'';/RETURN NEW;/' server/prisma/migrations/20261120000002_ledger_immutability_triggers/migration.sql
PGPASSWORD=postgres psql -U postgres -h localhost -d "$DB_NAME" -f server/prisma/migrations/20261120000002_ledger_immutability_triggers/migration.sql

set +e
npx vitest run server/src/db-immutability.test.ts
M3_EXIT=$?
set -e
echo "Mutant 3 exit code: $M3_EXIT"
if [ $M3_EXIT -ne 0 ]; then
  echo "Mutant 3 was KILLED by test suite."
else
  echo "Mutant 3 SURVIVED!"
fi

echo "--- Mutant 4: Allow status downgrade from POSTED to DRAFT ---"
git checkout -- server/prisma/migrations/20261120000002_ledger_immutability_triggers/migration.sql
sed -i 's/RAISE EXCEPTION '\''Posted sales invoice status cannot be downgraded from % to %'\'', OLD.status, NEW.status;/RETURN NEW;/' server/prisma/migrations/20261120000002_ledger_immutability_triggers/migration.sql
PGPASSWORD=postgres psql -U postgres -h localhost -d "$DB_NAME" -f server/prisma/migrations/20261120000002_ledger_immutability_triggers/migration.sql

set +e
npx vitest run server/src/db-immutability.test.ts
M4_EXIT=$?
set -e
echo "Mutant 4 exit code: $M4_EXIT"
if [ $M4_EXIT -ne 0 ]; then
  echo "Mutant 4 was KILLED by test suite."
else
  echo "Mutant 4 SURVIVED!"
fi

echo "--- Mutant 5: Allow snapshot fields mutation ---"
git checkout -- server/prisma/migrations/20261120000002_ledger_immutability_triggers/migration.sql
sed -i 's/RAISE EXCEPTION '\''Posted sales invoice snapshot fields are immutable'\'';/RETURN NEW;/' server/prisma/migrations/20261120000002_ledger_immutability_triggers/migration.sql
PGPASSWORD=postgres psql -U postgres -h localhost -d "$DB_NAME" -f server/prisma/migrations/20261120000002_ledger_immutability_triggers/migration.sql

set +e
npx vitest run server/src/db-immutability.test.ts
M5_EXIT=$?
set -e
echo "Mutant 5 exit code: $M5_EXIT"
if [ $M5_EXIT -ne 0 ]; then
  echo "Mutant 5 was KILLED by test suite."
else
  echo "Mutant 5 SURVIVED!"
fi

echo "--- Cleanup ---"
cd /home/snehan/projects/web/mill-ledger
git worktree remove --force "$SCRATCH_DIR"
PGPASSWORD=postgres dropdb -U postgres -h localhost "$DB_NAME"

echo "=== SUMMARY OF MUTATION CHECK ==="
echo "Mutant 1 (allow stock UPDATE): exit=$M1_EXIT"
echo "Mutant 2 (allow invoice total UPDATE): exit=$M2_EXIT"
echo "Mutant 3 (allow line UPDATE/DELETE): exit=$M3_EXIT"
echo "Mutant 4 (allow status downgrade): exit=$M4_EXIT"
echo "Mutant 5 (allow snapshot mutation): exit=$M5_EXIT"
