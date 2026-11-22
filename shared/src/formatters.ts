/**
 * Canonical Currency and Date/Time Formatters for MillLedger.
 * Adheres to Indian Accounting ERP standards (en-IN locale, Section 170 CGST Act).
 */

export interface FormatINROptions {
  symbol?: boolean;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  fallback?: string;
}

export interface FormatQuantityOptions {
  unit?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  fallback?: string;
}

/**
 * Format a number, string, or Decimal-like value into Indian Rupees (INR)
 * following Indian grouping standards (Lakhs, Crores) with 2 decimal places.
 * Example: 100000 -> ₹1,00,000.00
 */
export function formatINR(
  amount: number | string | { toString(): string } | null | undefined,
  options: FormatINROptions = {}
): string {
  const {
    symbol = true,
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    fallback = "₹0.00",
  } = options;

  if (amount === null || amount === undefined) {
    return symbol ? fallback : "0.00";
  }

  let num: number;
  if (typeof amount === "number") {
    num = amount;
  } else if (typeof amount === "string") {
    num = Number(amount.trim());
  } else if (typeof amount === "object" && typeof amount.toString === "function") {
    num = Number(amount.toString().trim());
  } else {
    num = Number(amount);
  }

  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return symbol ? fallback : "0.00";
  }

  if (symbol) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(num);
  }

  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(num);
}

/**
 * Format a discrete quantity or count with Indian number grouping.
 * Example: 100000, unit "pkts" -> "1,00,000 pkts"
 */
export function formatQuantity(
  amount: number | string | { toString(): string } | null | undefined,
  options: FormatQuantityOptions = {}
): string {
  const {
    unit,
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
    fallback = "0",
  } = options;

  if (amount === null || amount === undefined) {
    return unit ? `${fallback} ${unit}` : fallback;
  }

  let num: number;
  if (typeof amount === "number") {
    num = amount;
  } else if (typeof amount === "string") {
    num = Number(amount.trim());
  } else if (typeof amount === "object" && typeof amount.toString === "function") {
    num = Number(amount.toString().trim());
  } else {
    num = Number(amount);
  }

  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return unit ? `${fallback} ${unit}` : fallback;
  }

  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(num);

  return unit ? `${formatted} ${unit}` : formatted;
}

/**
 * Format a date into Indian standard format (DD MMM YYYY, e.g. 01 Apr 2026).
 */
export function formatDate(
  date: string | Date | number | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }
): string {
  if (!date) return "—";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", options).format(d);
}

/**
 * Format a date into short Indian standard format (DD/MM/YYYY, e.g. 01/04/2026).
 */
export function formatDateShort(
  date: string | Date | number | null | undefined
): string {
  return formatDate(date, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Format date and time in Indian Standard Time (IST) convention.
 */
export function formatDateTime(
  date: string | Date | number | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }
): string {
  return formatDate(date, options);
}

/**
 * Format time in Indian convention (e.g. 03:30 pm).
 */
export function formatTime(
  date: string | Date | number | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }
): string {
  return formatDate(date, options);
}
