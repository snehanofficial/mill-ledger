#!/usr/bin/env bash
set -e

mkdir -p audit/evidence/verify/F-008
exec > audit/evidence/verify/F-008/04-mutation-check.txt 2>&1

echo "=== STEP 4: MUTATION CHECK FOR F-008 ==="
echo "Timestamp: $(date -Iseconds)"

SCRATCH_DIR="/tmp/mill-ledger-mutant-f008"
DB_NAME="mill_ledger_mutant_f008"

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
npx vitest run server/src/dispatch-concurrency.test.ts

echo "--- Mutant 1: Remove sequence increment in ON CONFLICT (no + 1) ---"
sed -i 's/"current_value" = "document_sequences"."current_value" + 1/"current_value" = "document_sequences"."current_value"/' server/src/modules/finance/sequence.service.ts
set +e
npx vitest run server/src/dispatch-concurrency.test.ts
M1_EXIT=$?
set -e
echo "Mutant 1 exit code: $M1_EXIT"
if [ $M1_EXIT -ne 0 ]; then
  echo "Mutant 1 was KILLED by test suite."
else
  echo "Mutant 1 SURVIVED!"
fi

echo "--- Mutant 2: Hardcode static dispatch number suffix (always -0001) ---"
git checkout -- server/src/modules/finance/sequence.service.ts
sed -i 's/return `DSP-${year}-${seq.toString().padStart(4, "0")}`;/return `DSP-${year}-0001`;/' server/src/modules/finance/sequence.service.ts
set +e
npx vitest run server/src/dispatch-concurrency.test.ts
M2_EXIT=$?
set -e
echo "Mutant 2 exit code: $M2_EXIT"
if [ $M2_EXIT -ne 0 ]; then
  echo "Mutant 2 was KILLED by test suite."
else
  echo "Mutant 2 SURVIVED!"
fi

echo "--- Mutant 3: Truncate sequence padding to 1 char (causes collisions beyond 9) ---"
git checkout -- server/src/modules/finance/sequence.service.ts
sed -i 's/seq.toString().padStart(4, "0")/seq.toString().padStart(1, "0")/' server/src/modules/finance/sequence.service.ts
set +e
npx vitest run server/src/dispatch-concurrency.test.ts
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

echo "=== SUMMARY OF MUTATION CHECK FOR F-008 ==="
echo "Mutant 1 (no sequence increment on conflict): exit=$M1_EXIT"
echo "Mutant 2 (hardcoded dispatch number suffix): exit=$M2_EXIT"
echo "Mutant 3 (truncated sequence padding): exit=$M3_EXIT"
