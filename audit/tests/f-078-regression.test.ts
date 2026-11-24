import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { createApp } from "../../server/src/app";

describe("F-078 Regression: Response Compression and PostgreSQL Connection Pool Configuration", () => {
  const rootDir = path.resolve(__dirname, "../..");
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createApp();
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("ensures pg.Pool is configured with bounded production limits in server/src/db/client.ts", () => {
    const clientPath = path.join(rootDir, "server/src/db/client.ts");
    const content = fs.readFileSync(clientPath, "utf-8");

    expect(content).toContain("max: 25");
    expect(content).toContain("connectionTimeoutMillis: 5000");
    expect(content).toContain("idleTimeoutMillis: 30000");
    expect(content).toContain("statement_timeout: 10000");
  });

  it("ensures API responses over 1024 bytes are compressed with gzip when requested", async () => {
    // /metrics is > 1KB
    const res = await fetch(`${baseUrl}/metrics`, {
      headers: {
        "Accept-Encoding": "gzip",
      },
    });

    expect(res.status).toBe(200);
    const contentEncoding = res.headers.get("content-encoding");
    expect(contentEncoding).toBe("gzip");
  });

  it("ensures small API responses below 1024 bytes threshold are not compressed", async () => {
    // /ready is < 100 bytes
    const res = await fetch(`${baseUrl}/ready`, {
      headers: {
        "Accept-Encoding": "gzip",
      },
    });

    expect(res.status).toBe(200);
    const contentEncoding = res.headers.get("content-encoding");
    expect(contentEncoding).toBeNull();
  });
});
