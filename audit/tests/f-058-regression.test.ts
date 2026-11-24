import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("F-058 Regression Test: Confirmation Safeguards on Irreversible Financial Transactions (WCAG 2.2 SC 3.3.4)", () => {
  const invoicesPagePath = path.resolve(
    __dirname,
    "../../client/src/pages/invoices-page.tsx",
  );
  const paymentsPagePath = path.resolve(
    __dirname,
    "../../client/src/pages/payments-page.tsx",
  );
  const purchasesPagePath = path.resolve(
    __dirname,
    "../../client/src/pages/purchases-page.tsx",
  );

  it("verifies InvoicesPage enforces review and confirmation for Credit Notes and Invoices", () => {
    const content = fs.readFileSync(invoicesPagePath, "utf8");

    // Must import ConfirmationDialog
    expect(content).toContain('import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"');

    // Credit note action button must review & confirm, not immediately mutate
    expect(content).toContain("Review & confirm");
    expect(content).toContain("setShowConfirmCreditNote(true)");

    // Credit Note Confirmation Dialog must have legal and tax warnings
    expect(content).toContain("Confirm GST Credit Note Issuance");
    expect(content).toContain("Statutory warning: Issuing this credit note permanently reduces legal GST tax liabilities");
    expect(content).toContain("Confirm & Post Credit Note");

    // Invoice generation must have confirmation step
    expect(content).toContain("setShowConfirmCreateInvoice(true)");
    expect(content).toContain("Confirm GST Sales Invoice Generation");
    expect(content).toContain("Financial warning: This posts an immutable sequential tax invoice to the ledger");
    expect(content).toContain("Confirm & Post Invoice");
  });

  it("verifies PaymentsPage enforces review and confirmation before posting ledger payments", () => {
    const content = fs.readFileSync(paymentsPagePath, "utf8");

    // Must import ConfirmationDialog
    expect(content).toContain('import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"');

    // Submit handler must stage payload and open confirmation modal
    expect(content).toContain("setPendingPaymentPayload");
    expect(content).toContain("setShowConfirmPayment(true)");
    expect(content).toContain("Review & confirm");

    // Confirmation dialog must display customer, amount, payment mode, and allocation notice
    expect(content).toContain("Confirm Customer Payment Posting");
    expect(content).toContain("Financial notice: This entry will immediately settle outstanding customer receivables");
    expect(content).toContain("Confirm & Post Payment");
  });

  it("verifies PurchasesPage enforces review and confirmation before posting raw goods receipts", () => {
    const content = fs.readFileSync(purchasesPagePath, "utf8");

    // Must import ConfirmationDialog
    expect(content).toContain('import { ConfirmationDialog } from "@/components/ui/confirmation-dialog"');

    // Submit button triggers validation and confirmation open
    expect(content).toContain("setShowConfirmReceipt(true)");
    expect(content).toContain("Review & confirm");

    // Confirmation dialog must display receipt number, supplier, item, and stock/payable warning
    expect(content).toContain("Confirm Purchase Receipt Posting");
    expect(content).toContain("Legal & financial warning: This transaction increases physical inventory balances");
    expect(content).toContain("Confirm & Post Inward Goods");
  });
});
