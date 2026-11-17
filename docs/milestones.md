# Implementation Milestones

No calendar is inferred because the source supplied no confirmed release date.

## M0: Scope and benchmark contract

Freeze requirement IDs, benchmark seed, assumptions, valuation, stock reservation, and partial fulfilment. Exit when no ambiguity is hidden in code.

## M1: Platform and identity

Create pnpm workspace, strict TypeScript, React/Vite shell, Express API, PostgreSQL/Prisma, Better Auth, five roles, central policies, audit foundation, and test users.

Exit: login and 401/403 behavior work; cross-salesman and auditor-write tests pass.

## M2: Masters and versioning

Add customers, suppliers, products, variants, UOM/conversions, price lists, tax configuration, recipes/BOM, opening stock, and benchmark seed.

Exit: benchmark master data loads with one repeatable seed command and old prices/document snapshots remain stable.

## M3: Purchases and inventory ledger

Add purchase receipts, opening balance, stock documents, movements, projections, weighted-average valuation, reconciliation, and stock screens.

Exit: purchase of 60 kg flour updates 100 kg opening to 160 kg and the ledger reconciles.

## M4: Production

Add draft/posted run, captured BOM, actual material and packaging, good/rejected output, damage, variances, direct costs, atomic posting, and reversal.

Exit: benchmark production assertions and rollback tests pass.

## M5: Orders and reservations

Add salesman mobile order, own-order view, admin inbox/review, shortages, approval/rejection, price/quantity changes, and atomic reservations.

Exit: 150-packet approval reserves stock and 120-packet distributor order shows shortage as stock changes.

## M6: Invoice and dispatch

Add tax calculation, FY numbering, immutable invoice snapshot/PDF, dispatch, reservation release, stock movement, and credit-note correction.

Exit: ₹7,875 Retailer A invoice and 238 to 88 dispatch pass.

## M7: Payments and costing

Add payment allocations, customer ledger/ageing, weighted-average run cost, labour/gas/power, and cost per good packet.

Exit: ₹4,000 payment leaves ₹3,875 outstanding and run cost is ₹5,855.

## M8: Reports and audit

Add sales, GST, purchase, stock, production, collection, receivable, audit, owner dashboard, and exports.

Exit: report totals reconcile to source records and exports match filters/totals.

## M9: Offline synchronization

Complete Workbox/Dexie cache, durable outbox, idempotent sync, conflict UI, retries, and logout/account switching.

Exit: reload/reconnect produces exactly one server order with no fake submitted/reserved state.

## M10: UX and accessibility

Complete responsive role workspaces, keyboard behavior, Tamil where included, all operational states, accessibility, and realistic performance checks.

Exit: core journeys pass moderated usability and accessibility review.

## M11: Release and submission

Add fresh seed/demo run, README, design note, demo video, hosted demo or local command, role logins, backup restore, and final benchmark evidence.

Exit: an independent evaluator can run the benchmark from the repository.

## M12+: Differentiation

Consider lots/FEFO, reorder alerts, planning, QR, quality gates, batch genealogy, Tamil, Tally export, and compliance connectors only after M11 is stable.
