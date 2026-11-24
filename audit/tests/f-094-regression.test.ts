import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("F-094 Regression: Dead Code, Orphaned Stubs, and Dependency Bloat", () => {
  const rootDir = path.resolve(__dirname, "../..");

  it("ensures orphaned client/src/lib/i18n-dictionary.ts has been deleted", () => {
    const dictPath = path.join(rootDir, "client/src/lib/i18n-dictionary.ts");
    expect(fs.existsSync(dictPath)).toBe(false);
  });

  it("ensures client/src/pages/placeholder-pages.tsx only exports NotFoundPage and no dead stubs", async () => {
    const placeholderPath = path.join(rootDir, "client/src/pages/placeholder-pages.tsx");
    expect(fs.existsSync(placeholderPath)).toBe(true);

    const exports = await import(placeholderPath);
    const exportNames = Object.keys(exports);
    expect(exportNames).toEqual(["NotFoundPage"]);
  });

  it("ensures phantom dependencies are removed from client/package.json", () => {
    const clientPkgPath = path.join(rootDir, "client/package.json");
    const clientPkg = JSON.parse(fs.readFileSync(clientPkgPath, "utf-8"));
    const deps = Object.keys(clientPkg.dependencies || {});

    const forbiddenDeps = [
      "@hookform/resolvers",
      "date-fns",
      "next-themes",
      "react-day-picker",
      "react-hook-form",
      "shadcn",
      "zod",
    ];

    for (const dep of forbiddenDeps) {
      expect(deps).not.toContain(dep);
    }
  });

  it("ensures phantom devDependencies are removed from server/package.json", () => {
    const serverPkgPath = path.join(rootDir, "server/package.json");
    const serverPkg = JSON.parse(fs.readFileSync(serverPkgPath, "utf-8"));
    const devDeps = Object.keys(serverPkg.devDependencies || {});

    expect(devDeps).not.toContain("supertest");
    expect(devDeps).not.toContain("@types/supertest");
  });

  it("ensures dead unmounted requireTenant is not exported by auth.middleware.ts", async () => {
    const authMiddlewarePath = path.join(rootDir, "server/src/middleware/auth.middleware.ts");
    const exports = await import(authMiddlewarePath);
    expect(exports).not.toHaveProperty("requireTenant");
  });

  it("ensures useConnectionStatus imports and delegates to useIsOnline without duplicate listeners", () => {
    const hookPath = path.join(rootDir, "client/src/components/shell/use-connection-status.ts");
    const content = fs.readFileSync(hookPath, "utf-8");
    expect(content).toContain('import { useIsOnline } from "@/offline/use-offline"');
    expect(content).not.toContain("window.addEventListener");
  });
});
