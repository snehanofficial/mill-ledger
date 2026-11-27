import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  dictionary,
  translate,
  getUserScopedLanguageKey,
  getSavedLanguage,
  saveUserLanguage,
} from "./i18n";

describe("i18n Translation Dictionary", () => {
  it("provides valid English and Tamil translations for key navigation routes", () => {
    expect(dictionary["nav.dashboard"]).toBeDefined();
    expect(dictionary["nav.dashboard"].en).toBe("Dashboard");
    expect(dictionary["nav.dashboard"].ta).toBe("முகப்பு");

    expect(dictionary["nav.orders"].en).toBe("Orders");
    expect(dictionary["nav.orders"].ta).toBe("விற்பனை ஆணைகள்");

    expect(dictionary["nav.stock"].en).toBe("Stock");
    expect(dictionary["nav.stock"].ta).toBe("சரக்கு இருப்பு");
  });

  it("contains operational status translations for offline and sync states", () => {
    expect(dictionary["status.live"].en).toBe("Live");
    expect(dictionary["status.offline"].en).toBe("Offline");
    expect(dictionary["status.syncing"].en).toBe("Syncing");
    expect(dictionary["status.synced"].en).toBe("Synced");
    expect(dictionary["status.conflict"].en).toBe("Conflict");

    expect(dictionary["status.live"].ta).toBe("இணைப்பில்");
    expect(dictionary["status.offline"].ta).toBe("இணைப்பற்ற நிலை");
  });

  it("provides Tamil translations for operational mill commodities and UOMs", () => {
    expect(dictionary["term.murukku"].ta).toBe("முறுக்கு 200 கி");
    expect(dictionary["term.flour"].ta).toBe("மாவு");
    expect(dictionary["term.oil"].ta).toBe("எண்ணெய்");
    expect(dictionary["term.kg"].ta).toBe("கிலோ");
  });

  it("translates common English table headers and operational phrases to authentic Tamil unicode", () => {
    const phrases = [
      "Order number",
      "Invoice number",
      "Run number",
      "Batch number",
      "Customer",
      "Supplier",
      "Salesman",
      "Quantity",
      "Taxable",
      "GST",
      "Total",
      "Shortage status",
      "Actions",
      "SKU",
      "Item Name",
      "Category",
      "On Hand",
      "Avg Unit Cost",
      "Total Value",
      "Ledger Status",
      "Good packets",
      "Damaged packets",
      "Yield variance",
      "Materials cost",
      "Total cost",
      "Cost / packet",
      "Place of supply",
      "Outstanding",
      "HSN",
      "Qty",
      "Rate",
      "Date",
      "Status",
    ];

    const tamilUnicodeRegex = /[\u0B80-\u0BFF]/;

    for (const phrase of phrases) {
      const translated = translate(phrase, phrase, "ta");
      expect(
        tamilUnicodeRegex.test(translated),
        `Expected phrase "${phrase}" to translate to Tamil unicode, got "${translated}"`,
      ).toBe(true);
    }
  });

  it("translates navigation groups, items, and shell actions into Tamil", () => {
    expect(translate("Overview", "Overview", "ta")).toBe("முகப்பு");
    expect(translate("Operations", "Operations", "ta")).toBe("செயல்பாடுகள்");
    expect(translate("Inventory", "Inventory", "ta")).toBe("சரக்கு மேலாண்மை");
    expect(translate("Reporting", "Reporting", "ta")).toBe("அறிக்கையிடல்");
    expect(translate("Settings", "Settings", "ta")).toBe("அமைப்புகள்");
    expect(translate("Sign out", "Sign out", "ta")).toBe("வெளியேறு");
    expect(translate("Refresh", "Refresh", "ta")).toBe("புதுப்பி");
  });

  describe("F-086: User-Scoped Language Preference and Storage Keying", () => {
    const store = new Map<string, string>();
    const mockStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, val: string) => store.set(key, val),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
    };
    const mockDocument = {
      documentElement: { lang: "en" },
    };

    beforeEach(() => {
      store.clear();
      mockDocument.documentElement.lang = "en";
      (globalThis as any).window = globalThis;
      (globalThis as any).localStorage = mockStorage;
      (globalThis as any).document = mockDocument;
    });

    afterEach(() => {
      delete (globalThis as any).window;
      delete (globalThis as any).localStorage;
      delete (globalThis as any).document;
    });

    it("scopes storage key to user ID when provided", () => {
      expect(getUserScopedLanguageKey("user-123")).toBe(
        "mill_ledger_lang_user-123",
      );
    });

    it("falls back to active user from localStorage if userId param omitted", () => {
      localStorage.setItem("mill_ledger_active_user", "session-user-999");
      expect(getUserScopedLanguageKey()).toBe(
        "mill_ledger_lang_session-user-999",
      );
    });

    it("falls back to global key if no active user exists", () => {
      expect(getUserScopedLanguageKey()).toBe("mill_ledger_lang");
    });

    it("saves and retrieves user-scoped language preferences independently", () => {
      saveUserLanguage("ta", "user-tamil");
      saveUserLanguage("en", "user-english");

      expect(getSavedLanguage("user-tamil")).toBe("ta");
      expect(getSavedLanguage("user-english")).toBe("en");
      expect(localStorage.getItem("mill_ledger_lang_user-tamil")).toBe("ta");
      expect(localStorage.getItem("mill_ledger_lang_user-english")).toBe("en");
    });

    it("updates document.documentElement.lang when saving user language", () => {
      saveUserLanguage("ta", "user-tamil");
      expect(document.documentElement.lang).toBe("ta");
      saveUserLanguage("en", "user-english");
      expect(document.documentElement.lang).toBe("en");
    });
  });
});
