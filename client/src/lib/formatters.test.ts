import { describe, expect, it } from "vitest";
import {
  compareStrings,
  formatDate,
  formatDateShort,
  formatDateTime,
  formatINR,
  formatQuantity,
  formatTime,
} from "./formatters.js";

describe("F-097: Centralized Currency & Date Formatters", () => {
  describe("formatINR (Indian Rupee Currency Formatter)", () => {
    it("formats standard amounts with en-IN numbering and two decimal places", () => {
      expect(formatINR(1000)).toBe("₹1,000.00");
      expect(formatINR(7875.5)).toBe("₹7,875.50");
      expect(formatINR(0)).toBe("₹0.00");
    });

    it("correctly groups Lakhs and Crores using Indian numbering system", () => {
      // 1 Lakh = 1,00,000.00
      expect(formatINR(100000)).toBe("₹1,00,000.00");
      // 12.5 Lakhs = 12,50,000.00
      expect(formatINR(1250000)).toBe("₹12,50,000.00");
      // 1 Crore = 1,00,00,000.00
      expect(formatINR(10000000)).toBe("₹1,00,00,000.00");
      // Complex multi-digit financial amount
      expect(formatINR(12345678.9)).toBe("₹1,23,45,678.90");
    });

    it("handles string representations of numbers", () => {
      expect(formatINR("1000")).toBe("₹1,000.00");
      expect(formatINR("100000.50")).toBe("₹1,00,000.50");
      expect(formatINR("7875")).toBe("₹7,875.00");
    });

    it("handles Decimal-like objects with toString() or toNumber()", () => {
      const mockDecimal = {
        toString: () => "4000.00",
        toNumber: () => 4000,
      };
      expect(formatINR(mockDecimal)).toBe("₹4,000.00");
    });

    it("formats negative amounts correctly with minus sign", () => {
      expect(formatINR(-500)).toBe("-₹500.00");
      expect(formatINR(-100000)).toBe("-₹1,00,000.00");
    });

    it("gracefully falls back on null, undefined, NaN, and invalid strings", () => {
      expect(formatINR(null)).toBe("₹0.00");
      expect(formatINR(undefined)).toBe("₹0.00");
      expect(formatINR(NaN)).toBe("₹0.00");
      expect(formatINR("invalid-amount")).toBe("₹0.00");
    });

    it("supports optional configuration (e.g. symbol: false)", () => {
      expect(formatINR(100000, { symbol: false })).toBe("1,00,000.00");
      expect(formatINR(500, { minimumFractionDigits: 0, maximumFractionDigits: 0 })).toBe("₹500");
    });
  });

  describe("formatQuantity (Discrete units and weights)", () => {
    it("formats quantities with Indian grouping", () => {
      expect(formatQuantity(1000)).toBe("1,000");
      expect(formatQuantity(100000)).toBe("1,00,000");
    });

    it("appends unit when specified", () => {
      expect(formatQuantity(150, { unit: "pkts" })).toBe("150 pkts");
      expect(formatQuantity(2400, { unit: "units" })).toBe("2,400 units");
    });

    it("handles null and undefined gracefully", () => {
      expect(formatQuantity(null)).toBe("0");
      expect(formatQuantity(undefined)).toBe("0");
    });
  });

  describe("formatDate & formatDateTime (IST Date/Time formatting)", () => {
    // 2026-04-01T12:00:00.000Z
    const testDate = new Date("2026-04-01T12:00:00.000Z");

    it("formats standard date to DD MMM YYYY in en-IN", () => {
      const formatted = formatDate(testDate);
      expect(formatted).toMatch(/01\s+Apr\s+2026/);
    });

    it("formats date strings and timestamps identically", () => {
      expect(formatDate("2026-04-01T12:00:00.000Z")).toBe(formatDate(testDate));
    });

    it("formats short date as DD/MM/YYYY", () => {
      const formatted = formatDateShort(testDate);
      expect(formatted).toBe("01/04/2026");
    });

    it("formats date time with both date and time components", () => {
      const formatted = formatDateTime(testDate);
      expect(formatted).toContain("2026");
      expect(formatted).toMatch(/(am|pm|AM|PM|\d{2}:\d{2})/);
    });

    it("formats time component cleanly", () => {
      const formatted = formatTime(testDate);
      expect(formatted).toMatch(/\d{2}:\d{2}/);
    });

    it("handles invalid or missing dates gracefully without crashing", () => {
      expect(formatDate(null)).toBe("—");
      expect(formatDate(undefined)).toBe("—");
      expect(formatDate("invalid-date-string")).toBe("—");
      expect(formatDateShort(null)).toBe("—");
      expect(formatDateTime(null)).toBe("—");
      expect(formatTime(null)).toBe("—");
    });

    it("supports Tamil date localization via ta-IN locale or lang option (F-085)", () => {
      const formatted = formatDate(testDate, { lang: "ta" });
      expect(formatted).toMatch(/01|1/);
      expect(formatted).toContain("2026");
      // Tamil month for April is ஏப். or ஏப்ரல்
      expect(formatted).toMatch(/ஏப்/);
    });
  });

  describe("F-085: Indic/Tamil Localization & Unicode Collation", () => {
    it("formats INR with Tamil and Indian numbering system", () => {
      expect(formatINR(100000, { lang: "ta" })).toBe("₹1,00,000.00");
      expect(formatINR(1250000, { locale: "ta-IN" })).toBe("₹12,50,000.00");
    });

    it("formats discrete quantities with Tamil/Indian locale grouping", () => {
      expect(formatQuantity(100000, { lang: "ta", unit: "pkts" })).toBe("1,00,000 pkts");
    });

    it("collates Tamil and English strings using Unicode Collation Algorithm (UTS #10)", () => {
      const list = ["கோதுமை", "அரிசி", "உளுந்து"];
      const sorted = [...list].sort((a, b) => compareStrings(a, b, "ta-IN"));
      // In Tamil alphabet: அ comes before உ, which comes before க
      expect(sorted).toEqual(["அரிசி", "உளுந்து", "கோதுமை"]);

      const englishList = ["Zebra", "Apple", "Mango"];
      const sortedEnglish = [...englishList].sort((a, b) => compareStrings(a, b, "en-IN"));
      expect(sortedEnglish).toEqual(["Apple", "Mango", "Zebra"]);
    });
  });
});
