# MillLedger Database Migration Policy

**Status**: Active  
**Effective Date**: 2026-11-20  
**Authority**: Remediation Rulebook (Prompt 1, Step 1e)

---

## 1. Core Principles

1. **Forward-Only**: All database schema changes, triggers, functions, and data transformations must move forward. Rollbacks via modifying existing migration SQL or resetting migrations in-place are strictly prohibited.
2. **One Migration Per Finding**: Each schema change or database constraint modification must correspond to exactly one tracked finding (`F-###`). The migration folder must include the finding ID in its name:
   `server/prisma/migrations/<TIMESTAMP>_F_<###>_<short_title>/migration.sql`
3. **Never Edit an Applied Migration**: Once a migration has been committed and applied in any environment (local, CI, staging, production), its `migration.sql` file is immutable. Any defects, omissions, or refinements must be resolved in a subsequent forward migration tied to a tracked finding or follow-up item.

---

## 2. Migration Execution & Verification Rules

1. **Naming Standard**:
   `pnpm --filter @mill-ledger/server exec prisma migrate dev --name F-###-title`
   Example:
   `20261120120000_F_009_protect_stock_movement_immutability`
2. **Deterministic Replay**:
   Every migration must be idempotent or cleanly executable on a fresh PostgreSQL instance during CI (`prisma migrate deploy`).
3. **Constraint Safety**:
   When introducing `CHECK` constraints or foreign keys on existing tables with data, ensure default values or cleanup steps prevent deployment aborts.
4. **Approval Gate**:
   Per Rule 6 of the remediation pack, any schema change (`needsApproval: "schema"`) requires explicit owner approval recorded in `audit/tracker/approvals.json` before application.
