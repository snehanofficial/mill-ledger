import { z } from "zod";

export const createInvoiceSchema = z
  .object({
    salesOrderId: z.string().min(1, "Sales order ID is required"),
    notes: z.string().optional(),
    dueDate: z.coerce.date().optional(),
    invoiceDate: z.coerce.date().optional(),
    idempotencyKey: z.string().optional(),
  })
  .strict();

export const creditNoteSchema = z
  .object({
    reason: z.string().min(1, "Reason is required"),
    taxableAmount: z.number().positive().optional(),
    taxAmount: z.number().nonnegative().optional(),
    totalAmount: z.number().positive().optional(),
  })
  .strict();

export const debitNoteLineSchema = z
  .object({
    inventoryItemId: z.string().optional(),
    description: z.string().optional(),
    quantity: z.number().positive().optional(),
    uomId: z.string().optional(),
    unitPrice: z.number().positive().optional(),
    taxableAmount: z.number(),
    taxAmount: z.number(),
    totalAmount: z.number().positive(),
  })
  .strict();

export const debitNoteSchema = z
  .object({
    supplierId: z.string().min(1, "Supplier ID is required"),
    purchaseReceiptId: z.string().optional(),
    reason: z.string().min(1, "Reason is required"),
    totalAmount: z.number().positive().optional(),
    taxableAmount: z.number().positive().optional(),
    taxAmount: z.number().nonnegative().optional(),
    lines: z.array(debitNoteLineSchema).optional(),
  })
  .strict();

export const setTaxRateSchema = z
  .object({
    hsnCode: z.string().min(1, "HSN code is required"),
    rate: z.number().min(0, "Rate must be non-negative"),
    cgstRate: z.number().min(0).optional(),
    sgstRate: z.number().min(0).optional(),
    igstRate: z.number().min(0).optional(),
    effectiveFrom: z.coerce.date(),
    effectiveTo: z.coerce.date().nullable().optional(),
  })
  .strict();

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type CreditNoteInput = z.infer<typeof creditNoteSchema>;
export type DebitNoteLineInput = z.infer<typeof debitNoteLineSchema>;
export type DebitNoteInput = z.infer<typeof debitNoteSchema>;
export type SetTaxRateInput = z.infer<typeof setTaxRateSchema>;
