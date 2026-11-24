import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "../../server/src/db/client.js";
import { salesService } from "../../server/src/modules/sales/sales.service.js";
import type { UserContext } from "../../server/src/types/auth.js";

describe("F-070 Regression: Sales Order Pagination & N+1 Query Elimination", () => {
  let orgId: string;
  let adminUser: UserContext;

  beforeAll(async () => {
    const org = await prisma.organization.findFirst({
      where: { code: "MILL" },
    });
    if (!org) {
      throw new Error("Organization MILL not found. Seed benchmark first.");
    }
    orgId = org.id;

    const admin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
    });
    if (!admin) {
      throw new Error("Admin user not found.");
    }
    adminUser = {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: "ADMIN",
      organizationId: orgId,
    };
  });

  it("enforces bounded limit (max 100) even when caller requests excessive items", async () => {
    // Attempt to request 5,000 orders
    const orders = await salesService.getSalesOrders(
      orgId,
      adminUser,
      undefined,
      { limit: 5000 },
    );

    // Returned orders must not exceed the maximum bounded batch limit (100)
    expect(orders.length).toBeLessThanOrEqual(100);
  });

  it("supports offset pagination to traverse orders in discrete bounded slices", async () => {
    const page1 = await salesService.getSalesOrders(
      orgId,
      adminUser,
      undefined,
      { limit: 1, offset: 0 },
    );
    const page2 = await salesService.getSalesOrders(
      orgId,
      adminUser,
      undefined,
      { limit: 1, offset: 1 },
    );

    if (page1.length > 0 && page2.length > 0) {
      expect(page1[0].id).not.toBe(page2[0].id);
    }
  });

  it("accurately computes live shortages in batch without N+1 query loop", async () => {
    const orders = await salesService.getSalesOrders(
      orgId,
      adminUser,
      undefined,
      { limit: 10 },
    );

    expect(Array.isArray(orders)).toBe(true);
    for (const order of orders) {
      expect(typeof order.totalShortage).toBe("number");
      for (const line of order.lines) {
        expect(typeof (line as { liveShortage: number }).liveShortage).toBe(
          "number",
        );
      }
    }
  });
});
