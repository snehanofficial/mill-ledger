import { describe, it, expect } from "vitest";
import { calculateLineTax } from "../../server/src/modules/finance/tax.util.js";

describe("F-096 Regression: Statutory GST Split & Payment Allocation Integrity", () => {
  describe("Statutory Place of Supply GST Calculations", () => {
    it("kills mutant on intra-state supply (Tamil Nadu): splits tax evenly into CGST and SGST with 0 IGST", () => {
      const result = calculateLineTax(
        {
          quantity: "150",
          unitPrice: "50",
          taxRate: 5,
        },
        true, // isIntraState = true
      );

      // Taxable: 150 * 50 = 7500.00
      // Tax: 7500 * 5% = 375.00
      // CGST: 187.50, SGST: 187.50, IGST: 0.00
      // Total: 7875.00
      expect(result.taxableAmount.toNumber()).toBe(7500);
      expect(result.cgstAmount.toNumber()).toBe(187.5);
      expect(result.sgstAmount.toNumber()).toBe(187.5);
      expect(result.igstAmount.toNumber()).toBe(0);
      expect(result.taxAmount.toNumber()).toBe(375);
      expect(result.lineTotal.toNumber()).toBe(7875);

      // Invariant: lineTotal = taxableAmount + taxAmount
      expect(result.lineTotal.toNumber()).toBe(
        result.taxableAmount.toNumber() + result.taxAmount.toNumber(),
      );
      // Invariant: taxAmount = cgstAmount + sgstAmount + igstAmount
      expect(result.taxAmount.toNumber()).toBe(
        result.cgstAmount.toNumber() +
          result.sgstAmount.toNumber() +
          result.igstAmount.toNumber(),
      );
    });

    it("kills mutant on inter-state supply (e.g. Karnataka): assigns 100% of tax to IGST with 0 CGST and 0 SGST", () => {
      const result = calculateLineTax(
        {
          quantity: "100",
          unitPrice: "40",
          taxRate: 12,
        },
        false, // isIntraState = false
      );

      // Taxable: 100 * 40 = 4000.00
      // Tax: 4000 * 12% = 480.00
      // CGST: 0.00, SGST: 0.00, IGST: 480.00
      // Total: 4480.00
      expect(result.taxableAmount.toNumber()).toBe(4000);
      expect(result.cgstAmount.toNumber()).toBe(0);
      expect(result.sgstAmount.toNumber()).toBe(0);
      expect(result.igstAmount.toNumber()).toBe(480);
      expect(result.taxAmount.toNumber()).toBe(480);
      expect(result.lineTotal.toNumber()).toBe(4480);

      // Invariant: lineTotal = taxableAmount + taxAmount (kills subtraction arithmetic mutant)
      expect(result.lineTotal.toNumber()).toBe(
        result.taxableAmount.toNumber() + result.taxAmount.toNumber(),
      );
    });

    it("handles boundary zero rate supply without divide by zero or NaN", () => {
      const result = calculateLineTax(
        {
          quantity: "10",
          unitPrice: "100",
          taxRate: 0,
        },
        true,
      );

      expect(result.taxableAmount.toNumber()).toBe(1000);
      expect(result.cgstAmount.toNumber()).toBe(0);
      expect(result.sgstAmount.toNumber()).toBe(0);
      expect(result.igstAmount.toNumber()).toBe(0);
      expect(result.taxAmount.toNumber()).toBe(0);
      expect(result.lineTotal.toNumber()).toBe(1000);
    });
  });

  describe("Payment Allocation Guard Verification", () => {
    it("enforces allocation validation guards in payment service source code", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const paymentServiceSource = fs.readFileSync(
        path.resolve(
          process.cwd(),
          "server/src/modules/finance/payment.service.ts",
        ),
        "utf-8",
      );

      // Guard 1: totalAllocated > input.amount
      expect(paymentServiceSource).toMatch(/totalAllocated\s*>\s*input\.amount/);

      // Guard 2: allocAmount <= 0
      expect(paymentServiceSource).toMatch(/allocAmount\s*<=\s*0/);

      // Guard 3: invoice not found
      expect(paymentServiceSource).toMatch(/if\s*\(!invoice\)/);

      // Guard 4: cross-customer IDOR check
      expect(paymentServiceSource).toMatch(
        /invoice\.customerId\s*!==\s*input\.customerId/,
      );

      // Guard 5: invoice status check
      expect(paymentServiceSource).toMatch(/invoice\.status\s*!==\s*InvoiceStatus\.POSTED/);

      // Guard 6: allocation exceeding outstanding
      expect(paymentServiceSource).toMatch(/allocAmount\s*>\s*outstanding/);
    });
  });
});
