import { financeService } from "../../../server/src/modules/finance/finance.service.js";

function assertFY(label: string, date: Date, expected: string) {
  const actual = financeService.getFinancialYear(date);
  if (actual !== expected) {
    console.error(`FAIL [${label}]: expected ${expected}, got ${actual} (ISO: ${date.toISOString()})`);
    process.exit(1);
  }
  console.log(`PASS [${label}]: ${date.toISOString()} -> ${actual}`);
}

console.log("--- PROBE 1: Millisecond boundaries around Indian FY transition ---");
assertFY("1ms before midnight April 1", new Date("2026-03-31T23:59:59.999+05:30"), "2025-26");
assertFY("Exact midnight April 1", new Date("2026-04-01T00:00:00.000+05:30"), "2026-27");
assertFY("1ms after midnight April 1", new Date("2026-04-01T00:00:00.001+05:30"), "2026-27");
assertFY("1ms before midnight Dec 31", new Date("2026-12-31T23:59:59.999+05:30"), "2026-27");
assertFY("Exact midnight Jan 1", new Date("2027-01-01T00:00:00.000+05:30"), "2026-27");
assertFY("1ms before midnight March 31 end of FY", new Date("2027-03-31T23:59:59.999+05:30"), "2026-27");
assertFY("Next FY boundary April 1 2027", new Date("2027-04-01T00:00:00.000+05:30"), "2027-28");

console.log("--- PROBE 2: Leap year handling ---");
assertFY("Leap day 2024 late evening", new Date("2024-02-29T23:59:59.999+05:30"), "2023-24");
assertFY("Leap day 2028 early morning", new Date("2028-02-29T00:00:00.000+05:30"), "2027-28");

console.log("--- PROBE 3: Century rollover (Year 2099 - 2100) ---");
assertFY("FY 2099-00 April 1", new Date("2099-04-01T00:00:00.000+05:30"), "2099-00");
assertFY("FY 2099-00 Jan 1", new Date("2100-01-01T00:00:00.000+05:30"), "2099-00");
assertFY("FY 2100-01 April 1", new Date("2100-04-01T00:00:00.000+05:30"), "2100-01");

console.log("--- PROBE 4: Default argument (current date) ---");
const defaultFY = financeService.getFinancialYear();
console.log(`PASS [Default parameter]: current FY is ${defaultFY}`);

console.log("--- PROBE 5: Global timezone invariance across 10 extreme timezones ---");
const testDate = new Date("2026-04-01T00:00:01+05:30"); // 1 second into FY 2026-27
const timezones = [
  "Pacific/Kiritimati", // UTC+14
  "Pacific/Midway",     // UTC-11
  "UTC",                // UTC+0
  "America/New_York",   // UTC-5 / UTC-4
  "America/Los_Angeles",// UTC-8 / UTC-7
  "Europe/London",      // UTC+0 / UTC+1
  "Europe/Berlin",      // UTC+1 / UTC+2
  "Asia/Kolkata",       // UTC+5:30
  "Asia/Tokyo",         // UTC+9
  "Australia/Sydney"    // UTC+10 / UTC+11
];

for (const tz of timezones) {
  process.env.TZ = tz;
  const res = financeService.getFinancialYear(testDate);
  if (res !== "2026-27") {
    console.error(`FAIL under TZ=${tz}: got ${res}`);
    process.exit(1);
  }
  console.log(`PASS under process.env.TZ=${tz}: ${res}`);
}
console.log("All adversarial probes succeeded!");
