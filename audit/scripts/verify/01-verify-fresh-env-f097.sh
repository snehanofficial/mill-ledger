#!/usr/bin/env bash
set -e

EVIDENCE_FILE="/home/snehan/projects/web/mill-ledger/audit/evidence/verify/F-097/01-fresh-environment.txt"
exec > "$EVIDENCE_FILE" 2>&1

echo "=== STEP 1: FRESH ENVIRONMENT TEST FOR COMMIT e0047aa ==="
echo "Timestamp: $(date -Iseconds)"

FRESH_DIR="/tmp/mill-ledger-fresh-f097"
DB_NAME="mill_ledger_fresh_f097"

echo "1. Cleaning up worktree and fresh database if any..."
cd /home/snehan/projects/web/mill-ledger
git worktree remove --force "$FRESH_DIR" 2>/dev/null || rm -rf "$FRESH_DIR"
PGPASSWORD=postgres dropdb -U postgres -h localhost --if-exists "$DB_NAME"
PGPASSWORD=postgres createdb -U postgres -h localhost "$DB_NAME"

echo "2. Checking out commit e0047aa into clean directory $FRESH_DIR..."
git worktree add --detach "$FRESH_DIR" e0047aadb565ba164ff07f8ad499b6c8b5bbe988

cd "$FRESH_DIR"
echo "Current HEAD in fresh dir:"
git rev-parse HEAD
git log -1 --oneline

echo "3. Installing dependencies using frozen lockfile..."
pnpm install --frozen-lockfile

echo "4. Generating Prisma client..."
pnpm --filter server prisma generate

echo "5. Running migrations from zero..."
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/${DB_NAME}?schema=public"
pnpm --filter server prisma migrate deploy

echo "6. Seeding database..."
pnpm --filter server db:seed

echo "7. Running formatters unit test suite..."
npx vitest run client/src/lib/formatters.test.ts

echo "8. Cleaning up fresh worktree and database..."
cd /home/snehan/projects/web/mill-ledger
git worktree remove --force "$FRESH_DIR" 2>/dev/null || rm -rf "$FRESH_DIR"
PGPASSWORD=postgres dropdb -U postgres -h localhost --if-exists "$DB_NAME"

echo "=== STEP 1: FRESH ENVIRONMENT TEST PASSED ==="
