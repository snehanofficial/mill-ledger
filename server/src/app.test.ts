import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "./app.js";

describe("Express application HTTP integration", () => {
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

  describe("Health check endpoints", () => {
    it("returns 200 OK from /api/v1/health", async () => {
      const response = await fetch(`${baseUrl}/api/v1/health`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toMatchObject({
        status: "ok",
        service: "mill-ledger-server",
      });
      expect(typeof data.uptime).toBe("number");
      expect(typeof data.timestamp).toBe("string");
    });

    it("returns 200 OK from legacy /api/health alias", async () => {
      const response = await fetch(`${baseUrl}/api/health`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBe("ok");
    });
  });

  describe("Security headers", () => {
    it("sets helmet security headers on responses", async () => {
      const response = await fetch(`${baseUrl}/api/v1/health`);
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("x-dns-prefetch-control")).toBe("off");
    });

    it("allows request origin and credentials in dev/test environment for LAN/local origins", async () => {
      const response = await fetch(`${baseUrl}/api/v1/health`, {
        headers: {
          Origin: "http://10.10.70.209:5173",
        },
      });
      expect(response.headers.get("access-control-allow-origin")).toBe(
        "http://10.10.70.209:5173",
      );
      expect(response.headers.get("access-control-allow-credentials")).toBe(
        "true",
      );
    });

    it("rejects unauthorized external origins without CORS allow headers per OWASP", async () => {
      const response = await fetch(`${baseUrl}/api/v1/health`, {
        headers: {
          Origin: "https://evil-attacker.com",
        },
      });
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
    });
  });

  describe("F-025 Middleware pipeline & error handling", () => {
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
});
