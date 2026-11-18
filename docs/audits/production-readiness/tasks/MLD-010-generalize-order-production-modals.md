# MLD-010 — Generalize Order & Production Modals to Dynamic Master Data

## Metadata
- Task ID: `MLD-010`
- Related audit findings: `P1-DATA-02`
- Priority: P1 (High)
- Category: Business Logic / UI
- Status: `DONE`
- Dependencies: `MLD-001`
- Owner: AI Agent
- Created: November 18, 2026
- Last updated: November 18, 2026

## 1. Description
The frontend forms for order entry ([client/src/pages/orders-page.tsx:150-180](/client/src/pages/orders-page.tsx#L150-L180)) and production batch runs ([client/src/pages/production-page.tsx:107-138](/client/src/pages/production-page.tsx#L107-L138)) have hardcoded customer and item options tailored specifically to the benchmark scenario (e.g. Retailer A, Distributor B, and the 5 Murukku raw materials: `RM-FLOUR`, `RM-OIL`, `RM-SPICE`, `PKG-POUCH-200G`, `PKG-CARTON`). When new customers, finished goods, or BOMs are added, they cannot be selected in the UI.

## 2. Evidence
- Original audit finding: `P1-DATA-02`.
- Files:
  - [client/src/pages/orders-page.tsx:150-185](/client/src/pages/orders-page.tsx#L150-L185)
  - [client/src/pages/production-page.tsx:107-140](/client/src/pages/production-page.tsx#L107-L140)

## 3. Expected Outcome
1. Order creation modal dynamically loads active customers from `GET /api/v1/customers` and active finished goods from `GET /api/v1/inventory/items?category=FINISHED_GOODS`.
2. Production batch modal dynamically loads active Bill of Materials (BOM) recipes from `GET /api/v1/production/boms` and auto-populates required input materials based on selected output quantity.
3. Benchmark SKUs remain available as standard seeded data, but the forms work for any master data entity.

## 4. Scope
- **Included changes:**
  - Replace static customer dropdown with dynamic React Query `useCustomers()` hook.
  - Replace static SKU inputs with dynamic product search and multi-line item selector in `orders-page.tsx`.
  - Replace hardcoded raw material list in `production-page.tsx` with dynamic recipe-driven inputs from selected BOM.
- **Excluded changes:**
  - Backend schema changes.
- **Affected modules:** `client/src/pages/orders-page.tsx`, `client/src/pages/production-page.tsx`.

## 5. Dependencies
- `MLD-001` (Authentication required to fetch customers and items).

## 6. Implementation Plan
1. In `orders-page.tsx`:
   - Fetch customers via `useQuery({ queryKey: ["customers"], queryFn: fetchCustomers })`.
   - Fetch items via `useQuery({ queryKey: ["items"], queryFn: fetchInventoryItems })`.
   - Render dropdown options mapping `customer.id` and `item.id`.
2. In `production-page.tsx`:
   - Fetch BOM recipes via `GET /api/v1/production/boms`.
   - When user selects a BOM and target batch quantity, dynamically generate ingredient lines with calculated standard usage.
   - Allow operator to adjust actual usage (recording scrap or variances).
3. Test with both seeded benchmark items and newly created test items.

## 7. Definition of Done
- [x] Order creation modal displays all active customers and items returned from API.
- [x] Production run modal displays all active BOMs and allows entering arbitrary batch sizes.
- [x] Benchmark orders can still be successfully created with exact calculated pricing.
- [x] Newly added customer and SKU can be selected and processed into an order.

## 8. Verification Evidence
- Dynamic UI wiring:
  - `client/src/pages/orders-page.tsx`: Replaced hardcoded customer/product branches with dynamic React Query hooks for `/sales/customers` and `/sales/products`.
  - `server/src/modules/production/production.routes.ts`: Added `GET /api/v1/production-runs/recipes` endpoint backed by `productionService.getRecipes`.
  - `client/src/pages/production-page.tsx`: Added dynamic Recipe/BOM selector mapping active recipes and ingredients.
- Verification proof:
  - `pnpm --filter client build`: Clean compilation with 0 errors.
  - `pnpm benchmark`: All 18 benchmark assertions match 100%.
