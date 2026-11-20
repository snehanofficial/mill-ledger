# Phase 3 Audit Report: Authorization, RBAC/ABAC, Session Management, Object & Property Security, and UI Parity

**Audit Target**: MillLedger Authorization Engine, Access Control Policies, Better Auth Session Subsystem, and Frontend UI Parity  
**Environment**: Throwaway PostgreSQL Database (`mill_ledger_audit_throwaway`), Node.js 22.22.1, TypeScript 5.8, Express 5.3.0, Better Auth 1.7.25, React 19, Playwright 1.65.1  
**Audit Mode**: AUDIT ONLY (All verification scripts executed in `/audit/scripts/` and `/audit/tests/` against live throwaway server and DB)  
**Date**: November 19, 2026  
**Auditor**: Principal Engineer, Application Security Reviewer, Accessibility Specialist, and UX Auditor  

---

## 1. Executive Summary & Verification Methodology

Phase 3 evaluated the authentication, session lifecycle, role-based access control (RBAC), attribute-based access control (ABAC), object/property-level authorization (OWASP API Security Top 10:2023), query-level scoping, and UI parity of the MillLedger ERP system.

Per Master Rulebook rules **E1** ("Nothing is true until observed") and **E2** ("Valid evidence is quoted working tree code, executed commands with raw output, saved artifacts, or official statutory documentation URLs"), every security claim was tested via live runtime introspection, HTTP request fuzzing across 567 role-endpoint combinations, automated Playwright headless browser navigation across 100 role-route pairs, and direct database state assertions.

### Overall Authorization Verification Status Matrix

| Subsystem / Area | Evaluated Standard / Requirement | Status | Critical Findings |
| :--- | :--- | :--- | :--- |
| **1. Middleware Pipeline** | Express 5 Architecture, OWASP API4/API8 | `VERIFIED-FAIL` | Pipeline omits request IDs, request logging, app rate limits, and JSON 404 handler; 413 payload error crashes with 500 ([F-025](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-025.md)) |
| **2. Permission Model** | RBAC/ABAC Invariants, REQ-052, REQ-053 | `VERIFIED-FAIL` | Data model lacks scope dimension (`own/team/all`); permissions enforced via scattered `if (role === ...)` checks; unassigned user defaults to `SALESMAN` |
| **3. Super Admin & Master** | OWASP ASVS v4.0.3 Sec 1.4, REQ-054 | `VERIFIED-FAIL` | Zero user/role management API routes; static seeded admin password; no last-admin demotion protection; zero MFA support ([F-023](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-023.md)) |
| **4. Role x Endpoint Matrix** | 81 Routes x 7 Roles (567 Executions) | `VERIFIED-FAIL` | 562 matches, 5 mismatches; 1 critical P0 auth bypass on procurement ledger ([F-021](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-021.md)), verified against [`role-endpoint-matrix.csv`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/role-endpoint-matrix.csv) |
| **5. Object & Property Security** | OWASP API1:2023, API3:2023, API5:2023 | `VERIFIED-FAIL` | P0 Mass Assignment allows salesman to create pre-approved orders directly in PostgreSQL ([F-017](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-017.md)); arbitrary price overrides down to ₹0.01 accepted ([F-020](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-020.md)) |
| **6. Query-Level Scoping** | SQL Query Scoping & Information Leakage | `VERIFIED-FAIL` | `GET /api/v1/sales/dispatches` leaks all company orders, dispatches, invoices, and customer names to salesmen ([F-018](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-018.md)); missing pagination |
| **7. UI Parity & Route Guards** | OWASP Top 10 A01, NN/g #9, WCAG 2.2 | `VERIFIED-FAIL` | Zero route-level guards in React SPA; direct URL navigation to forbidden routes renders full page shells without 403 barrier ([F-019](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-019.md)); verified in [`role-ui-route-matrix.csv`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/role-ui-route-matrix.csv) |
| **8. Better Auth Sessions** | OWASP A07:2021, ASVS Sec 2 & 3 | `VERIFIED-FAIL` | Password reset returns 404; zero account lockout after repeated failures; unlimited concurrent sessions ([F-024](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-024.md)) |
| **9. Audit Trail Coverage** | OWASP A09:2021, ASVS Sec 8.2 | `VERIFIED-FAIL` | `auditService.log` called only on report exports; 0 audit records generated for orders, dispatches, production, or payments ([F-022](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-022.md)) |

