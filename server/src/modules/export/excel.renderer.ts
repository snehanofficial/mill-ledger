import ExcelJS from "exceljs";
import type {
  ExportColumn,
  ExportDocumentMeta,
  ExportSummaryItem,
} from "./export.types.js";
import {
  EXPORT_THEME,
  formatExportDateTime,
  toFiniteNumber,
} from "./export.theme.js";

const FORMULA_INJECTION_RE = /^[\s\u0000-\u001F]*[=+\-@\t\r]/;

export interface ExcelSheetDefinition<T = Record<string, unknown>> {
  name: string;
  title?: string;
  subtitle?: string;
  columns: ExportColumn<T>[];
  rows: T[];
  totalsRow?: Record<string, unknown>;
  summaryItems?: ExportSummaryItem[];
}

function sanitizeExcelText(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (FORMULA_INJECTION_RE.test(str)) {
    return `'${str}`;
  }
  return str;
}

function sanitizeSheetName(name: string, used: Set<string>): string {
  const base = name.replace(/[\\/?*[\]:]/g, "-").trim().slice(0, 31) || "Sheet";
  let candidate = base;
  let idx = 2;
  while (used.has(candidate)) {
    const suffix = ` (${idx})`;
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    idx++;
  }
  used.add(candidate);
  return candidate;
}

function applyCellBorder(
  cell: ExcelJS.Cell,
  color: string = EXPORT_THEME.excelColors.border,
  topBottomStrong = false,
) {
  cell.border = {
    top: {
      style: topBottomStrong ? "medium" : "thin",
      color: { argb: topBottomStrong ? EXPORT_THEME.excelColors.borderStrong : color },
    },
    bottom: {
      style: topBottomStrong ? "double" : "thin",
      color: { argb: topBottomStrong ? EXPORT_THEME.excelColors.borderStrong : color },
    },
    left: { style: "thin", color: { argb: color } },
    right: { style: "thin", color: { argb: color } },
  };
}

function writeTypedExcelCell(
  cell: ExcelJS.Cell,
  raw: unknown,
  col: ExportColumn<any>,
) {
  if (raw === null || raw === undefined || raw === "") {
    cell.value = null;
    return;
  }

  switch (col.type) {
    case "currency": {
      const n = toFiniteNumber(raw);
      if (n !== null) {
        cell.value = n;
        cell.numFmt = '"₹"#,##,##0.00';
        cell.alignment = { horizontal: "right", vertical: "middle" };
      } else {
        cell.value = sanitizeExcelText(raw);
      }
      break;
    }
    case "quantity": {
      const n = toFiniteNumber(raw);
      if (n !== null) {
        cell.value = n;
        cell.numFmt = "#,##0.###";
        cell.alignment = { horizontal: "right", vertical: "middle" };
      } else {
        cell.value = sanitizeExcelText(raw);
      }
      break;
    }
    case "number": {
      const n = toFiniteNumber(raw);
      if (n !== null) {
        cell.value = n;
        cell.numFmt = Number.isInteger(n) ? "#,##0" : "#,##0.00";
        cell.alignment = { horizontal: "right", vertical: "middle" };
      } else {
        cell.value = sanitizeExcelText(raw);
      }
      break;
    }
    case "percent": {
      const n = toFiniteNumber(raw);
      if (n !== null) {
        cell.value = n / 100;
        cell.numFmt = "0.00%";
        cell.alignment = { horizontal: "right", vertical: "middle" };
      } else {
        cell.value = sanitizeExcelText(raw);
      }
      break;
    }
    case "date": {
      const d = raw instanceof Date ? raw : new Date(String(raw));
      if (!Number.isNaN(d.getTime())) {
        cell.value = d;
        cell.numFmt = "dd-mmm-yyyy";
        cell.alignment = { horizontal: "left", vertical: "middle" };
      } else {
        cell.value = sanitizeExcelText(raw);
      }
      break;
    }
    case "datetime": {
      const d = raw instanceof Date ? raw : new Date(String(raw));
      if (!Number.isNaN(d.getTime())) {
        cell.value = d;
        cell.numFmt = "dd-mmm-yyyy hh:mm";
        cell.alignment = { horizontal: "left", vertical: "middle" };
      } else {
        cell.value = sanitizeExcelText(raw);
      }
      break;
    }
    case "boolean": {
      cell.value = raw ? "Yes" : "No";
      cell.alignment = { horizontal: "center", vertical: "middle" };
      break;
    }
    case "text":
    default: {
      cell.value = sanitizeExcelText(raw);
      cell.alignment = {
        horizontal: col.align || "left",
        vertical: "middle",
        wrapText: true,
      };
      break;
    }
  }
}

