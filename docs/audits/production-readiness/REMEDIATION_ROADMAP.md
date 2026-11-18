# MillLedger — Prioritized Remediation Roadmap

**Document Reference:** `MLA-RDM-2026-M11`  
**Authority:** [PRODUCTION_READINESS_AUDIT.md](/docs/audits/production-readiness/PRODUCTION_READINESS_AUDIT.md)  
**Last Updated:** November 18, 2026  
**Status:** **100% Complete (All 22 Tasks Resolved & Verified)**

---

## 1. Wave Overview and Sequencing Strategy

The remediation of MillLedger's 22 audit findings was structured into five sequential waves. All 22 tasks across all waves have been implemented, tested, and verified with reproducible command evidence.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   WAVE 1: P0 CRITICAL BLOCKERS (100% DONE)             │
│  MLD-001 (Auth CORS & Login UI)    │  MLD-003 (Dashboard 404 Route)    │
│  MLD-004 (Prisma Migration Ledger) │  MLD-002 (Multi-Tenant Scoping)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│              WAVE 2: P1 SECURITY & DATA INTEGRITY (100% DONE)          │
│  MLD-005 (Secret Fail-Loud)        │  MLD-006 (ABAC Entity Scoping)    │
│  MLD-007 (Salesman Privacy Leak)   │  MLD-011 (Stock Atomic Locks)     │
│  MLD-012 (Document Sequence Table) │  MLD-013 (Balance Query Bulk)     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             WAVE 3: P1 FRONTEND & OFFLINE RESILIENCY (100% DONE)       │
│  MLD-008 (Shell Sign-Out)          │  MLD-009 (Procurement & Masters)  │
│  MLD-010 (General Dynamic Modals)  │  MLD-014 (Route-Level Code Split) │
│  MLD-015 (Web Locks PWA Sync)      │                                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                WAVE 4: P2 QUALITY, ACCESSIBILITY & E2E (100% DONE)     │
│  MLD-016 (Static PWA Icons Asset)  │  MLD-017 (WCAG Contrast & Labels) │
│  MLD-018 (Playwright Backend E2E)  │  MLD-021 (AI Slop Removal)        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│           WAVE 5: P2/P3 HARDENING, CI/CD & GA GATES (100% DONE)        │
│  MLD-019 (Dependency CVE Patches)  │  MLD-020 (GitHub Actions CI/Docker│
│  MLD-022 (Oxlint & Decimal Math)   │  All Release Gates Passing (100%) │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Wave Breakdown & Completion Status

### Wave 1 — P0 Critical Release Blockers (`DONE`)
*Objective: Unblock frontend login, establish deterministic database migrations, eliminate cross-organization data leakage, and restore the operational dashboard.*

| Task ID | Task Title | Status | Verification Evidence |
|---|---|---|---|
| `MLD-001` | Fix Better Auth Trusted Origins & Build Login View | `DONE` | `auth.integration.test.ts` & login screen |
| `MLD-002` | Multi-Tenant Organization Membership & BOLA Elimination | `DONE` | `auth.middleware.ts` & tenant isolation tests |
| `MLD-003` | Resolve `/api/v1/dashboard` Route Conflict | `DONE` | `reporting.routes.ts` HTTP 200 verification |
| `MLD-004` | Establish Prisma Migration Ledger & Schema Constraints | `DONE` | `20261118000000_init_baseline` & DB checks |

### Wave 2 — P1 Security & Data Integrity (`DONE`)
*Objective: Secure server secrets, eliminate inventory balance race conditions, ensure gapless GST invoice numbering, and enforce salesman data isolation.*

| Task ID | Task Title | Status | Verification Evidence |
|---|---|---|---|
| `MLD-005` | Enforce Fail-Loud Production Secret Validation | `DONE` | `env.test.ts` unit tests |
| `MLD-006` | Server-Side ABAC Entity Retrieval & Inactive User Check | `DONE` | `sales.routes.ts` & ABAC policy tests |
| `MLD-007` | Restrict Salesman Scope in Receivables Reports | `DONE` | `reports.test.ts` scope assertions |
| `MLD-011` | Eliminate Stock Overwrites & Enforce Non-Negative Balances | `DONE` | `inventory-concurrency.test.ts` (10 concurrent requests) |
| `MLD-012` | Implement Atomic Document Sequence Counter | `DONE` | `sequence-concurrency.test.ts` (20 parallel requests, 0 collisions) |
| `MLD-013` | Optimize Balance Aggregation & Eliminate In-Memory Streams | `DONE` | 3 bulk DB queries replacing $2N$ sequential loops |

### Wave 3 — P1 Frontend Real-Time & Offline Resiliency (`DONE`)
*Objective: Implement sign-out, replace placeholder views with live procurement, eliminate hardcoded master data, split frontend bundle, and serialize multi-tab offline sync.*

| Task ID | Task Title | Status | Verification Evidence |
|---|---|---|---|
| `MLD-008` | Implement Shell Sign-Out & Session Revocation | `DONE` | `authenticated-layout.tsx` sign-out & outbox dialog |
| `MLD-009` | Replace Placeholder Views with Live Procurement & Masters | `DONE` | `purchases-page.tsx`, `customers-page.tsx` |
| `MLD-010` | Generalize Order & Production Modals to Dynamic Master Data | `DONE` | Dynamic `/sales/customers`, `/products`, `/recipes` |
| `MLD-014` | Implement Route-Level Lazy Loading & Code Splitting | `DONE` | Bundle dropped from 991 kB to 267 kB (73% reduction) |
| `MLD-015` | Enforce Web Locks Mutex for Multi-Tab Outbox Sync | `DONE` | `navigator.locks.request` mutex in `sync-engine.ts` |

### Wave 4 — P2 Engineering Quality, Accessibility & E2E (`DONE`)
*Objective: Generate static PWA icons, remediate WCAG accessibility violations, eliminate AI slop, and establish fullstack Playwright test orchestration.*

| Task ID | Task Title | Status | Verification Evidence |
|---|---|---|---|
| `MLD-016` | Generate Static PWA Manifest Icons and Favicon Asset | `DONE` | PNG/SVG/ICO in `client/public/`; 38 precache items |
| `MLD-017` | Remediate WCAG 2.2 AA Contrast & Label-in-Name Violations | `DONE` | Muted text 7.58:1, input borders 3.75:1, button 6.20:1 |
| `MLD-018` | Integrate Full-Stack Playwright Orchestration & Frontend Tests | `DONE` | 20/20 Playwright E2E tests pass without connection errors |
| `MLD-021` | Eliminate AI Slop Wireframe Statistics and Hardcoded Charts | `DONE` | Removed fake 1,429 orders & CSS pseudo bars from all views |

### Wave 5 — P2/P3 Hardening, CI/CD & Final Verification (`DONE`)
*Objective: Patch dependency CVEs, configure GitHub Actions CI & Docker manifests, eliminate linter warnings, and verify exact decimal arithmetic.*

| Task ID | Task Title | Status | Verification Evidence |
|---|---|---|---|
| `MLD-019` | Upgrade Vulnerable Dependencies (Tinypool & Glob CVEs) | `DONE` | `pnpm audit --audit-level=critical` exits 0 (0 critical CVEs) |
| `MLD-020` | Add GitHub Actions CI/CD Pipeline & Docker Configurations | `DONE` | `.github/workflows/ci.yml`, `Dockerfile`, `docker compose config` |
| `MLD-022` | Resolve React Fast Refresh Warnings & Decimal Hardening | `DONE` | `pnpm lint` 0 warnings; exact Decimal WAC math; 18/18 benchmark pass |
