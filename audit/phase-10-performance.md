# Phase 10 Audit Report: Web Performance, Bundle Architecture, Media & Database Scale

- **Audit Date**: 2026-11-19
- **Auditor**: Principal Accessibility Specialist, Performance Engineer & Systems Auditor
- **Target Standards & Specifications**:
  - Google Core Web Vitals: Largest Contentful Paint (LCP < 2.5s), Cumulative Layout Shift (CLS < 0.1), Interaction to Next Paint (INP < 200ms)
  - RFC 9110 HTTP Semantics & RFC 9113 HTTP/2
  - W3C Resource Timing, Navigation Timing, and Service Worker Level 1
  - PostgreSQL Query Execution & Indexing Standards
  - OWASP Top 10:2021 A04:2021 (Insecure Design - Resource Consumption) & API Security Top 10:2023 API4:2023 (Unrestricted Resource Consumption)
  - MillLedger Expected Behavior Specification (`audit/01-expected-spec.md` REQ-055, REQ-056, REQ-057, REQ-064)
- **Evaluation Environment**:
  - Operating System: Linux x86_64 (6.6.137+ kernel)
  - Runtime: Node.js v22.22.1 / PostgreSQL 16 (Local throwaway database `mill_ledger_audit_throwaway`)
  - Server Mode: Production build served as in production with compression active (`audit/scripts/serve-production.js` on port 4173, backend Express API on port 4000)
  - Seeded Scale Baseline: **100,007 Stock Movements**, **10,011 Sales Orders**, **10,011 Order Lines**, **5,006 Sales Invoices**, **5,006 Invoice Lines**
  - Throttling Profile: Standard Mobile Profile, 4x CPU Slowdown, Slow 4G Network (150ms RTT, 1,638.4 Kbps down / 750 Kbps up)
- **Saved Evidence Artifacts**:
  - Bundle Treemap Visualization: [`audit/evidence/performance/bundle-treemap.html`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/bundle-treemap.html)
  - Bundle JSON Statistics: [`audit/evidence/performance/bundle-stats.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/bundle-stats.json)
  - Lighthouse CI JSON Reports:
    - Login (`/auth/login`): [`audit/evidence/performance/lighthouse/login.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/lighthouse/login.json)
    - Dashboard (`/dashboard`): [`audit/evidence/performance/lighthouse/dashboard.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/lighthouse/dashboard.json)
    - Order Capture (`/orders`): [`audit/evidence/performance/lighthouse/orders.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/lighthouse/orders.json)
    - Reports (`/reports/sales`): [`audit/evidence/performance/lighthouse/reports.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/lighthouse/reports.json)
  - EXPLAIN (ANALYZE, BUFFERS) Reports:
    - Raw Plan JSON: [`audit/evidence/performance/explain/top-20-queries-explain.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/explain/top-20-queries-explain.json)
    - Plan Table Markdown: [`audit/evidence/performance/explain/top-20-queries-explain.md`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/explain/top-20-queries-explain.md)
  - Load Test JSON Reports (50 concurrent users):
    - Health API: [`audit/evidence/performance/load-test/health.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/load-test/health.json)
    - Customers API: [`audit/evidence/performance/load-test/customers.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/load-test/customers.json)
    - Sales Reports API: [`audit/evidence/performance/load-test/reports-sales.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/load-test/reports-sales.json)
  - Playwright Network & Waterfall Proofs:
    - Lazy Loading & Prefetch: [`audit/evidence/performance/waterfalls/route-waterfall-lazy-loading.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/waterfalls/route-waterfall-lazy-loading.json)
    - Image Audit & Scroll Test: [`audit/evidence/performance/images-audit.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/images-audit.json)
    - TanStack Query Cache Dedupe: [`audit/evidence/performance/tanstack-query-cache-dedupe.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/tanstack-query-cache-dedupe.json)

---

## 1. Executive Summary

Phase 10 conducted an unsparing, empirical performance audit of MillLedger across all tiers: client bundle composition, Lighthouse Core Web Vitals, browser network waterfalls, media handling, database query planning under enterprise scale, and server stability under concurrency.

