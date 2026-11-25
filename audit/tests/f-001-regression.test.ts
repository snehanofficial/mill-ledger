import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("F-001 Regression Test: Unique Skip-to-Main-Content Link and Keyboard Bypass", () => {
  const repoRoot = path.resolve(__dirname, "../..");

  it("authenticated-shell.tsx contains exactly ONE skip-to-main-content anchor tag", () => {
    const shellSource = fs.readFileSync(
      path.join(repoRoot, "client/src/components/shell/authenticated-shell.tsx"),
      "utf8",
    );

    const matches = shellSource.match(/href="#main-content"/g);
    expect(matches).not.toBeNull();
    expect(matches?.length).toBe(1);
  });

  it("the single skip link resides at the root level of AuthenticatedShell before navigation landmarks", () => {
    const shellSource = fs.readFileSync(
      path.join(repoRoot, "client/src/components/shell/authenticated-shell.tsx"),
      "utf8",
    );

    const skipIndex = shellSource.indexOf('href="#main-content"');
    const sidebarIndex = shellSource.indexOf('<Sidebar collapsible="icon">');
    const headerIndex = shellSource.indexOf("<StickyHeader");

    expect(skipIndex).toBeGreaterThan(-1);
    expect(sidebarIndex).toBeGreaterThan(-1);
    expect(headerIndex).toBeGreaterThan(-1);

    // Skip link MUST appear before Sidebar and StickyHeader in DOM hierarchy
    expect(skipIndex).toBeLessThan(sidebarIndex);
    expect(skipIndex).toBeLessThan(headerIndex);
  });

  it("StickyHeader does not contain a duplicate skip link", () => {
    const shellSource = fs.readFileSync(
      path.join(repoRoot, "client/src/components/shell/authenticated-shell.tsx"),
      "utf8",
    );

    // Extract StickyHeader function body
    const stickyHeaderStart = shellSource.indexOf("function StickyHeader(");
    const stickyHeaderEnd = shellSource.indexOf("function AuthenticatedShell(");
    const stickyHeaderSource = shellSource.slice(stickyHeaderStart, stickyHeaderEnd);

    expect(stickyHeaderSource).not.toContain('href="#main-content"');
  });

  it("the skip link supports bilingual labels (English and Tamil)", () => {
    const shellSource = fs.readFileSync(
      path.join(repoRoot, "client/src/components/shell/authenticated-shell.tsx"),
      "utf8",
    );

    expect(shellSource).toContain('language === "ta"');
    expect(shellSource).toContain("முதன்மை பகுதிக்குச் செல்லவும்");
    expect(shellSource).toContain("Skip to main content");
  });
});
