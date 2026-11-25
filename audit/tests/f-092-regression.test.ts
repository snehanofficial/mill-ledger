import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("F-092 Regression Suite: Public Marketing, Landing, Catalog, and Contact Surfaces", () => {
  const clientAppPath = path.resolve(__dirname, "../../client/src/app.tsx");
  const landingPagePath = path.resolve(
    __dirname,
    "../../client/src/pages/public/landing-page.tsx",
  );
  const catalogPagePath = path.resolve(
    __dirname,
    "../../client/src/pages/public/catalog-page.tsx",
  );
  const contactPagePath = path.resolve(
    __dirname,
    "../../client/src/pages/public/contact-page.tsx",
  );
  const publicHeaderPath = path.resolve(
    __dirname,
    "../../client/src/pages/public/public-header.tsx",
  );
  const publicFooterPath = path.resolve(
    __dirname,
    "../../client/src/pages/public/public-footer.tsx",
  );

  it("verifies public route configuration in client router outside AuthenticatedLayout", () => {
    const appSource = fs.readFileSync(clientAppPath, "utf-8");

    // Must import public pages
    expect(appSource).toContain("LandingPage");
    expect(appSource).toContain("CatalogPage");
    expect(appSource).toContain("ContactPage");
    expect(appSource).toContain("LoginPage");

    // Must define RootEntry for dual-purpose root routing (OD-02 / F-092)
    expect(appSource).toContain("function RootEntry");
    expect(appSource).toContain("getDefaultRouteForRole");
    expect(appSource).toContain("<LandingPage />");

    // Must register public routes outside AuthenticatedLayout
    expect(appSource).toContain('path: "/"');
    expect(appSource).toContain("<RootEntry />");
    expect(appSource).toContain('path: "/catalog"');
    expect(appSource).toContain("<CatalogPage />");
    expect(appSource).toContain('path: "/contact"');
    expect(appSource).toContain("<ContactPage />");
    expect(appSource).toContain('path: "/auth/login"');
    expect(appSource).toContain("<LoginPage />");

    // Authenticated layout must be pathless or separate from public root
    expect(appSource).toContain("<AuthenticatedLayout />");
  });

  it("verifies LandingPage metadata, robots index policy, and B2B milling capabilities", () => {
    const landingSource = fs.readFileSync(landingPagePath, "utf-8");

    // Dynamic title and robots tag conforming to OD-02 (public landing pages may be indexed)
    expect(landingSource).toContain('meta.name = "robots"');
    expect(landingSource).toContain('meta.content = "index, follow"');
    expect(landingSource).toContain("MillLedger");

    // B2B Milling identity and sortex technology
    expect(landingSource).toContain("Buhler optical sortexing");
    expect(landingSource).toContain("ISO 22000");
    expect(landingSource).toContain("PublicHeader");
    expect(landingSource).toContain("PublicFooter");
  });

  it("verifies CatalogPage technical B2B SKU specifications and wholesale terms", () => {
    const catalogSource = fs.readFileSync(catalogPagePath, "utf-8");

    // Core product listings
    expect(catalogSource).toContain("MRK-200G");
    expect(catalogSource).toContain("FLR-1KG");
    expect(catalogSource).toContain("OIL-15L");
    expect(catalogSource).toContain("RIC-PON-50");
    expect(catalogSource).toContain("RIC-BRK-50");
    expect(catalogSource).toContain("BRN-50");

    // Technical specifications (HSN, moisture, packaging)
    expect(catalogSource).toContain("10063010"); // Rice HSN
    expect(catalogSource).toContain("11029010"); // Flour HSN
    expect(catalogSource).toContain("19059090"); // Murukku HSN
    expect(catalogSource).toContain("23022090"); // Bran HSN
    expect(catalogSource).toContain("moistureLimit");
    expect(catalogSource).toContain("shelfLife");

    // Robots meta tag
    expect(catalogSource).toContain('meta.content = "index, follow"');
  });

  it("verifies ContactPage mill gate coordinates, weighbridge operating hours, and inquiry form", () => {
    const contactSource = fs.readFileSync(contactPagePath, "utf-8");

    // Coordinates & Address
    expect(contactSource).toContain("NH-44 Bypass Industrial Estate");
    expect(contactSource).toContain("Madurai");
    expect(contactSource).toContain("625016");

    // Statutory Credentials
    expect(contactSource).toContain("12423001000456"); // FSSAI
    expect(contactSource).toContain("33AAAAA0000A1Z5"); // GSTIN

    // Operating hours
    expect(contactSource).toContain("06:00 - 20:00");
    expect(contactSource).toContain("Farmer Paddy Intake");

    // Inquiry form validation & accessibility
    expect(contactSource).toContain("inquiry-fullname");
    expect(contactSource).toContain("inquiry-phone");
    expect(contactSource).toContain("inquiry-message");
    expect(contactSource).toContain('role="status"');
    expect(contactSource).toContain('aria-live="polite"');
  });

  it("verifies PublicHeader keyboard accessibility skip link and language switcher", () => {
    const headerSource = fs.readFileSync(publicHeaderPath, "utf-8");

    // WCAG 2.4.1 Skip Link
    expect(headerSource).toContain('href="#main-content"');
    expect(headerSource).toContain("sr-only focus:not-sr-only");

    // Language switcher with WCAG 3.1.2 lang tag
    expect(headerSource).toContain("Switch language to Tamil");
    expect(headerSource).toContain("Switch language to English");
    expect(headerSource).toMatch(
      /<span lang=\{language === ["']en["'] \? ["']ta["'] : ["']en["']\}>/,
    );

    // Responsive navigation
    expect(headerSource).toContain("mobileMenuOpen");
    expect(headerSource).toContain("aria-expanded");
  });

  it("verifies PublicFooter statutory credentials and semantic landmarks", () => {
    const footerSource = fs.readFileSync(publicFooterPath, "utf-8");

    // Semantic landmark
    expect(footerSource).toContain('role="contentinfo"');

    // Statutory disclosures
    expect(footerSource).toContain("12423001000456");
    expect(footerSource).toContain("33AAAAA0000A1Z5");
    expect(footerSource).toContain("CURRENT_YEAR");
  });
});
