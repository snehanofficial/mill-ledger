import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(__dirname, "..");
const distDir = path.join(clientDir, "dist");
const ssrEntryPath = path.join(clientDir, "dist-ssr", "entry-prerender.js");

function loadAppUrl() {
  if (process.env.VITE_APP_URL) {
    return process.env.VITE_APP_URL.trim();
  }
  const envPath = path.join(clientDir, ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    const match = content.match(/^VITE_APP_URL=(.+)$/m);
    if (match?.[1]) {
      return match[1].trim().replace(/^["']|["']$/g, "");
    }
  }
  return "http://localhost:5173";
}

function escapeHtmlAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function replaceOrInsertTag(html, regex, replacement) {
  if (regex.test(html)) {
    return html.replace(regex, replacement);
  }
  return html.replace("</head>", `  ${replacement}\n  </head>`);
}

async function main() {
  if (!fs.existsSync(ssrEntryPath)) {
    throw new Error(`Missing SSR bundle at ${ssrEntryPath}`);
  }

  const templatePath = path.join(distDir, "index.html");
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Missing client build template at ${templatePath}`);
  }

  const templateHtml = fs.readFileSync(templatePath, "utf-8");
  const {
    PUBLIC_ROUTES,
    buildCanonicalUrl,
    buildStructuredDataGraph,
    normalizeBaseUrl,
    renderPublicRoute,
  } = await import(pathToFileURL(ssrEntryPath).href);

  const baseUrl = normalizeBaseUrl(loadAppUrl());
  const ogImageUrl = `${baseUrl}/og-preview.png`;

  for (const route of PUBLIC_ROUTES) {
    const renderedMarkup = renderPublicRoute(route.path);
    const canonicalUrl = buildCanonicalUrl(baseUrl, route.path);
    const jsonLd = JSON.stringify(buildStructuredDataGraph(route, baseUrl));

    let pageHtml = templateHtml.replace(
      '<div id="root"></div>',
      `<div id="root">${renderedMarkup}</div>`,
    );

    pageHtml = replaceOrInsertTag(
      pageHtml,
      /<title>[\s\S]*?<\/title>/i,
      `<title>${escapeHtmlAttr(route.title)}</title>`,
    );
    pageHtml = replaceOrInsertTag(
      pageHtml,
      /<meta\s+name="description"[\s\S]*?>/i,
      `<meta name="description" content="${escapeHtmlAttr(route.description)}" />`,
    );
    pageHtml = replaceOrInsertTag(
      pageHtml,
      /<meta\s+name="robots"[\s\S]*?>/i,
      `<meta name="robots" content="index, follow" />`,
    );
    pageHtml = replaceOrInsertTag(
      pageHtml,
      /<link\s+rel="canonical"[\s\S]*?>/i,
      `<link rel="canonical" href="${escapeHtmlAttr(canonicalUrl)}" />`,
    );
    pageHtml = replaceOrInsertTag(
      pageHtml,
      /<meta\s+property="og:type"[\s\S]*?>/i,
      `<meta property="og:type" content="${escapeHtmlAttr(route.ogType)}" />`,
    );
    pageHtml = replaceOrInsertTag(
      pageHtml,
      /<meta\s+property="og:title"[\s\S]*?>/i,
      `<meta property="og:title" content="${escapeHtmlAttr(route.title)}" />`,
    );
    pageHtml = replaceOrInsertTag(
      pageHtml,
      /<meta\s+property="og:description"[\s\S]*?>/i,
      `<meta property="og:description" content="${escapeHtmlAttr(route.description)}" />`,
    );
    pageHtml = replaceOrInsertTag(
      pageHtml,
      /<meta\s+property="og:url"[\s\S]*?>/i,
      `<meta property="og:url" content="${escapeHtmlAttr(canonicalUrl)}" />`,
    );
    pageHtml = replaceOrInsertTag(
      pageHtml,
      /<meta\s+property="og:image"[\s\S]*?>/i,
      `<meta property="og:image" content="${escapeHtmlAttr(ogImageUrl)}" />`,
    );
    pageHtml = replaceOrInsertTag(
      pageHtml,
      /<meta\s+name="twitter:title"[\s\S]*?>/i,
      `<meta name="twitter:title" content="${escapeHtmlAttr(route.title)}" />`,
    );
    pageHtml = replaceOrInsertTag(
      pageHtml,
      /<meta\s+name="twitter:description"[\s\S]*?>/i,
      `<meta name="twitter:description" content="${escapeHtmlAttr(route.description)}" />`,
    );
    pageHtml = replaceOrInsertTag(
      pageHtml,
      /<meta\s+name="twitter:image"[\s\S]*?>/i,
      `<meta name="twitter:image" content="${escapeHtmlAttr(ogImageUrl)}" />`,
    );
    pageHtml = replaceOrInsertTag(
      pageHtml,
      /<script[^>]*id="millledger-route-jsonld"[^>]*>[\s\S]*?<\/script>/i,
      `<script id="millledger-route-jsonld" type="application/ld+json">${jsonLd}</script>`,
    );

    if (route.path === "/") {
      fs.writeFileSync(path.join(distDir, "index.html"), pageHtml, "utf-8");
    } else {
      const targetDir = path.join(distDir, route.path.replace(/^\/+/, ""));
      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(path.join(targetDir, "index.html"), pageHtml, "utf-8");
    }
  }

  // Generate sitemap.xml strictly from verified public routes
  const today = new Date().toISOString().slice(0, 10);
  const sitemapEntries = PUBLIC_ROUTES.map((route) => {
    const loc = buildCanonicalUrl(baseUrl, route.path);
    return [
      "  <url>",
      `    <loc>${escapeHtmlAttr(loc)}</loc>`,
      `    <lastmod>${today}</lastmod>`,
      `    <changefreq>${route.changefreq}</changefreq>`,
      `    <priority>${route.priority}</priority>`,
      "  </url>",
    ].join("\n");
  }).join("\n");

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries}\n</urlset>\n`;
  fs.writeFileSync(path.join(distDir, "sitemap.xml"), sitemapXml, "utf-8");

  // Generate robots.txt separating search crawlers (including OAI-SearchBot / PerplexityBot) from model training (GPTBot)
  const privateDisallow = [
    "Disallow: /dashboard",
    "Disallow: /orders",
    "Disallow: /stock",
    "Disallow: /purchases",
    "Disallow: /production",
    "Disallow: /invoices",
    "Disallow: /dispatch",
    "Disallow: /payments",
    "Disallow: /receivables",
    "Disallow: /customers",
    "Disallow: /products",
    "Disallow: /suppliers",
    "Disallow: /reports",
    "Disallow: /exports",
    "Disallow: /settings",
    "Disallow: /showcase",
    "Disallow: /auth/",
    "Disallow: /api/",
  ].join("\n");

  const robotsTxt = [
    "# MillLedger Public Crawler Policy",
    "# Search indexing crawlers",
    "User-agent: Googlebot",
    "Allow: /",
    privateDisallow,
    "",
    "User-agent: Bingbot",
    "Allow: /",
    privateDisallow,
    "",
    "# AI Search & Answer Engine crawlers (allowed on public product/resource pages)",
    "User-agent: OAI-SearchBot",
    "Allow: /",
    privateDisallow,
    "",
    "User-agent: PerplexityBot",
    "Allow: /",
    privateDisallow,
    "",
    "# Model-training crawler (restricted independently of OAI-SearchBot per owner preference)",
    "User-agent: GPTBot",
    "Disallow: /",
    "",
    "User-agent: *",
    "Allow: /",
    privateDisallow,
    "",
    `Sitemap: ${baseUrl}/sitemap.xml`,
    "",
  ].join("\n");
  fs.writeFileSync(path.join(distDir, "robots.txt"), robotsTxt, "utf-8");

  console.log(
    `Prerendered ${PUBLIC_ROUTES.length} public routes, sitemap.xml, and robots.txt for ${baseUrl}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
