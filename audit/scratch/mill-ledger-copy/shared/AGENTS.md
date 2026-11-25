# Shared Workspace

## Overview

The shared package provides shared contracts, Zod validation schemas, and TypeScript types for MillLedger. Both client and server packages consume this library to ensure type safety across HTTP communication boundaries.

## Key files

| File                               | Owns                                                         |
| ---------------------------------- | ------------------------------------------------------------ |
| `src/index.ts`                     | Barrel export aggregating contracts, schemas, and types      |
| `src/contracts/health.contract.ts` | Health check endpoint contract definition                    |
| `src/schemas/health.schema.ts`     | Zod runtime validator for service health response            |
| `src/types/auth.types.ts`          | Roles, actions, resources, and user context type definitions |

## Commands

```bash
# Check TypeScript types
pnpm --filter @mill-ledger/shared typecheck

# Lint workspace files
pnpm --filter @mill-ledger/shared lint
```

## Conventions

- Store interface shapes for API endpoints inside `src/contracts/`.
- Store Zod validation schemas inside `src/schemas/`.
- Store pure TypeScript type definitions inside `src/types/`.
- Do not introduce server specific or browser specific dependencies into this package.
- Keep exports granular via subpath exports defined in `package.json`.

## Gotchas

- Contracts for core domain operations (sales, inventory, production, invoices) remain to be authored.
- Roles are standardized to five uppercase identities: ADMIN, SALESMAN, PRODUCTION, ACCOUNTANT, OWNER.

## Related specs

- [docs/api-contract.md](../docs/api-contract.md)
- [docs/data-model.md](../docs/data-model.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
