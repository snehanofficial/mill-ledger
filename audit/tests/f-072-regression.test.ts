import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

describe("F-072 Regression: Initial JavaScript Bundle Budget (<= 170 KB Gzip)", () => {
  const rootDir = path.resolve(__dirname, "../..");
  const indexHtmlPath = path.join(rootDir, "client/dist/index.html");
  const distDir = path.join(rootDir, "client/dist");
  const appTsxPath = path.join(rootDir, "client/src/app.tsx");

  it("declares lazy-loaded AuthenticatedLayout in client/src/app.tsx", () => {
    const appContent = fs.readFileSync(appTsxPath, "utf8");
    expect(appContent).toContain("lazy(() =>");
    expect(appContent).toContain('import("@/layouts/authenticated-layout")');
  });

  it("keeps total initial JavaScript bundle <= 170 KB gzipped on page load", () => {
    if (!fs.existsSync(indexHtmlPath)) {
      throw new Error(
        "client/dist/index.html does not exist. Run pnpm --filter client build first.",
      );
    }

    const htmlContent = fs.readFileSync(indexHtmlPath, "utf8");

    // Extract script src and modulepreload hrefs
    const scriptMatches = Array.from(
      htmlContent.matchAll(/<script[^>]+src="([^">]+\.js)"/g),
    ).map((m) => m[1]);
    const preloadMatches = Array.from(
      htmlContent.matchAll(
        /<link[^>]+rel="modulepreload"[^>]+href="([^">]+\.js)"/g,
      ),
    ).map((m) => m[1]);

    const allInitialScripts = Array.from(
      new Set([...scriptMatches, ...preloadMatches]),
    );
    expect(allInitialScripts.length).toBeGreaterThan(0);

    let totalRawBytes = 0;
    let totalGzipBytes = 0;
    const chunkDetails: Array<{ file: string; rawKB: number; gzipKB: number }> =
      [];

    for (const scriptPath of allInitialScripts) {
      // Remove leading slash to resolve against distDir
      const relativePath = scriptPath.startsWith("/")
        ? scriptPath.slice(1)
        : scriptPath;
      const fullPath = path.join(distDir, relativePath);

      if (!fs.existsSync(fullPath)) {
        throw new Error(
          `Referenced script chunk not found on disk: ${fullPath}`,
        );
      }

      const content = fs.readFileSync(fullPath);
      const gzipped = zlib.gzipSync(content);

      totalRawBytes += content.length;
      totalGzipBytes += gzipped.length;
      chunkDetails.push({
        file: path.basename(fullPath),
        rawKB: Number((content.length / 1024).toFixed(2)),
        gzipKB: Number((gzipped.length / 1024).toFixed(2)),
      });
    }

    const totalGzipKB = totalGzipBytes / 1024;
    console.log(
      `[F-072 Budget Verification] Total Initial JS: ${totalGzipKB.toFixed(2)} KB Gzip (Raw: ${(totalRawBytes / 1024).toFixed(2)} KB)`,
    );

    // Must be <= 170 KB gzipped (174,080 bytes) per standard performance budget
    expect(totalGzipKB).toBeLessThanOrEqual(170.0);

    // Heavy application modules must NOT be in initial entry graph
    const scriptNames = chunkDetails.map((c) => c.file);
    expect(scriptNames.some((name) => name.startsWith("vendor-ui"))).toBe(
      false,
    );
    expect(scriptNames.some((name) => name.startsWith("vendor-dexie"))).toBe(
      false,
    );
  });
});
