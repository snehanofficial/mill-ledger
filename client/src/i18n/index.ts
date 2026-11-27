import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  normalizeLocale,
  type SupportedLocale,
} from "@mill-ledger/shared";
import { DEFAULT_NS, I18N_NAMESPACES, resources } from "./resources";
import "./types";

const isDev =
  typeof import.meta !== "undefined" && Boolean(import.meta.env?.DEV);

const missingKeysLogged = new Set<string>();

function readInitialLocale(): SupportedLocale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const activeUser = localStorage.getItem("mill_ledger_active_user");
    const userScoped = activeUser
      ? localStorage.getItem(`mill_ledger_lang_${activeUser}`)
      : null;
    const raw =
      userScoped ||
      localStorage.getItem("mill_ledger_locale") ||
      localStorage.getItem("mill_ledger_lang");
    return normalizeLocale(raw, DEFAULT_LOCALE);
  } catch {
    return DEFAULT_LOCALE;
  }
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: readInitialLocale(),
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: [...SUPPORTED_LOCALES],
    ns: [...I18N_NAMESPACES],
    defaultNS: DEFAULT_NS,
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
    saveMissing: isDev,
    missingKeyHandler: (lngs, ns, key) => {
      if (!isDev) return;
      const sig = `${lngs.join(",")}:${ns}:${key}`;
      if (!missingKeysLogged.has(sig)) {
        missingKeysLogged.add(sig);
        console.warn(`[i18n] Missing translation key: ${sig}`);
      }
    },
  });
}

export async function setI18nLocale(locale: SupportedLocale): Promise<void> {
  const normalized = normalizeLocale(locale);
  if (i18n.language !== normalized) {
    await i18n.changeLanguage(normalized);
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = normalized;
  }
}

export { i18n };
export {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  normalizeLocale,
  type SupportedLocale,
};
export { I18N_NAMESPACES, DEFAULT_NS, resources };
