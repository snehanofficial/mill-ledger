#!/usr/bin/env bash
set -e

exec > audit/evidence/verify/F-009/01-fresh-environment.txt 2>&1

echo "=== STEP 1: FRESH ENVIRONMENT TEST FOR COMMIT ba71207 ==="
echo "Timestamp: $(date -Iseconds)"

FRESH_DIR="/tmp/mill-ledger-fresh-f009"
DB_NAME="mill_ledger_fresh_f009"

echo "1. Cleaning up worktree and fresh database if any..."
cd /home/snehan/projects/web/mill-ledger
git worktree remove --force "$FRESH_DIR" 2>/dev/null || rm -rf "$FRESH_DIR"
PGPASSWORD=postgres dropdb -U postgres -h localhost --if-exists "$DB_NAME"
PGPASSWORD=postgres createdb -U postgres -h localhost "$DB_NAME"

echo "2. Checking out commit ba71207 into clean directory $FRESH_DIR..."
git worktree add --detach "$FRESH_DIR" ba71207ae75581b11bd721c95c3a00cfa8730500

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

echo "6. Verifying applied migrations in fresh db:"
PGPASSWORD=postgres psql -U postgres -h localhost -d "$DB_NAME" -c "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at;"

echo "7. Verifying database triggers created in fresh db:"
PGPASSWORD=postgres psql -U postgres -h localhost -d "$DB_NAME" -c "SELECT tgname, relname FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid WHERE NOT tgisinternal ORDER BY relname, tgname;"

echo "8. Seeding benchmark masters in fresh db..."
pnpm --filter server db:seed

echo "9. Verifying seeded master counts:"
PGPASSWORD=postgres psql -U postgres -h localhost -d "$DB_NAME" -c "SELECT count(*) AS stock_movement_count FROM stock_movement;" -c "SELECT count(*) AS inventory_item_count FROM inventory_item;"

echo "10. Running regression test in fresh db environment..."
npx vitest run server/src/db-immutability.test.ts

echo "11. Cleaning up worktree and fresh db..."
cd /home/snehan/projects/web/mill-ledger
git worktree remove --force "$FRESH_DIR"
PGPASSWORD=postgres dropdb -U postgres -h localhost "$DB_NAME"

echo "=== FRESH ENVIRONMENT CHECK PASSED ==="
