# MLD-016 — Generate Static PWA Manifest Icons and Favicon Asset

## Metadata
- Task ID: `MLD-016`
- Related audit findings: `P2-PWA-02`
- Priority: P2 (Medium)
- Category: PWA / Assets
- Status: `DONE`
- Dependencies: None
- Owner: AI Agent
- Created: November 18, 2026
- Last updated: November 18, 2026

## 1. Description
1. The `client/public/` directory previously contained zero files.
2. `client/vite.config.ts:22-33` configures VitePWA with icons `/pwa-192x192.png` and `/pwa-512x512.png`. Because these files did not exist on disk, browser requests for these icons fell back to Vite serving `index.html` (Content-Type: `text/html`).
3. `client/index.html` referenced `/favicon.svg`, which also did not exist.
4. When mobile Chrome or Safari attempted to install the PWA, icon installation failed or displayed a generic blank placeholder.

## 2. Evidence
- Original audit finding: `P2-PWA-02`.
- Files:
  - `client/public/`
  - [client/vite.config.ts](/client/vite.config.ts)
  - [client/index.html](/client/index.html)

## 3. Expected Outcome
1. `client/public/favicon.svg` exists with a crisp vector icon using the Pine & Paper primary color (`#176b54`).
2. High-resolution PWA icons `pwa-192x192.png` and `pwa-512x512.png`, `apple-touch-icon.png`, and `favicon.ico` exist in `client/public/`.
3. PWA manifest specifies valid icon files with Pine & Paper colors (`#176b54` theme, `#fcfdfc` background).

## 4. Scope
- **Included changes:**
  - Created vector SVG icon `client/public/favicon.svg` representing the MillLedger grain/ledger emblem.
  - Generated PNG assets `pwa-192x192.png`, `pwa-512x512.png`, `apple-touch-icon.png`, and `favicon.ico`.
  - Updated `client/index.html` to reference SVG, ICO, Apple touch icon, and theme color.
  - Updated `client/vite.config.ts` PWA manifest `theme_color` (`#176b54`) and `background_color` (`#fcfdfc`).
- **Excluded changes:**
  - Complex dynamic icon generation servers.
- **Affected modules:** `client/public/`, `client/index.html`, `client/vite.config.ts`.

## 5. Dependencies
- None.

## 6. Implementation Plan
1. Created `client/public/favicon.svg` with `#176b54` background and clean geometric mill icon.
2. Rendered crisp antialiased PNG versions at 192x192 and 512x512, 180x180 (Apple touch), and multi-size ICO into `client/public/`.
3. Verified manifest generation and precache entries.

## 7. Definition of Done
- [x] `client/public/favicon.svg` exists and renders correctly.
- [x] `client/public/pwa-192x192.png` exists and is a valid PNG file.
- [x] `client/public/pwa-512x512.png` exists and is a valid PNG file.
- [x] `client/public/apple-touch-icon.png` and `favicon.ico` exist.
- [x] PWA manifest reports valid icons in browser and VitePWA precaches them.

## 8. Verification Evidence
- `file client/public/*` confirms all assets are valid PNG/SVG/ICO image data.
- Vite build precaches 38 entries including `/favicon.svg`, `/pwa-192x192.png`, `/pwa-512x512.png`, and `manifest.webmanifest`.
