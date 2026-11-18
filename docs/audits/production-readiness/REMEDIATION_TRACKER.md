# MillLedger — Remediation Master Tracker

**Document Reference:** `MLA-TRK-2026-M11`  
**Authority:** [PRODUCTION_READINESS_AUDIT.md](/docs/audits/production-readiness/PRODUCTION_READINESS_AUDIT.md)  
**Last Synchronized:** November 18, 2026  

---

## 1. Executive Remediation Summary

| Metric | Current Value | Target for GA |
|---|---|---|
| **Total Backlog Tasks** | 22 | 22 |
| **BACKLOG** | 0 | 0 |
| **READY** | 0 | 0 |
| **IN_PROGRESS** | 0 | 0 |
| **BLOCKED** | 0 | 0 |
| **IN_REVIEW** | 0 | 0 |
| **DONE (Verified)** | **22** | 22 |
| **DEFERRED / WONT_FIX** | 0 | 0 |
| **Remaining P0 Findings** | **0** | 0 |
| **Remaining P1 Findings** | **0** | 0 |
| **Verified Completion Percentage** | **100.0%** (22 / 22) | **100.0%** |

*Note: Verified completion percentage counts ONLY tasks in `DONE` status where all task-specific DoD criteria and test evidence have been satisfied.*

---

## 2. Master Task Register

