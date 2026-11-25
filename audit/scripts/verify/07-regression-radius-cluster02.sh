#!/usr/bin/env bash
set -e

mkdir -p audit/evidence/verify/F-007 audit/evidence/verify/F-008

run_radius() {
  echo "=== STEP 7: REGRESSION RADIUS CHECKS ==="
  echo "Timestamp: $(date -Iseconds)"

  echo "--- 1. Running CDI Benchmark (18 assertions) ---"
  pnpm benchmark

  echo "--- 2. Running SQL Database Invariants (10 invariants) ---"
  PGPASSWORD=postgres psql -U postgres -h localhost -d mill_ledger -f audit/scripts/invariants.sql

  echo "--- 3. Running Unit and Integration Test Suite ---"
  pnpm test

  echo "--- 4. Running Typecheck Across Workspaces ---"
  pnpm typecheck

  echo "--- 5. Running Lint Across Workspaces ---"
  pnpm lint

  echo "=== REGRESSION RADIUS COMPLETE ==="
}

run_radius > audit/evidence/verify/F-007/07-regression-radius.txt 2>&1
cp audit/evidence/verify/F-007/07-regression-radius.txt audit/evidence/verify/F-008/07-regression-radius.txt

echo "Regression radius checks completed successfully for F-007 and F-008."
