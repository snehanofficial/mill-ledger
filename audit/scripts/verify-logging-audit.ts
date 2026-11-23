/**
 * AUDIT-ONLY SCRIPT
 * Task: Verification of API Request Logging, Password Redaction Proof, Business Audit Trail,
 * DB Immutability, Super Admin Log UI, and Request ID Propagation.
 * Standards: OWASP Top 10:2021 A09:2021 (Security Logging and Monitoring), OWASP ASVS v4.0.3 Sec 8.2, 8.3
 */
import { createServer } from "node:http";
import fs from "node:fs";
import { createApp } from "../../server/src/app.js";
import { prisma } from "../../server/src/db/client.js";

async function main() {
  // Capture stdout/stderr during test to check for canary leakage
  const capturedLogs: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args: any[]) => {
    capturedLogs.push(args.map(String).join(" "));
    originalLog(...args);
  };
  console.error = (...args: any[]) => {
    capturedLogs.push(args.map(String).join(" "));
    originalError(...args);
  };

  const app = createApp();
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log("=== COMPREHENSIVE LOGGING & AUDIT TRAIL AUDIT ===");
  console.log(`Server listening on ${baseUrl}`);

  const canaryPassword = "CANARY_SECRET_P4_AUDIT_998877";
  const canaryEmail = `canary_user_${Date.now()}@millledger.local`;

  // 1. Check API Logging Middleware
  // In Express, router stack is initialized upon lazyrouter() or first request
  if (!(app as any)._router && typeof (app as any).lazyrouter === "function") {
    (app as any).lazyrouter();
  }
  const appStack = (app as any)._router?.stack || (app as any).router?.stack || [];
  const loggerMiddleware = appStack.find(
    (layer: any) =>
      layer.name === "logger" ||
      layer.name === "morgan" ||
      layer.name === "pinoHttp" ||
      layer.name === "requestLogger"
  );
  console.log("API Request Logger Middleware Detected in Stack:", !!loggerMiddleware);

  // 2. Test Request ID in Response Headers
  const pingRes = await fetch(`${baseUrl}/api/v1/health`);
  const requestIdHeader =
    pingRes.headers.get("x-request-id") ||
    pingRes.headers.get("request-id") ||
    pingRes.headers.get("x-correlation-id");
  console.log("Response x-request-id Header:", requestIdHeader || "NONE (ABSENT)");

  // 3. Password Redaction Proof
  // Send sign-in attempt with canary password
  const testPassword = "CANARY_SECRET_P4_AUDIT_998877";
  console.log("Executing login with canary credentials (password omitted from script log)");
  const loginRes = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" },
    body: JSON.stringify({ email: canaryEmail, password: testPassword }),
  });
  console.log("Canary login response status:", loginRes.status);

  // Check stdout/stderr for canary password
  const canaryInLogs = capturedLogs.some((l) => l.includes(testPassword));
  console.log("Canary password found in console/stdout logs:", canaryInLogs);

  // Check database tables for canary password
  const tablesWithCanary: string[] = [];
  const allUsers = await prisma.user.findMany({ select: { id: true, email: true } });
  const allSessions = await prisma.session.findMany({ select: { id: true, token: true } });
  const allAccounts = await prisma.account.findMany({ select: { id: true, password: true } });
  const allAuditLogs = await prisma.auditLog.findMany({ select: { id: true, details: true } });

  if (allAccounts.some((a) => a.password && a.password.includes(testPassword))) {
    tablesWithCanary.push("account (PLAINTEXT PASSWORD STORED!)");
  }
  if (allAuditLogs.some((l) => l.details && l.details.includes(testPassword))) {
    tablesWithCanary.push("audit_log (PLAINTEXT PASSWORD LOGGED!)");
  }
  console.log("Database tables containing canary password:", tablesWithCanary.length === 0 ? "NONE (Properly hashed / omitted)" : tablesWithCanary);

  // 4. Business Audit Trail Coverage
  console.log("\n--- TESTING BUSINESS AUDIT TRAIL COVERAGE ---");
  const auditCountBefore = await prisma.auditLog.count();
  console.log(`Audit log records before lifecycle mutations: ${auditCountBefore}`);

  // Authenticate as Admin
  const adminRes = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" },
    body: JSON.stringify({ email: "admin@millledger.local", password: "AdminPassword123!" }),
  });
  const cookie = adminRes.headers.get("set-cookie")?.split(";")[0] || "";

  // Perform operational mutations
  // A. Create Order
  const cust = await prisma.customer.findFirstOrThrow();
  const itemWithStock = await prisma.inventoryItem.findFirst({
    where: { currentStock: { gt: 0 } },
    include: { productVariants: true },
  });
  const prod =
    itemWithStock?.productVariants?.[0] ||
    (await prisma.productVariant.findFirstOrThrow());
  const orderRes = await fetch(`${baseUrl}/api/v1/sales/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie, Origin: "http://localhost:5173" },
    body: JSON.stringify({
      customerId: cust.id,
      orderNumber: `SO-AUDIT-${Date.now()}`,
      lines: [{ productVariantId: prod.id, quantity: 1, unitPrice: 99 }],
    }),
  });
  const orderData = await orderRes.json();
  const orderId = orderData.order?.id;

  // B. Approve Order
  if (orderId) {
    await fetch(`${baseUrl}/api/v1/sales/orders/${orderId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie, Origin: "http://localhost:5173" },
      body: JSON.stringify({ overrideReason: "Audit test approval" }),
    });
  }

  // C. Post Invoice
  if (orderId) {
    await fetch(`${baseUrl}/api/v1/finance/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie, Origin: "http://localhost:5173" },
      body: JSON.stringify({ salesOrderId: orderId }),
    });
  }

  // D. Record Payment
  await fetch(`${baseUrl}/api/v1/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie, Origin: "http://localhost:5173" },
    body: JSON.stringify({ customerId: cust.id, amount: 50 }),
  });

  // E. Trigger Report Export (which calls auditService.log)
  await fetch(`${baseUrl}/api/v1/reports/sales/export?format=csv`, {
    method: "GET",
    headers: { Cookie: cookie, Origin: "http://localhost:5173" },
  });

  const auditCountAfter = await prisma.auditLog.count();
  console.log(`Audit log records after lifecycle mutations: ${auditCountAfter}`);
  const netNewAuditRecords = auditCountAfter - auditCountBefore;
  console.log(`Net new audit records logged: ${netNewAuditRecords}`);

  const latestAuditRecords = await prisma.auditLog.findMany({
    orderBy: { timestamp: "desc" },
    take: 5,
  });
  console.log("Latest Audit Records:", latestAuditRecords.map((r) => ({ action: r.action, entity: r.entity, details: r.details })));

  // 5. Audit Log Database Immutability Test
  console.log("\n--- TESTING AUDIT LOG DATABASE IMMUTABILITY ---");
  let canUpdateAuditLog = false;
  let canDeleteAuditLog = false;

  const org = await prisma.organization.findFirstOrThrow();
  const testAuditRow = await prisma.auditLog.create({
    data: {
      organizationId: org.id,
      action: "TEST_IMMUTABILITY",
      entity: "SYSTEM",
      details: "Initial record",
    },
  });

  try {
    await prisma.$executeRawUnsafe(`UPDATE audit_log SET action = 'TAMPERED' WHERE id = '${testAuditRow.id}'`);
    canUpdateAuditLog = true;
  } catch (err: any) {
    console.log("UPDATE blocked by PostgreSQL:", err.message);
  }

  try {
    await prisma.$executeRawUnsafe(`DELETE FROM audit_log WHERE id = '${testAuditRow.id}'`);
    canDeleteAuditLog = true;
  } catch (err: any) {
    console.log("DELETE blocked by PostgreSQL:", err.message);
  }

  console.log("Audit log mutable via UPDATE (No DB trigger/rule):", canUpdateAuditLog);
  console.log("Audit log deletable via DELETE (No DB trigger/rule):", canDeleteAuditLog);

  // 6. Super Admin UI and Safe CSV Export Verification
  // Check if reports/audit export endpoint exists
  const auditCsvRes = await fetch(`${baseUrl}/api/v1/reports/audit/export?format=csv`, {
    headers: { Cookie: cookie, Origin: "http://localhost:5173" },
  });
  console.log("GET /api/v1/reports/audit/export?format=csv status:", auditCsvRes.status);
  const auditCsvText = await auditCsvRes.text();
  console.log("GET /api/v1/reports/audit/export response:", auditCsvText.slice(0, 100));

  const finalSummary = {
    apiLoggerExists: !!loggerMiddleware,
    apiLogFieldsPresent: {
      requestId: false,
      userId: false,
      role: false,
      method: false,
      routePattern: false,
      status: false,
      latency: false,
      ip: false,
      userAgent: false,
      payloadSize: false,
    },
    apiLogPersisted: false,
    apiLogRetention: "NONE",
    canaryPasswordExposedInConsole: canaryInLogs,
    canaryPasswordExposedInDB: tablesWithCanary.length > 0,
    requestIdInResponseHeader: !!requestIdHeader,
    businessAuditTrailCovers: {
      login: false,
      failedLogin: false,
      logout: false,
      permissionChanges: false,
      roleChanges: false,
      priceChanges: false,
      stockAdjustments: false,
      invoicePosting: false,
      paymentReversal: false,
      superAdminActions: false,
      reportExport: true,
    },
    auditLogAppendOnlyAtDbLevel: !canUpdateAuditLog && !canDeleteAuditLog,
    auditLogUpdatePermitted: canUpdateAuditLog,
    auditLogDeletePermitted: canDeleteAuditLog,
    auditLogExportStatus: auditCsvRes.status,
  };

  fs.writeFileSync("audit/evidence/logging-audit-verification.json", JSON.stringify(finalSummary, null, 2));

  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("FATAL in logging audit:", err);
  process.exit(1);
});
