# Phase 14 Audit Report: Operations, Deployment & Production Readiness

- **Audit Date**: 2026-11-20
- **Auditor**: Principal Systems Engineer, Application Security Reviewer, SRE & Operations Auditor
- **Target Standards & Specifications**:
  - `Problem_Statement_Winter_Internship_Application_2026.md`:
    - Section 5: Benchmark Scenario & Operational Invariants
    - Requirements for Production Readiness, Packaging & Delivery
  - Master Rulebook:
    - Evidence Rules E1 through E11 (Verify by doing, not reading config)
    - "If a required setting is missing, fail loudly. Don't quietly carry on."
    - "Never touch production data or real secrets. Use a throwaway local database and a .env.audit file."
  - Standards & Norms:
    - The Twelve-Factor App (Factors III: Config, V: Build/Release/Run, IX: Disposability, XI: Logs)
    - CIS Docker Benchmark v1.6.0 (Container Images & Build Files)
    - Kubernetes Health Check Best Practices (Liveness vs Readiness Probes)
    - OWASP Top 10:2021 (A05:2021 Security Misconfiguration, A09:2021 Security Logging Failures)
    - NIST SP 800-218 (Secure Software Development Framework)
    - Digital Personal Data Protection Act, 2023 (DPDP Act 2023, India, Sections 11 & 12)
    - Central Goods and Services Tax Act, 2017 (CGST Act 2017, Section 36)
- **Saved Evidence Artifacts**:
  - Configuration & Boot Validation: [`audit/evidence/config-boot-results.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/config-boot-results.json)
  - Database Operations & Restore Benchmark: [`audit/evidence/database-ops-results.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/database-ops-results.json)
  - Runtime Operations & Shutdown Harness: [`audit/evidence/runtime-ops-results.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/runtime-ops-results.json)
  - Observability & Logging Inventory: [`audit/evidence/observability-inventory.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/observability-inventory.json)

---

## 1. Executive Summary

Phase 14 evaluated the operational deployment readiness of MillLedger across containerization, configuration safety, database lifecycle and disaster recovery, runtime stability, observability, CI/CD pipeline integrity, documentation veracity, and statutory data protection.

```mermaid
flowchart TD
    subgraph OpsAudit["Phase 14: Operations & Deployment Verification"]
        A["Container & Build"] --> A1["Dockerfile BROKEN: missing tsconfig.json<br/>All devDependencies copied to runtime<br/>Express server never serves client/dist"]
        B["Configuration & Seed"] --> B1["DATABASE_URL defaults silently in prod<br/>No staging environment config<br/>Seed script executes unconstrained in prod (P0)"]
        C["Database & DR"] --> C1["pg_dump: 196ms (28.38 MB)<br/>Restore: 907ms (100% data fidelity)<br/>No statement/idle timeouts configured"]
        D["Runtime & Health"] --> D1["GET /health ignores DB status<br/>Readiness probe missing (404)<br/>trust proxy false: discards client IPs"]
        E["Observability"] --> E1["Zero source maps (client & server)<br/>No structured logger (34 console calls)<br/>Zero metrics (/metrics) & zero alerts"]
        F["CI/CD & Merge Gates"] --> F1["Missing: E2E, Lighthouse, Audit, Bundle gate<br/>Branch main UNPROTECTED (HTTP 404)"]
        G["Data Protection"] --> G1["Indefinite retention of customer/user PII<br/>Zero erasure/anonymization workflows<br/>Zero data export endpoints under DPDP 2023"]
    end
```

