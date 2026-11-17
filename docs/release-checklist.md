# Release and Submission Checklist

## Product and benchmark

- [ ] Five roles and workspaces exist.
- [ ] 60 kg flour purchase posts once.
- [ ] Production run records all benchmark materials, damage, output, cartons, and costs.
- [ ] Yield -6% and oil +5% are flagged.
- [ ] All benchmark stock closing balances pass.
- [ ] Retailer A order, invoice, dispatch, and payment pass.
- [ ] ₹4,000 payment leaves ₹3,875 outstanding.
- [ ] Distributor B shortage is 32 packets.
- [ ] Cost per good packet is approximately ₹31.14 under documented weighted average.
- [ ] Reports and exports reconcile.

## Engineering

- [ ] No direct stock-balance overwrite exists.
- [ ] All movements have source documents.
- [ ] Concurrent reservations and duplicate posts are safe.
- [ ] Posted invoices and production runs cannot be silently edited or deleted.
- [ ] Decimal arithmetic is used.
- [ ] Role and record authorization tests pass.
- [ ] Offline sync is idempotent with retry and conflict behavior.
- [ ] Private session/API data is not cached indiscriminately.
- [ ] Logs and request IDs do not expose secrets or unnecessary customer data.
- [ ] Backup and restoration are tested.

## UX and accessibility

- [ ] Salesman flow works one-handed on a small phone.
- [ ] Production numeric fields and units work on a tablet.
- [ ] Admin and auditor workflows support keyboard operation.
- [ ] 320 px reflow and text resizing pass.
- [ ] Focus, labels, contrast, target size, status announcements, and dialogs pass review.
- [ ] Loading, empty, error, stale, offline, and conflict states are present.

## Submission

- [ ] Public repository with meaningful commit history.
- [ ] README has setup, stack, assumptions, known gaps, and benchmark evidence.
- [ ] Design note is no more than two pages.
- [ ] Demo video is no more than eight minutes.
- [ ] Hosted demo or one-command local run is available.
- [ ] Test login exists for each role.
- [ ] No real customer or company data is included.
- [ ] No unexplained benchmark discrepancy remains.
