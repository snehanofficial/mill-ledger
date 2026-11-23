import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createServer, type Server } from "node:http";
import { createApp } from "../../server/src/app.js";
import { prisma } from "../../server/src/db/client.js";

describe("F-042 Regression Test: Dedicated Product Tile Ordering Interface & Stepper Touch Targets", () => {
  const newOrderPagePath = path.resolve(
    process.cwd(),
    "client/src/pages/new-order-page.tsx",
  );
  const appTsxPath = path.resolve(process.cwd(), "client/src/app.tsx");
  const murukkuSvgPath = path.resolve(
    process.cwd(),
    "client/public/products/murukku.svg",
  );

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

  it("client/src/app.tsx routes /orders/new to real NewOrderPage instead of placeholder", () => {
    const appTsxContent = fs.readFileSync(appTsxPath, "utf-8");
    expect(appTsxContent).toContain('import("@/pages/new-order-page")');
    expect(appTsxContent).not.toMatch(
      /import\("@\/pages\/placeholder-pages"\)\.then\(\(m\) => \(\{ default: m\.NewOrderPage \}\)\)/,
    );
  });

  it("client/src/pages/new-order-page.tsx renders product tiles, semantic img, and 44x44px accessible steppers", () => {
    expect(fs.existsSync(newOrderPagePath)).toBe(true);
    expect(fs.existsSync(murukkuSvgPath)).toBe(true);

    const content = fs.readFileSync(newOrderPagePath, "utf-8");

    // 1. Must render .product-card tiles
    expect(content).toContain("product-card");

    // 2. Must render semantic <img> tag with alt description
    expect(content).toContain("<img");
    expect(content).toContain('alt={`${product.name} packaging pouch`}');

    // 3. Must implement WCAG 2.2 SC 2.5.8 / Apple HIG touch target size (minimum 44x44 px)
    expect(content).toContain("min-w-[44px]");
    expect(content).toContain("min-h-[44px]");
    expect(content).toContain("size-11");

    // 4. Must provide accessible aria-labels for stepper buttons
    expect(content).toContain('aria-label={`Decrease quantity of ${product.name}`}');
    expect(content).toContain('aria-label={`Increase quantity of ${product.name}`}');

    // 5. Must calculate place of supply and GST breakdown
    expect(content).toContain("Place of Supply");
    expect(content).toContain("Intra-state (CGST 2.5% + SGST 2.5%)");
    expect(content).toContain("Inter-state (IGST 5.0%)");

    // 6. Must feature sticky bottom checkout summary bar
    expect(content).toContain("Grand Total (incl. GST)");
    expect(content).toContain("Place Sales Order");
  });

  it("POST /api/v1/sales/orders submits sales order successfully from salesman session", async () => {
    // 1. Sign in as salesman1
    const loginRes = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "salesman1@millledger.local",
        password: "SalesmanPassword123!",
      }),
    });
    expect(loginRes.status).toBe(200);
    const cookie = loginRes.headers.get("set-cookie") || "";

    // 2. Fetch customer and product
    const customer = await prisma.customer.findFirst({
      where: { code: "CUST-RET-A" },
    });
    expect(customer).toBeDefined();

    const variant = await prisma.productVariant.findFirst({
      where: { sku: "VAR-MURUKKU-200G" },
    });
    expect(variant).toBeDefined();

    const orderPayload = {
      organizationId: "MILL",
      customerId: customer!.id,
      orderNumber: `SO-F042-${Date.now().toString().slice(-4)}`,
      notes: "Product tile order entry regression test",
      lines: [
        {
          productVariantId: variant!.id,
          quantity: 20,
          unitPrice: 50.0,
        },
      ],
    };

    const orderRes = await fetch(`${baseUrl}/api/v1/sales/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify(orderPayload),
    });

    expect(orderRes.status).toBe(201);
    const orderData = await orderRes.json();
    expect(orderData.order).toBeDefined();
    expect(orderData.order.status).toBe("SUBMITTED");
    expect(orderData.order.customerId).toBe(customer!.id);

    // Clean up created test order
    await prisma.salesOrderLine.deleteMany({
      where: { salesOrderId: orderData.order.id },
    });
    await prisma.stockReservation.deleteMany({
      where: { salesOrderId: orderData.order.id },
    });
    await prisma.salesOrder.delete({
      where: { id: orderData.order.id },
    });
  });
});
