# MillLedger Agent Rules

This file applies to every task in this repository. Read it and the relevant documentation before work.

## Authority and documentation

1. The CDI problem statement and [MASTER_PROJECT_PLAN.md](MASTER_PROJECT_PLAN.md) are the requirements authority.
2. Keep reusable technical guidance in installed skills and durable product/domain detail in `docs/`.
3. Before implementation, read applicable files in `docs/`: `business-rules.md`, `data-model.md`, `benchmark.md`, and `offline-sync.md` when present. The plan also covers these subjects today.
4. Use source code and tests as executable proof. Keep no duplicate copy of large requirements or plans.
5. Verify unfamiliar APIs and dependency changes against current official documentation before implementation.

## Skills and discovery

- Use installed skills whenever their expertise applies; do not bypass skill guidance.
- Search skills.sh with `npx skills find <topic>` before considering a custom skill.
- Do not create a custom skill merely to encode application business rules.
- A custom skill requires a recurring reusable capability missing from skills.sh, narrowly scoped purpose, valid frontmatter, activation conditions, and verification steps.

## Toolchain and architecture

- Use pnpm only. Preserve `pnpm-lock.yaml`; do not replace it or add npm/yarn files.
- Pin compatible dependency versions and avoid unrelated dependency upgrades.
- Maintain React/Vite on the client and Express/TypeScript/PostgreSQL/Prisma on the server.
- Preserve the modular-monolith boundaries in `client/`, `server/src/modules/`, `shared/`, and `server/prisma/`.
- Prefer small, explicit modules and established APIs. Avoid unnecessary abstractions.

## Security and correctness

- Enforce RBAC and ABAC server-side. Frontend visibility is never authorization.
- PostgreSQL is the source of truth.
- Never overwrite stock balances. Use traceable, transactional stock movements.
- Preserve immutable posted invoices and production records; use corrections or reversals.
- Use decimal-safe arithmetic for quantities, costs, and money. Never use JavaScript floating point for financial calculations.
- Make posting operations transactional and posting/retryable operations idempotent.
- Never present locally queued offline orders as server-submitted or stock-reserved.
- Protect sessions and secrets according to Better Auth and server security best practices.

## UX and delivery

- Build mobile-first, role-specific experiences with WCAG 2.2 AA-oriented keyboard, focus, contrast, target-size, and screen-reader behavior.
- Avoid AI-template UI, unnecessary gradients, decorative animations, and inaccessible controls.
- Keep role workflows efficient for sales, floor, review, accounting, and owner contexts.
- Offline queues must show explicit local/syncing/synced state and preserve exactly-once behavior.

## Verification and change discipline

- Follow TDD for domain logic and important workflows.
- Add or update benchmark fixtures and relevant documentation alongside implementation.
- Before completion, run relevant tests, lint, typecheck, and build; use focused checks first for narrow changes.
- Never claim a feature works or a test passes without fresh command evidence.
- Check diffs for generated, lockfile, unrelated, or unintended changes before finishing.

## Verification commands

```sh
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm test:e2e
npx skills list
```

Run only commands relevant to the changed slice, but report which verification was actually executed.
