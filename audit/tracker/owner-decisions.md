# MillLedger Owner Decisions & Architectural Approvals

**Standard Compliance**: GEMINI.md Rule E1-E11 (No unverified assumptions)  
**Decision Date**: 20 November 2026  
**Total Open Decisions**: 0 Key Decisions (All 8 Decisions Formally Approved and Recorded)  
**Total Blocked Items**: 0 Work Items (All 7 Blocked Work Items Unblocked: `F-013`, `F-014`, `F-018`, `F-020`, `F-023`, `F-083`, `F-106`)  

---

## Decision Ledger

### OD-01: Dynamic GST Rate Master Table vs Static Product Column
- **Affected Items**: `F-014` (P2)
- **Status**: **RESOLVED - APPROVED (20 November 2026) — UNBLOCKS F-014**
- **Context**: Statutory GST rates (5%, 12%, 18%) are currently read from static `product.taxRate` columns in the product table. A dedicated `TaxRate` master table exists in Prisma schema but is never queried.
- **Options**:
  1. *Option A (Dynamic Master)*: Migrate all invoice tax calculations to read from the `TaxRate` table matched by HSN code and effective date.
  2. *Option B (Static Column)*: Retain static `product.taxRate`, remove the unused `TaxRate` master model, and enforce 5% / 12% / 18% via Zod enum.
- **Consequences**: Option A accommodates future statutory GST rate adjustments by CBIC without modifying historical product entries. Option B is simpler but requires database schema edits if rates change.
- **Agent Assumption**: Option A (Dynamic `TaxRate` table lookup by HSN code with fallback to product tax rate).
- **Owner Decision (Recorded Verbatim — 20 November 2026)**:
> **Decision: Option A — Dynamic Master.**
> 
> I approve migrating all invoice tax calculations to the dedicated `TaxRate` master table, matched using HSN code and the applicable effective date.
> 
> Additional requirements:
> - `TaxRate` must be the authoritative source for statutory GST rates.
> - Do not silently fall back to `product.taxRate` when a matching rate is unavailable. Invoice finalization must fail safely and report a tax configuration error.
> - Preserve the applicable tax rate, HSN code, taxable value, tax breakdown, and rate reference as an immutable snapshot on posted invoice lines.
> - Historical posted invoices must never be recalculated when future GST rates change.
> - Prevent overlapping effective-date records for the same applicable tax classification.
> - Deprecate and remove the static `product.taxRate` dependency after a verified data migration.
> - Use precise decimal/paise arithmetic for all financial calculations.
> 
> **Affected item:** Unblock `F-014` after implementation criteria are documented.
- **Resolution**: `F-014` transitioned from `BLOCKED` to `OPEN`. Implementation criteria and migration rules documented in `01-expected-spec.md` (REQ-034 & REQ-036).

---

### OD-02: Super Admin Bootstrap and First-Run Credential Policy
- **Affected Items**: `F-023` (P1)
- **Status**: **RESOLVED - APPROVED (20 November 2026) — UNBLOCKS F-023**
- **Context**: Super admin accounts currently rely on hardcoded credentials in `prisma/seed.ts`. There are zero API endpoints or secure CLI utilities to bootstrap the initial administrator without risking hardcoded passwords in version control.
- **Options**:
  1. *Option A (Interactive CLI)*: Build an interactive script `pnpm admin:bootstrap` that prompts for email, password, and provisions the initial ADMIN account with mandatory password hashing.
  2. *Option B (Environment Variable Seed)*: Bootstrap the admin account on server startup if `ADMIN_EMAIL` and `ADMIN_PASSWORD` environment variables are set in `.env`.
