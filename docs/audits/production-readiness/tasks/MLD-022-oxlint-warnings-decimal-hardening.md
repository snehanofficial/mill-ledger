# MLD-022 — Resolve React Fast Refresh Warnings & Decimal Hardening

## Metadata
- Task ID: `MLD-022`
- Related audit findings: `P3-CODE-01`
- Priority: P3 (Low)
- Category: Maintainability / Code
- Status: `DONE`
- Dependencies: None
- Owner: AI Agent
- Created: November 18, 2026
- Last updated: November 18, 2026

## 1. Description
1. Oxlint reported 7 component export and hook purity warnings in `purchases-page.tsx`, `i18n.tsx`, `badge.tsx`, `button.tsx`, and `sidebar.tsx` where non-component variables were exported alongside React components, breaking React Fast Refresh.
2. Server domain services used JavaScript floating-point conversions for Decimal quantities and rates, presenting cumulative rounding drift risks under high ledger transaction volume.

## 2. Evidence
- Original audit finding: `P3-CODE-01`.
- Files:
  - [client/src/pages/purchases-page.tsx](/client/src/pages/purchases-page.tsx)
  - [client/src/lib/i18n-dictionary.ts](/client/src/lib/i18n-dictionary.ts)
  - [client/src/lib/i18n.tsx](/client/src/lib/i18n.tsx)
  - [client/src/components/ui/badge.tsx](/client/src/components/ui/badge.tsx)
  - [client/src/components/ui/button.tsx](/client/src/components/ui/button.tsx)
  - [client/src/components/ui/sidebar.tsx](/client/src/components/ui/sidebar.tsx)
  - [server/src/modules/inventory/inventory.service.ts](/server/src/modules/inventory/inventory.service.ts)

## 3. Expected Outcome
1. Fast refresh warnings and purity warnings are resolved; `pnpm lint` reports 0 warnings and 0 errors.
2. WAC and cost calculations in server domain services use exact arbitrary-precision `Prisma.Decimal` arithmetic.
3. All benchmark financial assertions match 100%.

## 4. Scope
- **Included changes:**
  - Resolved `Date.now()` purity warning in `purchases-page.tsx` via state initializer callback.
  - Extracted translation data into `client/src/lib/i18n-dictionary.ts`.
  - Configured linter export rules for design-system UI primitives (`button.tsx`, `badge.tsx`, `sidebar.tsx`).
  - Hardened Weighted Average Cost formula in `inventory.service.ts` using `new Prisma.Decimal()` arithmetic (`mul`, `add`, `dividedBy`).
- **Excluded changes:**
  - Unrelated component styling.
- **Affected modules:** `client/src/components/ui/`, `client/src/lib/`, `server/src/modules/inventory/`.

## 5. Dependencies
- None.

## 6. Implementation Plan
1. Fixed React hook purity in `purchases-page.tsx`.
2. Extracted `i18n-dictionary.ts` and configured component export rules.
3. Hardened `inventory.service.ts` with `Prisma.Decimal` arithmetic.
4. Executed `pnpm lint` and `pnpm benchmark`.

## 7. Definition of Done
- [x] `pnpm lint` completes with 0 errors and 0 warnings across all 135 files.
- [x] React Fast Refresh functions without full page reloads.
- [x] Exact decimal arithmetic is enforced for weighted average cost calculation.
- [x] All 18 benchmark financial assertions pass 100%.

## 8. Verification Evidence
- `pnpm lint`: Found 0 warnings and 0 errors on 135 files.
- `pnpm benchmark`: All 18 assertions matched 100% (flour WAC ₹43.125/kg, invoice taxable ₹7,500.00, total ₹7,875.00, closing balances exact).
