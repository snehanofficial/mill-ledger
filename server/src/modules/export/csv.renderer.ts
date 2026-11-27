import { serializeCsv } from "@mill-ledger/shared";
import type { ExportColumn } from "./export.types.js";
import { toFiniteNumber } from "./export.theme.js";
import { translateExportLabel } from "./export.i18n.js";

function formatCsvDate(val: unknown, includeTime: boolean): string {
  if (!val) return "";
  const d = val instanceof Date ? val : new Date(String(val));
  if (Number.isNaN(d.getTime())) return String(val);

  if (!includeTime) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  }

  const datePart = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const timePart = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
  return `${datePart} ${timePart}`;
}

export function formatCsvCellValue(
  raw: unknown,
  col: ExportColumn<any>,
): unknown {
  if (raw === null || raw === undefined) return "";

  switch (col.type) {
    case "currency": {
      const n = toFiniteNumber(raw);
      return n === null ? "" : Number(n.toFixed(2));
    }
    case "quantity": {
      const n = toFiniteNumber(raw);
      return n === null ? "" : Number(n.toFixed(3));
    }
    case "number": {
      const n = toFiniteNumber(raw);
      return n === null ? "" : n;
    }
    case "percent": {
      const n = toFiniteNumber(raw);
      return n === null ? "" : Number(n.toFixed(2));
    }
    case "date":
      return formatCsvDate(raw, false);
    case "datetime":
      return formatCsvDate(raw, true);
    case "boolean":
      return raw ? "Yes" : "No";
    case "text":
    default:
      return String(raw);
  }
}

export function renderTabularCsv<T = Record<string, unknown>>(
  columns: ExportColumn<T>[],
  rows: T[],
  locale?: string | null,
): string {
  const headers = columns.map((c) => {
    const h = translateExportLabel(c.header, locale);
    return c.unit ? `${h} (${c.unit})` : h;
  });
  const csvRows = rows.map((row) =>
    columns.map((col) => {
      const raw = col.value
        ? col.value(row)
        : (row as Record<string, unknown>)[col.key];
      return formatCsvCellValue(raw, col);
    }),
  );
  return serializeCsv(headers, csvRows, { includeBom: true });
}
