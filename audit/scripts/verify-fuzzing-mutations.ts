/**
 * AUDIT-ONLY SCRIPT
 * Task: Systematic Input Fuzzing of all Mutating Endpoints
 * Vectors: Missing fields, wrong types, nulls, empty strings, 1MB string, negative/zero quantities,
 * excess decimals, NaN, Infinity, exponent notation, past/future dates, unicode/RTL, SQL metachars, HTML.
 * Standards: OWASP API Security Top 10:2023 API3:2023, API8:2023, CWE-20, CWE-209 (Information Exposure Through an Error Message)
 */
import { createServer } from "node:http";
import fs from "node:fs";
import { createApp } from "../../server/src/app.js";
import { prisma } from "../../server/src/db/client.js";

interface FuzzResult {
  endpoint: string;
  method: string;
  vector: string;
  statusCode: number;
  is500: boolean;
  leaksStackTrace: boolean;
  leaksPrismaError: boolean;
  acceptedAsSuccess: boolean;
  verdict: "VERIFIED-PASS" | "VERIFIED-FAIL";
  failureReason?: string;
  responsePreview: string;
}

async function main() {
  const app = createApp();
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log("=== COMPREHENSIVE MUTATING ENDPOINT FUZZING AUDIT ===");
  console.log(`Server listening on ${baseUrl}`);

  // Authenticate as Admin
  const loginRes = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" },
    body: JSON.stringify({ email: "admin@millledger.local", password: "AdminPassword123!" }),
  });
  if (!loginRes.ok) throw new Error("Admin login failed");
  const cookie = loginRes.headers.get("set-cookie")?.split(";")[0] || "";

  // Collect legitimate prerequisites
  const org = await prisma.organization.findFirstOrThrow();
  const orgId = org.id;
  const customer = await prisma.customer.findFirstOrThrow();
  const productVariant = await prisma.productVariant.findFirstOrThrow();
  const warehouse = await prisma.warehouse.findFirstOrThrow();
  const supplier = await prisma.supplier.findFirstOrThrow();
  const inventoryItem = await prisma.inventoryItem.findFirstOrThrow();
  const uom = await prisma.unitOfMeasure.findFirstOrThrow();
  const recipe = await prisma.recipe.findFirstOrThrow();

  // Ensure an approved order, draft order, and posted run exist
  let draftOrder = await prisma.salesOrder.findFirst({ where: { status: "DRAFT" } });
  if (!draftOrder) {
    draftOrder = await prisma.salesOrder.create({
      data: {
        organizationId: orgId,
        customerId: customer.id,
        orderNumber: `SO-FUZZ-DRAFT-${Date.now()}`,
        status: "DRAFT",
        taxableAmount: 100,
        taxAmount: 5,
        totalAmount: 105,
        lines: {
          create: [{ productVariantId: productVariant.id, quantity: 2, unitPrice: 50, taxableAmount: 100, taxAmount: 5, totalAmount: 105 }]
        }
      }
    });
  }

  let approvedOrder = await prisma.salesOrder.findFirst({ where: { status: "APPROVED" } });
  if (!approvedOrder) {
    approvedOrder = await prisma.salesOrder.create({
      data: {
        organizationId: orgId,
        customerId: customer.id,
        orderNumber: `SO-FUZZ-APP-${Date.now()}`,
        status: "APPROVED",
        taxableAmount: 100,
        taxAmount: 5,
        totalAmount: 105,
        lines: {
          create: [{ productVariantId: productVariant.id, quantity: 2, unitPrice: 50, taxableAmount: 100, taxAmount: 5, totalAmount: 105 }]
        }
      }
    });
  }

  let postedRun = await prisma.productionRun.findFirst({ where: { status: "POSTED" } });
  let draftRun = await prisma.productionRun.findFirst({ where: { status: "DRAFT" } });
  if (!draftRun) {
    draftRun = await prisma.productionRun.create({
      data: {
        organizationId: orgId,
        warehouseId: warehouse.id,
        recipeId: recipe.id,
        runNumber: `PR-FUZZ-DRAFT-${Date.now()}`,
        status: "DRAFT",
        recipeVersion: 1,
        expectedOutputQty: 100,
      }
    });
  }

  let invoice = await prisma.salesInvoice.findFirst();

  const results: FuzzResult[] = [];

  // Helper to execute fuzz request
  async function executeFuzz(
    endpoint: string,
    method: string,
    vector: string,
    body: any,
    expectedBehavior: "EXPECT_400" | "EXPECT_413" | "EXPECT_REJECTION" = "EXPECT_400"
  ) {
    try {
      const isString = typeof body === "string";
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Cookie: cookie,
          Origin: "http://localhost:5173",
        },
        body: isString ? body : JSON.stringify(body),
      });

      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {}

      const statusCode = res.status;
      const is500 = statusCode >= 500;
      const leaksStackTrace = text.includes("stack") || text.includes("    at ") || text.includes("node:internal");
      const leaksPrismaError = text.includes("PrismaClient") || text.includes("P200") || text.includes("driverAdapterError");
      const acceptedAsSuccess = statusCode >= 200 && statusCode < 300;

      let verdict: "VERIFIED-PASS" | "VERIFIED-FAIL" = "VERIFIED-PASS";
      let failureReason: string | undefined;

      if (is500) {
        verdict = "VERIFIED-FAIL";
        failureReason = `Server crashed with HTTP ${statusCode} Internal Server Error`;
      } else if (leaksStackTrace) {
        verdict = "VERIFIED-FAIL";
        failureReason = "Response leaked stack trace";
      } else if (leaksPrismaError) {
        verdict = "VERIFIED-FAIL";
        failureReason = "Response leaked raw Prisma/database error details";
      } else if (expectedBehavior === "EXPECT_400" && acceptedAsSuccess) {
        verdict = "VERIFIED-FAIL";
        failureReason = `Invalid fuzz input was accepted with HTTP ${statusCode} instead of being rejected with 400`;
      } else if (expectedBehavior === "EXPECT_413" && statusCode !== 413) {
        verdict = "VERIFIED-FAIL";
        failureReason = `Large payload returned HTTP ${statusCode} instead of HTTP 413 Payload Too Large`;
      }

      results.push({
        endpoint,
        method,
        vector,
        statusCode,
        is500,
        leaksStackTrace,
        leaksPrismaError,
        acceptedAsSuccess,
        verdict,
        failureReason,
        responsePreview: text.slice(0, 160).replace(/\n/g, " "),
      });
    } catch (err: any) {
      results.push({
        endpoint,
        method,
        vector,
        statusCode: 0,
        is500: true,
        leaksStackTrace: false,
        leaksPrismaError: false,
        acceptedAsSuccess: false,
        verdict: "VERIFIED-FAIL",
        failureReason: `Network/connection error during test: ${err.message}`,
        responsePreview: String(err),
      });
    }
  }

  // 1 MB String Generator
  const huge1MB = "A".repeat(1024 * 1024);

  // Define Endpoints and baseline templates
  console.log("Fuzzing Endpoint 1: POST /api/v1/sales/orders");
  const baseOrder = {
    organizationId: orgId,
    customerId: customer.id,
    lines: [{ productVariantId: productVariant.id, quantity: 10, unitPrice: 50 }],
  };

  await executeFuzz("/api/v1/sales/orders", "POST", "MISSING_FIELDS", {});
  await executeFuzz("/api/v1/sales/orders", "POST", "WRONG_TYPES_LINES_STRING", { ...baseOrder, lines: "not-an-array" });
  await executeFuzz("/api/v1/sales/orders", "POST", "WRONG_TYPES_QTY_STRING", { ...baseOrder, lines: [{ productVariantId: productVariant.id, quantity: "TEN" }] });
  await executeFuzz("/api/v1/sales/orders", "POST", "NULLS_REQUIRED_CUSTOMER", { ...baseOrder, customerId: null });
  await executeFuzz("/api/v1/sales/orders", "POST", "EMPTY_STRING_CUSTOMER", { ...baseOrder, customerId: "" });
  await executeFuzz("/api/v1/sales/orders", "POST", "NEGATIVE_QUANTITY", { ...baseOrder, lines: [{ productVariantId: productVariant.id, quantity: -5 }] });
  await executeFuzz("/api/v1/sales/orders", "POST", "ZERO_QUANTITY", { ...baseOrder, lines: [{ productVariantId: productVariant.id, quantity: 0 }] });
  await executeFuzz("/api/v1/sales/orders", "POST", "EXCESS_DECIMALS_BAG", { ...baseOrder, lines: [{ productVariantId: productVariant.id, quantity: 10.123456789 }] });
  await executeFuzz("/api/v1/sales/orders", "POST", "EXPONENT_OVERFLOW_QTY", { ...baseOrder, lines: [{ productVariantId: productVariant.id, quantity: 1e308 }] });
  await executeFuzz("/api/v1/sales/orders", "POST", "UNICODE_RTL_NOTES", { ...baseOrder, notes: "\u202E\u0627\u0644\u0639\u0631\u0628\u064A\u0629 \uD83D\uDCA9" });
  await executeFuzz("/api/v1/sales/orders", "POST", "SQL_META_CUSTOMER", { ...baseOrder, customerId: "' OR '1'='1" });
  await executeFuzz("/api/v1/sales/orders", "POST", "HTML_XSS_NOTES", { ...baseOrder, notes: "<script>alert(1)</script>" });
  await executeFuzz("/api/v1/sales/orders", "POST", "HUGE_STRING_1MB", { ...baseOrder, notes: huge1MB }, "EXPECT_413");

  console.log("Fuzzing Endpoint 2: PUT /api/v1/sales/orders/:id");
  const putPath = `/api/v1/sales/orders/${draftOrder.id}`;
  await executeFuzz(putPath, "PUT", "MISSING_FIELDS", {});
  await executeFuzz(putPath, "PUT", "WRONG_TYPE_STATUS_NUMBER", { status: 12345 });
  await executeFuzz(putPath, "PUT", "INVALID_STATUS_ENUM", { status: "NON_EXISTENT_ENUM_VALUE" });
  await executeFuzz(putPath, "PUT", "NULLS_STATUS", { status: null });
  await executeFuzz(putPath, "PUT", "SQL_META_NOTES", { notes: "'; DROP TABLE sales_order; --" });
  await executeFuzz(putPath, "PUT", "HTML_XSS_NOTES", { notes: "<img src=x onerror=alert('xss')>" });
  await executeFuzz(putPath, "PUT", "HUGE_STRING_1MB", { notes: huge1MB }, "EXPECT_413");

  console.log("Fuzzing Endpoint 3: POST /api/v1/sales/orders/:id/approve");
  const appPath = `/api/v1/sales/orders/${draftOrder.id}/approve`;
  await executeFuzz(appPath, "POST", "WRONG_TYPES_OVERRIDES", { lineOverrides: "not-an-array" });
  await executeFuzz(appPath, "POST", "NEGATIVE_APPROVED_QTY", { lineOverrides: [{ lineId: "fake-line", approvedQuantity: -10 }] });
  await executeFuzz(appPath, "POST", "ZERO_APPROVED_QTY", { lineOverrides: [{ lineId: "fake-line", approvedQuantity: 0 }] });
  await executeFuzz(appPath, "POST", "NULL_LINE_ID", { lineOverrides: [{ lineId: null, approvedQuantity: 5 }] });
  await executeFuzz(appPath, "POST", "HUGE_STRING_1MB", { overrideReason: huge1MB }, "EXPECT_413");

  console.log("Fuzzing Endpoint 4: POST /api/v1/sales/orders/:id/reject");
  const rejpPath = `/api/v1/sales/orders/${draftOrder.id}/reject`;
  await executeFuzz(rejpPath, "POST", "MISSING_REASON", {});
  await executeFuzz(rejpPath, "POST", "EMPTY_REASON", { reason: "" });
  await executeFuzz(rejpPath, "POST", "WRONG_TYPE_REASON_NUM", { reason: 99999 });
  await executeFuzz(rejpPath, "POST", "NULL_REASON", { reason: null });
  await executeFuzz(rejpPath, "POST", "SQL_META_REASON", { reason: "' OR 1=1; --" });
  await executeFuzz(rejpPath, "POST", "HTML_XSS_REASON", { reason: "<script>alert('reject')</script>" });
  await executeFuzz(rejpPath, "POST", "HUGE_STRING_1MB", { reason: huge1MB }, "EXPECT_413");

  console.log("Fuzzing Endpoint 5: POST /api/v1/sales/dispatches");
  const baseDisp = { salesOrderId: approvedOrder.id };
  await executeFuzz("/api/v1/sales/dispatches", "POST", "MISSING_SALES_ORDER_ID", {});
  await executeFuzz("/api/v1/sales/dispatches", "POST", "EMPTY_SALES_ORDER_ID", { salesOrderId: "" });
  await executeFuzz("/api/v1/sales/dispatches", "POST", "WRONG_TYPE_ORDER_ID", { salesOrderId: 12345 });
  await executeFuzz("/api/v1/sales/dispatches", "POST", "NEGATIVE_DISPATCH_QTY", { ...baseDisp, lines: [{ salesOrderLineId: "line1", quantity: -5 }] });
  await executeFuzz("/api/v1/sales/dispatches", "POST", "ZERO_DISPATCH_QTY", { ...baseDisp, lines: [{ salesOrderLineId: "line1", quantity: 0 }] });
  await executeFuzz("/api/v1/sales/dispatches", "POST", "SQL_META_VEHICLE", { ...baseDisp, vehicleNumber: "TN 01 ' OR '1'='1" });
  await executeFuzz("/api/v1/sales/dispatches", "POST", "HTML_XSS_DRIVER", { ...baseDisp, driverName: "<script>alert(1)</script>" });
  await executeFuzz("/api/v1/sales/dispatches", "POST", "HUGE_STRING_1MB", { ...baseDisp, notes: huge1MB }, "EXPECT_413");

  console.log("Fuzzing Endpoint 6: POST /api/v1/production-runs/draft");
  const baseDraftRun = {
    organizationId: orgId,
    warehouseId: warehouse.id,
    recipeId: recipe.id,
    runNumber: `PR-FUZZ-${Date.now()}`,
  };
  await executeFuzz("/api/v1/production-runs/draft", "POST", "MISSING_FIELDS", {});
  await executeFuzz("/api/v1/production-runs/draft", "POST", "EMPTY_ORGANIZATION_ID", { ...baseDraftRun, organizationId: "" });
  await executeFuzz("/api/v1/production-runs/draft", "POST", "WRONG_TYPE_BATCH_COUNT", { ...baseDraftRun, batchCount: "five" });
  await executeFuzz("/api/v1/production-runs/draft", "POST", "NEGATIVE_BATCH_COUNT", { ...baseDraftRun, batchCount: -1 });
  await executeFuzz("/api/v1/production-runs/draft", "POST", "ZERO_BATCH_COUNT", { ...baseDraftRun, batchCount: 0 });
  await executeFuzz("/api/v1/production-runs/draft", "POST", "HUGE_STRING_1MB", { ...baseDraftRun, notes: huge1MB }, "EXPECT_413");

  console.log("Fuzzing Endpoint 7: POST /api/v1/production-runs");
  const basePostRun = {
    organizationId: orgId,
    warehouseId: warehouse.id,
    recipeId: recipe.id,
    runNumber: `PR-RUN-FUZZ-${Date.now()}`,
    actualGoodQty: 50,
    consumedMaterials: [{ inventoryItemId: inventoryItem.id, actualQty: 100 }],
  };
  await executeFuzz("/api/v1/production-runs", "POST", "MISSING_CONSUMED_MATERIALS", { ...basePostRun, consumedMaterials: [] });
  await executeFuzz("/api/v1/production-runs", "POST", "NEGATIVE_ACTUAL_GOOD_QTY", { ...basePostRun, actualGoodQty: -10 });
  await executeFuzz("/api/v1/production-runs", "POST", "ZERO_ACTUAL_GOOD_QTY", { ...basePostRun, actualGoodQty: 0 });
  await executeFuzz("/api/v1/production-runs", "POST", "NEGATIVE_CONSUMED_QTY", { ...basePostRun, consumedMaterials: [{ inventoryItemId: inventoryItem.id, actualQty: -50 }] });
  await executeFuzz("/api/v1/production-runs", "POST", "WRONG_TYPE_LABOR_COST", { ...basePostRun, directLaborCost: "free" });
  await executeFuzz("/api/v1/production-runs", "POST", "HUGE_STRING_1MB", { ...basePostRun, notes: huge1MB }, "EXPECT_413");

  console.log("Fuzzing Endpoint 8: POST /api/v1/production-runs/:id/post");
  const postDraftPath = `/api/v1/production-runs/${draftRun.id}/post`;
  await executeFuzz(postDraftPath, "POST", "MISSING_FIELDS", {});
  await executeFuzz(postDraftPath, "POST", "NEGATIVE_GOOD_QTY", { ...basePostRun, actualGoodQty: -20 });
  await executeFuzz(postDraftPath, "POST", "HUGE_STRING_1MB", { ...basePostRun, notes: huge1MB }, "EXPECT_413");

  console.log("Fuzzing Endpoint 9: POST /api/v1/production-runs/:id/reverse");
  const revPath = postedRun ? `/api/v1/production-runs/${postedRun.id}/reverse` : `/api/v1/production-runs/fake-id/reverse`;
  await executeFuzz(revPath, "POST", "MISSING_REASON", {});
  await executeFuzz(revPath, "POST", "EMPTY_REASON", { reason: "" });
  await executeFuzz(revPath, "POST", "NULL_REASON", { reason: null });
  await executeFuzz(revPath, "POST", "SQL_META_REASON", { reason: "reversal'; DROP TABLE production_run; --" });
  await executeFuzz(revPath, "POST", "HTML_XSS_REASON", { reason: "<script>alert('reversed')</script>" });
  await executeFuzz(revPath, "POST", "HUGE_STRING_1MB", { reason: huge1MB }, "EXPECT_413");

  console.log("Fuzzing Endpoint 10: POST /api/v1/inventory/purchase-receipts");
  const baseReceipt = {
    organizationId: orgId,
    supplierId: supplier.id,
    warehouseId: warehouse.id,
    receiptNumber: `PR-FUZZ-${Date.now()}`,
    items: [{ inventoryItemId: inventoryItem.id, quantity: 100, uomId: uom.id, unitPrice: 20 }],
  };
  await executeFuzz("/api/v1/inventory/purchase-receipts", "POST", "MISSING_ITEMS", { ...baseReceipt, items: [] });
  await executeFuzz("/api/v1/inventory/purchase-receipts", "POST", "NEGATIVE_QUANTITY", { ...baseReceipt, items: [{ ...baseReceipt.items[0], quantity: -10 }] });
  await executeFuzz("/api/v1/inventory/purchase-receipts", "POST", "ZERO_QUANTITY", { ...baseReceipt, items: [{ ...baseReceipt.items[0], quantity: 0 }] });
  await executeFuzz("/api/v1/inventory/purchase-receipts", "POST", "NEGATIVE_UNIT_PRICE", { ...baseReceipt, items: [{ ...baseReceipt.items[0], unitPrice: -5 }] });
  await executeFuzz("/api/v1/inventory/purchase-receipts", "POST", "NULL_SUPPLIER_ID", { ...baseReceipt, supplierId: null });
  await executeFuzz("/api/v1/inventory/purchase-receipts", "POST", "HUGE_STRING_1MB", { ...baseReceipt, notes: huge1MB }, "EXPECT_413");

  console.log("Fuzzing Endpoint 11: POST /api/v1/finance/invoices");
  await executeFuzz("/api/v1/finance/invoices", "POST", "MISSING_SALES_ORDER_ID", {});
  await executeFuzz("/api/v1/finance/invoices", "POST", "EMPTY_SALES_ORDER_ID", { salesOrderId: "" });
  await executeFuzz("/api/v1/finance/invoices", "POST", "WRONG_TYPE_DUE_DATE", { salesOrderId: approvedOrder.id, dueDate: "NOT_A_DATE" });
  await executeFuzz("/api/v1/finance/invoices", "POST", "PAST_DUE_DATE", { salesOrderId: approvedOrder.id, dueDate: "1970-01-01T00:00:00.000Z" });
  await executeFuzz("/api/v1/finance/invoices", "POST", "FAR_FUTURE_DUE_DATE", { salesOrderId: approvedOrder.id, dueDate: "2999-12-31T23:59:59.000Z" });
  await executeFuzz("/api/v1/finance/invoices", "POST", "HUGE_STRING_1MB", { salesOrderId: approvedOrder.id, notes: huge1MB }, "EXPECT_413");

  console.log("Fuzzing Endpoint 12: POST /api/v1/finance/invoices/:id/credit-note");
  const cnPath = invoice ? `/api/v1/finance/invoices/${invoice.id}/credit-note` : `/api/v1/finance/invoices/fake-inv/credit-note`;
  await executeFuzz(cnPath, "POST", "MISSING_REASON", {});
  await executeFuzz(cnPath, "POST", "EMPTY_REASON", { reason: "" });
  await executeFuzz(cnPath, "POST", "NEGATIVE_TAXABLE_AMOUNT", { reason: "Return", taxableAmount: -100 });
  await executeFuzz(cnPath, "POST", "ZERO_TAXABLE_AMOUNT", { reason: "Return", taxableAmount: 0 });
  await executeFuzz(cnPath, "POST", "SQL_META_REASON", { reason: "' OR 1=1; --" });
  await executeFuzz(cnPath, "POST", "HTML_XSS_REASON", { reason: "<script>alert('credit')</script>" });
  await executeFuzz(cnPath, "POST", "HUGE_STRING_1MB", { reason: huge1MB }, "EXPECT_413");

  console.log("Fuzzing Endpoint 13: POST /api/v1/payments");
  const basePay = { customerId: customer.id, amount: 500 };
  await executeFuzz("/api/v1/payments", "POST", "MISSING_CUSTOMER_ID", { amount: 500 });
  await executeFuzz("/api/v1/payments", "POST", "MISSING_AMOUNT", { customerId: customer.id });
  await executeFuzz("/api/v1/payments", "POST", "NEGATIVE_AMOUNT", { ...basePay, amount: -500 });
  await executeFuzz("/api/v1/payments", "POST", "ZERO_AMOUNT", { ...basePay, amount: 0 });
  await executeFuzz("/api/v1/payments", "POST", "INVALID_PAYMENT_MODE", { ...basePay, paymentMode: "BITCOIN" });
  await executeFuzz("/api/v1/payments", "POST", "WRONG_TYPE_PAYMENT_DATE", { ...basePay, paymentDate: "INVALID_DATE" });
  await executeFuzz("/api/v1/payments", "POST", "PAST_PAYMENT_DATE", { ...basePay, paymentDate: "1970-01-01T00:00:00.000Z" });
  await executeFuzz("/api/v1/payments", "POST", "FAR_FUTURE_PAYMENT_DATE", { ...basePay, paymentDate: "2999-12-31T23:59:59.000Z" });
  await executeFuzz("/api/v1/payments", "POST", "NEGATIVE_ALLOCATION_AMOUNT", { ...basePay, allocations: [{ salesInvoiceId: "inv1", amount: -200 }] });
  await executeFuzz("/api/v1/payments", "POST", "HUGE_STRING_1MB", { ...basePay, notes: huge1MB }, "EXPECT_413");

  console.log("\n=== FUZZING COMPLETED ===");
  console.log(`Total tests executed: ${results.length}`);

  const passed = results.filter((r) => r.verdict === "VERIFIED-PASS");
  const failed = results.filter((r) => r.verdict === "VERIFIED-FAIL");
  const crashed500 = results.filter((r) => r.is500);
  const leakedStack = results.filter((r) => r.leaksStackTrace);
  const leakedPrisma = results.filter((r) => r.leaksPrismaError);

  console.log(`Passed: ${passed.length}`);
  console.log(`Failed: ${failed.length}`);
  console.log(`HTTP 500 Server Crashes: ${crashed500.length}`);
  console.log(`Stack Trace Leaks: ${leakedStack.length}`);
  console.log(`Raw Prisma Error Leaks: ${leakedPrisma.length}`);

  // Write evidence artifacts
  fs.writeFileSync("audit/evidence/fuzz-results.json", JSON.stringify(results, null, 2));

  // Write CSV
  const csvHeaders = "endpoint,method,vector,statusCode,is500,leaksStackTrace,leaksPrismaError,acceptedAsSuccess,verdict,failureReason,responsePreview\n";
  const csvRows = results
    .map((r) =>
      `"${r.endpoint}","${r.method}","${r.vector}",${r.statusCode},${r.is500},${r.leaksStackTrace},${r.leaksPrismaError},${r.acceptedAsSuccess},"${r.verdict}","${r.failureReason || ""}","${r.responsePreview.replace(/"/g, '""')}"`
    )
    .join("\n");
  fs.writeFileSync("audit/evidence/fuzz-results.csv", csvHeaders + csvRows);

  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