- **Consequences**: Option A prevents secrets from persisting in plaintext environment files. Option B works well in containerized orchestration (Docker/Kubernetes).
- **Agent Assumption**: Option A (Interactive CLI utility `pnpm admin:bootstrap` with validation).
- **Owner Decision (Recorded Verbatim — 20 November 2026)**:
> **Decision: Option A — Interactive CLI.**
> 
> I approve the interactive `pnpm admin:bootstrap` utility.
> 
> Additional requirements:
> - Never store default administrator passwords in source code, Prisma seeds, or committed environment files.
> - Password input must be hidden during interactive entry.
> - Use the application's approved secure password-hashing mechanism.
> - Bootstrap must refuse to create another initial administrator when one already exists.
> - Make account creation transactional and record an appropriate audit event.
> - Never print passwords, password hashes, or other credentials in logs.
> - Do not automatically bootstrap administrators during normal server startup.
> - The utility must support secure one-time execution in the deployment environment.
> 
> Prisma seed scripts must only provision non-sensitive reference/master data.
> 
> **Affected item:** Unblock `F-023` after implementation criteria are documented.
- **Resolution**: `F-023` transitioned from `BLOCKED` to `OPEN`. Bootstrap CLI specification documented in `01-expected-spec.md` (REQ-054 & Section 14).

---

### OD-03: Multi-tier ABAC Scoping Matrix for Salesmen & Dispatches
- **Affected Items**: `F-018` (P1)
- **Status**: **RESOLVED - APPROVED (20 November 2026) — UNBLOCKS F-018**
- **Context**: `GET /api/v1/sales/dispatches` currently leaks company-wide customer orders, invoices, and dispatch notes to field salesmen.
- **Options**:
  1. *Option A (Strict Isolation)*: Salesmen cannot access `/dispatches` at all (restricted to ADMIN, DISPATCHER, OWNER). Salesmen track order status solely through `/orders/my-orders`.
  2. *Option B (Scoped Dispatches)*: Filter dispatches returned by `GET /api/v1/sales/dispatches` to only include orders originally submitted by the requesting salesman.
- **Consequences**: Option A protects warehouse logistics and operational data. Option B provides salesmen with direct tracking of their customers' shipments.
- **Agent Assumption**: Option B (Filter dispatches by `salesOrder.createdById === user.id` for salesmen).
- **Owner Decision (Recorded Verbatim — 20 November 2026)**:
> **Decision: Option B — Scoped Dispatches.**
> 
> I approve allowing salesmen to access dispatch information associated exclusively with their own submitted sales orders.
> 
> Authorization requirements:
> - Enforce `salesOrder.createdById === authenticatedUser.id` on the server.
> - Apply all existing company/tenant and organizational access restrictions.
> - Enforce the same authorization rules on individual dispatch details and related resources, not just the initial listing endpoint.
> - Do not expose unrelated customer records, company-wide invoices, payment information, internal warehouse notes, or unrestricted operational data.
> - Return only the minimum dispatch information necessary for a salesman to track their own customers' orders.
> - Never rely on frontend filtering or hidden UI elements as authorization controls.
> - Preserve existing ADMIN, DISPATCHER, and OWNER access policies.
> 
> **Affected item:** Unblock `F-018` after the ABAC policy and regression tests are verified.
- **Resolution**: `F-018` transitioned from `BLOCKED` to `OPEN`. Scoped dispatch policy documented in `01-expected-spec.md` (REQ-025 & REQ-064).

---

### OD-04: Offline Outbox Stock Shortage Conflict Queue Policy (REQ-052)
- **Affected Items**: `F-083` (P1)
- **Status**: **RESOLVED - APPROVED (20 November 2026) — UNBLOCKS F-083**
- **Context**: When an offline order synced by a field salesman encounters insufficient ATP inventory, the server currently accepts it silently or fails with an unhandled exception. REQ-052 mandates an explicit Conflict Queue.
- **Options**:
  1. *Option A (Conflict Status in Database)*: Transition the order to `STOCK_SHORTAGE_CONFLICT` with allocated available units reserved, keeping the shortage in a pending conflict queue for salesman/admin resolution.
  2. *Option B (Transactional Rejection)*: Reject the order sync with HTTP 409 Conflict, returning the exact deficit, and preserve the order in the client's local IndexedDB conflict drawer for manual amendment.
