/* oxlint-disable react/only-export-components */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import {
  DEFAULT_LOCALE,
  localeToShortCode,
  normalizeLocale,
  type ShortLanguageCode,
  type SupportedLocale,
} from "@mill-ledger/shared";
import { i18n, resources, setI18nLocale } from "@/i18n";
import { apiClient } from "@/lib/api-client";

export type Language = ShortLanguageCode;

export interface Translations {
  [key: string]: {
    en: string;
    ta: string;
  };
}

/**
 * Legacy flat dictionary index built from i18next resources so any existing
 * callers or tests using `dictionary[key]` or `translate(key, fallback, lang)`
 * continue to resolve from the single i18next source of truth.
 */
function buildFlatDictionary(): Translations {
  const flat: Translations = {};
  const enCommon = resources["en-IN"].common;
  const taCommon = resources["ta-IN"].common;
  const enNav = resources["en-IN"].navigation;
  const taNav = resources["ta-IN"].navigation;
  const enDash = resources["en-IN"].dashboard;
  const taDash = resources["ta-IN"].dashboard;
  const enProd = resources["en-IN"].production;
  const taProd = resources["ta-IN"].production;
  const enInv = resources["en-IN"].inventory;
  const taInv = resources["ta-IN"].inventory;
  const enOrders = resources["en-IN"].orders;
  const taOrders = resources["ta-IN"].orders;
  const enFin = resources["en-IN"].finance;
  const taFin = resources["ta-IN"].finance;
  const enPurch = resources["en-IN"].purchases;
  const taPurch = resources["ta-IN"].purchases;
  const enRep = resources["en-IN"].reports;
  const taRep = resources["ta-IN"].reports;

  const mapSection = (
    prefix: string,
    enObj: Record<string, unknown>,
    taObj: Record<string, unknown>,
  ) => {
    for (const [k, v] of Object.entries(enObj)) {
      if (typeof v !== "string") continue;
      const snake = k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
      const taVal = taObj[k];
      flat[`${prefix}.${snake}`] = {
        en: v,
        ta: typeof taVal === "string" ? taVal : v,
      };
    }
  };

  mapSection("nav", enNav.items, taNav.items);
  mapSection("nav", enNav.sections, taNav.sections);
  mapSection("status", enCommon.status, taCommon.status);
  mapSection("action", enCommon.actions, taCommon.actions);
  mapSection("term", enCommon.terms, taCommon.terms);
  mapSection("term", enCommon.uoms, taCommon.uoms);
  mapSection("role", enCommon.roles, taCommon.roles);
  mapSection("dashboard", enDash, taDash);
  mapSection("prod", enProd, taProd);
  mapSection("stock", enInv, taInv);
  mapSection("orders", enOrders, taOrders);
  mapSection("invoices", enFin.invoices, taFin.invoices);
  mapSection("dispatch", enFin.dispatch, taFin.dispatch);
  mapSection("payments", enFin.payments, taFin.payments);
  mapSection("purchases", enPurch, taPurch);
  mapSection("reports", enRep, taRep);
  mapSection("outbox", enCommon.outbox, taCommon.outbox);

  // Preserve exact operational commodity & legacy keys
  flat["term.murukku"] = { en: "Murukku 200 g", ta: "முறுக்கு 200 கி" };
  flat["term.flour"] = { en: "Flour", ta: "மாவு" };
  flat["term.raw_rice_flour"] = {
    en: "Raw Rice Flour",
    ta: "பச்சரிசி மாவு",
  };
  flat["term.oil"] = { en: "Oil", ta: "எண்ணெய்" };
  flat["term.refined_palm_oil"] = {
    en: "Refined Palm Oil",
    ta: "சுத்திகரிக்கப்பட்ட பாமாயில்",
  };
  flat["term.salt"] = { en: "Salt", ta: "உப்பு" };
  flat["term.salt_spices"] = { en: "Salt & Spices", ta: "உப்பு & மசாலா" };
  flat["term.packaging_pouch"] = {
    en: "Packaging pouch",
    ta: "பேக்கிங் கவர்",
  };
  flat["term.carton_box"] = { en: "Carton box", ta: "அட்டைப்பெட்டி" };
  flat["term.packet"] = { en: "Packet", ta: "பாக்கெட்" };
  flat["term.packets"] = { en: "Packets", ta: "பாக்கெட்டுகள்" };
  flat["term.carton"] = { en: "Carton", ta: "பெட்டி" };
  flat["term.cartons"] = { en: "Cartons", ta: "பெட்டிகள்" };
  flat["term.kg"] = { en: "kg", ta: "கிலோ" };
  flat["term.liter"] = { en: "L", ta: "லிட்டர்" };
  flat["term.pcs"] = { en: "Pcs", ta: "எண்ணிக்கை" };
  flat["common.loading"] = {
    en: enCommon.states.loading,
    ta: taCommon.states.loading,
  };
  flat["common.no_records"] = {
    en: enCommon.states.noRecords,
    ta: taCommon.states.noRecords,
  };
  flat["common.no_orders"] = {
    en: enOrders.noOrders,
    ta: taOrders.noOrders,
  };
  flat["common.no_invoices"] = {
    en: enDash.noInvoices,
    ta: taDash.noInvoices,
  };
  flat["common.no_runs"] = {
    en: enProd.noRuns,
    ta: taProd.noRuns,
  };
  flat["common.recent_invoices"] = {
    en: enDash.recentInvoices,
    ta: taDash.recentInvoices,
  };
  flat["common.active_batches"] = {
    en: enDash.activeProductionBatches,
    ta: taDash.activeProductionBatches,
  };
  flat["kpi.receivables_outstanding"] = {
    en: enDash.receivablesOutstanding,
    ta: taDash.receivablesOutstanding,
  };
  flat["kpi.stock_valuation"] = {
    en: enDash.stockValuation,
    ta: taDash.stockValuation,
  };
  flat["kpi.production_output"] = {
    en: enDash.productionOutput,
    ta: taDash.productionOutput,
  };
  flat["kpi.collections"] = {
    en: enDash.collections,
    ta: taDash.collections,
  };
  flat["kpi.active_batches"] = {
    en: enDash.activeBatches,
    ta: taDash.activeBatches,
  };
  flat["kpi.ledger_balanced"] = {
    en: enDash.ledgerBalanced,
    ta: taDash.ledgerBalanced,
  };
  flat["kpi.discrepancy_flagged"] = {
    en: enDash.discrepancyFlagged,
    ta: taDash.discrepancyFlagged,
  };
  flat["kpi.pending_orders"] = {
    en: enDash.pendingOrders,
    ta: taDash.pendingOrders,
  };
  flat["shell.search_placeholder"] = {
    en: enCommon.shell.searchPlaceholder,
    ta: taCommon.shell.searchPlaceholder,
  };
  flat["shell.search_records"] = {
    en: enCommon.shell.searchRecords,
    ta: taCommon.shell.searchRecords,
  };
  flat["shell.pause_motion"] = {
    en: enCommon.shell.pauseMotion,
    ta: taCommon.shell.pauseMotion,
  };
  flat["shell.resume_motion"] = {
    en: enCommon.shell.resumeMotion,
    ta: taCommon.shell.resumeMotion,
  };

  return flat;
}

