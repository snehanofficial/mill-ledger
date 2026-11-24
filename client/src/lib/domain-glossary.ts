export const DOMAIN_GLOSSARY = {
  BOM: "Bill of Materials (BOM): The master formulation recipe defining standard raw material and packaging quantities required to manufacture finished goods.",
  ATP: "Available to Promise (ATP): Unreserved finished goods inventory immediately available for sales booking (Physical On-Hand minus Active Reservations).",
  FIFO: "First-In, First-Out (FIFO): Accounting rule where oldest outstanding invoices or oldest inventory lots are matched and settled first.",
  YIELD_VARIANCE:
    "Yield Variance: The percentage deviation between theoretical expected output from the BOM recipe and actual good packets produced (flagged if > 5%).",
  WAC: "Weighted Average Cost (WAC): Perpetual inventory valuation dynamically recalculated upon every purchase receipt based on cumulative quantity and landed cost.",
} as const;

export type DomainGlossaryKey = keyof typeof DOMAIN_GLOSSARY;
