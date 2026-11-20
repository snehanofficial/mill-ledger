/**
 * AUDIT-ONLY SCRIPT
 * Task: Verify Object-Level (BOLA / IDOR) and Property-Level Authorization (Mass Assignment, Cross-Tenant)
 * Standards: OWASP Top 10 API Security 2023 (API1:2023, API3:2023, API5:2023)
 */
import { createServer } from "node:http";
import { createApp } from "../../server/src/app.js";
import { prisma } from "../../server/src/db/client.js";

async function main() {
  const app = createApp();
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log("=== OBJECT & PROPERTY LEVEL AUTHORIZATION VERIFICATION ===");
  console.log(`Server running at ${baseUrl}`);

  async function login(email: string, password: string) {
    const res = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:5173",
      },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(`Login failed for ${email}: ${res.status}`);
    const cookie = res.headers.get("set-cookie")?.split(";")[0] || "";
    const data = await res.json();
    return { cookie, user: data.user };
  }

  try {
    const sm1 = await login("salesman1@millledger.local", "SalesmanPassword123!");
    const sm2 = await login("salesman2@millledger.local", "SalesmanPassword123!");
    const admin = await login("admin@millledger.local", "AdminPassword123!");

    console.log(`Salesman 1 ID: ${sm1.user.id} (${sm1.user.email})`);
    console.log(`Salesman 2 ID: ${sm2.user.id} (${sm2.user.email})`);

    // Find customers assigned to SM1 and SM2
    const sm1Assignments = await prisma.salesmanCustomerAssignment.findMany({
      where: { salesmanId: sm1.user.id },
      include: { customer: true },
    });
    const sm2Assignments = await prisma.salesmanCustomerAssignment.findMany({
      where: { salesmanId: sm2.user.id },
      include: { customer: true },
    });

    console.log(`SM1 has ${sm1Assignments.length} assigned customers:`, sm1Assignments.map(a => a.customer.name));
    console.log(`SM2 has ${sm2Assignments.length} assigned customers:`, sm2Assignments.map(a => a.customer.name));

    const sm2Customer = sm2Assignments[0]?.customer;
    const sm1Customer = sm1Assignments[0]?.customer;

    // Get an active product variant
    const variant = await prisma.productVariant.findFirst({
      where: { product: { isActive: true } },
    });
    if (!variant) throw new Error("No active product variant found");

    // SM2 creates a DRAFT order and a SUBMITTED order
    console.log("\n--- SETUP: SM2 CREATES ORDERS ---");
    const sm2DraftRes = await fetch(`${baseUrl}/api/v1/sales/orders`, {
      method: "POST",
      headers: { Cookie: sm2.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: sm2Customer.id,
        notes: "SM2 Secret Draft Order",
        status: "DRAFT",
        lines: [{ productVariantId: variant.id, quantity: 10 }],
      }),
    });
    const sm2Draft = await sm2DraftRes.json();
    console.log(`SM2 Draft Order created: id=${sm2Draft.order?.id || sm2Draft.id}, status=${sm2Draft.order?.status || sm2Draft.status}`);
    const sm2OrderId = sm2Draft.order?.id || sm2Draft.id;

    // 1. SM1 tries to READ SM2's order by ID
    console.log("\n--- TEST 1: BOLA - SM1 READS SM2 ORDER BY ID ---");
    const readRes = await fetch(`${baseUrl}/api/v1/sales/orders/${sm2OrderId}`, {
      headers: { Cookie: sm1.cookie },
    });
    console.log("SM1 GET /api/v1/sales/orders/:sm2OrderId HTTP Status:", readRes.status);
    console.log("Response Body:", await readRes.text());

    // 2. SM1 tries to EDIT SM2's draft order by ID
    console.log("\n--- TEST 2: BOLA - SM1 EDITS SM2 DRAFT ORDER BY ID ---");
    const editRes = await fetch(`${baseUrl}/api/v1/sales/orders/${sm2OrderId}`, {
      method: "PUT",
      headers: { Cookie: sm1.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        notes: "Tampered by Salesman 1",
      }),
    });
    console.log("SM1 PUT /api/v1/sales/orders/:sm2OrderId HTTP Status:", editRes.status);
    console.log("Response Body:", await editRes.text());

    // 3. SM1 tries to APPROVE SM2's order
    console.log("\n--- TEST 3: PRIVILEGE ESCALATION - SM1 APPROVES SM2 ORDER ---");
    const approveRes = await fetch(`${baseUrl}/api/v1/sales/orders/${sm2OrderId}/approve`, {
      method: "POST",
      headers: { Cookie: sm1.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    console.log("SM1 POST /api/v1/sales/orders/:sm2OrderId/approve HTTP Status:", approveRes.status);
    console.log("Response Body:", await approveRes.text());

    // 4. SM1 tries to INVOICE SM2's order
    console.log("\n--- TEST 4: PRIVILEGE ESCALATION - SM1 INVOICES SM2 ORDER ---");
    const invoiceRes = await fetch(`${baseUrl}/api/v1/finance/invoices`, {
      method: "POST",
      headers: { Cookie: sm1.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ salesOrderId: sm2OrderId }),
    });
    console.log("SM1 POST /api/v1/finance/invoices HTTP Status:", invoiceRes.status);
    console.log("Response Body:", await invoiceRes.text());

    // 5. SM1 tries to create order for SM2's customer
    console.log("\n--- TEST 5: BOLA - SM1 CREATES ORDER FOR SM2'S ASSIGNED CUSTOMER ---");
    const crossCustRes = await fetch(`${baseUrl}/api/v1/sales/orders`, {
      method: "POST",
      headers: { Cookie: sm1.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: sm2Customer.id,
        lines: [{ productVariantId: variant.id, quantity: 5 }],
      }),
    });
    console.log("SM1 create order for SM2 customer HTTP Status:", crossCustRes.status);
    console.log("Response Body:", await crossCustRes.text());

    // 6. SM1 queries dispatches list (GET /api/v1/sales/dispatches)
    console.log("\n--- TEST 6: DATA LEAK - SM1 READS ALL COMPANY DISPATCHES ---");
    const dispatchesRes = await fetch(`${baseUrl}/api/v1/sales/dispatches`, {
      headers: { Cookie: sm1.cookie },
    });
    console.log("SM1 GET /api/v1/sales/dispatches HTTP Status:", dispatchesRes.status);
    const dispatchesData = await dispatchesRes.json();
    console.log(`SM1 received ${dispatchesData.dispatches?.length || 0} dispatches!`);
    if (dispatchesData.dispatches?.length > 0) {
      const sample = dispatchesData.dispatches[0];
      console.log("Sample dispatch contains:", {
        dispatchNumber: sample.dispatchNumber,
        customerName: sample.salesOrder?.customer?.name,
        invoiceNumber: sample.salesInvoice?.invoiceNumber,
        salesOrderId: sample.salesOrderId,
      });
    }

    // 7. MASS ASSIGNMENT: SM1 creates order with status = APPROVED
    console.log("\n--- TEST 7: MASS ASSIGNMENT - SM1 CREATES ORDER WITH STATUS=APPROVED ---");
    const massCreateRes = await fetch(`${baseUrl}/api/v1/sales/orders`, {
      method: "POST",
      headers: { Cookie: sm1.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: sm1Customer.id,
        status: "APPROVED",
        notes: "Backdoor Approved Order",
        lines: [{ productVariantId: variant.id, quantity: 1 }],
      }),
    });
    console.log("SM1 create with status=APPROVED HTTP Status:", massCreateRes.status);
    const massCreated = await massCreateRes.json();
    const createdStatus = massCreated.order?.status || massCreated.status;
    console.log(`Created Order status in response: ${createdStatus}`);
    const checkDbOrder = await prisma.salesOrder.findUnique({
      where: { id: massCreated.order?.id || massCreated.id },
    });
    console.log(`ACTUAL STATUS IN POSTGRESQL DATABASE: ${checkDbOrder?.status}`);
    const checkReservations = await prisma.stockReservation.findMany({
      where: { salesOrderId: checkDbOrder?.id },
    });
    console.log(`Stock reservations created: ${checkReservations.length}`);

    // 8. MASS ASSIGNMENT: SM1 updates DRAFT order with status = APPROVED
    console.log("\n--- TEST 8: MASS ASSIGNMENT - SM1 UPDATES DRAFT ORDER WITH STATUS=APPROVED ---");
    // Create valid draft for SM1
    const sm1DraftRes = await fetch(`${baseUrl}/api/v1/sales/orders`, {
      method: "POST",
      headers: { Cookie: sm1.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: sm1Customer.id,
        status: "DRAFT",
        notes: "SM1 Draft to escalate",
        lines: [{ productVariantId: variant.id, quantity: 1 }],
      }),
    });
    const sm1Draft = await sm1DraftRes.json();
    const sm1DraftId = sm1Draft.order?.id || sm1Draft.id;

    const escalateRes = await fetch(`${baseUrl}/api/v1/sales/orders/${sm1DraftId}`, {
      method: "PUT",
      headers: { Cookie: sm1.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "APPROVED",
      }),
    });
    console.log("SM1 PUT draft order status=APPROVED HTTP Status:", escalateRes.status);
    console.log("Response Body:", await escalateRes.text());
    const dbOrderAfterPut = await prisma.salesOrder.findUnique({
      where: { id: sm1DraftId },
    });
    console.log(`ACTUAL STATUS IN DATABASE AFTER PUT: ${dbOrderAfterPut?.status}`);

    // 9. MASS ASSIGNMENT: Arbitrary Unit Price (0 or 0.01)
    console.log("\n--- TEST 9: PRICE MANIPULATION - SM1 OVERRIDES UNIT PRICE TO 0.01 ---");
    const cheapOrderRes = await fetch(`${baseUrl}/api/v1/sales/orders`, {
      method: "POST",
      headers: { Cookie: sm1.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: sm1Customer.id,
        lines: [{ productVariantId: variant.id, quantity: 100, unitPrice: 0.01 }],
      }),
    });
    console.log("SM1 create order with unitPrice=0.01 HTTP Status:", cheapOrderRes.status);
    const cheapOrder = await cheapOrderRes.json();
    const cheapLine = cheapOrder.order?.lines?.[0] || cheapOrder.lines?.[0];
    console.log(`Line unit price accepted by server: ${cheapLine?.quotedUnitPrice}`);
    console.log(`Total amount billed for 100 units: ${cheapOrder.order?.totalAmount || cheapOrder.totalAmount}`);

    // 10. CROSS-TENANT / ORGANIZATION BOUNDARY
    console.log("\n--- TEST 10: CROSS-TENANT ACCESS ---");
    const tenantAccessRes = await fetch(`${baseUrl}/api/v1/sales/customers?organizationId=UNKNOWN_TENANT_999`, {
      headers: { Cookie: sm1.cookie },
    });
    console.log("SM1 query customers with organizationId=UNKNOWN_TENANT_999 HTTP Status:", tenantAccessRes.status);
    console.log("Response Body:", await tenantAccessRes.text());

  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

main().catch(console.error);