export const dictionary: Translations = buildFlatDictionary();

const englishIndex = new Map<string, { en: string; ta: string }>();
for (const entry of Object.values(dictionary)) {
  englishIndex.set(entry.en.toLowerCase().trim(), entry);
}

/**
 * Pure translation function supporting i18next keys, legacy flat keys,
 * exact English phrase matching, and graceful fallback.
 */
export function translate(
  key: string,
  fallback?: string,
  language: Language = "en",
): string {
  const targetLocale: SupportedLocale = language === "ta" ? "ta-IN" : "en-IN";
  if (i18n.exists(key, { lng: targetLocale })) {
    const res = (
      i18n.t as unknown as (k: string, opts: { lng: SupportedLocale }) => string
    )(key, { lng: targetLocale });
    if (typeof res === "string" && res !== key) {
      return res;
    }
  }
  const direct = dictionary[key];
  if (direct) {
    return direct[language] || fallback || key;
  }
  const byEnglish = englishIndex.get(key.toLowerCase().trim());
  if (byEnglish) {
    return byEnglish[language] || fallback || key;
  }
  if (fallback) {
    const fallbackEntry = englishIndex.get(fallback.toLowerCase().trim());
    if (fallbackEntry) {
      return fallbackEntry[language] || fallback;
    }
  }
  return fallback || key;
}

interface LanguageContextType {
  language: Language;
  locale: SupportedLocale;
  setLanguage: (lang: Language) => void;
  setLocale: (locale: SupportedLocale) => Promise<void>;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  locale: DEFAULT_LOCALE,
  setLanguage: () => {},
  setLocale: async () => {},
  t: (key, fallback) => fallback || key,
});

