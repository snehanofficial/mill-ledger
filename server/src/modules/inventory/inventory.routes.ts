import { Router } from "express";
import {
  authorize,
  requireAuth,
  type AuthenticatedRequest,
} from "../../middleware/auth.middleware.js";
import { inventoryService } from "./inventory.service.js";
import { z } from "zod";
import { AppError } from "../../middleware/error.middleware.js";

export const inventoryRouter = Router();

const createPurchaseReceiptSchema = z.object({
  organizationId: z.string().min(1),
  supplierId: z.string().min(1),
  warehouseId: z.string().min(1),
  receiptNumber: z.string().min(1),
  supplierInvoiceNumber: z.string().optional(),
  notes: z.string().optional(),
  idempotencyKey: z.string().optional(),
  items: z
    .array(
      z.object({
        inventoryItemId: z.string().min(1),
        quantity: z.number().positive(),
        uomId: z.string().min(1),
        unitPrice: z.number().min(0),
      }),
    )
    .min(1),
});

// POST /purchase-receipts (and /api/v1/inventory/purchase-receipts)
inventoryRouter.post(
  "/purchase-receipts",
  requireAuth,
  authorize("purchase", "create"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const parsed = createPurchaseReceiptSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(
          `Invalid receipt data: ${parsed.error.errors.map((e) => e.message).join(", ")}`,
          400,
        );
      }

      const receipt = await inventoryService.postPurchaseReceipt(parsed.data);
      res.status(201).json(receipt);
    } catch (err) {
      next(err);
    }
  },
);

// GET /balances
inventoryRouter.get(
  "/balances",
  requireAuth,
  authorize("inventory", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const orgId = req.query.organizationId as string;
      if (!orgId) {
        throw new AppError("organizationId query parameter is required", 400);
      }

      const warehouseId = req.query.warehouseId as string | undefined;
      const balances = await inventoryService.getInventoryBalances(
        orgId,
        warehouseId,
      );
      res.json({ balances });
    } catch (err) {
      next(err);
    }
  },
);

// GET /items/:id/ledger
inventoryRouter.get(
  "/items/:id/ledger",
  requireAuth,
  authorize("inventory", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const itemId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      if (!itemId) {
        throw new AppError("Item ID parameter is required", 400);
      }

      const warehouseId =
        typeof req.query.warehouseId === "string"
          ? req.query.warehouseId
          : undefined;

      const ledger = await inventoryService.getItemLedger(itemId, warehouseId);
      res.json({ ledger });
    } catch (err) {
      next(err);
    }
  },
);
