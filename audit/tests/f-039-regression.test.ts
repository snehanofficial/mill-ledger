import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServer, type Server } from "node:http";
import { createApp } from "../../server/src/app.js";
import { prisma } from "../../server/src/db/client.js";
import { reportingService } from "../../server/src/modules/reporting/reporting.service.js";
import { auditService } from "../../server/src/modules/reporting/audit.service.js";

describe("F-039 Regression Test: Audit Log Export Workflow", () => {
  let server: Server;
  let baseUrl: string;
  let orgId: string;
  let adminCookie: string;

  beforeEach(async () => {
    const app = createApp();
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;

    const org = await prisma.organization.findFirstOrThrow();
    orgId = org.id;

    // Login as admin
    const loginRes = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:5173" },
      body: JSON.stringify({ email: "admin@millledger.local", password: "AdminPassword123!" }),
    });
    expect(loginRes.status).toBe(200);
    adminCookie = loginRes.headers.get("set-cookie")?.split(";")[0] || "";
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("exports audit log report as CSV via GET /api/v1/reports/audit/export?format=csv with 200 OK", async () => {
    await auditService.log({
      organizationId: orgId,
      action: "F039_VERIFY_EXPORT",
      entity: "REGRESSION_REPORT",
      details: { exportTest: true },
    });

    const res = await fetch(`${baseUrl}/api/v1/reports/audit/export?format=csv&organizationId=MILL`, {
      headers: { Cookie: adminCookie, Origin: "http://localhost:5173" },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    const text = await res.text();
    expect(text).toContain("# Report: System Audit Trail");
    expect(text).toContain("timestamp,userEmail,action,entity,entityId,requestId,ipAddress,details");
    expect(text).toContain("F039_VERIFY_EXPORT");
  });

  it("exports audit log report as JSON via GET /api/v1/reports/audit/export?format=json with 200 OK", async () => {
    const res = await fetch(`${baseUrl}/api/v1/reports/audit/export?format=json&organizationId=MILL`, {
      headers: { Cookie: adminCookie, Origin: "http://localhost:5173" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reportTitle).toBe("System Audit Trail");
    expect(Array.isArray(body.rows)).toBe(true);
  });

  it("reportingService.exportToCSV('audit') completes without throwing Unknown report type error", async () => {
    const csv = await reportingService.exportToCSV("audit", {
      organizationId: orgId,
    });
    expect(csv).toBeDefined();
    expect(typeof csv).toBe("string");
    expect(csv).toContain("System Audit Trail");
  });
});
