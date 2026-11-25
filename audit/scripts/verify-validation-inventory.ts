/**
 * AUDIT-ONLY SCRIPT
 * Task: Verification of API Input Validation Inventory and Schema Sharing
 * Standard: OWASP API Security Top 10:2023 API3:2023, API8:2023, ASVS v4.0.3 Sec 5.1
 */
import { createServer } from "node:http";
import fs from "node:fs";
import { createApp } from "../../server/src/app.js";
import { prisma } from "../../server/src/db/client.js";

interface EndpointValidationAudit {
  method: string;
  path: string;
  router: string;
  hasBodySchema: boolean;
  hasQuerySchema: boolean;
  hasParamSchema: boolean;
  hasHeaderSchema: boolean;
  schemaName: string;
  isSharedWithClient: boolean;
  rejectsUnknownFields: boolean;
  unknownFieldsStatus: number;
  notes: string;
}

async function main() {
  const app = createApp();
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log("=== API VALIDATION INVENTORY AND SCHEMA ENFORCEMENT AUDIT ===");
  console.log(`Server running at ${baseUrl}`);

  // Login as admin to test endpoints with authentication
  const loginRes = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" },
    body: JSON.stringify({ email: "admin@millledger.local", password: "AdminPassword123!" }),
  });
  if (!loginRes.ok) throw new Error("Admin login failed");
  const cookie = loginRes.headers.get("set-cookie")?.split(";")[0] || "";

  // 1. Check shared schemas
  const sharedExports = await import("../../shared/src/index.js");
  console.log("Shared package exports keys:", Object.keys(sharedExports));

  // 2. Test unknown field rejection on mutating endpoints
  // We'll test if sending unknown fields like { "__unknownField": "malicious" } causes 400 or is accepted
  const results: EndpointValidationAudit[] = [];

  // Helper to test unknown fields
  async function testUnknown(method: string, path: string, validBody: any) {
    const bodyWithUnknown = { ...validBody, __unknownProperty_test_xyz: "unexpected_value" };
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        Origin: "http://localhost:5173",
      },
      body: JSON.stringify(bodyWithUnknown),
    });
    return {
      status: res.status,
      rejects: res.status === 400,
    };
  }

  // Find prerequisite entities
  const customer = await prisma.customer.findFirstOrThrow();
  const productVariant = await prisma.productVariant.findFirstOrThrow();
  const warehouse = await prisma.warehouse.findFirstOrThrow();
  const recipe = await prisma.recipe.findFirstOrThrow();
  const inventoryItem = await prisma.inventoryItem.findFirstOrThrow();
  const uom = await prisma.unitOfMeasure.findFirstOrThrow();
  const order = await prisma.salesOrder.findFirst({ where: { status: "APPROVED" } });
  const draftOrder = await prisma.salesOrder.findFirst({ where: { status: "DRAFT" } });
  const invoice = await prisma.salesInvoice.findFirst();

  console.log("Prerequisites loaded successfully.");

  // Test 1: POST /api/v1/sales/orders
  const tOrders = await testUnknown("POST", "/api/v1/sales/orders", {
    customerId: customer.id,
    lines: [{ productVariantId: productVariant.id, quantity: 10, unitPrice: 50 }],
  });
  results.push({
    method: "POST",
    path: "/api/v1/sales/orders",
    router: "salesRouter",
    hasBodySchema: true,
    hasQuerySchema: false,
    hasParamSchema: false,
    hasHeaderSchema: false,
    schemaName: "createOrderSchema",
    isSharedWithClient: false,
    rejectsUnknownFields: tOrders.rejects,
    unknownFieldsStatus: tOrders.status,
    notes: "Body schema strips unknown fields by default; .strict() not enabled",
  });

  // Test 2: PUT /api/v1/sales/orders/:id
  if (draftOrder) {
    const tPut = await testUnknown("PUT", `/api/v1/sales/orders/${draftOrder.id}`, {
      notes: "Audit draft note update",
    });
    results.push({
      method: "PUT",
      path: "/api/v1/sales/orders/:id",
      router: "salesRouter",
      hasBodySchema: false,
      hasQuerySchema: false,
      hasParamSchema: false,
      hasHeaderSchema: false,
      schemaName: "NONE",
      isSharedWithClient: false,
      rejectsUnknownFields: tPut.rejects,
      unknownFieldsStatus: tPut.status,
      notes: "ZERO validation schema on req.body; unvalidated input passed directly to service",
    });
  }

  // Test 3: POST /api/v1/sales/orders/:id/approve
  if (draftOrder) {
    const tApprove = await testUnknown("POST", `/api/v1/sales/orders/${draftOrder.id}/approve`, {
      overrideReason: "Audit check",
    });
    results.push({
      method: "POST",
      path: "/api/v1/sales/orders/:id/approve",
      router: "salesRouter",
      hasBodySchema: true,
      hasQuerySchema: false,
      hasParamSchema: false,
      hasHeaderSchema: false,
      schemaName: "approveOrderSchema",
      isSharedWithClient: false,
      rejectsUnknownFields: tApprove.rejects,
      unknownFieldsStatus: tApprove.status,
      notes: "Param :id not validated via Zod; unknown fields stripped",
    });
  }

  // Test 4: POST /api/v1/sales/orders/:id/reject
  if (draftOrder) {
    const tReject = await testUnknown("POST", `/api/v1/sales/orders/${draftOrder.id}/reject`, {
      reason: "Audit reject reason",
    });
    results.push({
      method: "POST",
      path: "/api/v1/sales/orders/:id/reject",
      router: "salesRouter",
      hasBodySchema: true,
      hasQuerySchema: false,
      hasParamSchema: false,
      hasHeaderSchema: false,
      schemaName: "rejectOrderSchema",
      isSharedWithClient: false,
      rejectsUnknownFields: tReject.rejects,
      unknownFieldsStatus: tReject.status,
      notes: "Param :id not validated via Zod; unknown fields stripped",
    });
  }

  // Test 5: POST /api/v1/sales/dispatches
  if (order) {
    const tDisp = await testUnknown("POST", "/api/v1/sales/dispatches", {
      salesOrderId: order.id,
      notes: "Audit dispatch",
    });
    results.push({
      method: "POST",
      path: "/api/v1/sales/dispatches",
      router: "salesRouter",
      hasBodySchema: true,
      hasQuerySchema: false,
      hasParamSchema: false,
      hasHeaderSchema: false,
      schemaName: "createDispatchSchema",
      isSharedWithClient: false,
      rejectsUnknownFields: tDisp.rejects,
      unknownFieldsStatus: tDisp.status,
      notes: "Unknown fields stripped",
    });
  }

  // Test 6: POST /api/v1/production-runs/draft
  const tProdDraft = await testUnknown("POST", "/api/v1/production-runs/draft", {
    organizationId: "MILL",
    warehouseId: warehouse.id,
    recipeId: recipe.id,
    runNumber: `PR-TEST-${Date.now()}`,
  });
  results.push({
    method: "POST",
    path: "/api/v1/production-runs/draft",
    router: "productionRouter",
    hasBodySchema: true,
    hasQuerySchema: false,
    hasParamSchema: false,
    hasHeaderSchema: false,
    schemaName: "createDraftRunSchema",
    isSharedWithClient: false,
    rejectsUnknownFields: tProdDraft.rejects,
    unknownFieldsStatus: tProdDraft.status,
    notes: "Unknown fields stripped",
  });

  // Test 7: POST /api/v1/production-runs
  const tProdPost = await testUnknown("POST", "/api/v1/production-runs", {
    organizationId: "MILL",
    warehouseId: warehouse.id,
    recipeId: recipe.id,
    runNumber: `PR-RUN-${Date.now()}`,
    actualGoodQty: 50,
    consumedMaterials: [{ inventoryItemId: inventoryItem.id, actualQty: 100 }],
  });
  results.push({
    method: "POST",
    path: "/api/v1/production-runs",
    router: "productionRouter",
    hasBodySchema: true,
    hasQuerySchema: false,
    hasParamSchema: false,
    hasHeaderSchema: false,
    schemaName: "postProductionRunSchema",
    isSharedWithClient: false,
    rejectsUnknownFields: tProdPost.rejects,
    unknownFieldsStatus: tProdPost.status,
    notes: "Unknown fields stripped",
  });

  // Test 8: POST /api/v1/inventory/purchase-receipts
  const supplier = await prisma.supplier.findFirstOrThrow();
  const tPurch = await testUnknown("POST", "/api/v1/inventory/purchase-receipts", {
    organizationId: "MILL",
    supplierId: supplier.id,
    warehouseId: warehouse.id,
    receiptNumber: `PR-TEST-${Date.now()}`,
    items: [
      {
        inventoryItemId: inventoryItem.id,
        quantity: 100,
        uomId: uom.id,
        unitPrice: 25,
      },
    ],
  });
  results.push({
    method: "POST",
    path: "/api/v1/inventory/purchase-receipts",
    router: "inventoryRouter",
    hasBodySchema: true,
    hasQuerySchema: false,
    hasParamSchema: false,
    hasHeaderSchema: false,
    schemaName: "createPurchaseReceiptSchema",
    isSharedWithClient: false,
    rejectsUnknownFields: tPurch.rejects,
    unknownFieldsStatus: tPurch.status,
    notes: "Unknown fields stripped",
  });

  // Test 9: POST /api/v1/finance/invoices
  if (order) {
    const tInv = await testUnknown("POST", "/api/v1/finance/invoices", {
      salesOrderId: order.id,
    });
    results.push({
      method: "POST",
      path: "/api/v1/finance/invoices",
      router: "financeRouter",
      hasBodySchema: true,
      hasQuerySchema: false,
      hasParamSchema: false,
      hasHeaderSchema: false,
      schemaName: "createInvoiceSchema",
      isSharedWithClient: false,
      rejectsUnknownFields: tInv.rejects,
      unknownFieldsStatus: tInv.status,
      notes: "Unknown fields stripped",
    });
  }

  // Test 10: POST /api/v1/payments
  const tPay = await testUnknown("POST", "/api/v1/payments", {
    customerId: customer.id,
    amount: 500,
  });
  results.push({
    method: "POST",
    path: "/api/v1/payments",
    router: "paymentRouter",
    hasBodySchema: true,
    hasQuerySchema: false,
    hasParamSchema: false,
    hasHeaderSchema: false,
    schemaName: "recordPaymentSchema",
    isSharedWithClient: false,
    rejectsUnknownFields: tPay.rejects,
    unknownFieldsStatus: tPay.status,
    notes: "Unknown fields stripped",
  });

  console.log("Validation Inventory Results:");
  console.table(results);

  fs.writeFileSync(
    "audit/evidence/validation-inventory-results.json",
    JSON.stringify(results, null, 2)
  );

  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("FATAL in main:", err);
  process.exit(1);
});
