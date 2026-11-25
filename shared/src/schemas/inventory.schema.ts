import { z } from "zod";
import { gstinSchema } from "./gstin.schema.js";

export const createSupplierSchema = z
  .object({
    organizationId: z.string().min(1).optional(),
    code: z.string().min(1, "Supplier code is required"),
    name: z.string().min(1, "Supplier name is required"),
    phone: z.string().nullable().optional(),
    email: z.string().email("Invalid email format").nullable().optional(),
    state: z.string().min(1, "State is required").default("Tamil Nadu"),
    gstin: gstinSchema.nullable().optional(),
    isActive: z.boolean().optional().default(true),
  })
  .strict();

export const updateSupplierSchema = z
  .object({
    name: z.string().min(1).optional(),
    phone: z.string().nullable().optional(),
    email: z.string().email("Invalid email format").nullable().optional(),
    state: z.string().min(1).optional(),
    gstin: gstinSchema.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

export const purchaseReceiptItemSchema = z
  .object({
    inventoryItemId: z.string().min(1, "Inventory item ID is required"),
    quantity: z.number().positive("Quantity must be positive"),
    uomId: z.string().min(1, "Unit of measure is required"),
    unitPrice: z.number().min(0, "Unit price must be non-negative"),
  })
  .strict();

export const createPurchaseReceiptSchema = z
  .object({
    organizationId: z.string().min(1, "Organization ID is required"),
    supplierId: z.string().min(1, "Supplier ID is required"),
    warehouseId: z.string().min(1, "Warehouse ID is required"),
    receiptNumber: z.string().min(1, "Receipt number is required"),
    supplierInvoiceNumber: z.string().optional(),
    notes: z.string().optional(),
    idempotencyKey: z.string().optional(),
    items: z
      .array(purchaseReceiptItemSchema)
      .min(1, "At least one item is required"),
  })
  .strict();

export type PurchaseReceiptItemInput = z.infer<
  typeof purchaseReceiptItemSchema
>;
export type CreatePurchaseReceiptInput = z.infer<
  typeof createPurchaseReceiptSchema
>;
