import fs from "node:fs";

/**
 * MillLedger "Pine & Paper" Export Design System Tokens
 * Derived from docs/design/milledger-design-system.json
 */
export const EXPORT_THEME = {
  colors: {
    pine950: "#18231E",
    pine900: "#243129",
    pine800: "#34443A",
    pine700: "#4C5A52",
    pine600: "#5D6B63",
    pineAction: "#176B54",
    paper50: "#F4F3EE",
    paper100: "#ECEFE9",
    paper150: "#E8EBE5",
    zebra: "#F8F9F7",
    white: "#FFFFFF",
    borderLight: "#D8DED8",
    borderStrong: "#AAB5AC",
    success: "#176B54",
    warning: "#9A6700",
    danger: "#9E2A2B",
  },
  excelColors: {
    headerBg: "FF18231E",
    headerText: "FFFFFFFF",
    bannerBg: "FFECEFE9",
    bannerText: "FF18231E",
    subText: "FF4C5A52",
    zebraBg: "FFF8F9F7",
    totalsBg: "FFECEFE9",
    border: "FFD8DED8",
    borderStrong: "FFAAB5AC",
  },
} as const;

const DEJAVU_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
const DEJAVU_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
const DEJAVU_MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf";
const TAMIL_REGULAR =
  "/usr/share/fonts/truetype/noto/NotoSansTamil-Regular.ttf";
const TAMIL_BOLD = "/usr/share/fonts/truetype/noto/NotoSansTamil-Bold.ttf";

export interface PdfFontSet {
  regular: string;
  bold: string;
  mono: string;
  tamilRegular?: string;
  tamilBold?: string;
  supportsRupeeGlyph: boolean;
  supportsTamil: boolean;
}

export function registerPdfFonts(doc: PDFKit.PDFDocument): PdfFontSet {
  const hasDejaVu = fs.existsSync(DEJAVU_REGULAR) && fs.existsSync(DEJAVU_BOLD);
  const hasTamil = fs.existsSync(TAMIL_REGULAR) && fs.existsSync(TAMIL_BOLD);

  if (hasTamil) {
    doc.registerFont("MillTamil", TAMIL_REGULAR);
    doc.registerFont("MillTamil-Bold", TAMIL_BOLD);
  }

  if (hasDejaVu) {
    doc.registerFont("MillSans", DEJAVU_REGULAR);
    doc.registerFont("MillSans-Bold", DEJAVU_BOLD);
    if (fs.existsSync(DEJAVU_MONO)) {
      doc.registerFont("MillMono", DEJAVU_MONO);
    }
    return {
      regular: "MillSans",
      bold: "MillSans-Bold",
      mono: fs.existsSync(DEJAVU_MONO) ? "MillMono" : "MillSans",
      tamilRegular: hasTamil ? "MillTamil" : undefined,
      tamilBold: hasTamil ? "MillTamil-Bold" : undefined,
      supportsRupeeGlyph: true,
      supportsTamil: hasTamil,
    };
  }

  return {
    regular: "Helvetica",
    bold: "Helvetica-Bold",
    mono: "Courier",
    tamilRegular: hasTamil ? "MillTamil" : undefined,
    tamilBold: hasTamil ? "MillTamil-Bold" : undefined,
    supportsRupeeGlyph: false,
    supportsTamil: hasTamil,
  };
}

export function toFiniteNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  if (typeof val === "object" && val !== null && "toString" in val) {
    const n = Number(String(val).trim());
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(String(val).trim());
  return Number.isFinite(n) ? n : null;
}

export function formatExportCurrency(
  val: unknown,
  useRupeeSymbol = true,
): string {
  const num = toFiniteNumber(val);
  if (num === null) return "";
  const formatted = num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return useRupeeSymbol ? `₹${formatted}` : `INR ${formatted}`;
}

export function formatExportNumber(val: unknown, decimals = 2): string {
  const num = toFiniteNumber(val);
  if (num === null) return "";
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatExportDate(val: unknown): string {
  if (!val) return "";
  const d = val instanceof Date ? val : new Date(String(val));
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatExportDateTime(val: unknown): string {
  if (!val) return "";
  const d = val instanceof Date ? val : new Date(String(val));
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export function formatPeriodLabel(startDate?: Date, endDate?: Date): string {
  if (startDate && endDate) {
    return `${formatExportDate(startDate)} to ${formatExportDate(endDate)}`;
  }
  if (startDate) {
    return `From ${formatExportDate(startDate)}`;
  }
  if (endDate) {
    return `Up to ${formatExportDate(endDate)}`;
  }
  return "All Available Records";
}
