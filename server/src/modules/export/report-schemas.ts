import type {
  ExportColumn,
  ExportDocumentMeta,
  ExportOrganization,
  ExportSummaryItem,
} from "./export.types.js";
import type { ExcelSheetDefinition } from "./excel.renderer.js";
import type { ExportTableSection } from "./export.types.js";
import {
  formatExportCurrency,
  formatExportNumber,
  formatPeriodLabel,
} from "./export.theme.js";

export interface BuiltReportExport {
  meta: ExportDocumentMeta;
  primaryColumns: ExportColumn<any>[];
  primaryRows: Record<string, unknown>[];
  pdfSections: ExportTableSection<any>[];
  excelSheets: ExcelSheetDefinition<any>[];
}

function numSum(rows: Record<string, unknown>[], key: string): number {
  let sum = 0;
  for (const r of rows) {
    const n = Number(r[key] ?? 0);
    if (Number.isFinite(n)) sum += n;
  }
  return Math.round(sum * 100) / 100;
}

export function buildReportExportSpec(
  reportType: string,
  reportData: Record<string, any>,
  options: {
    organization?: ExportOrganization | null;
    startDate?: Date;
    endDate?: Date;
  },
): BuiltReportExport {
  const generatedAt = reportData.generatedAt
    ? new Date(reportData.generatedAt)
    : new Date();
  const periodLabel = formatPeriodLabel(options.startDate, options.endDate);
  const title = reportData.reportTitle || `${reportType.toUpperCase()} Report`;

  const makeMeta = (
    documentType: string,
    summaryItems?: ExportSummaryItem[],
  ): ExportDocumentMeta => ({
    title,
    documentType,
    periodLabel,
    generatedAt,
    organization: options.organization,
    summaryItems,
  });

  switch (reportType.toLowerCase()) {
    case "sales": {
      const rows = (reportData.rows || []) as Record<string, unknown>[];
      const summary = reportData.summary || {};
      const columns: ExportColumn[] = [
        { key: "invoiceNumber", header: "Invoice #", type: "text", width: 85 },
        { key: "invoiceDate", header: "Date", type: "date", width: 65 },
        { key: "customerCode", header: "Cust. Code", type: "text", width: 65 },
        { key: "customerName", header: "Customer", type: "text", width: 115 },
        { key: "deliveryState", header: "State", type: "text", width: 70 },
        { key: "productName", header: "Product", type: "text", width: 115 },
        { key: "hsnCode", header: "HSN", type: "text", width: 55 },
        { key: "quantity", header: "Qty", type: "quantity", width: 50 },
        { key: "unitPrice", header: "Rate", type: "currency", width: 65 },
        { key: "taxableAmount", header: "Taxable", type: "currency", width: 75 },
        { key: "cgstAmount", header: "CGST", type: "currency", width: 60 },
        { key: "sgstAmount", header: "SGST", type: "currency", width: 60 },
        { key: "igstAmount", header: "IGST", type: "currency", width: 60 },
        { key: "taxAmount", header: "Tax", type: "currency", width: 65 },
        { key: "lineTotal", header: "Total", type: "currency", width: 78 },
      ];
      const totalsRow = {
        invoiceNumber: "Total",
        quantity: summary.totalQuantity ?? numSum(rows, "quantity"),
        taxableAmount: summary.totalTaxable ?? numSum(rows, "taxableAmount"),
        cgstAmount: summary.totalCGST ?? numSum(rows, "cgstAmount"),
        sgstAmount: summary.totalSGST ?? numSum(rows, "sgstAmount"),
        igstAmount: summary.totalIGST ?? numSum(rows, "igstAmount"),
        taxAmount: summary.totalTax ?? numSum(rows, "taxAmount"),
        lineTotal: summary.grandTotal ?? numSum(rows, "lineTotal"),
      };
      const meta = makeMeta("Sales Register", [
        { label: "Invoices", value: String(summary.totalInvoicesCount ?? rows.length) },
        { label: "Taxable Value", value: formatExportCurrency(totalsRow.taxableAmount, true) },
        { label: "Total Tax", value: formatExportCurrency(totalsRow.taxAmount, true) },
        { label: "Grand Total", value: formatExportCurrency(totalsRow.lineTotal, true), bold: true },
      ]);
      return {
        meta,
        primaryColumns: columns,
        primaryRows: rows,
        pdfSections: [{ columns, rows, totalsRow }],
        excelSheets: [{ name: "Sales Register", columns, rows, totalsRow }],
      };
    }

    case "customer-sales": {
      const rows = (reportData.rows || []) as Record<string, unknown>[];
      const columns: ExportColumn[] = [
        { key: "customerCode", header: "Customer Code", type: "text", width: 85 },
        { key: "customerName", header: "Customer Name", type: "text", width: 145 },
        { key: "state", header: "Place of Supply", type: "text", width: 90 },
        { key: "invoicesCount", header: "Invoices", type: "number", width: 60 },
        { key: "taxableAmount", header: "Taxable Value", type: "currency", width: 90 },
        { key: "totalTaxAmount", header: "Total Tax", type: "currency", width: 80 },
        { key: "totalAmount", header: "Total Invoiced", type: "currency", width: 95 },
        { key: "outstandingAmount", header: "Outstanding", type: "currency", width: 95 },
      ];
      const totalsRow = {
        customerCode: "Total",
        invoicesCount: numSum(rows, "invoicesCount"),
        taxableAmount: numSum(rows, "taxableAmount"),
        totalTaxAmount: numSum(rows, "totalTaxAmount"),
        totalAmount: numSum(rows, "totalAmount"),
        outstandingAmount: numSum(rows, "outstandingAmount"),
      };
      const meta = makeMeta("Sales Summary", [
        { label: "Customers", value: String(rows.length) },
        { label: "Taxable Value", value: formatExportCurrency(totalsRow.taxableAmount, true) },
        { label: "Total Invoiced", value: formatExportCurrency(totalsRow.totalAmount, true), bold: true },
        { label: "Outstanding", value: formatExportCurrency(totalsRow.outstandingAmount, true) },
      ]);
      return {
        meta,
        primaryColumns: columns,
        primaryRows: rows,
        pdfSections: [{ columns, rows, totalsRow }],
        excelSheets: [{ name: "Customer Sales", columns, rows, totalsRow }],
      };
    }

    case "product-sales": {
      const rows = (reportData.rows || []) as Record<string, unknown>[];
      const columns: ExportColumn[] = [
        { key: "productName", header: "Product Name", type: "text", width: 170 },
        { key: "hsnCode", header: "HSN Code", type: "text", width: 80 },
        { key: "totalQuantity", header: "Total Qty", type: "quantity", width: 80 },
        { key: "taxableAmount", header: "Taxable Value", type: "currency", width: 95 },
        { key: "totalTaxAmount", header: "Total Tax", type: "currency", width: 85 },
        { key: "totalAmount", header: "Total Amount", type: "currency", width: 100 },
      ];
      const totalsRow = {
        productName: "Total",
        totalQuantity: numSum(rows, "totalQuantity"),
        taxableAmount: numSum(rows, "taxableAmount"),
        totalTaxAmount: numSum(rows, "totalTaxAmount"),
        totalAmount: numSum(rows, "totalAmount"),
      };
      const meta = makeMeta("Product Sales Summary", [
        { label: "Products", value: String(rows.length) },
        { label: "Total Qty", value: formatExportNumber(totalsRow.totalQuantity, 2) },
        { label: "Total Sales", value: formatExportCurrency(totalsRow.totalAmount, true), bold: true },
      ]);
      return {
        meta,
        primaryColumns: columns,
        primaryRows: rows,
        pdfSections: [{ columns, rows, totalsRow }],
        excelSheets: [{ name: "Product Sales", columns, rows, totalsRow }],
      };
    }

    case "gst": {
      const b2b = (reportData.b2bSupplies || []) as Record<string, unknown>[];
      const b2c = (reportData.b2cSupplies || []) as Record<string, unknown>[];
      const cns = (reportData.creditNotes || []) as Record<string, unknown>[];
      const rates = (reportData.rateBreakup || []) as Record<string, unknown>[];
      const hsn = (reportData.hsnSummary || []) as Record<string, unknown>[];
      const summary = reportData.summary || {};

      const supplyCols: ExportColumn[] = [
        { key: "invoiceNumber", header: "Invoice #", type: "text", width: 85 },
        { key: "invoiceDate", header: "Date", type: "date", width: 65 },
        { key: "customerName", header: "Customer", type: "text", width: 120 },
        { key: "customerGstin", header: "GSTIN", type: "text", width: 95 },
        { key: "placeOfSupply", header: "Place of Supply", type: "text", width: 85 },
        { key: "supplyType", header: "Type", type: "text", width: 70 },
        { key: "taxableAmount", header: "Taxable", type: "currency", width: 75 },
        { key: "cgstAmount", header: "CGST", type: "currency", width: 60 },
        { key: "sgstAmount", header: "SGST", type: "currency", width: 60 },
        { key: "igstAmount", header: "IGST", type: "currency", width: 60 },
        { key: "invoiceTotal", header: "Total", type: "currency", width: 80 },
      ];
      const hsnCols: ExportColumn[] = [
        { key: "hsnCode", header: "HSN Code", type: "text", width: 80 },
        { key: "description", header: "Description", type: "text", width: 150 },
        { key: "quantity", header: "Qty", type: "quantity", width: 70 },
        { key: "taxable", header: "Taxable", type: "currency", width: 85 },
        { key: "cgst", header: "CGST", type: "currency", width: 70 },
        { key: "sgst", header: "SGST", type: "currency", width: 70 },
        { key: "igst", header: "IGST", type: "currency", width: 70 },
      ];
      const rateCols: ExportColumn[] = [
        { key: "ratePct", header: "GST Rate (%)", type: "percent", width: 80 },
        { key: "taxable", header: "Taxable Value", type: "currency", width: 100 },
        { key: "cgst", header: "CGST", type: "currency", width: 85 },
        { key: "sgst", header: "SGST", type: "currency", width: 85 },
        { key: "igst", header: "IGST", type: "currency", width: 85 },
        { key: "totalTax", header: "Total Tax", type: "currency", width: 95 },
      ];
      const cnCols: ExportColumn[] = [
        { key: "creditNoteNumber", header: "Credit Note #", type: "text", width: 90 },
        { key: "originalInvoiceNumber", header: "Original Invoice", type: "text", width: 90 },
        { key: "customerName", header: "Customer", type: "text", width: 120 },
        { key: "date", header: "Date", type: "date", width: 70 },
        { key: "reason", header: "Reason", type: "text", width: 110 },
        { key: "taxableAmount", header: "Taxable", type: "currency", width: 80 },
        { key: "taxAmount", header: "Tax", type: "currency", width: 70 },
        { key: "totalAmount", header: "Total", type: "currency", width: 80 },
      ];

      const allSupplies = [...b2b, ...b2c];
      const meta = makeMeta("Statutory GST Report", [
        { label: "Total Invoices", value: String(summary.totalInvoices ?? allSupplies.length) },
        { label: "B2B Taxable", value: formatExportCurrency(summary.totalB2BTaxable ?? 0, true) },
        { label: "B2C Taxable", value: formatExportCurrency(summary.totalB2CTaxable ?? 0, true) },
        { label: "Total Tax", value: formatExportCurrency(summary.totalTaxAmount ?? 0, true), bold: true },
      ]);

      return {
        meta,
        primaryColumns: supplyCols,
        primaryRows: allSupplies,
        pdfSections: [
          { title: "Table 4: B2B Outward Supplies (Registered)", columns: supplyCols, rows: b2b },
          { title: "Table 5 & 7: B2C Outward Supplies (Unregistered)", columns: supplyCols, rows: b2c },
          { title: "HSN Summary", columns: hsnCols, rows: hsn },
          ...(cns.length > 0 ? [{ title: "Table 9: Credit Notes", columns: cnCols, rows: cns }] : []),
        ],
        excelSheets: [
          { name: "B2B Supplies", columns: supplyCols, rows: b2b },
          { name: "B2C Supplies", columns: supplyCols, rows: b2c },
          { name: "HSN Summary", columns: hsnCols, rows: hsn },
          { name: "Rate Breakup", columns: rateCols, rows: rates },
          { name: "Credit Notes", columns: cnCols, rows: cns },
        ],
      };
    }

    case "stock": {
      const rows = (reportData.rows || []) as Record<string, unknown>[];
      const summary = reportData.summary || {};
      const columns: ExportColumn[] = [
        { key: "sku", header: "SKU", type: "text", width: 85 },
        { key: "name", header: "Item Name", type: "text", width: 150 },
        { key: "category", header: "Category", type: "text", width: 85 },
        { key: "unitOfMeasure", header: "UOM", type: "text", width: 48 },
        { key: "onHand", header: "On Hand", type: "quantity", width: 70 },
        { key: "reserved", header: "Reserved", type: "quantity", width: 70 },
        { key: "available", header: "ATP", type: "quantity", width: 70 },
        { key: "weightedAverageCost", header: "WAC Rate", type: "currency", width: 78 },
        { key: "totalValuation", header: "Valuation", type: "currency", width: 92 },
        { key: "isReconciled", header: "Reconciled", type: "boolean", width: 58 },
      ];
      const totalsRow = {
        sku: "Total",
        onHand: numSum(rows, "onHand"),
        reserved: numSum(rows, "reserved"),
        available: numSum(rows, "available"),
        totalValuation: summary.totalValuation ?? numSum(rows, "totalValuation"),
      };
      const meta = makeMeta("Inventory Valuation", [
        { label: "Total Items", value: String(summary.totalItems ?? rows.length) },
        { label: "Total Valuation", value: formatExportCurrency(totalsRow.totalValuation, true), bold: true },
        { label: "Reconciliation", value: summary.allReconciled ? "100% Reconciled" : `${summary.unreconciledCount} Variance(s)` },
      ]);
      return {
        meta,
        primaryColumns: columns,
        primaryRows: rows,
        pdfSections: [{ columns, rows, totalsRow }],
        excelSheets: [{ name: "Stock Valuation", columns, rows, totalsRow }],
      };
    }

    case "stock-ledger": {
      const rows = (reportData.rows || []) as Record<string, unknown>[];
      const columns: ExportColumn[] = [
        { key: "postedAt", header: "Posted At", type: "datetime", width: 95 },
        { key: "sku", header: "SKU", type: "text", width: 80 },
        { key: "itemName", header: "Item Name", type: "text", width: 130 },
        { key: "uom", header: "UOM", type: "text", width: 45 },
        { key: "warehouse", header: "Warehouse", type: "text", width: 95 },
        { key: "movementType", header: "Movement", type: "text", width: 85 },
        { key: "quantity", header: "Qty", type: "quantity", width: 65 },
        { key: "unitCost", header: "Unit Cost", type: "currency", width: 75 },
        { key: "totalCost", header: "Total Cost", type: "currency", width: 85 },
        { key: "referenceType", header: "Reference", type: "text", width: 80 },
      ];
      const meta = makeMeta("Stock Movement Ledger", [
        { label: "Movements", value: String(rows.length) },
      ]);
      return {
        meta,
        primaryColumns: columns,
        primaryRows: rows,
        pdfSections: [{ columns, rows }],
        excelSheets: [{ name: "Stock Ledger", columns, rows }],
      };
    }

    case "purchase": {
      const rows = (reportData.rows || []) as Record<string, unknown>[];
      const summary = reportData.summary || {};
      const columns: ExportColumn[] = [
        { key: "receiptNumber", header: "Receipt #", type: "text", width: 85 },
        { key: "receivedAt", header: "Date", type: "date", width: 65 },
        { key: "supplierCode", header: "Supplier Code", type: "text", width: 70 },
        { key: "supplierName", header: "Supplier", type: "text", width: 120 },
        { key: "warehouseCode", header: "Warehouse", type: "text", width: 65 },
        { key: "itemSku", header: "SKU", type: "text", width: 75 },
        { key: "itemName", header: "Material", type: "text", width: 115 },
        { key: "unitOfMeasure", header: "UOM", type: "text", width: 45 },
        { key: "receivedQuantity", header: "Qty", type: "quantity", width: 65 },
        { key: "unitCost", header: "Rate", type: "currency", width: 75 },
        { key: "totalCost", header: "Total", type: "currency", width: 85 },
        { key: "status", header: "Status", type: "text", width: 65 },
      ];
      const totalsRow = {
        receiptNumber: "Total",
        receivedQuantity: summary.totalQuantity ?? numSum(rows, "receivedQuantity"),
        totalCost: summary.totalPurchaseAmount ?? numSum(rows, "totalCost"),
      };
      const meta = makeMeta("Procurement Register", [
        { label: "Receipts", value: String(summary.totalReceiptsCount ?? rows.length) },
        { label: "Total Qty", value: formatExportNumber(totalsRow.receivedQuantity, 2) },
        { label: "Total Spend", value: formatExportCurrency(totalsRow.totalCost, true), bold: true },
      ]);
      return {
        meta,
        primaryColumns: columns,
        primaryRows: rows,
        pdfSections: [{ columns, rows, totalsRow }],
        excelSheets: [{ name: "Purchase Register", columns, rows, totalsRow }],
      };
    }

    case "production": {
      const rows = (reportData.rows || []) as Record<string, any>[];
      const summary = reportData.summary || {};
      const columns: ExportColumn[] = [
        { key: "runNumber", header: "Run #", type: "text", width: 80 },
        { key: "postedAt", header: "Batch Date", type: "date", width: 68 },
        { key: "recipeName", header: "Recipe", type: "text", width: 115 },
        { key: "productName", header: "Product", type: "text", width: 115 },
        { key: "batchCount", header: "Batches", type: "number", width: 52 },
        { key: "actualGoodQty", header: "Good Qty", type: "quantity", width: 65 },
        { key: "actualRejectedQty", header: "Rejected", type: "quantity", width: 60 },
        { key: "yieldVariancePct", header: "Variance %", type: "percent", width: 65 },
        { key: "totalCost", header: "Run Cost", type: "currency", width: 82 },
        { key: "unitCost", header: "Unit Cost", type: "currency", width: 72 },
        { key: "status", header: "Status", type: "text", width: 65 },
      ];
      const totalsRow = {
        runNumber: "Total (Posted)",
        actualGoodQty: summary.totalGoodQuantity ?? numSum(rows, "actualGoodQty"),
        actualRejectedQty: summary.totalRejectedQuantity ?? numSum(rows, "actualRejectedQty"),
        totalCost: summary.totalRunCost ?? numSum(rows, "totalCost"),
      };

      const materialRows: Record<string, unknown>[] = [];
      for (const run of rows) {
        for (const m of run.materials || []) {
          materialRows.push({
            runNumber: run.runNumber,
            postedAt: run.postedAt,
            sku: m.sku,
            name: m.name,
            uom: m.uom,
            planned: m.planned,
            actual: m.actual,
            damaged: m.damaged,
            varianceQty: m.varianceQty,
            cost: m.cost,
          });
        }
      }
      const matColumns: ExportColumn[] = [
        { key: "runNumber", header: "Run #", type: "text", width: 85 },
        { key: "postedAt", header: "Date", type: "date", width: 70 },
        { key: "sku", header: "Material SKU", type: "text", width: 85 },
        { key: "name", header: "Material Name", type: "text", width: 140 },
        { key: "uom", header: "UOM", type: "text", width: 50 },
        { key: "planned", header: "Planned", type: "quantity", width: 70 },
        { key: "actual", header: "Actual", type: "quantity", width: 70 },
        { key: "damaged", header: "Damaged", type: "quantity", width: 65 },
        { key: "varianceQty", header: "Variance", type: "quantity", width: 65 },
        { key: "cost", header: "Cost", type: "currency", width: 85 },
      ];

      const meta = makeMeta("Production Report", [
        { label: "Posted Runs", value: String(summary.totalRunsCount ?? rows.length) },
        { label: "Good Output", value: formatExportNumber(totalsRow.actualGoodQty, 2) },
        { label: "Total Run Cost", value: formatExportCurrency(totalsRow.totalCost, true), bold: true },
      ]);
      return {
        meta,
        primaryColumns: columns,
        primaryRows: rows,
        pdfSections: [{ columns, rows, totalsRow }],
        excelSheets: [
          { name: "Production Runs", columns, rows, totalsRow },
          { name: "Material Consumption", columns: matColumns, rows: materialRows },
        ],
      };
    }

    case "collections": {
      const rows = (reportData.rows || []) as Record<string, any>[];
      const summary = reportData.summary || {};
      const columns: ExportColumn[] = [
        { key: "paymentNumber", header: "Payment #", type: "text", width: 90 },
        { key: "paymentDate", header: "Date", type: "date", width: 70 },
        { key: "customerCode", header: "Cust. Code", type: "text", width: 70 },
        { key: "customerName", header: "Customer", type: "text", width: 135 },
        { key: "paymentMode", header: "Mode", type: "text", width: 70 },
        { key: "referenceNumber", header: "Reference", type: "text", width: 90 },
        { key: "amount", header: "Amount", type: "currency", width: 88 },
        { key: "allocatedAmount", header: "Allocated", type: "currency", width: 88 },
        { key: "unallocatedAmount", header: "Unallocated", type: "currency", width: 88 },
        { key: "status", header: "Status", type: "text", width: 68 },
      ];
      const totalsRow = {
        paymentNumber: "Total (Posted)",
        amount: summary.totalAmount ?? numSum(rows, "amount"),
        allocatedAmount: summary.totalAllocated ?? numSum(rows, "allocatedAmount"),
        unallocatedAmount: summary.totalUnallocated ?? numSum(rows, "unallocatedAmount"),
      };

      const allocRows: Record<string, unknown>[] = [];
      for (const p of rows) {
        for (const a of p.allocations || []) {
          allocRows.push({
            paymentNumber: p.paymentNumber,
            paymentDate: p.paymentDate,
            customerName: p.customerName,
            invoiceNumber: a.invoiceNumber,
            amount: a.amount,
          });
        }
      }
      const allocCols: ExportColumn[] = [
        { key: "paymentNumber", header: "Payment #", type: "text", width: 95 },
        { key: "paymentDate", header: "Date", type: "date", width: 75 },
        { key: "customerName", header: "Customer", type: "text", width: 145 },
        { key: "invoiceNumber", header: "Invoice #", type: "text", width: 100 },
        { key: "amount", header: "Allocated Amount", type: "currency", width: 95 },
      ];

      const meta = makeMeta("Collections Register", [
        { label: "Payments", value: String(summary.totalPaymentsCount ?? rows.length) },
        { label: "Total Collected", value: formatExportCurrency(totalsRow.amount, true), bold: true },
        { label: "Unallocated", value: formatExportCurrency(totalsRow.unallocatedAmount, true) },
      ]);
      return {
        meta,
        primaryColumns: columns,
        primaryRows: rows,
        pdfSections: [{ columns, rows, totalsRow }],
        excelSheets: [
          { name: "Collections", columns, rows, totalsRow },
          { name: "Allocations", columns: allocCols, rows: allocRows },
        ],
      };
    }

    case "receivables": {
      const rawRows = (reportData.rows || []) as Record<string, any>[];
      const summary = reportData.summary || {};
      const rows = rawRows.map((r) => ({
        ...r,
        age0to30: r.ageing?.current0to30 ?? 0,
        age31to60: r.ageing?.days31to60 ?? 0,
        age61to90: r.ageing?.days61to90 ?? 0,
        ageOver90: r.ageing?.over90days ?? 0,
      }));
      const columns: ExportColumn[] = [
        { key: "customerCode", header: "Code", type: "text", width: 70 },
        { key: "customerName", header: "Customer Name", type: "text", width: 135 },
        { key: "state", header: "State", type: "text", width: 75 },
        { key: "totalInvoiced", header: "Invoiced", type: "currency", width: 82 },
        { key: "totalCreditNotes", header: "Credit Notes", type: "currency", width: 75 },
        { key: "totalPaid", header: "Collected", type: "currency", width: 82 },
        { key: "netOutstanding", header: "Outstanding", type: "currency", width: 88 },
        { key: "age0to30", header: "0-30 Days", type: "currency", width: 72 },
        { key: "age31to60", header: "31-60 Days", type: "currency", width: 72 },
        { key: "age61to90", header: "61-90 Days", type: "currency", width: 72 },
        { key: "ageOver90", header: "90+ Days", type: "currency", width: 72 },
      ];
      const totalsRow = {
        customerCode: "Total",
        totalInvoiced: summary.totalInvoiced ?? numSum(rows, "totalInvoiced"),
        totalCreditNotes: summary.totalCreditNotes ?? numSum(rows, "totalCreditNotes"),
        totalPaid: summary.totalPaid ?? numSum(rows, "totalPaid"),
        netOutstanding: summary.totalOutstanding ?? numSum(rows, "netOutstanding"),
        age0to30: summary.overallAgeing?.current0to30 ?? numSum(rows, "age0to30"),
        age31to60: summary.overallAgeing?.days31to60 ?? numSum(rows, "age31to60"),
        age61to90: summary.overallAgeing?.days61to90 ?? numSum(rows, "age61to90"),
        ageOver90: summary.overallAgeing?.over90days ?? numSum(rows, "ageOver90"),
      };
      const meta = makeMeta("Accounts Receivable & Ageing", [
        { label: "Customers", value: String(summary.totalCustomers ?? rows.length) },
        { label: "Total Invoiced", value: formatExportCurrency(totalsRow.totalInvoiced, true) },
        { label: "Total Collected", value: formatExportCurrency(totalsRow.totalPaid, true) },
        { label: "Net Outstanding", value: formatExportCurrency(totalsRow.netOutstanding, true), bold: true },
      ]);
      return {
        meta,
        primaryColumns: columns,
        primaryRows: rows,
        pdfSections: [{ columns, rows, totalsRow }],
        excelSheets: [{ name: "Receivables Ageing", columns, rows, totalsRow }],
      };
    }

    case "audit":
    default: {
      const rows = (reportData.rows || []) as Record<string, unknown>[];
      const columns: ExportColumn[] = [
        { key: "timestamp", header: "Timestamp", type: "datetime", width: 100 },
        { key: "userEmail", header: "Actor Email", type: "text", width: 130 },
        { key: "action", header: "Action", type: "text", width: 75 },
        { key: "entity", header: "Entity", type: "text", width: 85 },
        { key: "entityId", header: "Entity ID", type: "text", width: 105 },
        { key: "ipAddress", header: "IP Address", type: "text", width: 85 },
        { key: "details", header: "Details", type: "text", width: 170 },
      ];
      const meta = makeMeta("Security & Audit Log", [
        { label: "Total Events", value: String(rows.length) },
      ]);
      return {
        meta,
        primaryColumns: columns,
        primaryRows: rows,
        pdfSections: [{ columns, rows }],
        excelSheets: [{ name: "Audit Trail", columns, rows }],
      };
    }
  }
}
