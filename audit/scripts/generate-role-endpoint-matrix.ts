/**
 * AUDIT-ONLY SCRIPT
 * Task: Generate and run the full 81 Endpoint x 7 Role Authorization Matrix
 * Requirements: Compare Expected vs Actual status codes. Output CSV in audit/evidence/role-endpoint-matrix.csv.
 */
import fs from "node:fs";
import { createServer } from "node:http";
import { createApp } from "../../server/src/app.js";
import { prisma } from "../../server/src/db/client.js";

interface RouteDefinition {
  method: string;
  path: string;
  sourceFile: string;
}

const ROLES = [
  "ANONYMOUS",
  "NO_ROLE",
  "SALESMAN",
  "PRODUCTION",
  "ACCOUNTANT",
  "OWNER",
  "ADMIN",
] as const;

type RoleName = (typeof ROLES)[number];

async function main() {
  const app = createApp();
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log("=== EXECUTING ROLE X ENDPOINT AUTHORIZATION AUDIT MATRIX ===");
  console.log(`Server running at ${baseUrl}`);

  // 1. Ensure test users exist in database
  const org = await prisma.organization.findFirst();
  const orgId = org?.id || "MILL";

  async function ensureUser(email: string, name: string, role: string) {
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Create user via Better Auth or Prisma
      user = await prisma.user.create({
        data: {
          id: `test-user-${role.toLowerCase()}-${Date.now()}`,
          name,
          email,
          emailVerified: true,
          role,
          isActive: true,
          organizationId: orgId,
        },
      });
      // Create credential account with Better Auth hashed password
      // Better Auth stores password in 'account' table
      const adminAccount = await prisma.account.findFirst({
        where: { user: { email: "admin@millledger.local" } },
      });
      if (adminAccount) {
        await prisma.account.create({
          data: {
            id: `acc-${user.id}`,
            userId: user.id,
            accountId: user.id,
            providerId: "credential",
            password: adminAccount.password, // Reuse known hash
          },
        });
      }
    } else if (user.role !== role) {
      await prisma.user.update({
        where: { email },
        data: { role },
      });
    }
    return user;
  }

  await ensureUser("norole@millledger.local", "No Role User", "NONE");

  // 2. Log in and get session cookies
  async function login(email: string, pass: string): Promise<string> {
    const res = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:5173",
      },
      body: JSON.stringify({ email, password: pass }),
    });
    const cookie = res.headers.get("set-cookie")?.split(";")[0] || "";
    return cookie;
  }

  const roleCookies: Record<RoleName, string> = {
    ANONYMOUS: "",
    NO_ROLE: await login("norole@millledger.local", "AdminPassword123!"),
    SALESMAN: await login("salesman1@millledger.local", "SalesmanPassword123!"),
    PRODUCTION: await login("production@millledger.local", "ProductionPassword123!"),
    ACCOUNTANT: await login("accountant@millledger.local", "AccountantPassword123!"),
    OWNER: await login("owner@millledger.local", "OwnerPassword123!"),
    ADMIN: await login("admin@millledger.local", "AdminPassword123!"),
  };

  // 3. Find concrete fixture IDs
  const sm1User = await prisma.user.findUnique({ where: { email: "salesman1@millledger.local" } });
  const sm1Order = await prisma.salesOrder.findFirst({ where: { salesmanId: sm1User?.id } });
  const sampleOrder = await prisma.salesOrder.findFirst();
  const sampleCustomer = await prisma.customer.findFirst();
  const sampleInvoice = await prisma.salesInvoice.findFirst();
  const samplePayment = await prisma.payment.findFirst();
  const sampleRun = await prisma.productionRun.findFirst();
  const sampleItem = await prisma.inventoryItem.findFirst();

  const defaultOrderId = sampleOrder?.id || "cmwn_dummy_order";
  const sm1OrderId = sm1Order?.id || defaultOrderId;
  const customerId = sampleCustomer?.id || "cmwn_dummy_customer";
  const invoiceId = sampleInvoice?.id || "cmwn_dummy_invoice";
  const paymentId = samplePayment?.id || "cmwn_dummy_payment";
  const runId = sampleRun?.id || "cmwn_dummy_run";
  const itemId = sampleItem?.id || "cmwn_dummy_item";

  // 4. Load routes from routes-runtime.json
  const rawRoutes: RouteDefinition[] = JSON.parse(
    fs.readFileSync("audit/evidence/routes-runtime.json", "utf8")
  );

  console.log(`Loaded ${rawRoutes.length} route endpoints from inventory.`);

  // 5. Build EXPECTED matrix logic per RBAC model and specification
  function getExpectedStatus(method: string, path: string, role: RoleName): number {
    // Health endpoints are public
    if (path.includes("/health")) return 200;

    // Better Auth catch-all
    if (path.includes("/auth/")) {
      return 200;
    }

    // Unauthenticated access
    if (role === "ANONYMOUS") return 401;

    // /api/v1/me requires only auth
    if (path === "/api/v1/me") return 200;

    // User with no roles
    if (role === "NO_ROLE") return 403;

    // Check specific resource policies
    // Sales router
    if (path.includes("/sales/customers") || path.includes("/orders/customers") || path.includes("/dispatches/customers")) {
      // customer:read
      if (["ADMIN", "SALESMAN", "ACCOUNTANT", "OWNER"].includes(role)) return 200;
      return 403;
    }

    if (path.includes("/products")) {
      // order:read
      if (["ADMIN", "SALESMAN", "ACCOUNTANT", "OWNER"].includes(role)) return 200;
      return 403;
    }

    if (path.endsWith("/orders") || path.includes("/orders?")) {
      if (method === "GET") {
        if (["ADMIN", "SALESMAN", "ACCOUNTANT", "OWNER"].includes(role)) return 200;
        return 403;
      }
      if (method === "POST") {
        if (["ADMIN", "SALESMAN"].includes(role)) return 201;
        return 403;
      }
    }

    if (path.includes("/orders/:id/approve") || path.includes("/orders/:id/reject")) {
      // order:approve
      if (role === "ADMIN") return 200;
      return 403;
    }

    if (path.includes("/orders/:id")) {
      if (method === "GET") {
        if (["ADMIN", "SALESMAN", "ACCOUNTANT", "OWNER"].includes(role)) return 200;
        return 403;
      }
      if (method === "PUT") {
        if (["ADMIN", "SALESMAN"].includes(role)) return 200;
        return 403;
      }
    }

    if (path.includes("/dispatches")) {
      if (method === "GET") {
        if (["ADMIN", "SALESMAN", "ACCOUNTANT", "OWNER"].includes(role)) return 200;
        return 403;
      }
      if (method === "POST") {
        // order:dispatch
        if (role === "ADMIN") return 201;
        return 403;
      }
    }

    // Production router
    if (path.includes("/production") || path.includes("/production-runs")) {
      if (path.includes("/recipes")) {
        if (["ADMIN", "PRODUCTION", "OWNER"].includes(role)) return 200;
        return 403;
      }
      if (path.endsWith("/draft") || (method === "POST" && (path.endsWith("/production") || path.endsWith("/production-runs")))) {
        if (["ADMIN", "PRODUCTION"].includes(role)) return 201;
        return 403;
      }
      if (path.includes("/post") || path.includes("/reverse")) {
        if (["ADMIN", "PRODUCTION"].includes(role)) return 200;
        return 403;
      }
      if (method === "GET") {
        if (["ADMIN", "PRODUCTION", "OWNER"].includes(role)) return 200;
        return 403;
      }
    }

    // Inventory router
    if (path.includes("/purchase-receipts") || path.includes("/suppliers")) {
      if (method === "GET") {
        if (["ADMIN", "PRODUCTION", "ACCOUNTANT", "OWNER"].includes(role)) return 200;
        return 403;
      }
      if (method === "POST") {
        if (["ADMIN", "PRODUCTION"].includes(role)) return 201;
        return 403;
      }
    }

    // Finance / Invoices router
    if (path.includes("/invoices")) {
      if (method === "GET") {
        if (["ADMIN", "ACCOUNTANT", "OWNER"].includes(role)) return 200;
        return 403;
      }
      if (method === "POST") {
        if (role === "ADMIN") return 201;
        return 403;
      }
    }

    // Payment router
    if (path.includes("/payments")) {
      if (method === "GET") {
        if (["ADMIN", "ACCOUNTANT", "OWNER"].includes(role)) return 200;
        return 403;
      }
      if (method === "POST") {
        if (role === "ADMIN") return 201;
        return 403;
      }
    }

    if (path.includes("/balances") || (path.includes("/ledger") && !path.includes("/payments/"))) {
      if (["ADMIN", "SALESMAN", "PRODUCTION", "ACCOUNTANT", "OWNER"].includes(role)) return 200;
      return 403;
    }

    // Reporting router
    if (path.includes("/reports") || path.includes("/dashboard")) {
      if (path.includes("/audit") || path.includes(":report")) {
        // :report resolves to "audit" in our test
        if (["ADMIN", "ACCOUNTANT", "OWNER"].includes(role)) return 200;
        return 403;
      }
      if (["ADMIN", "ACCOUNTANT", "OWNER", "SALESMAN", "PRODUCTION"].includes(role)) return 200;
      return 403;
    }

    return 403;
  }

  // Helper to resolve URL with concrete IDs and query params
  function resolveUrl(routePath: string, role: RoleName): { urlPath: string; isTemplate: boolean } {
    let p = routePath;
    if (p.includes("/orders/:id")) {
      p = p.replace(":id", role === "SALESMAN" ? sm1OrderId : defaultOrderId);
    } else if (p.includes("/production") || p.includes("/production-runs")) {
      p = p.replace(":id", runId);
    } else if (p.includes("/invoices/:id")) {
      p = p.replace(":id", invoiceId);
    } else if (p.includes("/payments/:id")) {
      p = p.replace(":id", paymentId);
    } else if (p.includes("/items/:id")) {
      p = p.replace(":id", itemId);
    } else {
      p = p.replace(":id", defaultOrderId);
    }

    p = p.replace(":customerId", customerId);
    p = p.replace(":report", "audit");
    if (p.includes("/auth/*")) {
      p = p.replace("/*", "/get-session");
    }
    
    // Add required query parameters where needed
    if (p.includes("/production") || p.includes("/production-runs")) {
      p += (p.includes("?") ? "&" : "?") + "organizationId=MILL";
    }
    return { urlPath: p, isTemplate: routePath.includes(":") };
  }

  // 6. Execute Matrix Testing
  interface MatrixResult {
    method: string;
    routePath: string;
    resolvedPath: string;
    role: RoleName;
    expectedStatus: number;
    actualStatus: number;
    match: boolean;
    severity: string;
  }

  const results: MatrixResult[] = [];
  let violationsCount = 0;
  let p0Count = 0;

  for (const route of rawRoutes) {
    for (const role of ROLES) {
      const { urlPath } = resolveUrl(route.path, role);
      const cookie = roleCookies[role];
      const expected = getExpectedStatus(route.method, route.path, role);

      let actual = 0;
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Origin: "http://localhost:5173",
        };
        if (cookie) headers["Cookie"] = cookie;

        // Dummy payload for POST/PUT
        const body = (route.method === "POST" || route.method === "PUT") ? JSON.stringify({}) : undefined;

        const res = await fetch(`${baseUrl}${urlPath}`, {
          method: route.method === "ALL" ? "GET" : route.method,
          headers,
          body,
        });
        actual = res.status;
      } catch (err: any) {
        console.error(`Error requesting ${route.method} ${urlPath} as ${role}:`, err.message);
        actual = 599;
      }

      // Handle expected 200/201 vs actual 400 validation error on empty body
      let match = (actual === expected);
      if (!match) {
        // If we expected 200 or 201 on write endpoint with empty body, 400 Bad Request is an authorization PASS (validation caught it)
        if ((expected === 200 || expected === 201) && actual === 400) {
          match = true;
        }
        // If we expected 200 on GET :id but got 404 (because dummy ID was not found), authorization PASSED (not 401/403)
        if (expected === 200 && actual === 404 && route.path.includes(":id")) {
          match = true;
        }
      }

      let severity = "PASS";
      if (!match) {
        violationsCount++;
        // P0: Unexpected 200 or 201 where 401 or 403 was expected!
        if ((actual === 200 || actual === 201) && (expected === 401 || expected === 403)) {
          severity = "P0-AUTH-BYPASS";
          p0Count++;
        } else if (actual === 403 && (expected === 200 || expected === 201)) {
          severity = "P1-FALSE-FORBIDDEN";
        } else {
          severity = "P2-STATUS-MISMATCH";
        }
      }

      results.push({
        method: route.method,
        routePath: route.path,
        resolvedPath: urlPath,
        role,
        expectedStatus: expected,
        actualStatus: actual,
        match,
        severity,
      });
    }
  }

  // 7. Write CSV
  const csvHeaders = "Method,RoutePath,ResolvedPath,Role,ExpectedStatus,ActualStatus,Match,Severity\n";
  const csvRows = results
    .map(
      (r) =>
        `"${r.method}","${r.routePath}","${r.resolvedPath}","${r.role}",${r.expectedStatus},${r.actualStatus},${r.match},"${r.severity}"`
    )
    .join("\n");

  fs.writeFileSync("audit/evidence/role-endpoint-matrix.csv", csvHeaders + csvRows);

  console.log(`\n=== ROLE X ENDPOINT MATRIX COMPLETED ===`);
  console.log(`Total tests executed: ${results.length} (${rawRoutes.length} endpoints x ${ROLES.length} roles)`);
  console.log(`Matches: ${results.filter((r) => r.match).length}`);
  console.log(`Mismatches: ${violationsCount}`);
  console.log(`P0 Critical Auth Bypasses (200/201 when expected 401/403): ${p0Count}`);

  if (p0Count > 0) {
    console.log("\nCRITICAL P0 AUTH BYPASSES DETECTED:");
    results
      .filter((r) => r.severity === "P0-AUTH-BYPASS")
      .forEach((r) => {
        console.log(`  - [P0] ${r.role} -> ${r.method} ${r.routePath} (Expected: ${r.expectedStatus}, Actual: ${r.actualStatus})`);
      });
  }

  if (violationsCount > 0 && p0Count === 0) {
    console.log("\nMismatches detail:");
    results
      .filter((r) => !r.match)
      .slice(0, 10)
      .forEach((r) => {
        console.log(`  - ${r.role} -> ${r.method} ${r.routePath}: Expected ${r.expectedStatus}, Actual ${r.actualStatus} (${r.severity})`);
      });
  }

  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

main().catch(console.error);
