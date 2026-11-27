/**
 * Canonical Currency and Date/Time Formatters for MillLedger.
 * Adheres to Indian Accounting ERP standards (en-IN and ta-IN locale, Section 170 CGST Act, UTS #10 UCA).
 */

export interface FormatINROptions {
  symbol?: boolean;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  fallback?: string;
  locale?: string;
  lang?: "en" | "ta";
}

export interface FormatQuantityOptions {
  unit?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  fallback?: string;
  locale?: string;
  lang?: "en" | "ta";
}

export interface FormatDateOptions extends Intl.DateTimeFormatOptions {
  locale?: string;
  lang?: "en" | "ta";
}

const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  year: "numeric",
};

const DEFAULT_DATETIME_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
};

const DEFAULT_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
};

/**
 * Format a number, string, or Decimal-like value into Indian Rupees (INR)
 * following Indian grouping standards (Lakhs, Crores) with 2 decimal places.
 * Example: 100000 -> ₹1,00,000.00
 */
const numberFormatCache = new Map<string, Intl.NumberFormat>();
const dateFormatCache = new Map<string, Intl.DateTimeFormat>();

function getNumberFormatter(
  locale: string,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = `${locale}|${options.style ?? ""}|${options.currency ?? ""}|${options.minimumFractionDigits ?? ""}|${options.maximumFractionDigits ?? ""}`;
  let formatter = numberFormatCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    numberFormatCache.set(key, formatter);
  }
  return formatter;
}

function getDateFormatter(
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = dateFormatCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    dateFormatCache.set(key, formatter);
  }
  return formatter;
}

export function formatINR(
  amount: number | string | { toString(): string } | null | undefined,
  options: FormatINROptions = {},
): string {
  const {
    symbol = true,
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    fallback = "₹0.00",
    locale,
    lang,
  } = options;

  if (amount === null || amount === undefined) {
    return symbol ? fallback : "0.00";
  }

  let num: number;
  if (typeof amount === "number") {
    num = amount;
  } else if (typeof amount === "string") {
    num = Number(amount.trim());
  } else if (
    typeof amount === "object" &&
    typeof amount.toString === "function"
  ) {
    num = Number(amount.toString().trim());
  } else {
    num = Number(amount);
  }

  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return symbol ? fallback : "0.00";
  }

  const resolvedLocale =
    lang === "ta" || locale === "ta" || locale === "ta-IN"
      ? "ta-IN"
      : locale || "en-IN";

  if (symbol) {
    return getNumberFormatter(resolvedLocale, {
      style: "currency",
      currency: "INR",
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(num);
  }

  return getNumberFormatter(resolvedLocale, {
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
  options: FormatQuantityOptions = {},
): string {
  const {
    unit,
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
    fallback = "0",
    locale,
    lang,
  } = options;

  if (amount === null || amount === undefined) {
    return unit ? `${fallback} ${unit}` : fallback;
  }

  let num: number;
  if (typeof amount === "number") {
    num = amount;
  } else if (typeof amount === "string") {
    num = Number(amount.trim());
  } else if (
    typeof amount === "object" &&
    typeof amount.toString === "function"
  ) {
    num = Number(amount.toString().trim());
  } else {
    num = Number(amount);
  }

  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return unit ? `${fallback} ${unit}` : fallback;
  }

  const resolvedLocale =
    lang === "ta" || locale === "ta" || locale === "ta-IN"
      ? "ta-IN"
      : locale || "en-IN";

  const formatted = getNumberFormatter(resolvedLocale, {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(num);

  return unit ? `${formatted} ${unit}` : formatted;
}

/**
 * Format a date into Indian standard format (DD MMM YYYY, e.g. 01 Apr 2026 or 01 ஏப்., 2026).
 */
export function formatDate(
  date: string | Date | number | null | undefined,
  options: FormatDateOptions = DEFAULT_DATE_OPTIONS,
  localeParam: string = "en-IN",
): string {
  if (!date) return "—";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "—";

  const rawLocale =
    options.locale ||
    (options.lang === "ta" ? "ta-IN" : undefined) ||
    localeParam;
  const resolvedLocale =
    rawLocale === "ta" || rawLocale === "ta-IN"
      ? "ta-IN"
      : rawLocale || "en-IN";

  const {
    locale: _l,
    lang: _lg,
    ...dtOptions
  } = { ...DEFAULT_DATE_OPTIONS, ...options };
  return getDateFormatter(resolvedLocale, dtOptions).format(d);
}

/**
 * Format a date into short Indian standard format (DD/MM/YYYY, e.g. 01/04/2026).
 */
export function formatDateShort(
  date: string | Date | number | null | undefined,
  localeParam: string = "en-IN",
): string {
  return formatDate(
    date,
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    },
    localeParam,
  );
}

/**
 * Format date and time in Indian Standard Time (IST) convention.
 */
export function formatDateTime(
  date: string | Date | number | null | undefined,
  options: FormatDateOptions = DEFAULT_DATETIME_OPTIONS,
  localeParam: string = "en-IN",
): string {
  const mergedOptions = { ...DEFAULT_DATETIME_OPTIONS, ...options };
  return formatDate(date, mergedOptions, localeParam);
}

/**
 * Format time in Indian convention (e.g. 03:30 pm).
 */
export function formatTime(
  date: string | Date | number | null | undefined,
  options: FormatDateOptions = DEFAULT_TIME_OPTIONS,
  localeParam: string = "en-IN",
): string {
  const mergedOptions = { ...DEFAULT_TIME_OPTIONS, ...options };
  return formatDate(date, mergedOptions, localeParam);
}

/**
 * Collate (compare) two strings using language-aware Unicode Collation (UCA - UTS #10).
 * Handles Tamil ('ta' / 'ta-IN') and English ('en' / 'en-IN') linguistic collation.
 */
export function compareStrings(
  a: string | null | undefined,
  b: string | null | undefined,
  locale: string = "en-IN",
  options: Intl.CollatorOptions = { sensitivity: "base", numeric: true },
): number {
  const strA = a ?? "";
  const strB = b ?? "";
  const resolvedLocale =
    locale === "ta" || locale === "ta-IN" ? "ta-IN" : locale || "en-IN";
  return strA.localeCompare(strB, resolvedLocale, options);
}
