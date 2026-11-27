# MillLedger Demo Foods — Pitch Walkthrough & Presenter Script

This walkthrough uses the isolated **MillLedger Demo Foods** (`DEMO-FOODS`) demonstration dataset.

## Demo Login Credentials

| Role | Email | Password | Best Used For |
|---|---|---|---|
| Admin | `demo.admin@millledger.example` | `DemoAdmin123!` | Full walkthrough (recommended) |
| Owner | `demo.owner@millledger.example` | `DemoOwner123!` | Executive dashboard & approvals |
| Salesman | `demo.salesman@millledger.example` | `DemoSalesman123!` | Field order entry & assigned accounts |
| Production | `demo.production@millledger.example` | `DemoProduction123!` | Recipes, BOMs & production runs |
| Accountant | `demo.accountant@millledger.example` | `DemoAccountant123!` | GST invoices, payments & exports |

---

## 1. Opening — Executive Dashboard (`/dashboard`)

1. Sign in as `demo.admin@millledger.example`.
2. On `/dashboard`, highlight the connected operational metrics for **MillLedger Demo Foods**:
   - **Total Invoiced**: ₹78,128.00 across 4 posted GST invoices.
   - **Total Collected**: ₹70,730.00 across 6 customer receipts (including ₹5,000.00 unallocated advance).
   - **Outstanding Receivables**: ₹12,398.00 (`INV-2026-27-0002` ₹7,752.00 + `INV-2026-27-0004` ₹4,646.00).
   - **Active Orders**: 5 orders spanning `SUBMITTED`, `APPROVED` (unfulfilled), and `APPROVED` (`FULFILLED`).

---

## 2. Products & Recipes (`/products` & `/production/recipes`)

1. Navigate to **Products** (`/products`).
   - Show the 5 finished products:
     - **Sprouted Ragi Health Mix** (`DEMO-PRD-RAGI`, HSN `19041090`, 5% GST) — variant `DEMO-VAR-RAGI-500G` (₹150/pkt, revised from ₹140/pkt).
     - **Millet Flour** (`DEMO-PRD-MILLET`, HSN `11029090`, 5% GST) — variant `DEMO-VAR-MILLET-1KG` (₹110/pkt).
     - **Traditional Idli Mix** (`DEMO-PRD-IDLI`, HSN `19041090`, 5% GST) — variant `DEMO-VAR-IDLI-500G` (₹95/pkt).
     - **Multigrain Cookies** (`DEMO-PRD-COOKIES`, HSN `19053100`, 18% GST) — variant `DEMO-VAR-COOKIES-200G` (₹120/pkt).
     - **Spiced Ready-Mix** (`DEMO-PRD-SPICED`, HSN `21069099`, 12% GST) — variant `DEMO-VAR-SPICED-250G` (₹85/pkt).
2. Click **Sprouted Ragi Health Mix** to open its detail page (`/products/:id`).
   - Point out the **Unified Timeline**: shows product creation, name update (`Ragi Health Mix` -> `Sprouted Ragi Health Mix`), and price revision (₹140.00 -> ₹150.00).
3. Navigate to **Recipes & BOMs** (`/production/recipes`).
   - Show **Sprouted Ragi Health Mix 500g BOM** `v1` (expected output 100 pkts) and its cloned revision `v2` (**Optimized Roast**, expected output 105 pkts).
   - Open `v2` (`/production/recipes/:id`) to show ingredient/packaging BOM lines and the preserved `v1` -> `v2` revision history alongside `DEMO-RUN-002` (2 batches -> 210 good packets).

---

## 3. Customer Relationship (`/customers`)

1. Navigate to **Customers** (`/customers`).
   - Show the 3 fictional B2B accounts:
     - **Green Basket Retailers** (`DEMO-CUST-GBR`, Tamil Nadu — Intra-state CGST + SGST)
     - **Sri Annapoorna Foods** (`DEMO-CUST-SAF`, Tamil Nadu — Intra-state CGST + SGST)
     - **Kaveri Wholesale Mart** (`DEMO-CUST-KWM`, Karnataka — Inter-state IGST)