### High-Impact Operational Findings
1. **Unchecked Benchmark Seed Execution in Production (Finding F-101, Severity P0)**: Running `pnpm db:seed` under `NODE_ENV=production` executes indiscriminately with exit code 0, creating 8 test accounts with well-known passwords (`AdminPassword123!`) and overwriting master records and inventory ledgers.
2. **Broken Container Build & Delivery (Finding F-099, Severity P1)**: `docker build` fails immediately on line 23 (`COPY tsconfig.json ./`) because no root `tsconfig.json` exists. The image packages unpruned devDependencies (Playwright, Vitest), and `server/src/app.ts` lacks static file serving for `client/dist`.
3. **Database URL Silent Fallback in Production (Finding F-100, Severity P1)**: When `DATABASE_URL` is omitted in `NODE_ENV=production`, the server does not fail fast; it quietly defaults to `postgresql://postgres:postgres@localhost:5432/mill_ledger?schema=public`, violating fail-loud requirements.
4. **Defective Health Checks & Disabled Trust Proxy (Finding F-102, Severity P1)**: `GET /api/v1/health` returns HTTP 200 OK without verifying PostgreSQL connectivity; `/api/v1/ready` returns 404. `trust proxy` is disabled (`false`), causing `req.ip` to misattribute all incoming requests to the reverse proxy IP (`127.0.0.1`), defeating IP rate limiting and audit trails.
5. **CI/CD Pipeline Gaps & Unprotected Main Branch (Finding F-104, Severity P1)**: `.github/workflows/ci.yml` omits E2E browser tests, bundle-size gates, Lighthouse CI, dependency audit, and secret scanning. The GitHub `main` branch has **zero branch protection** (`HTTP 404: Branch not protected`), allowing direct unvalidated pushes.
6. **Total Absence of Observability (Finding F-103, Severity P2)**: The backend relies entirely on 34 raw `console.log` statements; Pino/Winston is not installed. Zero source maps exist in production builds, zero React Error Boundaries exist on the client, and no `/metrics` or alert definitions exist.
7. **Missing Operational Runbooks & Data Dictionary (Finding F-105, Severity P2)**: Zero runbooks exist for deployment, rollback, disaster recovery, secret rotation, or super-admin recovery. Technical documentation lacks a column-level data dictionary.
8. **Statutory Data Protection Deficits (Finding F-106, Severity P2)**: No data retention policies, erasure/anonymization routines, or subject access export endpoints exist under the Indian Digital Personal Data Protection Act, 2023 (DPDP Act 2023).

---

## 2. Build and Container Execution

### 2.1 Production Workspace Build
Executing `pnpm build` across all workspace projects:
- **Client**: `tsc -b && vite build` completed in 6.3s, generating 38 precached PWA service worker entries and bundled assets in `client/dist/`.
- **Server**: `tsc` compiled TypeScript source files into `server/dist/`.
- **Shared**: Contracts and Zod schemas compiled successfully.
- **Status**: **VERIFIED-PASS**