---

## 2. Section 1: Middleware Chain & Express 5 Specifics

### 1.1 Runtime Introspection vs Expected Pipeline
The runtime middleware pipeline of `createApp()` and every mounted router was introspected by executing [/audit/scripts/introspect-middleware.ts](file:///home/snehan/projects/web/mill-ledger/audit/scripts/introspect-middleware.ts).

**EXPECTED ORDER**:
`request-id -> security headers -> CORS -> body size limits and parsers -> request logging -> rate limit -> session/auth -> permission check -> input validation -> idempotency -> handler -> not-found -> error envelope`

**ACTUAL ORDER (Runtime Layer Walk)**:
1. `app.use(helmet())` (Security headers: Layer [0])
2. `app.use(cors(...))` (CORS: Layer [1])
3. `app.use("/api/auth", toNodeHandler(auth))` (Better Auth catch-all: Layer [2])
4. `app.use(express.json())` (JSON body parser without explicit limit or urlencoded parser: Layer [3])
5. Subrouters mounted at `/api/v1/*` (Layers [4-18]):
   - Each route attaches: `requireAuth` -> `authorize(resource, action)`
   - In-handler Zod schema validation (`schema.safeParse(req.body)`)
   - In-service idempotency lookup
   - Domain business handler
6. Backward compatibility alias: `app.use("/api/health", healthRouter)`
7. `app.use(errorHandler)` (Error envelope: Layer [19])

**DEVIATIONS OBSERVED**:
1. `request-id`: **MISSING**. No request ID generator or correlation header (`x-request-id`) is attached.
2. `request logging`: **MISSING**. No structured logging (pino-http, morgan) records incoming HTTP requests.
3. `rate limit`: **MISSING** on `/api/v1/*`. Rate limiting is only configured inside Better Auth for `/api/auth/*`.
4. `input validation`: Not a standalone middleware. Zod validation is deferred to the route handler body.
5. `idempotency`: Not an HTTP middleware. Evaluated inside domain database transactions.
6. `not-found`: **MISSING**. There is no catch-all 404 middleware prior to `errorHandler`.
7. `error envelope`: When body size exceeds 100KB, `body-parser` throws `PayloadTooLargeError`. `errorHandler` does not handle 413, crashing with HTTP 500 and leaking the server stack trace ([F-025](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-025.md)).

```text
=== VERIFYING UNKNOWN ROUTE 404 BEHAVIOR ===
Status Code: 404
Content-Type: text/html; charset=utf-8
Response Body: "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot GET /api/v1/does-not-exist</pre>\n</body>\n</html>\n"
```

### 1.2 Express 5 Version Verification (Installed: `express@5.3.0`)
- **Async Error Propagation**: Express 5 natively catches rejected promises in middleware and route handlers (`node_modules/.pnpm/router@2.2.0`). The manual `try/catch (err) { next(err) }` wrappers across all routes are redundant in Express 5, but functional.
- **Path Pattern Syntax**: Express 5 uses `path-to-regexp@8.0.0`. Wildcard routes (`/api/auth/*`) require specific handling. Path parameters (`req.params.id`) can evaluate to string arrays if repeated; routes defensively handle this via `Array.isArray(req.params.id) ? req.params.id[0] : req.params.id`.
- **`req.query` Behavior**: Express 5 defaults `query parser` to `'extended'` using `qs@6.16.0`, enabling nested query parameter parsing.

---

## 3. Section 2: Permission Model & Central Policy Architecture

### 2.1 RBAC Data Structure
In [server/src/policies/rbac.ts:3-50](file:///home/snehan/projects/web/mill-ledger/server/src/policies/rbac.ts#L3-L50), permissions are declared as a static TypeScript mapping:
```ts
export const ROLE_PERMISSIONS: Record<Role, Partial<Record<Resource, Action[]>>> = {
  ADMIN: { ... },
  SALESMAN: { ... },
  PRODUCTION: { ... },
  ACCOUNTANT: { ... },
  OWNER: { ... },
};
```
- **Deny-by-Default**: `hasRbacPermission()` returns `false` if a role, resource, or action is unmapped.
- **Unassigned User Elevation**: In [server/src/middleware/auth.middleware.ts:35](file:///home/snehan/projects/web/mill-ledger/server/src/middleware/auth.middleware.ts#L35) and [server/src/lib/auth.ts:59](file:///home/snehan/projects/web/mill-ledger/server/src/lib/auth.ts#L59), an unassigned or null role defaults to `"SALESMAN"`. Rather than denying access, unconfigured users are silently granted field salesman permissions.

### 2.2 Lack of Scope as Data
The permission data model lacks a scope dimension (`own`, `team`, `region`, `all`):
`export interface Permission { action: Action; resource: Resource; }` in [shared/src/types/auth.types.ts:17-20](file:///home/snehan/projects/web/mill-ledger/shared/src/types/auth.types.ts#L17-L20).

Because scope is absent from the RBAC data structure, scoping is implemented as scattered `if (role === ...)` checks:
- `reporting.routes.ts:39`: `if (role !== "ADMIN" && role !== "OWNER" && role !== "ACCOUNTANT") throw new AppError(..., 403);`
- `reporting.routes.ts:86-100`: Hardcoded array check blocking `SALESMAN` and `PRODUCTION` from specific report types.
- `sales.routes.ts:185`: `if (req.user?.role === "SALESMAN") { await salesService.getSalesOrderById(...); }`
- `sales.service.ts:128, 612, 695, 753, 779`: Repeated inline string checks for `"SALESMAN"`.
- `abac.ts:21-62`: Hardcoded role rules specifically targeting `"SALESMAN"`.

---

## 4. Section 3: Super Admin, Master Permissions, and MFA

### 3.1 Administration Capabilities
- **User Management**: **0 API endpoints**. In [server/src/policies/rbac.ts:15](file:///home/snehan/projects/web/mill-ledger/server/src/policies/rbac.ts#L15), `ADMIN` is assigned `user: ["create", "read", "update", "delete"]`. However, no router or service implements user CRUD.
- **Role/Permission Management**: Zero endpoints or database models exist to dynamically configure roles or modify permissions.
- **Last Admin Safeguard**: There is no code or database trigger preventing the sole administrator from being deleted, deactivated, or demoted.
- **Bootstrap Mechanism**: The first administrator is created via a hardcoded password (`AdminPassword123!`) in [server/prisma/seed.ts:20-24](file:///home/snehan/projects/web/mill-ledger/server/prisma/seed.ts#L20-L24). There is no secure bootstrap CLI, one-time invitation token, or prompt.
- **MFA / 2FA**: Better Auth is configured in [server/src/lib/auth.ts](file:///home/snehan/projects/web/mill-ledger/server/src/lib/auth.ts) without plugins. TOTP, SMS, and Passkeys are completely unsupported ([F-023](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-023.md)).
- **Audit Logging of Admin Privilege**: Bypassed for all admin operations. `auditService.log` is never invoked on order approvals, dispatch postings, production reversals, or invoice creations ([F-022](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-022.md)).

---

## 5. Section 4: Role x Endpoint Matrix (567 Executions)

The 81 enumerated endpoints were tested across 7 distinct roles:
1. `ANONYMOUS` (Unauthenticated)
2. `NO_ROLE` (Authenticated user with role `NONE`)
3. `SALESMAN` (`salesman1@millledger.local`)
4. `PRODUCTION` (`production@millledger.local`)
5. `ACCOUNTANT` (`accountant@millledger.local`)
6. `OWNER` (`owner@millledger.local`)
7. `ADMIN` (`admin@millledger.local`)

Full results were exported to [/audit/evidence/role-endpoint-matrix.csv](file:///home/snehan/projects/web/mill-ledger/audit/evidence/role-endpoint-matrix.csv).

### Execution Summary
- **Total Tests Executed**: 567
- **Exact Matches (Expected vs Actual)**: 562 (99.1%)
- **Mismatches**: 5
- **Critical P0 Auth Bypasses**: 1

### Critical Findings from Matrix Execution
1. **[P0] `GET /api/v1/purchase-receipts/items/:id/ledger` Accessible to `SALESMAN` (Status: 200)**:
   - Expected: 403 Forbidden (Salesmen have no procurement permissions).
   - Actual: 200 OK.
   - Root Cause: `app.use("/api/v1/purchase-receipts", inventoryRouter)` mounts the inventory router under the purchase receipts prefix. The item ledger route requires `authorize("inventory", "read")`, which is held by `SALESMAN`. Salesmen can inspect raw material procurement ledgers ([F-021](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-021.md)).
2. **`PUT /api/v1/sales/orders/:id` Returns 403 on Empty Payload for Salesman**:
   - ABAC rule in `abac.ts:27-33` checks `resourceAttributes.creatorId === user.id && resourceAttributes.status === 'DRAFT'`. Because `resourceAttributes` reads `req.body`, an empty PUT body causes ABAC evaluation to fail with 403.

---

## 6. Section 5: Object-Level and Property-Level Authorization (OWASP API1, API3, API5)

Executed via [/audit/scripts/verify-object-property-authz.ts](file:///home/snehan/projects/web/mill-ledger/audit/scripts/verify-object-property-authz.ts) on live throwaway server. Evidence saved in [/audit/evidence/object-property-authz.txt](file:///home/snehan/projects/web/mill-ledger/audit/evidence/object-property-authz.txt).

### 5.1 Broken Object Level Authorization (BOLA / IDOR)
- **Salesman 1 Reading Salesman 2's Order**: `GET /api/v1/sales/orders/:sm2OrderId` -> **403 Forbidden** (`VERIFIED-PASS`). Service verifies `order.salesmanId !== user.id`.
- **Salesman 1 Editing Salesman 2's Order**: `PUT /api/v1/sales/orders/:sm2OrderId` -> **403 Forbidden** (`VERIFIED-PASS`).
- **Salesman 1 Approving Salesman 2's Order**: `POST /api/v1/sales/orders/:sm2OrderId/approve` -> **403 Forbidden** (`VERIFIED-PASS`).
- **Salesman 1 Invoicing Salesman 2's Order**: `POST /api/v1/finance/invoices` -> **403 Forbidden** (`VERIFIED-PASS`).
- **Salesman 1 Creating Order for Salesman 2's Customer**: `POST /api/v1/sales/orders` -> **403 Forbidden** (`VERIFIED-PASS`). Service verifies `salesmanCustomerAssignment`.

### 5.2 Mass Assignment & Broken Property Level Authorization (OWASP API3:2023)
- **P0 Privilege Escalation via `status: "APPROVED"`**:
  - Request: `POST /api/v1/sales/orders` with body `{"customerId": "...", "status": "APPROVED", ...}`.
  - Actual: **201 Created**.
  - Database State: `sales_order.status` set directly to `APPROVED` in PostgreSQL. Stock reservations created: 0.
  - Finding: Critical mass assignment vulnerability allowing salesmen to self-approve orders and bypass manager ATP review ([F-017](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-017.md)).
- **Unrestricted Client Price Overrides**:
  - Request: `POST /api/v1/sales/orders` with line `{ "quantity": 100, "unitPrice": 0.01 }`.
  - Actual: **201 Created**. Total billed: ₹1.05 for 100 units (nominal ₹5,000+).
  - Finding: Missing price floor validation and discount authority enforcement ([F-020](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-020.md)).

### 5.3 Cross-Tenant Data Access
- Request: `GET /api/v1/sales/customers?organizationId=UNKNOWN_TENANT_999`.
- Actual: **403 Forbidden** (`VERIFIED-PASS`). `requireTenant` middleware blocks unauthorized organization IDs.

---

## 7. Section 6: Query-Level Scoping & Data Leaks

1. **Information Leak in Dispatch List**:
   - In `server/src/modules/sales/dispatch.service.ts:268`, `getDispatches(organizationId)` queries `prisma.dispatch.findMany({ where: { organizationId } })`.
   - `salesRouter.get("/dispatches", requireAuth, authorize("order", "read"), ...)` allows role `SALESMAN`.
   - Result: Any field salesman querying `/api/v1/sales/dispatches` receives company-wide dispatch numbers, vehicle numbers, invoice links, and competitor customer accounts ([F-018](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-018.md)).
2. **Missing Database Pagination**:
   - List queries in `sales.service.ts` (`findMany`), `inventory.service.ts`, and `finance.service.ts` execute unbounded `findMany` queries without `take` / `skip` parameters.
   - At mill production scale (10,000+ orders), list queries risk Node heap exhaustion.

---

## 8. Section 7: UI Parity & Client Route Protection

Automated verification executed with Playwright across 5 seeded roles and 20 client routes in [/audit/tests/ui-parity.spec.ts](file:///home/snehan/projects/web/mill-ledger/audit/tests/ui-parity.spec.ts). Full matrix saved in [/audit/evidence/role-ui-route-matrix.csv](file:///home/snehan/projects/web/mill-ledger/audit/evidence/role-ui-route-matrix.csv).

### 8.1 Direct URL Access to Forbidden Routes
- When `SALESMAN` navigates directly to `/invoices`, `/payments`, `/production/today`, `/purchases`, `/dispatch`, or `/reports/audit`:
  - **Actual Behavior**: The React SPA renders the full page shell, headers, and tabs (`SHELL-RENDERED`). Queries to the backend fail with 403, leaving the user with an empty screen or zero KPI totals.
  - **Status**: `VERIFIED-FAIL` (34 route violations across roles, [F-019](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-019.md)). Zero route-level 403 guard pages exist.
- When `PRODUCTION` navigates directly to `/orders`, `/invoices`, `/payments`, or `/customers`:
  - Page shell renders; backend queries fail silently.
- When `ACCOUNTANT` navigates directly to `/orders/new` or `/production/today`:
  - Page shell renders without permission check.

### 8.2 Button Parity on Operational Pages
- **`/orders` Page**: Both `ACCOUNTANT` and `OWNER` are presented with the "New order" button (`true`), despite neither having `order:create` permission in RBAC.
- **`/invoices` Page**: "Credit note" button is correctly hidden for `ACCOUNTANT` (`false`).
- **`/payments` Page**: "Record payment" button is correctly hidden for `ACCOUNTANT` (`false`).

---

## 9. Section 8: Better Auth Sessions, Cookies, and Security

Executed via [/audit/scripts/verify-sessions-auth.ts](file:///home/snehan/projects/web/mill-ledger/audit/scripts/verify-sessions-auth.ts). Raw output saved in [/audit/evidence/better-auth-sessions.txt](file:///home/snehan/projects/web/mill-ledger/audit/evidence/better-auth-sessions.txt).

```text
=== BETTER AUTH AUDIT VERIFICATION ===
Standard: OWASP Top 10:2021 A07:2021, OWASP ASVS v4.0.3 Sec 2 & 3
Installed Version: better-auth@1.7.25

1. Cookie Security Flags:
   Set-Cookie: better-auth.session_token=...; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax
   - HttpOnly: true (VERIFIED-PASS)
   - SameSite: Lax (VERIFIED-PASS)
   - Secure: false in development; configured to true in production via useSecureCookies (VERIFIED-PASS)
   - Max-Age: 604,800 seconds (7 days)

2. Database Session Lifetime:
   - Created At: 2026-11-19T12:33:11.805Z
   - Expires At: 2026-11-26T12:33:11.805Z (Exact 168.00 hours / 7.0 days)

3. Session Rotation on Re-login:
   - Initial Token: VvZ0LYpZuIc0kqbh...
   - Subsequent Token: 7Zp3NPSuD00c2neK... (VERIFIED-PASS, tokens differ)

4. Concurrent Sessions:
   - Active concurrent sessions in DB for admin: 607
   - Older sessions remain valid; unlimited concurrent logins permitted.

5. Server-side Logout Invalidation:
   - POST /api/auth/sign-out: 200 OK
   - Database record in `session` table: DELETED (VERIFIED-PASS)
   - Subsequent request with logged-out cookie: 401 Unauthorized (VERIFIED-PASS)

6. Password Reset Flow:
   - POST /api/auth/forget-password: HTTP 404 Not Found (VERIFIED-FAIL, F-024)

7. Brute Force Protection and Account Lockout:
   - 6 consecutive failed password attempts: All returned 401.
   - User account status: `isActive = true`.
   - Immediate login with valid password: HTTP 200 OK (VERIFIED-FAIL, F-024, zero lockout).

8. User Enumeration Testing:
   - Nonexistent user: 71.4ms, status 401, {"message":"Invalid email or password","code":"INVALID_EMAIL_OR_PASSWORD"}
   - Existing user wrong password: 73.4ms, status 401, {"message":"Invalid email or password","code":"INVALID_EMAIL_OR_PASSWORD"}
   - Timing difference: 2.0ms. Error messages identical (VERIFIED-PASS, resists enumeration).
```

---

## 10. Phase 3 Findings Register

| Finding ID | Severity | Title | Category | Status |
| :--- | :--- | :--- | :--- | :--- |
| [**F-017**](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-017.md) | **P0** | Mass Assignment in Order Creation Permits Self-Approval Bypassing Manager Authorization and ATP Stock Reservations | Authorization / Mass Assignment | **OPEN** |
| [**F-018**](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-018.md) | **P1** | Information Disclosure via Unscoped `GET /api/v1/sales/dispatches` Exposing Company-wide Orders and Invoices to Salesmen | Authorization / BOLA | **OPEN** |
| [**F-019**](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-019.md) | **P1** | Missing React Router Route Guards and Dedicated 403 Barrier on Direct URL Navigation | Frontend Security / Broken Access Control | **OPEN** |
| [**F-020**](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-020.md) | **P1** | Unrestricted Client Price Overrides Allowing Zero or Sub-Cost Sales Orders Without Manager Approval | Business Logic / Financial Integrity | **OPEN** |
| [**F-021**](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-021.md) | **P1** | Procurement Subsystem Movement Ledger Exposed to Salesmen via Multi-Mounted Router Prefix | Architecture / Authorization Leak | **OPEN** |
| [**F-022**](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-022.md) | **P1** | Absence of Audit Logging Across Operational Mutations (Orders, Dispatches, Invoices, Payments) | Security Logging & Monitoring | **OPEN** |
| [**F-023**](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-023.md) | **P1** | Missing User/Role Management APIs, Static Seeded Admin Password, and Zero MFA Protection | Identity & Privileged Access | **OPEN** |
| [**F-024**](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-024.md) | **P2** | Missing Password Reset Flow (404) and Absence of Account Lockout on Authentication Failures | Authentication / Credential Management | **OPEN** |
| [**F-025**](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-025.md) | **P2** | Express 5 Middleware Deviations: Missing Request ID, Missing App Rate Limits, Missing JSON 404, and 413 Returning 500 | Middleware Pipeline / Error Handling | **OPEN** |

---

## 11. Evidence Files Generated in Phase 3

1. [/audit/evidence/role-endpoint-matrix.csv](file:///home/snehan/projects/web/mill-ledger/audit/evidence/role-endpoint-matrix.csv): Complete 567-row execution log covering 81 API routes across all 7 roles.
2. [/audit/evidence/role-ui-route-matrix.csv](file:///home/snehan/projects/web/mill-ledger/audit/evidence/role-ui-route-matrix.csv): Complete 100-row Playwright execution log covering 20 client UI routes across all 5 authenticated roles.
3. [/audit/evidence/object-property-authz.txt](file:///home/snehan/projects/web/mill-ledger/audit/evidence/object-property-authz.txt): Raw HTTP logs of BOLA, mass assignment, arbitrary pricing, and cross-tenant tests.
4. [/audit/evidence/better-auth-sessions.txt](file:///home/snehan/projects/web/mill-ledger/audit/evidence/better-auth-sessions.txt): Raw session cookie inspection, database expiration, rotation, logout, lockout, and user enumeration timing tests.
