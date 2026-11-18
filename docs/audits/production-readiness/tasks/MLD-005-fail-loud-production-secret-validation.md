# MLD-005 — Enforce Fail-Loud Production Secret Validation

## Metadata
- Task ID: `MLD-005`
- Related audit findings: `P1-SEC-01`
- Priority: P1 (High)
- Category: Security / Configuration
- Status: `DONE`
- Dependencies: None
- Owner: AI Agent
- Created: November 18, 2026
- Last updated: November 18, 2026

## 1. Description
In `server/src/config/env.ts`, `BETTER_AUTH_SECRET` is validated with:
```typescript
BETTER_AUTH_SECRET: z
  .string()
  .min(16)
  .default("mill-ledger-development-secret-123456"),
```
If an operator omits `BETTER_AUTH_SECRET` when deploying in production (`NODE_ENV=production`), the application boots silently with the hardcoded public repository string. Better Auth security guidelines mandate secrets with at least 32 characters (256-bit entropy) and strictly prohibit default secrets in production.

## 2. Evidence
- Original audit finding: `P1-SEC-01`.
- File: [server/src/config/env.ts:17-20](/server/src/config/env.ts#L17-L20).
- OWASP Category: A05:2021-Security Misconfiguration.

## 3. Expected Outcome
1. When `NODE_ENV === "production"`, `BETTER_AUTH_SECRET` must be required, have at least 32 characters, and reject the default development secret string.
2. In development or test, the development secret is allowed for developer convenience.
3. If an invalid or default secret is provided in production, the server crashes immediately on startup with a clear error message.

## 4. Scope
- **Included changes:**
  - Update `server/src/config/env.ts` using a refinement or conditional schema.
  - Add unit tests verifying schema rejection under production flags.
- **Excluded changes:**
  - Key rotation service (future enhancement).
- **Affected modules:** `server/src/config/env.ts`.

## 5. Dependencies
- None. Ready for immediate execution.

## 6. Implementation Plan
1. Refactor `envSchema` in `server/src/config/env.ts` with `.superRefine`:
   - If `data.NODE_ENV === "production"`, `data.BETTER_AUTH_SECRET` must have length >= 32 and cannot equal `"mill-ledger-development-secret-123456"`.
2. Add unit tests for environment validation.

## 7. Definition of Done
- [x] Omission of `BETTER_AUTH_SECRET` in `NODE_ENV=production` causes process to exit with non-zero code.
- [x] Providing secret < 32 chars in production throws validation error.
- [x] Providing default secret in production throws validation error.
- [x] Development environment boots without errors.
- [x] Unit tests added in `server/src/config/env.test.ts`.

## 8. Verification Plan
- Command 1: `pnpm vitest run server/src/config/env.test.ts` -> All tests pass.
- Command 2: `pnpm typecheck` -> All workspaces typecheck cleanly.

## 9. Risks and Rollback
- Risk: Development workflows broken if developers forget to set env vars.
- Mitigation: Retained dev default strictly when `NODE_ENV !== "production"`.

## 10. Completion Evidence
- Created [server/src/config/env.test.ts](/server/src/config/env.test.ts) testing:
  - Allowed development default secret in dev mode.
  - Fail-loud rejection when default secret is used in production.
  - Fail-loud rejection when secret is shorter than 32 characters in production.
  - Valid high-entropy secret >= 32 characters passes in production.
- Ran `pnpm vitest run server/src/config/env.test.ts`: 4 passed (4 tests) in 305ms.
- Ran `pnpm typecheck`: 0 errors.

## 11. Completion Review
- DoD satisfied: All 5 criteria satisfied.
- Remaining limitations: None.
- Related findings resolved: `P1-SEC-01`
- Final status: `DONE`
