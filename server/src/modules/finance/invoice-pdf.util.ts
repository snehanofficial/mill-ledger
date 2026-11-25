import PDFDocument from "pdfkit";

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

function formatAmount(val: { toString(): string } | number): string {
  const num = Number(val.toString());
  return `INR ${num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export async function generateInvoicePdfBuffer(
  invoice: InvoicePdfData,
): Promise<Buffer> {
  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err) => reject(err));

    const orgName = invoice.organization?.name || "MillLedger Foods Pvt Ltd";
    const orgState = invoice.organization?.state || "Tamil Nadu";
    const postedDate = new Date(invoice.postedAt).toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    // Header
    doc.fontSize(18).font("Helvetica-Bold").text("TAX INVOICE", { align: "right" });
    doc.moveUp();
    doc.fontSize(16).font("Helvetica-Bold").text(orgName);
    doc
      .fontSize(9)
      .font("Helvetica")
      .text(`State: ${orgState}`)
      .text(`GSTIN: ${invoice.companyGstinSnapshot}`);

    doc.moveDown(0.75);
    doc
      .moveTo(40, doc.y)
      .lineTo(555, doc.y)
      .strokeColor("#cccccc")
      .stroke();
    doc.moveDown(0.75);

    // Invoice metadata & Customer block
    const metaTop = doc.y;
    doc.fontSize(9).font("Helvetica-Bold").text("Billed To:", 40, metaTop);
    doc
      .font("Helvetica")
      .text(invoice.customerNameSnapshot, 40, metaTop + 14)
      .text(`Place of Supply: ${invoice.deliveryStateSnapshot}`)
      .text(
        `GSTIN: ${invoice.customerGstinSnapshot || "Unregistered"}`,
      );

    doc
      .font("Helvetica-Bold")
      .text(`Invoice No: ${invoice.invoiceNumber}`, 330, metaTop, {
        align: "right",
        width: 225,
      });
    doc
      .font("Helvetica")
      .text(`Financial Year: ${invoice.financialYear}`, 330, metaTop + 14, {
        align: "right",
        width: 225,
      })
      .text(`Date: ${postedDate}`, { align: "right", width: 225 })
      .text(`Status: ${invoice.status}`, { align: "right", width: 225 });

    if (invoice.salesOrder?.orderNumber) {
      doc.text(`Order Ref: ${invoice.salesOrder.orderNumber}`, {
        align: "right",
        width: 225,
      });
    }

    doc.moveDown(1.5);

    // Line items table header
    const tableTop = doc.y;
    const cols = {
      item: 40,
      hsn: 220,
      qty: 275,
      rate: 325,
      taxable: 390,
      tax: 455,
      total: 505,
    };

    doc.rect(40, tableTop - 4, 515, 18).fill("#f3f4f6");
    doc.fillColor("#111827").fontSize(8).font("Helvetica-Bold");
    doc.text("Item Description", cols.item + 4, tableTop);
    doc.text("HSN", cols.hsn, tableTop);
    doc.text("Qty", cols.qty, tableTop, { width: 40, align: "right" });
    doc.text("Rate", cols.rate, tableTop, { width: 55, align: "right" });
    doc.text("Taxable", cols.taxable, tableTop, { width: 55, align: "right" });
    doc.text("Tax", cols.tax, tableTop, { width: 45, align: "right" });
    doc.text("Total", cols.total, tableTop, { width: 48, align: "right" });

    let rowY = tableTop + 20;
    doc.font("Helvetica").fontSize(8.5).fillColor("#111827");

    for (const line of invoice.lines) {
      if (rowY > 720) {
        doc.addPage();
        rowY = 50;
      }
      doc.text(line.productNameSnapshot, cols.item + 4, rowY, { width: 170 });
      doc.text(line.hsnCodeSnapshot, cols.hsn, rowY, { width: 50 });
      doc.text(Number(line.quantity.toString()).toString(), cols.qty, rowY, {
        width: 40,
        align: "right",
      });
      doc.text(Number(line.unitPrice.toString()).toFixed(2), cols.rate, rowY, {
        width: 55,
        align: "right",
      });
      doc.text(
        Number(line.taxableAmount.toString()).toFixed(2),
        cols.taxable,
        rowY,
        { width: 55, align: "right" },
      );
      doc.text(Number(line.taxAmount.toString()).toFixed(2), cols.tax, rowY, {
        width: 45,
        align: "right",
      });
      doc.text(
        Number(line.lineTotal.toString()).toFixed(2),
        cols.total,
        rowY,
        { width: 48, align: "right" },
      );

      rowY += 20;
      doc
        .moveTo(40, rowY - 4)
        .lineTo(555, rowY - 4)
        .strokeColor("#e5e7eb")
        .stroke();
    }

    doc.y = rowY + 12;

    // Totals block
    const summaryX = 330;
    const summaryWidth = 225;
    const addSummaryRow = (label: string, value: string, bold = false) => {
      const y = doc.y;
      doc
        .font(bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(bold ? 10 : 9)
        .text(label, summaryX, y, { width: 115, align: "left" })
        .text(value, summaryX + 115, y, { width: 110, align: "right" });
      doc.moveDown(0.4);
    };

    addSummaryRow("Taxable Value:", formatAmount(invoice.taxableAmount));
    if (Number(invoice.cgstAmount.toString()) > 0) {
      addSummaryRow("CGST:", formatAmount(invoice.cgstAmount));
      addSummaryRow("SGST:", formatAmount(invoice.sgstAmount));
    }
    if (Number(invoice.igstAmount.toString()) > 0) {
      addSummaryRow("IGST:", formatAmount(invoice.igstAmount));
    }
    doc
      .moveTo(summaryX, doc.y)
      .lineTo(summaryX + summaryWidth, doc.y)
      .strokeColor("#9ca3af")
      .stroke();
    doc.moveDown(0.4);
    addSummaryRow("Invoice Total:", formatAmount(invoice.totalAmount), true);
    addSummaryRow("Paid Amount:", formatAmount(invoice.paidAmount));
    addSummaryRow("Outstanding:", formatAmount(invoice.outstandingAmount), true);

    if (invoice.notes) {
      doc.moveDown(1);
      doc
        .fontSize(8)
        .font("Helvetica-Bold")
        .text("Notes:", 40)
        .font("Helvetica")
        .text(invoice.notes, 40);
    }

    doc.moveDown(2);
    doc
      .fontSize(8)
      .fillColor("#6b7280")
      .text("This is a system-generated GST tax invoice.", 40, doc.y, {
        align: "center",
        width: 515,
      });

    doc.end();
  });
}
