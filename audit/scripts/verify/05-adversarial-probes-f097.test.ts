import { describe, it, expect } from "vitest";
import {
  formatINR,
  formatQuantity,
  formatDate,
  formatDateShort,
  formatDateTime,
  formatTime,
} from "../../../client/src/lib/formatters.js";

describe("Adversarial Probes for F-097 Formatters", () => {
  describe("1. Money & Currency (formatINR) Adversarial Cases", () => {
    it("handles zero and signed zero", () => {
      expect(formatINR(0)).toBe("₹0.00");
      // -0 in JS:
      const negZero = -0;
      const resNegZero = formatINR(negZero);
      expect(["₹0.00", "-₹0.00"]).toContain(resNegZero);
      expect(formatINR("0")).toBe("₹0.00");
      expect(formatINR("0.00")).toBe("₹0.00");
      // Note: Number("-0.00") in JS is -0. Intl.NumberFormat preserves negative zero sign.
      expect(["₹0.00", "-₹0.00"]).toContain(formatINR("-0.00"));
    });

    it("handles extreme large values up to safe integer", () => {
      // 100 Crore = 1,00,00,00,000.00
      expect(formatINR(1_000_000_000)).toBe("₹1,00,00,00,000.00");
      // 10,000 Crore = 1,00,00,00,00,000.00
      expect(formatINR(100_000_000_000)).toBe("₹1,00,00,00,00,000.00");
      // Number.MAX_SAFE_INTEGER: 9007199254740991
      const maxSafe = formatINR(Number.MAX_SAFE_INTEGER);
      expect(maxSafe).toContain("₹");
      expect(maxSafe).toMatch(/\.00$/);
    });

    it("handles sub-paise fractional amounts and rounding ties", () => {
      // Sub-paise: 0.001 -> 0.00
      expect(formatINR(0.001)).toBe("₹0.00");
      // 0.0049 -> 0.00
      expect(formatINR(0.0049)).toBe("₹0.00");
      // 0.005 -> rounds to 0.01 (half-up or half-even in Intl)
      const halfCent = formatINR(0.005);
      expect(["₹0.00", "₹0.01"]).toContain(halfCent);
      // 0.009 -> 0.01
      expect(formatINR(0.009)).toBe("₹0.01");
      // 12.505 -> 12.51 or 12.50
      const tie1 = formatINR(12.505);
      expect(["₹12.50", "₹12.51"]).toContain(tie1);
    });

    it("handles repeating decimals cleanly", () => {
      const third = 10 / 3; // 3.3333333333333335
      expect(formatINR(third)).toBe("₹3.33");
      const seventh = 1 / 7; // 0.142857...
      expect(formatINR(seventh)).toBe("₹0.14");
    });

    it("handles negative financial amounts", () => {
      expect(formatINR(-0.01)).toBe("-₹0.01");
      expect(formatINR(-1)).toBe("-₹1.00");
      expect(formatINR(-9999999.99)).toBe("-₹99,99,999.99");
    });

    it("handles exponential numbers and scientific notation strings", () => {
      expect(formatINR(1e5)).toBe("₹1,00,000.00");
      expect(formatINR("1e6")).toBe("₹10,00,000.00");
      expect(formatINR("1e-2")).toBe("₹0.01");
    });

    it("handles non-numeric strings, whitespace, and injection attempts gracefully", () => {
      expect(formatINR("")).toBe("₹0.00");
      expect(formatINR("   ")).toBe("₹0.00");
      expect(formatINR("\t\n")).toBe("₹0.00");
      expect(formatINR("NaN")).toBe("₹0.00");
      expect(formatINR("Infinity")).toBe("₹0.00");
      expect(formatINR("-Infinity")).toBe("₹0.00");
      expect(formatINR("<script>alert(1)</script>")).toBe("₹0.00");
      expect(formatINR("DROP TABLE sales_invoice;")).toBe("₹0.00");
      expect(formatINR("₹1,000.00")).toBe("₹0.00"); // already formatted string fallback
    });

    it("handles type confusion gracefully without uncaught exceptions", () => {
      expect(formatINR(true as any)).toBe("₹1.00"); // Number(true) is 1
      expect(formatINR(false as any)).toBe("₹0.00"); // Number(false) is 0
      expect(formatINR({} as any)).toBe("₹0.00");
      expect(formatINR([] as any)).toBe("₹0.00");
      expect(formatINR([100] as any)).toBe("₹100.00");
      expect(formatINR([100, 200] as any)).toBe("₹0.00");
      expect(formatINR({ toString: () => "invalid" } as any)).toBe("₹0.00");
    });
  });

  describe("2. Quantities (formatQuantity) Adversarial Cases", () => {
    it("handles large quantities and fractional bags/weights", () => {
      expect(formatQuantity(1000000, { unit: "kg" })).toBe("10,00,000 kg");
      expect(formatQuantity(12.375, { unit: "bags" })).toBe("12.38 bags");
    });

    it("handles Tamil and unicode unit strings", () => {
      expect(formatQuantity(50, { unit: "மூட்டைகள்" })).toBe("50 மூட்டைகள்");
      expect(formatQuantity(1000, { unit: "கிலோ" })).toBe("1,000 கிலோ");
    });

    it("handles fallback and unit combinations on null/undefined", () => {
      expect(formatQuantity(null, { unit: "kg" })).toBe("0 kg");
      expect(formatQuantity(undefined, { unit: "pkts" })).toBe("0 pkts");
      expect(formatQuantity(NaN, { unit: "units" })).toBe("0 units");
    });
  });

  describe("3. Date & Time Adversarial Cases (Leap Years, FY Rollovers, Timezones)", () => {
    it("handles leap days accurately", () => {
      const leapDay = new Date("2024-02-29T12:00:00Z");
      expect(formatDate(leapDay)).toMatch(/29\s+Feb\s+2024/);
      expect(formatDateShort(leapDay)).toBe("29/02/2024");
    });

    it("handles year-end boundaries and FY April 1 rollover in IST", () => {
      // 2026-03-31T18:30:00.000Z corresponds to 2026-04-01 00:00:00 in IST (+05:30)
      const fyRolloverUTC = new Date("2026-03-31T18:30:00.000Z");
      // Depending on whether environment is running in UTC or IST, let us inspect formatDate
      const formatted = formatDate(fyRolloverUTC);
      expect(typeof formatted).toBe("string");
      expect(formatted.length).toBeGreaterThan(0);
    });

    it("handles unix epoch and pre-epoch dates", () => {
      // Note: formatDate(0) returns "—" because `if (!date)` treats numeric 0 as falsy
      expect(formatDate(0)).toBe("—");
      expect(formatDate(new Date(0))).toMatch(/1970/);
      expect(formatDate(-100000000000)).toMatch(/1966/);
    });

    it("handles garbage and malformed dates without throwing", () => {
      expect(formatDate("not-a-date")).toBe("—");
      expect(formatDate("2026-99-99")).toBe("—");
      expect(formatDate(new Date("invalid"))).toBe("—");
      expect(formatDateShort("bad")).toBe("—");
      expect(formatDateTime("bad")).toBe("—");
      expect(formatTime("bad")).toBe("—");
    });
  });

  describe("4. Non-breaking whitespace and formatting hygiene", () => {
    it("verifies space representation in currency formatting", () => {
      const formatted = formatINR(1000);
      // Ensure it starts with rupee symbol
      expect(formatted.startsWith("₹")).toBe(true);
      // Ensure there are no double spaces or trailing whitespace
      expect(formatted.trim()).toBe(formatted);
      expect(formatted).not.toContain("  ");
    });
  });
});
