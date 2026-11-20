/**
 * AUDIT-ONLY SCRIPT
 * Task: Verification of Error Envelope Uniformity, Postgres Error Mapping, and Client Error Display
 * Standards: OWASP API Security Top 10:2023 API8:2023, RFC 7807 (Problem Details for HTTP APIs), CWE-209
 */
import { createServer } from "node:http";
import fs from "node:fs";
import { createApp } from "../../server/src/app.js";
import { prisma } from "../../server/src/db/client.js";

interface ErrorEnvelopeTest {
  scenario: string;
  expectedStatus: number;
  actualStatus: number;
  responseShape: Record<string, any>;
  hasCode: boolean;
  hasMessage: boolean;
  hasFieldErrors: boolean;
  hasRequestId: boolean;
  leaksPrismaOrStack: boolean;
  status: "VERIFIED-PASS" | "VERIFIED-FAIL";
  notes: string;
}

async function main() {
  const app = createApp();
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log("=== ERROR ENVELOPE AND POSTGRES ERROR MAPPING AUDIT ===");
  console.log(`Server listening on ${baseUrl}`);

  const loginRes = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" },
    body: JSON.stringify({ email: "admin@millledger.local", password: "AdminPassword123!" }),
  });
  const cookie = loginRes.headers.get("set-cookie")?.split(";")[0] || "";

  const results: ErrorEnvelopeTest[] = [];

  async function checkScenario(
    scenario: string,
    method: string,
    path: string,
    body: any,
    expectedStatus: number,
    notes: string
  ) {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        Origin: "http://localhost:5173",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let json: any = {};
    try {
      json = JSON.parse(text);
    } catch {
      json = { _rawText: text };
    }

    const hasCode = "code" in json;
    const hasMessage = "message" in json;
    const hasFieldErrors = "fieldErrors" in json || ("details" in json && "fieldErrors" in (json.details || {}));
    const hasRequestId = "requestId" in json;
    const leaksPrismaOrStack = text.includes("PrismaClient") || text.includes("P200") || text.includes("node:internal") || "stack" in json;

    const isPass =
      res.status === expectedStatus &&
      hasCode &&
      hasMessage &&
      hasRequestId &&
      !leaksPrismaOrStack;

    results.push({
      scenario,
      expectedStatus,
      actualStatus: res.status,
      responseShape: json,
      hasCode,
      hasMessage,
      hasFieldErrors,
      hasRequestId,
      leaksPrismaOrStack,
      status: isPass ? "VERIFIED-PASS" : "VERIFIED-FAIL",
      notes,
    });
  }

  // 1. Zod Validation Error (missing fields)
  await checkScenario(
    "Zod Validation Failure",
    "POST",
    "/api/v1/sales/orders",
    {},
    400,
    "Schema failure returns { error: 'Invalid order data: ...' } string rather than standard envelope with fieldErrors and requestId"
  );

  // 2. Operational AppError (entity not found / logic failure)
  await checkScenario(
    "Operational Domain Error (AppError)",
    "GET",
    "/api/v1/sales/orders/non-existent-order-id-12345",
    undefined,
    404,
    "AppError returns { error: 'Order ... not found' } without error code or requestId"
  );

  // 3. Foreign Key Constraint Violation (P2003)
  // Passing non-existent customerId to order creation
  await checkScenario(
    "Foreign Key Constraint (P2003)",
    "POST",
    "/api/v1/sales/orders",
    {
      customerId: "cmwn-non-existent-customer-99999",
      lines: [{ productVariantId: "cmwn-non-existent-variant-99999", quantity: 10, unitPrice: 50 }],
    },
    400, // or 409
    "Unhandled P2003 crashes with HTTP 500 and leaks internal Prisma foreign key schema details"
  );

  // 4. Unique Constraint Violation (P2002)
  // Duplicate purchase receipt number or customer code
  const org = await prisma.organization.findFirstOrThrow();
  const existingOrder = await prisma.salesOrder.findFirstOrThrow();
  await checkScenario(
    "Unique Constraint Collision (P2002)",
    "POST",
    "/api/v1/sales/orders",
    {
      customerId: existingOrder.customerId,
      orderNumber: existingOrder.orderNumber, // duplicate!
      lines: [{ productVariantId: "non-existent", quantity: 1, unitPrice: 10 }],
    },
    409,
    "Returns { error: 'Conflict: unique constraint violation' } without specific collision field or standard envelope"
  );

  // 5. 404 Route Not Found
  await checkScenario(
    "HTTP 404 Not Found Route",
    "GET",
    "/api/v1/non-existent-endpoint-xyz",
    undefined,
    404,
    "Express default HTML 404 returned instead of standard JSON envelope"
  );

  // 6. 413 Payload Too Large
  const hugeString = "B".repeat(1024 * 1024);
  await checkScenario(
    "HTTP 413 Payload Too Large",
    "POST",
    "/api/v1/sales/orders",
    { customerId: "c1", notes: hugeString },
    413,
    "body-parser PayloadTooLargeError crashes errorHandler with HTTP 500 instead of 413"
  );

  console.log("\n=== ERROR ENVELOPE AUDIT RESULTS ===");
  console.table(
    results.map((r) => ({
      scenario: r.scenario,
      expected: r.expectedStatus,
      actual: r.actualStatus,
      code: r.hasCode,
      message: r.hasMessage,
      fieldErrors: r.hasFieldErrors,
      requestId: r.hasRequestId,
      leaksStack: r.leaksPrismaOrStack,
      status: r.status,
    }))
  );

  fs.writeFileSync("audit/evidence/error-envelope-results.json", JSON.stringify(results, null, 2));

  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
