import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("F-079 Regression: Font Subsetting and Tamil Font Support", () => {
  const rootDir = path.resolve(__dirname, "../..");
  const indexCssPath = path.join(rootDir, "client/src/index.css");
  const packageJsonPath = path.join(rootDir, "client/package.json");
  const distAssetsDir = path.join(rootDir, "client/dist/assets");

  it("declares @fontsource/noto-sans-tamil in client/package.json", () => {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    expect(pkg.dependencies["@fontsource/noto-sans-tamil"]).toBeDefined();
  });

  it("subsets Geist to Latin in client/src/index.css and defines Noto Sans Tamil", () => {
    const cssContent = fs.readFileSync(indexCssPath, "utf8");
    // Verifies Latin subsetting
    expect(cssContent).toContain("geist-latin-wght-normal.woff2");
    // Verifies Tamil subset font-face definitions
    expect(cssContent).toContain("noto-sans-tamil-tamil-400-normal.woff2");
    expect(cssContent).toContain("noto-sans-tamil-tamil-600-normal.woff2");
    // Verifies Tamil unicode range
    expect(cssContent).toContain("U+0B82-0BFA");
    // Verifies font-family includes Noto Sans Tamil
    expect(cssContent).toContain('"Noto Sans Tamil"');
  });

  it("emits only Latin and Tamil WOFF2 files in production client build without Cyrillic or Vietnamese bloat", () => {
    if (!fs.existsSync(distAssetsDir)) {
      throw new Error(
        "client/dist/assets does not exist. Run pnpm --filter client build first.",
      );
    }
    const files = fs.readdirSync(distAssetsDir);
    const fontFiles = files.filter((f) => f.endsWith(".woff2"));

    // Must have Geist Latin and Noto Sans Tamil files
    expect(fontFiles.some((f) => f.startsWith("geist-latin"))).toBe(true);
    expect(
      fontFiles.some((f) => f.startsWith("noto-sans-tamil-tamil-400")),
    ).toBe(true);
    expect(
      fontFiles.some((f) => f.startsWith("noto-sans-tamil-tamil-600")),
    ).toBe(true);

    // Must NOT have Cyrillic, Vietnamese, or Latin-ext bloat
    expect(fontFiles.some((f) => f.includes("cyrillic"))).toBe(false);
    expect(fontFiles.some((f) => f.includes("vietnamese"))).toBe(false);
    expect(fontFiles.some((f) => f.includes("latin-ext"))).toBe(false);

    // Verify total font asset size is under 65 KB
    const totalFontBytes = fontFiles.reduce((acc, f) => {
      const stats = fs.statSync(path.join(distAssetsDir, f));
      return acc + stats.size;
    }, 0);
    expect(totalFontBytes).toBeLessThan(65 * 1024);
  });
});
