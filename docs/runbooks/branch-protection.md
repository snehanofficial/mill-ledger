# Branch Protection & CI Quality Gates Runbook

## 1. Overview
The `main` branch of `mill-ledger` is protected by automated branch protection rules and GitHub Actions continuous integration quality gates in accordance with NIST SP 800-218 and CIS Software Supply Chain Security guidelines.

## 2. Active Branch Protection Policy (on `main`)
- **Required Status Checks**:
  - `Lint, Typecheck, Test & Benchmark` must pass before any commit can merge into `main`.
  - `strict: true` (branch must be up-to-date with `main` before merging).
- **Prohibited Operations**:
  - `allow_force_pushes: false` (Force pushes are strictly disabled to prevent commit history erasure).
  - `allow_deletions: false` (Branch deletion is prohibited).
- **Administration & Emergency Override**:
  - `enforce_admins: false` (Sole administrator maintains emergency hotfix capabilities if automated runner infrastructure fails).

## 3. GitHub Actions Continuous Integration Gates
Every push and pull request against `main` and `remediation/**` triggers `.github/workflows/ci.yml`:
1. **Linter**: `pnpm lint` (0 errors on oxlint across all workspaces).
2. **Type Safety**: `pnpm typecheck` (strict TypeScript compilation with 0 errors).
3. **Database Migrations**: `prisma migrate deploy` against live PostgreSQL service.
4. **Master Seeding**: `db:seed` verifying deterministic benchmark master fixtures.
5. **Domain Test Suites**: `pnpm test` (39 test suites, >250 tests).
6. **CDI Acceptance Benchmark**: `pnpm benchmark` (18/18 exact numerical assertions matched 100%).
7. **Dependency Security Audit**: `pnpm audit --audit-level=critical`.
8. **Production Builds**: `pnpm build` (compiles both server TypeScript and Vite PWA client).
9. **End-to-End Browser Testing**: `pnpm test:e2e` (Playwright headless Chromium testing 26 workflows).
10. **Tracker Integrity**: `node audit/tracker/check-tracker.mjs`.

## 4. Operational API Commands

### Verify Current Protection
```bash
gh api repos/snehanofficial/mill-ledger/branches/main/protection
```

### Re-apply Branch Protection Policy
```bash
gh api -X PUT repos/snehanofficial/mill-ledger/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  --input - << 'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Lint, Typecheck, Test & Benchmark"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null
}
EOF
```
