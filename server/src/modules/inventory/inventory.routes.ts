import { Router } from "express";
import {
  authorize,
  requireAuth,
  type AuthenticatedRequest,
} from "../../middleware/auth.middleware.js";
import { inventoryService } from "./inventory.service.js";
import { AppError } from "../../middleware/error.middleware.js";
import {
  createSupplierSchema,
  updateSupplierSchema,
} from "@mill-ledger/shared";
import {
  handlePostPurchaseReceipt,
  handleGetPurchaseReceipts,
  handleGetSuppliers,
} from "./purchase.routes.js";

export const inventoryRouter = Router();

// POST /purchase-receipts (mounted under /api/v1/inventory)
inventoryRouter.post(
  "/purchase-receipts",
  requireAuth,
  authorize("purchase", "create"),
  handlePostPurchaseReceipt,
);

// GET /purchase-receipts (mounted under /api/v1/inventory)
inventoryRouter.get(
  "/purchase-receipts",
  requireAuth,
  authorize("purchase", "read"),
  handleGetPurchaseReceipts,
);

// GET /suppliers (mounted under /api/v1/inventory)
inventoryRouter.get(
  "/suppliers",
  requireAuth,
  authorize("purchase", "read"),
  handleGetSuppliers,
);

// POST /suppliers (create new supplier - F-038)
inventoryRouter.post(
  "/suppliers",
  requireAuth,
  authorize("purchase", "create"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const parsed = createSupplierSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }
      const supplier = await inventoryService.createSupplier(
        parsed.data,
        req.user,
      );
      res.status(201).json({ status: "created", supplier });
    } catch (err) {
      next(err);
    }
  },
);

// GET /suppliers/:id (get supplier by ID - F-038)
inventoryRouter.get(
  "/suppliers/:id",
  requireAuth,
  authorize("purchase", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      if (!id) {
        throw new AppError("Supplier ID parameter is required", 400);
      }
      const supplier = await inventoryService.getSupplierById(id);
      res.json({ supplier });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /suppliers/:id (update existing supplier - F-038)
inventoryRouter.put(
  "/suppliers/:id",
  requireAuth,
  authorize("purchase", "update"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      if (!id) {
        throw new AppError("Supplier ID parameter is required", 400);
      }
      const parsed = updateSupplierSchema.safeParse(req.body);
      if (!parsed.success) {
        throw parsed.error;
      }
      const supplier = await inventoryService.updateSupplier(
        id,
        parsed.data,
        req.user,
      );
      res.json({ status: "updated", supplier });
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
