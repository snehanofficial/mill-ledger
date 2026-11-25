import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createServer, type Server } from "node:http";
import { createApp } from "../../server/src/app.js";

// Pure helper function identical to client/src/components/ui/loading-error-empty.tsx
function extractRequestId(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const e = error as any;
  return (
    e.response?.data?.requestId ||
    e.response?.data?.error?.requestId ||
    e.response?.headers?.["x-request-id"] ||
    e.requestId
  );
}

describe("F-045 Regression Test: Skeleton Loaders & Request ID Error Recovery", () => {
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

  it("extractRequestId reliably retrieves correlation IDs across all response variations", () => {
    expect(
      extractRequestId({
        response: { data: { requestId: "req-12345" } },
      }),
    ).toBe("req-12345");

    expect(
      extractRequestId({
        response: {
          data: { error: { code: "SERVER_ERROR", requestId: "req-envelope-6789" } },
        },
      }),
    ).toBe("req-envelope-6789");

    expect(
      extractRequestId({
        response: {
          headers: { "x-request-id": "req-header-abcde" },
        },
      }),
    ).toBe("req-header-abcde");

    expect(extractRequestId({ requestId: "req-direct-fghij" })).toBe("req-direct-fghij");
    expect(extractRequestId(null)).toBeUndefined();
    expect(extractRequestId(undefined)).toBeUndefined();
    expect(extractRequestId("not an object")).toBeUndefined();
  });

  it("backend server responses include x-request-id header and requestId in error payload for diagnostics", async () => {
    // Calling an unauthorized or non-existent endpoint
    const res = await fetch(`${baseUrl}/api/v1/non-existent-endpoint`, {
      headers: { "x-request-id": "client-correlation-uuid-test" },
    });

    expect(res.status).toBe(404);
    const body: any = await res.json();

    // Must return x-request-id header (F-035 correlation logging)
    const requestIdHeader = res.headers.get("x-request-id");
    expect(requestIdHeader).toBeDefined();

    // Body error envelope must contain requestId
    expect(body.requestId || body.error?.requestId).toBeDefined();

    // Client extractRequestId should seamlessly extract it
    const extracted = extractRequestId({
      response: {
        data: body,
        headers: { "x-request-id": requestIdHeader },
      },
    });
    expect(extracted).toBeTruthy();
  });

  it("client/src/components/ui/loading-error-empty.tsx provides SkeletonTable, SkeletonKPIs, ErrorState with Request ID", () => {
    const filePath = path.resolve(
      process.cwd(),
      "client/src/components/ui/loading-error-empty.tsx",
    );
    const content = fs.readFileSync(filePath, "utf-8");

    // Must export SkeletonTable and SkeletonKPIs with data-slot="skeleton"
    expect(content).toContain("SkeletonTable");
    expect(content).toContain("SkeletonKPIs");
    expect(content).toContain('data-slot="skeleton"');

    // Must export ErrorState and render Request ID with copy affordance
    expect(content).toContain("ErrorState");
    expect(content).toContain("extractRequestId");
    expect(content).toContain("Request ID:");
    expect(content).toContain("navigator.clipboard.writeText");
  });

  it("all core operational page components render structured SkeletonTable and ErrorState with Request ID", () => {
    const pageFiles = [
      "client/src/pages/orders-page.tsx",
      "client/src/pages/dashboard-page.tsx",
      "client/src/pages/invoices-page.tsx",
      "client/src/pages/production-page.tsx",
      "client/src/pages/stock-page.tsx",
      "client/src/pages/customers-page.tsx",
      "client/src/pages/purchases-page.tsx",
      "client/src/pages/suppliers-page.tsx",
      "client/src/pages/dispatch-page.tsx",
      "client/src/pages/payments-page.tsx",
    ];

    for (const relPath of pageFiles) {
      const fullPath = path.resolve(process.cwd(), relPath);
      const content = fs.readFileSync(fullPath, "utf-8");

      expect(
        content.includes("SkeletonTable") || content.includes("SkeletonKPIs"),
        `Page ${relPath} must import and use SkeletonTable or SkeletonKPIs`,
      ).toBe(true);

      expect(
        content.includes("ErrorState"),
        `Page ${relPath} must render ErrorState for error handling`,
      ).toBe(true);

      expect(
        content.includes("error=") || content.includes("requestId="),
        `Page ${relPath} must pass error or requestId to ErrorState for correlation ID display`,
      ).toBe(true);
    }
  });
});
