#!/usr/bin/env bash
set -e

mkdir -p audit/evidence/verify/F-007
exec > audit/evidence/verify/F-007/05-adversarial-probes.txt 2>&1

echo "=== STEP 5: ADVERSARIAL PROBES FOR F-007 ==="
echo "Timestamp: $(date -Iseconds)"

pnpm --filter @mill-ledger/server exec tsx ../audit/scripts/verify/05-adversarial-probes-f007.ts

echo "=== ALL ADVERSARIAL PROBES FOR F-007 PASSED ==="
