import PDFDocument from "pdfkit";
import type {
  ExportColumn,
  ExportDocumentMeta,
  ExportTableSection,
} from "./export.types.js";
import {
  EXPORT_THEME,
  formatExportCurrency,
  formatExportDate,
  formatExportDateTime,
  formatExportNumber,
  registerPdfFonts,
  type PdfFontSet,
} from "./export.theme.js";

export interface PdfRenderContext {
  doc: PDFKit.PDFDocument;
  fonts: PdfFontSet;
  pageWidth: number;
  pageHeight: number;
  margin: number;
  contentWidth: number;
}

export function createPdfContext(options: {
  layout?: "portrait" | "landscape";
  margin?: number;
}): PdfRenderContext {
  const margin = options.margin ?? 36;
  const layout = options.layout ?? "portrait";
  const doc = new PDFDocument({
    size: "A4",
    layout,
    margin,
    bufferPages: true,
  });
  const fonts = registerPdfFonts(doc);
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  return {
    doc,
    fonts,
    pageWidth,
    pageHeight,
    margin,
    contentWidth: pageWidth - margin * 2,
  };
}

export function drawStandardPdfHeader(
  ctx: PdfRenderContext,
  meta: ExportDocumentMeta,
): void {
  const { doc, fonts, margin, contentWidth } = ctx;
  const startY = margin;

  // Top accent bar (Pine Action)
  doc
    .rect(margin, startY, contentWidth, 3)
    .fill(EXPORT_THEME.colors.pineAction);

  const headerY = startY + 10;
  const leftWidth = contentWidth * 0.58;
  const rightWidth = contentWidth * 0.4;
  const rightX = margin + contentWidth - rightWidth;

  // Left: Organization Identity (omitting missing fields gracefully)
  let leftY = headerY;
  const orgName = meta.organization?.name?.trim();
  if (orgName) {
    doc
      .font(fonts.bold)
      .fontSize(13)
      .fillColor(EXPORT_THEME.colors.pine950)
      .text(orgName, margin, leftY, { width: leftWidth });
    leftY = doc.y + 2;
  } else {
    doc
      .font(fonts.bold)
      .fontSize(13)
      .fillColor(EXPORT_THEME.colors.pine950)
      .text("MillLedger", margin, leftY, { width: leftWidth });
    leftY = doc.y + 2;
  }

  const orgDetails: string[] = [];
  if (meta.organization?.address) orgDetails.push(meta.organization.address);
  const stateGstin = [
    meta.organization?.state ? `State: ${meta.organization.state}` : null,
    meta.organization?.gstin ? `GSTIN: ${meta.organization.gstin}` : null,
  ]
    .filter(Boolean)
    .join("  |  ");
  if (stateGstin) orgDetails.push(stateGstin);

  if (orgDetails.length > 0) {
    doc
      .font(fonts.regular)
      .fontSize(8.5)
      .fillColor(EXPORT_THEME.colors.pine700)
      .text(orgDetails.join("\n"), margin, leftY, { width: leftWidth });
    leftY = doc.y;
  }

  // Right: Document Type & Title
  let rightY = headerY;
  doc
    .font(fonts.bold)
    .fontSize(8)
    .fillColor(EXPORT_THEME.colors.pineAction)
    .text(meta.documentType.toUpperCase(), rightX, rightY, {
      width: rightWidth,
      align: "right",
    });
  rightY = doc.y + 1;

  doc
    .font(fonts.bold)
    .fontSize(14)
    .fillColor(EXPORT_THEME.colors.pine950)
    .text(meta.title, rightX, rightY, {
      width: rightWidth,
      align: "right",
    });
  rightY = doc.y + 2;

  const metaLines: string[] = [];
  if (meta.referenceId) metaLines.push(`Ref: ${meta.referenceId}`);
  if (meta.periodLabel) metaLines.push(`Period: ${meta.periodLabel}`);
  if (meta.scopeLabel) metaLines.push(`Scope: ${meta.scopeLabel}`);
  metaLines.push(`Generated: ${formatExportDateTime(meta.generatedAt)}`);

  doc
    .font(fonts.regular)
    .fontSize(8)
    .fillColor(EXPORT_THEME.colors.pine700)
    .text(metaLines.join("\n"), rightX, rightY, {
      width: rightWidth,
      align: "right",
    });
  rightY = doc.y;

  const dividerY = Math.max(leftY, rightY) + 8;
  doc
    .moveTo(margin, dividerY)
    .lineTo(margin + contentWidth, dividerY)
    .strokeColor(EXPORT_THEME.colors.borderStrong)
    .lineWidth(0.75)
    .stroke();

  doc.y = dividerY + 10;
}

