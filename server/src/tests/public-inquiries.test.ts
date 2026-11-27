import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app.js";

describe("Public Inquiry API & Robots headers", () => {
  const app = createApp();
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("accepts a valid demo inquiry and returns 201 with referenceId and noindex header", async () => {
    const res = await fetch(`${baseUrl}/api/v1/public/inquiries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "S. Ramanathan",
        businessName: "Kaveri Grain Mills",
        phone: "+91 98765 43210",
        email: "ram@kaverimills.in",
        inquiryType: "product_demo",
        message: "We want to see BOM yield tracking and offline salesman ordering.",
        sourcePath: "/demo",
        utmSource: "google",
        utmMedium: "organic",
      }),
    });

    const body = (await res.json()) as { referenceId: string };
    expect(res.status).toBe(201);
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(body.referenceId).toMatch(/^INQ-\d{8}-[A-F0-9]{6}$/);
  });

  it("rejects invalid phone and short message with 400 VALIDATION_ERROR", async () => {
    const res = await fetch(`${baseUrl}/api/v1/public/inquiries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "A",
        phone: "123",
        message: "hi",
      }),
    });

    const body = (await res.json()) as { code: string; fieldErrors: unknown };
    expect(res.status).toBe(400);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.fieldErrors).toBeDefined();
  });
});
