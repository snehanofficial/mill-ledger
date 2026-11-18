# MLD-008 — Implement Shell Sign-Out & Session Revocation

## Metadata
- Task ID: `MLD-008`
- Related audit findings: `P1-FUNC-01`
- Priority: P1 (High)
- Category: Functional / UX
- Status: `DONE`
- Dependencies: `MLD-001`
- Owner: AI Agent
- Created: November 18, 2026
- Last updated: November 18, 2026

## 1. Description
In the authenticated application shell ([client/src/components/shell/authenticated-shell.tsx](/client/src/components/shell/authenticated-shell.tsx)), clicking the user profile dropdown sign-out button triggers a no-op or unhandled call. The user cannot log out of the active session. This poses a security risk on shared mill terminal devices and tablets where different operators (floor managers, salesmen, accountants) switch accounts.

## 2. Evidence
- Original audit finding: `P1-FUNC-01`.
- Files:
  - [client/src/components/shell/authenticated-shell.tsx:180-210](/client/src/components/shell/authenticated-shell.tsx#L180-L210)
  - [client/src/lib/auth-client.ts](/client/src/lib/auth-client.ts)

## 3. Expected Outcome
1. The sign-out button in the user profile menu invokes `authClient.signOut()`.
2. The session cookie is invalidated on the server via `POST /api/auth/sign-out`.
3. Client-side authentication state and query cache are cleared.
4. The user is redirected to `/auth/login` with immediate feedback.

## 4. Scope
- **Included changes:**
  - Wire sign-out handler in `authenticated-shell.tsx` calling `authClient.signOut()`.
  - Clear TanStack Query cache (`queryClient.clear()`) and local storage session markers on sign-out.
  - Redirect to `/auth/login`.
- **Excluded changes:**
  - Complete overhaul of user settings or profile editing dialogs.
- **Affected modules:** `client/src/components/shell/authenticated-shell.tsx`, `client/src/lib/auth-client.ts`.

## 5. Dependencies
- `MLD-001` (Functional Login View and Better Auth Client setup).

## 6. Implementation Plan
1. In `client/src/components/shell/authenticated-shell.tsx`:
   - Import `authClient` from `client/src/lib/auth-client`.
   - Implement `handleSignOut`:
     ```typescript
     const handleSignOut = async () => {
       await authClient.signOut();
       queryClient.clear();
       navigate("/auth/login");
     };
     ```
   - Attach `handleSignOut` to the `Sign out` / `வெளியேறு` dropdown menu item.
2. Verify sign-out clears cookie and redirects to `/auth/login`.

## 7. Definition of Done
- [x] Clicking "Sign out" calls `POST /api/auth/sign-out`.
- [x] Session cookie is destroyed on response.
- [x] User is immediately navigated to `/auth/login`.
- [x] Subsequent access to protected routes redirects back to `/auth/login`.

## 8. Verification Evidence
- Layout wiring: `client/src/layouts/authenticated-layout.tsx`
  - Integrated `authClient.signOut()` and `queryClient.clear()` on profile dropdown menu sign out.
  - Shell checks for unsynced offline mutations and prompts confirmation dialog before session termination.
  - Redirects to `/auth/login` and triggers clean reload.
- Client build: `pnpm --filter client build` verified clean with 0 TypeScript/Vite errors.
