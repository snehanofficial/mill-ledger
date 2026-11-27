import {
  EXPORT_THEME,
  formatExportCurrency,
  formatExportDate,
  formatExportNumber,
} from "../export.theme.js";
import {
  createPdfContext,
  drawStandardPdfHeader,
  renderTabularPdf,
  stampPdfFooters,
} from "../pdf.renderer.js";
import type {
  ExportColumn,
  ExportDocumentMeta,
  ExportOrganization,
} from "../export.types.js";

export interface OrderPdfData {
  orderNumber: string;
  status: string;
  fulfilmentStatus: string;
  createdAt: Date | string;
  notes?: string | null;
  taxableAmount: { toString(): string } | number;
  cgstAmount: { toString(): string } | number;
  sgstAmount: { toString(): string } | number;
  igstAmount: { toString(): string } | number;
  totalTaxAmount: { toString(): string } | number;
  totalAmount: { toString(): string } | number;
  organization?: ExportOrganization | null;
  customer: {
    code: string;
    name: string;
    state: string;
    gstin?: string | null;
  };
  salesman?: {
    name: string;
  } | null;
  lines: Array<{
    productVariant: {
      sku: string;
      name: string;
    };
    approvedQuantity: { toString(): string } | number;
    approvedUnitPrice: { toString(): string } | number;
    taxRate: { toString(): string } | number;
    taxableAmount: { toString(): string } | number;
    taxAmount: { toString(): string } | number;
    lineTotal: { toString(): string } | number;
  }>;
}

