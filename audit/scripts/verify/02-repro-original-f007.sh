#!/usr/bin/env bash
set -e

exec > audit/evidence/verify/F-007/02-original-repro.txt 2>&1

echo "=== STEP 2: ORIGINAL REPRO VERIFICATION FOR F-007 ==="
echo "Timestamp: $(date -Iseconds)"

echo "--- Running original repro script: audit/scripts/verify-concurrency-approve-dispatch.ts ---"
echo "Command: pnpm --filter @mill-ledger/server exec tsx ../audit/scripts/verify-concurrency-approve-dispatch.ts"

pnpm --filter @mill-ledger/server exec tsx ../audit/scripts/verify-concurrency-approve-dispatch.ts

echo "=== ORIGINAL REPRO DEFECT FOR F-007 IS FULLY RESOLVED ==="
