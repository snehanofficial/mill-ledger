# Server Workspace

## Overview

The server package provides the REST API for MillLedger using Express 5, TypeScript, PostgreSQL, and Prisma. It handles user authentication through Better Auth, enforces role and attribute authorization policies, and exposes domain endpoints for sales, inventory, production, and finance.

## Key files

| File                                      | Owns                                                             |
| ----------------------------------------- | ---------------------------------------------------------------- |
| `src/index.ts`                            | Server process entry point and port listener                     |
| `src/app.ts`                              | Express application setup, security headers, and router mounting |
| `src/config/env.ts`                       | Environment variable validation using Zod                        |
| `src/db/client.ts`                        | Prisma client instantiation with PostgreSQL adapter              |
| `src/lib/auth.ts`                         | Better Auth configuration with Prisma adapter                    |
| `src/middleware/auth.middleware.ts`       | Session authentication and permission verification middleware    |
| `src/middleware/error.middleware.ts`      | Centralized API error response formatting                        |
| `src/policies/rbac.ts`                    | Role based access control matrix and permission checks           |
| `src/policies/abac.ts`                    | Attribute based access control predicates for record boundaries  |
| `src/modules/health/health.controller.ts` | Service status and uptime controller                             |
| `prisma/schema.prisma`                    | PostgreSQL database schema definitions                           |

## Commands

```bash
# Start server with file watching
pnpm --filter @mill-ledger/server dev

# Check TypeScript types
pnpm --filter @mill-ledger/server typecheck

# Lint workspace files
pnpm --filter @mill-ledger/server lint

# Build server distribution
pnpm --filter @mill-ledger/server build

# Run database migrations
pnpm --filter @mill-ledger/server prisma:migrate

# Generate Prisma client
pnpm --filter @mill-ledger/server prisma:generate
```

## Conventions

- Organize domain code using package by feature under `src/modules/<feature>/`.
- Keep domain services independent of Express request and response objects.
- Validate all incoming request payloads with Zod before processing.
- Perform all stock balance adjustments via append only stock movements inside database transactions.
- Never trust client calculated monetary totals, tax calculations, or stock balances.

## Gotchas

- Production, sales, inventory, and finance routers are currently skeleton placeholder routers.
- The Prisma schema currently defines only Better Auth tables; core business entities remain to be added.
- The API router mounts routes under `/api/v1` with a root `/api/health` alias for health checks.

## Agent skills

- [better-auth-best-practices](.agents/skills/better-auth-best-practices/): `better-auth`, manages authentication configuration and plugins
- [better-auth-security-best-practices](.agents/skills/better-auth-security-best-practices/): `better-auth/security`, hardens auth secrets, sessions, and cookies
- [prisma-cli](.agents/skills/prisma-cli/): `prisma/cli`, guidance for Prisma 7 commands and migrations
- [prisma-client-api](.agents/skills/prisma-client-api/): `prisma/client`, guidance for Prisma queries and transactions
- [postgresql-best-practices](.agents/skills/postgresql-best-practices/): `postgres`, guidelines for indexes, constraints, and queries

## Related specs

- [docs/architecture.md](../docs/architecture.md)
- [docs/api-contract.md](../docs/api-contract.md)
- [docs/data-model.md](../docs/data-model.md)
- [docs/business-rules.md](../docs/business-rules.md)
- [docs/authorization-matrix.md](../docs/authorization-matrix.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
