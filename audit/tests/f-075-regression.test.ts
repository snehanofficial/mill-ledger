import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { prisma } from "../../server/src/db/client.js";
import { salesService } from "../../server/src/modules/sales/sales.service.js";

describe("F-075 Regression: Product Variant Image Pipeline & Thumbnails", () => {
  const rootDir = path.resolve(__dirname, "../..");
  let orgId: string;

  beforeAll(async () => {
    const org = await prisma.organization.findFirst({
      where: { code: "MILL" },
    });
    if (!org) {
      throw new Error("Organization MILL not found. Seed benchmark first.");
    }
    orgId = org.id;
  });

  it("confirms product_variant table includes imageUrl, thumbnailUrl, and thumbHash columns", async () => {
    const columns = await prisma.$queryRaw<
      Array<{ column_name: string; data_type: string }>
    >`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'product_variant'
        AND column_name IN ('imageUrl', 'thumbnailUrl', 'thumbHash');
    `;

    const names = columns.map((c) => c.column_name);
    expect(names).toContain("imageUrl");
    expect(names).toContain("thumbnailUrl");
    expect(names).toContain("thumbHash");
    expect(columns.length).toBe(3);
  });

  it("verifies salesService.getProducts returns media URLs and thumbnail metadata", async () => {
    const products = await salesService.getProducts(orgId);
    expect(products.length).toBeGreaterThan(0);

    for (const product of products) {
      expect(typeof product.imageUrl).toBe("string");
      expect(typeof product.thumbnailUrl).toBe("string");
      expect(product.imageUrl).toMatch(/\.(svg|webp|png|jpg)$/);
    }
  });

  it("verifies OrdersPage booking modal renders product image with CLS and lazy attributes", () => {
    const ordersPageCode = fs.readFileSync(
      path.join(rootDir, "client/src/pages/orders-page.tsx"),
      "utf8",
    );

    expect(ordersPageCode).toContain('loading="lazy"');
    expect(ordersPageCode).toContain('decoding="async"');
    expect(ordersPageCode).toContain(
      'alt={activeProduct.name || "Product Packaging"}',
    );
    expect(ordersPageCode).toContain("src={activeProduct.imageUrl");
  });
});
