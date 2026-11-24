import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("F-073 Regression: Mobile 4G LCP Optimization & Waterfall Elimination", () => {
  const rootDir = path.resolve(__dirname, "../..");
  const appTsxPath = path.join(rootDir, "client/src/app.tsx");
  const loginPagePath = path.join(rootDir, "client/src/pages/login-page.tsx");
  const layoutPath = path.join(
    rootDir,
    "client/src/layouts/authenticated-layout.tsx",
  );

  it("eliminates serial waterfalls by prefetching AuthenticatedLayout in login and root entry", () => {
    const appContent = fs.readFileSync(appTsxPath, "utf8");
    const loginContent = fs.readFileSync(loginPagePath, "utf8");

    // RootEntry pre-warms layout when user session is recognized
    expect(appContent).toContain('import("@/layouts/authenticated-layout")');

    // Login submit button pre-warms layout on hover and focus before click completion
    expect(loginContent).toContain('import("@/layouts/authenticated-layout")');
  });

  it("provides zero-CLS route loading fallback in AuthenticatedLayout", () => {
    const layoutContent = fs.readFileSync(layoutPath, "utf8");
    expect(layoutContent).toContain("RouteLoadingFallback");
    expect(layoutContent).toContain("h-[40vh]"); // Reserved dimensions prevent layout shift
  });

  it("ensures initial entry bundle does not block mobile main thread with Dexie or heavy UI", () => {
    const distHtmlPath = path.join(rootDir, "client/dist/index.html");
    if (!fs.existsSync(distHtmlPath)) {
      throw new Error("client/dist/index.html does not exist.");
    }
    const htmlContent = fs.readFileSync(distHtmlPath, "utf8");

    // Entry chunks must not eagerly include Radix UI or Dexie
    expect(htmlContent).not.toContain("vendor-ui");
    expect(htmlContent).not.toContain("vendor-dexie");
  });
});