### Key Audit Findings:
1. **Critical P0 Backend Crash under Concurrency (F-070)**: Under 50 concurrent users requesting `/api/v1/sales/orders` on a realistic 10,000-order database, the Node.js backend suffered **Fatal V8 Heap Out of Memory (OOM, exit code 134)** and terminated. Root cause: An unpaginated database fetch coupled with an in-memory nested `for` loop executing `await this.getAvailableStock(...)` for every line of every order (**20,001 SQL queries** per request).
2. **Missing Database Indexes & Sequential Scans (F-071)**: Running `EXPLAIN (ANALYZE, BUFFERS)` across the top 20 production queries revealed that **11 of 20 queries trigger full `Seq Scan`**. The foreign key `sales_order_line.salesOrderId` is completely unindexed, scanning all 10,000 order lines every time an order detail is viewed. Similarly, `stock_movement` queries on 100,000 rows degrade to 37.6ms sequential scans.
3. **Initial JavaScript Bundle Over Budget by +51.5% (F-072)**: The initial page load scripts total **823.79 KB uncompressed (257.54 KB gzipped)**, failing the 170 KB gzip budget. The entire Dexie IndexedDB library (197.7 KB raw) is eagerly bundled into the entry chunk alongside redundant dual HTTP clients (`axios` and `@better-fetch/fetch`).
4. **Mobile 4G LCP Violations on Authenticated Routes (F-073)**: While unauthenticated login passes at 1.1s, all three authenticated routes fail the 2.5s LCP budget under standard mobile throttling (Dashboard: **3.39s**, Orders: **3.95s**, Reports: **3.53s**).
5. **Absence of Server Pagination & Virtualization (F-074)**: 100% of core operational list endpoints (`orders`, `invoices`, `customers`, `stock`) lack pagination limits. A single request to `/orders` returns a **21.3 MB JSON payload**, and frontend tables render thousands of unvirtualized DOM nodes.
6. **Total Absence of Product Image Pipeline (F-075)**: No image upload pipeline, no WebP/AVIF variants, no EXIF stripping, and no ThumbHash/BlurHash placeholders exist in the codebase.
7. **Offline Stale Price Risk (F-077)**: `createSalesOrder` blindly accepts `line.unitPrice` submitted by offline clients without validating against active server price lists.

---

## 2. Performance Budgets Table: Target vs Actual vs Delta

All metrics measured against the production build served with compression on (`http://127.0.0.1:4173`), throttled to standard Mobile Profile (4x CPU slowdown, slow 4G network: 150ms latency, 1.6 Mbps download).