2. Click **View** on **Green Basket Retailers** and open its full account page (`/customers/:id`).
   - Highlight the customer's profile update event, 2 orders (`DEMO-SO-001`, `DEMO-SO-002`), 2 invoices (`INV-2026-27-0001`, `INV-2026-27-0002`), and 4 payments (`REC-2026-0001` through `REC-2026-0004`).

---

## 4. Primary End-to-End Order Lifecycle (`/orders`)

1. Navigate to **Order inbox** (`/orders`) and open **`DEMO-SO-001`** (Green Basket Retailers).
2. Walk through the order details:
   - Lines: `100 × Sprouted Ragi Health Mix 500g @ ₹150.00` + `80 × Traditional Idli Mix 500g @ ₹95.00`.
   - Taxable Value: **₹22,600.00** | CGST (2.5%): **₹565.00** | SGST (2.5%): **₹565.00** | Grand Total: **₹23,730.00**.
   - Status: **APPROVED** | Fulfilment: **FULFILLED** (dispatched on `TN-37-DEMO-101`).
3. Contrast with **`DEMO-SO-004`** (Approved & Invoiced, `UNFULFILLED` — stock reserved awaiting pickup) and **`DEMO-SO-005`** (`SUBMITTED` — awaiting review).

---

## 5. GST Invoice & Commercial Settlement (`/invoices` & `/payments`)

1. From `DEMO-SO-001`, click through to **`INV-2026-27-0001`** (`/invoices/:id`).
   - Total: **₹23,730.00** | Paid: **₹23,730.00** | Outstanding: **₹0.00** (`PAID`).
2. Navigate to **Payments** (`/payments`) and show how `INV-2026-27-0001` was settled in two tranches:
   - **`REC-2026-0001`**: ₹10,000.00 (`UPI`, ref `UPI-DEMO-2026-001`)
   - **`REC-2026-0002`**: ₹13,730.00 (`BANK_TRANSFER`, ref `NEFT-DEMO-2026-002`)
3. Highlight two additional real-world payment patterns:
   - **Multi-invoice allocation**: **`REC-2026-0005`** (₹28,000.00 RTGS from Kaveri Wholesale Mart) settles **`INV-2026-27-0003`** (₹24,150.00 -> `PAID`) and partially pays **`INV-2026-27-0004`** (₹3,850.00 -> `PARTIALLY_PAID`, ₹4,646.00 remaining).
   - **Unallocated advance**: **`REC-2026-0006`** (₹5,000.00 UPI from Sri Annapoorna Foods, ₹5,000.00 unallocated).

---

## 6. Unified Contextual Timeline

1. Return to **`DEMO-SO-001`** (`/orders/:id`) and inspect its **Unified Timeline**.
   - Even though invoicing, dispatch, and payments happened in separate modules, the order's timeline shows the complete connected story: Draft Created -> Updated & Submitted -> Approved & Stock Reserved -> Invoice `INV-2026-27-0001` Issued -> Dispatched -> Payment `REC-2026-0001` (₹10,000) -> Payment `REC-2026-0002` (₹13,730, Settled).

---

## 7. Exports (PDF, Excel, CSV)

1. Navigate to **Exports** (`/exports`) or trigger directly from the list/detail pages:
   - **Invoice Register PDF**: `/api/v1/exports/invoices?format=pdf`
   - **Invoice Register Excel**: `/api/v1/exports/invoices?format=xlsx`
   - **Invoice Register CSV**: `/api/v1/exports/invoices?format=csv`
   - **Single Order PDF**: `/api/v1/exports/orders/:id/pdf`
   - **Single Tax Invoice PDF**: `/api/v1/finance/invoices/:id/pdf`
   - **Payment Receipt PDF**: `/api/v1/exports/payments/:id/pdf`

---

## Reset & Reseed Commands

```bash
# Seed or idempotently verify MillLedger Demo Foods
pnpm demo:seed

# Verify referential integrity, financial reconciliation & timelines
pnpm demo:verify

# Reset ONLY DEMO-FOODS (never touches MILL or other tenants)
pnpm demo:reset
```
