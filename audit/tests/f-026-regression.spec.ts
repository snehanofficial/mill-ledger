import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../server/src/app.js";
import { reportingService } from "../../server/src/modules/reporting/reporting.service.js";

describe("F-026 Regression Test: CSV Formula Injection Neutralization", () => {
  let server: Server;
  let baseUrl: string;
  let adminCookie: string;

  beforeAll(async () => {
    const app = createApp();
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;

    const loginRes = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@millledger.local",
        password: "AdminPassword123!",
      }),
    });
    adminCookie = loginRes.headers.get("set-cookie") ?? "";
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("neutralizes formula trigger prefixes (=, +, -, @, \\t, \\r) on string values", () => {
    // Dangerous formula prefixes per OWASP CWE-1236
    expect(reportingService.sanitizeCSVCell("=cmd|' /C calc'!A0")).toBe(
      "\"'=cmd|' /C calc'!A0\"",
    );
    expect(reportingService.sanitizeCSVCell("@SUM(A1:A10)")).toBe(
      "\"'@SUM(A1:A10)\"",
    );
    expect(reportingService.sanitizeCSVCell("+2+5+cmd|' /C calc'!A0")).toBe(
      "\"'+2+5+cmd|' /C calc'!A0\"",
    );
    expect(reportingService.sanitizeCSVCell("-100+200")).toBe(
      "\"'-100+200\"",
    );
    expect(reportingService.sanitizeCSVCell("\tDDE(\"cmd\";\"/C calc\";\"__DdeLink__\")")).toBe(
      "\"'\tDDE(\"\"cmd\"\";\"\"/C calc\"\";\"\"__DdeLink__\"\")\"",
    );
    expect(reportingService.sanitizeCSVCell("\r=1+1")).toBe(
      "\"'\r=1+1\"",
    );
  });

  it("preserves standard numbers, booleans, and benign text without prepending apostrophe", () => {
    // Numbers
    expect(reportingService.sanitizeCSVCell(7875)).toBe('"7875"');
    expect(reportingService.sanitizeCSVCell(43.125)).toBe('"43.125"');
    expect(reportingService.sanitizeCSVCell(-50)).toBe('"-50"');
    expect(reportingService.sanitizeCSVCell(0)).toBe('"0"');

    // Booleans
    expect(reportingService.sanitizeCSVCell(true)).toBe('"true"');
    expect(reportingService.sanitizeCSVCell(false)).toBe('"false"');

    // Benign strings
    expect(reportingService.sanitizeCSVCell("Retailer A")).toBe('"Retailer A"');
    expect(reportingService.sanitizeCSVCell("SO-2026-0001")).toBe('"SO-2026-0001"');
    expect(reportingService.sanitizeCSVCell("Tamil Nadu")).toBe('"Tamil Nadu"');
  });

  it("handles null, undefined, and internal quotes safely", () => {
    expect(reportingService.sanitizeCSVCell(null)).toBe('""');
    expect(reportingService.sanitizeCSVCell(undefined)).toBe('""');
    expect(reportingService.sanitizeCSVCell('Text with "quotes"')).toBe(
      '"Text with ""quotes"""',
    );
  });

  it("exports sales report to CSV without formula injection vulnerabilities via HTTP endpoint", async () => {
    const exportRes = await fetch(
      `${baseUrl}/api/v1/reports/sales/export?format=csv`,
      {
        headers: { Cookie: adminCookie },
      },
    );
    expect(exportRes.status).toBe(200);
    expect(exportRes.headers.get("content-type")).toContain("text/csv");

    const csvContent = await exportRes.text();
    expect(csvContent).toContain("# Report: Sales Register");

    // Ensure no unescaped formula lines exist in the CSV content
    const lines = csvContent.split("\n");
    for (const line of lines) {
      if (line.startsWith("#")) continue;
      const cells = line.split(",");
      for (const cell of cells) {
        // Any cell with formula prefix must have single quote prefix inside double quotes
        if (/^"=[A-Za-z]/.test(cell)) {
          throw new Error(`Unescaped formula cell detected: ${cell}`);
        }
      }
    }
  });
});
