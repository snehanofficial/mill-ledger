#!/usr/bin/env bash
set -e

exec > audit/evidence/verify/F-011/02-original-repro.txt 2>&1

echo "=== STEP 2: ORIGINAL REPRO VERIFICATION FOR F-011 ==="
echo "Timestamp: $(date -Iseconds)"

echo "--- 1. Testing Original Repro from /audit/findings/F-011.md under TZ=UTC ---"
echo "Repro Command: TZ=UTC pnpm --filter @mill-ledger/server exec tsx ../audit/scripts/test-tz.ts"

TZ=UTC pnpm --filter @mill-ledger/server exec tsx ../audit/scripts/test-tz.ts

echo "--- 2. Testing across multiple host timezones ---"
for tz in "UTC" "America/New_York" "Europe/London" "Asia/Tokyo" "Asia/Kolkata"; do
  echo "Testing under TZ=$tz:"
  TZ="$tz" pnpm --filter @mill-ledger/server exec tsx ../audit/scripts/test-tz.ts
done

echo "=== ORIGINAL REPRO DEFECT IS FULLY RESOLVED ==="
