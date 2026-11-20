# Phase 12 Audit Report: Search Engine Optimization (SEO), Metadata & Public vs. Authenticated Surfaces

- **Audit Date**: 2026-11-20
- **Auditor**: Principal Accessibility Specialist, Systems Auditor & Application Security Reviewer
- **Target Standards & Specifications**:
  - `Problem_Statement_Winter_Internship_Application_2026.md`:
    - Owner Decision 2: "SEO Scope: Metadata, not public indexing. Keep authenticated ERP pages noindex. Implement descriptive titles, semantic HTML, and relevant metadata throughout the application. Public landing pages may be indexed"
  - MillLedger Implementation Authority & Specifications:
    - [`audit/01-expected-spec.md`](file:///home/snehan/projects/web/mill-ledger/audit/01-expected-spec.md) (REQ-061 Anti-Slop UI Craftsmanship, REQ-062 Application Metadata & Authenticated `noindex` Protection)
  - Search Engine & Web Standards:
    - RFC 9309: Robots Exclusion Protocol (REP)
    - RFC 9110: HTTP Semantics, Section 15.5.5 (404 Not Found), Section 15.4.2 (301 Moved Permanently)
    - Open Graph Protocol (`ogp.me`) & Twitter Cards Markup Specification
    - Schema.org Core Vocabulary: `Organization`, `LocalBusiness`, `Product`, `SoftwareApplication`
    - W3C Sitemaps XML Protocol 0.9 (`sitemaps.org`)
    - Google Search Central: Robots Meta Tags, Soft 404 Errors, and Internationalized URLs (`hreflang`)
  - Accessibility Standards:
    - WCAG 2.2 Success Criterion 2.4.2: Page Titled (Level A)
    - WCAG 2.2 Success Criterion 1.3.1: Info and Relationships (Level A)
  - Security Standards:
    - OWASP Top 10:2021 A01:2021 (Broken Access Control) & A05:2021 (Security Misconfiguration)
- **Evaluation Environment**:
  - Operating System: Linux x86_64 (Kernel 6.6.137+)
  - Runtime: Node.js v22.22.1 / PostgreSQL 16 (Local throwaway database `mill_ledger_audit_throwaway`)
  - Web Server Modes:
    - Production Static Server with compression (`audit/scripts/serve-production.js` on port 4173)
    - Express 5 API Server (`http://127.0.0.1:4000`)
  - Automated Tooling: Playwright v1.65.1 (Chromium headless), `curl` 8.5.0, Zod v3.25.76 Schema Validator
- **Saved Evidence Artifacts**:
  - Raw HTTP Curl Response Dumps:
    - Root `/`: [`audit/evidence/seo/raw-html-root.txt`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/raw-html-root.txt)
    - Login `/auth/login`: [`audit/evidence/seo/raw-html-login.txt`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/raw-html-login.txt)
    - Dashboard `/dashboard`: [`audit/evidence/seo/raw-html-dashboard.txt`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/raw-html-dashboard.txt)
    - Robots Exclusion `/robots.txt`: [`audit/evidence/seo/robots-txt-response.txt`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/robots-txt-response.txt)
    - Sitemap `/sitemap.xml`: [`audit/evidence/seo/sitemap-xml-response.txt`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/sitemap-xml-response.txt)
    - Soft 404 Verification `/non-existent-route-404-test`: [`audit/evidence/seo/soft-404-curl.txt`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/soft-404-curl.txt)
    - Trailing Slash Check `/auth/login/`: [`audit/evidence/seo/trailing-slash-curl.txt`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/trailing-slash-curl.txt)
    - Unauthenticated Redirect Trapping: [`audit/evidence/seo/unauth-unknown-path-redirect.txt`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/unauth-unknown-path-redirect.txt)
  - Structured Audit Summaries:
    - HTTP Layer Evidence: [`audit/evidence/seo/raw-http-summary.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/raw-http-summary.json)
    - Public DOM Inspection: [`audit/evidence/seo/rendered-dom-summary.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/rendered-dom-summary.json)
    - Authenticated ERP DOM Inspection: [`audit/evidence/seo/authenticated-routes-summary.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/authenticated-routes-summary.json)
    - Schema.org Validation Results: [`audit/evidence/seo/json-ld-schema-validation.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/json-ld-schema-validation.json)
  - Visual Screenshots:
    - Login Desktop (1280x800): [`audit/evidence/seo/login-desktop.png`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/login-desktop.png)
    - Login Mobile (390x844): [`audit/evidence/seo/login-mobile.png`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/login-mobile.png)
    - Login Tamil Localization: [`audit/evidence/seo/login-tamil.png`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/login-tamil.png)
    - Authenticated Dashboard: [`audit/evidence/seo/dashboard-authenticated.png`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/dashboard-authenticated.png)
    - Authenticated 404 View: [`audit/evidence/seo/not-found-authenticated.png`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/not-found-authenticated.png)
  - Full Rendered DOM Snapshots:
    - Login Page DOM: [`audit/evidence/seo/login-rendered.html`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/login-rendered.html)
    - Authenticated Dashboard DOM: [`audit/evidence/seo/dashboard-authenticated-rendered.html`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/dashboard-authenticated-rendered.html)

---

## 1. Executive Summary

Phase 12 conducted an empirical audit of search engine metadata, crawler exclusion rules, HTTP status semantics, rendered DOM hygiene, and public vs. authenticated surface boundaries in MillLedger.

### Realistic Architecture Principle
MillLedger is primarily an internal food manufacturing ERP, production tracker, and shop floor ledger. Authenticated views (`/dashboard`, `/orders`, `/stock`, `/invoices`, `/production`, `/reports`) must **never** be indexed by public search engines. Conversely, any public gateway or marketing surface must provide complete, valid semantic metadata, social cards, and schema declarations.

### Key Audit Findings:
1. **Critical Absence of `noindex` on Authenticated Routes ([F-088](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-088.md), P1)**: 100% of internal ERP routes (`/dashboard`, `/orders`, `/stock`, `/reports/sales`, etc.) lack `<meta name="robots" content="noindex, nofollow">` in the DOM and omit the `X-Robots-Tag: noindex, nofollow` HTTP header. This directly violates REQ-062 and Owner Decision 2.
2. **Missing `robots.txt` and `sitemap.xml` with HTML 200 Fallback ([F-089](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-089.md), P2)**: Neither `/robots.txt` nor `/sitemap.xml` exists on disk. Crawlers requesting these standard endpoints receive HTTP 200 OK with the full SPA HTML shell (`text/html`), causing REP crawler parse failures.
3. **Severe Soft 404 Status & Unauthenticated Redirect Hijacking ([F-090](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-090.md), P1)**: HTTP requests to unknown URLs return HTTP 200 OK with the SPA shell instead of HTTP 404. Furthermore, unauthenticated browser navigation to any non-existent route is intercepted by `AuthenticatedLayout` and bounced to `/auth/login`, completely hiding 404 responses from users and bots.
4. **Statically Frozen `<title>` & Complete Metadata Void ([F-091](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-091.md), P1)**: The document `<title>` remains statically frozen as `"MillLedger | Order-to-Audit System for a Small Food Manufacturer"` across every route, failing WCAG 2.2 SC 2.4.2 (Level A). Meta descriptions, canonical link tags, Open Graph tags, Twitter cards, social preview images (1200x630), and `hreflang` tags are 100% absent.
5. **Intranet-Only Architecture Without Public Business Surfaces ([F-092](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-092.md), P2)**: The application possesses exactly **one** public route (`/auth/login`). Root `/` automatically redirects to `/dashboard` which bounces to `/auth/login`. There is no public landing page, no B2B product catalog (e.g. milled rice varieties, bag sizes), and no mandi intake/contact surface for farmers.
6. **Omission of Schema.org JSON-LD and Semantic `<main>` Landmark ([F-093](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-093.md), P2)**: The public login surface renders entirely within generic `<div>` tags without a semantic `<main>` landmark (violating WCAG 2.2 SC 1.3.1), contains 0 hyperlinks, and provides no Schema.org JSON-LD structured data.

---

## 2. Public vs. Authenticated Surface Inventory & Recommendations

### Current State Analysis
A thorough inspection of [`client/src/app.tsx`](file:///home/snehan/projects/web/mill-ledger/client/src/app.tsx#L50-L205) reveals that the current application codebase exposes:
- **Public Routes**: Exactly 1 route: [`/auth/login`](file:///home/snehan/projects/web/mill-ledger/client/src/pages/login-page.tsx).
- **Authenticated Routes**: 20 routes nested under [`AuthenticatedLayout`](file:///home/snehan/projects/web/mill-ledger/client/src/layouts/authenticated-layout.tsx) (`/`, `/dashboard`, `/orders`, `/orders/new`, `/invoices`, `/dispatch`, `/payments`, `/stock`, `/purchases`, `/production/today`, `/production/new`, `/production/history`, `/customers`, `/reports/sales`, `/reports/stock`, `/reports/production`, `/reports/receivables`, `/reports/gst`, `/reports/audit`, `/exports`, `/settings`, `/showcase`, `*`).

There are **no** public marketing pages, no public landing view, no B2B product catalog, and no mill contact/mandi procurement surface.

### Recommended Public Surfaces (With Rationale)
To satisfy Owner Decision 2 ("Public landing pages may be indexed") without inventing unnecessary application bloat, the following four public surfaces are recommended:

| Proposed Public Surface | URI Path | Required Contents | Business & Search Rationale |
| :--- | :--- | :--- | :--- |
| **Public Landing Surface** | `/` | Mill identity (e.g. Modern Rice Mill / Food Processing Facility), operational capacity, sortex grading technology, quality certifications (FSSAI license, ISO 22000), and dual action buttons: "B2B Wholesale Inquiries" and "Staff ERP Login". | Establishes legal entity legitimacy for mandi traders, institutional buyers, and commercial banks without exposing internal ledger data. |
| **Public B2B Product Catalog** | `/products` or `/catalog` | Non-confidential B2B SKU specifications (e.g. Ponni Boiled Rice, Sona Masoori Raw Rice, Broken Rice 100%, De-oiled Rice Bran 16% oil content, Rice Husk), standard packing units (25kg, 50kg poly bags), moisture and purity benchmarks. | Captures organic wholesale search traffic for grain procurers while customer-specific contract prices remain strictly locked within authenticated ERP price lists. |
| **Mandi Intake & Mill Gate Contact** | `/contact` or `/mandi-intake` | Physical mill address, geo-coordinates, mill gate weighbridge operating hours, paddy procurement contact numbers for local farmers, GSTIN, and inquiry submission form. | Mandatory for LocalBusiness schema validation, Google Maps local pack visibility, and local farmer paddy harvest intake coordination. |
| **Public Authentication Gateway** | `/auth/login` | Dedicated login interface with clean semantic landmarks (`<main>`), password assistance link, remove hardcoded demo seed credentials from production builds, and explicit `index, follow` or `noindex` policy aligned with corporate IT standards. | Provides an authenticated entry point for mobile salesmen, mill operators, and accountants while presenting a dignified brand presence. |

---

## 3. SEO, Metadata & Protocol Audit Verification Matrix

Every check below has been executed against real HTTP responses (using `curl` and Playwright's `APIRequestContext`) and real rendered DOM states in Chromium.

| Check | Standard / Requirement | Expected Behavior | Actual Measured (curl / DOM / Screenshot) | Result | Finding |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Authenticated Route noindex (DOM)** | REQ-062, Owner Decision 2 | `<meta name="robots" content="noindex, nofollow">` present in DOM on all authenticated routes | `document.querySelector('meta[name="robots"]')` returns `null` across `/dashboard`, `/orders`, `/stock`, `/reports/sales` | **VERIFIED-FAIL** | [F-088](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-088.md) |
| **Authenticated Route X-Robots-Tag** | RFC 9309, Google Search Central | `X-Robots-Tag: noindex, nofollow` HTTP response header on private routes | Response header `x-robots-tag` is `null` in [`raw-html-dashboard.txt`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/raw-html-dashboard.txt#L1-L10) | **VERIFIED-FAIL** | [F-088](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-088.md) |
| **Robots Exclusion (`robots.txt`)** | RFC 9309 | `GET /robots.txt` returns HTTP 200 `text/plain` disallowing private ERP routes | `GET /robots.txt` returns HTTP 200 OK with `Content-Type: text/html` returning HTML SPA document ([`robots-txt-response.txt`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/robots-txt-response.txt#L1-L10)) | **VERIFIED-FAIL** | [F-089](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-089.md) |
| **Raw HTML Data Leakage** | OWASP Top 10 A01:2021 | Raw HTML must not contain customer names, order totals, or sensitive business state | Raw HTML contains only `<div id="root"></div>` and script references; zero ledger data exposed in initial document ([`raw-html-dashboard.txt`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/raw-html-dashboard.txt#L20-L30)) | **VERIFIED-PASS** | - |
| **Client Bundle Secret Leakage** | OWASP Top 10 A02:2021 | Client JS bundle must not contain hardcoded account passwords | Plain-text passwords `"AdminPassword123!"` and `"StaffPassword123!"` compiled into bundle chunk `client/dist/assets/login-page-*.js` | **VERIFIED-FAIL** | (Noted in Phase 5) |
| **Unique `<title>` per View** | WCAG 2.2 SC 2.4.2 (Level A), REQ-062 | Title dynamically describes active view (e.g. "Overview \| MillLedger", "Orders \| MillLedger") | `<title>` is statically frozen as `"MillLedger \| Order-to-Audit System for a Small Food Manufacturer"` across all views ([`authenticated-routes-summary.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/authenticated-routes-summary.json#L3-L25)) | **VERIFIED-FAIL** | [F-091](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-091.md) |
| **Meta Description** | Google Search Central Snippets | Unique, descriptive `<meta name="description">` on public pages | `document.querySelector('meta[name="description"]')` returns `null` on `/auth/login` ([`rendered-dom-summary.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/rendered-dom-summary.json#L4)) | **VERIFIED-FAIL** | [F-091](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-091.md) |
| **Single `<h1>` on Public Page** | WCAG 2.2 SC 1.3.1, HTML5 Spec | Exactly one `<h1>` heading identifying page purpose | Exactly one `<h1>` rendered: `"Sign in to MillLedger"` (en) / `"ஆலை ஏடு உள்நுழைவு"` (ta) ([`login-desktop.png`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/login-desktop.png)) | **VERIFIED-PASS** | - |
| **Canonical Link Tag** | RFC 6596 | `<link rel="canonical" href="...">` pointing to preferred URI | `document.querySelector('link[rel="canonical"]')` returns `null` ([`rendered-dom-summary.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/rendered-dom-summary.json#L5)) | **VERIFIED-FAIL** | [F-091](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-091.md) |
| **Open Graph Tags (`og:*`)** | Open Graph Protocol (`ogp.me`) | `og:title`, `og:description`, `og:image`, `og:url`, `og:type` present | All `meta[property^="og:"]` tags return `null` in both raw HTML and rendered DOM ([`rendered-dom-summary.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/rendered-dom-summary.json#L8-L12)) | **VERIFIED-FAIL** | [F-091](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-091.md) |
| **Twitter Card Tags (`twitter:*`)** | Twitter Cards Spec | `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image` present | All `meta[name^="twitter:"]` tags return `null` in both raw HTML and rendered DOM ([`rendered-dom-summary.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/rendered-dom-summary.json#L13-L16)) | **VERIFIED-FAIL** | [F-091](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-091.md) |
| **Social Preview Image (1200x630)** | Social Platform Specifications | Dedicated 1200x630 social preview image file exists | Zero social preview images exist in `client/public/` or `client/src/assets/` | **VERIFIED-FAIL** | [F-091](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-091.md) |
| **Hreflang Tags (en and ta)** | Google Search Central `hreflang` | `<link rel="alternate" hreflang="en">` and `hreflang="ta"` tags present | `document.querySelectorAll('link[rel="alternate"][hreflang]')` returns `0` tags ([`rendered-dom-summary.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/rendered-dom-summary.json#L17)) | **VERIFIED-FAIL** | [F-091](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-091.md) |
| **XML Sitemap (`sitemap.xml`)** | Sitemaps XML Protocol 0.9 | `GET /sitemap.xml` returns valid XML document listing canonical URLs | `GET /sitemap.xml` returns HTTP 200 OK with `text/html` returning the HTML SPA shell ([`sitemap-xml-response.txt`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/sitemap-xml-response.txt#L1-L10)) | **VERIFIED-FAIL** | [F-089](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-089.md) |
| **JSON-LD Structured Data** | Schema.org, Google Search Central | Valid JSON-LD declaring `Organization`, `LocalBusiness`, or `SoftwareApplication` | `document.querySelectorAll('script[type="application/ld+json"]')` returns `0` scripts in application code | **VERIFIED-FAIL** | [F-093](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-093.md) |
| **Semantic Landmarks on Public Page** | WCAG 2.2 SC 1.3.1 (Level A) | Page content structured within `<main>`, `<header>`, `<footer>` landmarks | `main: false, header: false, nav: false, footer: false`. The entire login card is wrapped in a generic `<div>` ([`rendered-dom-summary.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/rendered-dom-summary.json#L24-L29)) | **VERIFIED-FAIL** | [F-093](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-093.md) |
| **Descriptive Link Text** | WCAG 2.2 SC 2.4.4 (Level A) | Meaningful hyperlinks for navigation, policies, and assistance | `links.count: 0`. The login page contains zero `<a>` tags ([`rendered-dom-summary.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/rendered-dom-summary.json#L30-L33)) | **VERIFIED-FAIL** | [F-093](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-093.md) |
| **Image Alt Attributes** | WCAG 2.2 SC 1.1.1 (Level A) | All informative images have descriptive `alt` text | `images.count: 0`. Login page uses SVG icons marked with `aria-hidden="true"`; no untagged images | **VERIFIED-PASS** | - |
| **Clean URLs** | RFC 3986, Clean URL Conventions | Human-readable pathnames without query parameters or file extensions | Route `/auth/login` is a clean semantic pathname | **VERIFIED-PASS** | - |
| **HTTP 404 Status on Unknown Paths** | RFC 9110 Section 15.5.5 | Server returns status `404 Not Found` for unmapped paths | `curl -i http://127.0.0.1:4173/non-existent-route-404-test` returns `HTTP/1.1 200 OK` (Soft 404) ([`soft-404-curl.txt`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/soft-404-curl.txt#L1-L10)) | **VERIFIED-FAIL** | [F-090](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-090.md) |
| **Unauthenticated 404 Routing** | RFC 9110, UI Error Architecture | Browser shows 404 page when navigating to invalid URL | Navigating to `/non-existent-random-route-999` redirects to `/auth/login` instead of showing `NotFoundPage` ([`unauth-unknown-path-redirect.txt`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/unauth-unknown-path-redirect.txt)) | **VERIFIED-FAIL** | [F-090](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-090.md) |
| **Trailing Slash Consistency (301 Redirect)** | Google Search Central URL Structure | Trailing slash URL (e.g. `/auth/login/`) issues HTTP 301 redirect to canonical `/auth/login` | `curl -i http://127.0.0.1:4173/auth/login/` returns HTTP 200 OK with duplicate SPA content; no 301 redirect ([`trailing-slash-curl.txt`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/trailing-slash-curl.txt#L1-L10)) | **VERIFIED-FAIL** | [F-090](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-090.md) |
| **SPA Raw HTML Rendering** | Googlebot Rendering Guidelines | Raw HTML contains meaningful text content for web crawlers | Raw HTML contains an empty `<div id="root"></div>`; crawlers without JavaScript execution see an entirely blank page ([`raw-html-login.txt`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/raw-html-login.txt#L30)) | **VERIFIED-FAIL** | (Section 5) |
| **Favicon Set** | HTML5, Apple HIG | `favicon.ico` (multi-resolution), `favicon.svg`, `apple-touch-icon.png` (180x180) | `favicon.ico` (16x16, 32x32), `favicon.svg` (vector), `apple-touch-icon.png` (180x180 PNG) present and verified with `file` command | **VERIFIED-PASS** | - |
| **PWA Manifest Icons** | W3C Web App Manifest | `pwa-192x192.png` and `pwa-512x512.png` valid image assets | Both files exist in `client/public/` and serve valid 192x192 and 512x512 PNGs with HTTP 200 | **VERIFIED-PASS** | - |
| **Web App Manifest (`manifest.webmanifest`)** | W3C Web App Manifest | Valid JSON declaring name, short_name, start_url, display, theme_color, icons | Manifest returns HTTP 200, valid JSON with `name: "MillLedger ERP"`, `theme_color: "#176b54"`, standalone display ([`raw-http-summary.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/raw-http-summary.json#L44-L54)) | **VERIFIED-PASS** | - |
| **Theme Color Meta Tag** | HTML5 / Chrome Web Standards | `<meta name="theme-color" content="#176b54">` in head | Tag present with exact brand primary color `#176b54` in raw HTML and rendered DOM | **VERIFIED-PASS** | - |
| **Core Web Vitals on Public Surface** | Google Core Web Vitals (LCP < 2.5s, CLS < 0.1, INP < 200ms) | Public login surface passes all Core Web Vitals thresholds under 4G mobile emulation | LCP: **1.10s** (Pass), CLS: **0.0000** (Pass), INP (TBT): **0ms** (Pass), TTFB: **10ms** (Pass) ([`login.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/lighthouse/login.json)) | **VERIFIED-PASS** | - |

---

## 4. Deep-Dive: Authenticated ERP Routes `noindex` & Information Leakage

### The Indexing Exposure Hazard
MillLedger houses confidential business records: sales order prices, live grain inventory balances, supplier procurement weighments, customer credit limits, and GSTR-1 tax filings.

While authentication controls correctly redirect unauthenticated users in the browser, search engines and security scrapers index URLs and metadata via automated HTTP GET requests.

### Empirical Evidence
1. **Raw HTTP Response**:
   ```bash
   $ curl -i http://127.0.0.1:4173/dashboard
   HTTP/1.1 200 OK
   Content-Type: text/html; charset=utf-8
   Vary: Accept-Encoding
   Cache-Control: no-cache, no-store, must-revalidate
   Content-Length: 1281
   ```
   - Notice: **Zero `X-Robots-Tag` header**.
2. **Rendered Head Inspection**:
   ```javascript
   document.querySelector('meta[name="robots"]') // returns null
   ```
3. **Data Leakage in Raw HTML**:
   - In [`audit/evidence/seo/raw-html-dashboard.txt`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/raw-html-dashboard.txt), the raw HTML returned for `/dashboard` contains only:
     ```html
     <body>
       <div id="root"></div>
     </body>
     ```
   - **Conclusion on Leakage**: Raw HTML does not expose sensitive customer names, financial ledger numbers, or database secrets. The data is fetched asynchronously via API queries after client-side hydration. However, the absence of `noindex` allows the static title and URL paths to appear in public search indexes.

---

## 5. The SPA Rendering Problem & SSG / Prerendering Architecture Tradeoff

### Observed DOM State
When an HTTP client (curl, search engine crawler, or social media scraper) requests any route, the server returns the identical static template:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>MillLedger | Order-to-Audit System for a Small Food Manufacturer</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
```

### The Crawling & Scraping Failure
1. **Social Scrapers (WhatsApp, LinkedIn, Twitter/X, Slack, Telegram)**:
   - Social scrapers **do not execute JavaScript**. When a user shares a link to `/auth/login` or a future product catalog page, the scraper parses raw HTML only.
   - Because raw HTML has an empty `<div>`, no meta description, and no `og:image`, shared links display as a blank, unstyled grey box or a generic fallback.
2. **Search Crawlers with Constrained JS Rendering Budgets**:
   - Although Googlebot executes JavaScript in a two-stage rendering pipeline, rendering is deferred and subject to strict compute budgets. Crawlers seeing an empty `<div id="root"></div>` may classify the page as a blank or thin-content soft error.

### Architectural Evaluation: Prerendering (SSG) vs. Full SSR

| Technique | How It Works in Vite/React 19 | Tradeoffs & Performance Implications | Recommendation for MillLedger |
| :--- | :--- | :--- | :--- |
| **Pure Client-Side SPA (Current)** | Server returns empty `<div id="root"></div>`; browser fetches 257KB gzip JS to render. | **Pros**: Simple static hosting, zero backend compute per route request.<br>**Cons**: Zero social preview cards, blank raw HTML, soft 404 errors, crawl delay. | **Retain strictly for authenticated ERP views** (`/dashboard`, `/orders`, `/stock`, `/reports`). Internal operational views do not need public search rendering. |
| **Static Site Generation (SSG / Prerender)** | Static HTML files generated at build time (`vite-plugin-ssg` or static generation script) for public routes only. | **Pros**: Sub-millisecond TTFB, 100% CDN cacheable, instant social link unfurling, perfect crawler indexing, 0 runtime Node.js overhead.<br>**Cons**: Build step required when product catalog specifications change. | **STRONGLY RECOMMENDED for public surfaces only** (`/`, `/products`, `/contact`, `/auth/login`). Generates static HTML containing pre-populated `<title>`, `<meta>`, Open Graph tags, and readable text. |
| **Full Server-Side Rendering (SSR)** | Express backend renders React component tree to string on every incoming HTTP request (`renderToString`). | **Pros**: Dynamic real-time content rendering.<br>**Cons**: Substantial server CPU overhead, higher TTFB latency, hydration mismatch complexity, requires maintaining an SSR Express runtime. | **NOT RECOMMENDED**. Adds unnecessary architectural fragility and server load to a food mill ledger whose operational core is authenticated and offline-first. |

---

## 6. JSON-LD Structured Data & Schema Validation Results

To satisfy Google Rich Results guidelines and Schema.org specifications for food processing mills, structured data definitions were drafted and validated against strict schema constraints using Zod in [`audit/scripts/validate-json-ld.ts`](file:///home/snehan/projects/web/mill-ledger/audit/scripts/validate-json-ld.ts).

### Validation Results Summary
All three recommended schemas achieved **100% syntactic and structural validation** ([`audit/evidence/seo/json-ld-schema-validation.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/seo/json-ld-schema-validation.json)):
```json
{
  "validator": "Zod Schema.org Validator",
  "results": {
    "organization": { "type": "https://schema.org/Organization", "valid": true, "errors": null },
    "localBusiness": { "type": "https://schema.org/LocalBusiness", "valid": true, "errors": null },
    "product": { "type": "https://schema.org/Product", "valid": true, "errors": null }
  }
}
```

### 1. Recommended `Organization` Schema (for `/` and `/auth/login`)
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "MillLedger Modern Rice Mill",
  "legalName": "MillLedger Food Processing Pvt Ltd",
  "url": "https://millledger.local",
  "logo": "https://millledger.local/apple-touch-icon.png",
  "description": "Order-to-Audit food manufacturing mill and modern grain processing facility.",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Mandi Gate Industrial Corridor",
    "addressLocality": "Thanjavur",
    "addressRegion": "Tamil Nadu",
    "postalCode": "613001",
    "addressCountry": "IN"
  },
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+91-4362-200000",
    "contactType": "B2B Sales and Mandi Intake",
    "availableLanguage": ["English", "Tamil"]
  }
}
```

### 2. Recommended `LocalBusiness` Schema (for `/contact`)
```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "MillLedger Modern Rice Mill",
  "image": "https://millledger.local/apple-touch-icon.png",
  "@id": "https://millledger.local/#mill",
  "url": "https://millledger.local",
  "telephone": "+91-4362-200000",
  "priceRange": "₹₹₹",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Mandi Gate Industrial Corridor",
    "addressLocality": "Thanjavur",
    "addressRegion": "Tamil Nadu",
    "postalCode": "613001",
    "addressCountry": "IN"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 10.787,
    "longitude": 79.1378
  },
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      "opens": "08:00",
      "closes": "19:00"
    }
  ]
}
```

### 3. Recommended `Product` Schema (for `/products/ponni-boiled-50kg`)
```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Ponni Boiled Rice (Sortex Cleaned, 50kg)",
  "image": "https://millledger.local/products/ponni-boiled-50kg.webp",
  "description": "Premium single-boiled Ponni rice milled and sortex-cleaned in Tamil Nadu.",
  "sku": "FG-RICE-PONNI-50KG",
  "category": "Grain Supplies > Milled Rice",
  "brand": {
    "@type": "Brand",
    "name": "MillLedger Gold"
  },
  "offers": {
    "@type": "Offer",
    "url": "https://millledger.local/products/ponni-boiled-50kg",
    "priceCurrency": "INR",
    "price": "2450.00",
    "availability": "https://schema.org/InStock",
    "itemCondition": "https://schema.org/NewCondition"
  }
}
```

---

## 7. Core Web Vitals on Public Surface (Link to Phase 10 Data)

Cross-referencing the empirical performance measurements gathered in [`audit/phase-10-performance.md`](file:///home/snehan/projects/web/mill-ledger/audit/phase-10-performance.md#L45-L65) and raw Lighthouse JSON in [`audit/evidence/performance/lighthouse/login.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/lighthouse/login.json):

All metrics were captured under standard mobile throttling (4x CPU slowdown, Slow 4G Network: 150ms RTT, 1.6 Mbps download):

| Core Web Vital Metric | Google Standard Threshold | Measured on Public Login (`/auth/login`) | Status | Evidence Source |
| :--- | :--- | :--- | :--- | :--- |
| **Largest Contentful Paint (LCP)** | < 2.5 s | **1.10 s** (-1.40 s within budget) | **VERIFIED-PASS** | [`login.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/lighthouse/login.json) |
| **Cumulative Layout Shift (CLS)** | < 0.1 | **0.0000** (0 layout shifts) | **VERIFIED-PASS** | [`login.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/lighthouse/login.json) |
| **Interaction to Next Paint (TBT Proxy)** | < 200 ms | **0 ms** (0 blocking thread time) | **VERIFIED-PASS** | [`login.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/lighthouse/login.json) |
| **Time to First Byte (TTFB)** | < 800 ms | **10 ms** (-790 ms within budget) | **VERIFIED-PASS** | [`login.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/lighthouse/login.json) |
| **First Contentful Paint (FCP)** | < 1.8 s | **1.10 s** | **VERIFIED-PASS** | [`login.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/lighthouse/login.json) |
| **Speed Index (SI)** | < 3.4 s | **2.90 s** | **VERIFIED-PASS** | [`login.json`](file:///home/snehan/projects/web/mill-ledger/audit/evidence/performance/lighthouse/login.json) |

### Performance Evaluation
The public login surface (`/auth/login`) is exceptionally fast and fully compliant with Google Core Web Vitals thresholds. Because it loads a minimal component tree without querying bulky database tables, it achieves a **99/100 Lighthouse Performance Score**.

---

## 8. Coverage and Non-Covered Scope (Rule E8)

### Evaluated Routes and Endpoints (14 total)
1. `/` (Root redirect / raw HTML) - Tested
2. `/auth/login` (Public login gateway / rendered DOM / Tamil toggle) - Tested
3. `/dashboard` (Authenticated ERP Overview) - Tested
4. `/orders` (Sales order capture) - Tested
5. `/orders/new` (Order booking form) - Tested
6. `/stock` (Live stock ledger) - Tested
7. `/purchases` (Procurement weighment) - Tested
8. `/production/today` (Live milling run) - Tested
9. `/invoices` (Sales invoicing) - Tested
10. `/dispatch` (Vehicle gate pass) - Tested
11. `/payments` (Payment receipts) - Tested
12. `/reports/sales` (Turnover reports) - Tested
13. `/robots.txt` (REP crawler endpoint) - Tested
14. `/sitemap.xml` (Search engine sitemap) - Tested

### Evaluated Protocols & Assets (8 total)
1. `GET /manifest.webmanifest` - Tested
2. `GET /favicon.ico` - Tested
3. `GET /favicon.svg` - Tested
4. `GET /apple-touch-icon.png` - Tested
5. `GET /pwa-192x192.png` - Tested
6. `GET /pwa-512x512.png` - Tested
7. `GET /non-existent-route-404-test` (Soft 404 verification) - Tested
8. `GET /auth/login/` (Trailing slash redirect check) - Tested

### Not Covered in Phase 12
- Third-party search engine index submissions (Google Search Console API, Bing Webmaster API).
- Production reverse-proxy edge CDN cache invalidation (Cloudflare/CloudFront edge rules).

---

## 9. Findings Index

| Finding ID | Title | Severity | Category | Status |
| :--- | :--- | :--- | :--- | :--- |
| **[F-088](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-088.md)** | Absence of `noindex` Robots Protection and `X-Robots-Tag` Across Authenticated ERP Routes | P1 | Security Architecture / Robots Protection | **OPEN** |
| **[F-089](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-089.md)** | Missing `robots.txt` and `sitemap.xml` with Server Returning HTTP 200 HTML SPA Shell | P2 | Technical SEO / Standards Compliance | **OPEN** |
| **[F-090](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-090.md)** | Soft 404 Status and Unauthenticated Redirect Hijacking on Non-Existent Routes | P1 | HTTP Semantics & Router Architecture | **OPEN** |
| **[F-091](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-091.md)** | Statically Frozen `<title>` and Total Omission of Essential SEO & Social Metadata | P1 | Accessibility (WCAG 2.2 AA) & SEO Architecture | **OPEN** |
| **[F-092](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-092.md)** | Missing Public Marketing, Landing, Catalog, and Contact Surfaces | P2 | Product Architecture & Web Discovery | **OPEN** |
| **[F-093](file:///home/snehan/projects/web/mill-ledger/audit/findings/F-093.md)** | Absence of Schema.org JSON-LD Structured Data and Semantic `<main>` Landmark on Login Surface | P2 | Accessibility (WCAG 2.2 AA) & Semantic Web | **OPEN** |