- **Consequences**: Option A guarantees order intent is captured on the server ledger. Option B maintains zero dirty orders in the PostgreSQL database.
- **Agent Assumption**: Option A (Server-side `STOCK_SHORTAGE_CONFLICT` state with real-time outbox notification).
- **Owner Decision (Recorded Verbatim — 20 November 2026)**:
> **Decision: Option A — Conflict Status in Database.**
> 
> I approve implementing the server-side `STOCK_SHORTAGE_CONFLICT` state.
> 
> The server must preserve the original offline order intent rather than silently accepting an unfulfillable order or discarding it through an unhandled exception.
> 
> Additional requirements:
> - Create the order and its associated conflict record atomically.
> - Calculate available-to-promise inventory using appropriate database row locking and transactional isolation.
> - Reserve only the actually available quantity and record the exact remaining shortage.
> - Never allow negative available inventory or overselling.
> - Keep the order in `STOCK_SHORTAGE_CONFLICT` until an authorized resolution is performed.
> - Provide an explicit conflict queue for authorized administrators and relevant salesmen.
> - Record conflict creation, resolution, responsible actor, timestamps, and inventory changes.
> - Use the transactional outbox for notifications, emitting events only after the database transaction commits.
> - Ensure repeated offline synchronization requests are idempotent.
> 
> The conflict state must never be presented as a successfully fulfilled order.
> 
> **Affected item:** Unblock `F-083` after the conflict lifecycle and concurrency tests are verified.
- **Resolution**: `F-083` transitioned from `BLOCKED` to `OPEN`. Concurrency, row locking, and conflict state rules documented in `01-expected-spec.md` (REQ-052).

---

### OD-05: Image Hash Interpretation & Asset Optimization
- **Affected Items**: None blocked directly (Governs Tier 8 image pipeline, `F-075`, and proof-of-delivery document integrity)
- **Status**: **RESOLVED - APPROVED (20 November 2026) — APPLIES TO TIER 8 (F-075)**
- **Context**: The prompt mentions "image hash" in Tier 8.
- **Options**:
  1. *Option A (Perceptual Thumbhash/Blurhash)*: Generate base64 blurhashes for product imagery to render instant progressive blur placeholders while full images load.
  2. *Option B (Content-Addressable SHA-256)*: Compute cryptographic SHA-256 hashes of uploaded receipt images for deduplication and tamper proofing.
- **Agent Assumption**: Implement both: Thumbhash on frontend product cards for LCP, and SHA-256 file checksums on uploaded proof-of-delivery documents.
- **Owner Decision (Recorded Verbatim — 20 November 2026)**:
> **Decision: Confirm both approaches — Option A and Option B.**
> 
> I approve implementing both mechanisms because they solve different problems.
> 
> **Product imagery:**
> - Use ThumbHash for compact progressive image placeholders.
> - Generate and store the placeholder during the image-processing/upload pipeline.
> - Use optimized responsive AVIF/WebP renditions where supported.
> - Preserve intrinsic image dimensions to prevent layout shifts.
> - Do not allow placeholder processing or lazy loading to delay above-the-fold LCP images.
> 
> **Receipt and proof-of-delivery documents:**
> - Generate SHA-256 checksums on the server for uploaded files.
> - Store checksums with the corresponding document metadata and immutable audit records.
> - Use checksums to detect exact duplicate uploads and verify file integrity.
> - Keep deduplication scoped to the appropriate company/tenant.
> - Do not describe an SHA-256 checksum alone as proof of authenticity or tamper-proof storage; protect the associated audit records and stored documents against unauthorized modification.
> 
> These are complementary mechanisms and must not be treated as interchangeable hashes.
> 
> **Affected items:** No direct blocked work item. Include implementation in the relevant Tier 8 optimization and document-integrity work.
- **Resolution**: Updated `01-expected-spec.md` (REQ-056 and Section 14 Decision 1). Marked explicit specification change superseding the prior "optional placeholders" text to mandate ThumbHash for product imagery and SHA-256 server checksums for proof-of-delivery documents.

---

### OD-06: Payment Bounce and Debit Note Data Model Specification
- **Affected Items**: `F-013` (P1)
- **Status**: **RESOLVED - APPROVED (20 November 2026) — UNBLOCKS F-013**
- **Context**: The system lacks data structures to handle customer cheque bounces, online payment chargebacks, or supplier purchase debit notes without deleting ledger records.
- **Options**:
  1. *Option A (Compensating Journal Entries)*: Add `PaymentStatus: BOUNCED` which triggers an automatic negative allocation reversal, and add a `DebitNote` table mirroring `CreditNote`.
  2. *Option B (Credit Note Generalization)*: Reuse the existing `CreditNote` table with a `type: "SUPPLIER_DEBIT" | "CUSTOMER_CREDIT"` enum flag.
