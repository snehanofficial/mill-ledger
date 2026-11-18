# Release and Submission Checklist

## Product and benchmark

- [x] Five roles and workspaces exist.
- [x] 60 kg flour purchase posts once.
- [x] Production run records all benchmark materials, damage, output, cartons, and costs.
- [x] Yield -6% and oil +5% are flagged.
- [x] All benchmark stock closing balances pass.
- [x] Retailer A order, invoice, dispatch, and payment pass.
- [x] ₹4,000 payment leaves ₹3,875 outstanding.
- [x] Distributor B shortage is 32 packets.
- [x] Cost per good packet is approximately ₹31.14 under documented weighted average.
- [x] Reports and exports reconcile.

## Engineering

- [x] No direct stock balance overwrite exists.
- [x] All movements have source documents.
- [x] Concurrent reservations and duplicate posts are safe.
- [x] Posted invoices and production runs cannot be silently edited or deleted.
- [x] Decimal arithmetic is used.
- [x] Role and record authorization tests pass.
- [x] Offline sync is idempotent with retry and conflict behavior.
- [x] Private session/API data is not cached indiscriminately.
- [x] Logs and request IDs do not expose secrets or unnecessary customer data.
- [x] Backup and restoration are tested.

## UX and accessibility

- [x] Salesman flow works one handed on a small phone.
- [x] Production numeric fields and units work on a tablet.
- [x] Admin and auditor workflows support keyboard operation.
- [x] 320 px reflow and text resizing pass.
- [x] Focus, labels, contrast, target size, status announcements, and dialogs pass review.
- [x] Loading, empty, error, stale, offline, and conflict states are present.

## Submission

- [x] Public repository with meaningful commit history.
- [x] README has setup, stack, assumptions, known gaps, and benchmark evidence.
- [x] Design note is no more than two pages.
- [x] Demo video recording instructions documented.
- [x] Hosted demo or one command local run is available.
- [x] Test login exists for each role.
- [x] No real customer or company data is included.
- [x] No unexplained benchmark discrepancy remains.
