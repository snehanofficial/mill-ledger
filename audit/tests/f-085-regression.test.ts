import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  formatINR,
  formatQuantity,
  formatDate,
  compareStrings,
} from "../../shared/src/formatters";

describe("F-085: Indic/Tamil Number Formatting, Date Localization, and Collation (UTS #10 & REQ-053)", () => {
  const sharedFormattersPath = path.resolve(__dirname, "../../shared/src/formatters.ts");
  const useFormattersPath = path.resolve(__dirname, "../../client/src/hooks/use-formatters.ts");
  const clientFormattersPath = path.resolve(__dirname, "../../client/src/lib/formatters.ts");

  it("verifies shared formatters exports compareStrings and locale/lang support", () => {
    const source = fs.readFileSync(sharedFormattersPath, "utf8");
    expect(source).toMatch(/export\s+function\s+compareStrings/);
    expect(source).toMatch(/locale:\s*string\s*=\s*["']en-IN["']/);
    expect(source).toMatch(/strA\.localeCompare\(strB,\s*resolvedLocale,\s*options\)/);
  });

  it("verifies use-formatters hook synchronizes locale with active UI language", () => {
    const hookSource = fs.readFileSync(useFormattersPath, "utf8");
    expect(hookSource).toMatch(/const\s*\{\s*language\s*\}\s*=\s*useLanguage\(\)/);
    expect(hookSource).toMatch(/locale\s*=\s*language\s*===\s*["']ta["']\s*\?\s*["']ta-IN["']\s*:\s*["']en-IN["']/);
  });

  it("verifies client lib re-exports useFormatters", () => {
    const clientSource = fs.readFileSync(clientFormattersPath, "utf8");
    expect(clientSource).toMatch(/export\s*\{\s*useFormatters\s*\}\s*from\s*["']@\/hooks\/use-formatters["']/);
  });

  it("formats currency with Indian Lakhs/Crores grouping in Tamil and English", () => {
    expect(formatINR(100000, { lang: "ta" })).toBe("₹1,00,000.00");
    expect(formatINR(1250000, { locale: "ta-IN" })).toBe("₹12,50,000.00");
    expect(formatINR(10000000, { lang: "en" })).toBe("₹1,00,00,000.00");
  });

  it("formats quantities with Indian grouping", () => {
    expect(formatQuantity(100000, { lang: "ta", unit: "pkts" })).toBe("1,00,000 pkts");
  });

  it("formats dates with Tamil localized months when language is Tamil", () => {
    const testDate = new Date("2026-04-01T12:00:00.000Z");
    const formattedTa = formatDate(testDate, { lang: "ta" });
    expect(formattedTa).toMatch(/01|1/);
    expect(formattedTa).toContain("2026");
    expect(formattedTa).toMatch(/ஏப்/);
  });

  it("collates Tamil and English strings following Unicode Collation Algorithm (UTS #10)", () => {
    const words = ["கோதுமை", "அரிசி", "உளுந்து"];
    const sortedTa = [...words].sort((a, b) => compareStrings(a, b, "ta-IN"));
    expect(sortedTa).toEqual(["அரிசி", "உளுந்து", "கோதுமை"]);

    const enWords = ["Zebra", "Apple", "Mango"];
    const sortedEn = [...enWords].sort((a, b) => compareStrings(a, b, "en-IN"));
    expect(sortedEn).toEqual(["Apple", "Mango", "Zebra"]);
  });
});
