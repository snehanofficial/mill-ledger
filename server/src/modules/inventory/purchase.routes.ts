import { Router, type Response, type NextFunction } from "express";
import {
  authorize,
  getSessionOrgId,
  requireAuth,
  type AuthenticatedRequest,
} from "../../middleware/auth.middleware.js";
import { inventoryService } from "./inventory.service.js";
import {
  createPurchaseReceiptSchema,
  createSupplierSchema,
  updateSupplierSchema,
} from "@mill-ledger/shared";
import { parsePaginationQuery } from "../../utils/pagination.js";

export {
  createPurchaseReceiptSchema,
  createSupplierSchema,
  updateSupplierSchema,
};

export const purchaseRouter = Router();

export async function handlePostPurchaseReceipt(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsed = createPurchaseReceiptSchema.safeParse(req.body);
    if (!parsed.success) {
      throw parsed.error;
    }

    const receipt = await inventoryService.postPurchaseReceipt(
      { ...parsed.data, organizationId: getSessionOrgId(req) },
      req.user,
    );
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
    const orgId = getSessionOrgId(req);
    const { limit, offset } = parsePaginationQuery(req.query);
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const result = await inventoryService.getPurchaseReceiptsPaginated(orgId, {
      q,
      limit,
      offset,
    });
    res.json(result);
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
    const orgId = getSessionOrgId(req);
    const includeInactive = req.query.includeInactive === "true";
    const status =
      typeof req.query.status === "string" ? req.query.status : undefined;
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const { limit, offset } = parsePaginationQuery(req.query);
    const result = await inventoryService.getSuppliersPaginated(orgId, {
      includeInactive,
      status,
      q,
      limit,
      offset,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function handleCreateSupplier(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
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
}

// Router-level authentication & authorization for purchase subsystem
// Requires 'purchase' resource permissions (OWASP A01:2021 & API5:2023 - F-021)
purchaseRouter.use(requireAuth);
purchaseRouter.use(
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const action = req.method === "POST" ? "create" : "read";
    return authorize("purchase", action)(req, res, next);
  },
);

// Primary endpoints mounted under /api/v1/purchase-receipts
purchaseRouter.post("/", handlePostPurchaseReceipt);
purchaseRouter.get("/", handleGetPurchaseReceipts);

// Legacy alias endpoints if callers query /api/v1/purchase-receipts/purchase-receipts
purchaseRouter.post("/purchase-receipts", handlePostPurchaseReceipt);
purchaseRouter.get("/purchase-receipts", handleGetPurchaseReceipts);

purchaseRouter.get("/suppliers", handleGetSuppliers);
purchaseRouter.post("/suppliers", handleCreateSupplier);
