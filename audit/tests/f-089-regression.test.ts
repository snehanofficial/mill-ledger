import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createServer, type Server } from "node:http";
import { createApp } from "../../server/src/app.js";

describe("F-089 Regression Test: robots.txt and sitemap.xml Compliance (RFC 9309 & Sitemaps XML 0.9)", () => {
  const robotsPath = path.resolve(process.cwd(), "client/public/robots.txt");
  const sitemapPath = path.resolve(process.cwd(), "client/public/sitemap.xml");

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

  it("client/public/robots.txt exists and specifies crawler exclusion rules", () => {
    expect(fs.existsSync(robotsPath)).toBe(true);
    const content = fs.readFileSync(robotsPath, "utf-8");

    expect(content).toContain("User-agent: *");
    expect(content).toContain("Disallow: /dashboard");
    expect(content).toContain("Disallow: /orders");
    expect(content).toContain("Disallow: /stock");
    expect(content).toContain("Disallow: /api/");
    expect(content).toContain("Allow: /auth/login");
    expect(content).toContain("Allow: /");
    expect(content).toContain("Sitemap: https://millledger.local/sitemap.xml");
  });

  it("client/public/sitemap.xml exists and contains valid sitemap XML schema", () => {
    expect(fs.existsSync(sitemapPath)).toBe(true);
    const content = fs.readFileSync(sitemapPath, "utf-8");

    expect(content.trim().startsWith("<?xml version=\"1.0\"")).toBe(true);
    expect(content).toContain("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">");
    expect(content).toContain("<loc>https://millledger.local/</loc>");
    expect(content).toContain("<loc>https://millledger.local/auth/login</loc>");
  });

  it("server returns HTTP 200 text/plain for GET /robots.txt disallowing API crawling", async () => {
    const res = await fetch(`${baseUrl}/robots.txt`);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/plain/);
    const body = await res.text();
    expect(body).toContain("User-agent: *");
    expect(body).toContain("Disallow: /");
  });
});
