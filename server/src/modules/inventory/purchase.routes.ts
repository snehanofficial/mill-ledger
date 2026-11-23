import { Router, type Response, type NextFunction } from "express";
import {
  authorize,
  requireAuth,
  type AuthenticatedRequest,
} from "../../middleware/auth.middleware.js";
import { inventoryService } from "./inventory.service.js";
import { z } from "zod";
import { AppError } from "../../middleware/error.middleware.js";

export const purchaseRouter = Router();

export const createPurchaseReceiptSchema = z.object({
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

export async function handlePostPurchaseReceipt(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
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
}

export async function handleGetPurchaseReceipts(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const orgId =
      (req.query.organizationId as string) ||
      req.user?.organizationId ||
      "MILL";
    const receipts = await inventoryService.getPurchaseReceipts(orgId);
    res.json({ receipts });
  } catch (err) {
    next(err);
  }
}

export async function handleGetSuppliers(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const orgId =
      (req.query.organizationId as string) ||
      req.user?.organizationId ||
      "MILL";
    const suppliers = await inventoryService.getSuppliers(orgId);
    res.json({ suppliers });
  } catch (err) {
    next(err);
  }
}

// Router-level authentication & authorization for purchase subsystem
// Requires 'purchase' resource permissions (OWASP A01:2021 & API5:2023 - F-021)
purchaseRouter.use(requireAuth);
purchaseRouter.use((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const action = req.method === "POST" ? "create" : "read";
  return authorize("purchase", action)(req, res, next);
});

// Primary endpoints mounted under /api/v1/purchase-receipts
purchaseRouter.post("/", handlePostPurchaseReceipt);
purchaseRouter.get("/", handleGetPurchaseReceipts);

// Legacy alias endpoints if callers query /api/v1/purchase-receipts/purchase-receipts
purchaseRouter.post("/purchase-receipts", handlePostPurchaseReceipt);
purchaseRouter.get("/purchase-receipts", handleGetPurchaseReceipts);

purchaseRouter.get("/suppliers", handleGetSuppliers);
