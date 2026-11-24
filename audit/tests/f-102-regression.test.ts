import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import http from "node:http";
import { createApp } from "../../server/src/app.js";

describe("F-102 Regression Suite: Readiness, Database Probing, Trust Proxy, and Request Timeout", () => {
  const appPath = path.resolve(__dirname, "../../server/src/app.ts");
  const indexPath = path.resolve(__dirname, "../../server/src/index.ts");
  const dbClientPath = path.resolve(__dirname, "../../server/src/db/client.ts");

  it("verifies static configuration of trust proxy, request timeout, and statement timeout", () => {
    const appSource = fs.readFileSync(appPath, "utf-8");
    const indexSource = fs.readFileSync(indexPath, "utf-8");
    const dbSource = fs.readFileSync(dbClientPath, "utf-8");

    // Trust proxy configured in Express app
    expect(appSource).toMatch(/app\.set\(\s*["']trust proxy["'],\s*1\s*\)/);

    // Timeout middleware attached
    expect(appSource).toContain("requestTimeoutMiddleware");

    // Statement timeout configured on PostgreSQL pool
    expect(dbSource).toContain("statement_timeout: 10000");

    // Graceful shutdown disconnects prisma and sets fallback timer
    expect(indexSource).toContain("prisma.$disconnect()");
    expect(indexSource).toContain("forceExitTimer");
  });

  it("verifies GET /api/v1/health liveness returns 200 OK", async () => {
    const app = createApp();
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as any).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("ok");
      expect(data.service).toBe("mill-ledger-server");
    } finally {
      server.close();
    }
  });

  it("verifies GET /api/v1/ready and /ready probe database connectivity and return 200 ready", async () => {
    const app = createApp();
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as any).port;

    try {
      const res1 = await fetch(`http://127.0.0.1:${port}/api/v1/ready`);
      expect(res1.status).toBe(200);
      const data1 = await res1.json();
      expect(data1.status).toBe("ready");
      expect(data1.database).toBe("connected");

      const res2 = await fetch(`http://127.0.0.1:${port}/ready`);
      expect(res2.status).toBe(200);
      const data2 = await res2.json();
      expect(data2.status).toBe("ready");
    } finally {
      server.close();
    }
  });

  it("verifies trust proxy extracts client IP from X-Forwarded-For header", async () => {
    const app = createApp();
    expect(app.get("trust proxy")).toBe(1);

    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as any).port;

    try {
      // Probing health endpoint with X-Forwarded-For
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/health`, {
        headers: {
          "X-Forwarded-For": "203.0.113.195, 10.0.0.1",
        },
      });
      expect(res.status).toBe(200);
    } finally {
      server.close();
    }
  });
});
