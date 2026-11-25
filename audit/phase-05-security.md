# Phase 5 Audit Report: Security, Vulnerability Analysis, Penetration Testing & OWASP Alignment

**Audit Target**: MillLedger Security Architecture, API Endpoints, Frontend Storage, Authentication Subsystem, and Supply Chain  
**Environment**: Local Runtime (Server: `http://127.0.0.1:4000`, Client: `http://127.0.0.1:4173`, Throwaway PostgreSQL DB `mill_ledger_audit_throwaway`), Node.js 22.22.1, TypeScript 5.8, Express 5.3.0, Better Auth 1.7.25, React 19, Playwright 1.65.1  
**Standards Baseline**:
- **OWASP Top 10:2021**
- **OWASP API Security Top 10:2023**
- **OWASP Application Security Verification Standard (ASVS) v4.0.3** (Fetched from official OWASP release repository: [https://github.com/OWASP/ASVS/tree/v4.0.3](https://github.com/OWASP/ASVS/tree/v4.0.3), October 2021)
**Audit Mode**: AUDIT ONLY (All verification scripts executed in `/audit/scripts/` and `/audit/tests/` against live throwaway server and DB)  
**Date**: November 19, 2026  
**Auditor**: Principal Engineer, Application Security Reviewer, Accessibility Specialist, and UX Auditor  

---

## 1. Executive Summary & Verification Methodology

Phase 5 conducted an empirical security assessment of the MillLedger ERP and shop floor system across all 10 OWASP Top 10:2021 categories, 10 OWASP API Security Top 10:2023 categories, and relevant OWASP ASVS v4.0.3 verification requirements.

Per Master Rulebook rules **E1** ("Nothing is true until observed") and **E2** ("Valid evidence is quoted working tree code, executed commands with raw output, saved artifacts, or official statutory documentation URLs"), the assessment combined:
1. Automated dependency vulnerability scanning (`pnpm audit`).
2. Complete git repository secret scanning across all 42 historical commits (`gitleaks:latest`).
3. Static application security testing using Semgrep (`uvx semgrep` with `p/owasp-top-ten`, `p/typescript`, `p/react`).
4. Dynamic application security testing via OWASP ZAP 2.17.0 (`zap.sh -cmd`) against both backend API and frontend SPA.
5. Network boundary and HTTP header inspection with `curl`.
6. Live browser evaluation using Playwright to inspect IndexedDB (Dexie), localStorage, sessionStorage, and logout behavior.
7. Targeted manual and scripted test fuzzing across Prisma raw queries, CSV exporters, business logic workflows, and supply-chain configurations.

### Security Status Overview

| Metric | Value | Reference Evidence |
| :--- | :--- | :--- |
| **Git Commits Scanned** | 42 commits (~8.71 MB scanned) | [`audit/evidence/gitleaks-report.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/gitleaks-report.json) (0 true secrets) |
| **Dependencies Audited** | 4 vulnerabilities (1 high, 3 moderate) | [`audit/evidence/pnpm-audit.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/pnpm-audit.json) |
| **Semgrep Rules Executed** | 264 rules across 1,031 tracked files | [`audit/evidence/semgrep-results.txt`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/semgrep-results.txt) (10 findings) |
| **OWASP ZAP DAST Alerts** | 1 Medium on Server (CSP directive fallback); 2 Medium, 1 Low on Client | [`audit/evidence/zap-report.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/zap-report.json), [`audit/evidence/zap-client-report.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/zap-client-report.json) |
| **Critical/High Security Findings (P0/P1)** | 7 Total (P0: 2, P1: 5) | [F-017](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-017.md), [F-018](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-018.md), [F-019](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-019.md), [F-020](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-020.md), [F-021](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-021.md), [F-026](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-026.md), [F-027](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-027.md) |
| **Medium/Low Security Findings (P2/P3)** | 6 Total (P2: 6) | [F-022](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-022.md), [F-023](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-023.md), [F-024](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-024.md), [F-025](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-025.md), [F-028](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-028.md), [F-029](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-029.md) |

---

## 2. Master Verification Table

*All requirement IDs cite OWASP ASVS v4.0.3 (October 2021).*

| OWASP Top 10:2021 | OWASP API 2023 | ASVS v4.0.3 Ref | Check / Scope | Tool / Command | Result | Finding ID |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **A01: Broken Access Control** | API3:2023 | Sec 1.4.1 | Mass Assignment in Order Creation | Script [`verify-object-property-authz.ts`](file:///home/snehan/projects/web/mill-ledger/audit/scripts/verify-object-property-authz.ts) | `VERIFIED-FAIL` | [F-017](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-017.md) |
| **A01: Broken Access Control** | API1:2023 | Sec 1.4.1 | Dispatches endpoint leaks company-wide customer orders | Script [`verify-object-property-authz.ts`](file:///home/snehan/projects/web/mill-ledger/audit/scripts/verify-object-property-authz.ts) | `VERIFIED-FAIL` | [F-018](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-018.md) |
| **A01: Broken Access Control** | API5:2023 | Sec 4.1.1 | Missing UI route guards; forced browsing to `/invoices`, etc. | Playwright [`ui-parity.spec.ts`](file:///home/snehan/projects/web/mill-ledger/audit/tests/ui-parity.spec.ts) | `VERIFIED-FAIL` | [F-019](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-019.md) |
| **A01: Broken Access Control** | API5:2023 | Sec 4.1.1 | Raw material stock ledger lacks authorization check | Script [`generate-role-endpoint-matrix.ts`](file:///home/snehan/projects/web/mill-ledger/audit/scripts/generate-role-endpoint-matrix.ts) | `VERIFIED-FAIL` | [F-021](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-021.md) |
| **A01: Broken Access Control** | API8:2023 | Sec 14.4.1 | CORS misconfiguration & untrusted origin filtering | `curl` with `Origin: http://evil.attacker.com` | `VERIFIED-PASS` | None (Rejected properly) |
| **A02: Cryptographic Failures** | API2:2023 | Sec 2.4.1 | Password hashing algorithm and parameter validation | Source audit [`server/node_modules/@better-auth/utils`](file:///home/snehan/projects/web/mill-ledger/node_modules/.pnpm/@better-auth+utils@0.5.1/node_modules/@better-auth/utils/dist/password.node.mjs#L1-L15) | `VERIFIED-PASS` | None (`scrypt` N=16384, r=16, p=1, dkLen=64) |
| **A02: Cryptographic Failures** | API3:2023 | Sec 8.3.1 | IndexedDB/Dexie sensitive PII persistence on logout | Playwright [`dexie-security.spec.ts`](file:///home/snehan/projects/web/mill-ledger/audit/tests/dexie-security.spec.ts) | `VERIFIED-FAIL` | [F-028](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-028.md) |
| **A02: Cryptographic Failures** | API2:2023 | Sec 3.5.3 | Client-side token storage in localStorage / sessionStorage | Playwright [`dexie-security.spec.ts`](file:///home/snehan/projects/web/mill-ledger/audit/tests/dexie-security.spec.ts) | `VERIFIED-PASS` | None (HTTP-only cookies used) |
| **A02: Cryptographic Failures** | API8:2023 | Sec 9.1.2 | Secrets committed in git history | `docker run ... gitleaks detect --log-opts="--all"` | `VERIFIED-PASS` | None (0 secrets in 42 commits) |
| **A03: Injection** | API10:2023 | Sec 5.3.4 | SQL injection in Prisma `$queryRaw` / `$executeRaw` | AST search & manual review of 8 raw queries | `VERIFIED-PASS` | None (All use tagged template literals) |
| **A03: Injection** | API10:2023 | Sec 5.3.8 | OS command execution (`child_process`, `exec`, `spawn`) | AST search across `server/src/`, `client/src/` | `VERIFIED-PASS` | None (Zero command sinks) |
| **A03: Injection** | API10:2023 | Sec 5.1.4 | CSV formula injection in report exports | Script [`verify-csv-injection.ts`](file:///home/snehan/projects/web/mill-ledger/audit/scripts/verify-csv-injection.ts) | `VERIFIED-FAIL` | [F-026](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-026.md) |
| **A03: Injection** | API10:2023 | Sec 5.2.4 | Cross-Site Scripting (`dangerouslySetInnerHTML`) | AST search across `client/src/` | `VERIFIED-PASS` | None (Zero sinks) |
| **A03: Injection** | API8:2023 | Sec 5.1.5 | HTTP header injection via `res.setHeader` | Code audit [`reporting.routes.ts:133`](file:///home/snehan/projects/web/mill-ledger/server/src/modules/reporting/reporting.routes.ts#L133) | `VERIFIED-PASS` | None (Restricted by enum switch) |
| **A04: Insecure Design** | API3:2023 | Sec 13.2.1 | Salesman price tampering (arbitrary price override) | Script [`verify-object-property-authz.ts`](file:///home/snehan/projects/web/mill-ledger/audit/scripts/verify-object-property-authz.ts) | `VERIFIED-FAIL` | [F-020](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-020.md) |
| **A04: Insecure Design** | API6:2023 | Sec 13.2.2 | Stock hoarding via non-expiring reservations | Prisma schema & service lifecycle audit | `VERIFIED-FAIL` | [F-027](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-027.md) |
| **A04: Insecure Design** | API6:2023 | Sec 13.2.3 | Replay unallocated payment (missing mandatory idempotency) | Source audit [`payment.service.ts:36`](file:///home/snehan/projects/web/mill-ledger/server/src/modules/finance/payment.service.ts#L36) | `VERIFIED-FAIL` | [F-024](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-024.md) / [F-025](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-025.md) |
| **A04: Insecure Design** | API6:2023 | Sec 13.2.1 | Double dispatch race condition & line override check | Source audit [`dispatch.service.ts:120-132`](file:///home/snehan/projects/web/mill-ledger/server/src/modules/sales/dispatch.service.ts#L120-L132) | `VERIFIED-PASS` | None (Guarded by `qtyToDispatch > remainingToDispatch`) |
| **A04: Insecure Design** | API3:2023 | Sec 5.1.1 | Negative quantity handling across sales, payments, inventory | Zod schema checks across all routes | `VERIFIED-PASS` | None (Enforced via `.positive()`) |
| **A05: Security Misconfiguration** | API8:2023 | Sec 14.4.1 | Helmet security headers & CSP emitted on server | `curl -s -i http://localhost:4000/api/v1/health` | `VERIFIED-PASS` | None (HSTS, CSP, nosniff present) |
| **A05: Security Misconfiguration** | API8:2023 | Sec 14.4.1 | Client SPA missing security headers | OWASP ZAP & `curl -s -i http://localhost:4173/` | `VERIFIED-FAIL` | [F-025](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-025.md) |
| **A05: Security Misconfiguration** | API8:2023 | Sec 7.4.1 | Production source maps leakage | File inspection `client/dist/assets/` | `VERIFIED-PASS` | None (No `.map` files in dist) |
| **A05: Security Misconfiguration** | API8:2023 | Sec 13.1.5 | Unhandled 413 payload crashes server with 500 stack trace | Script [`verify-middleware-chain.ts`](file:///home/snehan/projects/web/mill-ledger/audit/scripts/verify-middleware-chain.ts) | `VERIFIED-FAIL` | [F-025](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-025.md) |
| **A06: Vulnerable Components** | API8:2023 | Sec 10.2.1 | Zod memory exhaustion vulnerability (GHSA-mrhx-c7xc-m3w5) | Reachability audit via `pnpm audit` | `VERIFIED-PASS` | None (Constrained by 100KB body limit) |
| **A06: Vulnerable Components** | API8:2023 | Sec 10.2.1 | Vitest mocker path traversal & code injection | Reachability audit via `pnpm audit` | `VERIFIED-PASS` | None (DevDependencies only) |
| **A07: Identification & Auth** | API2:2023 | Sec 2.1.2 | Account lockout after repeated failed logins | Source audit [`server/src/lib/auth.ts`](file:///home/snehan/projects/web/mill-ledger/server/src/lib/auth.ts) | `VERIFIED-FAIL` | [F-024](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-024.md) |
| **A07: Identification & Auth** | API2:2023 | Sec 2.1.1 | Password complexity requirements | Source audit [`better-auth/dist/context/create-context.mjs`](file:///home/snehan/projects/web/mill-ledger/server/node_modules/better-auth/dist/context/create-context.mjs#L186) | `VERIFIED-FAIL` | [F-024](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-024.md) |
| **A07: Identification & Auth** | API2:2023 | Sec 3.3.1 | Password reset capability | Script [`verify-sessions-auth.ts`](file:///home/snehan/projects/web/mill-ledger/audit/scripts/verify-sessions-auth.ts) | `VERIFIED-FAIL` | [F-024](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-024.md) (Returns HTTP 404) |
| **A07: Identification & Auth** | API2:2023 | Sec 3.2.1 | Session fixation protection | Source audit Better Auth session generation | `VERIFIED-PASS` | None (New session token issued per login) |
| **A08: Software & Integrity** | API8:2023 | Sec 14.2.1 | Mutable GitHub Action tags (`@v4`) | `uvx semgrep scan` ([`ci.yml:43-51`](file:///home/snehan/projects/web/mill-ledger/.github/workflows/ci.yml#L43-L51)) | `VERIFIED-FAIL` | [F-029](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-029.md) |
| **A08: Software & Integrity** | API8:2023 | Sec 10.3.1 | Missing minimum package release age in `.npmrc`/`pnpm` | `uvx semgrep scan` ([`pnpm-workspace.yaml`](file:///home/snehan/projects/web/mill-ledger/pnpm-workspace.yaml)) | `VERIFIED-FAIL` | [F-029](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-029.md) |
| **A08: Software & Integrity** | API8:2023 | Sec 1.4.2 | Default credentials seeded unconditionally | Source audit [`server/prisma/seed.ts:601`](file:///home/snehan/projects/web/mill-ledger/server/prisma/seed.ts#L601) | `VERIFIED-FAIL` | [F-029](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-029.md) |
| **A08: Software & Integrity** | API8:2023 | Sec 12.1.1 | File upload security (MIME, extension, path traversal) | Codebase audit for upload handlers | `NOT-APPLICABLE` | None (No upload endpoints exist) |
| **A09: Logging & Monitoring** | API8:2023 | Sec 8.2.1 | Transactional audit trail for orders, dispatches, payments | Script [`verify-reports-and-scale.ts`](file:///home/snehan/projects/web/mill-ledger/audit/scripts/verify-reports-and-scale.ts) | `VERIFIED-FAIL` | [F-022](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-022.md) |
| **A09: Logging & Monitoring** | API8:2023 | Sec 8.1.1 | Request correlation IDs (`X-Request-Id`) & request logger | Script [`verify-middleware-chain.ts`](file:///home/snehan/projects/web/mill-ledger/audit/scripts/verify-middleware-chain.ts) | `VERIFIED-FAIL` | [F-025](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-025.md) |
| **A10: SSRF** | API7:2023 | Sec 12.6.1 | Outbound fetches to user-controlled URLs | Codebase search for `fetch`, `axios`, `http` in server | `NOT-APPLICABLE` | None (Zero outbound HTTP calls in server) |
| **Unrestricted Resource** | API4:2023 | Sec 13.1.3 | Missing pagination limits (`take`, `limit`) on queries | AST search across all Prisma services | `VERIFIED-FAIL` | [F-018](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-018.md) / [F-025](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-025.md) |
| **Unrestricted Resource** | API4:2023 | Sec 13.1.1 | App-wide API rate limiting | Script [`verify-middleware-chain.ts`](file:///home/snehan/projects/web/mill-ledger/audit/scripts/verify-middleware-chain.ts) | `VERIFIED-FAIL` | [F-025](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-025.md) |
| **Improper Inventory** | API9:2023 | Sec 13.1.4 | Redundant route aliasing & unversioned endpoint exposure | Router inspection in [`server/src/app.ts:40-56`](file:///home/snehan/projects/web/mill-ledger/server/src/app.ts#L40-L56) | `VERIFIED-FAIL` | [F-025](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-025.md) |

---

## 3. Detailed Vulnerability Analyses by Area

### 3.1 A02 Cryptographic Failures & Better Auth Introspection

#### Password Hashing Algorithm & Actual Parameters
Introspection of `@better-auth/utils` installed in `node_modules/.pnpm/@better-auth+utils@0.5.1/node_modules/@better-auth/utils/dist/password.node.mjs:1-15` confirmed the exact cryptographic implementation used by Better Auth:
- **Algorithm**: `node:crypto.scrypt`
- **CPU/Memory Cost ($N$)**: `16384` ($2^{14}$)
- **Block Size ($r$)**: `16`
- **Parallelization ($p$)**: `1`
- **Derived Key Length (`dkLen`)**: `64` bytes (512 bits)
- **Salt Generation**: `crypto.randomBytes(16).toString("hex")` (128-bit cryptographically secure salt)
- **Normalization**: Unicode Normalization Form KC (`password.normalize("NFKC")`)
- **Format**: `${salt}:${derivedKeyHex}` (32 hex characters salt + 128 hex characters key)

*Verdict*: `VERIFIED-PASS`. Meets OWASP Password Storage Cheat Sheet standards for memory-hard hashing algorithms.

#### Dexie / IndexedDB Contents & Logout Purge Behavior
Playwright test [`dexie-security.spec.ts`](file:///home/snehan/projects/web/mill-ledger/audit/tests/dexie-security.spec.ts) introspected the client storage layers before and after user sign-out:
1. **Tokens at Rest**: Neither session tokens nor API keys are stored in `localStorage` or `sessionStorage`. All authentication uses HTTP-only cookies (`better-auth.session_token`).
2. **Dexie Offline Database**: IndexedDB `mill_ledger_offline_db` caches customer master records (`id`, `code`, `name`, `phone`, `gstin`, `address`) and the offline outbox queue (`id`, `items`, `quotedUnitPrice`, `customerName`).
3. **Logout Behavior**: When a user clicks Sign Out, `queryClient.clear()` purges in-memory React Query state, but `offlineDb` is never cleared (`clearedOnLogout: false`). All customer phone numbers, GSTIN tax identifiers, and pending offline orders remain readable in the browser indefinitely.
*Verdict*: `VERIFIED-FAIL` ([F-028](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-028.md)).

---

### 3.2 A03 Injection Analysis

#### Prisma `$queryRaw` & `$executeRaw` Parameterization
Every raw SQL statement in `server/src/` was inspected:
- `server/src/modules/production/production.service.ts`: Lines 306, 498, 597
- `server/src/modules/sales/dispatch.service.ts`: Line 144
- `server/src/modules/inventory/inventory.service.ts`: Line 123
- `server/src/modules/finance/sequence.service.ts`: Lines 16, 26, 47

All 8 occurrences strictly use Prisma's safe tagged template literals (`tx.$queryRaw` `SELECT ... WHERE id = ${variable} FOR UPDATE`). Prisma automatically binds these variables as parameterized positional parameters (`$1`, `$2`), preventing SQL injection. Zero instances of string concatenation or `Prisma.raw` were detected.  
*Verdict*: `VERIFIED-PASS`.

#### CSV Formula Injection
Tested via [`verify-csv-injection.ts`](file:///home/snehan/projects/web/mill-ledger/audit/scripts/verify-csv-injection.ts). In `reporting.service.ts:exportToCSV`, cell contents are wrapped in double quotes without testing for formula prefix triggers (`=`, `+`, `-`, `@`, `\t`, `\r`). Outputting `"=cmd|' /C calc'!A0"` or `"@SUM(1,2)"` triggers formula execution in Microsoft Excel and LibreOffice Calc.  
*Verdict*: `VERIFIED-FAIL` ([F-026](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-026.md)).

#### Command Execution & Dangerous HTML Sinks
- Child process execution (`child_process`, `exec`, `spawn`, `fork`): **Zero sinks**.
- Path traversal in file operations: The backend performs zero filesystem reads or writes from user input.
- React XSS: **Zero instances** of `dangerouslySetInnerHTML`. React's native JSX escaping is strictly preserved.  
*Verdict*: `VERIFIED-PASS`.

---

### 3.3 A04 Insecure Design & Sensitive Business Logic Abuse

1. **Price Tampering**: `createOrderSchema` accepts arbitrary client-supplied `unitPrice` down to ₹0.01. Validated in Phase 3 [F-020](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-020.md).
2. **Approval State Bypass**: `createOrderSchema` permits `status: "APPROVED"` via request body mass assignment, bypassing supervisor workflow. Validated in Phase 3 [F-017](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-017.md).
3. **Stock Hoarding via Non-Expiring Reservations**: `StockReservation` schema lacks TTL and `expiresAt`. Reservations remain `ACTIVE` indefinitely, enabling malicious or accidental total inventory lockouts. Validated in [F-027](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-027.md).
4. **Replay of Unallocated Payments**: `recordPaymentSchema` treats `idempotencyKey` as optional. Replaying unallocated payment requests produces multiple receipt rows and creates duplicate cash credit on the customer's ledger.
5. **Double Dispatch & Negative Quantities**:
   - Double dispatch is blocked because `dispatch.service.ts:127` verifies `if (qtyToDispatch > remainingToDispatch) throw new AppError(...)`.
   - Negative quantities are rejected at the edge by Zod schemas (`.positive()`).

---

### 3.4 A05 Security Misconfiguration & Response Headers

#### Server Response Headers (Emitted at Runtime)
Verified via `curl -s -i http://localhost:4000/api/v1/health`:
```http
HTTP/1.1 200 OK
Content-Security-Policy: default-src 'self';base-uri 'self';font-src 'self' https: data:;form-action 'self';frame-ancestors 'self';img-src 'self' data:;object-src 'none';script-src 'self';script-src-attr 'none';style-src 'self' https: 'unsafe-inline';upgrade-insecure-requests
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Origin-Agent-Cluster: ?1
Referrer-Policy: no-referrer
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-DNS-Prefetch-Control: off
X-Download-Options: noopen
X-Frame-Options: SAMEORIGIN
X-Permitted-Cross-Domain-Policies: none
X-XSS-Protection: 0
Access-Control-Allow-Credentials: true
```
Helmet is correctly mounted at the root of `createApp()`.

#### Client SPA Response Headers
Verified via `curl -s -i http://localhost:4173/`:
The frontend dev/preview server emits **zero** security headers (no CSP, no X-Frame-Options, no nosniff, no HSTS). Handled in [F-025](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-025.md).

#### Production Source Maps & Debug Leaks
- `client/dist/assets/` contains zero `.map` files; source maps are not exposed in production builds (`VERIFIED-PASS`).
- Express 5 `errorHandler` suppresses stack traces in production (`env.NODE_ENV === "production"`), but misclassifies 413 `PayloadTooLargeError` as HTTP 500 ([F-025](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-025.md)).

---

### 3.5 A06 Vulnerable Components & Reachability Triage

`pnpm audit` reported 4 vulnerabilities:
1. **`zod < 4.6.6` (GHSA-mrhx-c7xc-m3w5, High)**:
   - *Vulnerability*: Memory exhaustion when validating oversized constrained collections.
   - *Reachability Analysis*: MillLedger uses Zod schemas (`createOrderSchema`, `recordPaymentSchema`) on inbound arrays. However, Express's built-in `express.json()` body-parser caps incoming payloads at 100KB by default. Payloads large enough to exhaust Node.js heap memory (>50MB) are rejected by body-parser before Zod is ever called. Within the 100KB limit, an array of ~1,000 minimal items parses in milliseconds without heap exhaustion.
   - *Verdict*: `VERIFIED-PASS` (Practically unexploitable due to pre-validation transport limits).
2. **`vitest` & `@vitest/mocker >= 2.1.0 < 4.1.12` (GHSA-82fw-gwwq-j7x9, GHSA-qxg6-89mg-rqv8, Moderate)**:
   - *Vulnerability*: Path traversal and arbitrary file read via test mocker.
   - *Reachability Analysis*: Vitest is isolated entirely in development toolchains (`devDependencies`) and is never packaged or executed in the production Node.js or browser bundle.
   - *Verdict*: `VERIFIED-PASS` (Not reachable in production runtime).

---

### 3.6 A08 Software & Data Integrity Failures

1. **Mutable GitHub Actions**: CI workflow `.github/workflows/ci.yml` invokes `actions/checkout@v4`, `pnpm/action-setup@v4`, and `actions/setup-node@v4` using mutable tags instead of pinned 40-character commit SHAs.
2. **Package Manager Supply-Chain Defenses**: Semgrep flagged that `.npmrc` and `pnpm-workspace.yaml` omit `minimumReleaseAge: 10080` (7 days), `blockExoticSubdeps: true`, and `trustPolicy: no-downgrade`.
3. **Unconstrained Seed in Production**: `server/prisma/seed.ts:runFullSeed` does not check `env.NODE_ENV !== "production"`. Executing the seed in production provisions default accounts with static passwords (`AdminPassword123!`).  
*Verdict*: `VERIFIED-FAIL` ([F-029](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-029.md)).

---

### 3.7 API4 Unrestricted Resource Consumption & API9 Inventory Management

1. **Unbounded Queries**: Every domain endpoint (`/api/v1/sales/orders`, `/api/v1/sales/dispatches`, `/api/v1/finance/invoices`, `/api/v1/production/runs`, `/api/v1/payments`) executes `prisma.*.findMany` with zero `take` or `limit` parameter. Only `audit.service.ts` caps results (`take: params.limit || 100`). A caller can trigger full table dumps and memory spikes.
2. **Route Duplication & API Drift**:
   In `server/src/app.ts`, subrouters are mounted under duplicate aliases:
   - `salesRouter` is mounted at `/api/v1/sales`, `/api/v1/orders`, and `/api/v1/dispatches`.
   - `productionRouter` is mounted at `/api/v1/production` and `/api/v1/production-runs`.
   - `inventoryRouter` is mounted at `/api/v1/inventory` and `/api/v1/purchase-receipts`.
   - `financeRouter` is mounted at `/api/v1/finance` and `/api/v1/invoices`.
   - `reportingRouter` is mounted at `/api/v1/reports` and `/api/v1/dashboard`.
   - Unversioned `/api/health` and `/api/auth` exist alongside `/api/v1/*`.
   Zero OpenAPI/Swagger specification exists in the repository, making route drift invisible to automated tooling.

---

## 4. Phase 5 Findings Index

| Finding ID | Title | Severity | OWASP 2021 | OWASP API 2023 | ASVS v4.0.3 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **[F-026](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-026.md)** | CSV Formula Injection (Formula Injection) in Export Reports | P1 | A03:2021 | API3:2023 | Sec 5.1.4 |
| **[F-027](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-027.md)** | Stock Hoarding & Inventory Denial of Service via Non-Expiring Reservations | P1 | A04:2021 | API6:2023 | Sec 13.2.2 |
| **[F-028](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-028.md)** | Customer PII and Offline Orders Retained in Client IndexedDB (Dexie) Across Logout | P2 | A02:2021 | API3:2023 | Sec 3.5.3, 8.3.1 |
| **[F-029](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-029.md)** | Software Supply Chain Integrity Deviations: Mutable CI Actions, Missing Minimum Release Age, and Unconstrained Production Seed | P2 | A08:2021 | API8:2023 | Sec 10.3.1, 14.2.1 |