export async function renderExcelWorkbook(
  meta: ExportDocumentMeta,
  sheets: ExcelSheetDefinition<any>[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = meta.organization?.name || "MillLedger ERP";
  workbook.created = meta.generatedAt;
  workbook.modified = meta.generatedAt;

  const usedNames = new Set<string>();

  for (const sheetDef of sheets) {
    const sheetName = sanitizeSheetName(sheetDef.name, usedNames);
    const sheet = workbook.addWorksheet(sheetName, {
      pageSetup: {
        paperSize: 9, // A4
        orientation: sheetDef.columns.length > 6 ? "landscape" : "portrait",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    });

    const colCount = Math.max(sheetDef.columns.length, 2);

    // Row 1: Organization + Document Title
    const orgParts = [
      meta.organization?.name,
      meta.organization?.gstin ? `GSTIN: ${meta.organization.gstin}` : null,
      meta.organization?.state || null,
    ].filter(Boolean);

    const titleRow = sheet.addRow([
      sheetDef.title || meta.title,
    ]);
    titleRow.font = {
      name: "Calibri",
      size: 14,
      bold: true,
      color: { argb: EXPORT_THEME.excelColors.bannerText },
    };
    titleRow.height = 24;
    if (colCount > 1) {
      sheet.mergeCells(1, 1, 1, colCount);
    }

    // Row 2: Organization & Metadata subtitle
    const metaParts = [
      orgParts.length > 0 ? orgParts.join(" | ") : null,
      meta.periodLabel ? `Period: ${meta.periodLabel}` : null,
      meta.scopeLabel ? `Scope: ${meta.scopeLabel}` : null,
      `Generated: ${formatExportDateTime(meta.generatedAt)}`,
    ].filter(Boolean);

    const subRow = sheet.addRow([
      sheetDef.subtitle || metaParts.join("  •  "),
    ]);
    subRow.font = {
      name: "Calibri",
      size: 9.5,
      color: { argb: EXPORT_THEME.excelColors.subText },
    };
    subRow.height = 18;
    if (colCount > 1) {
      sheet.mergeCells(2, 1, 2, colCount);
    }

    // Optional summary strip
    const summaryList = sheetDef.summaryItems || [];
    if (summaryList.length > 0) {
      sheet.addRow([]);
      for (const item of summaryList) {
        const sRow = sheet.addRow([item.label, item.value]);
        sRow.getCell(1).font = { name: "Calibri", size: 10, bold: true };
        sRow.getCell(2).font = {
          name: "Calibri",
          size: 10,
          bold: Boolean(item.bold),
        };
      }
    }

    // Blank separator row before table
    sheet.addRow([]);

    if (sheetDef.columns.length === 0 || sheetDef.rows.length === 0) {
      if (sheetDef.columns.length > 0) {
        const headerRow = sheet.addRow(
          sheetDef.columns.map((c) => (c.unit ? `${c.header} (${c.unit})` : c.header)),
        );
        headerRow.height = 22;
        headerRow.eachCell((cell) => {
          cell.font = {
            name: "Calibri",
            size: 10,
            bold: true,
            color: { argb: EXPORT_THEME.excelColors.headerText },
          };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: EXPORT_THEME.excelColors.headerBg },
          };
          cell.alignment = { horizontal: "left", vertical: "middle" };
        });
        sheet.views = [{ state: "frozen", ySplit: headerRow.number }];
        sheet.autoFilter = {
          from: { row: headerRow.number, column: 1 },
          to: { row: headerRow.number, column: sheetDef.columns.length },
        };
      }
      const emptyRow = sheet.addRow(["No records found for the selected criteria."]);
      emptyRow.font = { name: "Calibri", size: 10, italic: true };
      sheet.columns.forEach((col) => {
        col.width = 20;
      });
      continue;
    }

    // Table Header Row
    const headers = sheetDef.columns.map((c) =>
      c.unit ? `${c.header} (${c.unit})` : c.header,
    );
    const headerRow = sheet.addRow(headers);
    const headerRowNumber = headerRow.number;
    headerRow.height = 24;

    headerRow.eachCell((cell, colNumber) => {
      const colDef = sheetDef.columns[colNumber - 1];
      const isRight =
        colDef?.align === "right" ||
        colDef?.type === "currency" ||
        colDef?.type === "number" ||
        colDef?.type === "quantity" ||
        colDef?.type === "percent";

      cell.font = {
        name: "Calibri",
        size: 10,
        bold: true,
        color: { argb: EXPORT_THEME.excelColors.headerText },
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: EXPORT_THEME.excelColors.headerBg },
      };
      cell.alignment = {
        horizontal: isRight ? "right" : colDef?.align || "left",
        vertical: "middle",
        wrapText: true,
      };
      applyCellBorder(cell, EXPORT_THEME.excelColors.headerBg);
    });

    // Freeze header row & enable AutoFilter
    sheet.views = [{ state: "frozen", ySplit: headerRowNumber }];
    sheet.autoFilter = {
      from: { row: headerRowNumber, column: 1 },
      to: { row: headerRowNumber, column: sheetDef.columns.length },
    };

    // Track max character lengths for smart column sizing
    const maxLengths = headers.map((h) => h.length + 3);

    // Data Rows
    sheetDef.rows.forEach((rowObj, rowIdx) => {
      const excelRow = sheet.addRow([]);
      excelRow.height = 19;
      const isZebra = rowIdx % 2 === 1;

      sheetDef.columns.forEach((col, colIdx) => {
        const cell = excelRow.getCell(colIdx + 1);
        const raw = col.value
          ? col.value(rowObj)
          : (rowObj as Record<string, unknown>)[col.key];
        writeTypedExcelCell(cell, raw, col);

        cell.font = {
          name: "Calibri",
          size: 10,
          color: { argb: EXPORT_THEME.excelColors.bannerText },
        };
        if (isZebra) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: EXPORT_THEME.excelColors.zebraBg },
          };
        }
        applyCellBorder(cell);

        const displayLen =
          raw === null || raw === undefined
            ? 0
            : raw instanceof Date
              ? 14
              : String(raw).length;
        if (displayLen + 3 > maxLengths[colIdx]) {
          maxLengths[colIdx] = displayLen + 3;
        }
      });
    });

    // Optional Totals Row
    if (sheetDef.totalsRow) {
      const totalsExcelRow = sheet.addRow([]);
      totalsExcelRow.height = 22;
      sheetDef.columns.forEach((col, colIdx) => {
        const cell = totalsExcelRow.getCell(colIdx + 1);
        const val = sheetDef.totalsRow![col.key];
        if (val !== undefined) {
          writeTypedExcelCell(cell, val, col);
        } else {
          cell.value = colIdx === 0 ? "Total" : null;
        }
        cell.font = {
          name: "Calibri",
          size: 10,
          bold: true,
          color: { argb: EXPORT_THEME.excelColors.bannerText },
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: EXPORT_THEME.excelColors.totalsBg },
        };
        applyCellBorder(cell, EXPORT_THEME.excelColors.borderStrong, true);
      });
    }

    // Apply clamped column widths
    sheetDef.columns.forEach((col, idx) => {
      const computed = Math.max(
        col.width ? Math.round(col.width / 5.5) : 12,
        Math.min(42, maxLengths[idx] || 14),
      );
      sheet.getColumn(idx + 1).width = Math.max(10, Math.min(44, computed));
    });
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
