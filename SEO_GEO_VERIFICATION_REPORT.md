# MillLedger SEO & GEO Verification Report

**Date:** 2026-11-27

## 1. Automated Verification Summary

| Check | Command | Result | Scope & Evidence |
| :--- | :--- | :--- | :--- |
| Full Workspace Build & SSR Prerender | `pnpm build` | **PASS** | Built `shared`, `server`, `client`, and prerendered 12 public routes + `sitemap.xml` + `robots.txt` + `app-shell.html` |
| Static HTML & SEO Tag Audit | Node script on `client/dist/` | **PASS** | Verified 12/12 prerendered HTML files have `<h1>`, unique `<title>` (12), unique `<meta name="description">` (12), unique `<link rel="canonical">` (12), `robots="index, follow"`, valid JSON-LD; `app-shell.html` has `noindex, nofollow`; `sitemap.xml` excludes `/auth/login` and `.local`; `robots.txt` includes `OAI-SearchBot`, `PerplexityBot`, and `GPTBot` |
| Typecheck | `pnpm typecheck` | **PASS** | `shared`, `client`, and `server` passed with 0 errors |
| Lint | `pnpm lint` | **PASS** | `oxlint` finished with 0 errors (28 pre-existing warnings) |
| Unit & API Integration Tests | `pnpm vitest run client/src/lib/public-routes.test.ts server/src/tests/public-inquiries.test.ts` | **PASS (5/5)** | Verified unique route metadata, canonical normalization, JSON-LD without fake pricing/ratings, `POST /api/v1/public/inquiries` 201 + `X-Robots-Tag: noindex, nofollow`, and 400 `VALIDATION_ERROR` |
| Playwright Browser E2E | `pnpm test:e2e e2e/public-seo.spec.ts` | **PASS (4/4)** | Verified all 12 public routes on mobile (`375x812`) and desktop (`1280x800`) with HTTP 200, `h1Count === 1`, `overflowPx <= 0`, `brokenImgs === 0`, `/demo` validation & live API submission, `/catalog` redirect, and 404 `noindex, nofollow` |
| Existing Full Server Suite | `pnpm test` (baseline) | **PARTIAL / ENV TIMEOUT** | Pre-existing DB-backed tests hit Prisma 5000ms transaction timeout in `resetOperationalData` against the configured `DATABASE_URL` (23 passed, 26 failed) |

---

## 2. GEO Benchmark Prompt Set (For Ongoing Tracking)

Track MillLedger mentions, citations, cited URLs, and factual accuracy over time across Google Search, ChatGPT, Perplexity, Gemini, and Microsoft Copilot:

1. "What is MillLedger ERP and which food manufacturing workflows does it support?"
2. "Spreadsheet alternative for small food manufacturing mills in India with BOM variance and GST billing"
3. "Food manufacturing ERP India with offline mobile salesman order capture and ATP stock reservation"
4. "How does moving weighted average stock ledger work for flour and snack mills?"
5. "Indian food mill software with Tamil language shop floor interface and CGST/SGST/IGST invoicing"

---

## 3. Distinction of Scope & Owner Actions Required

- **Audited:** Full repository (`AGENTS.md`, `docs/*`, `client/src/*`, `server/src/*`, `vercel.json`, `client/public/*`).
- **Implemented:** Unified public site around real MillLedger ERP capabilities across 12 prerendered public routes, dynamic `sitemap.xml` and `robots.txt`, `app-shell.html` (`noindex, nofollow`) fallback, `X-Robots-Tag` scoping in `server/src/app.ts`, `POST /api/v1/public/inquiries`, and `client/src/lib/analytics.ts`.
- **Tested:** Build, prerendered HTML/sitemap/robots validation, `typecheck`, `lint`, Vitest unit/API tests (5/5), and Playwright E2E across 12 routes on mobile and desktop (4/4).
- **Not Verified Externally:** Live search-engine indexation in Google Search Console or Bing Webmaster Tools cannot be claimed until deployed to production and verified in those consoles.
- **Requires Owner / Business Confirmation:**
  1. Set final production `VITE_APP_URL` (e.g., `https://app.mill-ledger.com` or marketing domain) before production build.
  2. Configure Google Search Console, Bing Webmaster Tools, and optional analytics ID (`gtag` / `plausible`).
  3. Confirm official contact email (`hello@mill-ledger.com` placeholder) and whether `GPTBot` should remain disallowed or be allowed.
  4. Provide real product screenshots, pricing/support terms, and consented customer stories before publishing `/pricing` or testimonials.
