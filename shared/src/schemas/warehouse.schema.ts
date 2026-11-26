import { z } from "zod";

export const createFacilitySchema = z
  .object({
    code: z.string().trim().min(1, "Facility code is required").max(32),
    name: z.string().trim().min(1, "Facility name is required").max(120),
    state: z.string().trim().min(1, "State is required").default("Tamil Nadu"),
  })
  .strict();

export const updateFacilitySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    state: z.string().trim().min(1).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const createWarehouseSchema = z
  .object({
    facilityId: z.string().min(1, "Facility ID is required"),
    code: z.string().trim().min(1, "Warehouse code is required").max(32),
    name: z.string().trim().min(1, "Warehouse name is required").max(120),
  })
  .strict();

export const updateWarehouseSchema = z
  .object({
    facilityId: z.string().min(1).optional(),
    name: z.string().trim().min(1).max(120).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const stockTransferItemSchema = z
  .object({
    inventoryItemId: z.string().min(1, "Inventory item ID is required"),
    quantity: z.number().positive("Transfer quantity must be positive"),
  })
  .strict();

export const createStockTransferSchema = z
  .object({
    fromWarehouseId: z.string().min(1, "Source warehouse is required"),
    toWarehouseId: z.string().min(1, "Destination warehouse is required"),
    notes: z.string().max(500).optional(),
    idempotencyKey: z.string().optional(),
    items: z
      .array(stockTransferItemSchema)
      .min(1, "At least one item is required for transfer"),
  })
  .strict()
  .refine((data) => data.fromWarehouseId !== data.toWarehouseId, {
    message: "Source and destination warehouses must be different",
    path: ["toWarehouseId"],
  });

export type CreateFacilityInput = z.infer<typeof createFacilitySchema>;
export type UpdateFacilityInput = z.infer<typeof updateFacilitySchema>;
export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;
export type CreateStockTransferInput = z.infer<typeof createStockTransferSchema>;
