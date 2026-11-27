export const SUPPORTED_LOCALES = ["en-IN", "ta-IN"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export type ShortLanguageCode = "en" | "ta";

export const DEFAULT_LOCALE: SupportedLocale = "en-IN";

export const LOCALE_LABELS: Record<
  SupportedLocale,
  { native: string; english: string; short: string }
> = {
  "en-IN": {
    native: "English",
    english: "English (India)",
    short: "EN",
  },
  "ta-IN": {
    native: "தமிழ்",
    english: "Tamil (India)",
    short: "தமிழ்",
  },
};

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return (
    typeof value === "string" &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

export function normalizeLocale(
  value?: string | null,
  fallback: SupportedLocale = DEFAULT_LOCALE,
): SupportedLocale {
  if (!value || typeof value !== "string") return fallback;
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  if (lower === "ta" || lower === "ta-in" || lower.startsWith("ta-")) {
    return "ta-IN";
  }
  if (lower === "en" || lower === "en-in" || lower.startsWith("en-")) {
    return "en-IN";
  }
  return fallback;
}

export function localeToShortCode(locale: SupportedLocale): ShortLanguageCode {
  return locale === "ta-IN" ? "ta" : "en";
}

export function shortCodeToLocale(
  code?: string | null,
): SupportedLocale {
  return normalizeLocale(code);
}
