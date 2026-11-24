import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("F-064: Disabled Buttons Pointer Events and Cursor Affordance (WCAG 4.1.2 & Anti-Slop R-39)", () => {
  const buttonPath = path.resolve(__dirname, "../../client/src/components/ui/button.tsx");
  const newOrderPath = path.resolve(__dirname, "../../client/src/pages/new-order-page.tsx");
  const indexCssPath = path.resolve(__dirname, "../../client/src/index.css");
  const clientSrcDir = path.resolve(__dirname, "../../client/src");

  it("ensures Button component removes disabled:pointer-events-none and applies cursor-not-allowed", () => {
    const buttonSource = fs.readFileSync(buttonPath, "utf8");

    // Must NOT contain disabled:pointer-events-none
    expect(buttonSource).not.toContain("disabled:pointer-events-none");

    // Must include disabled and aria-disabled cursor-not-allowed
    expect(buttonSource).toContain("disabled:cursor-not-allowed");
    expect(buttonSource).toContain("aria-disabled:cursor-not-allowed");

    // Must prevent click scale compression on disabled states
    expect(buttonSource).toContain("disabled:active:scale-100");
    expect(buttonSource).toContain("aria-disabled:active:scale-100");
  });

  it("ensures stepper controls in new-order-page avoid disabled:pointer-events-none", () => {
    const newOrderSource = fs.readFileSync(newOrderPath, "utf8");

    expect(newOrderSource).not.toContain("disabled:pointer-events-none");
    expect(newOrderSource).toContain("disabled:cursor-not-allowed");
  });

  it("ensures CSS stylesheet defines cursor: not-allowed for disabled and aria-disabled buttons", () => {
    const css = fs.readFileSync(indexCssPath, "utf8");

    expect(css).toMatch(/button:disabled[\s\S]*?cursor:\s*not-allowed/);
    expect(css).toMatch(/\[aria-disabled="true"\][\s\S]*?cursor:\s*not-allowed/);
  });

  it("ensures no buttons or interactive controls in client codebase use disabled:pointer-events-none", () => {
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
      if (content.includes("disabled:pointer-events-none")) {
        violations.push({ file: path.relative(clientSrcDir, file), match: "disabled:pointer-events-none" });
      }
    }

    expect(violations).toEqual([]);
  });
});
