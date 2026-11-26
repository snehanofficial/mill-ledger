# Emergency Organization Administrator Bootstrap Runbook

This runbook establishes standard operating procedures for creating an initial or emergency organization administrator (`role: "ADMIN"`) in MillLedger ERP in accordance with Owner Decision OD-02 and ISO/IEC 27001 Access Control guidelines.

> **Note**: MillLedger does not use a platform-wide `SUPER_ADMIN` role. `pnpm admin:bootstrap` provisions an organization-level `ADMIN` user bound to the `MILL` organization (`organizationId` referencing `Organization.id`).

---

## 1. Operating Rules & Constraints (OD-02)

To prevent unauthorized privilege escalation or accidental admin creation:
- **OD-02 Policy**: Default admin seeding with hardcoded credentials in production environments is strictly prohibited.
- **Single Active Admin Guard**: The `admin:bootstrap` script verifies that no active admin user already exists. If an administrator is already registered, the bootstrap script aborts immediately with an error to prevent account takeover.
- **Audit Logging**: Any administrative user creation is recorded in the immutable database `AuditLog` table with timestamp and originating context.

---

## 2. Emergency Provisioning Procedure

### Scenario A: Initial System Setup (Cold Greenfield Deployment)
When setting up a fresh production environment where no administrator exists:

1. Connect to the host or execute inside the API container:
   ```bash
   pnpm admin:bootstrap
   ```
2. The interactive script prompts for:
   - **Admin Email**: Must be a valid email address (e.g. `admin@millledger.com`).
   - **Password**: Must be at least 8 characters, containing uppercase, lowercase, numbers, and symbols.
   - **Confirm Password**: Must match.
3. Upon confirmation, the administrator account is created in Better Auth with `role: "ADMIN"` and `organizationId` set to the `MILL` organization's `id`.

### Scenario B: Non-Interactive Scripted Provisioning
For automated infrastructure deployments:
```bash
ADMIN_EMAIL="ops-admin@millledger.com" \
ADMIN_PASSWORD="ReplaceWithHighEntropySecret123!" \
  pnpm admin:bootstrap
```

### Scenario C: Existing Admin Exists but Credentials Are Lost
If an active administrator account exists but credentials are lost and email password reset (`/api/auth/forget-password`) is unreachable:

1. **Verify Operator Authorization**:
   - Obtain formal written sign-off from the mill owner / compliance officer.
2. **Inspect Existing Admin Accounts via PostgreSQL**:
   ```sql
   SELECT id, email, role, "organizationId", "createdAt"
   FROM "user"
   WHERE role = 'ADMIN';
   ```
3. **Deactivate the Lost Admin Account**:
   ```sql
   UPDATE "user"
   SET email = email || '.deactivated.' || EXTRACT(EPOCH FROM NOW())::text,
       role = 'INACTIVE'
   WHERE email = 'lost-admin@millledger.com';
   ```
4. **Execute Bootstrap**:
   ```bash
   pnpm admin:bootstrap
   ```
5. **Log Security Audit Event**:
   ```sql
   INSERT INTO "AuditLog" ("id", "action", "resource", "details", "createdAt")
   VALUES (
     gen_random_uuid()::text,
     'EMERGENCY_ADMIN_RECOVERY',
     'USER',
     '{"reason": "Lost credentials recovery with owner authorization", "operator": "ops-oncall"}'::jsonb,
     NOW()
   );
   ```

---

## 3. Post-Provisioning Verification

Verify successful authentication with the newly provisioned administrator:
```bash
curl -X POST http://localhost:4000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -c /tmp/admin-cookie.txt \
  -d '{"email":"ops-admin@millledger.com","password":"ReplaceWithHighEntropySecret123!"}'

# Verify admin profile endpoint
curl -b /tmp/admin-cookie.txt http://localhost:4000/api/v1/me
```
*Expected*: Returns HTTP 200 with role `"ADMIN"`.