- **Consequences**: Option A maintains strict GAAP/statutory separation between Accounts Payable and Accounts Receivable.
- **Agent Assumption**: Option A (Dedicated `DebitNote` model and `BOUNCED` payment lifecycle).
- **Owner Decision (Recorded Verbatim — 20 November 2026)**:
> **Decision: Option A — Compensating Journal Entries with a Dedicated DebitNote Model.**
> 
> I approve maintaining a dedicated `DebitNote` model separate from the existing `CreditNote` model.
> 
> This decision is based on Mill Ledger's requirement to maintain separate customer receivables, supplier payables, purchase records, collections and auditable financial transactions.
> 
> Additional requirements:
> 
> **1. Customer payment reversals**
> - Introduce `PaymentStatus.BOUNCED` for cheque payment failures.
> - Support online payment chargebacks as a separately identifiable reversal event.
> - Reverse the original payment allocations transactionally, restoring the corresponding customer outstanding balance.
> - Never delete or overwrite the original payment or its allocation history.
> - Prevent duplicate reversal operations through idempotency controls.
> - Record reversal reason, original transaction reference, timestamp and responsible actor.
> - Include reversed payments in the relevant audit and collection reports without counting them as successful collections.
> 
> **2. Supplier debit notes**
> - Introduce a dedicated `DebitNote` model for debit notes raised by Mill Ledger against suppliers.
> - Support purchase returns, short deliveries, damaged goods, quality rejections and supplier price adjustments.
> - Link every debit note to its supplier and relevant purchase invoice or goods receipt.
> - Record item quantities, taxable values, applicable tax breakdown, reason and supporting evidence.
> - Update supplier payable balances through immutable accounting adjustments.
> - Generate corresponding stock movements only when a physical stock return or adjustment actually occurs.
> - Do not modify or delete the original purchase or inventory transactions.
> 
> **3. Accounting separation**
> - Keep customer credit notes and supplier debit notes as separate document types with their own authorization, lifecycle and audit requirements.
> - Preserve financial precision using decimal or integer-paisa arithmetic.
> - Posted documents must be immutable. Corrections must use appropriate compensating transactions.
> - All posting and reversal operations must be transactional and idempotent.
> 
> **4. Scope clarification**
> 
> A debit note raised by Mill Ledger against a supplier must not be confused with a statutory GST debit note issued by a supplier to Mill Ledger. These have different accounting directions and tax implications.
> 
> Supplier-issued statutory GST debit notes should remain a separately documented requirement if that functionality is introduced. Do not automatically treat them as the same document as purchase returns or supplier deductions.
> 
> Implement the core supplier debit note and payment reversal workflows without expanding into a complete accounting ERP.
> 
> **Affected item:** Unblock `F-013` after updating the data model, accounting rules, and verification criteria. Prioritize implementation after the mandatory sales, production, inventory and benchmark workflows are working correctly.
- **Resolution**: `F-013` transitioned from `BLOCKED` to `OPEN`. Data model and compensating journal entry rules documented in `01-expected-spec.md` (REQ-037 & REQ-039).

---

### OD-07: Sales Order Unit Price Discount Bounds and Margin Policy
- **Affected Items**: `F-020` (P1)
- **Status**: **RESOLVED - APPROVED (20 November 2026) — UNBLOCKS F-020**
- **Context**: Salesmen can currently submit orders with arbitrary unit prices (e.g. ₹0.01 per packet), bypassing price lists and eroding profit margins.
- **Options**:
  1. *Option A (Strict Price List Lock)*: Salesmen cannot alter unit prices in UI; price is read-only from the customer's assigned price list.
  2. *Option B (Threshold Discount Guard)*: Salesmen may discount up to 5% off list price; any discount between 5% and 15% requires manager approval; discounts > 15% are rejected.
