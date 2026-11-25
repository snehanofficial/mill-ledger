import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { createApp } from "../../server/src/app.js";
import { prisma } from "../../server/src/db/client.js";
import { resetOperationalData } from "../../server/src/db/reset.js";
import { seedBenchmarkMasters } from "../../server/src/db/seed.js";

describe("F-077 Regression: Offline Stale Price Revalidation & Administrative Review", () => {
  let server: Server;
  let baseUrl: string;
  let salesmanCookie: string;
  let orgId: string;
  let customerId: string;
  let variantId: string;

  beforeAll(async () => {
    await resetOperationalData();
    await seedBenchmarkMasters();

    const app = createApp();
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;

    // Login as salesman
    const loginRes = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "salesman1@millledger.local",
        password: "SalesmanPassword123!",
      }),
    });
    salesmanCookie = loginRes.headers.get("set-cookie") ?? "";

    const org = await prisma.organization.findUniqueOrThrow({
      where: { code: "MILL" },
    });
    orgId = org.id;

    const cust = await prisma.customer.findFirstOrThrow({
      where: { code: "CUST-RET-A" },
    });
    customerId = cust.id;

    const variant = await prisma.productVariant.findFirstOrThrow({
      where: { sku: "VAR-MURUKKU-200G" },
    });
    variantId = variant.id;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("client sync-engine passes pricedAt in order payload and use-offline sets periodic refresh", () => {
    const rootDir = path.resolve(__dirname, "../..");
    const syncEnginePath = path.join(
      rootDir,
      "client/src/offline/sync-engine.ts",
    );
    const useOfflinePath = path.join(
      rootDir,
      "client/src/offline/use-offline.ts",
    );

    const syncEngineContent = fs.readFileSync(syncEnginePath, "utf8");
    expect(syncEngineContent).toContain("pricedAt: order.pricedAt");

    const useOfflineContent = fs.readFileSync(useOfflinePath, "utf8");
    expect(useOfflineContent).toContain("setInterval");
    expect(useOfflineContent).toContain("refreshMasterDataSnapshot");
  });

  it("blocks auto-approval and flags UNDER_REVIEW when an order quotes a stale price after a price list revision", async () => {
    // 1. Simulate an update to the price list line right now (price is 50.00, updated now)
    const priceList = await prisma.priceList.findFirstOrThrow({
      where: { organizationId: orgId, isDefault: true },
    });

    const now = new Date();
    await prisma.priceListLine.update({
      where: {
        priceListId_productVariantId: {
          priceListId: priceList.id,
          productVariantId: variantId,
        },
      },
      data: {
        price: 50.0,
        updatedAt: now,
      },
    });

    // 2. Salesman syncs an order that was priced 2 hours ago using an outdated quoted price (e.g. ₹48.00)
    // Under standard online discount rules, ₹48.00 is a 4% discount which is within 5% discretion (would be SUBMITTED).
    // But because the price list was updated AFTER the order was priced, the server revalidates freshness,
    // detects stale price acceptance risk, and flags it into UNDER_REVIEW with an overrideReason.
    const stalePricedAt = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago

    const res = await fetch(`${baseUrl}/api/v1/sales/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: salesmanCookie,
      },
      body: JSON.stringify({
        organizationId: orgId,
        customerId,
        pricedAt: stalePricedAt.toISOString(),
        idempotencyKey: `idem-stale-price-${Date.now()}`,
        lines: [
          {
            productVariantId: variantId,
            quantity: 10,
            unitPrice: 48.0,
          },
        ],
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      order: {
        id: string;
        status: string;
        overrideReason: string | null;
        lines: Array<{ quotedUnitPrice: string | number }>;
      };
    };

    // Must be flagged for administrative review, NOT auto-submitted
    expect(body.order.status).toBe("UNDER_REVIEW");
    expect(body.order.overrideReason).toContain("Stale offline price");
    expect(body.order.overrideReason).toContain("VAR-MURUKKU-200G");
  });

  it("allows normal salesman discretion (SUBMITTED) when price list has not been revised since quotation", async () => {
    // Order priced after the latest price list update
    const freshPricedAt = new Date(Date.now() + 60 * 1000); // 1 minute in the future

    const res = await fetch(`${baseUrl}/api/v1/sales/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: salesmanCookie,
      },
      body: JSON.stringify({
        organizationId: orgId,
        customerId,
        pricedAt: freshPricedAt.toISOString(),
        idempotencyKey: `idem-fresh-price-${Date.now()}`,
        lines: [
          {
            productVariantId: variantId,
            quantity: 10,
            unitPrice: 48.5, // 3% discount within discretion
          },
        ],
      }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      order: {
        id: string;
        status: string;
      };
    };

    expect(body.order.status).toBe("SUBMITTED");
  });
});