| Task ID | Task Title | Related Findings | Priority | Category | Status | Dependencies | Owner | DoD | Verification Reference |
|---|---|---|---|---|---|---|---|---|---|
| [MLD-001](/docs/audits/production-readiness/tasks/MLD-001-auth-trusted-origins-login-ui.md) | Fix Auth Trusted Origins & Build Functional Login View | `P0-SEC-01` | P0 | Security / Auth | `DONE` | None | AI Agent | [DoD](/docs/audits/production-readiness/tasks/MLD-001-auth-trusted-origins-login-ui.md#7-definition-of-done) | CORS sign-in test & client build verification |
| [MLD-002](/docs/audits/production-readiness/tasks/MLD-002-multi-tenant-isolation-scoping.md) | Multi-Tenant Organization Membership & BOLA Elimination | `P0-SEC-02` | P0 | Security / Auth | `DONE` | `DEC-001`, `MLD-004` | AI Agent | [DoD](/docs/audits/production-readiness/tasks/MLD-002-multi-tenant-isolation-scoping.md#7-definition-of-done) | Cross-tenant rejection integration tests |
| [MLD-003](/docs/audits/production-readiness/tasks/MLD-003-dashboard-404-routing-conflict.md) | Resolve `/api/v1/dashboard` Route Conflict and 404 Error | `P0-FUNC-01` | P0 | Functional / Routing | `DONE` | None | AI Agent | [DoD](/docs/audits/production-readiness/tasks/MLD-003-dashboard-404-routing-conflict.md#7-definition-of-done) | Vitest `reports.test.ts` HTTP 200 verification |
| [MLD-004](/docs/audits/production-readiness/tasks/MLD-004-prisma-migration-ledger-constraints.md) | Establish Prisma Migration Ledger & Schema Constraints | `P0-DATA-01` | P0 | Database / Integrity | `DONE` | None | AI Agent | [DoD](/docs/audits/production-readiness/tasks/MLD-004-prisma-migration-ledger-constraints.md#7-definition-of-done) | `prisma migrate deploy` & negative stock rejection |
| [MLD-005](/docs/audits/production-readiness/tasks/MLD-005-fail-loud-production-secret-validation.md) | Enforce Fail-Loud Production Secret Validation | `P1-SEC-01` | P1 | Security / Config | `DONE` | None | AI Agent | [DoD](/docs/audits/production-readiness/tasks/MLD-005-fail-loud-production-secret-validation.md#7-definition-of-done) | Env parser unit tests in `env.test.ts` |
| [MLD-006](/docs/audits/production-readiness/tasks/MLD-006-server-abac-entity-retrieval.md) | Server-Side ABAC Entity Retrieval & Inactive User Check | `P1-SEC-02` | P1 | Security / Auth | `DONE` | None | AI Agent | [DoD](/docs/audits/production-readiness/tasks/MLD-006-server-abac-entity-retrieval.md#7-definition-of-done) | Inactive user 403 & spoofed order 403 tests |
| [MLD-007](/docs/audits/production-readiness/tasks/MLD-007-salesman-receivables-data-leak.md) | Restrict Salesman Scope in Receivables Reports | `P1-SEC-03` | P1 | Security / Privacy | `DONE` | `MLD-002` | AI Agent | [DoD](/docs/audits/production-readiness/tasks/MLD-007-salesman-receivables-data-leak.md#7-definition-of-done) | Scope authorization tests in `reports.test.ts` |
| [MLD-008](/docs/audits/production-readiness/tasks/MLD-008-shell-sign-out-revocation.md) | Implement Shell Sign-Out & Session Revocation | `P1-FUNC-01` | P1 | Functional / UX | `DONE` | `MLD-001` | AI Agent | [DoD](/docs/audits/production-readiness/tasks/MLD-008-shell-sign-out-revocation.md#7-definition-of-done) | Sign-out flow & TanStack Query cache reset |
| [MLD-009](/docs/audits/production-readiness/tasks/MLD-009-replace-domain-placeholder-views.md) | Replace Placeholder Views with Live Procurement & Master Data | `P1-FUNC-02` | P1 | Functional | `DONE` | `MLD-001` | AI Agent | [DoD](/docs/audits/production-readiness/tasks/MLD-009-replace-domain-placeholder-views.md#7-definition-of-done) | `PurchasesPage`, `CustomersPage`, and E2E verification |
| [MLD-010](/docs/audits/production-readiness/tasks/MLD-010-generalize-order-production-modals.md) | Generalize Order & Production Modals to Dynamic Master Data | `P1-DATA-02` | P1 | Business Logic | `DONE` | `MLD-001` | AI Agent | [DoD](/docs/audits/production-readiness/tasks/MLD-010-generalize-order-production-modals.md#7-definition-of-done) | Dynamic product, customer, and BOM recipe queries |
| [MLD-011](/docs/audits/production-readiness/tasks/MLD-011-stock-overwrite-race-conditions.md) | Eliminate Stock Overwrites & Enforce Non-Negative Balances | `P1-DATA-03` | P1 | Data Integrity | `DONE` | `DEC-003`, `MLD-004` | AI Agent | [DoD](/docs/audits/production-readiness/tasks/MLD-011-stock-overwrite-race-conditions.md#7-definition-of-done) | Concurrency increment tests in `inventory-concurrency.test.ts` |
| [MLD-012](/docs/audits/production-readiness/tasks/MLD-012-atomic-document-sequence-generation.md) | Implement Atomic Document Sequence Counter | `P1-DATA-04` | P1 | Data Integrity | `DONE` | `DEC-002`, `MLD-004` | AI Agent | [DoD](/docs/audits/production-readiness/tasks/MLD-012-atomic-document-sequence-generation.md#7-definition-of-done) | Concurrent invoice sequence test in `sequence-concurrency.test.ts` |
| [MLD-013](/docs/audits/production-readiness/tasks/MLD-013-optimize-balance-aggregation-queries.md) | Optimize Balance Aggregation & Eliminate In-Memory Streams | `P1-PERF-01` | P1 | Performance | `DONE` | `MLD-004` | AI Agent | [DoD](/docs/audits/production-readiness/tasks/MLD-013-optimize-balance-aggregation-queries.md#7-definition-of-done) | Grouped bulk query verification in `inventory-concurrency.test.ts` |
| [MLD-014](/docs/audits/production-readiness/tasks/MLD-014-route-lazy-loading-code-splitting.md) | Implement Route-Level Lazy Loading & Code Splitting | `P1-PERF-02` | P1 | Performance | `DONE` | None | AI Agent | [DoD](/docs/audits/production-readiness/tasks/MLD-014-route-lazy-loading-code-splitting.md#7-definition-of-done) | Vite bundle chunk splitting (initial JS 267 kB, 73% drop) |
| [MLD-015](/docs/audits/production-readiness/tasks/MLD-015-multi-tab-outbox-web-locks.md) | Enforce Web Locks Mutex for Multi-Tab Outbox Sync | `P1-PWA-01` | P1 | Offline / PWA | `DONE` | None | AI Agent | [DoD](/docs/audits/production-readiness/tasks/MLD-015-multi-tab-outbox-web-locks.md#7-definition-of-done) | Web Locks non-blocking concurrency mutex verification |
| [MLD-016](/docs/audits/production-readiness/tasks/MLD-016-pwa-manifest-icons-pipeline.md) | Generate Static PWA Manifest Icons and Favicon Asset | `P2-PWA-02` | P2 | PWA / Assets | `DONE` | None | AI Agent | [DoD](/docs/audits/production-readiness/tasks/MLD-016-pwa-manifest-icons-pipeline.md#7-definition-of-done) | PNG/SVG/ICO assets generated; 38 precache items |
| [MLD-017](/docs/audits/production-readiness/tasks/MLD-017-wcag-contrast-label-in-name.md) | Remediate WCAG 2.2 AA Contrast & Label-in-Name Violations | `P2-A11Y-01` | P2 | Accessibility | `DONE` | None | AI Agent | [DoD](/docs/audits/production-readiness/tasks/MLD-017-wcag-contrast-label-in-name.md#7-definition-of-done) | Contrast $\ge 4.5:1$, border $\ge 3:1$, SC 2.5.3 compliant |
| [MLD-018](/docs/audits/production-readiness/tasks/MLD-018-playwright-fullstack-frontend-tests.md) | Integrate Full-Stack Playwright Orchestration & Frontend Tests | `P2-TEST-01` | P2 | QA / Testing | `DONE` | `MLD-001`, `MLD-003` | AI Agent | [DoD](/docs/audits/production-readiness/tasks/MLD-018-playwright-fullstack-frontend-tests.md#7-definition-of-done) | Dual webServer config; 20/20 Playwright specs pass |
| [MLD-019](/docs/audits/production-readiness/tasks/MLD-019-patch-dependency-vulnerabilities.md) | Upgrade Vulnerable Dependencies (Tinypool & Glob CVEs) | `P2-SEC-04` | P2 | Security / Deps | `DONE` | None | AI Agent | [DoD](/docs/audits/production-readiness/tasks/MLD-019-patch-dependency-vulnerabilities.md#7-definition-of-done) | `pnpm audit --audit-level=critical` exits 0 (0 critical CVEs) |
| [MLD-020](/docs/audits/production-readiness/tasks/MLD-020-github-actions-ci-containerization.md) | Add GitHub Actions CI/CD Pipeline & Docker Configurations | `P2-DEVOPS-01` | P2 | DevOps | `DONE` | None | AI Agent | [DoD](/docs/audits/production-readiness/tasks/MLD-020-github-actions-ci-containerization.md#7-definition-of-done) | `.github/workflows/ci.yml`, `Dockerfile`, `docker compose config` |
| [MLD-021](/docs/audits/production-readiness/tasks/MLD-021-remove-ai-slop-wireframe-stats.md) | Eliminate AI Slop Wireframe Statistics and Pseudo Charts | `P2-UX-01` | P2 | UI / UX | `DONE` | `MLD-009` | AI Agent | [DoD](/docs/audits/production-readiness/tasks/MLD-021-remove-ai-slop-wireframe-stats.md#7-definition-of-done) | Zero fake metrics or CSS pseudo-charts in UI |
| [MLD-022](/docs/audits/production-readiness/tasks/MLD-022-oxlint-warnings-decimal-hardening.md) | Resolve React Fast Refresh Warnings & Decimal Hardening | `P3-CODE-01` | P3 | Maintainability | `DONE` | None | AI Agent | [DoD](/docs/audits/production-readiness/tasks/MLD-022-oxlint-warnings-decimal-hardening.md#7-definition-of-done) | `pnpm lint` 0 warnings; exact Decimal WAC math |

---

## 3. Audit Traceability Matrix

| Audit Finding ID | Severity | Finding Description | Mapped Task ID | Resolution Status |
|---|---|---|---|---|
| `P0-SEC-01` | P0 | Frontend Auth Rejection & Empty Login UI | `MLD-001` | Resolved (`DONE`) |
| `P0-SEC-02` | P0 | Missing Multi-Tenant Isolation & Cross-Org BOLA | `MLD-002` | Resolved (`DONE`) |
| `P0-FUNC-01` | P0 | Broken Overview Dashboard Route (404 Error) | `MLD-003` | Resolved (`DONE`) |
| `P0-DATA-01` | P0 | Absent Database Migrations & Missing DB Constraints | `MLD-004` | Resolved (`DONE`) |
| `P1-SEC-01` | P1 | Insecure Default Auth Secret in Production Config | `MLD-005` | Resolved (`DONE`) |
| `P1-SEC-02` | P1 | Client-Controlled ABAC Attributes & Inactive User Leak | `MLD-006` | Resolved (`DONE`) |
| `P1-SEC-03` | P1 | Salesman Information Disclosure in Receivables | `MLD-007` | Resolved (`DONE`) |
| `P1-FUNC-01` | P1 | Dead Sign-Out Button in Authenticated Shell | `MLD-008` | Resolved (`DONE`) |
| `P1-FUNC-02` | P1 | Extensive Placeholder Screens for Core Domains | `MLD-009` | Resolved (`DONE`) |
| `P1-DATA-02` | P1 | Bespoke Hardcoded Benchmark Logic in Frontend Forms | `MLD-010` | Resolved (`DONE`) |
| `P1-DATA-03` | P1 | Direct Stock Overwrites & Balance Race Conditions | `MLD-011` | Resolved (`DONE`) |
| `P1-DATA-04` | P1 | Fragile Invoice Sequence Generation via Table Count | `MLD-012` | Resolved (`DONE`) |
| `P1-PERF-01` | P1 | N+1 Aggregate Queries & In-Memory Movement Stream | `MLD-013` | Resolved (`DONE`) |
| `P1-PERF-02` | P1 | Monolithic Frontend Bundle & Zero Code Splitting | `MLD-014` | Resolved (`DONE`) |
| `P1-PWA-01` | P1 | Multi-Tab Race Condition in Offline Outbox Sync | `MLD-015` | Resolved (`DONE`) |
| `P2-PWA-02` | P2 | Missing Static PWA Manifest Icons & HTML Fallback | `MLD-016` | Resolved (`DONE`) |
| `P2-A11Y-01` | P2 | WCAG 2.2 AA Contrast & Label-in-Name Failures | `MLD-017` | Resolved (`DONE`) |
| `P2-TEST-01` | P2 | Disconnected Playwright E2E & 0 Client Unit Tests | `MLD-018` | Resolved (`DONE`) |
| `P2-SEC-04` | P2 | Unpatched Dependency Vulnerabilities (Tinypool / Glob) | `MLD-019` | Resolved (`DONE`) |
| `P2-DEVOPS-01`| P2 | Absence of CI/CD Workflows & Container Manifests | `MLD-020` | Resolved (`DONE`) |
| `P2-UX-01` | P2 | AI Slop Wireframe Statistics and Hardcoded Charts | `MLD-021` | Resolved (`DONE`) |
| `P3-CODE-01` | P3 | Floating-Point Financial Math & Fast Refresh Warnings | `MLD-022` | Resolved (`DONE`) |
