import { z } from "zod";

export const purchaseReceiptItemSchema = z.object({
  inventoryItemId: z.string().min(1, "Inventory item ID is required"),
  quantity: z.number().positive("Quantity must be positive"),
  uomId: z.string().min(1, "Unit of measure is required"),
  unitPrice: z.number().min(0, "Unit price must be non-negative"),
});

export const createPurchaseReceiptSchema = z.object({
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
});

export type PurchaseReceiptItemInput = z.infer<typeof purchaseReceiptItemSchema>;
export type CreatePurchaseReceiptInput = z.infer<typeof createPurchaseReceiptSchema>;
