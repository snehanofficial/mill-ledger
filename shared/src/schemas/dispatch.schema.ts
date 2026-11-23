import { z } from "zod";

export const createDispatchLineSchema = z.object({
  salesOrderLineId: z.string().min(1, "Sales order line ID is required"),
  quantity: z.number().positive("Quantity must be positive").optional(),
});

export const createDispatchSchema = z.object({
  salesOrderId: z.string().min(1, "Sales order ID is required"),
  warehouseId: z.string().optional(),
  vehicleNumber: z.string().optional(),
  driverName: z.string().optional(),
  driverPhone: z.string().optional(),
  notes: z.string().optional(),
  idempotencyKey: z.string().optional(),
  lines: z.array(createDispatchLineSchema).optional(),
});

export type CreateDispatchLineInput = z.infer<typeof createDispatchLineSchema>;
export type CreateDispatchInput = z.infer<typeof createDispatchSchema>;
