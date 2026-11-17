# MillLedger Agent Rules

This file applies to every task in this repository.

## Authority

1. The CDI [problem statement](Problem_Statement_Winter_Internship_Application_2026.md) and exact benchmark are the requirements authority.
2. [MASTER_PROJECT_PLAN.md](MASTER_PROJECT_PLAN.md) is the full historical baseline. The focused documents in [docs/index.md](docs/index.md) are the implementation authority.
3. Use source code and tests as executable proof. Do not copy large requirements or plans into code comments or duplicate them across docs.
4. Verify unfamiliar APIs and dependency changes against current official documentation before implementation.

## Documentation routing

Start with [docs/index.md](docs/index.md). Read only the documents that own the slice:

- Requirements and acceptance: [product-requirements.md](docs/product-requirements.md)
- Stock, production, orders, invoices, payments, and costing: [business-rules.md](docs/business-rules.md)
- Schema, migrations, constraints, precision, and valuation: [data-model.md](docs/data-model.md)
- Stack, modules, API shape, and deployment: [architecture.md](docs/architecture.md)
- HTTP routes and idempotency: [api-contract.md](docs/api-contract.md)
- Roles, ABAC, security, and audit: [authorization-matrix.md](docs/authorization-matrix.md)
- PWA cache and exactly-once sync: [offline-sync.md](docs/offline-sync.md)
- Role UX, responsive behavior, and accessibility: [ui-ux-spec.md](docs/ui-ux-spec.md)
- Exact supplied fixture and values: [benchmark.md](docs/benchmark.md)
- Test and edge-case coverage: [testing.md](docs/testing.md)
- Implementation sequence and exit gates: [milestones.md](docs/milestones.md)
- Missing inputs and resolved assumptions: [assumptions.md](docs/assumptions.md)
- Reports, exports, and audit events: [reporting-audit.md](docs/reporting-audit.md)
- Submission and acceptance evidence: [release-checklist.md](docs/release-checklist.md)

Update the owning document with code when behavior or a decision changes. Resolve source ambiguities in [assumptions.md](docs/assumptions.md) before encoding them.

## Skills and discovery

- Use installed skills whenever their expertise applies.
- Search skills.sh with `npx skills find <topic>` before considering a custom skill.
- Do not create a custom skill merely to encode application business rules.
- A custom skill needs a recurring reusable capability, narrow purpose, valid activation conditions, and verification steps.

## Toolchain and architecture

- Use pnpm only. Preserve `pnpm-lock.yaml`.
- Pin compatible dependency versions; avoid unrelated upgrades.
- Maintain React/Vite on the client and Express/TypeScript/PostgreSQL/Prisma on the server.
- Preserve modular-monolith boundaries in `client/`, `server/src/modules/`, `shared/`, and `server/prisma/`.
- Use package-by-feature organization and kebab-case names.
- Prefer small, explicit modules and established APIs.

## Security and correctness

- Enforce RBAC and ABAC server-side. Frontend visibility is never authorization.
- PostgreSQL is the source of truth.
- Never overwrite stock balances. Use traceable, transactional stock movements.
- Preserve immutable posted invoices and production records; use corrections or reversals.
- Use exact decimal arithmetic for quantities, costs, and money.
- Make posting operations transactional and retriable operations idempotent.
- Never present a local offline order as server-submitted or stock-reserved.
- Store session secrets only in secure server-auth cookies and protect secrets according to Better Auth and server security practices.

## UX and delivery

- Build mobile-first, role-specific experiences with WCAG 2.2 AA-oriented behavior.
- Avoid decorative AI-style UI, unnecessary gradients, animations, or inaccessible controls.
- Keep salesman, floor, review, accounting, and owner workflows efficient.
- Offline queues must show explicit local/syncing/synced/conflict states.

## Verification and change discipline

- Follow TDD for domain logic and important workflows.
- Add or update benchmark fixtures and relevant documentation with implementation.
- Run focused checks first, then only relevant lint/typecheck/build/test commands.
- Never claim a feature works or a test passes without fresh command evidence.
- Check diffs for unintended, generated, lockfile, or unrelated changes before finishing.

```sh
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm test:e2e
npx skills list
```
