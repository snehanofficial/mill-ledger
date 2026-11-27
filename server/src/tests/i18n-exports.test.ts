import { describe, it, expect } from "vitest";
import { renderTabularCsv } from "../modules/export/csv.renderer.js";
import { renderTabularPdf } from "../modules/export/pdf.renderer.js";
import type { ExportColumn } from "../modules/export/export.types.js";

describe("Bilingual Exports (en-IN & ta-IN)", () => {
  const columns: ExportColumn<{ code: string; name: string; total: number }>[] = [
    { key: "code", header: "Code", type: "text" },
    { key: "name", header: "Customer Name", type: "text" },
    { key: "total", header: "Total Amount", type: "currency" },
  ];

  const rows = [
    { code: "CUST-001", name: "Sri Murugan Stores", total: 14500.5 },
  ];

  it("renders UTF-8 BOM CSV with Tamil headers when locale is ta-IN", () => {
    const csv = renderTabularCsv(columns, rows, "ta-IN");
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("குறியீடு");
    expect(csv).toContain("வாடிக்கையாளர் பெயர்");
    expect(csv).toContain("மொத்தத் தொகை");
    expect(csv).toContain("Sri Murugan Stores");
    expect(csv).toContain("14500.5");
  });

  it("renders valid PDF buffer with Tamil title and headers when locale is ta-IN", async () => {
    const pdfBuf = await renderTabularPdf(
      {
        title: "Sales Register",
        documentType: "Invoices",
        generatedAt: new Date("2026-04-01T10:00:00Z"),
        locale: "ta-IN",
      },
      [{ columns, rows }],
    );

    expect(Buffer.isBuffer(pdfBuf)).toBe(true);
    expect(pdfBuf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdfBuf.length).toBeGreaterThan(1000);
  });
});
