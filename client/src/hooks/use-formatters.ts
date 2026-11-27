import { useLanguage } from "@/lib/i18n";
import {
  formatINR as baseFormatINR,
  formatQuantity as baseFormatQuantity,
  formatNumber as baseFormatNumber,
  formatPercent as baseFormatPercent,
  formatDate as baseFormatDate,
  formatDateShort as baseFormatDateShort,
  formatDateTime as baseFormatDateTime,
  formatTime as baseFormatTime,
  compareStrings as baseCompareStrings,
  type FormatINROptions,
  type FormatQuantityOptions,
  type FormatNumberOptions,
  type FormatDateOptions,
} from "@mill-ledger/shared";

/**
 * useFormatters
 *
 * Contextual hook providing locale-synchronized formatters and collation (F-085).
 * Automatically resolves 'ta-IN' when the UI language is Tamil, and 'en-IN' for English.
 */
export function useFormatters() {
  const { language } = useLanguage();
  const locale = language === "ta" ? "ta-IN" : "en-IN";

  return {
    language,
    locale,
    formatINR: (
      amount: Parameters<typeof baseFormatINR>[0],
      options?: FormatINROptions,
    ) => baseFormatINR(amount, { locale, ...options }),
    formatQuantity: (
      amount: Parameters<typeof baseFormatQuantity>[0],
      options?: FormatQuantityOptions,
    ) => baseFormatQuantity(amount, { locale, ...options }),
    formatNumber: (
      value: Parameters<typeof baseFormatNumber>[0],
      options?: FormatNumberOptions,
    ) => baseFormatNumber(value, { locale, ...options }),
    formatPercent: (
      value: Parameters<typeof baseFormatPercent>[0],
      options?: FormatNumberOptions,
    ) => baseFormatPercent(value, { locale, ...options }),
    formatDate: (
      date: Parameters<typeof baseFormatDate>[0],
      options?: FormatDateOptions,
    ) => baseFormatDate(date, options, locale),
    formatDateShort: (date: Parameters<typeof baseFormatDateShort>[0]) =>
      baseFormatDateShort(date, locale),
    formatDateTime: (
      date: Parameters<typeof baseFormatDateTime>[0],
      options?: FormatDateOptions,
    ) => baseFormatDateTime(date, options, locale),
    formatTime: (
      date: Parameters<typeof baseFormatTime>[0],
      options?: FormatDateOptions,
    ) => baseFormatTime(date, options, locale),
    compareStrings: (
      a: string | null | undefined,
      b: string | null | undefined,
      options?: Intl.CollatorOptions,
    ) => baseCompareStrings(a, b, locale, options),
  };
}
