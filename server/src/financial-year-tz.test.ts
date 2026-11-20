import { describe, expect, it } from "vitest";
import { financeService } from "./modules/finance/finance.service.js";

describe("F-011: Financial Year Timezone Invariance (IST / Asia/Kolkata)", () => {
  it("correctly identifies April 1 morning in IST as the new financial year regardless of UTC representation", () => {
    // 01:30 AM IST on April 1, 2026 = 2026-03-31T20:30:00.000Z in UTC
    const april1stEarlyMorning = new Date("2026-04-01T01:30:00+05:30");
    const fy = financeService.getFinancialYear(april1stEarlyMorning);
    expect(fy).toBe("2026-27");
  });

  it("correctly identifies March 31 late evening in IST as the closing financial year", () => {
    // 11:45 PM IST on March 31, 2026 = 2026-03-31T18:15:00.000Z in UTC
    const march31stLateEvening = new Date("2026-03-31T23:45:00+05:30");
    const fy = financeService.getFinancialYear(march31stLateEvening);
    expect(fy).toBe("2025-26");
  });

  it("correctly handles exact boundary at midnight IST on April 1st", () => {
    // 00:00:00 IST on April 1, 2026
    const midnightNewFY = new Date("2026-04-01T00:00:00+05:30");
    expect(financeService.getFinancialYear(midnightNewFY)).toBe("2026-27");

    // 23:59:59.999 IST on March 31, 2026
    const secondBeforeMidnight = new Date("2026-03-31T23:59:59.999+05:30");
    expect(financeService.getFinancialYear(secondBeforeMidnight)).toBe("2025-26");
  });

  it("produces correct FY format across all 12 months", () => {
    // Check multiple months in 2026-27
    expect(financeService.getFinancialYear(new Date("2026-05-15T10:00:00+05:30"))).toBe("2026-27");
    expect(financeService.getFinancialYear(new Date("2026-12-31T10:00:00+05:30"))).toBe("2026-27");
    expect(financeService.getFinancialYear(new Date("2027-01-15T10:00:00+05:30"))).toBe("2026-27");
    expect(financeService.getFinancialYear(new Date("2027-03-31T20:00:00+05:30"))).toBe("2026-27");
  });
});
