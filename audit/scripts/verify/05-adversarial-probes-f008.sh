#!/usr/bin/env bash
set -e

mkdir -p audit/evidence/verify/F-008
exec > audit/evidence/verify/F-008/05-adversarial-probes.txt 2>&1

echo "=== STEP 5: ADVERSARIAL PROBES FOR F-008 ==="
echo "Timestamp: $(date -Iseconds)"

pnpm --filter @mill-ledger/server exec tsx ../audit/scripts/verify/05-adversarial-probes-f008.ts

echo "=== ALL ADVERSARIAL PROBES FOR F-008 PASSED ==="