- **Consequences**: Option A eliminates fraud risk. Option B allows commercial flexibility for field negotiations.
- **Agent Assumption**: Option B (Up to 5% salesman discretion, > 5% requires ADMIN approval).
- **Owner Decision (Recorded Verbatim — 20 November 2026)**:
> **Decision: Option B — Threshold Discount Guard.**
> 
> I approve the following exact discount policy:
> 
> | Discount against assigned price list | Permission |
> |---|---|
> | Up to and including 5% | Salesman discretion |
> | Above 5% and up to and including 15% | Manager approval required |
> | Above 15% | Reject |
> 
> Additional requirements:
> - Always derive the base price from the customer's assigned price list.
> - Enforce the discount limits in the backend; frontend restrictions alone are insufficient.
> - Recalculate prices and discounts server-side using precise decimal arithmetic.
> - Record the applied discount, requesting salesman, approving manager, approval timestamp, and reason.
> - Manager approval must use an explicitly authorized permission, not an assumed equivalence between ADMIN and MANAGER.
> - Prevent modification of the price or discount after approval without revalidation.
> - Reject attempts to bypass the approval process through direct API requests.
> 
> **Important:** The above 5% to 15% range requires manager approval, not automatic ADMIN approval. This explicitly overrides the agent's simplified assumption.
> 
> **Affected item:** Unblock `F-020` after the pricing and approval tests are verified.
- **Resolution**: `F-020` transitioned from `BLOCKED` to `OPEN`. The exact discount threshold guard, permission boundary (MANAGER approval, not ADMIN), and decimal calculation rules are documented in `01-expected-spec.md` (REQ-024).

---

### OD-08: DPDP Act 2023 Customer Data Retention, Anonymization & Erasure Schedule
- **Affected Items**: `F-106` (P2)
- **Status**: **RESOLVED - APPROVED (20 November 2026) — UNBLOCKS F-106**
- **Context**: Digital Personal Data Protection (DPDP) Act 2023 requires data erasure on customer request. However, Section 36 of the CGST Act 2017 requires mandatory preservation of tax invoice records for 72 months (6 years).
- **Options**:
  1. *Option A (PII Anonymization)*: Replace customer name, phone, email, and address with `ANONYMIZED-CUSTOMER-<ID>` while preserving GSTIN, invoice amounts, tax registers, and financial ledgers.
  2. *Option B (Restricted Archival)*: Lock customer records from active view, restrict access to statutory audit roles only, and execute hard deletion after the 72-month statutory retention expires.
- **Consequences**: Option A satisfies DPDP Act data minimization immediately without violating GST retention. Option B satisfies strict tax audit trails.
- **Agent Assumption**: Option A (Cryptographic PII anonymization with invoice financial integrity preservation).
- **Owner Decision (Recorded Verbatim — 20 November 2026)**:
> **Decision: Option A — PII Anonymization, with statutory-retention safeguards.**
> 
> I approve implementing a privacy-first customer data erasure and anonymization workflow.
> 
> However, blanket anonymization of every customer identity field must not destroy information legally required in statutory invoices and accounting records.
> 
> Additional requirements:
> - Provide a controlled customer data-erasure request workflow.
> - Verify the request and determine the applicable purpose and legal retention requirements for each affected category of personal data.
> - Erase or irreversibly anonymize personal data that is no longer required for a lawful purpose or statutory obligation.
> - Preserve only the customer information and financial records required under applicable statutory retention requirements.
> - Do not remove or rewrite legally required information from posted GST invoices during their mandatory retention period.
> - Keep retained statutory information accessible only to authorized accounting, compliance, and audit personnel.
> - Prevent retained statutory data from being reused for unrelated sales or marketing activities.
> - Maintain an auditable record of erasure requests, legal retention exceptions, actions performed, and retention expiry dates.
> - Automatically reassess retention and perform eligible erasure after the applicable statutory retention period and any relevant legal hold have expired.
> 
> For GST accounting records, calculate the 72-month retention period from the due date of furnishing the annual return for the relevant financial year, rather than simply calculating six years from the invoice date.
> 
> Where an applicable appeal, revision, proceeding, or investigation requires additional retention, follow the extended period prescribed under Section 36 of the CGST Act.
> 
> Do not interpret pseudonymization or reversible hashing as irreversible anonymization.
> 
> **Affected item:** Unblock `F-106` after the statutory-retention and privacy-erasure rules are documented and tested.
- **Resolution**: `F-106` transitioned from `BLOCKED` to `OPEN`. DPDP Act Section 12 erasure and CGST Act Section 36 72-month retention rules documented in `01-expected-spec.md` (REQ-078).
