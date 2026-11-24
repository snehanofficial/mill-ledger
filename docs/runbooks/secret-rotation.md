# Secret & Credential Rotation Runbook

This runbook establishes standard operating procedures for rotating production secrets and credentials in MillLedger ERP in accordance with ISO/IEC 27001 Control 8.24 (Use of cryptography) and OWASP Top 10 A07:2021 (Identification and Authentication Failures).

---

## 1. Inventory of Production Secrets

| Secret Variable | Usage | Rotation Cadence | Impact if Compromised |
|---|---|---|---|
| `BETTER_AUTH_SECRET` | Signing session tokens and authentication cookies | 90 days or on compromise | Session forgery, unauthorized admin access |
| `DATABASE_URL` | PostgreSQL connection string with password | 90 days or employee departure | Direct database exfiltration or corruption |
| `ENCRYPTION_KEY` | At-rest field encryption for sensitive GSTINs/tokens | 180 days | Decryption of sensitive customer/supplier records |
| `ADMIN_BOOTSTRAP_SECRET`| Emergency administrative recovery secret | Immediate after single use | Unauthorized super-admin provisioning |

---

## 2. Rotating `BETTER_AUTH_SECRET`

Better Auth signs HTTP session cookies using `BETTER_AUTH_SECRET`. Rotating this secret invalidates previous session signatures and requires users to re-authenticate.

### Rotation Procedure:
1. **Schedule Maintenance Window**:
   - Schedule during off-peak hours (e.g. 23:00–01:00 IST) to minimize disruption to active salesman order entry.
2. **Generate High-Entropy Secret**:
   ```bash
   NEW_AUTH_SECRET=$(openssl rand -hex 32)
   echo "Generated secret length: ${#NEW_AUTH_SECRET} characters"
   ```
3. **Update Environment Variable in Secret Manager**:
   - In AWS Secrets Manager / HashiCorp Vault / Kubernetes Secret:
     ```bash
     kubectl create secret generic mill-ledger-auth-secret \
       --from-literal=BETTER_AUTH_SECRET="$NEW_AUTH_SECRET" \
       --dry-run=client -o yaml | kubectl apply -f -
     ```
4. **Trigger Rolling Deployment**:
   ```bash
   kubectl rollout restart deployment/mill-ledger-api
   kubectl rollout status deployment/mill-ledger-api
   ```
5. **Post-Rotation Verification**:
   - Confirm active sign-in flow succeeds:
     ```bash
     curl -X POST http://localhost:4000/api/auth/sign-in/email \
       -H "Content-Type: application/json" \
       -d '{"email":"admin@example.com","password":"ValidPassword123!"}'
     ```
   - Confirm expired/tampered session cookies return HTTP 401 Unauthorized.

---

## 3. Rotating PostgreSQL Database Credentials (`DATABASE_URL`)

To avoid downtime when rotating database passwords, follow the **Dual-User Rotation Strategy**:

### Step 3.1: Create Secondary Database Role in PostgreSQL
```sql
-- Connect as postgres superuser
CREATE USER mill_ledger_app_v2 WITH PASSWORD 'GeneratedSecureDbPassword_456!';
GRANT CONNECT ON DATABASE mill_ledger TO mill_ledger_app_v2;
GRANT USAGE ON SCHEMA public TO mill_ledger_app_v2;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO mill_ledger_app_v2;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mill_ledger_app_v2;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mill_ledger_app_v2;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO mill_ledger_app_v2;
```

### Step 3.2: Update `DATABASE_URL` in Production Environment
```bash
NEW_DB_URL="postgresql://mill_ledger_app_v2:GeneratedSecureDbPassword_456!@db-host:5432/mill_ledger?schema=public&sslmode=prefer"

# Update Kubernetes secret or .env.production
kubectl set env deployment/mill-ledger-api DATABASE_URL="$NEW_DB_URL"
```

### Step 3.3: Verify Connection Pool & Health
```bash
# Verify database ping and connection pooling
curl -f http://localhost:4000/ready
```

### Step 3.4: Revoke and Drop Deprecated Role
After confirming that all API instances have switched to `mill_ledger_app_v2`:
```sql
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM mill_ledger_app_v1;
DROP USER mill_ledger_app_v1;
```

---

## 4. Emergency Incident Secret Revocation

If any credential or `.env` file is accidentally exposed in logs, public repositories, or employee laptops:
1. **Immediate Revocation**: Generate and deploy new secret within 15 minutes.
2. **Audit Log Inspection**: Query `AuditLog` table for actions performed within the compromise window:
   ```sql
   SELECT "createdAt", "userId", "action", "resource", "details"
   FROM "AuditLog"
   WHERE "createdAt" >= NOW() - INTERVAL '4 hours'
   ORDER BY "createdAt" DESC;
   ```
3. **Terminate All Active Sessions**:
   ```sql
   TRUNCATE TABLE "Session";
   ```
4. **File Security Incident Report**.
