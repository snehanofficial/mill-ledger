import { financeService } from "../../modules/finance/finance.service.js";

const d = new Date("2026-04-01T01:30:00+05:30");
console.log("financeService.getFinancialYear(d):", financeService.getFinancialYear(d));
