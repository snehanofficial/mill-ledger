# MLD-001 — Fix Better Auth Trusted Origins & Build Functional Frontend Login View

## Metadata
- Task ID: `MLD-001`
- Related audit findings: `P0-SEC-01`
- Priority: P0 (Critical Release Blocker)
- Category: Security / Authentication
- Status: `DONE`
- Dependencies: None
- Owner: AI Agent
- Created: November 18, 2026
- Last updated: November 18, 2026

## 1. Description
The Better Auth server configuration in `server/src/lib/auth.ts` omits `trustedOrigins`. Any cross-origin authentication request originating from the client (e.g. `http://localhost:5173`) to `/api/auth/sign-in/email` is rejected by Better Auth with HTTP 403 `{"message":"Invalid origin","code":"INVALID_ORIGIN"}`.
Furthermore, the client's `/auth/login` route imports `LoginPage` from `placeholder-pages.tsx`, which renders an empty card with no input fields, no password field, and no submit button. In production builds, unauthenticated users are redirected to this route and permanently locked out.

## 2. Evidence
- Original audit finding: `P0-SEC-01`.
- Files:
  - [server/src/lib/auth.ts:6-29](/server/src/lib/auth.ts#L6-L29)
  - [client/src/pages/placeholder-pages.tsx:331-344](/client/src/pages/placeholder-pages.tsx#L331-L344)
  - [client/src/hooks/use-current-user.ts:58-69](/client/src/hooks/use-current-user.ts#L58-L69)
- Reproduction:
  `curl -i -X POST http://localhost:4000/api/auth/sign-in/email -H "Origin: http://localhost:5173" -d '{"email":"admin@millledger.local","password":"AdminPassword123!"}'` returns HTTP 403 Forbidden.

## 3. Expected Outcome
1. Better Auth server accepts sign-in requests from configured client origins (`CORS_ORIGIN`, `BETTER_AUTH_URL`).
2. `/auth/login` renders an accessible login page adhering to the Pine & Paper visual identity with email, password, error message display, and loading states.
3. Successful login establishes a secure session cookie, updates client auth state, and redirects to `/dashboard`.

## 4. Scope
- **Included changes:**
  - Update `server/src/lib/auth.ts` to include `trustedOrigins`.
  - Create dedicated `client/src/pages/login-page.tsx` replacing the placeholder.
  - Wire client `apiClient` or Better Auth client to authenticate against `/api/auth/sign-in/email`.
  - Update `client/src/app.tsx` to route `/auth/login` to the real `LoginPage`.
- **Excluded changes:**
  - Password recovery / reset email service (separate backlog task).
- **Affected modules:** `server/src/lib/auth.ts`, `client/src/pages/`, `client/src/app.tsx`.

## 5. Dependencies
- None. Ready for execution.

## 6. Implementation Plan
1. Update `server/src/lib/auth.ts` to configure `trustedOrigins: [env.CORS_ORIGIN, env.BETTER_AUTH_URL]`.
2. Verify sign-in endpoint accepts requests with `Origin: http://localhost:5173`.
3. Create `client/src/pages/login-page.tsx` with email/password form controls, validation, loading spinner, and Pine & Paper styling.
4. Route `/auth/login` in `client/src/app.tsx` to `login-page.tsx`.
5. Test login interaction and session cookie establishment.

## 7. Definition of Done
- [x] `POST /api/auth/sign-in/email` with client origin returns HTTP 200 and sets session cookie.
- [x] Functional `LoginPage` rendered at `/auth/login` with email and password inputs.
- [x] Invalid credentials display clear accessible error feedback.
- [x] Valid credentials log user in and redirect to `/dashboard`.
- [x] Typecheck passes across client and server.
- [x] Vitest integration tests verify login endpoint with CORS origin.

## 8. Verification Plan
- Command 1: `pnpm vitest run server/src/auth.integration.test.ts` -> All auth tests pass.
- Command 2: `pnpm typecheck` -> Clean across all packages.
- Command 3: `pnpm --filter client build` -> Production build succeeds.

## 9. Risks and Rollback
- Risk: Overly broad trusted origins could permit untrusted domains.
- Mitigation: Restricted explicitly to `env.CORS_ORIGIN` and `env.BETTER_AUTH_URL`.

## 10. Completion Evidence
- Added `trustedOrigins: [env.CORS_ORIGIN, env.BETTER_AUTH_URL].filter(Boolean)` in [server/src/lib/auth.ts](/server/src/lib/auth.ts).
- Added integration test in [server/src/auth.integration.test.ts](/server/src/auth.integration.test.ts) verifying `Origin: http://localhost:5173` successfully signs in and returns session cookie.
- Created [client/src/lib/auth-client.ts](/client/src/lib/auth-client.ts) implementing `signIn`, `signOut`, and `getSession`.
- Created accessible, responsive [client/src/pages/login-page.tsx](/client/src/pages/login-page.tsx) with Pine & Paper styling, email/password inputs, role shortcuts, Tamil i18n switch, and accessible error alerts.
- Wired route in [client/src/app.tsx](/client/src/app.tsx) and updated [client/src/layouts/authenticated-layout.tsx](/client/src/layouts/authenticated-layout.tsx).
- Vitest suite `server/src/auth.integration.test.ts` passed (6/6 tests, 623ms).
- `pnpm typecheck` passed (0 errors).
- `pnpm --filter client build` succeeded.

## 11. Completion Review
- DoD satisfied: All 6 criteria satisfied.
- Remaining limitations: None.
- Related findings resolved: `P0-SEC-01`
- Final status: `DONE`
