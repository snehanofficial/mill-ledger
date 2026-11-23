import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("F-091 Regression Test: Dynamic <title>, SEO & Social Metadata (WCAG 2.4.2 & REQ-062)", () => {
  it("client/index.html includes description, canonical link, Open Graph, and Twitter metadata", () => {
    const indexPath = path.resolve(process.cwd(), "client/index.html");
    const html = fs.readFileSync(indexPath, "utf8");

    // Standard meta tags
    expect(html).toContain('name="description"');
    expect(html).toContain('rel="canonical"');

    // Open Graph protocol
    expect(html).toContain('property="og:type"');
    expect(html).toContain('property="og:site_name"');
    expect(html).toContain('property="og:title"');
    expect(html).toContain('property="og:description"');
    expect(html).toContain('property="og:url"');
    expect(html).toContain('property="og:image"');
    expect(html).toContain('property="og:image:width" content="1200"');
    expect(html).toContain('property="og:image:height" content="630"');

    // Twitter Card
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain('name="twitter:title"');
    expect(html).toContain('name="twitter:description"');
    expect(html).toContain('name="twitter:image"');
  });

  it("verifies 1200x630 og-preview.png image exists in public directory", () => {
    const ogImagePath = path.resolve(process.cwd(), "client/public/og-preview.png");
    expect(fs.existsSync(ogImagePath)).toBe(true);
    const stat = fs.statSync(ogImagePath);
    expect(stat.size).toBeGreaterThan(1000);
  });

  it("authenticated-layout.tsx dynamically updates document.title from active route handle", () => {
    const layoutPath = path.resolve(
      process.cwd(),
      "client/src/layouts/authenticated-layout.tsx",
    );
    const layoutContent = fs.readFileSync(layoutPath, "utf8");

    expect(layoutContent).toContain("useMatches");
    expect(layoutContent).toContain("document.title = `${label} | MillLedger`");
  });

  it("login-page.tsx sets document.title to Sign In | MillLedger", () => {
    const loginPath = path.resolve(process.cwd(), "client/src/pages/login-page.tsx");
    const loginContent = fs.readFileSync(loginPath, "utf8");

    expect(loginContent).toContain('document.title = "Sign In | MillLedger"');
  });

  it("NotFoundPage sets document.title to Page Not Found | MillLedger", () => {
    const placeholderPath = path.resolve(
      process.cwd(),
      "client/src/pages/placeholder-pages.tsx",
    );
    const placeholderContent = fs.readFileSync(placeholderPath, "utf8");

    expect(placeholderContent).toContain(
      'document.title = "Page Not Found | MillLedger"',
    );
  });
});
