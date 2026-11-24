import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { createApp } from "../../server/src/app";

describe("F-103 Regression: Observability, Metrics, Source Maps, and Error Boundaries", () => {
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

  it("ensures server/tsconfig.json has sourceMap enabled for APM symbolication", () => {
    const tsconfigPath = path.join(rootDir, "server/tsconfig.json");
    const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf-8"));
    expect(tsconfig.compilerOptions?.sourceMap).toBe(true);
  });

  it("ensures client/vite.config.ts enables sourcemap in build options", () => {
    const viteConfigPath = path.join(rootDir, "client/vite.config.ts");
    const viteConfig = fs.readFileSync(viteConfigPath, "utf-8");
    expect(viteConfig).toMatch(/sourcemap:\s*true/);
  });

  it("ensures client ErrorBoundary component exists and implements lifecycle error hooks", () => {
    const ebPath = path.join(rootDir, "client/src/components/ui/error-boundary.tsx");
    expect(fs.existsSync(ebPath)).toBe(true);
    const ebContent = fs.readFileSync(ebPath, "utf-8");
    expect(ebContent).toContain("componentDidCatch");
    expect(ebContent).toContain("getDerivedStateFromError");
    expect(ebContent).toContain("Application Error");
  });

  it("ensures client/src/app.tsx wraps the router tree with ErrorBoundary", () => {
    const appPath = path.join(rootDir, "client/src/app.tsx");
    const appContent = fs.readFileSync(appPath, "utf-8");
    expect(appContent).toContain("<ErrorBoundary>");
    expect(appContent).toContain("</ErrorBoundary>");
  });

  it("ensures Prometheus /metrics endpoint is mounted and exposes default and HTTP metrics", async () => {
    // Trigger a request to populate HTTP metrics
    const healthRes = await fetch(`${baseUrl}/api/v1/health`);
    expect(healthRes.status).toBe(200);

    // Scrape /metrics
    const metricsRes = await fetch(`${baseUrl}/metrics`);
    expect(metricsRes.status).toBe(200);
    const contentType = metricsRes.headers.get("content-type") || "";
    expect(contentType).toMatch(/text\/plain|openmetrics/);

    const body = await metricsRes.text();
    expect(body).toContain("http_requests_total");
    expect(body).toContain("http_request_duration_seconds");
    expect(body).toContain("db_pool_active_connections");
    // Verify default Node.js runtime metrics
    expect(body).toContain("process_cpu_");
  });

  it("ensures deploy/prometheus/alerts.yml defines all required production alert rules", () => {
    const alertsPath = path.join(rootDir, "deploy/prometheus/alerts.yml");
    expect(fs.existsSync(alertsPath)).toBe(true);
    const alertsContent = fs.readFileSync(alertsPath, "utf-8");

    const expectedAlerts = [
      "HighHttp5xxRate",
      "HighHttpLatencyP95",
      "DatabasePoolSaturation",
      "MillLedgerApiDown",
      "ProductionYieldVarianceAnomaly",
    ];

    for (const alert of expectedAlerts) {
      expect(alertsContent).toContain(`alert: ${alert}`);
    }
  });

  it("ensures operational response runbook exists for alerting rules", () => {
    const runbookPath = path.join(rootDir, "docs/runbooks/alerting-rules.md");
    expect(fs.existsSync(runbookPath)).toBe(true);
    const content = fs.readFileSync(runbookPath, "utf-8");
    expect(content).toContain("HighHttp5xxRate");
    expect(content).toContain("DatabasePoolSaturation");
  });
});
