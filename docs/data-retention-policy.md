# MillLedger Data Retention, Minimization, and Privacy Policy

**Statutory Authorities**:
- **Digital Personal Data Protection Act, 2023 (DPDP Act 2023)** (Act No. 22 of 2023), Sections 8, 11, and 12
- **Central Goods and Services Tax Act, 2017 (CGST Act 2017)**, Section 36 (Retention of Accounts)
- **ISO/IEC 27701:2019** (Privacy Information Management System)

---

## 1. Scope & Objective

MillLedger processes operational and financial data for food manufacturing mills in India. This policy establishes the retention, minimization, subject access, and erasure standards required to balance statutory tax audit compliance under the CGST Act 2017 with Data Principal privacy rights under the DPDP Act 2023.

---

## 2. Retention Schedules

| Data Category | Data Elements | Statutory Basis | Retention Period | Disposal / Action |
|---|---|---|---|---|
| **Tax Invoices & Credit Notes** | Invoice numbers, dates, customer snapshot names, GSTINs, HSN codes, tax amounts, line totals | Section 36 CGST Act 2017 | **72 Months (6 Years)** from the due date of furnishing annual return for the financial year | Archived; strictly immutable in database. |
| **Inventory & Stock Ledgers** | Raw material receipts, production batch run records, physical dispatch notes | Section 36 CGST Act 2017 | **72 Months (6 Years)** | Immutable ledger entries retained for excise and GST audit. |
| **Payment & Settlement Records** | Payment receipts, bank references, invoice allocations | Section 36 CGST Act 2017 | **72 Months (6 Years)** | Retained for financial year audit and bank reconciliations. |
| **Customer Contact PII** | Contact person name, phone number, email address | DPDP Act 2023 Section 8(7) | **Duration of Active Commercial Relationship + 180 Days** | Anonymized upon commercial disengagement or erasure request. |
| **Authentication Sessions** | Session tokens, user session cookies | DPDP Act 2023 Data Minimization | **Maximum 90 Days** from session issuance or upon expiration | Automated purge via cleanup routine. |
| **Audit Log IP & User-Agent** | Request IP address, User-Agent header, request IDs | DPDP Act 2023 / Security Best Practice | **90 Days** | Truncated/cleared for inactive historical telemetry. |

---

## 3. Data Principal Rights (DPDP Act 2023)

### 3.1 Right to Access Information (Section 11)
Every Data Principal (customer or authorized representative) has the right to obtain a summary of personal data being processed by MillLedger.
- **Implementation**: `GET /api/v1/sales/customers/:id/data-export`
- **Output**: Machine-readable JSON summary containing personal profile data and document references (sales orders, tax invoices, payment records).

### 3.2 Right to Correction and Erasure (Section 12)
Data Principals have the right to request correction of inaccurate data or erasure of personal data that is no longer necessary for the purpose for which it was processed.
- **Reconciliation with Statutory Invoicing**: Under Section 36 of the CGST Act, past posted tax invoices and financial ledgers cannot be destroyed before 72 months.
- **Implementation**: `POST /api/v1/sales/customers/:id/anonymize`
  1. Customer PII (`phone`, `email`, `gstin`) is redacted to `NULL`.
  2. Customer name is replaced with `"ANONYMIZED_CUSTOMER"`.
  3. Customer status is set to `isActive: false`.
  4. Active salesman assignments are deleted.
  5. Foreign key relationships with historical posted invoices and ledger movements are preserved to satisfy Section 36 CGST Act without maintaining live contact information.

---

## 4. Automated Cleanup Procedures

1. **Session Pruning**: Expired and stale user session records older than 90 days are purged periodically via `userService.cleanupExpiredSessions()`.
2. **Immutable Audit Trail**: Operational mutations, data exports, and customer anonymization events are permanently recorded in the append-only `audit_log` table with timestamps and actor IDs.
