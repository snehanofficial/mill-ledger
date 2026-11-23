#!/usr/bin/env bash
set -e

EVIDENCE_FILE="/home/snehan/projects/web/mill-ledger/audit/evidence/verify/F-097/03-test-validity.txt"
exec > "$EVIDENCE_FILE" 2>&1

echo "=== STEP 3: TEST VALIDITY (REVERT CHECK) FOR F-097 ==="
echo "Timestamp: $(date -Iseconds)"

SCRATCH_DIR="/tmp/mill-ledger-revert-check-f097"

echo "1. Cleaning up scratch directory..."
cd /home/snehan/projects/web/mill-ledger
git worktree remove --force "$SCRATCH_DIR" 2>/dev/null || rm -rf "$SCRATCH_DIR"

echo "2. Checking out commit e0047aa into scratch worktree $SCRATCH_DIR..."
git worktree add --detach "$SCRATCH_DIR" e0047aadb565ba164ff07f8ad499b6c8b5bbe988

cd "$SCRATCH_DIR"
pnpm install --frozen-lockfile

echo "3. Confirming test PASSES on unmutated fix commit e0047aa..."
npx vitest run client/src/lib/formatters.test.ts

echo "4. Reverting ONLY the fix files (shared/src/formatters.ts, shared/src/index.ts, client/src/lib/formatters.ts) while KEEPING the regression test..."
rm -f shared/src/formatters.ts
rm -f client/src/lib/formatters.ts
git checkout HEAD~1 -- shared/src/index.ts shared/package.json 2>/dev/null || true

echo "5. Running regression test client/src/lib/formatters.test.ts against reverted fix..."
set +e
npx vitest run client/src/lib/formatters.test.ts
REVERT_TEST_EXIT=$?
set -e

echo "Test exit code on reverted fix: $REVERT_TEST_EXIT"
if [ "$REVERT_TEST_EXIT" -eq 0 ]; then
  echo "CRITICAL FAILURE: Test passed when fix was reverted! Test proves nothing."
  exit 1
else
  echo "SUCCESS: Regression test correctly FAILED (exit code $REVERT_TEST_EXIT) when fix was reverted."
fi

echo "6. Restoring fix files and re-running test..."
git checkout HEAD -- shared/src/formatters.ts shared/src/index.ts shared/package.json client/src/lib/formatters.ts

npx vitest run client/src/lib/formatters.test.ts
RESTORE_TEST_EXIT=$?
echo "Test exit code on restored fix: $RESTORE_TEST_EXIT"

echo "7. Cleaning up scratch worktree..."
cd /home/snehan/projects/web/mill-ledger
git worktree remove --force "$SCRATCH_DIR" 2>/dev/null || rm -rf "$SCRATCH_DIR"

echo "=== STEP 3: TEST VALIDITY VERIFICATION COMPLETE ==="