export async function generateOrderPdfBuffer(
  order: OrderPdfData,
): Promise<Buffer> {
  const ctx = createPdfContext({ layout: "portrait", margin: 36 });
  const { doc, fonts, margin, contentWidth, pageHeight } = ctx;
  const bottomLimit = pageHeight - margin - 22;

  const meta: ExportDocumentMeta = {
    title: "SALES ORDER",
    documentType: "Commercial Order",
    referenceId: order.orderNumber,
    generatedAt: new Date(),
    organization: order.organization,
    footerNote: "MillLedger Sales Order",
  };

  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", (err: unknown) => reject(err));

    drawStandardPdfHeader(ctx, meta);

    const blockY = doc.y;
    const leftW = contentWidth * 0.54;
    const rightX = margin + contentWidth * 0.58;
    const rightW = contentWidth * 0.42;

    doc
      .font(fonts.bold)
      .fontSize(8)
      .fillColor(EXPORT_THEME.colors.pineAction)
      .text("CUSTOMER", margin, blockY);
    doc
      .font(fonts.bold)
      .fontSize(10)
      .fillColor(EXPORT_THEME.colors.pine950)
      .text(
        `${order.customer.name} (${order.customer.code})`,
        margin,
        doc.y + 2,
        {
          width: leftW,
        },
      );
    doc
      .font(fonts.regular)
      .fontSize(8.5)
      .fillColor(EXPORT_THEME.colors.pine700)
      .text(
        `State: ${order.customer.state}\nGSTIN: ${order.customer.gstin || "Unregistered"}`,
        margin,
        doc.y + 2,
        { width: leftW },
      );
    const leftEndY = doc.y;

    doc
      .font(fonts.bold)
      .fontSize(8)
      .fillColor(EXPORT_THEME.colors.pineAction)
      .text("ORDER DETAILS", rightX, blockY, { width: rightW, align: "right" });

    const detailLines = [
      `Order No: ${order.orderNumber}`,
      `Date: ${formatExportDate(order.createdAt)}`,
      `Status: ${order.status.replaceAll("_", " ")}`,
      `Fulfilment: ${order.fulfilmentStatus.replaceAll("_", " ")}`,
      order.salesman?.name ? `Salesman: ${order.salesman.name}` : null,
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

    const cols = [
      { label: "#", width: 24, align: "center" as const },
      { label: "SKU", width: 78, align: "left" as const },
      { label: "Product", width: 158, align: "left" as const },
      { label: "Qty", width: 46, align: "right" as const },
      { label: "Rate", width: 60, align: "right" as const },
      { label: "Taxable", width: 68, align: "right" as const },
      { label: "Total", width: contentWidth - 434, align: "right" as const },
    ];

    const drawHeader = (y: number): number => {
      doc.rect(margin, y, contentWidth, 20).fill(EXPORT_THEME.colors.pine950);
      let cx = margin;
      for (const c of cols) {
        doc
          .font(fonts.bold)
          .fontSize(7.5)
          .fillColor(EXPORT_THEME.colors.white)
          .text(c.label, cx + 4, y + 6, { width: c.width - 8, align: c.align });
        cx += c.width;
      }
      return y + 20;
    };

    let y = drawHeader(doc.y);

    order.lines.forEach((line, idx) => {
      const cells = [
        String(idx + 1),
        line.productVariant.sku,
        line.productVariant.name,
        formatExportNumber(line.approvedQuantity, 2),
        formatExportNumber(line.approvedUnitPrice, 2),
        formatExportNumber(line.taxableAmount, 2),
        formatExportNumber(line.lineTotal, 2),
      ];
      doc.font(fonts.regular).fontSize(8);
      const nameH = doc.heightOfString(cells[2], { width: cols[2].width - 8 });
      const rowH = Math.max(19, nameH + 10);

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
          .font(ci === 6 ? fonts.bold : fonts.regular)
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
    if (doc.y + 90 > bottomLimit) {
      doc.addPage();
      doc.y = margin;
    }

    const summaryW = 220;
    const summaryX = margin + contentWidth - summaryW;
    const sym = fonts.supportsRupeeGlyph;
    const addRow = (label: string, val: string, bold = false) => {
      const ry = doc.y;
      doc
        .font(bold ? fonts.bold : fonts.regular)
        .fontSize(bold ? 9.5 : 8.5)
        .fillColor(EXPORT_THEME.colors.pine950)
        .text(label, summaryX, ry, { width: 105, align: "left" })
        .text(val, summaryX + 105, ry, { width: 115, align: "right" });
      doc.y = ry + (bold ? 16 : 14);
    };
    addRow("Taxable Value", formatExportCurrency(order.taxableAmount, sym));
    addRow("Total Tax", formatExportCurrency(order.totalTaxAmount, sym));
    addRow("Order Total", formatExportCurrency(order.totalAmount, sym), true);

    if (order.notes) {
      doc.y += 10;
      doc
        .font(fonts.bold)
        .fontSize(8)
        .fillColor(EXPORT_THEME.colors.pine700)
        .text("Notes", margin, doc.y);
      doc
        .font(fonts.regular)
        .fontSize(8.5)
        .fillColor(EXPORT_THEME.colors.pine950)
        .text(order.notes, margin, doc.y + 2, { width: contentWidth });
    }

    stampPdfFooters(ctx, meta);
    doc.end();
  });
}

export interface PaymentReceiptPdfData {
  paymentNumber: string;
  paymentDate: Date | string;
  paymentMode: string;
  status: string;
  referenceNumber?: string | null;
  amount: { toString(): string } | number;
  unallocatedAmount: { toString(): string } | number;
  notes?: string | null;
  organization?: ExportOrganization | null;
  customer: {
    code: string;
    name: string;
    state: string;
    gstin?: string | null;
  };
  allocations: Array<{
    amount: { toString(): string } | number;
    salesInvoice: {
      invoiceNumber: string;
      postedAt: Date | string;
      totalAmount: { toString(): string } | number;
    };
  }>;
}

export async function generatePaymentReceiptPdfBuffer(
  payment: PaymentReceiptPdfData,
): Promise<Buffer> {
  const totalAmount = Number(payment.amount.toString());
  const unallocated = Number(payment.unallocatedAmount.toString());
  const allocated = totalAmount - unallocated;

  const meta: ExportDocumentMeta = {
    title: "PAYMENT RECEIPT",
    documentType: "Official Receipt",
    referenceId: payment.paymentNumber,
    generatedAt: new Date(),
    organization: payment.organization,
    summaryItems: [
      {
        label: "Customer",
        value: `${payment.customer.name} (${payment.customer.code})`,
        bold: true,
      },
      {
        label: "Mode & Ref",
        value: `${payment.paymentMode}${payment.referenceNumber ? ` (${payment.referenceNumber})` : ""}`,
      },
      {
        label: "Amount Received",
        value: formatExportCurrency(totalAmount, true),
        bold: true,
      },
      {
        label: "Unallocated Credit",
        value: formatExportCurrency(unallocated, true),
      },
    ],
    footerNote: `Date: ${formatExportDate(payment.paymentDate)} | Status: ${payment.status}`,
  };

  const columns: ExportColumn[] = [
    {
      key: "invoiceNumber",
      header: "Invoice Number",
      type: "text",
      width: 130,
    },
    { key: "invoiceDate", header: "Invoice Date", type: "date", width: 90 },
    {
      key: "invoiceTotal",
      header: "Invoice Total",
      type: "currency",
      width: 110,
    },
    {
      key: "allocatedAmount",
      header: "Allocated Amount",
      type: "currency",
      width: 110,
    },
  ];

  const rows = payment.allocations.map((a) => ({
    invoiceNumber: a.salesInvoice.invoiceNumber,
    invoiceDate: a.salesInvoice.postedAt,
    invoiceTotal: Number(a.salesInvoice.totalAmount.toString()),
    allocatedAmount: Number(a.amount.toString()),
  }));

  return await renderTabularPdf(
    meta,
    [
      {
        title: "Invoice Allocations",
        columns,
        rows,
        totalsRow:
          rows.length > 0
            ? {
                invoiceNumber: "Total Allocated",
                allocatedAmount: allocated,
              }
            : undefined,
      },
    ],
    { layout: "portrait" },
  );
}

export interface CustomerStatementPdfData {
  organization?: ExportOrganization | null;
  customer: {
    code: string;
    name: string;
    state: string;
    gstin?: string | null;
  };
  summary: {
    totalInvoiced: number;
    totalCreditNotes: number;
    totalPaid: number;
    netOutstanding: number;
  };
  entries: Array<{
    date: Date | string;
    type: string;
    reference: string;
    debit: number;
    credit: number;
    balance: number;
  }>;
}

export async function generateCustomerStatementPdfBuffer(
  data: CustomerStatementPdfData,
): Promise<Buffer> {
  const meta: ExportDocumentMeta = {
    title: "CUSTOMER STATEMENT",
    documentType: "Account Ledger Statement",
    referenceId: data.customer.code,
    generatedAt: new Date(),
    organization: data.organization,
    summaryItems: [
      {
        label: "Customer",
        value: `${data.customer.name} (${data.customer.code})`,
        bold: true,
      },
      {
        label: "Total Invoiced",
        value: formatExportCurrency(data.summary.totalInvoiced, true),
      },
      {
        label: "Total Collected",
        value: formatExportCurrency(data.summary.totalPaid, true),
      },
      {
        label: "Net Outstanding",
        value: formatExportCurrency(data.summary.netOutstanding, true),
        bold: true,
      },
    ],
    footerNote: data.customer.gstin
      ? `Customer GSTIN: ${data.customer.gstin}`
      : undefined,
  };

  const columns: ExportColumn[] = [
    { key: "date", header: "Date", type: "date", width: 70 },
    { key: "type", header: "Transaction Type", type: "text", width: 100 },
    { key: "reference", header: "Reference", type: "text", width: 110 },
    { key: "debit", header: "Debit", type: "currency", width: 85 },
    { key: "credit", header: "Credit", type: "currency", width: 85 },
    { key: "balance", header: "Balance", type: "currency", width: 90 },
  ];

  return await renderTabularPdf(
    meta,
    [
      {
        title: `Ledger Entries — ${data.customer.name}`,
        columns,
        rows: data.entries,
      },
    ],
    { layout: "portrait" },
  );
}

export interface RecipeSheetPdfData {
  organization?: ExportOrganization | null;
  version: number;
  name: string;
  standardBatchSize: { toString(): string } | number;
  expectedOutputQty: { toString(): string } | number;
  isActive: boolean;
  outputUom: {
    code: string;
  };
  productVariant: {
    sku: string;
    name: string;
  };
  items: Array<{
    itemType: string;
    plannedQty: { toString(): string } | number;
    inventoryItem: {
      sku: string;
      name: string;
      baseUom: { code: string };
    };
  }>;
}

export async function generateRecipeSheetPdfBuffer(
  recipe: RecipeSheetPdfData,
): Promise<Buffer> {
  const meta: ExportDocumentMeta = {
    title: "RECIPE SHEET",
    documentType: "Bill of Materials",
    referenceId: `${recipe.productVariant.sku} v${recipe.version}`,
    generatedAt: new Date(),
    organization: recipe.organization,
    summaryItems: [
      {
        label: "Recipe",
        value: `${recipe.name} (v${recipe.version})`,
        bold: true,
      },
      {
        label: "Output Product",
        value: `${recipe.productVariant.name} (${recipe.productVariant.sku})`,
      },
      {
        label: "Standard Batch",
        value: formatExportNumber(recipe.standardBatchSize, 2),
      },
      {
        label: "Expected Output",
        value: `${formatExportNumber(recipe.expectedOutputQty, 2)} ${recipe.outputUom.code}`,
      },
    ],
    footerNote: `Status: ${recipe.isActive ? "Active" : "Inactive"}`,
  };

  const columns: ExportColumn[] = [
    { key: "sku", header: "Material SKU", type: "text", width: 100 },
    { key: "name", header: "Material Name", type: "text", width: 180 },
    { key: "itemType", header: "Role", type: "text", width: 90 },
    { key: "quantity", header: "Qty / Batch", type: "quantity", width: 80 },
    { key: "uom", header: "UOM", type: "text", width: 55 },
  ];

  const rows = recipe.items.map((item) => ({
    sku: item.inventoryItem.sku,
    name: item.inventoryItem.name,
    itemType: item.itemType.replaceAll("_", " "),
    quantity: Number(item.plannedQty.toString()),
    uom: item.inventoryItem.baseUom.code,
  }));

  return await renderTabularPdf(
    meta,
    [{ title: "Standard Batch Ingredients", columns, rows }],
    { layout: "portrait" },
  );
}
