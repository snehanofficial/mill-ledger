# MillLedger SEO & GEO Audit

**Audit Date:** 2026-11-27
**Repository:** `/home/snehan/projects/web/mill-ledger`

## 1. Executive Audit Findings

1. **Brand & Product Entity Split (Fixed):** Prior to this implementation, `README.md`, `client/index.html`, `docs/`, and the authenticated ERP (`client/src/pages/*`) described **MillLedger** as an Order-to-Audit ERP software for small food manufacturing mills in India, while `client/src/pages/public/*` presented a fictional Madurai grain mill factory ("MillLedger Agro Processing Ltd.") with fabricated FSSAI, GSTIN, and ISO 22000 claims. All public pages have been unified around the actual MillLedger ERP software product.
2. **Client-Side Rendering Only (Fixed):** The Vite + React 19 SPA previously served an empty `<div id="root"></div>` for all routes. Build-time SSR prerendering (`client/src/entry-prerender.tsx` + `client/scripts/prerender.mjs`) now emits static HTML with full semantic content, unique `<title>`, `<meta name="description">`, `<link rel="canonical">`, Open Graph, Twitter Card, and JSON-LD for all 12 public routes.
3. **Hardcoded `.local` Domain & Incorrect Sitemap/Robots (Fixed):** `client/public/robots.txt` and `client/public/sitemap.xml` previously hardcoded `https://millledger.local/` and listed `/auth/login` in the sitemap. Build-time generation now uses `VITE_APP_URL`, excludes `/auth/login` and all private ERP/API routes, and separates search crawlers (`Googlebot`, `Bingbot`, `OAI-SearchBot`, `PerplexityBot`) from model-training crawlers (`GPTBot`).
4. **Fabricated JSON-LD Offer Price (Fixed):** `client/index.html` previously included `"offers": { "@type": "Offer", "price": "0", "priceCurrency": "INR" }`. Unverified pricing was removed.
5. **Non-Submitting Contact Form (Fixed):** `client/src/pages/public/contact-page.tsx` previously flipped local React state without calling any backend endpoint. It now submits to `POST /api/v1/public/inquiries` with Zod validation, rate limiting, and UTM/referrer attribution.
6. **Private Route & Fallback Protection (Hardened):** `client/dist/app-shell.html` defaults to `noindex, nofollow` for private/404 SPA fallbacks, `server/src/app.ts` sends `X-Robots-Tag: noindex, nofollow` on `/api/*` and non-public routes, and `NotFoundPage` sets `noindex, nofollow`.

---

## 2. Verified Product Capability Matrix

| Capability | Evidence in Implementation | User Problem Solved | Status | Relevant Route / API / Module | Verification Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Multi-UOM Inventory & Stock Ledger | `inventory.service.ts`, `stock-page.tsx`, `stock-ledger-page.tsx` | Eliminates silent stock overwrites; tracks kg, g, L, ml, pcs, packets, cartons | **Fully Implemented** | `/stock`, `/stock/:itemId/ledger`, `/api/v1/inventory/*` | Verified in `docs/MILLLEDGER_IMPLEMENTATION_TRACKER.md` (IMP-004, IMP-012) |
| Purchase Receipts & Moving Weighted Average | `purchases-page.tsx`, `new-purchase-page.tsx`, `inventory.service.ts` | Recalculates unit cost atomically on receipt; supports reversals & debit notes | **Fully Implemented** | `/purchases`, `/api/v1/purchase-receipts/*` | Verified in IMP-015 & benchmark (`₹43.125/kg`) |
| Versioned BOM & Production Costing | `production.service.ts`, `production-today-page.tsx`, `production-recipes-page.tsx` | Tracks planned vs. actual ingredients, yield/oil variance, direct costs, carton mismatch warnings | **Fully Implemented** | `/production/*`, `/api/v1/production-runs/*` | Verified in IMP-011, IMP-013 & benchmark (`₹5,855.00`, `-6%` yield) |
| Offline Field Salesman Order Capture | `client/src/offline/*` (Dexie IndexedDB), `new-order-page.tsx`, `device-outbox-sheet.tsx` | Captures orders in weak connectivity with Local/Syncing/Synced/Conflict states and idempotent replay | **Fully Implemented** | `/orders/new`, `/api/v1/orders` | Verified in IMP-025 (offline reload requires prod precache) |
| Strict ATP Stock Reservations & Order Review | `sales.service.ts`, `orders-page.tsx`, `order-detail-page.tsx` | Prevents double-selling; reserves ATP stock on approval; requires audit reason for qty/price overrides | **Fully Implemented** | `/orders`, `/api/v1/sales/orders/:id/approve` | Verified in IMP-002, IMP-003 |
| Indian GST Invoicing & Credit/Debit Notes | `finance.service.ts`, `invoice-pdf.util.ts`, `invoices-page.tsx` | Computes intra-state CGST/SGST and inter-state IGST with HSN snapshots, FY numbering, PDF download | **Fully Implemented** | `/invoices`, `/api/v1/finance/invoices/:id/pdf` | Verified in IMP-001, IMP-015 |
| Partial Dispatch & Sales Returns | `dispatch-page.tsx`, `new-dispatch-page.tsx`, `sales.service.ts` | Deducts physical stock at dispatch; restores stock on returns without over-return | **Fully Implemented** | `/dispatch`, `/api/v1/sales/dispatches`, `/returns` | Verified in IMP-014 |
| FIFO Payment Allocation & Bounce Reversal | `payment.service.ts`, `payments-page.tsx`, `receivables-page.tsx` | Allocates receipts FIFO or manually; handles unallocated advances and cheque bounces | **Fully Implemented** | `/payments`, `/receivables`, `/api/v1/payments/*` | Verified in IMP-008, IMP-018 |
| 9-Tab Reporting, CSV/XLSX/PDF Exports & 360° Timeline | `reporting.service.ts`, `reports-page.tsx`, `exports-page.tsx`, `timeline.routes.ts` | Provides Sales, GST, Stock, Production, Receivables, and Audit reports with drill-down | **Fully Implemented** | `/reports/*`, `/exports`, `/api/v1/reports/*`, `/api/v1/timeline/*` | Verified in IMP-005, IMP-006, IMP-019, IMP-020 |
| RBAC & ABAC Across 5 Roles + Tamil UI | `role-routing.ts`, `auth.ts`, `i18n.tsx`, `settings-page.tsx` | Enforces Owner, Admin, Production, Salesman, Accountant boundaries; bilingual EN/TA UI | **Fully Implemented** | `/settings`, `/api/v1/users` | Verified in IMP-017 & `abac.test.ts` |
| Customer-Specific Price Lists | `PriceList` schema exists without customer FK | Automatic per-customer price list resolution | **Planned (P2)** | `IMP-022` | Not implemented; excluded from public claims |
| Batch/Expiry FEFO, Reorder Levels, Tally XML, e-Invoice IRN | Listed as stretch goals in `docs/product-requirements.md` | Automated lot expiry, reorder alerts, Tally/GSTN push | **Planned (P2)** | `IMP-023` | Explicitly listed as out-of-scope on `/features` |
| Customer Credit Limit Enforcement | Parked pending owner policy decision | Hard-block vs. manager override on credit limits | **Blocked (P3)** | `IMP-024` | Excluded from public claims |
