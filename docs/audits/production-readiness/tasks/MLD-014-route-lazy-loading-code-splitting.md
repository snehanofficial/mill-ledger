# MLD-014 — Implement Route-Level Lazy Loading & Code Splitting

## Metadata
- Task ID: `MLD-014`
- Related audit findings: `P1-PERF-02`
- Priority: P1 (High)
- Category: Performance / Frontend
- Status: `DONE`
- Dependencies: None
- Owner: AI Agent
- Created: November 18, 2026
- Last updated: November 18, 2026

## 1. Description
In `client/src/app.tsx:1-32`, all 10 route pages are statically imported at the top of the file:
```typescript
import { StockPage } from "./pages/stock-page";
import { ProductionPage } from "./pages/production-page";
import { OrdersPage } from "./pages/orders-page";
...
```
This forces Vite to bundle the entire application into a single monolithic 984 kB JavaScript chunk (`index-BXd_62_o.js`). Initial page load forces a mobile salesman or floor worker on 3G cellular connections to download, parse, and execute charts, reports, invoice layouts, and admin settings before rendering the simple order or production interface.

## 2. Evidence
- Original audit finding: `P1-PERF-02`.
- Files:
  - [client/src/app.tsx:1-32](/client/src/app.tsx#L1-L32)
  - Vite build output: `dist/assets/index-BXd_62_o.js 984.61 kB (gzip: 270.82 kB)`

## 3. Expected Outcome
1. Route components are split using `React.lazy()` with dynamic imports (`const StockPage = React.lazy(() => import("./pages/stock-page"))`).
2. Routes are wrapped in a `<Suspense>` boundary with a clean Pine & Paper skeleton loader (`<LoadingState />`).
3. Initial JavaScript bundle size drops below 350 kB (gzip < 100 kB). No single chunk exceeds Vite's 500 kB chunk warning threshold.

## 4. Scope
- **Included changes:**
  - Convert page imports in `client/src/app.tsx` to `React.lazy()`.
  - Wrap `<Routes>` in `<Suspense fallback={<RouteLoadingSkeleton />}>`.
  - Configure manual chunking in `client/vite.config.ts` if needed for vendor libraries (React, TanStack Query, Radix UI).
  - Verify build chunk output.
- **Excluded changes:**
  - Altering page route paths or logic.
- **Affected modules:** `client/src/app.tsx`, `client/vite.config.ts`.

## 5. Dependencies
- None. Can be implemented and verified immediately.

## 6. Implementation Plan
1. In `client/src/app.tsx`:
   Replace static imports with `React.lazy()` for:
   - `LoginPage`
   - `DashboardPage`
   - `StockPage`
   - `PurchasesPage`
   - `ProductionPage`
   - `OrdersPage`
   - `DispatchPage`
   - `InvoicesPage`
   - `PaymentsPage`
   - `ReportsPage`
2. Create lightweight `<RouteLoadingSkeleton />` matching page shell dimensions to eliminate layout shifts during code fetching.
3. Run `pnpm build` in `client/` and verify generated chunks.

## 7. Definition of Done
- [x] Primary entry chunk `index.js` is reduced by at least 50% compared to baseline (below 500 kB uncompressed).
- [x] No Vite warning `(!) Some chunks are larger than 500 kB after minification`.
- [x] All pages load and render without hydration or suspense errors.
- [x] Page navigation displays seamless transition skeleton without layout shift.

## 8. Verification Evidence
- Build metrics (`pnpm --filter client build`):
  - Primary bundle reduced from 991.14 kB down to 267.98 kB (73.0% reduction).
  - All 15+ route pages split into individual on-demand dynamic chunks (each between 3 kB and 22 kB).
  - Vendor chunking (`vendor-react`, `vendor-ui`, `vendor-query`, `vendor-icons`) strictly eliminates any chunk over 500 kB.
  - Zero Vite chunk size warnings.
- Layout integration: `client/src/layouts/authenticated-layout.tsx`
  - Outlet wrapped in `<Suspense fallback={<RouteLoadingFallback />}>` ensuring authenticated shell layout stability during chunk resolution.
- Test and typecheck:
  - `pnpm typecheck`: 0 errors.
  - `pnpm test`: 17/17 test files passed.