| Route | Metric | Target Budget | Actual Measured | Delta | Status | Evidence Link |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **All Routes** | Initial JS (Gzip) | < 170 KB | **257.54 KB** | **+87.54 KB (+51.5%)** | **VERIFIED-FAIL** | [`bundle-stats.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/bundle-stats.json) |
| **Login** (`/auth/login`) | LCP | < 2.5 s | **1.10 s** | -1.40 s (Within budget) | **VERIFIED-PASS** | [`login.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/lighthouse/login.json) |
| | CLS | < 0.1 | **0.0002** | -0.0998 | **VERIFIED-PASS** | [`login.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/lighthouse/login.json) |
| | INP (TBT Proxy) | < 200 ms | **2 ms** | -198 ms | **VERIFIED-PASS** | [`login.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/lighthouse/login.json) |
| | TTFB | < 800 ms | **7 ms** | -793 ms | **VERIFIED-PASS** | [`login.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/lighthouse/login.json) |
| **Dashboard** (`/dashboard`) | LCP | < 2.5 s | **3.39 s** | **+0.89 s (+35.6%)** | **VERIFIED-FAIL** | [`dashboard.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/lighthouse/dashboard.json) |
| | CLS | < 0.1 | **0.0041** | -0.0959 | **VERIFIED-PASS** | [`dashboard.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/lighthouse/dashboard.json) |
| | INP (TBT Proxy) | < 200 ms | **118 ms** | -82 ms | **VERIFIED-PASS** | [`dashboard.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/lighthouse/dashboard.json) |
| | TTFB | < 800 ms | **3 ms** | -797 ms | **VERIFIED-PASS** | [`dashboard.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/lighthouse/dashboard.json) |
| **Order Capture** (`/orders`) | LCP | < 2.5 s | **3.95 s** | **+1.45 s (+58.0%)** | **VERIFIED-FAIL** | [`orders.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/lighthouse/orders.json) |
| | CLS | < 0.1 | **0.0000** | -0.1000 | **VERIFIED-PASS** | [`orders.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/lighthouse/orders.json) |
| | INP (TBT Proxy) | < 200 ms | **169 ms** | -31 ms | **VERIFIED-PASS** | [`orders.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/lighthouse/orders.json) |
| | TTFB | < 800 ms | **7 ms** | -793 ms | **VERIFIED-PASS** | [`orders.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/lighthouse/orders.json) |
| **Reports** (`/reports/sales`) | LCP | < 2.5 s | **3.53 s** | **+1.03 s (+41.2%)** | **VERIFIED-FAIL** | [`reports.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/lighthouse/reports.json) |
| | CLS | < 0.1 | **0.0192** | -0.0808 | **VERIFIED-PASS** | [`reports.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/lighthouse/reports.json) |
| | INP (TBT Proxy) | < 200 ms | **103 ms** | -97 ms | **VERIFIED-PASS** | [`reports.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/lighthouse/reports.json) |
| | TTFB | < 800 ms | **3 ms** | -797 ms | **VERIFIED-PASS** | [`reports.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/lighthouse/reports.json) |

---

## 3. Bundle Analysis & Module Inventory

The client production bundle was audited via `vite-bundle-visualizer` (generating raw JSON data and interactive treemap in `audit/evidence/performance/`).

### Top 15 Modules by Rendered Size

| Rank | Module Path | Belonging Chunk | Raw Size | Rendered KB | Notes / Purpose |
| :---: | :--- | :--- | :---: | :---: | :--- |
| **1** | `react-dom-client.production.js` | `vendor-react` | 529,588 B | **517.2 KB** | React 19 DOM reconciliation runtime |
| **2** | `chunk-6KYCQHYJ.mjs` (React Router) | `vendor-react` | 210,063 B | **205.1 KB** | React Router v7 DOM navigation engine |
| **3** | `dist/dexie.js` | `index-*.js` (Entry) | 202,459 B | **197.7 KB** | IndexedDB client (eagerly bundled into main chunk) |
| **4** | `tailwind-merge/dist/bundle-mjs.mjs` | `index-*.js` (Entry) | 56,775 B | **55.4 KB** | Class name collision resolution utility |
| **5** | `vaul/dist/index.mjs` | `vendor-ui` | 54,777 B | **53.5 KB** | Mobile drawer sheet primitive |
| **6** | `sonner/dist/index.mjs` | `index-*.js` (Entry) | 53,466 B | **52.2 KB** | Toast notification manager |
| **7** | `src/pages/payments-page.tsx` | `payments-page` | 40,925 B | **40.0 KB** | Payments list and allocation modal code |
| **8** | `@radix-ui/react-select/dist/index.mjs` | `vendor-ui` | 40,878 B | **39.9 KB** | Accessible dropdown select primitive |
| **9** | `src/pages/orders-page.tsx` | `orders-page` | 39,902 B | **39.0 KB** | Sales orders table and shortage calculation |
| **10** | `src/components/shell/authenticated-shell.tsx` | `index-*.js` (Entry) | 35,845 B | **35.0 KB** | Main application sidebar and navigation shell |
| **11** | `src/pages/showcase-page.tsx` | `showcase-page` | 34,534 B | **33.7 KB** | UI component showcase |
| **12** | `src/pages/reports-page.tsx` | `reports-page` | 34,033 B | **33.2 KB** | Reporting views and export handlers |
| **13** | `src/pages/production-page.tsx` | `production-page` | 32,895 B | **32.1 KB** | Production floor runs and scrap logging |
| **14** | `src/pages/invoices-page.tsx` | `invoices-page` | 25,747 B | **25.1 KB** | Sales invoices and GST registers |
| **15** | `@better-fetch/fetch/dist/index.js` | `index-*.js` (Entry) | 24,985 B | **24.4 KB** | Better Auth HTTP fetch client |

### Package Hygiene & Tree-Shaking Findings
- **Duplicate Packages / Redundant Dependencies**:
  - `axios` (35.4 KB raw) AND `@better-fetch/fetch` (24.4 KB raw) are simultaneously bundled in the entry chunk. Both provide HTTP client abstractions; Better Auth requires `@better-fetch`, while `apiClient` wraps `axios`.
  - Ghost dependency: `"cn": "^0.5.2"` is declared in `client/package.json` dependencies but is never imported (the app uses a custom `cn()` function in `src/lib/utils.ts` combining `clsx` and `tailwind-merge`).
- **Moment / Lodash Whole-Library Imports**:
  - None detected. No `lodash`, `underscore`, or `moment` dependencies exist. Date formatting uses localized formatting strings or native `Date`; `date-fns` is installed in `package.json` but unreferenced in client source code.
- **Charts, PDF, or CSV in Initial Chunk**:
  - Verified clean. No charting library (`recharts`, `chart.js`) or client-side PDF renderer (`jspdf`, `pdfmake`) is installed. Invoice printing relies on native browser `window.print()`.
- **Tamil Font Weight & Subsetting**:
  - `@fontsource-variable/geist` imports 5 font files totaling **74.64 KB raw**: Latin (28.7 KB), Latin-Ext (16.1 KB), Cyrillic (14.7 KB), Vietnamese (7.8 KB), and Cyrillic-Ext (7.3 KB).
  - **45.9 KB of Cyrillic and Vietnamese font subsets** are bundled with zero application usage.
  - **Zero Tamil font weights or subsets** are bundled. When Tamil script is selected, typography degrades to unmanaged system font fallbacks.
- **Source Maps Shipped**:
  - None shipped. `find client/dist -name "*.map"` confirmed 0 `.map` files are generated.
- **Tree-Shaking Failures**:
  - `Dexie` (197.7 KB raw) is eagerly loaded into the initial entry chunk because `sync-engine` is imported in `app.tsx`, forcing all users to download offline database code before authentication.

---

## 4. Lazy Loading & Route Waterfall Proof

- **Route Splitting Architecture**: Verified. In [`client/src/app.tsx`](file:///home/snehan/projects/web/mill-ledger/client/src/app.tsx#L10-L40), all 15 operational routes are wrapped in `React.lazy()` dynamic imports (`DashboardPage`, `StockPage`, `ProductionPage`, `OrdersPage`, `InvoicesPage`, etc.).
- **Meaningful `<Suspense>` Fallback**: Verified. [`client/src/layouts/authenticated-layout.tsx`](file:///home/snehan/projects/web/mill-ledger/client/src/layouts/authenticated-layout.tsx#L16-L25) wraps `<Outlet />` in `<Suspense fallback={<RouteLoadingFallback />}>` providing an accessible spinner and loading status.
- **Network Panel Waterfall Proof**: Verified in Playwright automated spec [`audit/tests/phase-10-perf-audit.spec.ts`](file:///home/snehan/projects/web/mill-ledger/audit/tests/phase-10-perf-audit.spec.ts) and recorded in [`route-waterfall-lazy-loading.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/waterfalls/route-waterfall-lazy-loading.json):
  - On initial visit to `/dashboard`, neither `invoices-page-*.js` nor `reports-page-*.js` was requested.
  - When the user navigated to `/invoices`, `invoices-page-CZZ361aT.js` was requested dynamically over the network.
