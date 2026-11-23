import { describe, it, expect, beforeEach } from "vitest";
import { createApp } from "../../server/src/app.js";
import { prisma } from "../../server/src/db/client.js";
import { reportingService } from "../../server/src/modules/reporting/reporting.service.js";
import { auditService } from "../../server/src/modules/reporting/audit.service.js";

describe("F-035 Regression Test: Request Logging, DB Immutability, and Audit Trail", () => {
  let orgId: string;

  beforeEach(async () => {
    const org = await prisma.organization.findFirstOrThrow();
    orgId = org.id;
  });

  it("registers requestLogger in Express app stack", () => {
    const app = createApp();
    // Initialize router stack
    if (!(app as any)._router && typeof (app as any).lazyrouter === "function") {
      (app as any).lazyrouter();
    }
    const stack = (app as any)._router?.stack || (app as any).router?.stack || [];
    const loggerLayer = stack.find((l: any) => l.name === "requestLogger");
    expect(loggerLayer).toBeDefined();
  });

  it("enforces append-only immutability on audit_log: blocks UPDATE via PostgreSQL trigger", async () => {
    const testLog = await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        action: "TEST_IMMUTABILITY",
        entity: "REGRESSION_TEST",
        details: "original",
      },
    });

    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE audit_log SET action = 'TAMPERED' WHERE id = '${testLog.id}'`,
      ),
    ).rejects.toThrow(/Audit log records are strictly immutable/i);
  });

  it("enforces append-only immutability on audit_log: blocks DELETE via PostgreSQL trigger", async () => {
    const testLog = await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        action: "TEST_IMMUTABILITY",
        entity: "REGRESSION_TEST",
        details: "original",
      },
    });

    await expect(
      prisma.$executeRawUnsafe(
        `DELETE FROM audit_log WHERE id = '${testLog.id}'`,
      ),
    ).rejects.toThrow(/Audit log records are strictly immutable/i);
  });

  it("exports audit log report as CSV with valid headers and data rows", async () => {
    await auditService.log({
      organizationId: orgId,
      action: "REGRESSION_CSV_TEST",
      entity: "TEST_ENTITY",
      details: { foo: "bar" },
    });

    const csv = await reportingService.exportToCSV("audit", {
      organizationId: orgId,
    });

    expect(csv).toContain("# Report: System Audit Trail");
    expect(csv).toContain("timestamp,userEmail,action,entity,entityId,requestId,ipAddress,details");
    expect(csv).toContain("REGRESSION_CSV_TEST");
    expect(csv).toContain("TEST_ENTITY");
  });

  it("tracks user lifecycle mutations in audit log", async () => {
    const auditRecord = await auditService.log({
      organizationId: orgId,
      userId: "test-admin-id",
      userEmail: "admin@millledger.local",
      action: "CREATE",
      entity: "User",
      entityId: "test-user-id",
      details: { email: "newuser@example.com", role: "OPERATOR", name: "New User" },
      requestId: "test-request-id-1234",
    });

    expect(auditRecord).toBeDefined();
    expect(auditRecord?.action).toBe("CREATE");
    expect(auditRecord?.entity).toBe("User");
    expect(auditRecord?.requestId).toBe("test-request-id-1234");

    const fetched = await prisma.auditLog.findUnique({
      where: { id: auditRecord!.id },
    });
    expect(fetched).toBeDefined();
    expect(fetched?.action).toBe("CREATE");
    expect(fetched?.details).toContain("newuser@example.com");
  });
});
