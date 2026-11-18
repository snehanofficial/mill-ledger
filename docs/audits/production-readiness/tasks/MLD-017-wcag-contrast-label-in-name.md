# MLD-017 — Remediate WCAG 2.2 AA Contrast & Label-in-Name Violations

## Metadata
- Task ID: `MLD-017`
- Related audit findings: `P2-A11Y-01`
- Priority: P2 (Medium)
- Category: Accessibility / WCAG
- Status: `DONE`
- Dependencies: None
- Owner: AI Agent
- Created: November 18, 2026
- Last updated: November 18, 2026

## 1. Description
Lighthouse and WCAG 2.2 audit identified specific accessibility violations:
1. **SC 1.4.3 Contrast (Minimum):**
   - `<kbd class="bg-muted text-muted-foreground">⌘B</kbd>` had ratio **4.39:1** (failed 4.5:1 requirement) due to `--muted-foreground: #71717a`.
   - Action buttons with hardcoded `bg-emerald-600` had lower contrast and violated Pine & Paper design tokens.
2. **SC 1.4.11 Non-Text Contrast:**
   - Input and control borders (`#e4e4e7` / `#d4d4d8` on background) had ratio **1.45:1** (failed 3.0:1 threshold for UI component boundaries).
3. **SC 2.5.3 Label in Name:**
   - Visible text `"தமிழ்"` on language switch button had `aria-label="Change language to Tamil"`. Accessible name did not contain the visible label.
   - Visible brand text `"MillLedger Production unit"` had `aria-label="MillLedger home"`.
   - Sidebar collapse button visible text `"Collapse to icons ⌘B"` had `aria-label="Collapse to icons"`.

## 2. Evidence
- Original audit finding: `P2-A11Y-01`.
- Files:
  - [client/src/index.css](/client/src/index.css)
  - [client/src/components/shell/authenticated-shell.tsx](/client/src/components/shell/authenticated-shell.tsx)
  - [client/src/pages/orders-page.tsx](/client/src/pages/orders-page.tsx)
  - [client/src/pages/invoices-page.tsx](/client/src/pages/invoices-page.tsx)
  - [client/src/pages/production-page.tsx](/client/src/pages/production-page.tsx)

## 3. Expected Outcome
1. All text elements satisfy WCAG 2.2 AA contrast ratio $\ge 4.5:1$ (normal text) and $\ge 3:1$ (large text/graphical elements).
2. Input and control borders satisfy $\ge 3:1$ contrast against adjacent background.
3. Every interactive control with visible text has an accessible name (`aria-label` or element text) that includes the visible text verbatim (SC 2.5.3).

## 4. Scope
- **Included changes:**
  - Adjusted `--muted-foreground` to `#52525b` (contrast 7.58:1 on `#fcfdfc`, 6.97:1 on `#f4f4f5`), satisfying SC 1.4.3.
  - Adjusted `--input` and `--control-border` to `#828288` (contrast 3.75:1 on `#fcfdfc`), satisfying SC 1.4.11.
  - Replaced inline hardcoded button styling with default primary variant `<Button>` using `#176b54` (contrast 6.2:1).
  - Updated `aria-label` attributes in `authenticated-shell.tsx` to match visible label text verbatim.
- **Excluded changes:**
  - Complete redesign of component visual style.
- **Affected modules:** `client/src/index.css`, `client/src/components/shell/authenticated-shell.tsx`, `client/src/pages/orders-page.tsx`, `client/src/pages/invoices-page.tsx`, `client/src/pages/production-page.tsx`.

## 5. Dependencies
- None.

## 6. Implementation Plan
1. In `client/src/index.css`:
   - Set `--muted-foreground: #52525b` and `--input: #828288` / `--control-border: #828288`.
2. In `client/src/components/shell/authenticated-shell.tsx`:
   - Updated language toggle `aria-label` to `"தமிழ் - Switch language to Tamil"` / `"EN - Switch language to English"`.
   - Updated brand link `aria-label` to `${name} ${description ? description + " - " : ""}Home`.
   - Updated sidebar collapse button `aria-label` to `Collapse to icons ⌘B`.
3. In `orders-page.tsx`, `invoices-page.tsx`, and `production-page.tsx`:
   - Removed inline `bg-emerald-600 hover:bg-emerald-700` overrides to use primary tokenized color `#176b54`.

## 7. Definition of Done
- [x] Contrast ratio on all `<kbd>` and muted text elements is $\ge 4.5:1$ (measured 6.97:1).
- [x] Input borders satisfy $\ge 3:1$ contrast against background (measured 3.75:1).
- [x] All primary buttons use tokenized primary color with $\ge 4.5:1$ contrast (measured 6.20:1).
- [x] No SC 2.5.3 (Label in Name) mismatch warnings on language toggle, brand heading, or collapse buttons.

## 8. Verification Evidence
- Contrast analysis script verified:
  - `#52525b` on `#fcfdfc`: 7.58:1 (exceeds 4.5:1).
  - `#52525b` on `#f4f4f5`: 6.97:1 (exceeds 4.5:1).
  - `#828288` on `#fcfdfc`: 3.75:1 (exceeds 3.0:1).
  - `#176b54` on `#ffffff`: 6.20:1 (exceeds 4.5:1).
- Typecheck and client build passed with 0 errors.
