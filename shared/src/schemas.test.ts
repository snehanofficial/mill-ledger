import { describe, expect, it } from "vitest";
import {
  createCustomerSchema,
  updateCustomerSchema,
  createOrderSchema,
  updateOrderSchema,
  approveOrderSchema,
  rejectOrderSchema,
  createDispatchSchema,
  createDraftRunSchema,
  postProductionRunSchema,
  reverseRunSchema,
  createPurchaseReceiptSchema,
  createInvoiceSchema,
  creditNoteSchema,
  debitNoteSchema,
  setTaxRateSchema,
  recordPaymentSchema,
  bouncePaymentSchema,
  gstinSchema,
} from "./index.js";

describe("F-031 Shared Domain Validation Schemas Contract Parity", () => {
  it("exports all required domain schemas from shared package", () => {
    expect(createCustomerSchema).toBeDefined();
    expect(updateCustomerSchema).toBeDefined();
    expect(createOrderSchema).toBeDefined();
    expect(updateOrderSchema).toBeDefined();
    expect(approveOrderSchema).toBeDefined();
    expect(rejectOrderSchema).toBeDefined();
    expect(createDispatchSchema).toBeDefined();
    expect(createDraftRunSchema).toBeDefined();
    expect(postProductionRunSchema).toBeDefined();
    expect(reverseRunSchema).toBeDefined();
    expect(createPurchaseReceiptSchema).toBeDefined();
    expect(createInvoiceSchema).toBeDefined();
    expect(creditNoteSchema).toBeDefined();
    expect(debitNoteSchema).toBeDefined();
    expect(setTaxRateSchema).toBeDefined();
    expect(recordPaymentSchema).toBeDefined();
    expect(bouncePaymentSchema).toBeDefined();
    expect(gstinSchema).toBeDefined();
  });

  it("validates customer schema (valid and invalid)", () => {
    const valid = {
      code: "CUST-001",
      name: "Test Customer",
      state: "Tamil Nadu",
      gstin: "33AABCM1234F1Z1",
    };
    expect(createCustomerSchema.safeParse(valid).success).toBe(true);

    const invalid = {
      code: "CUST-001",
      name: "Test Customer",
      email: "invalid-email-address",
    };
    expect(createCustomerSchema.safeParse(invalid).success).toBe(false);
  });

  it("validates sales order schema (valid and invalid)", () => {
    const valid = {
      customerId: "cust_123",
      lines: [
        {
          productVariantId: "variant_123",
          quantity: 25,
          unitPrice: 100,
        },
      ],
    };
    expect(createOrderSchema.safeParse(valid).success).toBe(true);

    const emptyLines = {
      customerId: "cust_123",
      lines: [],
    };
    expect(createOrderSchema.safeParse(emptyLines).success).toBe(false);

    const zeroQuantity = {
      customerId: "cust_123",
      lines: [
        {
          productVariantId: "variant_123",
          quantity: 0,
        },
      ],
    };
    expect(createOrderSchema.safeParse(zeroQuantity).success).toBe(false);
  });

  it("validates dispatch schema", () => {
    const valid = {
      salesOrderId: "order_123",
      vehicleNumber: "TN01AB1234",
    };
    expect(createDispatchSchema.safeParse(valid).success).toBe(true);
    expect(createDispatchSchema.safeParse({}).success).toBe(false);
  });

  it("validates production schemas", () => {
    const validDraft = {
      organizationId: "MILL",
      warehouseId: "wh_1",
      recipeId: "rec_1",
      runNumber: "PR-001",
    };
    expect(createDraftRunSchema.safeParse(validDraft).success).toBe(true);

    const validPost = {
      organizationId: "MILL",
      actualGoodQty: 50,
      consumedMaterials: [
        {
          inventoryItemId: "item_1",
          actualQty: 60,
        },
      ],
    };
    expect(postProductionRunSchema.safeParse(validPost).success).toBe(true);

    const emptyMaterials = {
      organizationId: "MILL",
      actualGoodQty: 50,
      consumedMaterials: [],
    };
    expect(postProductionRunSchema.safeParse(emptyMaterials).success).toBe(false);
  });

  it("validates inventory purchase receipt schema", () => {
    const valid = {
      organizationId: "MILL",
      supplierId: "supp_1",
      warehouseId: "wh_1",
      receiptNumber: "REC-001",
      items: [
        {
          inventoryItemId: "item_1",
          quantity: 10,
          uomId: "uom_1",
          unitPrice: 15,
        },
      ],
    };
    expect(createPurchaseReceiptSchema.safeParse(valid).success).toBe(true);

    const negativePrice = {
      ...valid,
      items: [
        {
          inventoryItemId: "item_1",
          quantity: 10,
          uomId: "uom_1",
          unitPrice: -1,
        },
      ],
    };
    expect(createPurchaseReceiptSchema.safeParse(negativePrice).success).toBe(false);
  });

  it("validates finance and payment schemas", () => {
    const validInvoice = {
      salesOrderId: "so_123",
    };
    expect(createInvoiceSchema.safeParse(validInvoice).success).toBe(true);

    const validPayment = {
      customerId: "cust_123",
      amount: 1500,
      paymentMode: "UPI" as const,
      allocations: [
        {
          salesInvoiceId: "inv_123",
          amount: 1500,
        },
      ],
    };
    expect(recordPaymentSchema.safeParse(validPayment).success).toBe(true);

    const invalidAmount = {
      customerId: "cust_123",
      amount: -10,
    };
    expect(recordPaymentSchema.safeParse(invalidAmount).success).toBe(false);
  });

  describe("F-032 Strict Mode Rejection of Unknown Fields", () => {
    it("rejects unknown fields on createCustomerSchema", () => {
      const res = createCustomerSchema.safeParse({
        code: "CUST-001",
        name: "Test Customer",
        __unexpectedField: "malicious_or_typo",
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].code).toBe("unrecognized_keys");
      }
    });

    it("rejects unknown fields on createOrderSchema and createOrderLineSchema", () => {
      const rootRes = createOrderSchema.safeParse({
        customerId: "cust_123",
        lines: [{ productVariantId: "variant_123", quantity: 10 }],
        specialDiscountPercentage: 15,
      });
      expect(rootRes.success).toBe(false);
      if (!rootRes.success) {
        expect(rootRes.error.issues[0].code).toBe("unrecognized_keys");
      }

      const lineRes = createOrderSchema.safeParse({
        customerId: "cust_123",
        lines: [
          {
            productVariantId: "variant_123",
            quantity: 10,
            extraUnknownLineField: 123,
          },
        ],
      });
      expect(lineRes.success).toBe(false);
      if (!lineRes.success) {
        expect(lineRes.error.issues[0].code).toBe("unrecognized_keys");
      }
    });

    it("rejects unknown fields on createDispatchSchema", () => {
      const res = createDispatchSchema.safeParse({
        salesOrderId: "order_123",
        unknownProperty: "value",
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].code).toBe("unrecognized_keys");
      }
    });

    it("rejects unknown fields on production schemas", () => {
      const draftRes = createDraftRunSchema.safeParse({
        organizationId: "MILL",
        warehouseId: "wh_1",
        recipeId: "rec_1",
        runNumber: "PR-001",
        unknownProp: 123,
      });
      expect(draftRes.success).toBe(false);
      if (!draftRes.success) {
        expect(draftRes.error.issues[0].code).toBe("unrecognized_keys");
      }

      const postRes = postProductionRunSchema.safeParse({
        organizationId: "MILL",
        actualGoodQty: 50,
        consumedMaterials: [
          {
            inventoryItemId: "item_1",
            actualQty: 60,
            unknownMaterialField: true,
          },
        ],
      });
      expect(postRes.success).toBe(false);
      if (!postRes.success) {
        expect(postRes.error.issues[0].code).toBe("unrecognized_keys");
      }
    });

    it("rejects unknown fields on inventory purchase receipt schema", () => {
      const res = createPurchaseReceiptSchema.safeParse({
        organizationId: "MILL",
        supplierId: "supp_1",
        warehouseId: "wh_1",
        receiptNumber: "REC-001",
        items: [
          {
            inventoryItemId: "item_1",
            quantity: 10,
            uomId: "uom_1",
            unitPrice: 15,
          },
        ],
        extraPurchaseField: "bad",
      });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues[0].code).toBe("unrecognized_keys");
      }
    });

    it("rejects unknown fields on finance & payment schemas", () => {
      const invoiceRes = createInvoiceSchema.safeParse({
        salesOrderId: "so_123",
        bogusTaxField: 99,
      });
      expect(invoiceRes.success).toBe(false);
      if (!invoiceRes.success) {
        expect(invoiceRes.error.issues[0].code).toBe("unrecognized_keys");
      }

      const paymentRes = recordPaymentSchema.safeParse({
        customerId: "cust_123",
        amount: 1500,
        paymentMode: "UPI",
        unexpectedPaymentKey: "discardMe",
      });
      expect(paymentRes.success).toBe(false);
      if (!paymentRes.success) {
        expect(paymentRes.error.issues[0].code).toBe("unrecognized_keys");
      }
    });

    it("accepts zero taxAmount on creditNoteSchema and debitNoteSchema for tax-exempt adjustments", () => {
      const creditRes = creditNoteSchema.safeParse({
        reason: "Non-GST commercial discount",
        taxableAmount: 100,
        taxAmount: 0,
        totalAmount: 100,
      });
      expect(creditRes.success).toBe(true);

      const debitRes = debitNoteSchema.safeParse({
        supplierId: "sup_123",
        reason: "Zero-tax grain moisture deduction",
        taxableAmount: 10,
        taxAmount: 0,
        totalAmount: 10,
      });
      expect(debitRes.success).toBe(true);

      const negDebitRes = debitNoteSchema.safeParse({
        supplierId: "sup_123",
        reason: "Negative tax disallowed",
        taxableAmount: 10,
        taxAmount: -1,
        totalAmount: 9,
      });
      expect(negDebitRes.success).toBe(false);
    });
  });
});
