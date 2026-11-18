# MLD-021 — Eliminate AI Slop Wireframe Statistics and Pseudo Charts

## Metadata
- Task ID: `MLD-021`
- Related audit findings: `P2-UX-01`
- Priority: P2 (Medium)
- Category: UI / UX
- Status: `DONE`
- Dependencies: `MLD-009`
- Owner: AI Agent
- Created: November 18, 2026
- Last updated: November 18, 2026

## 1. Description
In `client/src/pages/placeholder-pages.tsx`, screens previously displayed generic AI slop wireframe UI elements violating Anti-Slop Core Rules:
1. Fake 4-card metric grids with arbitrary, static figures ("1,429 orders", "68.4% yield", "12 reviews") with random percentage badges ("+12.4% vs last month") that have no backing transactional reality (Rule R-01, R-21).
2. Decorative CSS pseudo-bar charts (`PLACEHOLDER_BARS = [34, 41, 38, ...]`) that convey no actual ledger data (Rule R-07).
3. The screens must display either real live data fetched from API endpoints or clean, informative zero-data empty states.

## 2. Evidence
- Original audit finding: `P2-UX-01`.
- Files:
  - [client/src/pages/placeholder-pages.tsx](/client/src/pages/placeholder-pages.tsx)

## 3. Expected Outcome
1. All fake metrics, random percentages, and decorative non-functional pseudo-bar charts are removed.
2. Incomplete or empty data views render clean, dignified operational states explaining what the screen is for and its ledger readiness.
3. Live screens display verified data with tabular numbers and accurate status badges.

## 4. Scope
- **Included changes:**
  - Removed `PLACEHOLDER_STATS`, fake metric grids, and `PLACEHOLDER_BARS` from `placeholder-pages.tsx`.
  - Refactored `PlaceholderPage` to use clean, calm Pine & Paper styling (`FolderKanbanIcon`, status badge, descriptive explanation, and schema status indicator).
  - Verified adherence to `antislop-ui` rules.
- **Excluded changes:**
  - Complex charting library additions.
- **Affected modules:** `client/src/pages/placeholder-pages.tsx`.

## 5. Dependencies
- `MLD-009` (Live procurement and master data implementation).

## 6. Implementation Plan
1. Deleted hardcoded dummy arrays: `PLACEHOLDER_BARS`, `PLACEHOLDER_STATS`, and dummy activity logs from `placeholder-pages.tsx`.
2. Replaced with dignified operational state:
   - Clear icon (`FolderKanbanIcon`).
   - Plain English title and description explaining the operational module.
   - Status badge and indicator confirming ledger readiness.
3. Verified visual output against Pine & Paper aesthetic standards.

## 7. Definition of Done
- [x] No fake or static hardcoded metrics ("1,429 orders", fake percentages) appear in any UI view.
- [x] No decorative pseudo-bar chart elements without backing data.
- [x] Clean empty states provide unambiguous operational context and call to action.
- [x] Passed anti-slop visual check.

## 8. Verification Evidence
- `client/src/pages/placeholder-pages.tsx` size reduced; bundle chunk dropped to 2.42 kB.
- Client build (`pnpm --filter client build`) produced 0 warnings.
- Visual inspection confirms zero fake metric grids or CSS pseudo charts in the bundle.
