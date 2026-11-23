import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateShort,
  formatDateTime,
  formatINR,
  formatQuantity,
  formatTime,
} from "../../client/src/lib/formatters.js";

describe("F-097 Regression Test: Centralized Currency and Date Formatters", () => {
  it("formats currency to Indian standards with lakhs and crores", () => {
    expect(formatINR(100000)).toBe("₹1,00,000.00");
    expect(formatINR(10000000)).toBe("₹1,00,00,000.00");
    expect(formatINR(0)).toBe("₹0.00");
    expect(formatINR(-500)).toBe("-₹500.00");
    expect(formatINR(null)).toBe("₹0.00");
  });

  it("formats dates consistently in en-IN without undefined locale", () => {
    const testDate = new Date("2026-04-01T12:00:00.000Z");
    expect(formatDate(testDate)).toMatch(/01\s+Apr\s+2026/);
    expect(formatDateShort(testDate)).toBe("01/04/2026");
    expect(formatDate(null)).toBe("—");
  });
});
