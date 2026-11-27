import { describe, it, expect } from "vitest";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  normalizeLocale,
  formatINR,
  formatQuantity,
  formatDate,
  formatNumber,
  formatPercent,
} from "@mill-ledger/shared";
import { i18n, I18N_NAMESPACES, resources, setI18nLocale } from "./index";

function collectLeafKeys(
  obj: Record<string, unknown>,
  prefix = "",
): Array<{ key: string; value: unknown }> {
  const result: Array<{ key: string; value: unknown }> = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      result.push(...collectLeafKeys(v as Record<string, unknown>, fullKey));
    } else {
      result.push({ key: fullKey, value: v });
    }
  }
  return result;
}

describe("Centralized i18next Architecture & Completeness", () => {
  it("defines en-IN and ta-IN as supported locales with en-IN fallback", () => {
    expect(SUPPORTED_LOCALES).toEqual(["en-IN", "ta-IN"]);
    expect(DEFAULT_LOCALE).toBe("en-IN");
    expect(normalizeLocale("ta")).toBe("ta-IN");
    expect(normalizeLocale("ta-IN")).toBe("ta-IN");
    expect(normalizeLocale("en")).toBe("en-IN");
    expect(normalizeLocale("en-IN")).toBe("en-IN");
    expect(normalizeLocale("fr-FR")).toBe("en-IN");
    expect(normalizeLocale(undefined)).toBe("en-IN");
  });

  it("has 100% key parity and non-empty strings between en-IN and ta-IN across all namespaces", () => {
    for (const ns of I18N_NAMESPACES) {
      const enEntries = collectLeafKeys(
        resources["en-IN"][ns] as unknown as Record<string, unknown>,
      );
      const taEntries = collectLeafKeys(
        resources["ta-IN"][ns] as unknown as Record<string, unknown>,
      );

      const enKeys = new Set(enEntries.map((e) => e.key));
      const taKeys = new Set(taEntries.map((e) => e.key));

      for (const { key, value } of enEntries) {
        expect(
          taKeys.has(key),
          `Missing ta-IN translation for ${ns}:${key}`,
        ).toBe(true);
        expect(typeof value).toBe("string");
        expect(
          String(value).trim().length,
          `Empty en-IN value for ${ns}:${key}`,
        ).toBeGreaterThan(0);
      }

      for (const { key, value } of taEntries) {
        expect(
          enKeys.has(key),
          `Extra ta-IN key ${ns}:${key} missing in en-IN`,
        ).toBe(true);
        expect(typeof value).toBe("string");
        expect(
          String(value).trim().length,
          `Empty ta-IN value for ${ns}:${key}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("switches i18next language dynamically without reload", async () => {
    await setI18nLocale("ta-IN");
    expect(i18n.language).toBe("ta-IN");
    expect(i18n.t("common:actions.save")).toBe("சேமி");

    await setI18nLocale("en-IN");
    expect(i18n.language).toBe("en-IN");
    expect(i18n.t("common:actions.save")).toBe("Save");
  });

  it("retains Latin digits, INR currency symbol, and Gregorian dates in ta-IN", () => {
    const inrTa = formatINR(125000.5, { locale: "ta-IN" });
    expect(inrTa).toContain("₹");
    expect(inrTa).toMatch(/[0-9]/);
    expect(inrTa).not.toMatch(/[\u0BE6-\u0BEF]/);

    const qtyTa = formatQuantity(250.5, { locale: "ta-IN", unit: "kg" });
    expect(qtyTa).toContain("250.5");

    const numTa = formatNumber(12345.67, { locale: "ta-IN" });
    expect(numTa).toBe("12,345.67");

    const pctTa = formatPercent(18, { locale: "ta-IN" });
    expect(pctTa).toContain("18");

    const dateTa = formatDate("2026-04-01T10:00:00Z", undefined, "ta-IN");
    expect(dateTa).toContain("2026");
  });
});
