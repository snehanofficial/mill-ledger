# Authorization Matrix

## Policy model

RBAC decides what broad action a role may perform. ABAC decides whether the action is allowed for a specific resource and context.

Policy inputs include actor, action, resource, organization, facility, now, and resource attributes. Authorization is enforced in the API and domain policy layer, not only in route or menu visibility.

## Roles

- SALESMAN
- ADMIN
- PRODUCTION
- ACCOUNTANT
- OWNER

## Baseline matrix

| Capability              |         Salesman |          Admin |       Production |     Accountant |               Owner |
| ----------------------- | ---------------: | -------------: | ---------------: | -------------: | ------------------: |
| View assigned customers |        Own scope |            Yes |               No | Read as needed |       Summary scope |
| Create own order        |              Yes |       Optional |               No |             No |                  No |
| Read all orders         |               No |            Yes |               No |      Read-only |       Summary scope |
| Approve/reject          |               No |            Yes |               No |             No | Explicit grant only |
| Edit price list         |               No |            Yes |               No |             No | Explicit grant only |
| Create purchase receipt |               No |            Yes |  Authorized only |             No |                Read |
| Post production run     |               No |       Optional |              Yes |             No |                Read |
| View stock              |          Limited |            Yes | Production scope |            Yes |                 Yes |
| Post dispatch           |               No |            Yes |               No |             No |                  No |
| Post invoice            |               No |            Yes |               No |             No |                  No |
| Record payment          |               No |            Yes |               No |      Read-only |                Read |
| Read reports            |        Own scope |            Yes | Production scope |            Yes |                 Yes |
| Export reports          | Own summary only |            Yes | Production scope |            Yes |                 Yes |
| Edit posted records     |               No | No direct edit |   No direct edit |             No |                  No |

## Record rules

- Salesman can read only own orders and assigned customers.
- Accountant/auditor has no write endpoints.
- Production cannot invoice or allocate payments.
- Admin cannot silently edit or delete posted documents.
- Owner is not a superuser unless explicit permissions grant an action.

## Security baseline

- HTTPS in deployed environments
- Secure HttpOnly session cookies and correct SameSite/CSRF behavior
- Strict CORS or same-origin routing
- Security headers and a validated restrictive CSP
- Rate limits on authentication and sensitive writes
- Zod validation and parameterized/raw SQL
- Secrets only in environment/secret managers
- Redacted structured logs
- Authorized private file downloads
- Report/export scope identical to on-screen scope
- Append-only normal audit writes
- Backups and tested restoration

## PostgreSQL RLS

RLS may provide defence in depth after the application policy model is stable, but it does not replace application authorization. Test organization/facility session context and privileged bypass paths before enabling it.
