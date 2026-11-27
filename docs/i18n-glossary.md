# MillLedger Bilingual Terminology Glossary (`en-IN` / `ta-IN`)

This glossary is the single source of truth for Tamil (`ta-IN`) and English (`en-IN`) terminology across all MillLedger UI screens, validation messages, API errors, and exported documents (PDF, Excel, CSV, Print).

## Core Domain Terms

| English (`en-IN`) | Tamil (`ta-IN`) | Notes / Context |
|---|---|---|
| Orders / Sales Orders | விற்பனை ஆணைகள் | Order management & booking |
| Order | ஆணை | Singular |
| Customers | வாடிக்கையாளர்கள் | B2B / retail buyers |
| Suppliers | வழங்குநர்கள் | Raw material / mandi vendors |
| Inventory / Stock | சரக்கு இருப்பு | Stock balances & movements |
| Inventory Management | சரக்கு மேலாண்மை | Section header |
| Raw Materials | மூலப்பொருட்கள் | Flour, oil, salt, spices |
| Packaging | பேக்கிங் பொருட்கள் | Pouches, cartons |
| Finished Goods | முடிக்கப்பட்ட பொருட்கள் | Packaged saleable goods |
| Production | உற்பத்தி | Manufacturing runs & batches |
| Production Run | உற்பத்திப் பதிவு | Single batch execution |
| Batch | தொகுதி | Batch number / lot |
| Recipe / BOM | செய்முறை (BOM) | Bill of Materials |
| Purchase | கொள்முதல் | Raw material procurement |
| Purchase Receipt | கொள்முதல் ரசீது | GRN / mandi intake |
| Sales | விற்பனை | Outward sales |
| Invoice | விலைப்பட்டியல் | GST Tax Invoice |
| Dispatch | விநியோகம் | Physical delivery & stock release |
| Payment | பணப் பரிவர்த்தனை | Receipts & collections |
| Outstanding | நிலுவைத் தொகை | Unpaid balance |
| Receivables | வரவு நிலுவைகள் | Customer receivables |
| Payables | செலுத்த வேண்டியவை | Supplier payables |
| Quantity | அளவு | Numeric quantity |
| Unit / UOM | அலகு | kg, L, Packets, Cartons |
| Warehouse | கிடங்கு | Storage warehouse |
| Facility | ஆலை வளாகம் | Mill facility |
| Audit Trail / Audit Log | தணிக்கைப் பதிவு | Immutable audit log |
| Reports | அறிக்கைகள் | Financial & operational reports |
| Exports | ஏற்றுமதிகள் | PDF / Excel / CSV exports |
| Settings | அமைப்புகள் | Organization & user settings |
| Dashboard / Overview | முகப்பு | Executive overview |

## Accounting, Tax & Costing Terms

| English (`en-IN`) | Tamil (`ta-IN`) | Notes / Context |
|---|---|---|
| Taxable Amount | வரிக்குரிய தொகை | Pre-tax amount |
| GST | ஜி.எஸ்.டி | Goods and Services Tax |
| CGST | சி.ஜி.எஸ்.டி | Central GST |
| SGST | எஸ்.ஜி.எஸ்.டி | State GST |
| IGST | ஐ.ஜி.எஸ்.டி | Integrated GST |
| Place of Supply | விநியோக இடம் | GST delivery state |
| HSN Code | எச்.எஸ்.என் குறியீடு | Harmonized System code |
| GSTIN | ஜி.எஸ்.டி.ஐ.என் | 15-char GST ID |
| Financial Year (FY) | நிதியாண்டு | April 1 – March 31 (IST) |
| Weighted Average Cost (WAC) | சராசரி அடக்க விலை | Moving average unit cost |
| Yield Variance | மகசூல் மாறுபாடு | Expected vs actual output |
| Available to Promise (ATP) | விற்பனைக்குத் தயார் இருப்பு | Physical minus reserved |
| Reserved | முன்பதிவு | Allocated to approved orders |
| Shortage | பற்றாக்குறை | Insufficient stock |
| Unallocated | ஒதுக்கப்படாத தொகை | Advance / unapplied payment |

## Status & Workflow Terms

| Backend Enum | English (`en-IN`) | Tamil (`ta-IN`) |
|---|---|---|
| `DRAFT` | Draft | வரைவு |
| `SUBMITTED` | Submitted | சமர்ப்பிக்கப்பட்டது |
| `APPROVED` | Approved | ஒப்புதல் அளிக்கப்பட்டது |
| `REJECTED` | Rejected | நிராகரிக்கப்பட்டது |
| `DISPATCHED` | Dispatched | அனுப்பப்பட்டது |
| `INVOICED` | Invoiced | விலைப்பட்டியல் இடப்பட்டது |
| `CANCELLED` | Cancelled | ரத்து செய்யப்பட்டது |
| `POSTED` | Posted | பதிவு செய்யப்பட்டது |
| `REVERSED` | Reversed | ரத்து செய்யப்பட்டது |
| `PENDING` | Pending | நிலுவையில் |
| `PARTIALLY_PAID` | Partially Paid | பகுதி செலுத்தப்பட்டது |
| `PAID` | Paid | செலுத்தப்பட்டது |
| `OVERDUE` | Overdue | தவணை கடந்தது |
| `COMPLETED` | Completed | நிறைவடைந்தது |
| `IN_PROGRESS` | In Progress | செயல்பாட்டில் |
| `ACTIVE` | Active | செயலில் உள்ளது |
| `INACTIVE` | Inactive | செயலிழக்கப்பட்டது |
| `IN_STOCK` | In Stock | இருப்பில் உள்ளது |
| `LOW_STOCK` | Low Stock | குறைந்த இருப்பு |
| `OUT_OF_STOCK` | Out of Stock | இருப்பில்லை |

## Formatting Rules

- **Numerals**: Retain Latin digits (`0-9`) in both `en-IN` and `ta-IN` for all accounting, invoice, quantity, phone, and reference numbers (`en-IN` / `ta-IN-u-nu-latn`).
- **Grouping**: Indian numbering system (Lakhs, Crores: `1,00,000.00`).
- **Currency**: INR (`₹`) in both languages.
- **Calendar & Timezone**: Gregorian calendar in `Asia/Kolkata` (IST).
