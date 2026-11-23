#!/usr/bin/env bash
set -e

EVIDENCE_FILE="/home/snehan/projects/web/mill-ledger/audit/evidence/verify/F-097/07-regression-radius.txt"
exec > "$EVIDENCE_FILE" 2>&1

echo "=== STEP 7: REGRESSION RADIUS CHECKS FOR F-097 ==="
echo "Timestamp: $(date -Iseconds)"

cd /home/snehan/projects/web/mill-ledger

echo "--- 1. Running Benchmark ---"
pnpm benchmark

echo "--- 2. Running Invariants Check ---"
PGPASSWORD=postgres psql -U postgres -h localhost -d mill_ledger -f audit/scripts/invariants.sql

echo "--- 3. Running Unit and Integration Test Suite ---"
pnpm test

echo "--- 4. Running Typecheck ---"
pnpm typecheck

echo "--- 5. Running Lint ---"
pnpm lint

echo "--- 6. Running Production Build & Bundle Size Check ---"
pnpm build

echo "=== REGRESSION RADIUS COMPLETE ==="
