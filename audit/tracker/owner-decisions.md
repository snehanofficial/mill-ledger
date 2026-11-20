# MillLedger Owner Decisions & Architectural Approvals

**Standard Compliance**: GEMINI.md Rule E1-E11 (No unverified assumptions)  
**Total Open Decisions**: 8 Key Decisions  
**Total Blocked Items**: 7 Work Items (`F-013`, `F-014`, `F-018`, `F-020`, `F-023`, `F-083`, `F-106`)  

---

## Decision Ledger

### OD-01: Dynamic GST Rate Master Table vs Static Product Column
- **Affected Items**: `F-014` (P2)
- **Status**: **OPEN - BLOCKING F-014**
- **Context**: Statutory GST rates (5%, 12%, 18%) are currently read from static `product.taxRate` columns in the product table. A dedicated `TaxRate` master table exists in Prisma schema but is never queried.
- **Options**:
  1. *Option A (Dynamic Master)*: Migrate all invoice tax calculations to read from the `TaxRate` table matched by HSN code and effective date.
  2. *Option B (Static Column)*: Retain static `product.taxRate`, remove the unused `TaxRate` master model, and enforce 5% / 12% / 18% via Zod enum.
- **Consequences**: Option A accommodates future statutory GST rate adjustments by CBIC without modifying historical product entries. Option B is simpler but requires database schema edits if rates change.
- **Agent Assumption**: Option A (Dynamic `TaxRate` table lookup by HSN code with fallback to product tax rate).
- **Unblocking Action**: Owner confirms Option A or Option B.

---

### OD-02: Super Admin Bootstrap and First-Run Credential Policy
- **Affected Items**: `F-023` (P1)
- **Status**: **OPEN - BLOCKING F-023**
- **Context**: Super admin accounts currently rely on hardcoded credentials in `prisma/seed.ts`. There are zero API endpoints or secure CLI utilities to bootstrap the initial administrator without risking hardcoded passwords in version control.
- **Options**:
  1. *Option A (Interactive CLI)*: Build an interactive script `pnpm admin:bootstrap` that prompts for email, password, and provisions the initial ADMIN account with mandatory password hashing.
  2. *Option B (Environment Variable Seed)*: Bootstrap the admin account on server startup if `ADMIN_EMAIL` and `ADMIN_PASSWORD` environment variables are set in `.env`.
- **Consequences**: Option A prevents secrets from persisting in plaintext environment files. Option B works well in containerized orchestration (Docker/Kubernetes).
- **Agent Assumption**: Option A (Interactive CLI utility `pnpm admin:bootstrap` with validation).
- **Unblocking Action**: Owner approves Option A or Option B.

---

### OD-03: Multi-tier ABAC Scoping Matrix for Salesmen & Dispatches
- **Affected Items**: `F-018` (P1)
- **Status**: **OPEN - BLOCKING F-018**
- **Context**: `GET /api/v1/sales/dispatches` currently leaks company-wide customer orders, invoices, and dispatch notes to field salesmen.
- **Options**:
  1. *Option A (Strict Isolation)*: Salesmen cannot access `/dispatches` at all (restricted to ADMIN, DISPATCHER, OWNER). Salesmen track order status solely through `/orders/my-orders`.
  2. *Option B (Scoped Dispatches)*: Filter dispatches returned by `GET /api/v1/sales/dispatches` to only include orders originally submitted by the requesting salesman.
- **Consequences**: Option A protects warehouse logistics and operational data. Option B provides salesmen with direct tracking of their customers' shipments.
- **Agent Assumption**: Option B (Filter dispatches by `salesOrder.createdById === user.id` for salesmen).
- **Unblocking Action**: Owner confirms Option A or Option B.

---

### OD-04: Offline Outbox Stock Shortage Conflict Queue Policy (REQ-052)
- **Affected Items**: `F-083` (P1)
- **Status**: **OPEN - BLOCKING F-083**
- **Context**: When an offline order synced by a field salesman encounters insufficient ATP inventory, the server currently accepts it silently or fails with an unhandled exception. REQ-052 mandates an explicit Conflict Queue.
- **Options**:
  1. *Option A (Conflict Status in Database)*: Transition the order to `STOCK_SHORTAGE_CONFLICT` with allocated available units reserved, keeping the shortage in a pending conflict queue for salesman/admin resolution.
  2. *Option B (Transactional Rejection)*: Reject the order sync with HTTP 409 Conflict, returning the exact deficit, and preserve the order in the client's local IndexedDB conflict drawer for manual amendment.
