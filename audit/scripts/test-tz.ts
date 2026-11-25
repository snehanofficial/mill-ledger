import { financeService } from "../../server/src/modules/finance/finance.service.js";

// Timestamp: 1st April 2026, 02:00 AM IST (+05:30)
// This is 31st March 2026, 20:30 UTC
const d = new Date("2026-04-01T02:00:00+05:30");
console.log("Current Process TZ:", process.env.TZ || "default");
console.log("Date ISO string (UTC):", d.toISOString());
console.log("date.getFullYear():", d.getFullYear());
console.log("date.getMonth():", d.getMonth(), "(0=Jan, 2=March, 3=April)");
console.log("financeService.getFinancialYear(d):", financeService.getFinancialYear(d));
console.log("Statutory Expected FY in India (IST): 2026-27");
