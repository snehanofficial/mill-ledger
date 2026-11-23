#!/usr/bin/env bash
set -e

mkdir -p audit/evidence/verify/F-007
exec > audit/evidence/verify/F-007/04-mutation-check.txt 2>&1

echo "=== STEP 4: MUTATION CHECK FOR F-007 ==="
echo "Timestamp: $(date -Iseconds)"

SCRATCH_DIR="/tmp/mill-ledger-mutant-f007"
DB_NAME="mill_ledger_mutant_f007"

echo "1. Cleaning up scratch directory and db..."
cd /home/snehan/projects/web/mill-ledger
git worktree remove --force "$SCRATCH_DIR" 2>/dev/null || rm -rf "$SCRATCH_DIR"
PGPASSWORD=postgres dropdb -U postgres -h localhost --if-exists "$DB_NAME"
PGPASSWORD=postgres createdb -U postgres -h localhost "$DB_NAME"

echo "2. Setting up scratch worktree at commit HEAD..."
git worktree add --detach "$SCRATCH_DIR" HEAD
cd "$SCRATCH_DIR"
pnpm install --frozen-lockfile
pnpm --filter server prisma generate
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/${DB_NAME}?schema=public"
pnpm --filter server prisma migrate deploy
pnpm --filter server db:seed

echo "--- Testing Baseline (Unmutated) ---"
npx vitest run server/src/sales-concurrency.test.ts

echo "--- Mutant 1: Remove FOR UPDATE row-level lock from inventory_item query ---"
sed -i 's/FOR UPDATE//' server/src/modules/sales/sales.service.ts
set +e
npx vitest run server/src/sales-concurrency.test.ts
M1_EXIT=$?
set -e
echo "Mutant 1 exit code: $M1_EXIT"
if [ $M1_EXIT -ne 0 ]; then
  echo "Mutant 1 was KILLED by test suite."
else
  echo "Mutant 1 SURVIVED!"
fi

echo "--- Mutant 2: Ignore active reservations (available = onHand) ---"
git checkout -- server/src/modules/sales/sales.service.ts
sed -i 's/const available = Math.max(0, onHand - reserved);/const available = onHand;/' server/src/modules/sales/sales.service.ts
set +e
npx vitest run server/src/sales-concurrency.test.ts
M2_EXIT=$?
set -e
echo "Mutant 2 exit code: $M2_EXIT"
if [ $M2_EXIT -ne 0 ]; then
  echo "Mutant 2 was KILLED by test suite."
else
  echo "Mutant 2 SURVIVED!"
fi

echo "--- Mutant 3: Invert stock sufficiency comparison (available > approvedQty instead of available < approvedQty) ---"
git checkout -- server/src/modules/sales/sales.service.ts
sed -i 's/if (available < approvedQty)/if (available > approvedQty)/' server/src/modules/sales/sales.service.ts
set +e
npx vitest run server/src/sales-concurrency.test.ts
M3_EXIT=$?
set -e
echo "Mutant 3 exit code: $M3_EXIT"
if [ $M3_EXIT -ne 0 ]; then
  echo "Mutant 3 was KILLED by test suite."
else
  echo "Mutant 3 SURVIVED!"
fi

echo "--- Cleanup ---"
cd /home/snehan/projects/web/mill-ledger
git worktree remove --force "$SCRATCH_DIR"
PGPASSWORD=postgres dropdb -U postgres -h localhost "$DB_NAME"

echo "=== SUMMARY OF MUTATION CHECK FOR F-007 ==="
echo "Mutant 1 (remove FOR UPDATE lock): exit=$M1_EXIT"
echo "Mutant 2 (ignore reservations): exit=$M2_EXIT"
echo "Mutant 3 (inverted availability check): exit=$M3_EXIT"
