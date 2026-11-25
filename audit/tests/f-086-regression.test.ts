import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  getUserScopedLanguageKey,
  getSavedLanguage,
  saveUserLanguage,
} from "../../client/src/lib/i18n";

describe("F-086: Pre-Hydration HTML Lang Synchronization and User-Scoped Language Preference (WCAG 3.1.1 & FOUC Prevention)", () => {
  const indexHtmlPath = path.resolve(__dirname, "../../client/index.html");
  const i18nPath = path.resolve(__dirname, "../../client/src/lib/i18n.tsx");
  const authClientPath = path.resolve(__dirname, "../../client/src/lib/auth-client.ts");
  const layoutPath = path.resolve(__dirname, "../../client/src/layouts/authenticated-layout.tsx");

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

  it("verifies client/index.html contains inline pre-hydration script in <head> setting document.documentElement.lang", () => {
    const html = fs.readFileSync(indexHtmlPath, "utf8");
    expect(html).toMatch(/<script>[\s\S]*?var\s+activeUser\s*=\s*localStorage\.getItem\(["']mill_ledger_active_user["']\)/);
    expect(html).toMatch(/document\.documentElement\.lang\s*=\s*lang/);
  });

  it("verifies i18n library exports user-scoped language persistence utilities", () => {
    const source = fs.readFileSync(i18nPath, "utf8");
    expect(source).toMatch(/export\s+function\s+getUserScopedLanguageKey/);
    expect(source).toMatch(/export\s+function\s+getSavedLanguage/);
    expect(source).toMatch(/export\s+function\s+saveUserLanguage/);
  });

  it("verifies auth-client persists active user ID on signIn and purges on signOut", () => {
    const source = fs.readFileSync(authClientPath, "utf8");
    expect(source).toMatch(/localStorage\.setItem\(["']mill_ledger_active_user["'],\s*resolvedUser\.id\)/);
    expect(source).toMatch(/localStorage\.removeItem\(["']mill_ledger_active_user["']\)/);
  });

  it("verifies authenticated-layout synchronizes active user ID and clears on logout", () => {
    const source = fs.readFileSync(layoutPath, "utf8");
    expect(source).toMatch(/localStorage\.setItem\(["']mill_ledger_active_user["'],\s*user\.id\)/);
    expect(source).toMatch(/localStorage\.removeItem\(["']mill_ledger_active_user["']\)/);
  });

  it("guarantees independent language preferences across distinct user accounts", () => {
    // User 1: Salesman prefers Tamil
    saveUserLanguage("ta", "user-salesman-001");
    // User 2: Accountant prefers English
    saveUserLanguage("en", "user-accountant-002");

    expect(getSavedLanguage("user-salesman-001")).toBe("ta");
    expect(getSavedLanguage("user-accountant-002")).toBe("en");
  });

  it("synchronizes document.documentElement.lang immediately upon language change", () => {
    saveUserLanguage("ta", "user-001");
    expect(document.documentElement.lang).toBe("ta");
    saveUserLanguage("en", "user-001");
    expect(document.documentElement.lang).toBe("en");
  });
});
