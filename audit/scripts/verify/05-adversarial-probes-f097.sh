#!/usr/bin/env bash
set -e

EVIDENCE_FILE="/home/snehan/projects/web/mill-ledger/audit/evidence/verify/F-097/05-adversarial-probes.txt"
exec > "$EVIDENCE_FILE" 2>&1

echo "=== STEP 5: ADVERSARIAL PROBES FOR F-097 ==="
echo "Timestamp: $(date -Iseconds)"

cd /home/snehan/projects/web/mill-ledger

echo "Running adversarial probe suite via vitest with verify config..."
npx vitest run --config audit/scripts/verify/vitest.verify.config.ts audit/scripts/verify/05-adversarial-probes-f097.test.ts

echo "=== STEP 5: ADVERSARIAL PROBES COMPLETED SUCCESSFULLY ==="
