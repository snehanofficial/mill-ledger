#!/usr/bin/env bash
set -e

EVIDENCE_FILE="/home/snehan/projects/web/mill-ledger/audit/evidence/verify/F-097/04-mutation-check.txt"
exec > "$EVIDENCE_FILE" 2>&1

echo "=== STEP 4: MUTATION CHECK FOR F-097 ==="
echo "Timestamp: $(date -Iseconds)"

SCRATCH_DIR="/tmp/mill-ledger-mutant-f097"

echo "1. Cleaning up scratch directory..."
cd /home/snehan/projects/web/mill-ledger
git worktree remove --force "$SCRATCH_DIR" 2>/dev/null || rm -rf "$SCRATCH_DIR"

echo "2. Checking out commit e0047aa into scratch worktree $SCRATCH_DIR..."
git worktree add --detach "$SCRATCH_DIR" e0047aadb565ba164ff07f8ad499b6c8b5bbe988
cd "$SCRATCH_DIR"
pnpm install --frozen-lockfile

# Helper function to run test against a mutant
run_mutant() {
  local MUTANT_NAME="$1"
  echo "----------------------------------------------------"
  echo "Testing $MUTANT_NAME..."
  set +e
  npx vitest run client/src/lib/formatters.test.ts
  local EXIT_CODE=$?
  set -e
  if [ "$EXIT_CODE" -ne 0 ]; then
    echo "RESULT: CAUGHT (exit code: $EXIT_CODE) - Test suite successfully killed the mutant."
  else
    echo "RESULT: SURVIVED (exit code: 0) - Mutant survived! Regression test failed to detect this mutation."
  fi
  # Restore original file
  git checkout HEAD -- shared/src/formatters.ts
}

echo "3. Mutant 1: Change formatINR locale from 'en-IN' to 'en-US' (Western 3-digit thousands instead of Lakhs/Crores)"
sed -i 's/"en-IN"/"en-US"/g' shared/src/formatters.ts
run_mutant "Mutant 1: en-US locale instead of en-IN"

echo "4. Mutant 2: Disable NaN / non-finite guard in formatINR (let NaN flow to Intl or return empty string)"
sed -i 's/return symbol ? fallback : "0.00";/return "SURVIVED_MUTANT";/' shared/src/formatters.ts
run_mutant "Mutant 2: Corrupted NaN / invalid fallback"

echo "5. Mutant 3: Invert formatDateShort day/month format (MM/DD/YYYY instead of DD/MM/YYYY)"
sed -i 's/day: "2-digit", month: "2-digit"/month: "2-digit", day: "numeric"/' shared/src/formatters.ts
run_mutant "Mutant 3: Mismatched short date day/month ordering"

echo "6. Mutant 4: Change default fraction digits from 2 to 0 in formatINR"
sed -i 's/minimumFractionDigits = 2/minimumFractionDigits = 0/' shared/src/formatters.ts
sed -i 's/maximumFractionDigits = 2/maximumFractionDigits = 0/' shared/src/formatters.ts
run_mutant "Mutant 4: Zero fraction digits default in formatINR"

echo "7. Cleaning up scratch worktree..."
cd /home/snehan/projects/web/mill-ledger
git worktree remove --force "$SCRATCH_DIR" 2>/dev/null || rm -rf "$SCRATCH_DIR"

echo "=== STEP 4: MUTATION CHECK COMPLETE ==="
