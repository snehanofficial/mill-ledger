# MillLedger Documentation Index

## Authority

The [CDI problem statement](../Problem_Statement_Winter_Internship_Application_2026.md) and the exact benchmark in [benchmark.md](benchmark.md) define what must be delivered. [MASTER_PROJECT_PLAN.md](../MASTER_PROJECT_PLAN.md) remains the full baseline reference. The docs below are the implementation-focused authorities for each domain.

## Read by task

| Document                                           | Use when                                                                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| [product-requirements.md](product-requirements.md) | Defining scope, requirement IDs, priorities, personas, or acceptance evidence.                                           |
| [business-rules.md](business-rules.md)             | Implementing purchases, production, orders, reservations, invoices, dispatches, payments, costing, or state transitions. |
| [data-model.md](data-model.md)                     | Designing Prisma models, migrations, constraints, indexes, decimal precision, or stock traceability.                     |
| [architecture.md](architecture.md)                 | Making stack, module, repository, API, reporting, or deployment decisions.                                               |
| [api-contract.md](api-contract.md)                 | Designing HTTP routes, request and response shapes, validation, idempotency, or errors.                                  |
| [authorization-matrix.md](authorization-matrix.md) | Adding roles, permissions, record-level checks, sessions, audit, or security controls.                                   |
| [offline-sync.md](offline-sync.md)                 | Working on the PWA cache, IndexedDB, queued orders, conflicts, or synchronization.                                       |
| [ui-ux-spec.md](ui-ux-spec.md)                     | Building role workspaces, responsive layouts, keyboard behavior, states, or Tamil UI.                                    |
| [benchmark.md](benchmark.md)                       | Seeding or testing the fixed CDI scenario and its exact expected values.                                                 |
| [testing.md](testing.md)                           | Adding unit, integration, E2E, edge-case, accessibility, or release verification.                                        |
| [milestones.md](milestones.md)                     | Planning implementation slices or determining a feature's exit gate.                                                     |
| [assumptions.md](assumptions.md)                   | Resolving missing dates, tax, valuation, packaging, or other source ambiguities.                                         |
| [reporting-audit.md](reporting-audit.md)           | Building reports, exports, ageing, drill-downs, audit logs, or report filters.                                           |
| [release-checklist.md](release-checklist.md)       | Preparing the demo, submission, independent setup, or final acceptance review.                                           |

## Change rules

- Update the relevant domain doc with code when behavior or a decision changes.
- Do not copy large sections between docs. Link to the owning document.
- The benchmark must preserve supplied values and distinguish them from proposed implementation choices.
- If a source ambiguity is resolved, update [assumptions.md](assumptions.md), then update the affected implementation doc.
