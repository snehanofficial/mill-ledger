#!/usr/bin/env bash
set -e

exec > audit/evidence/verify/F-011/04-mutation-check.txt 2>&1

echo "=== STEP 4: MUTATION CHECK FOR F-011 ==="
echo "Timestamp: $(date -Iseconds)"

SCRATCH_DIR="/tmp/mill-ledger-mutant-f011"

echo "1. Cleaning up scratch directory if any..."
cd /home/snehan/projects/web/mill-ledger
git worktree remove --force "$SCRATCH_DIR" 2>/dev/null || rm -rf "$SCRATCH_DIR"

echo "2. Setting up scratch worktree..."
git worktree add --detach "$SCRATCH_DIR" bfd9d04b8cf36e292ea730a502916c7e00292867
cd "$SCRATCH_DIR"
pnpm install --frozen-lockfile
pnpm --filter server prisma generate

echo "--- Baseline Check (Unmutated) ---"
TZ=UTC npx vitest run server/src/financial-year-tz.test.ts

echo "--- Mutant 1: Change month boundary threshold from 4 to 5 (month >= 5) ---"
sed -i 's/if (month >= 4)/if (month >= 5)/' server/src/modules/finance/finance.service.ts
set +e
TZ=UTC npx vitest run server/src/financial-year-tz.test.ts
M1_EXIT=$?
set -e
echo "Mutant 1 exit code: $M1_EXIT"
if [ $M1_EXIT -ne 0 ]; then
  echo "Mutant 1 was KILLED by test suite."
else
  echo "Mutant 1 SURVIVED!"
fi

echo "--- Mutant 2: Change timeZone to UTC instead of Asia/Kolkata ---"
git checkout -- server/src/modules/finance/finance.service.ts
sed -i 's/timeZone: "Asia\/Kolkata"/timeZone: "UTC"/' server/src/modules/finance/finance.service.ts
set +e
TZ=UTC npx vitest run server/src/financial-year-tz.test.ts
M2_EXIT=$?
set -e
echo "Mutant 2 exit code: $M2_EXIT"
if [ $M2_EXIT -ne 0 ]; then
  echo "Mutant 2 was KILLED by test suite."
else
  echo "Mutant 2 SURVIVED!"
fi

echo "--- Mutant 3: Invert month comparison (month < 4) ---"
git checkout -- server/src/modules/finance/finance.service.ts
sed -i 's/if (month >= 4)/if (month < 4)/' server/src/modules/finance/finance.service.ts
set +e
TZ=UTC npx vitest run server/src/financial-year-tz.test.ts
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

echo "=== SUMMARY OF MUTATION CHECK ==="
echo "Mutant 1 (month threshold >= 5): exit=$M1_EXIT"
echo "Mutant 2 (timeZone UTC): exit=$M2_EXIT"
echo "Mutant 3 (inverted condition): exit=$M3_EXIT"
