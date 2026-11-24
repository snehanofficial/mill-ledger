# Disaster Recovery & Database Restoration Runbook

This runbook establishes standard operating procedures for backup creation, disaster recovery, and point-in-time database restoration for MillLedger ERP in accordance with ISO/IEC 27001 Control 8.13 and business continuity requirements.

---

## 1. Objectives & Targets

- **Recovery Time Objective (RTO)**: < 1 hour (Time required to restore database, verify invariants, and resume production traffic).
- **Recovery Point Objective (RPO)**: < 15 minutes (Maximum acceptable data loss window via continuous WAL archiving).

---

## 2. Backup Architecture & Cadence

1. **Daily Full Backup**:
   - Automated `pg_dump -Fc` custom format snapshot generated daily at 02:00 IST.
   - Retained for 30 days locally and replicated to encrypted off-site cloud object storage (S3/GCS) with lifecycle retention policies.
2. **Pre-Migration Snapshot**:
   - Manual snapshot triggered prior to every deployment applying Prisma migrations.
3. **Continuous WAL Archiving**:
   - PostgreSQL Write-Ahead Logs streamed continuously for point-in-time recovery (PITR).

---

## 3. Database Restoration Procedure

### Step 3.1: Identify and Verify the Target Backup File
Inspect available backup archives and verify checksums:
```bash
ls -la /var/backups/mill_ledger_*.dump
sha256sum -c /var/backups/mill_ledger_20261124_020000.dump.sha256
```

### Step 3.2: Isolate Application Traffic
Stop API instances to prevent writes during restoration:
```bash
# Docker Compose
docker compose stop api

# Kubernetes
kubectl scale deployment/mill-ledger-api --replicas=0
```

### Step 3.3: Execute Full Restoration (`pg_restore`)
Restore database using custom-format flags:
```bash
export PGPASSWORD="$DB_PASSWORD"
export DB_HOST="localhost"
export DB_USER="postgres"
export DB_NAME="mill_ledger"
export BACKUP_FILE="/var/backups/mill_ledger_20261124_020000.dump"

# Restore with clean, if-exists, and parallel jobs
pg_restore \
  -h "$DB_HOST" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  -j 4 \
  "$BACKUP_FILE"
```

### Step 3.4: Verify Schema and Sequence Integrity
Verify that sequences match maximum table values:
```bash
pnpm --filter @mill-ledger/server prisma migrate status
```

### Step 3.5: Run 10-Point Database Invariant Audit
Run the database invariant suite to ensure exact financial and inventory reconciliation:
```bash
PGPASSWORD="$DB_PASSWORD" psql -U "$DB_USER" -h "$DB_HOST" -d "$DB_NAME" -f audit/scripts/invariants.sql
```
*Acceptance Criteria*: All 10 invariant checks must return 0 discrepancy rows.

### Step 3.6: Execute CDI Benchmark Smoke Test
Verify calculation engine on staging/recovery database:
```bash
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:5432/$DB_NAME" \
  pnpm benchmark
```

### Step 3.7: Restore Traffic & Monitor
Restart API instances:
```bash
# Docker Compose
docker compose start api

# Kubernetes
kubectl scale deployment/mill-ledger-api --replicas=2
```

Monitor `/ready` probe and Prometheus error rate metrics:
```bash
curl -i http://localhost:4000/ready
curl -i http://localhost:4000/metrics
```

---

## 4. Disaster Recovery Drill Schedule

- **Frequency**: Quarterly disaster recovery simulation on dedicated staging infrastructure.
- **Drill Steps**:
  1. Restore random production snapshot to clean PostgreSQL instance.
  2. Verify all 10 SQL invariants return 0 violation rows.
  3. Validate login, invoice generation, and inventory balance lookups.
  4. Record drill duration and RTO metrics in engineering compliance log.
