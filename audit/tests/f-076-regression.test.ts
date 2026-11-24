import { describe, it, expect, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  ROUTE_CHUNK_LOADERS,
  prefetchRoute,
  getPrefetchProps,
  prefetchIdleRoutes,
} from "../../client/src/lib/route-prefetch";

describe("F-076 Regression: Intent-Based & Idle Route Prefetching", () => {
  const rootDir = path.resolve(__dirname, "../..");
  const shellPath = path.join(
    rootDir,
    "client/src/components/shell/authenticated-shell.tsx",
  );
  const headerPath = path.join(
    rootDir,
    "client/src/pages/public/public-header.tsx",
  );

  it("declares chunk loaders for all core application routes", () => {
    const requiredRoutes = [
      "/dashboard",
      "/orders",
      "/invoices",
      "/stock",
      "/production",
      "/dispatch",
      "/payments",
      "/reports/sales",
      "/catalog",
    ];

    for (const route of requiredRoutes) {
      expect(ROUTE_CHUNK_LOADERS[route]).toBeDefined();
      expect(typeof ROUTE_CHUNK_LOADERS[route]).toBe("function");
    }
  });

  it("getPrefetchProps returns onPointerEnter and onFocus handlers for valid route links", () => {
    const props = getPrefetchProps("/invoices");
    expect(props.onPointerEnter).toBeDefined();
    expect(props.onFocus).toBeDefined();
    expect(typeof props.onPointerEnter).toBe("function");
    expect(typeof props.onFocus).toBe("function");

    // Empty or non-route paths should return empty object
    expect(getPrefetchProps("")).toEqual({});
    expect(getPrefetchProps("#")).toEqual({});
    expect(getPrefetchProps("https://external.com")).toEqual({});
  });

  it("executes the loader on prefetchRoute without throwing", async () => {
    // Spy on the invoices loader
    const spy = vi.fn().mockResolvedValue({ default: () => null });
    ROUTE_CHUNK_LOADERS["/test-prefetch"] = spy;

    prefetchRoute("/test-prefetch");
    expect(spy).toHaveBeenCalled();
  });

  it("wires getPrefetchProps and prefetchIdleRoutes into authenticated-shell.tsx", () => {
    const shellContent = fs.readFileSync(shellPath, "utf8");
    expect(shellContent).toContain("getPrefetchProps");
    expect(shellContent).toContain("prefetchIdleRoutes");
    expect(shellContent).toContain("{...getPrefetchProps(");
  });

  it("wires getPrefetchProps into public-header.tsx for public navigation links", () => {
    const headerContent = fs.readFileSync(headerPath, "utf8");
    expect(headerContent).toContain("getPrefetchProps");
    expect(headerContent).toContain("{...getPrefetchProps(");
  });
});