- **Prefetch on Intent (Hover or Idle)**: **VERIFIED-FAIL**.
  - Hovering cursor over navigation links with 500ms dwell produced **0 network requests**.
  - No `onPointerEnter` or `onFocus` prefetch handlers exist; no `requestIdleCallback` prefetch is configured. Route chunk download starts strictly after the click navigation event.

---

## 5. Image & Media Pipeline Audit

The image implementation was inspected across source code, database schemas, and live Playwright DOM extraction ([`images-audit.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/images-audit.json)).

| Requirement | Expected Specification | Actual Codebase Implementation | Status |
| :--- | :--- | :--- | :--- |
| **`<img>` Sizing & Attributes** | Explicit `width`, `height` or `aspect-ratio`, descriptive `alt` attribute | Zero `<img>` elements found on product lists, booking screens, or stock tables. Only `<AvatarImage>` exists in the user profile menu. | **VERIFIED-FAIL** |
| **Lazy Loading Below the Fold** | `loading="lazy"` and `decoding="async"` on below-the-fold images | Absent. No product images exist to be lazy-loaded. | **NOT-APPLICABLE** |
| **LCP Image Priority** | `fetchpriority="high"` on above-the-fold hero/product image | Absent. LCP elements are typography headings (`<h1>`) or table containers. | **NOT-APPLICABLE** |
| **Modern Image Formats** | WebP or AVIF with fallback `<picture>` elements, `srcset` and `sizes` | Absent. Only SVG/PNG PWA icons exist in `client/public/`. | **VERIFIED-FAIL** |
| **Scroll Test Proof** | Playwright scroll test proving below-fold requests start only near viewport | Automated scroll test to bottom of page triggered 0 image network requests ([`images-audit.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/images-audit.json)). | **VERIFIED-PASS (No Images)** |
| **Content-Hashed Filenames** | Content hash in filename for immutable caching (`Cache-Control: public, max-age=31536000, immutable`) | Configured for Vite static JS/CSS assets, but nonexistent for user-uploaded or product media assets. | **VERIFIED-FAIL** |
| **ThumbHash / BlurHash** | BlurHash or ThumbHash stored with image record in DB and rendered as skeleton | Zero schema support. `Product`, `ProductVariant`, and `InventoryItem` have no image or hash fields in `schema.prisma`. | **VERIFIED-FAIL** |
| **Media Upload Pipeline** | Multer/Sharp resizing, re-encoding to WebP/AVIF, stripping EXIF, 5MB limit | No image upload routes or processing libraries exist on the server. | **VERIFIED-FAIL** |

