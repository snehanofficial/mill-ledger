import { describe, it, expect, beforeAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { prisma } from "../../server/src/db/client.js";
import { salesService } from "../../server/src/modules/sales/sales.service.js";
import { financeService } from "../../server/src/modules/finance/finance.service.js";
import { paymentService } from "../../server/src/modules/finance/payment.service.js";
import type { UserContext } from "../../server/src/types/auth.js";

describe("F-074 Regression: Server Pagination & UI Grid Controls", () => {
  const rootDir = path.resolve(__dirname, "../..");
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

  it("enforces server-side pagination across core entity services", async () => {
    // 1. Sales Orders: max 100
    const orders = await salesService.getSalesOrders(
      orgId,
      adminUser,
      undefined,
      { limit: 200 },
    );
    expect(orders.length).toBeLessThanOrEqual(100);

    // 2. Sales Invoices: max 100
    const invoices = await financeService.getInvoices(orgId, undefined, {
      limit: 200,
    });
    expect(invoices.length).toBeLessThanOrEqual(100);

    // 3. Payments: max 100
    const payments = await paymentService.getPayments(orgId, undefined, {
      limit: 200,
    });
    expect(payments.length).toBeLessThanOrEqual(100);
  });

  it("integrates pagination controls and state into OrdersPage", () => {
    const ordersPageCode = fs.readFileSync(
      path.join(rootDir, "client/src/pages/orders-page.tsx"),
      "utf8",
    );
    expect(ordersPageCode).toContain("const [page, setPage] = useState(1)");
    expect(ordersPageCode).toContain(
      "limit=${pageSize}&offset=${(page - 1) * pageSize}",
    );
    expect(ordersPageCode).toContain("onClick={() => setPage((p) => p + 1)}");
  });

  it("integrates pagination controls and state into InvoicesPage", () => {
    const invoicesPageCode = fs.readFileSync(
      path.join(rootDir, "client/src/pages/invoices-page.tsx"),
      "utf8",
    );
    expect(invoicesPageCode).toContain("const [page, setPage] = useState(1)");
    expect(invoicesPageCode).toContain(
      "limit=${pageSize}&offset=${(page - 1) * pageSize}",
    );
    expect(invoicesPageCode).toContain("onClick={() => setPage((p) => p + 1)}");
  });
});
