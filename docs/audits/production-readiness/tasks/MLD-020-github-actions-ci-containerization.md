# MLD-020 — Add GitHub Actions CI/CD Pipeline & Docker Configurations

## Metadata
- Task ID: `MLD-020`
- Related audit findings: `P2-DEVOPS-01`
- Priority: P2 (Medium)
- Category: DevOps / Production
- Status: `DONE`
- Dependencies: None
- Owner: AI Agent
- Created: November 18, 2026
- Last updated: November 18, 2026

## 1. Description
1. The repository previously lacked continuous integration and automated testing on pull requests.
2. Container configuration was absent, requiring manual host environment setup.

## 2. Evidence
- Original audit finding: `P2-DEVOPS-01`.
- Files:
  - [.github/workflows/ci.yml](/.github/workflows/ci.yml)
  - [Dockerfile](/Dockerfile)
  - [docker-compose.yml](/docker-compose.yml)
  - [.dockerignore](/.dockerignore)

## 3. Expected Outcome
1. A GitHub Actions workflow `.github/workflows/ci.yml` is added that triggers on push and pull requests, running:
   - Dependency installation (`pnpm install --frozen-lockfile`)
   - Typechecking (`pnpm typecheck`)
   - Linting (`pnpm lint`)
   - Database migrations (`prisma migrate deploy`)
   - Benchmark fixture seeding (`db:seed`)
   - Test suites (`pnpm test`)
   - Benchmark validation (`pnpm benchmark`)
   - Client bundle build (`pnpm --filter client build`)
2. A multi-stage production `Dockerfile` builds both client static assets and server TypeScript application, using a non-root unprivileged user (`millapp`, UID 1001) and healthchecks.
3. A `docker-compose.yml` orchestrates PostgreSQL 16 and the MillLedger application container with persistent volumes.

## 4. Scope
- **Included changes:**
  - Created `.github/workflows/ci.yml`.
  - Created `Dockerfile` (optimized multi-stage build with Node 22 alpine).
  - Created `docker-compose.yml` with health checks.
  - Created `.dockerignore`.
- **Excluded changes:**
  - Cloud-provider specific infrastructure-as-code (Terraform/Pulumi).
- **Affected modules:** `.github/workflows/`, `Dockerfile`, `docker-compose.yml`, `.dockerignore`.

## 5. Dependencies
- None.

## 6. Implementation Plan
1. Created `.github/workflows/ci.yml` with PostgreSQL 16 service container and full validation pipeline.
2. Created multi-stage `Dockerfile` with build stage and non-root runner stage with healthchecks.
3. Created `docker-compose.yml` linking app to healthy postgres container.
4. Validated syntax with `docker compose config`.

## 7. Definition of Done
- [x] `.github/workflows/ci.yml` is syntactically valid and covers all build and test steps.
- [x] `docker compose config` validates with 0 errors or warnings.
- [x] Multi-stage `Dockerfile` uses non-root user and healthchecks.

## 8. Verification Evidence
- `docker compose config` validated successfully with exit code 0.
- `.github/workflows/ci.yml` verified with all 9 validation steps.
