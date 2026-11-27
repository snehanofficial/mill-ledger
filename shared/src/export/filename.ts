/**
 * Standardized, filesystem-safe export filename builder.
 */

export type ExportFileExtension = "pdf" | "xlsx" | "csv" | "json";

export interface BuildExportFilenameOptions {
  orgName?: string | null;
  module: string;
  identifier?: string | null;
  date?: Date | string;
  extension: ExportFileExtension;
}

function sanitizeSegment(input: string): string {
  return input
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

function formatFilenameDate(date?: Date | string): string {
  const d = date ? new Date(date) : new Date();
  if (Number.isNaN(d.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Build a predictable, filesystem-safe export filename.
 * - Single-document exports with a document identifier: `INV-2026-0001.pdf`
 * - Tabular / report exports: `MillLedger_Sales_Register_2026-11-27.xlsx`
 */
export function buildExportFilename(
  options: BuildExportFilenameOptions,
): string {
  const ext = options.extension.toLowerCase();
  const safeId = options.identifier ? sanitizeSegment(options.identifier) : "";

  if (safeId && !options.module) {
    return `${safeId}.${ext}`;
  }

  const orgPrefix =
    sanitizeSegment(options.orgName || "MillLedger") || "MillLedger";
  const shortOrg = orgPrefix.split("_")[0] || "MillLedger";
  const mod = sanitizeSegment(options.module) || "Export";
  const datePart = formatFilenameDate(options.date);

  if (safeId) {
    return `${shortOrg}_${mod}_${safeId}_${datePart}.${ext}`;
  }
  return `${shortOrg}_${mod}_${datePart}.${ext}`;
}
