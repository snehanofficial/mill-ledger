import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("F-093 Regression Test: Schema.org JSON-LD & Semantic <main> Landmark (WCAG 2.2 SC 1.3.1 & Schema.org)", () => {
  const indexHtmlPath = path.resolve(process.cwd(), "client/index.html");
  const loginPagePath = path.resolve(process.cwd(), "client/src/pages/login-page.tsx");

  it("client/index.html includes valid Schema.org JSON-LD structured data for SoftwareApplication", () => {
    expect(fs.existsSync(indexHtmlPath)).toBe(true);
    const html = fs.readFileSync(indexHtmlPath, "utf-8");

    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(jsonLdMatch).not.toBeNull();

    const jsonLd = JSON.parse(jsonLdMatch![1].trim());
    expect(jsonLd["@context"]).toBe("https://schema.org");
    expect(jsonLd["@type"]).toBe("SoftwareApplication");
    expect(jsonLd.name).toBe("MillLedger ERP");
    expect(jsonLd.applicationCategory).toBe("BusinessApplication");
    expect(jsonLd.publisher).toBeDefined();
    expect(jsonLd.publisher["@type"]).toBe("Organization");
    expect(jsonLd.publisher.name).toBe("MillLedger Technologies");
  });

  it("client/src/pages/login-page.tsx provides a semantic <main> landmark (WCAG 2.2 SC 1.3.1)", () => {
    expect(fs.existsSync(loginPagePath)).toBe(true);
    const content = fs.readFileSync(loginPagePath, "utf-8");

    expect(content).toMatch(/<main[\s\S]*?id="main-content"[\s\S]*?role="main"/);
    expect(content).toContain("</main>");
    expect(content).not.toMatch(/return\s*\(\s*<div className="flex min-h-screen/);
  });

  it("client/src/pages/login-page.tsx provides a semantic <footer> landmark with navigation links", () => {
    const content = fs.readFileSync(loginPagePath, "utf-8");

    expect(content).toContain("<footer");
    expect(content).toContain("</footer>");
    expect(content).toContain("Support");
    expect(content).toContain("Privacy Policy");
    expect(content).toContain("Terms");
  });
});
