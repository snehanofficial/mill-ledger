import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../server/src/app.js";

describe("F-025 Regression Test: Express Middleware Pipeline Baseline", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createApp();
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("returns JSON 404 envelope on unmapped routes", async () => {
    const response = await fetch(`${baseUrl}/api/v1/does-not-exist`);
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");

    const data = await response.json();
    expect(data).toMatchObject({
      code: "NOT_FOUND",
      error: "Not Found",
      message: "Route not found",
    });
    expect(data.requestId).toBeTruthy();
  });

  it("assigns X-Request-Id header when none is provided", async () => {
    const response = await fetch(`${baseUrl}/api/v1/health`);
    const reqId = response.headers.get("x-request-id");
    expect(reqId).toBeTruthy();
    expect(typeof reqId).toBe("string");
    expect(reqId?.length).toBeGreaterThan(10);
  });

  it("preserves client-provided X-Request-Id correlation header", async () => {
    const response = await fetch(`${baseUrl}/api/v1/health`, {
      headers: {
        "X-Request-Id": "client-correlation-abc-123",
      },
    });
    expect(response.headers.get("x-request-id")).toBe(
      "client-correlation-abc-123",
    );
  });

  it("attaches rate limiting headers on /api/v1 requests", async () => {
    const response = await fetch(`${baseUrl}/api/v1/health`);
    expect(response.headers.get("ratelimit-limit")).toBe("1000");
    expect(response.headers.get("x-ratelimit-limit")).toBe("1000");
    expect(response.headers.get("ratelimit-remaining")).toBeTruthy();
    expect(response.headers.get("ratelimit-reset")).toBeTruthy();
  });

  it("returns HTTP 413 Payload Too Large on oversized request bodies", async () => {
    const largeData = "x".repeat(150 * 1024);
    const response = await fetch(`${baseUrl}/api/v1/sales/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: largeData }),
    });
    expect(response.status).toBe(413);

    const data = await response.json();
    expect(data).toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
      error: "Payload Too Large",
      message: "Request entity too large",
    });
    expect(data.requestId).toBeTruthy();
  });
});
