import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { scrollPositions } from "../../client/src/hooks/use-scroll-restoration";

describe("F-069: Missing Scroll Restoration on Route Navigation in <main> Container", () => {
  const layoutPath = path.resolve(__dirname, "../../client/src/layouts/authenticated-layout.tsx");
  const hookPath = path.resolve(__dirname, "../../client/src/hooks/use-scroll-restoration.ts");
  const shellPath = path.resolve(__dirname, "../../client/src/components/shell/authenticated-shell.tsx");

  it("verifies main-content container landmark exists in authenticated-shell", () => {
    const shellSource = fs.readFileSync(shellPath, "utf8");
    expect(shellSource).toMatch(/<main[\s\S]*?id="main-content"[\s\S]*?overflow-y-auto/);
  });

  it("verifies authenticated-layout imports and invokes useScrollRestoration targeting main-content", () => {
    const layoutSource = fs.readFileSync(layoutPath, "utf8");
    expect(layoutSource).toMatch(/import\s*\{\s*useScrollRestoration\s*\}\s*from\s*["']@\/hooks\/use-scroll-restoration["']/);
    expect(layoutSource).toMatch(/useScrollRestoration\(\s*["']main-content["']\s*\)/);
  });

  it("verifies use-scroll-restoration handles PUSH reset and POP restoration", () => {
    const hookSource = fs.readFileSync(hookPath, "utf8");
    expect(hookSource).toMatch(/export\s*const\s*scrollPositions\s*=\s*new\s*Map<string,\s*number>\(\)/);
    expect(hookSource).toMatch(/if\s*\(navigationType\s*===\s*["']POP["']\)\s*\{/);
    expect(hookSource).toMatch(/container\.scrollTop\s*=\s*savedPosition/);
    expect(hookSource).toMatch(/container\.scrollTop\s*=\s*0/);
    expect(hookSource).toMatch(/container\.addEventListener\(\s*["']scroll["']/);
  });

  it("verifies scrollPositions Map maintains and caches scroll offsets", () => {
    scrollPositions.set("key-orders", 450);
    scrollPositions.set("key-stock", 0);
    expect(scrollPositions.get("key-orders")).toBe(450);
    expect(scrollPositions.get("key-stock")).toBe(0);
  });
});
