import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("F-068 Regression Test: SPA Route Transition Focus Management (WCAG 2.2 SC 2.4.3, 1.3.2)", () => {
  const layoutPath = path.resolve(
    __dirname,
    "../../client/src/layouts/authenticated-layout.tsx",
  );
  const shellPath = path.resolve(
    __dirname,
    "../../client/src/components/shell/authenticated-shell.tsx",
  );

  it("verifies AuthenticatedLayout listens to route changes and shifts focus to main-content", () => {
    const layoutSource = fs.readFileSync(layoutPath, "utf8");

    // Must find main-content landmark
    expect(layoutSource).toContain('document.getElementById("main-content")');

    // Must focus with preventScroll
    expect(layoutSource).toContain("main.focus({ preventScroll: true })");

    // Must manage scroll restoration
    expect(layoutSource).toContain('useScrollRestoration("main-content")');

    // Must trigger on location.pathname change
    expect(layoutSource).toContain("[label, location.pathname]");
  });

  it("verifies AuthenticatedShell provides a focusable #main-content container with tabIndex=-1", () => {
    const shellSource = fs.readFileSync(shellPath, "utf8");

    expect(shellSource).toContain('id="main-content"');
    expect(shellSource).toContain("tabIndex={-1}");
  });
});
