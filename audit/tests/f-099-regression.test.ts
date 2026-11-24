import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import http from "node:http";
import { createApp } from "../../server/src/app.js";

describe("F-099 Regression Suite: Production Dockerfile and SPA Asset Serving", () => {
  const dockerfilePath = path.resolve(__dirname, "../../Dockerfile");
  const appSourcePath = path.resolve(__dirname, "../../server/src/app.ts");

  it("verifies Dockerfile removes nonexistent tsconfig.json copy and prunes devDependencies", () => {
    const dockerfileContent = fs.readFileSync(dockerfilePath, "utf-8");

    // Must NOT attempt to copy nonexistent root tsconfig.json
    expect(dockerfileContent).not.toMatch(/COPY tsconfig\.json \.\//);

    // Must prune devDependencies in builder stage
    expect(dockerfileContent).toContain("pnpm prune --prod");

    // Must copy client dist and server dist into runner stage
    expect(dockerfileContent).toContain("COPY --from=builder /app/client/dist ./client/dist");
    expect(dockerfileContent).toContain("COPY --from=builder /app/server/dist ./server/dist");
  });

  it("verifies server/src/app.ts serves client static assets and SPA fallback for non-API paths", () => {
    const appSource = fs.readFileSync(appSourcePath, "utf-8");

    expect(appSource).toContain("clientDistPath");
    expect(appSource).toContain("express.static(clientDistPath)");
    expect(appSource).toContain("index.html");
    expect(appSource).toMatch(/req\.path\.startsWith\(["']\/api["']\)/);
  });

  it("verifies live SPA serving vs API 404 separation", async () => {
    const app = createApp();
    const server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as any).port;

    try {
      // 1. Unknown API route must return 404 JSON error envelope, not HTML
      const api404Res = await fetch(`http://127.0.0.1:${port}/api/v1/nonexistent-route`);
      expect(api404Res.status).toBe(404);
      const api404Json = await api404Res.json();
      expect(api404Json.code).toBe("NOT_FOUND");
      expect(api404Json.error).toBe("Not Found");

      // 2. Non-API route: if client/dist exists (it was built), returns 200 with HTML
      const clientDistPath = path.resolve(process.cwd(), "client/dist/index.html");
      if (fs.existsSync(clientDistPath)) {
        const spaRes = await fetch(`http://127.0.0.1:${port}/catalog`);
        expect(spaRes.status).toBe(200);
        const html = await spaRes.text();
        expect(html.toLowerCase()).toContain("<!doctype html>");
      }
    } finally {
      server.close();
    }
  });
});
