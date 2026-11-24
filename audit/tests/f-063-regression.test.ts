import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("F-063: Width and Height Layout Reflow in Sidebar and Collapsible (Web Vitals & Compositor Pipeline)", () => {
  const sidebarPath = path.resolve(__dirname, "../../client/src/components/ui/sidebar.tsx");
  const indexCssPath = path.resolve(__dirname, "../../client/src/index.css");
  const clientSrcDir = path.resolve(__dirname, "../../client/src");

  it("ensures desktop sidebar does not animate layout-thrashing width property", () => {
    const sidebarSource = fs.readFileSync(sidebarPath, "utf8");

    // Must NOT contain transition-[width]
    expect(sidebarSource).not.toContain("transition-[width]");
    expect(sidebarSource).not.toMatch(/transition:\s*width/);
  });

  it("ensures sidebar rail avoids transition-all and uses transition-colors", () => {
    const sidebarSource = fs.readFileSync(sidebarPath, "utf8");

    // SidebarRail should not use transition-all
    expect(sidebarSource).not.toContain("transition-all");
    expect(sidebarSource).toContain("transition-colors");
  });

  it("ensures mobile sidebar drawer uses GPU-composited transform transitions", () => {
    const sidebarSource = fs.readFileSync(sidebarPath, "utf8");

    // Mobile drawer should use transition-transform (translateX)
    expect(sidebarSource).toContain("transition-transform");
  });

  it("ensures Radix collapsible accordion keyframes animate GPU-composited transform/opacity rather than height", () => {
    const css = fs.readFileSync(indexCssPath, "utf8");

    // Extract @keyframes collapsible-open and collapsible-close
    const openMatch = css.match(/@keyframes collapsible-open\s*\{([\s\S]*?)\}/);
    const closeMatch = css.match(/@keyframes collapsible-close\s*\{([\s\S]*?)\}/);

    expect(openMatch).toBeTruthy();
    expect(closeMatch).toBeTruthy();

    const openBody = openMatch![1];
    const closeBody = closeMatch![1];

    // Must NOT mutate height
    expect(openBody).not.toMatch(/\bheight:/);
    expect(closeBody).not.toMatch(/\bheight:/);

    // Must use GPU-composited transform and opacity
    expect(openBody).toMatch(/\btransform:\s*translateY/);
    expect(openBody).toMatch(/\bopacity:\s*[01]/);
    expect(closeBody).toMatch(/\btransform:\s*translateY/);
    expect(closeBody).toMatch(/\bopacity:\s*[01]/);
  });

  it("ensures entire client codebase has zero geometric width/height transitions", () => {
    function scanFiles(dir: string): string[] {
      const results: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...scanFiles(fullPath));
        } else if (/\.(tsx?|css)$/.test(entry.name)) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const files = scanFiles(clientSrcDir);
    const violations: Array<{ file: string; match: string }> = [];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      if (content.includes("transition-[width]") || content.includes("transition-[height]")) {
        violations.push({ file: path.relative(clientSrcDir, file), match: "transition-[width/height]" });
      }
    }

    expect(violations).toEqual([]);
  });
});
