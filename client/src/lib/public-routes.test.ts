import { describe, expect, it } from "vitest";
import {
  PUBLIC_ROUTES,
  buildCanonicalUrl,
  buildStructuredDataGraph,
  getPublicRouteMeta,
  normalizeBaseUrl,
} from "./public-routes";

describe("public-routes SEO metadata & structured data", () => {
  it("defines unique titles and descriptions for every public route", () => {
    const titles = new Set(PUBLIC_ROUTES.map((r) => r.title));
    const descriptions = new Set(PUBLIC_ROUTES.map((r) => r.description));
    const paths = new Set(PUBLIC_ROUTES.map((r) => r.path));

    expect(titles.size).toBe(PUBLIC_ROUTES.length);
    expect(descriptions.size).toBe(PUBLIC_ROUTES.length);
    expect(paths.size).toBe(PUBLIC_ROUTES.length);

    for (const route of PUBLIC_ROUTES) {
      expect(route.title.length).toBeGreaterThan(20);
      expect(route.description.length).toBeGreaterThan(50);
    }
  });

  it("normalizes base URLs and builds consistent canonical URLs", () => {
    expect(normalizeBaseUrl("https://app.mill-ledger.com/")).toBe(
      "https://app.mill-ledger.com",
    );
    expect(buildCanonicalUrl("https://app.mill-ledger.com/", "/")).toBe(
      "https://app.mill-ledger.com/",
    );
    expect(buildCanonicalUrl("https://app.mill-ledger.com/", "/features")).toBe(
      "https://app.mill-ledger.com/features",
    );
    expect(getPublicRouteMeta("/features/")).toBeDefined();
  });

  it("generates valid JSON-LD without fabricated pricing or ratings", () => {
    const home = getPublicRouteMeta("/")!;
    const graph = buildStructuredDataGraph(home, "https://app.mill-ledger.com");
    const serialized = JSON.stringify(graph);

    expect(serialized).toContain("SoftwareApplication");
    expect(serialized).toContain("BreadcrumbList");
    expect(serialized).not.toContain("aggregateRating");
    expect(serialized).not.toContain('"price":"0"');
  });
});
