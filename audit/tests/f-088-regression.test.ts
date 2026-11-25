import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer, type Server } from "node:http";
import { createApp } from "../../server/src/app.js";

describe("F-088 Regression Test: noindex Protection & X-Robots-Tag (REQ-062)", () => {
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

  it("emits X-Robots-Tag: noindex, nofollow on /api/v1/health", async () => {
    const res = await fetch(`${baseUrl}/api/v1/health`);
    expect(res.status).toBe(200);
    const xRobotsTag = res.headers.get("x-robots-tag");
    expect(xRobotsTag).toBe("noindex, nofollow");
  });

  it("emits X-Robots-Tag: noindex, nofollow on /api/health alias", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const xRobotsTag = res.headers.get("x-robots-tag");
    expect(xRobotsTag).toBe("noindex, nofollow");
  });

  it("emits X-Robots-Tag: noindex, nofollow on 404 responses", async () => {
    const res = await fetch(`${baseUrl}/api/v1/non-existent-endpoint`);
    expect(res.status).toBe(404);
    const xRobotsTag = res.headers.get("x-robots-tag");
    expect(xRobotsTag).toBe("noindex, nofollow");
  });

  it("emits X-Robots-Tag: noindex, nofollow on authenticated endpoints", async () => {
    const res = await fetch(`${baseUrl}/api/v1/sales/orders`);
    // Unauthorized without cookie, but still returns X-Robots-Tag
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
});
