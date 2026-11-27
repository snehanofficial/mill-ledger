import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { prisma } from "../db/client.js";
import { auth } from "../lib/auth.js";
import { resetOperationalData } from "../db/reset.js";
import { seedBenchmarkMasters } from "../db/seed.js";

describe("Warehouse management, warehouse-level inventory, and organization isolation", () => {
  let server: Server;
  let baseUrl: string;
  let millOrgId: string;
  let orgBId: string;
  let orgBAdminId: string;
  const runSuffix = Date.now().toString().slice(-5);
  const testFacCode = `FAC-${runSuffix}`;
  const testWhCode = `WH-${runSuffix}`;

  beforeAll(async () => {
    await resetOperationalData();
    await seedBenchmarkMasters();

    const millOrg = await prisma.organization.findUniqueOrThrow({
      where: { code: "MILL" },
    });
    millOrgId = millOrg.id;

    // Create a second isolated organization and its sole ADMIN user
    const orgB = await prisma.organization.upsert({
      where: { code: "ORG-B" },
      update: {},
      create: {
        code: "ORG-B",
        name: "Competing Mill B Pvt Ltd",
        state: "Karnataka",
      },
    });
    orgBId = orgB.id;

    const orgBEmail = `admin-b-${Date.now()}@orgb.local`;
    await auth.api.signUpEmail({
      body: {
        email: orgBEmail,
        password: "OrgBPassword123!",
        name: "Org B Admin",
      },
    });
    const orgBAdmin = await prisma.user.update({
      where: { email: orgBEmail },
      data: {
        role: "ADMIN",
        isActive: true,
        organizationId: orgB.id,
      },
    });
    orgBAdminId = orgBAdmin.id;

    const app = createApp();
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    if (orgBAdminId) {
      await prisma.session.deleteMany({ where: { userId: orgBAdminId } });
      await prisma.user.deleteMany({ where: { id: orgBAdminId } });
    }
    if (orgBId) {
      await prisma.organization.deleteMany({ where: { id: orgBId } });
    }
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  async function loginAndGetCookie(email: string, password: string) {
    const res = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return res.headers.get("set-cookie") ?? "";
  }

  it("enforces facility & warehouse CRUD, org-level uniqueness, and safe deactivation guards", async () => {
    const adminCookie = await loginAndGetCookie(
      "admin@millledger.local",
      "AdminPassword123!",
    );

    // 1. Create a new Facility
    const facRes = await fetch(`${baseUrl}/api/v1/masters/facilities`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        code: testFacCode,
        name: "Chennai Hub",
        state: "Tamil Nadu",
      }),
    });
    expect(facRes.status).toBe(201);
    const { facility } = (await facRes.json()) as {
      facility: { id: string; code: string; isActive: boolean };
    };
    expect(facility.code).toBe(testFacCode);

    // Duplicate facility code in same org -> 409
    const dupFacRes = await fetch(`${baseUrl}/api/v1/masters/facilities`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ code: testFacCode, name: "Duplicate" }),
    });
    expect(dupFacRes.status).toBe(409);

    // 2. Create a Warehouse under FAC-2
    const whRes = await fetch(`${baseUrl}/api/v1/masters/warehouses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        facilityId: facility.id,
        code: testWhCode,
        name: "Chennai Distribution Warehouse",
      }),
    });
    expect(whRes.status).toBe(201);
    const { warehouse } = (await whRes.json()) as {
      warehouse: { id: string; code: string; organizationId: string };
    };
    expect(warehouse.code).toBe(testWhCode);
    expect(warehouse.organizationId).toBe(millOrgId);

    // 3. Cannot deactivate facility while WH-2 is active -> 409
    const blockFacDeact = await fetch(
      `${baseUrl}/api/v1/masters/facilities/${facility.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ isActive: false }),
      },
    );
    expect(blockFacDeact.status).toBe(409);

    // 4. Deactivate empty WH-2 -> 200, then deactivate FAC-2 -> 200
    const whDeact = await fetch(
      `${baseUrl}/api/v1/masters/warehouses/${warehouse.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ isActive: false }),
      },
    );
    expect(whDeact.status).toBe(200);

    const facDeact = await fetch(
      `${baseUrl}/api/v1/masters/facilities/${facility.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ isActive: false }),
      },
    );
    expect(facDeact.status).toBe(200);

    // Reactivate both for subsequent tests
    await fetch(`${baseUrl}/api/v1/masters/facilities/${facility.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ isActive: true }),
    });
    await fetch(`${baseUrl}/api/v1/masters/warehouses/${warehouse.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ isActive: true }),
    });
  });

  it("tracks warehouse-level stock balances, inter-warehouse transfers, warehouse ATP, and reconciliation", async () => {
    const adminCookie = await loginAndGetCookie(
      "admin@millledger.local",
      "AdminPassword123!",
    );

    const wh1 = await prisma.warehouse.findFirstOrThrow({
      where: { organizationId: millOrgId, code: "WH-1" },
    });
    const wh2 = await prisma.warehouse.findFirstOrThrow({
      where: { organizationId: millOrgId, code: testWhCode },
    });
    const fgItem = await prisma.inventoryItem.findFirstOrThrow({
      where: { organizationId: millOrgId, sku: "FG-MURUKKU-200G" },
    });
    const customer = await prisma.customer.findFirstOrThrow({
      where: { organizationId: millOrgId },
    });
    const variant = await prisma.productVariant.findFirstOrThrow({
      where: { inventoryItemId: fgItem.id },
    });

    // Ensure WH-1 has enough stock for test via adjustment
    const adjRes = await fetch(`${baseUrl}/api/v1/inventory/adjustments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        warehouseId: wh1.id,
        inventoryItemId: fgItem.id,
        quantity: 50,
        reason: "Multi-warehouse test stock",
      }),
    });
    expect(adjRes.status).toBe(201);

    // Transfer 20 units from WH-1 -> WH-2 (with idempotencyKey)
    const idempKey = `trf-${Date.now()}`;
    const trfRes = await fetch(`${baseUrl}/api/v1/inventory/transfers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        fromWarehouseId: wh1.id,
        toWarehouseId: wh2.id,
        idempotencyKey: idempKey,
        notes: "Hub replenishment",
        items: [{ inventoryItemId: fgItem.id, quantity: 20 }],
      }),
    });
    expect(trfRes.status).toBe(201);

    // Retry with same idempotencyKey -> returns same transfer without double-moving
    const trfRetry = await fetch(`${baseUrl}/api/v1/inventory/transfers`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        fromWarehouseId: wh1.id,
        toWarehouseId: wh2.id,
        idempotencyKey: idempKey,
        items: [{ inventoryItemId: fgItem.id, quantity: 20 }],
      }),
    });
    expect(trfRetry.status).toBe(201);

    // Verify WH-2 balance is 20
    const wh2BalRes = await fetch(
      `${baseUrl}/api/v1/inventory/balances?warehouseId=${wh2.id}`,
      { headers: { Cookie: adminCookie } },
    );
    expect(wh2BalRes.status).toBe(200);
    const { balances: wh2Balances } = (await wh2BalRes.json()) as {
      balances: Array<{ id: string; onHand: number; available: number }>;
    };
    const wh2Fg = wh2Balances.find((b) => b.id === fgItem.id);
    expect(wh2Fg?.onHand).toBe(20);
    expect(wh2Fg?.available).toBe(20);

    // Cannot deactivate WH-2 while it holds 20 units -> 409
    const blockWh2Deact = await fetch(
      `${baseUrl}/api/v1/masters/warehouses/${wh2.id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({ isActive: false }),
      },
    );
    expect(blockWh2Deact.status).toBe(409);

    // Create SalesOrder on WH-2 for 25 units (exceeds WH-2's 20, even though WH-1 has more!)
    const overOrderRes = await fetch(`${baseUrl}/api/v1/sales/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        customerId: customer.id,
        warehouseId: wh2.id,
        orderNumber: `SO-WH2-OVER-${Date.now()}`,
        status: "SUBMITTED",
        lines: [{ productVariantId: variant.id, quantity: 25, unitPrice: 50 }],
      }),
    });
    expect(overOrderRes.status).toBe(201);
    const { order: overOrder } = (await overOrderRes.json()) as {
      order: { id: string };
    };

    const approveOverRes = await fetch(
      `${baseUrl}/api/v1/sales/orders/${overOrder.id}/approve`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: adminCookie },
        body: JSON.stringify({}),
      },
    );
    expect(approveOverRes.status).toBe(400); // Insufficient WH-2 stock!

    // Reconciliation check across all warehouses
    const reconRes = await fetch(`${baseUrl}/api/v1/inventory/reconciliation`, {
      headers: { Cookie: adminCookie },
    });
    expect(reconRes.status).toBe(200);
    const recon = (await reconRes.json()) as {
      reconciled: boolean;
      discrepancyCount: number;
    };
    expect(recon.reconciled).toBe(true);
    expect(recon.discrepancyCount).toBe(0);
  });

  it("blocks cross-organization access (including MILL exemption) and scopes last-admin guard per organization", async () => {
    const orgBUser = await prisma.user.findUniqueOrThrow({
      where: { id: orgBAdminId },
    });
    const orgBCookie = await loginAndGetCookie(
      orgBUser.email,
      "OrgBPassword123!",
    );

    // 1. Org B admin cannot access MILL via query, body, or header
    const millQueryRes = await fetch(
      `${baseUrl}/api/v1/dashboard?organizationId=MILL`,
      { headers: { Cookie: orgBCookie } },
    );
    expect(millQueryRes.status).toBe(403);

    const millCuidRes = await fetch(
      `${baseUrl}/api/v1/dashboard?organizationId=${millOrgId}`,
      { headers: { Cookie: orgBCookie } },
    );
    expect(millCuidRes.status).toBe(403);

    const headerSpoofRes = await fetch(`${baseUrl}/api/v1/dashboard`, {
      headers: {
        Cookie: orgBCookie,
        "x-organization-id": millOrgId,
      },
    });
    expect(headerSpoofRes.status).toBe(403);

    // 2. Org B admin cannot see or mutate Org A's warehouses
    const wh1 = await prisma.warehouse.findFirstOrThrow({
      where: { organizationId: millOrgId, code: "WH-1" },
    });
    const crossWhRes = await fetch(
      `${baseUrl}/api/v1/masters/warehouses/${wh1.id}`,
      { headers: { Cookie: orgBCookie } },
    );
    expect(crossWhRes.status).toBe(404);

    // 3. Last-admin guard is scoped per organization: Org B admin cannot deactivate self even though MILL has admins
    const selfDeactRes = await fetch(`${baseUrl}/api/v1/users/${orgBAdminId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: orgBCookie },
      body: JSON.stringify({ isActive: false }),
    });
    expect(selfDeactRes.status).toBe(400);
  });
});
