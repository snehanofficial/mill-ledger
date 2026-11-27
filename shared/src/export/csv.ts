/**
 * Standardized CSV serialization with UTF-8 BOM and CWE-1236 formula-injection protection.
 */

const FORMULA_INJECTION_RE = /^[\s\u0000-\u001F]*[=+\-@\t\r]/;

/**
 * Neutralize potentially dangerous formula prefixes in untrusted string cells
 * while preserving legitimate numeric and boolean values.
 */
export function sanitizeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  }

  let str = String(value);
  if (FORMULA_INJECTION_RE.test(str)) {
    str = `'${str}`;
  }
  return str;
}

/**
 * Escape a single CSV cell per RFC 4180.
 */
export function escapeCsvCell(value: unknown): string {
  const sanitized = sanitizeCsvValue(value);
  if (sanitized === "") return "";
  if (/[",\n\r]/.test(sanitized)) {
    return `"${sanitized.replaceAll('"', '""')}"`;
  }
  return sanitized;
}

export interface SerializeCsvOptions {
  /** Prepend UTF-8 BOM (\uFEFF) for reliable Excel Unicode/INR import. Defaults to true. */
  includeBom?: boolean;
}

/**
 * Serialize headers and tabular rows into an RFC 4180 CSV string.
 */
export function serializeCsv(
  headers: string[],
  rows: unknown[][],
  options: SerializeCsvOptions = {},
): string {
  const { includeBom = true } = options;
  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(",")),
  ];
  const content = lines.join("\r\n");
  return includeBom ? `\uFEFF${content}` : content;
}
