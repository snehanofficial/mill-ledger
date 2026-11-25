#!/usr/bin/env bash
set -e

exec > audit/evidence/verify/F-011/07-regression-radius.txt 2>&1

echo "=== STEP 7: REGRESSION RADIUS CHECKS FOR F-011 ==="
echo "Timestamp: $(date -Iseconds)"

echo "--- 1. Running Benchmark (18 assertions) under TZ=UTC ---"
TZ=UTC pnpm benchmark

echo "--- 2. Running Invariants Check (10 SQL invariants) ---"
PGPASSWORD=postgres psql -U postgres -h localhost -d mill_ledger -f audit/scripts/invariants.sql

echo "--- 3. Running Unit and Integration Test Suite under TZ=UTC ---"
TZ=UTC pnpm test

echo "--- 4. Running Typecheck ---"
pnpm typecheck

echo "--- 5. Running Lint ---"
pnpm lint

echo "=== REGRESSION RADIUS COMPLETE ==="
