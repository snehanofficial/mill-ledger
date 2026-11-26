import { Router } from "express";
import {
  authorize,
  getSessionOrgId,
  requireAuth,
  type AuthenticatedRequest,
} from "../../middleware/auth.middleware.js";
import { inventoryService } from "./inventory.service.js";
import { AppError } from "../../middleware/error.middleware.js";
import {
  createSupplierSchema,
  updateSupplierSchema,
  createStockTransferSchema,
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

// GET /purchase-receipts/:id (IMP-015)
inventoryRouter.get(
  "/purchase-receipts/:id",
  requireAuth,
  authorize("purchase", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) throw new AppError("Receipt ID is required", 400);
      const receipt = await inventoryService.getPurchaseReceiptById(id);
      res.json({ receipt });
    } catch (err) {
      next(err);
    }
  },
);

// POST /purchase-receipts/:id/reverse (IMP-015)
inventoryRouter.post(
  "/purchase-receipts/:id/reverse",
  requireAuth,
  authorize("purchase", "update"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) throw new AppError("Receipt ID is required", 400);
      const result = await inventoryService.reversePurchaseReceipt(
        id,
        req.body?.reason || "",
        req.user,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
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
      const orgId = getSessionOrgId(req);

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

      const orgId = getSessionOrgId(req);
      const warehouseId =
        typeof req.query.warehouseId === "string"
          ? req.query.warehouseId
          : undefined;

      const ledger = await inventoryService.getItemLedger(
        itemId,
        warehouseId,
        orgId,
      );
      res.json({ ledger });
    } catch (err) {
      next(err);
    }
  },
);

// POST /items - Create inventory item (IMP-012)
inventoryRouter.post(
  "/items",
  requireAuth,
  authorize("inventory", "create"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const orgId = getSessionOrgId(req);
      const item = await inventoryService.createInventoryItem(
        { ...(req.body || {}), organizationId: orgId },
        req.user,
      );
      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /items/:id - Update/archive inventory item (IMP-012)
inventoryRouter.put(
  "/items/:id",
  requireAuth,
  authorize("inventory", "update"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) throw new AppError("Item ID is required", 400);
      const item = await inventoryService.updateInventoryItem(
        id,
        req.body || {},
        req.user,
      );
      res.json({ item });
    } catch (err) {
      next(err);
    }
  },
);

// POST /adjustments - Post audited stock adjustment (IMP-012)
inventoryRouter.post(
  "/adjustments",
  requireAuth,
  authorize("inventory", "update"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const orgId = getSessionOrgId(req);
      const result = await inventoryService.postStockAdjustment(
        { ...(req.body || {}), organizationId: orgId },
        req.user,
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// GET /transfers - List inter-warehouse stock transfers
inventoryRouter.get(
  "/transfers",
  requireAuth,
  authorize("inventory", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const orgId = getSessionOrgId(req);
      const transfers = await inventoryService.getStockTransfers(orgId);
      res.json({ transfers });
    } catch (err) {
      next(err);
    }
  },
);

// POST /transfers - Post inter-warehouse stock transfer
inventoryRouter.post(
  "/transfers",
  requireAuth,
  authorize("inventory", "update"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const orgId = getSessionOrgId(req);
      const parsed = createStockTransferSchema.safeParse(req.body);
      if (!parsed.success) throw parsed.error;
      const transfer = await inventoryService.postStockTransfer(
        orgId,
        parsed.data,
        req.user,
      );
      res.status(201).json({ transfer });
    } catch (err) {
      next(err);
    }
  },
);

// GET /reconciliation - Warehouse stock balance reconciliation
inventoryRouter.get(
  "/reconciliation",
  requireAuth,
  authorize("inventory", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const orgId = getSessionOrgId(req);
      const warehouseId =
        typeof req.query.warehouseId === "string"
          ? req.query.warehouseId
          : undefined;
      const report = await inventoryService.getStockReconciliation(
        orgId,
        warehouseId,
      );
      res.json(report);
    } catch (err) {
      next(err);
    }
  },
);

// GET /uoms - List UOMs and conversions (IMP-012)
inventoryRouter.get(
  "/uoms",
  requireAuth,
  authorize("inventory", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const orgId = getSessionOrgId(req);
      const data = await inventoryService.getUomsAndConversions(orgId);
      res.json(data);
    } catch (err) {
      next(err);
    }
  },
);

// POST /uoms - Create UOM (IMP-012)
inventoryRouter.post(
  "/uoms",
  requireAuth,
  authorize("inventory", "create"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const uom = await inventoryService.createUom(req.body, req.user);
      res.status(201).json({ uom });
    } catch (err) {
      next(err);
    }
  },
);

// POST /unit-conversions - Create UOM conversion (IMP-012)
inventoryRouter.post(
  "/unit-conversions",
  requireAuth,
  authorize("inventory", "create"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const conversion = await inventoryService.createUnitConversion(
        req.body,
        req.user,
      );
      res.status(201).json({ conversion });
    } catch (err) {
      next(err);
    }
  },
);
