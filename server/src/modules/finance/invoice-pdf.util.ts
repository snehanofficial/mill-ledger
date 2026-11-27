import {
  EXPORT_THEME,
  formatExportCurrency,
  formatExportDate,
  formatExportNumber,
} from "../export/export.theme.js";
import {
  createPdfContext,
  drawStandardPdfHeader,
  stampPdfFooters,
} from "../export/pdf.renderer.js";
import type { ExportDocumentMeta } from "../export/export.types.js";

export interface InvoicePdfData {
  invoiceNumber: string;
  financialYear: string;
  status: string;
  postedAt: Date | string;
  dueDate?: Date | string | null;
  companyGstinSnapshot: string;
  customerNameSnapshot: string;
  customerGstinSnapshot?: string | null;
  deliveryStateSnapshot: string;
  taxableAmount: { toString(): string } | number;
  cgstAmount: { toString(): string } | number;
  sgstAmount: { toString(): string } | number;
  igstAmount: { toString(): string } | number;
  totalTaxAmount: { toString(): string } | number;
  totalAmount: { toString(): string } | number;
  paidAmount: { toString(): string } | number;
  outstandingAmount: { toString(): string } | number;
  notes?: string | null;
  organization?: {
    name: string;
    state: string;
    gstin?: string | null;
    address?: string | null;
  } | null;
  salesOrder?: {
    orderNumber: string;
  } | null;
  lines: Array<{
    productNameSnapshot: string;
    hsnCodeSnapshot: string;
    quantity: { toString(): string } | number;
    unitPrice: { toString(): string } | number;
    taxRate: { toString(): string } | number;
    taxableAmount: { toString(): string } | number;
    taxAmount: { toString(): string } | number;
    lineTotal: { toString(): string } | number;
  }>;
}

