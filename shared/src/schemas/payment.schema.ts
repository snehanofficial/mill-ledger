import { z } from "zod";

export const paymentModeEnum = z.enum([
  "CASH",
  "BANK_TRANSFER",
  "UPI",
  "CHEQUE",
  "DEMAND_DRAFT",
]);
export type PaymentMode = z.infer<typeof paymentModeEnum>;

export const paymentAllocationSchema = z.object({
  salesInvoiceId: z.string().min(1, "Invoice ID is required"),
  amount: z.number().positive("Allocation amount must be positive"),
});

export const recordPaymentSchema = z.object({
  customerId: z.string().min(1, "Customer ID is required"),
  amount: z.number().positive("Amount must be greater than zero"),
  paymentMode: paymentModeEnum.optional(),
  referenceNumber: z.string().optional(),
  paymentDate: z.coerce.date().optional(),
  notes: z.string().optional(),
  idempotencyKey: z.string().optional(),
  allocations: z.array(paymentAllocationSchema).optional(),
});

export const bouncePaymentSchema = z.object({
  reason: z.string().min(1, "Bounce reason is required"),
  referenceNumber: z.string().optional(),
  bouncedAt: z.coerce.date().optional(),
  idempotencyKey: z.string().optional(),
});

export type PaymentAllocationInput = z.infer<typeof paymentAllocationSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type BouncePaymentInput = z.infer<typeof bouncePaymentSchema>;