### 2.2 Container Packaging & Dockerfile Verification
The project includes [`Dockerfile`](file:///home/snehan/projects/web/mill-ledger/Dockerfile), [`.dockerignore`](file:///home/snehan/projects/web/mill-ledger/.dockerignore), and [`docker-compose.yml`](file:///home/snehan/projects/web/mill-ledger/docker-compose.yml).

Executing `docker build -t mill-ledger:audit-test .` in this audit session:
```text
[+] Building 0.5s (16/28)
 => ERROR [builder 12/13] COPY tsconfig.json ./
------
 > [builder 12/13] COPY tsconfig.json ./:
------
Dockerfile:23
--------------------
  21 |     COPY client/ ./client/
  22 |     COPY server/ ./server/
  23 | >>> COPY tsconfig.json ./
--------------------
ERROR: failed to build: failed to solve: failed to compute cache key: failed to calculate checksum of ref ...: "/tsconfig.json": not found
```

| Criteria | Expected | Observed | Status |
|---|---|---|---|
| **Build Execution** | Builds successfully via `docker build` | Fails at Step 12/13 (`COPY tsconfig.json ./`) | **VERIFIED-FAIL** (F-099) |
| **Base Image** | Minimal Linux distribution | `node:22-alpine` | **VERIFIED-PASS** |
| **Non-Root User** | Runs under unprivileged user | User `millapp` (UID 1001), Group `nodejs` (GID 1001) | **VERIFIED-PASS** |
| **`.dockerignore`** | Ignores `node_modules`, `.git`, `.env*` | Includes `node_modules`, `.git`, `dist`, `.env*` | **VERIFIED-PASS** |
| **Dependency Pruning** | Production image contains only prod deps | Line 47 copies full `/app/node_modules` without prune | **VERIFIED-FAIL** (F-099) |
| **Secrets Baked In** | No hardcoded credentials in image | No baked secrets in `Dockerfile` (Compose has defaults) | **VERIFIED-PASS** |
| **SPA Asset Serving** | Port 4000 serves UI SPA and API | `server/src/app.ts` omits `express.static('client/dist')` | **VERIFIED-FAIL** (F-099) |

---

## 3. Configuration & Environment Validation

### 3.1 Startup Environment Validation (Fail-Fast Verification)
We executed empirical boot tests (`audit/scripts/test-phase14-config.ts`) across isolated environment configurations:

| Test Scenario | Input Environment Variables | Expected Result | Observed Exit Code & Behavior | Status |
|---|---|---|---|---|
| **Dev Secret in Production** | `NODE_ENV=production`<br/>`BETTER_AUTH_SECRET=mill-ledger-development-secret-123456` | Fail fast with error | Exit code `1`: "BETTER_AUTH_SECRET must not use the default development secret" | **VERIFIED-PASS** |
| **Short Secret in Production** | `NODE_ENV=production`<br/>`BETTER_AUTH_SECRET=short-secret-only-24-chr` | Fail fast with error | Exit code `1`: "BETTER_AUTH_SECRET must be at least 32 characters in production" | **VERIFIED-PASS** |
| **Localhost CORS in Production** | `NODE_ENV=production`<br/>`CORS_ORIGIN=http://localhost:5173` | Fail fast with error | Exit code `1`: "CORS_ORIGIN must be explicitly configured with non-local production origin(s)" | **VERIFIED-PASS** |
| **Missing `DATABASE_URL` in Production** | `NODE_ENV=production`<br/>*(DATABASE_URL omitted)* | Fail fast loudly | Exit code `0`: Silently defaulted to `postgresql://postgres:postgres@localhost:5432/mill_ledger?schema=public` | **VERIFIED-FAIL** (F-100) |
| **Missing `DATABASE_URL` in Development** | `NODE_ENV=development`<br/>*(DATABASE_URL omitted)* | Fail fast loudly | Exit code `0`: Silently defaulted to localhost Postgres | **VERIFIED-FAIL** (F-100) |

### 3.2 Environment Segregation
- The repository provides only `.env.example` and uncommitted `server/.env`.
- No `.env.development`, `.env.staging`, or `.env.production` files exist. Staging configurations are absent (**VERIFIED-FAIL**, F-100).

### 3.3 Production Seed Script Protection
Executing `server/prisma/seed.ts` under explicit `NODE_ENV=production`:
```bash
NODE_ENV=production DATABASE_URL="..." BETTER_AUTH_SECRET="..." CORS_ORIGIN="..." pnpm --filter @mill-ledger/server exec tsx prisma/seed.ts
```
- **Observed**: Process exited with code `0`.
- **Output**:
  ```text
  Seeding test users for M1...
  Seeding benchmark master data and opening stock (M2)...
  M2 benchmark master data seed successfully completed.
  ```
- **Verdict**: The seed script has **zero production safety guard**, creating demo accounts and overwriting master records in production (**VERIFIED-FAIL**, F-101).

---

## 4. Database Lifecycle, Pooling & Disaster Recovery

### 4.1 Migration Forward-Only & Data Fidelity Checks
- **Forward-Only**: Prisma Migrate employs forward-only migrations. `server/prisma/migrations/` contains 2 sequential migration directories (`20261118000000_init_baseline` and `20261118000001_constraints_and_sequences`).
- **CI Migration Reality**: In `.github/workflows/ci.yml:68-69`, `prisma migrate deploy` is executed solely against a fresh, empty Postgres container. It is **never executed against pre-existing realistic data** (**VERIFIED-FAIL**, F-104).
- **Realistic Data Migration Test**: We executed `prisma migrate deploy` against a restored database containing all 39 tables and populated transactional records (`audit/evidence/database-ops-results.json`). It succeeded with 0 pending migrations and zero data truncation.

### 4.2 Live Backup & Disaster Recovery Benchmark
We conducted an empirical backup and restore drill using `pg_dump` and `psql` against populated throwaway database `mill_ledger_audit_throwaway`:
- **Source Database**: `mill_ledger_audit_throwaway` (39 base tables).
- **Backup Command**:
  ```bash
  PGPASSWORD="***" pg_dump -h localhost -p 5432 -U postgres -d mill_ledger_audit_throwaway -F p -f audit/scratch/audit_backup.sql
  ```
  - **Dump Duration**: **196 ms**
  - **Dump File Size**: **28,376,932 bytes** (~28.38 MB)
- **Target Database**: `mill_ledger_restore_test` (freshly provisioned).
- **Restore Command**:
  ```bash
  PGPASSWORD="***" psql -h localhost -p 5432 -U postgres -d mill_ledger_restore_test -f audit/scratch/audit_backup.sql
  ```
  - **Restore Duration**: **907 ms**
- **Data Fidelity Verification**:
  - Queried row counts for all 39 tables across source and target databases.
  - **Discrepancies**: **0** (100% exact row count match across all 39 tables).
- **Automated Backup Configuration**: Searching the repository confirms **no backup scripts, WAL archiving configs, or scheduled cron jobs exist** in the repository (**VERIFIED-FAIL**, F-105).

### 4.3 Connection Pooling & Query Timeouts
Inspecting [`server/src/db/client.ts:6-8`](file:///home/snehan/projects/web/mill-ledger/server/src/db/client.ts#L6-L8):
```typescript
const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
});
```
- **Max Connections (`max`)**: Omitted. Defaults to `pg`'s hardcoded default of 10 connections.
- **Statement Timeout (`statement_timeout`)**: Omitted. Unbounded.
- **Idle Timeout (`idleTimeoutMillis`)**: Omitted.
- **Connection Timeout (`connectionTimeoutMillis`)**: Omitted.
- **Status**: **VERIFIED-FAIL** (F-102).

---

## 5. Runtime Architecture & Stability

### 5.1 Health vs Readiness Endpoints
We probed runtime endpoints on Express:
- **`GET /api/v1/health`**: Returns HTTP 200 `{ status: "ok", timestamp, uptime, service, version }`. **Does not query PostgreSQL**. If PostgreSQL is down or deadlocked, the endpoint still returns HTTP 200 OK (**VERIFIED-FAIL**, F-102).
- **`GET /api/v1/ready`**: Returns HTTP 404 Not Found. Dedicated readiness probe does not exist (**VERIFIED-FAIL**, F-102).

### 5.2 Graceful Shutdown Verification
We executed an automated shutdown harness (`audit/scripts/verify-runtime-ops.ts`) firing a 1,000 ms slow request while issuing `SIGTERM`:
```text
[HARNESS] server listening on 4098
[HARNESS] slow-task started
[HARNESS] Shutting down gracefully...
[HARNESS] slow-task completed
In-flight request result after SIGTERM: { status: 200, json: { status: 'completed' }, aborted: false }
```
- **In-flight HTTP Completion**: The HTTP request finished successfully without abortion because Node's `server.close()` allows active sockets to finish.
- **Flaws in Shutdown Implementation**:
  - [`server/src/index.ts:12-18`](file:///home/snehan/projects/web/mill-ledger/server/src/index.ts#L12-L18) does not invoke `prisma.$disconnect()`.
  - There is no timeout fallback (e.g. `setTimeout(() => process.exit(1), 10000).unref()`). If a connection hangs indefinitely, the shutdown handler will block container termination until a hard `SIGKILL`.

### 5.3 Reverse Proxy & `trust proxy` Verification
- In [`server/src/app.ts`](file:///home/snehan/projects/web/mill-ledger/server/src/app.ts), `app.set("trust proxy", ...)` is not configured (`app.get("trust proxy") === false`).
- Fired test request sending `X-Forwarded-For: 203.0.113.195, 10.0.0.1`:
  - **Observed `req.ip`**: `127.0.0.1`
  - **Verdict**: The true client IP is discarded, completely breaking IP-based rate limiting, audit logs, and fraud detection behind reverse proxies (**VERIFIED-FAIL**, F-102).

---

## 6. Observability, Logging & Error Tracking

Empirical scanning across client and server packages (`audit/evidence/observability-inventory.json`):

| Concern | Expected Capability | Current Implementation | Verdict |
|---|---|---|---|
| **Structured Logging** | Pino / Winston JSON logs with request correlation IDs | 34 raw `console.log` / `console.error` statements; no request IDs | **VERIFIED-FAIL** (F-103) |
| **Error Tracking** | Sentry / Datadog APM with source map resolution | Zero APM agents installed; zero Error Boundaries in React | **VERIFIED-FAIL** (F-103) |
| **Client Source Maps** | `build.sourcemap: true` or `"hidden"` | `vite.config.ts` omits sourcemaps; **0** `.map` files in `client/dist/` | **VERIFIED-FAIL** (F-103) |
| **Server Source Maps** | `tsconfig.json` has `"sourceMap": true` | `server/tsconfig.json` omits sourceMap; **0** `.map` files in `server/dist/` | **VERIFIED-FAIL** (F-103) |
| **Metrics** | Prometheus `/metrics` (latency, error rate, DB pool) | Zero metrics scrapers; no `prom-client` installed | **VERIFIED-FAIL** (F-103) |
| **Alert Definitions** | Prometheus rules / Datadog alerts / CloudWatch | Zero alert definitions or rules in repository | **VERIFIED-FAIL** (F-103) |

---

## 7. CI/CD Pipeline & Merge Integrity

### 7.1 Pipeline Specification Audit (`.github/workflows/ci.yml`)
Inspecting workflow execution on GitHub Actions (Run ID `44502984180`, commit `ci: generate PR summary`):

| CI Step / Verification Gate | Required in Master Rulebook | Present in `ci.yml` | Real Run Observed | Status |
|---|---|---|---|---|
| **TypeScript Typecheck** | Yes | Yes (`pnpm typecheck`) | Passed (5.5s) | **VERIFIED-PASS** |
| **Linter** | Yes | Yes (`pnpm lint`) | Passed (0.037s) | **VERIFIED-PASS** |
| **Unit & Integration Tests** | Yes | Yes (`pnpm test`) | Passed (17.75s, 95 tests) | **VERIFIED-PASS** |
| **Real Postgres Service** | Yes | Yes (`postgres:16-alpine`) | Passed | **VERIFIED-PASS** |
| **Benchmark Oracle** | Yes | Yes (`pnpm benchmark`) | Passed (18/18 checks) | **VERIFIED-PASS** |
| **Client Bundle Build** | Yes | Yes (`pnpm --filter client build`) | Passed | **VERIFIED-PASS** |
| **E2E Browser Tests** | Yes | **NO** (`pnpm test:e2e` absent) | Not run in CI | **VERIFIED-FAIL** (F-104) |
| **Bundle-Size Gate** | Yes | **NO** | Not run in CI | **VERIFIED-FAIL** (F-104) |
| **Lighthouse CI** | Yes | **NO** | Not run in CI | **VERIFIED-FAIL** (F-104) |
| **Dependency Audit** | Yes | **NO** (`pnpm audit` absent) | Not run in CI | **VERIFIED-FAIL** (F-104) |
| **Secret Scanning** | Yes | **NO** (Gitleaks absent) | Not run in CI | **VERIFIED-FAIL** (F-104) |
| **Server Package Build** | Yes | **NO** (Client only) | Not run in CI | **VERIFIED-FAIL** (F-104) |
| **Container Build Test** | Yes | **NO** (`docker build` absent) | Not run in CI | **VERIFIED-FAIL** (F-104) |

### 7.2 Branch Protection & Merge Enforcement
Querying GitHub repository settings via GitHub REST API:
```bash
gh api repos/snehanofficial/mill-ledger/branches/main/protection
```
- **API Response**: `HTTP 404: Branch not protected`.
- **Verdict**: The `main` branch is completely unprotected. Anyone can push directly to `main` without pull request reviews, and passing CI status checks are not required for code integration (**VERIFIED-FAIL**, F-104).

---

## 8. Documentation Hygiene & Technical References

### 8.1 Re-run of README Instructions
We executed the exact commands documented in [`README.md:24-38`](file:///home/snehan/projects/web/mill-ledger/README.md#L24-L38):

1. `pnpm install` -> **PASS**
2. `cp server/.env.example server/.env` -> **FAIL**:
   ```text
   cp: cannot stat 'server/.env.example': No such file or directory
   ```
   *(File is located at root `./.env.example`, not `server/.env.example`)*
3. `pnpm --filter @mill-ledger/server prisma migrate deploy` -> **PASS**
4. `pnpm --filter @mill-ledger/server prisma db seed` -> **FAIL**:
   ```text
   ⚠️ No seed command configured
   To seed your database, add a seed property to the migrations section in your Prisma config file.
   ```
   *(The working package script is `pnpm --filter @mill-ledger/server db:seed`)*
5. Port documentation (`README.md:40`): Claims backend runs on `http://localhost:3000`. Actual is `http://localhost:4000` (**FAIL**).

### 8.2 Inventory of Technical References
- **Environment Variable Reference**: Missing from `docs/` (**VERIFIED-FAIL**).
- **Architecture Note**: Present in [`docs/architecture.md`](file:///home/snehan/projects/web/mill-ledger/docs/architecture.md), but falsely claims "Structured Pino-style logging".
- **Role and Permission Reference**: Present in [`docs/authorization-matrix.md`](file:///home/snehan/projects/web/mill-ledger/docs/authorization-matrix.md), but lacks granular route-level scope mappings.
- **Runbooks (Deploy, Rollback, Restore, Rotate Secrets, Create Super Admin)**: **Zero runbooks exist** in the repository (**VERIFIED-FAIL**, F-105).
- **Data Dictionary**: [`docs/data-model.md`](file:///home/snehan/projects/web/mill-ledger/docs/data-model.md) provides high-level prose entity groups; field-by-field, column-by-column specifications (types, nullability, constraints) do not exist (**VERIFIED-FAIL**, F-105).

---

## 9. Statutory Data Protection & Privacy (DPDP Act 2023)

### 9.1 Data Subject Rights Audit
Under the Digital Personal Data Protection Act, 2023 (DPDP Act 2023, India):
- **Right to Access / Portability (Section 11)**: Neither the UI nor Express API provides an endpoint to export personal data associated with a customer or salesman.
- **Right to Correction and Erasure (Section 12)**: Foreign key constraints on `Customer` (`salesOrders`, `invoices`, `payments`) use default `Restrict` behaviors. Attempting to delete a customer who has transactable history causes a `P2003` crash. No data anonymization or identifier redaction routines exist.
- **Retention vs CGST Act Reconciliation**:
  - Section 36 of CGST Act 2017 requires taxable persons to retain books of accounts and invoices for **72 months (6 years)** from the due date of filing the annual return.
  - Personal data minimization requires purging inactive user sessions and former staff contact details.
  - Currently, session tokens, audit trail IPs, and customer phone numbers are retained indefinitely with zero purge mechanisms (**VERIFIED-FAIL**, F-106).

---

## 10. Phase 14 Readiness Checklist & Status Ledger

| Checklist Item | Scope / Specification | Status | Evidence / Finding Ref |
|---|---|---|---|
| **1. Container Image Build** | `docker build` succeeds with minimal alpine image | **VERIFIED-FAIL** | [`F-099`](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-099.md) (Missing `tsconfig.json`) |
| **2. Container Privilege** | Runs as unprivileged non-root user | **VERIFIED-PASS** | `Dockerfile:57` (`USER millapp`, UID 1001) |
| **3. Container Cleanliness** | No devDependencies or secrets in production image | **VERIFIED-FAIL** | [`F-099`](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-099.md) (Full `node_modules` copied) |
| **4. SPA Static Serving** | Port 4000 serves UI SPA bundle and API | **VERIFIED-FAIL** | [`F-099`](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-099.md) (No `express.static` in app.ts) |
| **5. Boot Env Validation** | Fail fast if secret or CORS is invalid | **VERIFIED-PASS** | `audit/evidence/config-boot-results.json` |
| **6. Database URL Fail-Fast** | Fail loudly if `DATABASE_URL` is omitted in prod | **VERIFIED-FAIL** | [`F-100`](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-100.md) (Quiet default to localhost) |
| **7. Environment Configs** | Distinct configs for dev, staging, prod | **VERIFIED-FAIL** | [`F-100`](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-100.md) (No staging configs exist) |
| **8. Seed Script Protection** | Refuses to execute under `NODE_ENV=production` | **VERIFIED-FAIL** | [`F-101`](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-101.md) (Executes with exit code 0) |
| **9. Migration Forward-Only** | Migrations are forward-only and safe on data | **VERIFIED-PASS** | 2 migrations; 0 pending on populated DB |
| **10. CI Migration Check** | Migrations tested on copy of realistic data | **VERIFIED-FAIL** | [`F-104`](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-104.md) (Fresh blank DB only in CI) |
| **11. Live Backup Execution** | `pg_dump` executed and timed live | **VERIFIED-PASS** | 196 ms (28.38 MB SQL dump) |
| **12. Live Restore Execution** | `psql` restore executed and timed live | **VERIFIED-PASS** | 907 ms (100% row fidelity across 39 tables) |
| **13. Backup Automation** | Automated backup scripts / cloud PITR | **VERIFIED-FAIL** | [`F-105`](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-105.md) (Zero backup automation) |
| **14. DB Pool Sizing** | Explicit connection pool bounds | **VERIFIED-FAIL** | [`F-102`](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-102.md) (No `max` in `client.ts`) |
| **15. DB Statement Timeout** | Explicit statement timeout configured | **VERIFIED-FAIL** | [`F-102`](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-102.md) (No `statement_timeout`) |
| **16. Readiness Endpoint** | `/ready` probe actively verifies DB connection | **VERIFIED-FAIL** | [`F-102`](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-102.md) (Returns 404; `/health` ignores DB) |
| **17. Graceful Shutdown** | In-flight HTTP requests complete under SIGTERM | **VERIFIED-PASS** | Verified via harness (200 OK received) |
| **18. Shutdown Cleanliness** | Disconnects Prisma and enforces hard timeout | **VERIFIED-FAIL** | [`F-102`](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-102.md) (No disconnect, no timeout) |
| **19. Request Timeouts** | Express middleware enforces request timeout | **VERIFIED-FAIL** | [`F-102`](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-102.md) (No timeout middleware) |
| **20. Trust Proxy Settings** | Configured for reverse proxy / container IP tracking | **VERIFIED-FAIL** | [`F-102`](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-102.md) (Trust proxy false) |
| **21. Error Tracking (APM)** | Sentry / Datadog error tracking on client & server | **VERIFIED-FAIL** | [`F-103`](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-103.md) (Zero error trackers) |
| **22. Source Maps** | Emitted for production builds | **VERIFIED-FAIL** | [`F-103`](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-103.md) (0 `.map` files in client & server dist) |
| **23. Structured Logging** | JSON logs with correlation IDs (Pino/Winston) | **VERIFIED-FAIL** | [`F-103`](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-103.md) (34 raw console calls) |
| **24. Metrics & Alerts** | Prometheus `/metrics` and threshold alerts | **VERIFIED-FAIL** | [`F-103`](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-103.md) (Zero metrics, zero alerts) |
| **25. CI E2E Gate** | Playwright E2E browser tests enforced in CI | **VERIFIED-FAIL** | [`F-104`](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-104.md) (`pnpm test:e2e` missing in CI) |
| **26. CI Quality Gates** | Lighthouse, Audit, Bundle gate, Secret scan | **VERIFIED-FAIL** | [`F-104`](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-104.md) (All 4 omitted from `ci.yml`) |
| **27. Branch Protection** | Merge protection rules required on `main` | **VERIFIED-FAIL** | [`F-104`](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-104.md) (Branch unprotected, HTTP 404) |
| **28. README Accuracy** | Documented setup commands execute cleanly | **VERIFIED-FAIL** | [`F-098`](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-098.md) (Missing env file, wrong seed cmd) |
| **29. Operational Runbooks** | Deploy, rollback, restore, secret rotation, admin | **VERIFIED-FAIL** | [`F-105`](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-105.md) (Zero runbooks exist) |
| **30. Data Dictionary** | Comprehensive table/column dictionary | **VERIFIED-FAIL** | [`F-105`](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-105.md) (Only high-level prose exists) |
| **31. Personal Data Erasure** | Anonymization / erasure under DPDP Act 2023 | **VERIFIED-FAIL** | [`F-106`](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-106.md) (Zero erasure capabilities) |
| **32. Personal Data Export** | Subject access data export under DPDP Act 2023 | **VERIFIED-FAIL** | [`F-106`](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-106.md) (Zero export endpoints) |

---

## 11. UNVERIFIED Items Flagged for Human Review

Per GEMINI.md Rule E3, items that cannot be completely automated in this local sandboxed audit session are explicitly flagged with required human verification procedures:

| Item ID | Subsystem / Concern | Why Unverified in Automated Agent Session | Exact Human Verification Steps |
|---|---|---|---|
| **UNV-OPS-01** | **Cloud PITR (Point-in-Time Recovery)** | Local workstation lacks an active cloud provider (AWS RDS / Azure Database for PostgreSQL / GCP Cloud SQL) backup vault. While local `pg_dump` and `pg_restore` were verified and timed (196ms backup, 907ms restore), cloud automated point-in-time recovery cannot be initiated from this container. | 1. In Azure Portal or AWS RDS Console, navigate to the production database instance.<br/>2. Initiate a Point-in-Time Restore to a new instance for a timestamp 30 minutes prior.<br/>3. Verify restoration finishes within the RTO budget (< 30 minutes).<br/>4. Connect to restored instance and execute `SELECT COUNT(*) FROM "sales_order";`. |
| **UNV-OPS-02** | **Production Secret Rotation Invalidation** | Rotating `BETTER_AUTH_SECRET` in a live environment requires testing active session cookie revocation vs renewal. Better Auth multi-key rotation plugin behavior cannot be proven without deployed multi-instance staging infrastructure. | 1. Log in on client to obtain an active session cookie.<br/>2. Update `BETTER_AUTH_SECRET` in `.env` and restart server.<br/>3. Send an authenticated request with the existing cookie.<br/>4. Verify whether Better Auth returns HTTP 401 Unauthorized or throws an unhandled HMAC decoding exception. |
| **UNV-OPS-03** | **Production Reverse Proxy TLS Termination & CSP Nonces** | The local development server runs plain HTTP. Strict-Transport-Security (HSTS) headers and dynamic per-request CSP nonces with upstream CDN proxy caches (e.g. Cloudflare / CloudFront) require a live domain with SSL certificates. | 1. Deploy container behind Cloudflare / Nginx reverse proxy with valid TLS certificate.<br/>2. Execute `curl -sIv https://mill.example.com | grep -iE "(strict-transport-security|content-security-policy)"`.<br/>3. Confirm `max-age=63072000; includeSubDomains; preload` is present. |