---

## 6. Network & Client Data Layer Audit

| Optimization Layer | Expected Standard | Observed Implementation | Evidence / Notes | Status |
| :--- | :--- | :--- | :--- | :--- |
| **HTTP Compression** | Gzip or Brotli encoding on static assets and API JSON payloads | Static assets compressed with gzip/brotli via production server. Backend Express server lacks `compression` middleware (2.9 MB uncompressed API payloads). | [`serve-production.js`](file:///home/snehan/projects/web/mill-ledger/audit/scripts/serve-production.js) vs [`app.ts`](file:///home/snehan/projects/web/mill-ledger/server/src/app.ts) | **VERIFIED-FAIL (Backend API)** |
| **HTTP Caching Headers** | `Cache-Control: public, max-age=31536000, immutable` on hashed assets; `no-cache` on HTML | Correctly implemented on production static server. Express API returns no `Cache-Control` headers for GET requests. | Curl header verification | **VERIFIED-PASS (Static)** / **VERIFIED-FAIL (API)** |
| **ETags on API GETs** | Weak ETags (`W/"..."`) supporting 304 Not Modified | Express generates weak ETags by default; tested and verified on `/api/v1/health` and `/api/v1/sales/customers`. | Curl `-i` responses | **VERIFIED-PASS** |
| **HTTP/2 Transport** | Multiplexed HTTP/2 or HTTPS | Plain HTTP/1.1 via Node.js `app.listen()`. No HTTP/2 server or TLS termination configured. | [`index.ts`](file:///home/snehan/projects/web/mill-ledger/server/src/index.ts) | **VERIFIED-FAIL** |
| **Client Request Deduplication** | Request deduplication and caching layer avoiding serial N+1 in browser | Implemented via TanStack Query (`@tanstack/react-query`) with `staleTime: 30000`. Verified in Playwright that repeated SPA navigation makes 0 redundant requests. | [`tanstack-query-cache-dedupe.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/tanstack-query-cache-dedupe.json) | **VERIFIED-PASS** |
| **Debounced Search** | Input search debounced by 250-300ms before triggering filtering or queries | Absent. Search inputs on table views lack debouncing utilities (`lodash.debounce`, `useDebounce`). | Code inspection across `client/src/pages/` | **VERIFIED-FAIL** |
| **List Virtualization** | Virtualized DOM windowing for table listings over ~100 rows | Absent. No virtualization library installed; tables render full DOM trees regardless of length. | `client/package.json` | **VERIFIED-FAIL** |
| **Server Pagination** | Server pagination on all list endpoints (`limit`, `skip`/`cursor`) | Absent on 100% of operational list endpoints. Only `audit_log` supports `limit`. | `grep -rn "findMany" server/src/modules/` | **VERIFIED-FAIL** |

---

## 7. Backend Scale & PostgreSQL Database Benchmark

### Database Seed Scale
The local throwaway database `mill_ledger_audit_throwaway` was seeded with enterprise manufacturing scale:
- `stock_movement`: **100,007 rows**
- `sales_order`: **10,011 rows**
- `sales_order_line`: **10,011 rows**
- `sales_invoice`: **5,006 rows**
- `sales_invoice_line`: **5,006 rows**

### `EXPLAIN (ANALYZE, BUFFERS)` on Top 20 Queries
Executed via `audit/scripts/explain-top-queries.js`. Saved to [`top-20-queries-explain.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/explain/top-20-queries-explain.json).

| Query ID | Name | Category | Execution (ms) | Planning (ms) | PostgreSQL Node Types | Sequential Scan Detected? |
| :---: | :--- | :--- | :---: | :---: | :--- | :--- |
| **Q01** | Sales Register Aggregation | Reporting | 1.16 | 0.08 | `Aggregate, Seq Scan` | 🚨 **YES (Missing `sales_invoice` status index)** |
| **Q02** | Sales Register Invoices Fetch | Reporting | 1.79 | 0.08 | `Sort, Seq Scan` | 🚨 **YES (Missing `sales_invoice(organizationId, postedAt)` index)** |
| **Q03** | GSTR-1 Outward Supplies Aggregation | Reporting | 1.48 | 0.07 | `Aggregate, Seq Scan` | 🚨 **YES (Missing `sales_invoice` composite index)** |
| **Q04** | Stock Summary Item Master | Inventory | 0.02 | 0.04 | `Bitmap Heap Scan, Bitmap Index Scan` | ✓ No (Index Scan) |
| **Q05** | Stock Movement Ledger By Item (100k rows) | Inventory | **37.63** | 0.07 | `Sort, Seq Scan` | 🚨 **YES (Missing `stock_movement(inventoryItemId, postedAt)` index)** |
| **Q06** | Stock Movement Aggregation (100k rows) | Inventory | **12.31** | 0.06 | `Aggregate, Seq Scan` | 🚨 **YES (Seq Scan on 100k rows)** |
| **Q07** | ATP Active Reservations Check | Sales | 0.02 | 0.07 | `Aggregate, Index Scan` | ✓ No (Index Scan) |
| **Q08** | Sales Orders List Admin (10k rows) | Sales | **3.23** | 0.06 | `Sort, Seq Scan` | 🚨 **YES (Missing `sales_order(organizationId, createdAt)` index)** |
| **Q09** | Sales Orders Filtered by Status | Sales | 1.25 | 0.06 | `Sort, Bitmap Heap Scan` | ✓ No (Indexed on salesman/status) |
| **Q10** | Sales Orders by Salesman | Sales | 0.90 | 0.06 | `Sort, Bitmap Heap Scan` | ✓ No (Indexed on salesman/status) |
| **Q11** | Order Lines By Order ID (10k rows) | Sales | 0.62 | 0.04 | `Seq Scan` | 🚨 **YES (Missing `sales_order_line(salesOrderId)` foreign key index)** |
| **Q12** | Sales Invoices List Admin (5k rows) | Finance | 1.23 | 0.05 | `Sort, Seq Scan` | 🚨 **YES (Missing `sales_invoice(organizationId, postedAt)` index)** |
| **Q13** | Customer Invoices List | Finance | 1.23 | 0.05 | `Sort, Seq Scan` | 🚨 **YES (Missing `sales_invoice(customerId)` index)** |
| **Q14** | FIFO Allocation Open Invoices | Finance | 1.33 | 0.06 | `Sort, Seq Scan` | 🚨 **YES (Missing `sales_invoice(customerId, outstandingAmount)` index)** |
| **Q15** | Customer Payment Allocations Join | Finance | 0.84 | 0.08 | `Hash Join, Seq Scan, Hash` | 🚨 **YES (Seq Scan on joined invoices)** |
| **Q16** | Collections Register Payments | Finance | 0.02 | 0.06 | `Sort, Index Scan` | ✓ No (Index Scan) |
| **Q17** | Receivables Overdue Invoices | Finance | 0.80 | 0.05 | `Seq Scan` | 🚨 **YES (Seq Scan on `sales_invoice`)** |
| **Q18** | Production Runs List | Production | 0.02 | 0.04 | `Sort, Index Scan` | ✓ No (Index Scan) |
| **Q19** | Dispatches List | Dispatch | 0.01 | 0.04 | `Sort, Index Scan` | ✓ No (Index Scan) |
| **Q20** | Audit Log Paginated Query | Audit | 0.02 | 0.04 | `Limit, Index Scan` | ✓ No (Index Scan on timestamp) |

### Prisma N+1 Query Patterns
- **Critical N+1 Loop in `sales.service.ts`**:
  [`getSalesOrders`](file:///home/snehan/projects/web/mill-ledger/server/src/modules/sales/sales.service.ts#L616-L665) fetches all orders, then iterates over every order and every order line, calling `await this.getAvailableStock(...)`.
  Inside `getAvailableStock`, it executes:
  1. `prisma.inventoryItem.findUnique(...)`
  2. `prisma.stockReservation.aggregate(...)`
  For an organization with 10,000 orders containing 1 line each, this executes **20,001 serial SQL queries** in a single API request.

### Connection Pool Configuration & Stress Testing (50 Concurrent Users)
- **Pool Sizing**: [`server/src/db/client.ts`](file:///home/snehan/projects/web/mill-ledger/server/src/db/client.ts#L6-L9) leaves `pg.Pool` unconfigured: defaults to `max: 10`, `connectionTimeoutMillis: 0` (hangs indefinitely if pool is exhausted), and `idleTimeoutMillis: 10000`.
- **Autocannon Load Test Results (50 Connections, 30s Duration)**:
  - `GET /api/v1/health`:
    - Average Req/sec: **9,625 req/s** | Mean Latency: **4.54 ms** | p95: **6.5 ms** | Errors: 0 | Timeouts: 0. (**VERIFIED-PASS**)
  - `GET /api/v1/sales/customers?organizationId=cmwnfu9g300003mabr2uqrelp`:
    - Average Req/sec: **994 req/s** | Mean Latency: **49.77 ms** | p95: **57 ms** | Errors: 0 | Timeouts: 0. (**VERIFIED-PASS**)
  - `GET /api/v1/reports/sales?organizationId=cmwnfu9g300003mabr2uqrelp` (5k invoices, unpaginated, 2.9 MB payload):
    - Average Req/sec: **1.37 req/s** | Mean Latency: **8,870 ms** | p90: **9,873 ms** | **Timeouts: 109** (Default 10s timeout exceeded on 109 requests). (**VERIFIED-FAIL**)
  - `GET /api/v1/sales/orders?organizationId=cmwnfu9g300003mabr2uqrelp` (10k orders, nested N+1 loop, 21.3 MB payload):
    - **FATAL CRASH**: Node.js process terminated with `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory` (Exit code 134) within 30 seconds. (**CRITICAL P0 FAIL**)

---

## 8. Service Worker & Offline Caching Strategy

The offline architecture combines Workbox Service Worker (`client/dist/sw.js`) and client-side IndexedDB (`client/src/offline/db.ts` using Dexie):

### What is Cached
- **Service Worker Precache**: 38 static assets totaling **1,217.85 KiB uncompressed**:
  - `index.html` (revision-hashed)
  - `manifest.webmanifest`, `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `pwa-*.png`
  - All compiled JavaScript chunks (vendor and route chunks)
  - All 5 Geist WOFF2 font files
  - `index-*.css`
- **Runtime Caching**:
  - Static resources: `StaleWhileRevalidate` with cache name `static-resources`.
  - APIs: Explicitly excluded via `navigateFallbackDenylist: [/^\/api/]` and `urlPattern: ({ url }) => !url.pathname.startsWith('/api')`. Private enterprise data is never cached in the Service Worker cache.
- **IndexedDB Storage (Dexie `mill_ledger_offline_db`)**:
  - `customers`: Local snapshot of customer names, codes, states, and GSTINs.
  - `products`: Local snapshot of product variants, SKUs, and default prices.
  - `outbox`: Client-generated offline sales orders with state (`queued`, `syncing`, `synced`, `conflict`, `failed`).

### Versioning & Update Flow
- `vite-plugin-pwa` configures `registerType: "autoUpdate"`.
- `sw.js` executes `self.skipWaiting()` and `clientsClaim()` upon registration.
- Cache busting relies on Vite's content-hashed filenames (`[name]-[hash].js`). When a new deployment occurs, the browser detects changed bytecode in `sw.js`, fetches updated assets in the background, and immediately claims active clients.
- Outdated caches are purged via Workbox `cleanupOutdatedCaches()`.

### Stale Data Risks & Financial Integrity
- **Stale Master Data Risk**: `refreshMasterDataSnapshot` is only triggered when network connectivity transitions from offline to online (`window.addEventListener('online')`), or upon manual button press. If product prices or customer assignments are changed on the server while the salesman is actively working online, the local IndexedDB snapshot is NOT automatically refreshed.
- **Critical Business Pricing Risk (F-077)**:
  In [`server/src/modules/sales/sales.service.ts`](file:///home/snehan/projects/web/mill-ledger/server/src/modules/sales/sales.service.ts#L215-L225), `createSalesOrder` checks:
  ```ts
  let unitPrice = line.unitPrice;
  if (unitPrice === undefined || unitPrice === null) {
    const defaultPrice = variant.priceLines[0]?.price;
    unitPrice = defaultPrice ? Number(defaultPrice) : 50.0;
  }
  ```
  Because the offline sync engine provides `line.unitPrice` populated from local Dexie `cachedProduct.defaultPrice`, the server blindly accepts the client-provided price without validating against the currently effective customer price list. An order booked offline at an obsolete price will be posted and fulfilled at the stale price, creating direct margin erosion.

---

## 9. Phase 10 Audit Findings Summary

| Finding ID | Title | Severity | Category | Standard Refs | Status |
| :--- | :--- | :---: | :--- | :--- | :---: |
| **[F-070](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-070.md)** | Backend Process Crash (V8 Heap OOM) and 20,000+ Prisma N+1 Queries on Unpaginated Sales Orders Under Load | **P0** | Backend Scalability / Reliability | OWASP Top 10 A04:2021, API Top 10 API4:2023, CWE-400 | **OPEN** |
| **[F-071](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-071.md)** | Missing Foreign Key and Composite Indexes Causing Sequential Scans on 11 of Top 20 Production Queries | **P1** | Database Architecture / Indexing | PostgreSQL Indexing Standards, API Top 10 API4:2023 | **OPEN** |
| **[F-072](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-072.md)** | Initial JavaScript Bundle Budget Exceeded by 51.5% (257.54 KB Gzip vs 170 KB Budget) | **P1** | Bundle Optimization / Code Splitting | Performance Budgets, Core Web Vitals (FID/INP) | **OPEN** |
| **[F-073](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-073.md)** | Mobile 4G Largest Contentful Paint (LCP) Budget Violation on Authenticated Routes (3.4s - 4.0s vs 2.5s Target) | **P1** | Frontend Performance / CWV | Google Core Web Vitals (LCP < 2.5s) | **OPEN** |
| **[F-074](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-074.md)** | Absence of Server Pagination and List Virtualization Across All Enterprise Entity Grids | **P1** | Network & UI Scalability / DOM Performance | OWASP API Top 10 API4:2023, NN/g #8 | **OPEN** |
| **[F-075](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-075.md)** | Complete Absence of Product Image Pipeline, Modern Formats (AVIF/WebP), and Image Hash Placeholders | **P2** | Media Architecture & CWV (CLS) | `audit/01-expected-spec.md` REQ-056, REQ-057, CLS < 0.1 | **OPEN** |
| **[F-076](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-076.md)** | Missing Intent-Based Route Prefetching on Hover or Idle for Lazy-Loaded Routes | **P2** | Navigation Latency / Perceived Performance | Google Web Vitals (INP), NN/g System Responsiveness | **OPEN** |
| **[F-077](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-077.md)** | Offline Stale Price Acceptance Without Server-Side Price List Revalidation | **P2** | Offline Sync / Financial Integrity | `audit/01-expected-spec.md` REQ-006, REQ-051, OWASP A04:2021 | **OPEN** |
| **[F-078](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-078.md)** | Missing Express Response Compression Middleware and Unconfigured PostgreSQL Connection Pool | **P2** | Network Overhead / Resource Pooling | RFC 9110 HTTP Compression, Node-PG Best Practices | **OPEN** |
| **[F-079](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-079.md)** | Unused Cyrillic/Vietnamese Font Subsets Bundled While Required Tamil Font Subset is Missing | **P3** | Font Optimization / Localization | `audit/01-expected-spec.md` REQ-053, W3C Web Fonts Subsetting | **OPEN** |

---

## 10. Audit Verification Method & Reproducibility Proof

Every finding in this report is backed by fresh, reproducible command execution output:
1. **Bundle Measurements**:
   ```bash
   pnpm --filter client build
   node audit/scripts/analyze-bundle.ts
   ```
2. **Lighthouse CI Audits**:
   ```bash
   node audit/scripts/serve-production.js &
   npx lighthouse http://127.0.0.1:4173/dashboard --chrome-flags="--headless=new --no-sandbox" --extra-headers='{"Cookie":"better-auth.session_token=..."}' --output=json --output-path=audit/evidence/performance/lighthouse/dashboard.json
   ```
3. **Database Scale Seed & EXPLAIN**:
   ```bash
   psql mill_ledger_audit_throwaway -f audit/scripts/seed-scale.sql
   node audit/scripts/explain-top-queries.js
   ```
4. **Load & Concurrency Stress Testing**:
   ```bash
   npx autocannon -c 50 -d 30 -H "Cookie=..." http://127.0.0.1:4000/api/v1/sales/orders?organizationId=cmwnfu9g300003mabr2uqrelp
   ```
5. **Playwright Waterfall & Cache Tests**:
   ```bash
   pnpm exec playwright test audit/tests/phase-10-perf-audit.spec.ts --config=audit/scripts/playwright.audit.config.ts
   ```
