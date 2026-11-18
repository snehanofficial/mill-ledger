# MillLedger — Architectural Decision Records (ADR)

**Document Reference:** `MLA-ADR-2026-M11`  
**Status:** Active  
**Last Updated:** November 18, 2026  

This document logs all consequential architectural and data modeling decisions that govern the production remediation initiative for MillLedger.

---

## DEC-001: Multi-Tenant Organization Membership Model

- **Decision ID:** `DEC-001`
- **Related Audit Finding:** `P0-SEC-02`
- **Related Task:** `MLD-002`
- **Status:** **APPROVED (Recommended Option 1 Selected)**
- **Date:** November 18, 2026

### Problem Statement
In `server/prisma/schema.prisma`, `model User` lacks an `organizationId` foreign key, and `@mill-ledger/shared`'s `UserContext` omits tenant scope. API controllers resolve `organizationId` from client query parameters (`req.query.organizationId`) or request bodies without verifying user tenancy. Any authenticated actor can read or mutate records belonging to any organization (BOLA vulnerability).

### Business Requirements
1. Every operational transaction (orders, inventory movements, production runs, invoices, payments) must be strictly isolated to the actor's authorized organization.
2. In single-facility food manufacturing (e.g. standard MillLedger deployment), users belong to a primary enterprise mill.
3. Multi-tenant boundary validation must execute in server middleware (`requireAuth` / `requireTenant`) prior to controller invocation.

### Options Considered

#### Option 1: Direct Foreign Key on User Model (`organizationId String`) (Recommended)
Add `organizationId String` to `model User` referencing `Organization(id)`.
- *Pros:*
  - Simple, deterministic, and aligns with Better Auth user metadata fields.
  - Zero-join overhead on session validation; `req.user.organizationId` is immediately available.
  - Straightforward migration for existing seeded users.
- *Cons:*
  - A single email address cannot simultaneously belong to multiple separate organizations without multiple user accounts.

#### Option 2: OrganizationMember Junction Table
Introduce `model OrganizationMember` with `userId`, `organizationId`, `role`, and active status.
- *Pros:*
  - Allows an external auditor or multi-facility manager to switch active organization contexts.
- *Cons:*
  - Requires session tenant switching logic, multi-tenant UI switcher, and complex migration. Exceeds current single-facility mill requirements.

### Decision
**Adopt Option 1 (Direct Foreign Key).** For MillLedger's target architecture as an Order-to-Audit system for small food manufacturers, direct ownership (`User.organizationId`) provides leak-proof tenant enforcement with minimal operational complexity.

---

## DEC-002: Document Sequence Number Generation Strategy

- **Decision ID:** `DEC-002`
- **Related Audit Finding:** `P1-DATA-04`
- **Related Task:** `MLD-012`
- **Status:** **APPROVED (Dedicated Sequence Table with Row-Level Lock)**
- **Date:** November 18, 2026

### Problem Statement
Invoice and dispatch number generation currently relies on `tx.salesInvoice.count({ where: { organizationId, financialYear } }) + 1`. Under concurrent posting, two transactions read identical counts, generating duplicate numbers (e.g. `INV-2026-27-0005`) that collide with `@@unique([organizationId, invoiceNumber])`, aborting transactions. Furthermore, record deletion creates number gaps or reuse, violating Indian GST Rule 46.

### Options Considered

#### Option 1: Native PostgreSQL Sequences (`CREATE SEQUENCE`)
- *Pros:* High throughput, native database support.
- *Cons:* Dynamic sequence creation per financial year per organization requires raw SQL execution and is difficult to manage within Prisma ORM migrations.

#### Option 2: Dedicated `DocumentSequence` Table with Row-Level Lock (`SELECT FOR UPDATE`) (Recommended)
Introduce a `model DocumentSequence` with `organizationId`, `documentType`, `financialYear`, and `currentValue`. Sequence increments occur inside the transaction using `UPDATE ... SET currentValue = currentValue + 1 RETURNING currentValue`.
- *Pros:*
  - Portable across PostgreSQL environments, fully managed via Prisma ORM.
  - Strict gapless consecutive numbering enforced per organization and financial year.
  - Concurrency-safe via transaction row-level lock.
- *Cons:* Slight serialization of concurrent invoice creation within the same mill (negligible for mill volume).

### Decision
**Adopt Option 2 (`DocumentSequence` Table).** Guarantees statutory GST sequential numbering without raw database sequence management complexity.

---

## DEC-003: Inventory Concurrency Protection Model

- **Decision ID:** `DEC-003`
- **Related Audit Finding:** `P1-DATA-03`
- **Related Task:** `MLD-011`
- **Status:** **APPROVED (Database Constraint + Atomic Increment / Row Locking)**
- **Date:** November 18, 2026

### Problem Statement
Purchase receipts overwrite `currentStock: totalQty` rather than applying atomic increments. Production batch posting checks `if (currentStock < consumed.actualQty)` in JavaScript without row locks. Under concurrent operations, race conditions permit lost stock updates or negative inventory balances.

### Decision
1. Add PostgreSQL `CHECK (current_stock >= 0)` constraint in Prisma baseline migration.
2. Replace balance overwrites in purchase receipts with atomic `{ increment: purchasedQty }`.
3. In production consumption and dispatches, use interactive transaction row locking (`tx.$queryRaw\`SELECT * FROM inventory_item WHERE id = ${id} FOR UPDATE\`` or atomic Prisma conditional decrement) to prevent race conditions.
