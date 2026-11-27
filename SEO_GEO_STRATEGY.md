# MillLedger SEO & GEO Strategy

## 1. Verified Brand & Entity Source of Truth

- **Product Name:** MillLedger
- **Product Category:** Order-to-Audit ERP and Shop Floor Ledger for Small Food Manufacturing Mills
- **Target Geography:** India (with English and Tamil bilingual operational UI)
- **Intended Users:** Small food manufacturing mills (Owners, Factory Admins, Production Supervisors, Field Salesmen, Accountants)
- **Architecture:** React 19 + Vite PWA + Tailwind CSS 4 + TanStack Query + Dexie IndexedDB; Express 5 + Better Auth + Prisma 7 + PostgreSQL
- **Official Contact:** `hello@mill-ledger.com` (pending owner confirmation of production domain & inbox)
- **Verified Differentiators:**
  1. Movement-based inventory ledger with atomic moving weighted average valuation (no silent overwrites).
  2. Versioned BOM production runs with yield and ingredient variance flagging plus non-blocking carton capacity warnings.
  3. Offline field salesman order capture via IndexedDB with idempotent server replay and explicit Local/Syncing/Synced/Conflict states.
  4. Strict Available-to-Promise (ATP) stock reservation on order approval to prevent double-selling.
  5. Indian GST invoicing (CGST/SGST intra-state, IGST inter-state), immutable posted invoices corrected by credit/debit notes, and FIFO payment allocations.

## 2. Technical Rendering & Crawler Strategy

- **Rendering Model:** Keep Vite + React 19 without migrating to Next.js. Use build-time SSR prerendering (`vite build --ssr` + `client/scripts/prerender.mjs`) to output full semantic HTML and route-specific metadata for every public URL.
- **Private App Isolation:** Keep `client/dist/app-shell.html` (`noindex, nofollow`) as the SPA fallback for authenticated ERP routes and 404s. Enforce `X-Robots-Tag: noindex, nofollow` on `/api/*` and non-public routes in `server/src/app.ts`.
- **AI Search vs. Training Policy:** Allow `Googlebot`, `Bingbot`, `OAI-SearchBot`, and `PerplexityBot` on public pages for search and answer-engine discoverability; disallow `GPTBot` from model training by default (configurable in `client/scripts/prerender.mjs`).

## 3. GEO (Generative Engine Optimization) Strategy

- Lead every public page and technical guide with a clear, self-contained factual answer before expanding into tables and workflow steps.
- Maintain strict entity consistency (`MillLedger`, `Order-to-Audit ERP`, `Food Manufacturing Mills`, `India`) across `WebSite`, `Organization`, `WebPage`, `BreadcrumbList`, and `SoftwareApplication` JSON-LD schemas.
- Publish transparent scope boundaries on `/features` and `/security` so answer engines accurately cite what MillLedger supports and do not hallucinate unsupported integrations (e.g., e-Invoice IRN or Tally XML).
