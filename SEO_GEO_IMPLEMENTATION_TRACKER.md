# SEO & GEO Implementation Tracker

| Item | Area | Status | Evidence / File | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Entity Unification** | Public Pages | `DONE` | `client/src/pages/public/*` | Replaced fictional Madurai factory copy with verified MillLedger ERP product copy |
| **Route Metadata Registry** | Technical SEO | `DONE` | `client/src/lib/public-routes.ts` | Single source of truth for 12 public routes, unique titles, descriptions, breadcrumbs, JSON-LD |
| **Client Head Manager** | Technical SEO | `DONE` | `client/src/components/seo/seo-head.tsx` | Updates `<title>`, `<meta>`, `<link rel="canonical">`, OG, Twitter, and JSON-LD on navigation |
| **SSR Prerendering** | Crawling & Indexing | `DONE` | `client/src/entry-prerender.tsx`, `client/scripts/prerender.mjs` | Emits static HTML for all 12 public routes at build time |
| **Sitemap & Robots** | Crawling & Indexing | `DONE` | `client/scripts/prerender.mjs` | Generates `dist/sitemap.xml` and `dist/robots.txt` using `VITE_APP_URL`; separates `OAI-SearchBot` and `GPTBot` |
| **Private App Protection** | Security & Indexing | `DONE` | `client/dist/app-shell.html`, `server/src/app.ts`, `login-page.tsx`, `placeholder-pages.tsx` | `noindex, nofollow` on private routes, `/api/*`, `/auth/login`, and 404s |
| **Demo & Contact API** | Conversions | `DONE` | `server/src/modules/public/public.routes.ts`, `shared/src/schemas/public.schema.ts` | Rate-limited, Zod-validated `POST /api/v1/public/inquiries` with attribution capture |
| **Analytics & Attribution Hook** | Measurement | `DONE` | `client/src/lib/analytics.ts` | Captures UTM + AI/organic referrer channel; forwards to owner-configured GA4/Plausible without fake IDs |
| **Production Domain & Search Console** | External Setup | `OWNER_ACTION` | `.env.production` (`VITE_APP_URL`) | Owner must set final production domain and verify Google Search Console / Bing Webmaster Tools |
| **Analytics ID Configuration** | External Setup | `OWNER_ACTION` | `client/index.html` or tag script | Owner must add GA4 / Plausible script if web analytics is desired |
