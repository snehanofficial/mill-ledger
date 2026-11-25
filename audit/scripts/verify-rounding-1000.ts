import { Prisma } from "@prisma/client";

const Decimal = Prisma.Decimal;

interface LineItem {
  qty: number;
  unitPrice: number;
  taxRate: number; // e.g. 5 for 5%
}

function calculateInvoiceApp(lines: LineItem[], isIntraState: boolean) {
  // Exact logic from server/src/modules/finance/finance.service.ts
  let taxableAmount = 0;
  let totalTaxAmount = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  const preparedLines = [];

  for (const line of lines) {
    const qty = Number(line.qty);
    const price = Number(line.unitPrice);
    const taxRate = Number(line.taxRate);

    const lineTaxable = qty * price;
    const lineTax = (lineTaxable * taxRate) / 100;
    const lineTotal = lineTaxable + lineTax;

    let lineCgst = 0;
    let lineSgst = 0;
    let lineIgst = 0;

    if (isIntraState) {
      lineCgst = lineTax / 2;
      lineSgst = lineTax / 2;
      cgstAmount += lineCgst;
      sgstAmount += lineSgst;
    } else {
      lineIgst = lineTax;
      igstAmount += lineIgst;
    }

    taxableAmount += lineTaxable;
    totalTaxAmount += lineTax;

    preparedLines.push({
      lineTaxable,
      lineCgst,
      lineSgst,
      lineIgst,
      lineTax,
      lineTotal,
    });
  }

  const totalAmount = taxableAmount + totalTaxAmount;

  return {
    taxableAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalTaxAmount,
    totalAmount,
    lines: preparedLines,
  };
}

function calculateInvoiceReference(lines: LineItem[], isIntraState: boolean) {
  // Independent reference implementation:
  // Strict decimal arithmetic with 2 decimal place paise precision (ROUND_HALF_UP)
  let refTaxable = new Decimal(0);
  let refCgst = new Decimal(0);
  let refSgst = new Decimal(0);
  let refIgst = new Decimal(0);
  let refTotalTax = new Decimal(0);
  let refGrandTotal = new Decimal(0);

  const refLines = [];

  for (const line of lines) {
    const qty = new Decimal(line.qty);
    const price = new Decimal(line.unitPrice.toFixed(2));
    const rate = new Decimal(line.taxRate);

    const lineTaxable = qty.mul(price).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    refTaxable = refTaxable.add(lineTaxable);

    if (isIntraState) {
      // Half tax to CGST, half to SGST (rounded to 2 decimal places paise)
      const halfRate = rate.div(2);
      const lineCgst = lineTaxable.mul(halfRate).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const lineSgst = lineTaxable.mul(halfRate).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const lineTax = lineCgst.add(lineSgst);
      const lineTotal = lineTaxable.add(lineTax);

      refCgst = refCgst.add(lineCgst);
      refSgst = refSgst.add(lineSgst);
      refTotalTax = refTotalTax.add(lineTax);
      refGrandTotal = refGrandTotal.add(lineTotal);

      refLines.push({ lineTaxable, lineCgst, lineSgst, lineIgst: new Decimal(0), lineTax, lineTotal });
    } else {
      const lineIgst = lineTaxable.mul(rate).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const lineTax = lineIgst;
      const lineTotal = lineTaxable.add(lineTax);

      refIgst = refIgst.add(lineIgst);
      refTotalTax = refTotalTax.add(lineTax);
      refGrandTotal = refGrandTotal.add(lineTotal);

      refLines.push({ lineTaxable, lineCgst: new Decimal(0), lineSgst: new Decimal(0), lineIgst, lineTax, lineTotal });
    }
  }

  return {
    taxableAmount: refTaxable.toFixed(2),
    cgstAmount: refCgst.toFixed(2),
    sgstAmount: refSgst.toFixed(2),
    igstAmount: refIgst.toFixed(2),
    totalTaxAmount: refTotalTax.toFixed(2),
    totalAmount: refGrandTotal.toFixed(2),
  };
}

async function run() {
  console.log("=== RUNNING 1000 RANDOMIZED INVOICE ROUNDING VERIFICATION ===");
  
  let mismatches = 0;
  let totalTests = 1000;
  const sampleMismatches: any[] = [];

  // Seeded deterministic pseudo-random generator
  let seed = 42;
  function rand() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  for (let i = 0; i < totalTests; i++) {
    const lineCount = Math.floor(rand() * 5) + 1; // 1 to 5 lines
    const isIntraState = rand() > 0.5;
    const lines: LineItem[] = [];

    for (let j = 0; j < lineCount; j++) {
      const qty = Math.floor(rand() * 50) + 1; // 1 to 50
      const unitPrice = Math.round((rand() * 150 + 10) * 100) / 100;
      const rates = [5, 12, 18];
      const taxRate = rates[Math.floor(rand() * rates.length)];
      lines.push({ qty, unitPrice, taxRate });
    }

    const appResult = calculateInvoiceApp(lines, isIntraState);
    const refResult = calculateInvoiceReference(lines, isIntraState);

    const appTaxable = appResult.taxableAmount.toFixed(2);
    const appCgst = appResult.cgstAmount.toFixed(2);
    const appSgst = appResult.sgstAmount.toFixed(2);
    const appIgst = appResult.igstAmount.toFixed(2);
    const appTax = appResult.totalTaxAmount.toFixed(2);
    const appTotal = appResult.totalAmount.toFixed(2);

    const hasMismatch =
      appTaxable !== refResult.taxableAmount ||
      appCgst !== refResult.cgstAmount ||
      appSgst !== refResult.sgstAmount ||
      appIgst !== refResult.igstAmount ||
      appTax !== refResult.totalTaxAmount ||
      appTotal !== refResult.totalAmount;

    if (hasMismatch) {
      mismatches++;
      if (sampleMismatches.length < 5) {
        sampleMismatches.push({
          testIndex: i,
          isIntraState,
          lines,
          app: { appTaxable, appCgst, appSgst, appIgst, appTax, appTotal },
          ref: refResult,
          rawApp: appResult,
        });
      }
    }
  }

  console.log(`Total tests: ${totalTests}`);
  console.log(`Mismatches between App float math and Reference Decimal implementation: ${mismatches} / ${totalTests} (${((mismatches/totalTests)*100).toFixed(1)}%)`);
  if (sampleMismatches.length > 0) {
    console.log("Sample Mismatches:\n", JSON.stringify(sampleMismatches, null, 2));
  }
}

run().catch(console.error);
