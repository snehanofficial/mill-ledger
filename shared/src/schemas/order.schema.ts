import { z } from "zod";

export const orderStatusEnum = z.enum([
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "CLOSED",
]);
export type OrderStatus = z.infer<typeof orderStatusEnum>;

export const createOrderLineSchema = z.object({
  productVariantId: z.string().min(1, "Product variant is required"),
  quantity: z.number().positive("Quantity must be positive"),
  unitPrice: z.number().min(0, "Unit price must be non-negative").optional(),
});

export const createOrderSchema = z.object({
  organizationId: z.string().min(1).optional(),
  customerId: z.string().min(1, "Customer is required"),
  warehouseId: z.string().min(1).optional(),
  orderNumber: z.string().min(1).optional(),
  notes: z.string().optional(),
  idempotencyKey: z.string().optional(),
  status: z.enum(["DRAFT", "SUBMITTED"]).optional(),
  orderDate: z.coerce.date().optional(),
  lines: z.array(createOrderLineSchema).min(1, "Order must contain at least one line"),
});

export const updateOrderLineSchema = z.object({
  productVariantId: z.string().min(1, "Product variant is required"),
  quantity: z.number().positive("Quantity must be positive"),
  unitPrice: z.number().min(0, "Unit price must be non-negative").optional(),
});

export const updateOrderSchema = z
  .object({
    creatorId: z.string().optional(),
    notes: z
      .string()
      .max(500, "Notes cannot exceed 500 characters")
      .nullable()
      .optional(),
    status: z
      .enum(["DRAFT", "SUBMITTED"], {
        errorMap: () => ({
          message:
            "Draft orders can only be updated to DRAFT or SUBMITTED status",
        }),
      })
      .optional(),
    lines: z.array(updateOrderLineSchema).min(1).optional(),
  })
  .strict();

export const approveOrderLineOverrideSchema = z.object({
  lineId: z.string().min(1, "Line ID is required"),
  approvedQuantity: z.number().positive("Approved quantity must be positive"),
  approvedUnitPrice: z.number().min(0, "Approved unit price must be non-negative").optional(),
});

export const approveOrderSchema = z.object({
  overrideReason: z.string().optional(),
  lineOverrides: z.array(approveOrderLineOverrideSchema).optional(),
  reservationTtlHours: z.number().positive().optional(),
  reservationExpiresAt: z
    .string()
    .datetime()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
});

export const rejectOrderSchema = z.object({
  reason: z.string().min(1, "Rejection reason is required"),
});

export type CreateOrderLineInput = z.infer<typeof createOrderLineSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type ApproveOrderLineOverrideInput = z.infer<typeof approveOrderLineOverrideSchema>;
export type ApproveOrderInput = z.infer<typeof approveOrderSchema>;
export type RejectOrderInput = z.infer<typeof rejectOrderSchema>;
