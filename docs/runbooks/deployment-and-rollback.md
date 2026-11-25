# Production Deployment & Rollback Runbook

This runbook establishes standard operating procedures for deploying and rolling back MillLedger ERP services in production environments in compliance with ISO/IEC 27001 Control 8.1 and ITIL 4 Service Management.

---

## 1. Pre-Deployment Verification Checklist

Before initiating any production release:

1. **Continuous Integration Verification**:
   - Ensure the target commit has passed all CI checks on `main`:
     - Workspace build (`pnpm build`)
     - Unit, integration & domain test suite (`pnpm test`)
     - Playwright end-to-end tests (`pnpm test:e2e`)
     - CDI Benchmark numerical assertions (`pnpm benchmark`)
     - Linting and strict typechecking (`pnpm lint`, `pnpm typecheck`)
     - Security audit (`pnpm audit --audit-level=critical`)
2. **Database Backup**:
   - Execute a pre-migration database snapshot before running schema changes:
     ```bash
     pg_dump -Fc -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f "/var/backups/mill_ledger_predeploy_$(date +%Y%m%d_%H%M%S).dump"
     ```
3. **Maintenance Notification**:
   - Notify manufacturing floor operators and sales team if deployment involves schema migrations.

---

## 2. Production Deployment Procedure

### Step 2.1: Pull and Build Production Image
```bash
# Pull latest code or fetch release tag
git fetch --tags origin
git checkout tags/v1.0.0

# Build production multi-stage container
docker build -t mill-ledger:latest -t mill-ledger:v1.0.0 .
```

### Step 2.2: Apply Database Migrations
Migrations must be executed prior to switching traffic to new container instances:
```bash
docker run --rm \
  --env-file /etc/mill-ledger/.env.production \
  --network mill-ledger-net \
  mill-ledger:v1.0.0 \
  pnpm --filter @mill-ledger/server prisma migrate deploy
```

### Step 2.3: Zero-Downtime Rolling Container Update
For Docker Compose deployments:
```bash
# Start new container alongside existing
docker compose up -d --no-deps --build api
```
For Kubernetes deployments:
```bash
kubectl set image deployment/mill-ledger-api mill-ledger=mill-ledger:v1.0.0
kubectl rollout status deployment/mill-ledger-api --timeout=120s
```

### Step 2.4: Post-Deployment Health Verification
Run health and readiness probes:
```bash
# 1. Basic liveness probe
curl -f -i http://localhost:4000/api/v1/health

# 2. Database readiness probe
curl -f -i http://localhost:4000/ready

# 3. Prometheus metrics endpoint
curl -f -i http://localhost:4000/metrics

# 4. Verify database financial and stock invariants
PGPASSWORD="$DB_PASSWORD" psql -U "$DB_USER" -h "$DB_HOST" -d "$DB_NAME" -f audit/scripts/invariants.sql
```

---

## 3. Rollback Procedure

### Triggers for Immediate Rollback:
- `/ready` endpoint returns HTTP 503 or fails database ping.
- High error rate alert `HighHttp5xxRate` triggers (> 5% errors).
- Benchmark assertions or database invariants fail with discrepancy rows.
- Critical workflow breakage reported by floor managers or salesmen.

### Step 3.1: Container Image Rollback
Immediately revert traffic to the previous known good image:
```bash
# Docker Compose
export PREVIOUS_TAG="v0.9.9"
docker compose up -d --no-deps api

# Kubernetes
kubectl rollout undo deployment/mill-ledger-api
kubectl rollout status deployment/mill-ledger-api
```

### Step 3.2: Database Schema Rollback
1. **Backward-Compatible Migrations (Expand/Contract pattern)**:
   - If the new migration only added nullable columns or new tables, no immediate schema rollback is needed. The old application code will ignore new columns.
2. **Destructive or Incompatible Schema Changes**:
   - If data corruption or breaking schema drift occurred, restore from the pre-deployment snapshot:
     ```bash
     # Refer to docs/runbooks/disaster-recovery-restore.md
     pg_restore --clean --if-exists -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" /var/backups/mill_ledger_predeploy_<timestamp>.dump
     ```

### Step 3.3: Post-Rollback Invariant Check
```bash
PGPASSWORD="$DB_PASSWORD" psql -U "$DB_USER" -h "$DB_HOST" -d "$DB_NAME" -f audit/scripts/invariants.sql
```

### Step 3.4: Post-Mortem Incident Documentation
Within 24 hours of an incident, file a post-mortem documenting root cause, detection time, time-to-mitigate (MTTR), and corrective engineering tasks.