export function stampPdfFooters(
  ctx: PdfRenderContext,
  meta: ExportDocumentMeta,
): void {
  const { doc, fonts, margin, contentWidth, pageHeight } = ctx;
  const range = doc.bufferedPageRange();
  const totalPages = range.count;

  for (let i = range.start; i < range.start + totalPages; i++) {
    doc.switchToPage(i);
    // Prevent PDFKit from auto-paginating when drawing inside the bottom margin
    const prevBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    const footerY = pageHeight - margin + 8;
    doc
      .moveTo(margin, footerY - 4)
      .lineTo(margin + contentWidth, footerY - 4)
      .strokeColor(EXPORT_THEME.colors.borderLight)
      .lineWidth(0.5)
      .stroke();

    const leftText = [
      meta.organization?.name || "MillLedger",
      meta.referenceId || meta.title,
      meta.footerNote || null,
    ]
      .filter(Boolean)
      .join("  •  ");

    doc
      .font(fonts.regular)
      .fontSize(7.5)
      .fillColor(EXPORT_THEME.colors.pine600)
      .text(leftText, margin, footerY, {
        width: contentWidth * 0.72,
        lineBreak: false,
      });

    doc
      .font(fonts.regular)
      .fontSize(7.5)
      .fillColor(EXPORT_THEME.colors.pine600)
      .text(
        `Page ${i - range.start + 1} of ${totalPages}`,
        margin + contentWidth * 0.72,
        footerY,
        {
          width: contentWidth * 0.28,
          align: "right",
          lineBreak: false,
        },
      );
    doc.page.margins.bottom = prevBottomMargin;
  }
}

function formatPdfCellValue(
  raw: unknown,
  col: ExportColumn<any>,
  useRupeeSymbol: boolean,
): string {
  if (raw === null || raw === undefined || raw === "") return "—";
  switch (col.type) {
    case "currency":
      return formatExportCurrency(raw, useRupeeSymbol);
    case "quantity":
      return formatExportNumber(raw, 2);
    case "number": {
      const n = Number(raw);
      if (!Number.isFinite(n)) return String(raw);
      return Number.isInteger(n)
        ? n.toLocaleString("en-IN")
        : formatExportNumber(n, 2);
    }
    case "percent": {
      const n = Number(raw);
      return Number.isFinite(n) ? `${n.toFixed(2)}%` : String(raw);
    }
    case "date":
      return formatExportDate(raw);
    case "datetime":
      return formatExportDateTime(raw);
    case "boolean":
      return raw ? "Yes" : "No";
    case "text":
    default:
      return String(raw);
  }
}

function isNumericCol(col: ExportColumn<any>): boolean {
  return (
    col.align === "right" ||
    col.type === "currency" ||
    col.type === "number" ||
    col.type === "quantity" ||
    col.type === "percent"
  );
}

function computeColumnWidths(
  columns: ExportColumn<any>[],
  totalWidth: number,
): number[] {
  const weights = columns.map((c) => {
    if (c.width) return c.width;
    switch (c.type) {
      case "date":
        return 62;
      case "datetime":
        return 90;
      case "currency":
        return 74;
      case "quantity":
      case "number":
      case "percent":
        return 56;
      case "boolean":
        return 44;
      default:
        return 100;
    }
  });
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  return weights.map((w) => (w / sum) * totalWidth);
}

