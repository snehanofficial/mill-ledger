# Testing Strategy

## Test layers

### Unit tests

- Decimal arithmetic and rounding
- Unit conversion and incompatible-dimension rejection
- BOM planning and yield calculations
- Variance formulas and tolerance boundaries
- Weighted-average valuation
- GST tax calculation
- Invoice numbering formatting
- Payment allocation and outstanding
- State transitions
- RBAC/ABAC policy decisions

### Integration tests

- Prisma/PostgreSQL rollback
- Stock movement/projection reconciliation
- Atomic production posting
- Concurrent stock reservations
- Invoice/dispatch sequencing
- Idempotency replay
- Audit coverage
- Report source reconciliation

### End-to-end tests

- Salesman online and offline order flows
- Offline reload and reconnect exactly-once sync
- Admin review and shortage behavior
- Production benchmark run
- Invoice PDF and dispatch
- Payment allocation
- Accountant export and drill-down
- Owner dashboard
- Role-denial paths
- Phone, tablet, and desktop layouts

## Edge cases

1. Two approvals/reservations contend for the final stock.
2. Two admins approve the same order.
3. The server commits but the HTTP response is lost.
4. Production posts after movement writes but audit fails.
5. Raw materials exist but packaging is short.
6. A draft run outlives a BOM change.
7. Price changes while an offline order is queued.
8. Customer assignment is revoked while offline.
9. Posted invoice requires correction.
10. Partial payment spans multiple invoices.
11. Invoice has credit note and partial payment.
12. A return is damaged and must not re-enter saleable stock.
13. Simultaneous movements share a report cutoff timestamp.
14. Browser storage is unavailable or full.
15. Logout with unsynchronized orders.
16. PWA update during order entry.
17. Auditor invokes a write endpoint directly.
18. Salesman requests another salesperson's order.
19. A PDF URL is guessed or used after permission revocation.
20. Conversion crosses incompatible dimensions.

## Benchmark verification

The benchmark fixture is an executable acceptance test, not a bypass mode. It must use normal seed/domain services and assert all values in [benchmark.md](benchmark.md).

Before completion, run the most focused relevant test first, then lint, typecheck, build, and end-to-end tests as the changed slice warrants.
