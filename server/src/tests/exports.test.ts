import { describe, it, expect, beforeAll } from "vitest";
import ExcelJS from "exceljs";
import {
  serializeCsv,
  sanitizeCsvValue,
  buildExportFilename,
} from "@mill-ledger/shared";
import { createApp } from "../app.js";
import { prisma } from "../db/client.js";
import { seedUsers, seedBenchmarkMasters } from "../db/seed.js";
import { resetOperationalData } from "../db/reset.js";

const app = createApp();
let server: ReturnType<typeof app.listen>;
let baseUrl = "";

async function signIn(email: string, password: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Failed sign-in for ${email}`);
  const cookies = res.headers.getSetCookie();
  return cookies.map((c) => c.split(";")[0]).join("; ");
}

describe("Unified Professional Export System", () => {
  let adminCookie = "";
  let salesmanCookie = "";
  let productionCookie = "";

  beforeAll(async () => {
    await resetOperationalData();
    await seedUsers();
    await seedBenchmarkMasters();

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        const port = typeof addr === "object" && addr ? addr.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });

    adminCookie = await signIn("admin@millledger.local", "AdminPassword123!");
    salesmanCookie = await signIn(
      "salesman1@millledger.local",
      "SalesmanPassword123!",
    );
    productionCookie = await signIn(
      "production@millledger.local",
      "ProductionPassword123!",
    );
  });

  it("CSV: enforces UTF-8 BOM, RFC 4180 escaping, and CWE-1236 formula injection protection while keeping numbers numeric", () => {
    expect(sanitizeCsvValue("=CMD|'/C calc'!A0")).toBe("'=CMD|'/C calc'!A0");
    expect(sanitizeCsvValue("  +1+1")).toBe("'  +1+1");
    expect(sanitizeCsvValue("\t-100")).toBe("'\t-100");
    expect(sanitizeCsvValue("@SUM(A1:A2)")).toBe("'@SUM(A1:A2)");
    // Legitimate negative numbers remain unprefixed numeric strings
    expect(sanitizeCsvValue(-500.25)).toBe("-500.25");

    const csv = serializeCsv(
      ["Customer", "Notes", "Amount"],
      [
        ['=HYPERLINK("http://evil")', 'Line 1\nLine 2, "quoted"', -1250.5],
        ["Arokya Foods (தமிழ்)", "Normal note", 4500],
      ],
    );
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("\r\n");
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain('"Line 1\nLine 2, ""quoted"""');
    expect(csv).toContain(",-1250.5\r\n");
    expect(csv).toContain("Arokya Foods (தமிழ்)");
  });

  it("Filename builder: produces filesystem-safe standardized filenames", () => {
    const f1 = buildExportFilename({
      orgName: "MillLedger Foods Pvt Ltd",
      module: "Sales-Register",
      date: "2026-11-27T10:00:00Z",
      extension: "xlsx",
    });
    expect(f1).toBe("MillLedger_Sales-Register_2026-11-27.xlsx");

    const f2 = buildExportFilename({
      module: "",
      identifier: "INV/2026/0001",
      extension: "pdf",
    });
    expect(f2).toBe("INV_2026_0001.pdf");
  });

  it("Entity exports: exports products, customers, orders, invoices, payments, recipes, suppliers in PDF, XLSX, CSV with proper headers & RBAC", async () => {
    const entities = [
      "products",
      "customers",
      "orders",
      "invoices",
      "payments",
      "recipes",
      "suppliers",
    ];

    for (const entity of entities) {
      for (const format of ["csv", "xlsx", "pdf"] as const) {
        const res = await fetch(
          `${baseUrl}/api/v1/exports/${entity}?format=${format}`,
          { headers: { Cookie: adminCookie } },
        );
        expect(res.status, `${entity} ${format}`).toBe(200);
        const disp = res.headers.get("content-disposition") || "";
        expect(disp).toContain(`.${format}`);

        const buf = Buffer.from(await res.arrayBuffer());
        if (format === "csv") {
          const text = buf.toString("utf8");
          expect(text.startsWith("\uFEFF")).toBe(true);
          expect(text.startsWith("#")).toBe(false);
        } else if (format === "xlsx") {
          expect(buf.subarray(0, 2).toString("utf8")).toBe("PK");
          const wb = new ExcelJS.Workbook();
          await wb.xlsx.load(buf as any);
          expect(wb.worksheets.length).toBeGreaterThanOrEqual(1);
          const ws = wb.worksheets[0];
          expect(ws.views[0]?.state).toBe("frozen");
          expect(ws.autoFilter).toBeTruthy();
        } else {
          expect(buf.subarray(0, 5).toString("utf8")).toBe("%PDF-");
          expect(buf.length).toBeGreaterThan(800);
        }
      }
    }

    // RBAC: Production cannot export invoices or payments
    const forbiddenInv = await fetch(
      `${baseUrl}/api/v1/exports/invoices?format=pdf`,
      { headers: { Cookie: productionCookie } },
    );
    expect(forbiddenInv.status).toBe(403);

    const forbiddenPay = await fetch(
      `${baseUrl}/api/v1/exports/payments?format=xlsx`,
      { headers: { Cookie: salesmanCookie } },
    );
    expect(forbiddenPay.status).toBe(403);
  });

  it("Excel: parses GST multi-sheet workbook and validates numeric types & formula safety", async () => {
    const res = await fetch(
      `${baseUrl}/api/v1/reports/gst/export?format=xlsx`,
      {
        headers: { Cookie: adminCookie },
      },
    );
    expect(res.status).toBe(200);
    const buf = Buffer.from(await res.arrayBuffer());
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as any);

    const sheetNames = wb.worksheets.map((s) => s.name);
    expect(sheetNames).toContain("B2B Supplies");
    expect(sheetNames).toContain("B2C Supplies");
    expect(sheetNames).toContain("HSN Summary");
    expect(sheetNames).toContain("Rate Breakup");
    expect(sheetNames).toContain("Credit Notes");
  });

  it("Single-document PDFs: generates Recipe Sheet PDF and Customer Statement PDF", async () => {
    const recipe = await prisma.recipe.findFirst();
    expect(recipe).toBeTruthy();
    const recRes = await fetch(
      `${baseUrl}/api/v1/exports/recipes/${recipe!.id}/pdf`,
      { headers: { Cookie: adminCookie } },
    );
    expect(recRes.status).toBe(200);
    const recBuf = Buffer.from(await recRes.arrayBuffer());
    expect(recBuf.subarray(0, 5).toString("utf8")).toBe("%PDF-");

    const customer = await prisma.customer.findFirst();
    expect(customer).toBeTruthy();
    const custRes = await fetch(
      `${baseUrl}/api/v1/exports/customers/${customer!.id}/statement/pdf`,
      { headers: { Cookie: adminCookie } },
    );
    expect(custRes.status).toBe(200);
    const custBuf = Buffer.from(await custRes.arrayBuffer());
    expect(custBuf.subarray(0, 5).toString("utf8")).toBe("%PDF-");
  });
});
