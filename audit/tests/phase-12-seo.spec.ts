import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const EVIDENCE_DIR = path.resolve(process.cwd(), "audit/evidence/seo");

test.beforeAll(() => {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
});

test.describe("Phase 12: SEO, Robots & Public vs Authenticated Surfaces", () => {
  test("1. Raw HTTP response verification (curl / APIRequestContext)", async ({
    request,
  }) => {
    const rawResults: Record<string, unknown> = {};

    // 1.1 Root route GET /
    const rootRes = await request.get("/");
    const rootStatus = rootRes.status();
    const rootHeaders = rootRes.headers();
    const rootBody = await rootRes.text();
    rawResults.root = {
      status: rootStatus,
      contentType: rootHeaders["content-type"],
      xRobotsTag: rootHeaders["x-robots-tag"] || null,
      hasRootDiv: rootBody.includes('<div id="root"></div>'),
      hasPrerenderedContent:
        rootBody.includes("Sign in") || rootBody.includes("Dashboard"),
      hasRobotsMeta: rootBody.includes('name="robots"'),
    };
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, "raw-html-root.txt"),
      `HTTP/1.1 ${rootStatus}\n${Object.entries(rootHeaders)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n")}\n\n${rootBody}`,
    );

    // 1.2 Login route GET /auth/login
    const loginRes = await request.get("/auth/login");
    const loginStatus = loginRes.status();
    const loginHeaders = loginRes.headers();
    const loginBody = await loginRes.text();
    rawResults.login = {
      status: loginStatus,
      contentType: loginHeaders["content-type"],
      xRobotsTag: loginHeaders["x-robots-tag"] || null,
      hasRootDiv: loginBody.includes('<div id="root"></div>'),
      hasMetaDescription: loginBody.includes('name="description"'),
      hasCanonical: loginBody.includes('rel="canonical"'),
      hasOgTitle: loginBody.includes('property="og:title"'),
      hasTwitterCard: loginBody.includes('name="twitter:card"'),
      hasHreflang: loginBody.includes('hreflang="'),
      hasJsonLd: loginBody.includes('application/ld+json'),
      themeColor:
        loginBody.match(/name="theme-color" content="([^"]+)"/)?.[1] || null,
      title: loginBody.match(/<title>([^<]+)<\/title>/)?.[1]?.trim() || null,
    };
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, "raw-html-login.txt"),
      `HTTP/1.1 ${loginStatus}\n${Object.entries(loginHeaders)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n")}\n\n${loginBody}`,
    );

    // 1.3 Authenticated route GET /dashboard (raw request without session)
    const dashRes = await request.get("/dashboard");
    const dashStatus = dashRes.status();
    const dashHeaders = dashRes.headers();
    const dashBody = await dashRes.text();
    rawResults.dashboard = {
      status: dashStatus,
      contentType: dashHeaders["content-type"],
      xRobotsTag: dashHeaders["x-robots-tag"] || null,
      hasSensitiveData:
        dashBody.includes("invoice") ||
        dashBody.includes("customer") ||
        dashBody.includes("revenue"),
      hasNoindexMeta: dashBody.includes('content="noindex'),
    };
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, "raw-html-dashboard.txt"),
      `HTTP/1.1 ${dashStatus}\n${Object.entries(dashHeaders)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n")}\n\n${dashBody}`,
    );

    // 1.4 robots.txt GET /robots.txt
    const robotsRes = await request.get("/robots.txt");
    const robotsStatus = robotsRes.status();
    const robotsHeaders = robotsRes.headers();
    const robotsBody = await robotsRes.text();
    rawResults.robotsTxt = {
      status: robotsStatus,
      contentType: robotsHeaders["content-type"],
      isHtmlFallback:
        robotsBody.includes("<!doctype html>") || robotsBody.includes("<html"),
      containsDisallow: robotsBody.toLowerCase().includes("disallow:"),
    };
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, "robots-txt-response.txt"),
      `HTTP/1.1 ${robotsStatus}\n${Object.entries(robotsHeaders)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n")}\n\n${robotsBody.slice(0, 500)}`,
    );

    // 1.5 sitemap.xml GET /sitemap.xml
    const sitemapRes = await request.get("/sitemap.xml");
    const sitemapStatus = sitemapRes.status();
    const sitemapHeaders = sitemapRes.headers();
    const sitemapBody = await sitemapRes.text();
    rawResults.sitemapXml = {
      status: sitemapStatus,
      contentType: sitemapHeaders["content-type"],
      isHtmlFallback:
        sitemapBody.includes("<!doctype html>") || sitemapBody.includes("<html"),
      isValidXml: sitemapBody.includes("<?xml") && sitemapBody.includes("<urlset"),
    };
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, "sitemap-xml-response.txt"),
      `HTTP/1.1 ${sitemapStatus}\n${Object.entries(sitemapHeaders)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n")}\n\n${sitemapBody.slice(0, 500)}`,
    );

    // 1.6 Soft 404 test on unknown path GET /non-existent-route-404-test
    const unknownRes = await request.get("/non-existent-route-404-test");
    const unknownStatus = unknownRes.status();
    const unknownHeaders = unknownRes.headers();
    const unknownBody = await unknownRes.text();
    rawResults.unknownPath = {
      status: unknownStatus,
      isSoft404:
        unknownStatus === 200 && unknownBody.includes('<div id="root"></div>'),
    };
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, "soft-404-curl.txt"),
      `HTTP/1.1 ${unknownStatus}\n${Object.entries(unknownHeaders)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n")}\n\n${unknownBody.slice(0, 500)}`,
    );

    // 1.7 Trailing slash consistency GET /auth/login/
    const trailingRes = await request.get("/auth/login/", {
      maxRedirects: 0,
    });
    const trailingStatus = trailingRes.status();
    const trailingHeaders = trailingRes.headers();
    rawResults.trailingSlash = {
      status: trailingStatus,
      location: trailingHeaders["location"] || null,
      is301Redirect: trailingStatus === 301,
    };
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, "trailing-slash-curl.txt"),
      `HTTP/1.1 ${trailingStatus}\n${Object.entries(trailingHeaders)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n")}`,
    );

    // 1.8 Web App Manifest GET /manifest.webmanifest
    const manifestRes = await request.get("/manifest.webmanifest");
    const manifestStatus = manifestRes.status();
    let manifestJson = null;
    try {
      manifestJson = await manifestRes.json();
    } catch {
      // ignore
    }
    rawResults.manifest = {
      status: manifestStatus,
      hasValidJson: manifestJson !== null,
      name: manifestJson?.name,
      short_name: manifestJson?.short_name,
      start_url: manifestJson?.start_url,
      display: manifestJson?.display,
      theme_color: manifestJson?.theme_color,
      icons: manifestJson?.icons,
    };

    fs.writeFileSync(
      path.join(EVIDENCE_DIR, "raw-http-summary.json"),
      JSON.stringify(rawResults, null, 2),
    );
  });

  test("2. Public Login page rendered DOM verification", async ({ page }) => {
    await page.goto("/auth/login");
    await page.waitForSelector('input[name="email"]', { timeout: 10000 });
    await page.waitForSelector("h1", { timeout: 10000 });

    const domInspection = await page.evaluate(() => {
      const getMeta = (selector: string) =>
        document.querySelector(selector)?.getAttribute("content") || null;

      const hreflangs: Array<{ lang: string | null; href: string | null }> = [];
      document
        .querySelectorAll('link[rel="alternate"][hreflang]')
        .forEach((el) => {
          hreflangs.push({
            lang: el.getAttribute("hreflang"),
            href: el.getAttribute("href"),
          });
        });

      const jsonLdPayloads: unknown[] = [];
      document
        .querySelectorAll('script[type="application/ld+json"]')
        .forEach((el) => {
          try {
            jsonLdPayloads.push(JSON.parse(el.textContent || ""));
          } catch {
            jsonLdPayloads.push({ raw: el.textContent, error: "Invalid JSON" });
          }
        });

      const h1Els = Array.from(document.querySelectorAll("h1"));
      const h1Texts = h1Els.map((h) => h.textContent?.trim() || "");

      const linkEls = Array.from(document.querySelectorAll("a"));
      const linkDetails = linkEls.map((a) => ({
        href: a.getAttribute("href"),
        text: a.textContent?.trim() || null,
      }));

      const imgEls = Array.from(document.querySelectorAll("img"));
      const imgDetails = imgEls.map((img) => ({
        src: img.getAttribute("src"),
        alt: img.getAttribute("alt"),
      }));

      return {
        title: document.title,
        htmlLang: document.documentElement.lang,
        metaDescription: getMeta('meta[name="description"]'),
        canonical:
          document.querySelector('link[rel="canonical"]')?.getAttribute("href") ||
          null,
        metaRobots: getMeta('meta[name="robots"]'),
        themeColor: getMeta('meta[name="theme-color"]'),
        ogTitle: getMeta('meta[property="og:title"]'),
        ogDescription: getMeta('meta[property="og:description"]'),
        ogImage: getMeta('meta[property="og:image"]'),
        ogUrl: getMeta('meta[property="og:url"]'),
        ogType: getMeta('meta[property="og:type"]'),
        twitterCard: getMeta('meta[name="twitter:card"]'),
        twitterTitle: getMeta('meta[name="twitter:title"]'),
        twitterDescription: getMeta('meta[name="twitter:description"]'),
        twitterImage: getMeta('meta[name="twitter:image"]'),
        hreflangs,
        jsonLdPayloads,
        h1Count: h1Els.length,
        h1Texts,
        landmarks: {
          main: document.querySelector("main") !== null,
          header: document.querySelector("header") !== null,
          nav: document.querySelector("nav") !== null,
          footer: document.querySelector("footer") !== null,
        },
        links: {
          count: linkEls.length,
          details: linkDetails,
        },
        images: {
          count: imgEls.length,
          details: imgDetails,
        },
      };
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, "login-desktop.png"),
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, "login-mobile.png"),
      fullPage: true,
    });

    const renderedHtml = await page.content();
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, "login-rendered.html"),
      renderedHtml,
    );

    // Test Tamil switch
    await page.setViewportSize({ width: 1280, height: 800 });
    const taBtn = page.locator('button:has-text("தமிழ்")');
    if ((await taBtn.count()) > 0) {
      await taBtn.click();
      await page.waitForTimeout(400);
      const tamilInspection = await page.evaluate(() => ({
        title: document.title,
        htmlLang: document.documentElement.lang,
        h1: document.querySelector("h1")?.textContent?.trim() || null,
      }));
      Object.assign(domInspection, { tamil: tamilInspection });
      await page.screenshot({
        path: path.join(EVIDENCE_DIR, "login-tamil.png"),
        fullPage: true,
      });
    }

    fs.writeFileSync(
      path.join(EVIDENCE_DIR, "rendered-dom-summary.json"),
      JSON.stringify(domInspection, null, 2),
    );
  });

  test("3. Authenticated ERP routes verification (robots noindex & dynamic title)", async ({
    page,
  }) => {
    // 3.1 Unauthenticated attempt to hit an unknown route
    await page.goto("/non-existent-random-route-999");
    await page.waitForTimeout(500);
    const unauthUrl = page.url();
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, "unauth-unknown-path-redirect.txt"),
      `Requested /non-existent-random-route-999 -> Final URL: ${unauthUrl}`,
    );

    // 3.2 Clear state and login freshly
    await page.goto("/auth/login");
    await page.waitForSelector("input#email", { timeout: 10000 });

    await page.fill("input#email", "admin@millledger.local");
    await page.fill("input#password", "AdminPassword123!");
    await page.click('button[type="submit"]');

    // Wait until navigated out of /auth/login
    await page.waitForURL((url) => !url.pathname.includes("/auth/login"), {
      timeout: 10000,
    });
    // Navigate directly to dashboard
    await page.goto("/dashboard");
    await page.waitForTimeout(600);

    // 3.3 Dashboard checks
    const dashboardInspection = await page.evaluate(() => {
      const getMeta = (selector: string) =>
        document.querySelector(selector)?.getAttribute("content") || null;
      const h1Els = Array.from(document.querySelectorAll("h1"));
      return {
        title: document.title,
        metaRobots: getMeta('meta[name="robots"]'),
        h1Count: h1Els.length,
        h1Texts: h1Els.map((h) => h.textContent?.trim() || ""),
        landmarks: {
          main: document.querySelector("main") !== null,
          header: document.querySelector("header") !== null,
          nav: document.querySelector("nav") !== null,
        },
      };
    });

    await page.screenshot({
      path: path.join(EVIDENCE_DIR, "dashboard-authenticated.png"),
      fullPage: true,
    });
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, "dashboard-authenticated-rendered.html"),
      await page.content(),
    );

    // 3.4 Check other authenticated routes
    const routesToCheck = [
      { path: "/orders", name: "orders" },
      { path: "/stock", name: "stock" },
      { path: "/reports/sales", name: "reports-sales" },
    ];

    const routeAudits: Record<string, unknown> = {};
    for (const r of routesToCheck) {
      await page.goto(r.path);
      await page.waitForTimeout(600);
      routeAudits[r.name] = await page.evaluate(() => {
        const getMeta = (selector: string) =>
          document.querySelector(selector)?.getAttribute("content") || null;
        const h1Els = Array.from(document.querySelectorAll("h1"));
        return {
          title: document.title,
          metaRobots: getMeta('meta[name="robots"]'),
          h1Count: h1Els.length,
          h1Text: h1Els[0]?.textContent?.trim() || null,
        };
      });
    }

    // 3.5 Authenticated 404 test
    await page.goto("/non-existent-route-within-auth");
    await page.waitForTimeout(600);
    const authenticated404 = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        h1: document.querySelector("h1")?.textContent?.trim() || null,
        bodyTextSnippet: document.body.innerText.slice(0, 300),
      };
    });
    await page.screenshot({
      path: path.join(EVIDENCE_DIR, "not-found-authenticated.png"),
      fullPage: true,
    });

    fs.writeFileSync(
      path.join(EVIDENCE_DIR, "authenticated-routes-summary.json"),
      JSON.stringify(
        {
          dashboard: dashboardInspection,
          routes: routeAudits,
          authenticated404,
        },
        null,
        2,
      ),
    );
  });
});
