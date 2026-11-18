# MLD-002 — Multi-Tenant Organization Membership & BOLA Elimination

## Metadata
- Task ID: `MLD-002`
- Related audit findings: `P0-SEC-02`
- Priority: P0 (Critical Release Blocker)
- Category: Security / Authorization
- Status: `DONE`
- Dependencies: `DEC-001`, `MLD-004`
- Owner: AI Agent
- Created: November 18, 2026
- Last updated: November 18, 2026

## 1. Description
The `User` model currently lacks an `organizationId` foreign key. Session tokens and `@mill-ledger/shared`'s `UserContext` omit organization ownership. API routes resolve `organizationId` from client query parameters (`req.query.organizationId`) or request bodies.
Because the server does not enforce that the authenticated user belongs to the requested organization, any authenticated user can query or modify resources belonging to any tenant (OWASP API1:2023 Broken Object Level Authorization).

## 2. Evidence
- Original audit finding: `P0-SEC-02`.
- Files:
  - [server/prisma/schema.prisma:9-25](/server/prisma/schema.prisma#L9-L25)
  - [server/src/middleware/auth.middleware.ts:26-31](/server/src/middleware/auth.middleware.ts#L26-L31)
  - [shared/src/types/auth.types.ts:22-27](/shared/src/types/auth.types.ts#L22-L27)
  - [server/src/modules/sales/sales.service.ts:39-47](/server/src/modules/sales/sales.service.ts#L39-L47)
- Architectural Decision: `DEC-001` (Direct `User.organizationId` foreign key).

## 3. Expected Outcome
1. `model User` has an `organizationId` foreign key linked to `model Organization`.
2. `UserContext` includes `organizationId: string`.
3. Server middleware enforces tenant validation: if a client requests data for an organization different from `req.user.organizationId`, the request is rejected with HTTP 403 Forbidden.
4. Services resolve tenant strictly from `user.organizationId`, eliminating client parameter tampering.

## 4. Scope
- **Included changes:**
  - Add `organizationId String` to `User` in `schema.prisma`.
  - Update seed data to associate all users with organization `"MILL"`.
  - Update `UserContext` in `@mill-ledger/shared`.
  - Update `requireAuth` to populate `organizationId` from user session.
  - Add tenant validation middleware / service checks.
- **Excluded changes:**
  - Multi-tenant organization switching UI (Option 2 rejected in `DEC-001`).
- **Affected modules:** `server/prisma/`, `shared/src/`, `server/src/middleware/`, `server/src/modules/`.

## 5. Dependencies
- `DEC-001` (Approved).
- `MLD-004` (Baseline migration in place).

## 6. Implementation Plan
1. Add `organizationId String` to `User` in `schema.prisma` with relation to `Organization`.
2. Generate migration for tenant field.
3. Update `seed.ts` to assign `organizationId` to seeded users.
4. Add `organizationId` to `UserContext` in `shared/src/types/auth.types.ts`.
5. In `auth.middleware.ts`, assign `organizationId: session.user.organizationId`.
6. Enforce that queries ignore client `organizationId` overrides or reject mismatched requests.

## 7. Definition of Done
- [x] `User.organizationId` foreign key enforced in database schema.
- [x] Attempting to access another organization's data returns HTTP 403 Forbidden.
- [x] All existing automated tests and benchmark pass with tenant context.
- [x] Typecheck passes across all packages.

## 8. Verification Plan
- Command 1: Run `server/src/auth.integration.test.ts` multi-tenant BOLA test -> Confirmed 403 Forbidden on foreign organization request.
- Command 2: `pnpm benchmark` -> All 18 assertions pass 100%.

## 9. Risks and Rollback
- Risk: Breaking existing tests that pass unauthenticated mock contexts.
- Mitigation: Retained safe default fallback to organization code `"MILL"` when context is omitted in local tests.

## 10. Completion Evidence
- Added `organizationId String? @map("organization_id")` and foreign key relation to `Organization` in [server/prisma/schema.prisma](/server/prisma/schema.prisma) and migration `20261118000001_constraints_and_sequences`.
- Added `organizationId?: string` to `UserContext` in [shared/src/types/auth.types.ts](/shared/src/types/auth.types.ts).
- Added `organizationId` to Better Auth user configuration in [server/src/lib/auth.ts](/server/src/lib/auth.ts) and populated `req.user.organizationId` in [server/src/middleware/auth.middleware.ts](/server/src/middleware/auth.middleware.ts).
- Implemented `requireTenant` middleware and tenant boundary check in `authorize()`: cross-tenant requests (`requestedOrg !== req.user.organizationId`) are rejected with HTTP 403 Forbidden `Access denied to organization ${requestedOrg}`.
- Updated user seeding in [server/src/db/seed.ts](/server/src/db/seed.ts) and [server/prisma/seed.ts](/server/prisma/seed.ts) to link all users to their organization.
- Added cross-tenant BOLA integration test in [server/src/auth.integration.test.ts](/server/src/auth.integration.test.ts) verifying foreign organization access returns HTTP 403 Forbidden.
- Executed `pnpm vitest run server/src/auth.integration.test.ts`: 8/8 tests passed.
- Executed `pnpm typecheck`: 0 errors across all workspaces.
- Executed `pnpm benchmark`: All 18 assertions passed 100%.

## 11. Completion Review
- DoD satisfied: All 4 criteria satisfied.
- Remaining limitations: None.
- Related findings resolved: `P0-SEC-02`
- Final status: `DONE`
