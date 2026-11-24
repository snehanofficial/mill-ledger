import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("F-060: Missing Language of Parts (lang=\"ta\" / lang=\"en\") on Multilingual Text Fragments (WCAG 2.2 SC 3.1.2)", () => {
  const loginPagePath = path.resolve(__dirname, "../../client/src/pages/login-page.tsx");
  const shellPath = path.resolve(__dirname, "../../client/src/components/shell/authenticated-shell.tsx");
  const i18nPath = path.resolve(__dirname, "../../client/src/lib/i18n.tsx");

  it("verifies login-page wraps language toggle button text in dynamic lang attribute", () => {
    const source = fs.readFileSync(loginPagePath, "utf8");
    expect(source).toMatch(/<span\s+lang=\{language\s*===\s*["']en["']\s*\?\s*["']ta["']\s*:\s*["']en["']\}>[\s\S]*?\{language\s*===\s*["']en["']\s*\?\s*["']தமிழ்["']\s*:\s*["']English["']\}[\s\S]*?<\/span>/);
  });

  it("verifies login-page tags English fragments in demo accounts and footer with lang=\"en\"", () => {
    const source = fs.readFileSync(loginPagePath, "utf8");
    expect(source).toMatch(/<span\s+lang=["']en["']>Demo Roles<\/span>/);
    expect(source).toMatch(/className=["']font-medium["']\s+lang=["']en["']>\s*\{acc\.label\}\s*<\/div>/);
    expect(source).toMatch(/className=["']truncate\s+text-muted-foreground\s+text-\[11px\]["']\s+lang=["']en["']>\s*\{acc\.email\}\s*<\/div>/);
    expect(source).toMatch(/<p\s+lang=["']en["']>© \{CURRENT_YEAR\} MillLedger ERP\. All rights reserved\.<\/p>/);
  });

  it("verifies authenticated-shell wraps header language toggle button in dynamic lang attribute", () => {
    const source = fs.readFileSync(shellPath, "utf8");
    expect(source).toMatch(/<span\s+lang=\{language\s*===\s*["']en["']\s*\?\s*["']ta["']\s*:\s*["']en["']\}>[\s\S]*?\{language\s*===\s*["']en["']\s*\?\s*["']தமிழ்["']\s*:\s*["']EN["']\}[\s\S]*?<\/span>/);
  });

  it("verifies LangPart component is declared and exported in i18n library", () => {
    const source = fs.readFileSync(i18nPath, "utf8");
    expect(source).toMatch(/export\s+function\s+LangPart\(\s*\{[\s\S]*?lang,[\s\S]*?children,[\s\S]*?\}\s*:\s*\{[\s\S]*?lang:\s*Language;/);
    expect(source).toMatch(/<span\s+lang=\{lang\}\s+className=\{className\}>/);
  });
});