export function getUserScopedLanguageKey(userId?: string | null): string {
  if (userId) return `mill_ledger_lang_${userId}`;
  if (typeof window !== "undefined") {
    const activeUser = localStorage.getItem("mill_ledger_active_user");
    if (activeUser) return `mill_ledger_lang_${activeUser}`;
  }
  return "mill_ledger_lang";
}

export function getSavedLanguage(userId?: string | null): Language {
  if (typeof window === "undefined") return "en";
  try {
    const key = getUserScopedLanguageKey(userId);
    const saved = localStorage.getItem(key);
    if (saved) {
      return localeToShortCode(normalizeLocale(saved));
    }
    const localeSaved = localStorage.getItem("mill_ledger_locale");
    if (localeSaved) {
      return localeToShortCode(normalizeLocale(localeSaved));
    }
    const fallback = localStorage.getItem("mill_ledger_lang");
    if (fallback) {
      return localeToShortCode(normalizeLocale(fallback));
    }
  } catch {
    // ignore storage errors
  }
  return "en";
}

export function saveUserLanguage(
  lang: Language | SupportedLocale,
  userId?: string | null,
): void {
  if (typeof window === "undefined") return;
  try {
    const normalizedLocale = normalizeLocale(lang);
    const short = localeToShortCode(normalizedLocale);
    const key = getUserScopedLanguageKey(userId);
    localStorage.setItem(key, short);
    localStorage.setItem("mill_ledger_lang", short);
    localStorage.setItem("mill_ledger_locale", normalizedLocale);
    document.documentElement.lang = normalizedLocale;
  } catch {
    // ignore storage errors
  }
}

function LanguageContextBridge({
  children,
  userId,
  preferredLanguage,
}: {
  children: ReactNode;
  userId?: string | null;
  preferredLanguage?: SupportedLocale | null;
}) {
  const { i18n: i18nInstance } = useTranslation();
  const [locale, setLocaleState] = useState<SupportedLocale>(() => {
    if (preferredLanguage) return normalizeLocale(preferredLanguage);
    return normalizeLocale(getSavedLanguage(userId));
  });

  // Sync when authenticated user or their server preference changes
  useEffect(() => {
    const nextLocale = preferredLanguage
      ? normalizeLocale(preferredLanguage)
      : normalizeLocale(getSavedLanguage(userId));

    setLocaleState(nextLocale);
    saveUserLanguage(nextLocale, userId);
    void setI18nLocale(nextLocale);
  }, [userId, preferredLanguage]);

  const setLocale = useCallback(
    async (next: SupportedLocale) => {
      const normalized = normalizeLocale(next);
      setLocaleState(normalized);
      saveUserLanguage(normalized, userId);
      await setI18nLocale(normalized);

      if (userId) {
        try {
          await apiClient.patch("/me/preferences", {
            preferredLanguage: normalized,
          });
        } catch {
          // Local preference is already updated; backend sync failure is non-fatal
        }
      }
    },
    [userId],
  );

  const setLanguage = useCallback(
    (lang: Language) => {
      void setLocale(normalizeLocale(lang));
    },
    [setLocale],
  );

  const language: Language = localeToShortCode(locale);

  const t = useCallback(
    (key: string, fallback?: string): string => {
      if (i18nInstance.exists(key, { lng: locale })) {
        const res = (
          i18nInstance.t as unknown as (
            k: string,
            opts: { lng: SupportedLocale },
          ) => string
        )(key, { lng: locale });
        if (typeof res === "string" && res !== key) {
          return res;
        }
      }
      return translate(key, fallback, language);
    },
    [i18nInstance, locale, language],
  );

  return (
    <LanguageContext.Provider
      value={{ language, locale, setLanguage, setLocale, t }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function LanguageProvider({
  children,
  userId,
  preferredLanguage,
}: {
  children: ReactNode;
  userId?: string | null;
  preferredLanguage?: SupportedLocale | null;
}) {
  return (
    <I18nextProvider i18n={i18n}>
      <LanguageContextBridge
        userId={userId}
        preferredLanguage={preferredLanguage}
      >
        {children}
      </LanguageContextBridge>
    </I18nextProvider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

/**
 * LangPart: Inline language of parts wrapper (WCAG 2.2 SC 3.1.2 Level AA / F-060)
 * Wraps foreign words, phrases, or script switchers with explicit `lang` tag.
 */
export function LangPart({
  lang,
  children,
  className,
}: {
  lang: Language | SupportedLocale;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span lang={lang} className={className}>
      {children}
    </span>
  );
}