export async function generateInvoicePdfBuffer(
  invoice: InvoicePdfData,
): Promise<Buffer> {
  const ctx = createPdfContext({ layout: "portrait", margin: 36 });
  const { doc, fonts, margin, contentWidth, pageHeight } = ctx;
  const bottomLimit = pageHeight - margin - 22;

  const meta: ExportDocumentMeta = {
    title: "TAX INVOICE",
    documentType: "Commercial Tax Invoice",
    referenceId: invoice.invoiceNumber,
    generatedAt: new Date(),
    organization: {
      name: invoice.organization?.name || undefined,
      state: invoice.organization?.state || undefined,
      gstin:
        invoice.companyGstinSnapshot ||
        invoice.organization?.gstin ||
        undefined,
      address: invoice.organization?.address || undefined,
    },
    footerNote: "System-generated GST Tax Invoice",
  };

  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));

    drawStandardPdfHeader(ctx, meta);

    // Billed To & Invoice Metadata two-column box
    const blockY = doc.y;
    const leftW = contentWidth * 0.54;
    const rightX = margin + contentWidth * 0.58;
    const rightW = contentWidth * 0.42;

    doc
      .font(fonts.bold)
      .fontSize(8)
      .fillColor(EXPORT_THEME.colors.pineAction)
      .text("BILLED TO", margin, blockY);

    doc
      .font(fonts.bold)
      .fontSize(10)
      .fillColor(EXPORT_THEME.colors.pine950)
      .text(invoice.customerNameSnapshot, margin, doc.y + 2, { width: leftW });

    const customerLines = [
      `Place of Supply: ${invoice.deliveryStateSnapshot}`,
      `GSTIN: ${invoice.customerGstinSnapshot || "Unregistered"}`,
    ];
    doc
      .font(fonts.regular)
      .fontSize(8.5)
      .fillColor(EXPORT_THEME.colors.pine700)
      .text(customerLines.join("\n"), margin, doc.y + 2, { width: leftW });
    const leftEndY = doc.y;

    doc
      .font(fonts.bold)
      .fontSize(8)
      .fillColor(EXPORT_THEME.colors.pineAction)
      .text("INVOICE DETAILS", rightX, blockY, {
        width: rightW,
        align: "right",
      });

    const detailLines = [
      `Invoice No: ${invoice.invoiceNumber}`,
      `Financial Year: ${invoice.financialYear}`,
      `Invoice Date: ${formatExportDate(invoice.postedAt)}`,
      invoice.dueDate ? `Due Date: ${formatExportDate(invoice.dueDate)}` : null,
      `Status: ${invoice.status.replaceAll("_", " ")}`,
      invoice.salesOrder?.orderNumber
        ? `Order Ref: ${invoice.salesOrder.orderNumber}`
        : null,
    ].filter(Boolean) as string[];

    doc
      .font(fonts.regular)
      .fontSize(8.5)
      .fillColor(EXPORT_THEME.colors.pine950)
      .text(detailLines.join("\n"), rightX, blockY + 12, {
        width: rightW,
        align: "right",
      });

    doc.y = Math.max(leftEndY, doc.y) + 14;

    // Line items table
    const cols = [
      { label: "#", width: 22, align: "center" as const },
      { label: "Item Description", width: 135, align: "left" as const },
      { label: "HSN", width: 54, align: "left" as const },
      { label: "Qty", width: 42, align: "right" as const },
      { label: "Rate", width: 54, align: "right" as const },
      { label: "GST %", width: 38, align: "right" as const },
      { label: "Taxable", width: 64, align: "right" as const },
      { label: "Tax", width: 52, align: "right" as const },
      { label: "Total", width: contentWidth - 461, align: "right" as const },
    ];

    const drawHeader = (y: number): number => {
      const h = 20;
      doc.rect(margin, y, contentWidth, h).fill(EXPORT_THEME.colors.pine950);
      let cx = margin;
      for (const c of cols) {
        doc
          .font(fonts.bold)
          .fontSize(7.5)
          .fillColor(EXPORT_THEME.colors.white)
          .text(c.label, cx + 4, y + 6, {
            width: c.width - 8,
            align: c.align,
          });
        cx += c.width;
      }
      return y + h;
    };

    let y = drawHeader(doc.y);

    invoice.lines.forEach((line, idx) => {
      const cells = [
        String(idx + 1),
        line.productNameSnapshot,
        line.hsnCodeSnapshot || "—",
        formatExportNumber(line.quantity, 2),
        formatExportNumber(line.unitPrice, 2),
        `${Number(line.taxRate.toString()).toFixed(1)}%`,
        formatExportNumber(line.taxableAmount, 2),
        formatExportNumber(line.taxAmount, 2),
        formatExportNumber(line.lineTotal, 2),
      ];

      doc.font(fonts.regular).fontSize(8);
      const nameHeight = doc.heightOfString(cells[1], {
        width: cols[1].width - 8,
      });
      const rowH = Math.max(19, nameHeight + 10);

      if (y + rowH > bottomLimit) {
        doc.addPage();
        y = drawHeader(margin);
      }

      if (idx % 2 === 1) {
        doc.rect(margin, y, contentWidth, rowH).fill(EXPORT_THEME.colors.zebra);
      }

      let cx = margin;
      cols.forEach((c, ci) => {
        doc
          .font(ci === 8 ? fonts.bold : fonts.regular)
          .fontSize(8)
          .fillColor(EXPORT_THEME.colors.pine950)
          .text(cells[ci], cx + 4, y + 5, {
            width: c.width - 8,
            align: c.align,
          });
        cx += c.width;
      });

      doc
        .moveTo(margin, y + rowH)
        .lineTo(margin + contentWidth, y + rowH)
        .strokeColor(EXPORT_THEME.colors.borderLight)
        .lineWidth(0.5)
        .stroke();

      y += rowH;
    });

    doc.y = y + 14;

    // Keep totals block together
    const summaryHeight = 125;
    if (doc.y + summaryHeight > bottomLimit) {
      doc.addPage();
      doc.y = margin;
    }

    const summaryW = 240;
    const summaryX = margin + contentWidth - summaryW;
    const summaryTop = doc.y;

    const addSummaryRow = (label: string, value: string, bold = false) => {
      const rowY = doc.y;
      doc
        .font(bold ? fonts.bold : fonts.regular)
        .fontSize(bold ? 9.5 : 8.5)
        .fillColor(EXPORT_THEME.colors.pine950)
        .text(label, summaryX + 8, rowY, { width: 112, align: "left" })
        .text(value, summaryX + 120, rowY, { width: 112, align: "right" });
      doc.y = rowY + (bold ? 16 : 14);
    };

    const sym = fonts.supportsRupeeGlyph;
    addSummaryRow(
      "Taxable Value",
      formatExportCurrency(invoice.taxableAmount, sym),
    );
    if (Number(invoice.cgstAmount.toString()) > 0) {
      addSummaryRow("CGST", formatExportCurrency(invoice.cgstAmount, sym));
      addSummaryRow("SGST", formatExportCurrency(invoice.sgstAmount, sym));
    }
    if (Number(invoice.igstAmount.toString()) > 0) {
      addSummaryRow("IGST", formatExportCurrency(invoice.igstAmount, sym));
    }

    doc
      .moveTo(summaryX, doc.y + 2)
      .lineTo(summaryX + summaryW, doc.y + 2)
      .strokeColor(EXPORT_THEME.colors.borderStrong)
      .lineWidth(0.75)
      .stroke();
    doc.y += 6;

    addSummaryRow(
      "Invoice Total",
      formatExportCurrency(invoice.totalAmount, sym),
      true,
    );
    addSummaryRow("Paid Amount", formatExportCurrency(invoice.paidAmount, sym));
    addSummaryRow(
      "Outstanding Balance",
      formatExportCurrency(invoice.outstandingAmount, sym),
      true,
    );

    doc
      .roundedRect(
        summaryX,
        summaryTop - 6,
        summaryW,
        doc.y - summaryTop + 8,
        4,
      )
      .strokeColor(EXPORT_THEME.colors.borderLight)
      .lineWidth(0.75)
      .stroke();

    if (invoice.notes) {
      doc.y += 14;
      if (doc.y + 40 > bottomLimit) {
        doc.addPage();
        doc.y = margin;
      }
      doc
        .font(fonts.bold)
        .fontSize(8)
        .fillColor(EXPORT_THEME.colors.pine700)
        .text("Notes", margin, doc.y);
      doc
        .font(fonts.regular)
        .fontSize(8.5)
        .fillColor(EXPORT_THEME.colors.pine950)
        .text(invoice.notes, margin, doc.y + 2, { width: contentWidth });
    }

    stampPdfFooters(ctx, meta);
    doc.end();
  });
}
