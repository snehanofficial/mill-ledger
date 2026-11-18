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
  });
});