export async function renderTabularPdf(
  meta: ExportDocumentMeta,
  sections: ExportTableSection<any>[],
  options: { layout?: "portrait" | "landscape" } = {},
): Promise<Buffer> {
  const maxCols = Math.max(0, ...sections.map((s) => s.columns.length));
  const layout = options.layout ?? (maxCols > 6 ? "landscape" : "portrait");

  const ctx = createPdfContext({ layout, margin: 34 });
  const { doc, fonts, margin, contentWidth, pageHeight } = ctx;
  const bottomLimit = pageHeight - margin - 18;

  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));

    drawStandardPdfHeader(ctx, meta);

    // Optional Summary KPI Strip
    if (meta.summaryItems && meta.summaryItems.length > 0) {
      const items = meta.summaryItems;
      const boxHeight = 36;
      const colW = contentWidth / Math.min(items.length, 4);
      const boxY = doc.y;

      doc
        .roundedRect(margin, boxY, contentWidth, boxHeight, 4)
        .fillAndStroke(
          EXPORT_THEME.colors.paper50,
          EXPORT_THEME.colors.borderLight,
        );

      items.slice(0, 4).forEach((item, idx) => {
        const x = margin + idx * colW + 10;
        doc
          .font(fonts.regular)
          .fontSize(7.5)
          .fillColor(EXPORT_THEME.colors.pine700)
          .text(item.label, x, boxY + 6, {
            width: colW - 16,
            lineBreak: false,
          });
        doc
          .font(fonts.bold)
          .fontSize(10)
          .fillColor(EXPORT_THEME.colors.pine950)
          .text(item.value, x, boxY + 18, {
            width: colW - 16,
            lineBreak: false,
          });
      });
      doc.y = boxY + boxHeight + 12;
    }

    for (const section of sections) {
      if (section.title) {
        if (doc.y + 40 > bottomLimit) {
          doc.addPage();
          doc.y = margin;
        }
        doc
          .font(fonts.bold)
          .fontSize(10.5)
          .fillColor(EXPORT_THEME.colors.pine950)
          .text(section.title, margin, doc.y);
        doc.y += 6;
      }

      if (section.columns.length === 0 || section.rows.length === 0) {
        doc
          .roundedRect(margin, doc.y, contentWidth, 28, 3)
          .fillAndStroke(
            EXPORT_THEME.colors.paper50,
            EXPORT_THEME.colors.borderLight,
          );
        doc
          .font(fonts.regular)
          .fontSize(9)
          .fillColor(EXPORT_THEME.colors.pine700)
          .text(
            "No records found for the selected criteria.",
            margin + 10,
            doc.y + 9,
          );
        doc.y += 38;
        continue;
      }

      const colWidths = computeColumnWidths(section.columns, contentWidth);
      const cellPadX = 5;
      const cellPadY = 5;

      const drawTableHeader = (y: number): number => {
        doc.font(fonts.bold).fontSize(7.5);
        let maxHeaderH = 16;
        section.columns.forEach((col, i) => {
          const label = col.unit ? `${col.header} (${col.unit})` : col.header;
          const h = doc.heightOfString(label, {
            width: Math.max(12, colWidths[i] - cellPadX * 2),
          });
          if (h + cellPadY * 2 > maxHeaderH) maxHeaderH = h + cellPadY * 2;
        });

        doc
          .rect(margin, y, contentWidth, maxHeaderH)
          .fill(EXPORT_THEME.colors.pine950);

        let curX = margin;
        section.columns.forEach((col, i) => {
          const label = col.unit ? `${col.header} (${col.unit})` : col.header;
          const align = isNumericCol(col) ? "right" : col.align || "left";
          doc
            .font(fonts.bold)
            .fontSize(7.5)
            .fillColor(EXPORT_THEME.colors.white)
            .text(label, curX + cellPadX, y + cellPadY, {
              width: Math.max(12, colWidths[i] - cellPadX * 2),
              align,
            });
          curX += colWidths[i];
        });
        return y + maxHeaderH;
      };

      let y = drawTableHeader(doc.y);

      section.rows.forEach((rowObj, rowIdx) => {
        doc.font(fonts.regular).fontSize(7.5);
        const formattedCells = section.columns.map((col) => {
          const raw = col.value
            ? col.value(rowObj)
            : (rowObj as Record<string, unknown>)[col.key];
          return formatPdfCellValue(raw, col, fonts.supportsRupeeGlyph);
        });

        let rowH = 17;
        formattedCells.forEach((txt, i) => {
          const h = doc.heightOfString(txt, {
            width: Math.max(12, colWidths[i] - cellPadX * 2),
          });
          if (h + cellPadY * 2 > rowH) rowH = h + cellPadY * 2;
        });

        if (y + rowH > bottomLimit) {
          doc.addPage();
          y = drawTableHeader(margin);
        }

        if (rowIdx % 2 === 1) {
          doc
            .rect(margin, y, contentWidth, rowH)
            .fill(EXPORT_THEME.colors.zebra);
        }

        let curX = margin;
        section.columns.forEach((col, i) => {
          const align = isNumericCol(col) ? "right" : col.align || "left";
          doc
            .font(fonts.regular)
            .fontSize(7.5)
            .fillColor(EXPORT_THEME.colors.pine950)
            .text(formattedCells[i], curX + cellPadX, y + cellPadY, {
              width: Math.max(12, colWidths[i] - cellPadX * 2),
              align,
            });
          curX += colWidths[i];
        });

        doc
          .moveTo(margin, y + rowH)
          .lineTo(margin + contentWidth, y + rowH)
          .strokeColor(EXPORT_THEME.colors.borderLight)
          .lineWidth(0.5)
          .stroke();

        y += rowH;
      });

      // Totals Row (kept together)
      if (section.totalsRow) {
        const totalsH = 20;
        if (y + totalsH > bottomLimit) {
          doc.addPage();
          y = drawTableHeader(margin);
        }
        doc
          .rect(margin, y, contentWidth, totalsH)
          .fill(EXPORT_THEME.colors.paper100);

        let curX = margin;
        section.columns.forEach((col, i) => {
          const raw = section.totalsRow![col.key];
          const txt =
            raw !== undefined
              ? formatPdfCellValue(raw, col, fonts.supportsRupeeGlyph)
              : i === 0
                ? "Total"
                : "";
          const align = isNumericCol(col) ? "right" : col.align || "left";
          doc
            .font(fonts.bold)
            .fontSize(7.5)
            .fillColor(EXPORT_THEME.colors.pine950)
            .text(txt, curX + cellPadX, y + 6, {
              width: Math.max(12, colWidths[i] - cellPadX * 2),
              align,
            });
          curX += colWidths[i];
        });

        doc
          .moveTo(margin, y + totalsH)
          .lineTo(margin + contentWidth, y + totalsH)
          .strokeColor(EXPORT_THEME.colors.borderStrong)
          .lineWidth(0.75)
          .stroke();
        y += totalsH;
      }

      doc.y = y + 14;
    }

    stampPdfFooters(ctx, meta);
    doc.end();
  });
}
