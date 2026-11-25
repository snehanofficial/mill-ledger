import { describe, expect, it } from "vitest";
import {
  createCustomerSchema,
  updateCustomerSchema,
  createOrderSchema,
  createOrderLineSchema,
  updateOrderSchema,
  updateOrderLineSchema,
  approveOrderSchema,
  rejectOrderSchema,
  createDispatchSchema,
  createDispatchLineSchema,
  createDraftRunSchema,
  consumedMaterialSchema,
  postProductionRunSchema,
  reverseRunSchema,
  createPurchaseReceiptSchema,
  purchaseReceiptItemSchema,
  createInvoiceSchema,
  creditNoteSchema,
  debitNoteSchema,
  debitNoteLineSchema,
  setTaxRateSchema,
  recordPaymentSchema,
  paymentAllocationSchema,
  bouncePaymentSchema,
} from "../../shared/src/index.js";

describe("F-032 Regression Test: Zod Strict Mode Enforced Across Domain Schemas", () => {
  it("rejects unrecognized keys on createCustomerSchema and updateCustomerSchema", () => {
    const custRes = createCustomerSchema.safeParse({
      code: "CUST-001",
      name: "Test Customer",
      __unexpectedProp: "tampered_value",
    });
    expect(custRes.success).toBe(false);
    if (!custRes.success) {
      expect(custRes.error.issues[0].code).toBe("unrecognized_keys");
    }

    const updateRes = updateCustomerSchema.safeParse({
      name: "Updated Name",
      unknownKey: true,
    });
    expect(updateRes.success).toBe(false);
    if (!updateRes.success) {
      expect(updateRes.error.issues[0].code).toBe("unrecognized_keys");
    }
  });

  it("rejects unrecognized keys on createOrderSchema, lines, and order approval schemas", () => {
    const orderRes = createOrderSchema.safeParse({
      customerId: "cust_1",
      lines: [{ productVariantId: "var_1", quantity: 5 }],
      specialDiscountPercentage: 15,
    });
    expect(orderRes.success).toBe(false);
    if (!orderRes.success) {
      expect(orderRes.error.issues[0].code).toBe("unrecognized_keys");
    }

    const lineRes = createOrderLineSchema.safeParse({
      productVariantId: "var_1",
      quantity: 5,
      hackedPrice: 0.01,
    });
    expect(lineRes.success).toBe(false);
    if (!lineRes.success) {
      expect(lineRes.error.issues[0].code).toBe("unrecognized_keys");
    }

    const updateOrderRes = updateOrderSchema.safeParse({
      notes: "some notes",
      rogueProperty: "bad",
    });
    expect(updateOrderRes.success).toBe(false);
    if (!updateOrderRes.success) {
      expect(updateOrderRes.error.issues[0].code).toBe("unrecognized_keys");
    }

    const updateLineRes = updateOrderLineSchema.safeParse({
      productVariantId: "var_1",
      quantity: 10,
      unknownDiscount: 100,
    });
    expect(updateLineRes.success).toBe(false);
    if (!updateLineRes.success) {
      expect(updateLineRes.error.issues[0].code).toBe("unrecognized_keys");
    }

    const approveRes = approveOrderSchema.safeParse({
      notes: "approved",
      bypassCreditCheck: true,
    });
    expect(approveRes.success).toBe(false);
    if (!approveRes.success) {
      expect(approveRes.error.issues[0].code).toBe("unrecognized_keys");
    }

    const rejectRes = rejectOrderSchema.safeParse({
      reason: "Bad credit",
      extraBogusField: "val",
    });
    expect(rejectRes.success).toBe(false);
    if (!rejectRes.success) {
      expect(rejectRes.error.issues[0].code).toBe("unrecognized_keys");
    }
  });

  it("rejects unrecognized keys on createDispatchSchema and lines", () => {
    const dispatchRes = createDispatchSchema.safeParse({
      salesOrderId: "so_1",
      carrierNotes: "fast track",
    });
    expect(dispatchRes.success).toBe(false);
    if (!dispatchRes.success) {
      expect(dispatchRes.error.issues[0].code).toBe("unrecognized_keys");
    }

    const dispatchLineRes = createDispatchLineSchema.safeParse({
      salesOrderLineId: "sol_1",
      quantity: 5,
      stolenGoods: true,
    });
    expect(dispatchLineRes.success).toBe(false);
    if (!dispatchLineRes.success) {
      expect(dispatchLineRes.error.issues[0].code).toBe("unrecognized_keys");
    }
  });

  it("rejects unrecognized keys on production schemas (draft, post, reversal, consumed)", () => {
    const draftRes = createDraftRunSchema.safeParse({
      organizationId: "MILL",
      warehouseId: "wh_1",
      recipeId: "rec_1",
      runNumber: "PR-01",
      spoofedTimestamp: "2020-01-01",
    });
    expect(draftRes.success).toBe(false);
    if (!draftRes.success) {
      expect(draftRes.error.issues[0].code).toBe("unrecognized_keys");
    }

    const consumedRes = consumedMaterialSchema.safeParse({
      inventoryItemId: "item_1",
      actualQty: 10,
      untrackedDeduction: 5,
    });
    expect(consumedRes.success).toBe(false);
    if (!consumedRes.success) {
      expect(consumedRes.error.issues[0].code).toBe("unrecognized_keys");
    }

    const postRes = postProductionRunSchema.safeParse({
      organizationId: "MILL",
      actualGoodQty: 10,
      consumedMaterials: [{ inventoryItemId: "item_1", actualQty: 10 }],
      phantomYieldBonus: 50,
    });
    expect(postRes.success).toBe(false);
    if (!postRes.success) {
      expect(postRes.error.issues[0].code).toBe("unrecognized_keys");
    }

    const reverseRes = reverseRunSchema.safeParse({
      reason: "Defective output",
      skipAuditTrail: true,
    });
    expect(reverseRes.success).toBe(false);
    if (!reverseRes.success) {
      expect(reverseRes.error.issues[0].code).toBe("unrecognized_keys");
    }
  });

  it("rejects unrecognized keys on inventory purchase receipt schemas", () => {
    const itemRes = purchaseReceiptItemSchema.safeParse({
      inventoryItemId: "item_1",
      quantity: 10,
      uomId: "uom_1",
      unitPrice: 20,
      tamperedTaxAmount: 0,
    });
    expect(itemRes.success).toBe(false);
    if (!itemRes.success) {
      expect(itemRes.error.issues[0].code).toBe("unrecognized_keys");
    }

    const receiptRes = createPurchaseReceiptSchema.safeParse({
      organizationId: "MILL",
      supplierId: "supp_1",
      warehouseId: "wh_1",
      receiptNumber: "REC-1",
      items: [
        {
          inventoryItemId: "item_1",
          quantity: 10,
          uomId: "uom_1",
          unitPrice: 20,
        },
      ],
      forgedSignature: "valid",
    });
    expect(receiptRes.success).toBe(false);
    if (!receiptRes.success) {
      expect(receiptRes.error.issues[0].code).toBe("unrecognized_keys");
    }
  });

  it("rejects unrecognized keys on finance & payment schemas", () => {
    const invoiceRes = createInvoiceSchema.safeParse({
      salesOrderId: "so_1",
      bypassTaxation: true,
    });
    expect(invoiceRes.success).toBe(false);
    if (!invoiceRes.success) {
      expect(invoiceRes.error.issues[0].code).toBe("unrecognized_keys");
    }

    const creditNoteRes = creditNoteSchema.safeParse({
      reason: "Discount",
      extraKey: 123,
    });
    expect(creditNoteRes.success).toBe(false);
    if (!creditNoteRes.success) {
      expect(creditNoteRes.error.issues[0].code).toBe("unrecognized_keys");
    }

    const debitLineRes = debitNoteLineSchema.safeParse({
      taxableAmount: 100,
      taxAmount: 18,
      totalAmount: 118,
      badProperty: "bad",
    });
    expect(debitLineRes.success).toBe(false);
    if (!debitLineRes.success) {
      expect(debitLineRes.error.issues[0].code).toBe("unrecognized_keys");
    }

    const debitRes = debitNoteSchema.safeParse({
      supplierId: "supp_1",
      reason: "Price difference",
      fakeField: "test",
    });
    expect(debitRes.success).toBe(false);
    if (!debitRes.success) {
      expect(debitRes.error.issues[0].code).toBe("unrecognized_keys");
    }

    const taxRes = setTaxRateSchema.safeParse({
      hsnCode: "10063010",
      rate: 5,
      effectiveFrom: "2026-01-01",
      overrideStateTax: true,
    });
    expect(taxRes.success).toBe(false);
    if (!taxRes.success) {
      expect(taxRes.error.issues[0].code).toBe("unrecognized_keys");
    }

    const allocRes = paymentAllocationSchema.safeParse({
      salesInvoiceId: "inv_1",
      amount: 100,
      skipLedgerEntry: true,
    });
    expect(allocRes.success).toBe(false);
    if (!allocRes.success) {
      expect(allocRes.error.issues[0].code).toBe("unrecognized_keys");
    }

    const paymentRes = recordPaymentSchema.safeParse({
      customerId: "cust_1",
      amount: 100,
      paymentMode: "CASH",
      unauthorizedRebate: 20,
    });
    expect(paymentRes.success).toBe(false);
    if (!paymentRes.success) {
      expect(paymentRes.error.issues[0].code).toBe("unrecognized_keys");
    }

    const bounceRes = bouncePaymentSchema.safeParse({
      reason: "Insufficient funds",
      autoForgivePenalty: true,
    });
    expect(bounceRes.success).toBe(false);
    if (!bounceRes.success) {
      expect(bounceRes.error.issues[0].code).toBe("unrecognized_keys");
    }
  });
});
