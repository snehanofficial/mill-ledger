import { z } from "zod";

export const createDraftRunSchema = z
  .object({
    organizationId: z.string().min(1).optional(),
    warehouseId: z.string().min(1, "Warehouse ID is required"),
    recipeId: z.string().min(1, "Recipe ID is required"),
    runNumber: z.string().min(1, "Run number is required"),
    batchCount: z.number().positive("Batch count must be positive").optional(),
    notes: z.string().optional(),
    idempotencyKey: z.string().optional(),
  })
  .strict();

export const consumedMaterialSchema = z
  .object({
    inventoryItemId: z.string().min(1, "Inventory item ID is required"),
    actualQty: z.number().min(0, "Actual quantity must be non-negative"),
    damagedQty: z
      .number()
      .min(0, "Damaged quantity must be non-negative")
      .optional(),
  })
  .strict();

export const postProductionRunSchema = z
  .object({
    organizationId: z.string().min(1).optional(),
    warehouseId: z.string().min(1).optional(),
    recipeId: z.string().min(1).optional(),
    runNumber: z.string().min(1).optional(),
    batchCount: z.number().positive("Batch count must be positive").optional(),
    actualGoodQty: z.number().positive("Actual good quantity must be positive"),
    actualRejectedQty: z
      .number()
      .min(0, "Actual rejected quantity must be non-negative")
      .optional(),
    directLaborCost: z
      .number()
      .min(0, "Direct labor cost must be non-negative")
      .optional(),
    utilityCost: z
      .number()
      .min(0, "Utility cost must be non-negative")
      .optional(),
    notes: z.string().optional(),
    idempotencyKey: z.string().optional(),
    consumedMaterials: z
      .array(consumedMaterialSchema)
      .min(1, "At least one consumed material is required"),
  })
  .strict();

export const reverseRunSchema = z
  .object({
    reason: z.string().min(1, "Reversal reason is required"),
  })
  .strict();

export type CreateDraftRunInput = z.infer<typeof createDraftRunSchema>;
export type ConsumedMaterialInput = z.infer<typeof consumedMaterialSchema>;
export type PostProductionRunInput = z.infer<typeof postProductionRunSchema>;
export type ReverseRunInput = z.infer<typeof reverseRunSchema>;
