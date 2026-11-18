# MLD-004 — Establish Deterministic Prisma Migration Ledger & Schema Constraints

## Metadata
- Task ID: `MLD-004`
- Related audit findings: `P0-DATA-01`
- Priority: P0 (Critical Release Blocker)
- Category: Database Engineering / Data Integrity
- Status: `DONE`
- Dependencies: None
- Owner: AI Agent
- Created: November 18, 2026
- Last updated: November 18, 2026

## 1. Description
The `server/prisma/migrations/` directory is absent from the repository. The PostgreSQL schema was synchronized via `prisma db push`. As a consequence:
1. `prisma migrate deploy` cannot run in CI/CD or staging environments.
2. PostgreSQL `CHECK` constraints (e.g. preventing negative inventory `current_stock >= 0` or negative invoice amounts) cannot be declared via Prisma schema syntax alone and must be managed via SQL migrations.
3. No rollback or schema drift tracking exists.

## 2. Evidence
- Original audit finding: `P0-DATA-01`.
- Directory: [server/prisma/](/server/prisma/).
- `ls server/prisma/migrations/` confirms folder does not exist.

## 3. Expected Outcome
1. A reproducible, version-controlled baseline migration exists under `server/prisma/migrations/`.
2. Native PostgreSQL `CHECK (current_stock >= 0)` constraint is applied to `inventory_item`.
3. Native PostgreSQL `CHECK (taxable_amount >= 0)` is applied to `sales_invoice` and `sales_order`.
4. `prisma migrate deploy` executes cleanly in automated pipelines.

## 4. Scope
- **Included changes:**
  - Create baseline migration using `prisma migrate dev` or `prisma migrate diff`.
  - Add native SQL `CHECK` constraints to migration SQL.
  - Verify migration deploys cleanly against PostgreSQL.
- **Excluded changes:**
  - Multi-tenant foreign key alterations (sequenced in MLD-002).
- **Affected modules:** `server/prisma/`.

## 5. Dependencies
- None. Ready for execution.

## 6. Implementation Plan
1. Generate initial baseline migration for current `schema.prisma`.
2. Append `ALTER TABLE "inventory_item" ADD CONSTRAINT "chk_current_stock_non_negative" CHECK ("current_stock" >= 0);` to the migration script.
3. Run `npx prisma migrate dev` / `prisma migrate deploy` against the local database.
4. Verify constraint prevents negative stock insertion.

## 7. Definition of Done
- [x] `server/prisma/migrations/` committed to git.
- [x] Baseline migration applies without errors.
- [x] Attempting to write negative `current_stock` throws PostgreSQL check constraint violation `23514`.
- [x] `pnpm benchmark` continues to pass 100%.

## 8. Verification Plan
- Command 1: `pnpm --filter @mill-ledger/server exec prisma migrate status` -> Reports database schema up to date.
- Command 2: Execute SQL test inserting negative stock -> Database rejects with check constraint violation.

## 9. Risks and Rollback
- Risk: Schema drift between existing local DB tables and generated migration.
- Mitigation: Inspected diff and verified against clean test database before committing.

## 10. Completion Evidence
- Created migration history:
  - `server/prisma/migrations/20261118000000_init_baseline/migration.sql`
  - `server/prisma/migrations/20261118000001_constraints_and_sequences/migration.sql`
- Applied migrations via `prisma migrate deploy`: "All migrations have been successfully applied."
- `prisma migrate status` verified: "Database schema is up to date!"
- Verified check constraint `chk_current_stock_non_negative`: Attempting to write negative `currentStock = -10` was rejected by PostgreSQL with error `23514 new row for relation "inventory_item" violates check constraint "chk_current_stock_non_negative"`.
- Ran `pnpm benchmark`: All 18 benchmark assertions matched 100%.
- Ran `pnpm test`: 15 test files, 66 tests passed.

## 11. Completion Review
- DoD satisfied: All 4 criteria satisfied.
- Remaining limitations: None.
- Related findings resolved: `P0-DATA-01`
- Final status: `DONE`
