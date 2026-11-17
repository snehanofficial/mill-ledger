# Product Requirements

## Priority

- **P0:** Release blocker: benchmark, correctness, traceability, authorization, or submission deliverable.
- **P1:** Strongly recommended: material product or role experience improvement.
- **P2:** Future differentiator; must not delay P0.
- **P3:** Defer or high caution because of privacy, integration, or maintenance risk.

## P0 requirement inventory

| ID    | Requirement                                                                             | Milestone  |
| ----- | --------------------------------------------------------------------------------------- | ---------- |
| R-001 | Separate login and role access for salesman, admin, production, accountant, and owner.  | M1         |
| R-003 | Product, customer, supplier, raw-material, inventory, price, tax, and BOM masters.      | M2         |
| R-004 | Mobile-friendly field order entry.                                                      | M5         |
| R-005 | Customer selection and effective price-list pricing.                                    | M2, M5     |
| R-006 | Admin order review, quantity/price edit with reason, approve/reject.                    | M5         |
| R-007 | Show on-hand, reserved, and available-to-promise stock.                                 | M5         |
| R-008 | GST tax invoice with snapshots, HSN, place of supply, tax components, and FY numbering. | M6         |
| R-010 | Dispatch creates the physical stock deduction.                                          | M6         |
| R-011 | Record payments and calculate invoice/customer outstanding.                             | M7         |
| R-012 | Versioned BOM with ingredients and packaging.                                           | M2, M4     |
| R-013 | Capture planned and actual production output and scrap/waste.                           | M4         |
| R-014 | Post production atomically with stock deductions and finished-goods receipt.            | M4         |
| R-015 | Calculate yield and consumption variance against benchmark conventions.                 | M4         |
| R-016 | Support kg/g, litre/ml, pieces, packets, and item-specific cartons.                     | M2, M4     |
| R-017 | Separate raw, packaging, WIP, and finished-stock balances.                              | M3         |
| R-018 | Every stock movement resolves to a posted source document.                              | M3         |
| R-019 | Purchase receipts and supplier records.                                                 | M3         |
| R-020 | Raw-material and packaging valuation using a stated method.                             | M7         |
| R-021 | Labour, gas/power, and other direct run costs.                                          | M7         |
| R-022 | Cost per good packet and selling-price margin.                                          | M7         |
| R-023 | Sales, GST, purchase, stock, production, collection, and receivable reports.            | M8         |
| R-024 | CSV/XLSX/PDF exports.                                                                   | M8         |
| R-036 | Audit posted stock/production changes; correct posted invoices by credit note.          | M1, M4, M6 |
| R-037 | Repeatable exact benchmark seed.                                                        | M0, M11    |
| R-038 | Hosted demo or one-command setup with role logins.                                      | M11        |
| R-039 | Public repository, README, design note, and demo video.                                 | M11        |

P1 requirements include R-009 invoice sharing, R-025 GST reconciliation summaries, R-026 variance alerts, R-027 owner dashboard, R-028 offline order sync, and R-035 Tamil production UI.

P2/P3 items include FEFO/lots, reorder alerts, planning, GPS, Tally, and compliance integrations. They must not displace P0 benchmark work.

## Product scope

Initial release is one React PWA, one Express modular monolith, and one PostgreSQL database. It is not a live GST filing system, Tally replacement, multi-company SaaS, microservices platform, or general ledger replacement.

## Personas

- **Salesman:** Android phone, weak connectivity, assigned customers, own orders, under-one-minute normal order entry.
- **Factory admin:** Desktop review, dense queues, reservations, pricing, invoicing, dispatch, and collections.
- **Production supervisor:** Tablet/floor entry, large numeric fields, BOM actuals, damage, output, variance, and cost.
- **Accountant/auditor:** Desktop read-only reports, exports, drill-down, and aging/ledger reconciliation.
- **Owner:** Responsive summary, exceptions, cost, stock, receivables, and source drill-down.

## Definition of done

A feature is complete only with identified acceptance criteria, reviewed persistence, implemented service rules, authorized API, appropriate UI states, relevant tests, accessibility checks, audit/source traceability, documentation, and no benchmark regression.
