#!/usr/bin/env bash
set -e

exec > audit/evidence/verify/F-008/01-fresh-environment.txt 2>&1

echo "=== STEP 1: FRESH ENVIRONMENT TEST FOR COMMIT 32647af (F-008) ==="
echo "Timestamp: $(date -Iseconds)"

FRESH_DIR="/tmp/mill-ledger-fresh-f008"
DB_NAME="mill_ledger_fresh_f008"

echo "1. Cleaning up worktree and fresh database if any..."
cd /home/snehan/projects/web/mill-ledger
git worktree remove --force "$FRESH_DIR" 2>/dev/null || rm -rf "$FRESH_DIR"
PGPASSWORD=postgres dropdb -U postgres -h localhost --if-exists "$DB_NAME"
PGPASSWORD=postgres createdb -U postgres -h localhost "$DB_NAME"

echo "2. Checking out commit 32647af into clean directory $FRESH_DIR..."
git worktree add --detach "$FRESH_DIR" 32647afc08e3ff108d0bd5e870868d13e56b2b49

cd "$FRESH_DIR"
echo "Current HEAD in fresh dir:"
git rev-parse HEAD
git log -1 --oneline

echo "3. Installing dependencies using frozen lockfile..."
pnpm install --frozen-lockfile

echo "4. Generating Prisma client..."
pnpm --filter server prisma generate

echo "5. Running Prisma migrations from zero on fresh database..."
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/${DB_NAME}?schema=public"
pnpm --filter server prisma migrate deploy

echo "6. Seeding benchmark masters in fresh db..."
pnpm --filter server db:seed

echo "7. Running regression test in fresh environment..."
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/${DB_NAME}?schema=public" npx vitest run server/src/dispatch-concurrency.test.ts

echo "8. Cleaning up worktree and fresh db..."
cd /home/snehan/projects/web/mill-ledger
git worktree remove --force "$FRESH_DIR"
PGPASSWORD=postgres dropdb -U postgres -h localhost "$DB_NAME"

echo "=== FRESH ENVIRONMENT CHECK PASSED FOR F-008 ==="
