# Assumptions and Open Decisions

## Fixed benchmark assumptions

- Use weighted average for inventory valuation.
- Use a configurable benchmark date and financial-year setup; the source gives no dates.
- Use clearly marked dummy customer/supplier GST, HSN, addresses, and due/payment data.
- The exercise's 5% GST is configurable and not hardcoded as a universal rule.
- Preserve 9 cartons and show the 8-packet carton-capacity mismatch warning.
- Record 6 damaged pouches separately and include them in total pouch consumption.
- Do not invent opening finished-goods cost.
- Keep Distributor B pending/shortage rather than invoicing or dispatching unavailable stock.

## Open inputs

These require confirmation before real production use:

- Whether 9 cartons is the final physical packaging interpretation or 10 cartons should be used.
- Real customer and supplier identities, GSTINs, HSN codes, addresses, invoice dates, and payment terms.
- Applicable GST rules and tax rates for the real product and place of supply.
- Whether opening finished-goods stock has a known valuation.
- Production deadline and release dates.

## Design decisions

- Partial approval/dispatch and returns remain supported even where benchmark behavior is full dispatch.
- Stock reservation is separate from physical stock movement.
- Posted documents are corrected through reversals/credit notes.
- PWA offline orders do not reserve stock or promise server acceptance.
- PostgreSQL RLS is optional defence in depth, not a substitute for application authorization.
- Background Sync is optional; app launch, online event, and manual retry are primary.
- A single-order sync route is sufficient initially.

## Update rule

When an open input is answered or an explicit design decision changes, update this document and every affected rule/model/API/UI/test document. Do not silently change benchmark inputs.
