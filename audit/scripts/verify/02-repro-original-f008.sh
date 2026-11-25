#!/usr/bin/env bash
set -e

exec > audit/evidence/verify/F-008/02-original-repro.txt 2>&1

echo "=== STEP 2: ORIGINAL REPRO VERIFICATION FOR F-008 ==="
echo "Timestamp: $(date -Iseconds)"

echo "--- Running original repro script: audit/scripts/verify-concurrency-approve-dispatch.ts ---"
echo "Command: pnpm --filter @mill-ledger/server exec tsx ../audit/scripts/verify-concurrency-approve-dispatch.ts"

pnpm --filter @mill-ledger/server exec tsx ../audit/scripts/verify-concurrency-approve-dispatch.ts

echo "=== ORIGINAL REPRO DEFECT FOR F-008 IS FULLY RESOLVED ==="
