import { Prisma } from "@prisma/client";

export interface TaxLineInput {
  quantity: number | string | Prisma.Decimal;
  unitPrice: number | string | Prisma.Decimal;
  taxRate: number | string | Prisma.Decimal;
}

export interface CalculatedTaxLine {
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  taxRate: Prisma.Decimal;
  taxableAmount: Prisma.Decimal;
  cgstAmount: Prisma.Decimal;
  sgstAmount: Prisma.Decimal;
  igstAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
}

export interface CalculatedTaxTotals {
  taxableAmount: Prisma.Decimal;
  cgstAmount: Prisma.Decimal;
  sgstAmount: Prisma.Decimal;
  igstAmount: Prisma.Decimal;
  totalTaxAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  lines: CalculatedTaxLine[];
}

/**
 * Calculates line-level GST with exact statutory Decimal Half-Up paise rounding (Section 170 CGST Act).
 */
export function calculateLineTax(
  input: TaxLineInput,
  isIntraState: boolean,
): CalculatedTaxLine {
  const qty = new Prisma.Decimal(input.quantity.toString());
  const price = new Prisma.Decimal(input.unitPrice.toString()).toDecimalPlaces(
    2,
    Prisma.Decimal.ROUND_HALF_UP,
  );
  const taxRate = new Prisma.Decimal(input.taxRate.toString());

  const taxableAmount = qty.mul(price).toDecimalPlaces(
    2,
    Prisma.Decimal.ROUND_HALF_UP,
  );

  let cgstAmount = new Prisma.Decimal(0);
  let sgstAmount = new Prisma.Decimal(0);
  let igstAmount = new Prisma.Decimal(0);
  let taxAmount = new Prisma.Decimal(0);

  if (isIntraState) {
    const halfRate = taxRate.div(2);
    cgstAmount = taxableAmount
      .mul(halfRate)
      .div(100)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    sgstAmount = taxableAmount
      .mul(halfRate)
      .div(100)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    taxAmount = cgstAmount.add(sgstAmount);
  } else {
    igstAmount = taxableAmount
      .mul(taxRate)
      .div(100)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    taxAmount = igstAmount;
  }

  const lineTotal = taxableAmount.add(taxAmount);

  return {
    quantity: qty,
    unitPrice: price,
    taxRate,
    taxableAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    taxAmount,
    lineTotal,
  };
}

/**
 * Aggregates line taxes into invoice/order totals with exact zero-drift summation.
 */
export function calculateOrderOrInvoiceTax(
  lines: TaxLineInput[],
  isIntraState: boolean,
): CalculatedTaxTotals {
  let taxableAmount = new Prisma.Decimal(0);
  let cgstAmount = new Prisma.Decimal(0);
  let sgstAmount = new Prisma.Decimal(0);
  let igstAmount = new Prisma.Decimal(0);
  let totalTaxAmount = new Prisma.Decimal(0);
  let totalAmount = new Prisma.Decimal(0);

  const calculatedLines: CalculatedTaxLine[] = [];

  for (const line of lines) {
    const calculated = calculateLineTax(line, isIntraState);
    calculatedLines.push(calculated);

    taxableAmount = taxableAmount.add(calculated.taxableAmount);
    cgstAmount = cgstAmount.add(calculated.cgstAmount);
    sgstAmount = sgstAmount.add(calculated.sgstAmount);
    igstAmount = igstAmount.add(calculated.igstAmount);
    totalTaxAmount = totalTaxAmount.add(calculated.taxAmount);
    totalAmount = totalAmount.add(calculated.lineTotal);
  }

  return {
    taxableAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalTaxAmount,
    totalAmount,
    lines: calculatedLines,
  };
}
