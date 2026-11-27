# Production Alerting Rules & Operational Response Runbook

This runbook defines the Prometheus alert rules configured in `deploy/prometheus/alerts.yml` for MillLedger ERP, their detection criteria, and remediation runbooks.

---

## 1. Alert Definitions

| Alert Name                       | Condition                               | Window | Severity | Impact                                                   |
| -------------------------------- | --------------------------------------- | ------ | -------- | -------------------------------------------------------- |
| `HighHttp5xxRate`                | HTTP 5xx error rate > 5%                | 5 min  | Critical | API degradation, failed transactions, broken user flows  |
| `HighHttpLatencyP95`             | p95 HTTP response duration > 1.0s       | 5 min  | Warning  | Slow checkout, UI lag, potential DB lock contention      |
| `DatabasePoolSaturation`         | Active DB connections > 18 / 20 (> 90%) | 2 min  | Critical | Connection queue exhaustion, HTTP 500 / 503 errors       |
| `MillLedgerApiDown`              | `up == 0`                               | 1 min  | Critical | Total service outage                                     |
| `ProductionYieldVarianceAnomaly` | Batch yield variance > 10%              | 15 min | Warning  | Raw material leakage, recipe drift, operator input error |

---

## 2. Remediation Runbooks

### Alert: `HighHttp5xxRate`

1. **Triage**: Inspect logs in stdout/CloudWatch/Datadog filtering by `level: "ERROR"`.
2. **Correlation**: Find common `requestId`, `path`, or `userId`.
3. **Common Causes**:
   - Database constraint violation or unhandled exception.
   - External dependency timeout.
4. **Resolution**: If an unhandled bug was deployed, initiate immediate rollback per `docs/runbooks/rollback.md`.

---

### Alert: `HighHttpLatencyP95`

1. **Triage**: Query Prometheus for slow routes:
   ```promql
   topk(5, histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route)))
   ```
2. **Check Database**:
   - Check PostgreSQL `pg_stat_activity` for long-running locks:
     ```sql
     SELECT pid, age(clock_timestamp(), query_start), query, state
     FROM pg_stat_activity
     WHERE state != 'idle' AND age(clock_timestamp(), query_start) > interval '2 seconds';
     ```
3. **Resolution**: Terminate blocking transactions if deadlocked.

---

### Alert: `DatabasePoolSaturation`

1. **Triage**: Check `db_pool_active_connections` metric.
2. **Investigation**: Verify if Prisma query transactions are leaking connections without releasing.
3. **Mitigation**: Scale API replicas or increase PostgreSQL connection pool if DB instance size permits.

---

### Alert: `MillLedgerApiDown`

1. **Health Verification**:
   ```bash
   curl -i http://localhost:4000/api/v1/health
   curl -i http://localhost:4000/ready
   ```
2. **Container Status**: Check container lifecycle (`docker ps` / `kubectl get pods`).
3. **Restart**: Restart failed instances.
