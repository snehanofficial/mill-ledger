# Architecture

## System shape

MillLedger is a modular monolith:

- React/Vite PWA for role-specific workspaces
- Express/TypeScript API under `/api/v1`
- PostgreSQL as source of truth
- Prisma for ordinary persistence and migrations
- Shared TypeScript contracts for cross-boundary schemas and enums

Do not create microservices or separate mobile applications in the initial implementation.

## Stack

| Concern         | Choice                                                           |
| --------------- | ---------------------------------------------------------------- |
| Language        | TypeScript, strict mode                                          |
| Frontend        | React + Vite                                                     |
| Routing         | React Router Data Router, `createBrowserRouter`                  |
| Server state    | TanStack Query v5                                                |
| HTTP            | Axios                                                            |
| Forms           | React Hook Form + Zod                                            |
| UI primitives   | Radix UI and shadcn/ui selectively                               |
| Styling         | Tailwind CSS and design tokens                                   |
| Tables          | TanStack Table                                                   |
| Icons           | Lucide React                                                     |
| PWA             | `vite-plugin-pwa`, Workbox `injectManifest`                      |
| Local database  | Dexie over IndexedDB                                             |
| Backend         | Node.js + Express                                                |
| Authentication  | Better Auth with pinned compatible Prisma/PostgreSQL packages    |
| Database        | PostgreSQL                                                       |
| ORM             | Prisma 7 with PostgreSQL driver adapter for ordinary persistence |
| Validation      | Zod at API boundaries                                            |
| Logging         | Structured Pino-style logging                                    |
| Tests           | Vitest, Supertest, Playwright                                    |
| Package manager | pnpm workspaces                                                  |

Revalidate package compatibility at implementation start. Do not use unqualified `latest` for Better Auth/Prisma dependencies.

## Repository boundaries

- `client/`: role layouts, feature UI, API client, TanStack Query, Dexie, PWA
- `server/src/modules/`: domain-owned controllers, services, schemas, routes, policies, repositories, and tests
- `server/prisma/`: schema, migrations, seed
- `shared/src/`: contracts, schemas, enums, and shared types only
- `docs/`: durable implementation documentation

Use package-by-feature naming. Directories and files use kebab-case. Do not add global `controllers/`, `services/`, or `repositories/` trees.

A feature module should contain only the files it needs, but when those concerns exist use stable names such as:

```text
modules/<feature>/
  <feature>.routes.ts
  <feature>.controller.ts
  <feature>.schema.ts
  <feature>.service.ts
  <feature>.repository.ts
  <feature>.policy.ts
  <feature>.types.ts
  <feature>.test.ts
```

Domain services must be callable without an Express request object.

## Frontend responsibilities

- React Router owns role routes, layouts, guards for UX, and route errors.
- TanStack Query owns server query cache and mutation lifecycle.
- Axios owns credentials, request IDs, timeouts, and normalized API errors.
- React Hook Form and Zod own form state and field validation.
- Dexie owns durable drafts, outbox data, and the authorized local catalogue subset.
- The service worker caches static application assets. It must not cache private API/session/report responses indiscriminately.

Do not introduce Redux as a second server-state store.

## Backend boundaries

API middleware authenticates, validates, authorizes, adds request IDs, and maps errors. Domain services own business transactions. Inventory, production/costing, tax/pricing, reporting, and audit logic stay in their owning modules.

Zod validates all external inputs. Controllers never compute authoritative totals or stock. Posting operations use database transactions and idempotency.

## Deployment

- Static React PWA served over HTTPS
- One Express API process
- One managed PostgreSQL database
- Private object storage only if PDFs/exports require it
- Same-origin routing where practical
- CI runs focused tests, full relevant test suite, lint, typecheck, build, migration checks, and benchmark seed verification

No Docker requirement is assumed for local development. Optional Compose may improve reproducibility but must not replace the `pnpm dev` path.