- **Consequences**: Option A guarantees order intent is captured on the server ledger. Option B maintains zero dirty orders in the PostgreSQL database.
- **Agent Assumption**: Option A (Server-side `STOCK_SHORTAGE_CONFLICT` state with real-time outbox notification).
- **Unblocking Action**: Owner selects Option A or Option B.

---

### OD-05: Image Hash Interpretation & Asset Optimization
- **Affected Items**: None blocked directly (Affects Tier 8 optimization)
- **Status**: **RESOLVED VIA ASSUMPTION**
- **Context**: The prompt mentions "image hash" in Tier 8.
- **Options**:
  1. *Option A (Perceptual Thumbhash/Blurhash)*: Generate base64 blurhashes for product imagery to render instant progressive blur placeholders while full images load.
  2. *Option B (Content-Addressable SHA-256)*: Compute cryptographic SHA-256 hashes of uploaded receipt images for deduplication and tamper proofing.
- **Agent Assumption**: Implement both: Thumbhash on frontend product cards for LCP, and SHA-256 file checksums on uploaded proof-of-delivery documents.

---

### OD-06: Payment Bounce and Debit Note Data Model Specification
- **Affected Items**: `F-013` (P1)
- **Status**: **OPEN - BLOCKING F-013**
- **Context**: The system lacks data structures to handle customer cheque bounces, online payment chargebacks, or supplier purchase debit notes without deleting ledger records.
- **Options**:
  1. *Option A (Compensating Journal Entries)*: Add `PaymentStatus: BOUNCED` which triggers an automatic negative allocation reversal, and add a `DebitNote` table mirroring `CreditNote`.
  2. *Option B (Credit Note Generalization)*: Reuse the existing `CreditNote` table with a `type: "SUPPLIER_DEBIT" | "CUSTOMER_CREDIT"` enum flag.
- **Consequences**: Option A maintains strict GAAP/statutory separation between Accounts Payable and Accounts Receivable.
- **Agent Assumption**: Option A (Dedicated `DebitNote` model and `BOUNCED` payment lifecycle).
- **Unblocking Action**: Owner confirms Option A or Option B.

---

### OD-07: Sales Order Unit Price Discount Bounds and Margin Policy
- **Affected Items**: `F-020` (P1)
- **Status**: **OPEN - BLOCKING F-020**
- **Context**: Salesmen can currently submit orders with arbitrary unit prices (e.g. ₹0.01 per packet), bypassing price lists and eroding profit margins.
- **Options**:
  1. *Option A (Strict Price List Lock)*: Salesmen cannot alter unit prices in UI; price is read-only from the customer's assigned price list.
  2. *Option B (Threshold Discount Guard)*: Salesmen may discount up to 5% off list price; any discount between 5% and 15% requires manager approval; discounts > 15% are rejected.
- **Consequences**: Option A eliminates fraud risk. Option B allows commercial flexibility for field negotiations.
- **Agent Assumption**: Option B (Up to 5% salesman discretion, > 5% requires ADMIN approval).
- **Unblocking Action**: Owner selects Option A or Option B.

---

### OD-08: DPDP Act 2023 Customer Data Retention, Anonymization & Erasure Schedule
- **Affected Items**: `F-106` (P2)
- **Status**: **OPEN - BLOCKING F-106**
- **Context**: Digital Personal Data Protection (DPDP) Act 2023 requires data erasure on customer request. However, Section 36 of the CGST Act 2017 requires mandatory preservation of tax invoice records for 72 months (6 years).
- **Options**:
  1. *Option A (PII Anonymization)*: Replace customer name, phone, email, and address with `ANONYMIZED-CUSTOMER-<ID>` while preserving GSTIN, invoice amounts, tax registers, and financial ledgers.
  2. *Option B (Restricted Archival)*: Lock customer records from active view, restrict access to statutory audit roles only, and execute hard deletion after the 72-month statutory retention expires.
- **Consequences**: Option A satisfies DPDP Act data minimization immediately without violating GST retention. Option B satisfies strict tax audit trails.
- **Agent Assumption**: Option A (Cryptographic PII anonymization with invoice financial integrity preservation).
- **Unblocking Action**: Owner selects Option A or Option B.
