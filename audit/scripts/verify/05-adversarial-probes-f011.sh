#!/usr/bin/env bash
set -e

exec > audit/evidence/verify/F-011/05-adversarial-probes.txt 2>&1

echo "=== STEP 5: ADVERSARIAL PROBES FOR F-011 ==="
echo "Timestamp: $(date -Iseconds)"

pnpm --filter @mill-ledger/server exec tsx ../audit/scripts/verify/05-adversarial-probes-f011.ts

echo "=== ALL ADVERSARIAL PROBES PASSED ==="
