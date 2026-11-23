import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer, type Server } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createApp } from "../../server/src/app.js";

describe("F-090 Regression Test: Soft 404 Status & Redirect Hijacking Prevention", () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    const app = createApp();
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("server returns HTTP 404 with code NOT_FOUND for unknown API routes", async () => {
    const res = await fetch(`${baseUrl}/api/v1/non-existent-random-route-${Date.now()}`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("NOT_FOUND");
    expect(body.message).toContain("Route not found");
  });

  it("client router places wildcard catch-all outside AuthenticatedLayout", () => {
    const appTsxPath = path.resolve(process.cwd(), "client/src/app.tsx");
    const appTsx = fs.readFileSync(appTsxPath, "utf8");

    // The AuthenticatedLayout children section ends before the root catch-all
    const authenticatedChildrenClose = appTsx.indexOf("path: \"showcase\"");
    expect(authenticatedChildrenClose).toBeGreaterThan(-1);

    // Verify root catch-all occurs after AuthenticatedLayout definition
    const rootCatchAll = appTsx.indexOf("path: \"*\"");
    expect(rootCatchAll).toBeGreaterThan(authenticatedChildrenClose);

    // Verify NotFoundPage is rendered at the root level
    expect(appTsx).toContain("path: \"*\",");
    expect(appTsx).toContain("<NotFoundPage />");
  });
});
