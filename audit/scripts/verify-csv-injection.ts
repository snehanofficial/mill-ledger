/**
 * AUDIT-ONLY SCRIPT
 * Task: Verify CSV formula injection in exportToCSV
 * Standards: OWASP Top 10:2021 A03 (Injection), OWASP ASVS v4.0.3 Sec 5.1.4
 */
import { reportingService } from "../../server/src/modules/reporting/reporting.service.js";
import { prisma } from "../../server/src/db/client.js";

async function run() {
  console.log("Testing CSV Formula Injection in reporting service...");

  // Mock report data structure with malicious cell values
  const mockReportData = {
    reportTitle: "Test Sales Register",
    generatedAt: new Date().toISOString(),
    rows: [
      {
        invoiceNumber: "INV-2026-0001",
        customerName: "=cmd|' /C calc'!A0",
        orderNumber: "@SUM(1,2)",
        grandTotal: "-100+200",
        notes: "+2+5+cmd|' /C calc'!A0",
      },
    ],
  };

  // We can test the exact flattening logic used by exportToCSV
  const rows = mockReportData.rows;
  const headers = Object.keys(rows[0]);
  const csvLines = [
    `# Report: ${mockReportData.reportTitle}`,
    headers.join(","),
  ];

  for (const r of rows as any[]) {
    const line = headers.map((h) => reportingService.sanitizeCSVCell(r[h]));
    csvLines.push(line.join(","));
  }

  const generatedCsv = csvLines.join("\n");
  console.log("--- Generated CSV Output ---");
  console.log(generatedCsv);
  console.log("----------------------------");

  const hasUnescapedFormula =
    generatedCsv.includes('"=cmd') ||
    generatedCsv.includes('"@SUM') ||
    generatedCsv.includes('"+2+5');

  console.log("Unescaped formula prefixes present:", hasUnescapedFormula);

  if (hasUnescapedFormula) {
    console.log("VERIFIED-FAIL: CSV formula injection is unmitigated.");
  } else {
    console.log("VERIFIED-PASS");
  }

  await prisma.$disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
