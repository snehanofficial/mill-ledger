import { Router } from "express";
import { z } from "zod";
import {
  authorize,
  requireAuth,
  type AuthenticatedRequest,
} from "../../middleware/auth.middleware.js";
import { AppError } from "../../middleware/error.middleware.js";
import { mastersService } from "./masters.service.js";

export const mastersRouter = Router();

const createProductSchema = z.object({
  organizationId: z.string().optional(),
  code: z.string().min(1),
  name: z.string().min(1),
  hsnCode: z.string().min(4).max(12).optional(),
  taxRate: z.number().min(0).max(28).optional(),
});

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  hsnCode: z.string().min(4).max(12).optional(),
  taxRate: z.number().min(0).max(28).optional(),
  isActive: z.boolean().optional(),
});

const createVariantSchema = z.object({
  productId: z.string().min(1),
  sku: z.string().min(1),
  name: z.string().min(1),
  packSize: z.number().positive(),
  uomId: z.string().min(1),
  inventoryItemId: z.string().nullable().optional(),
  defaultPrice: z.number().min(0).optional(),
});

const updateVariantSchema = z.object({
  name: z.string().min(1).optional(),
  packSize: z.number().positive().optional(),
  uomId: z.string().min(1).optional(),
  inventoryItemId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

const createPriceListSchema = z.object({
  organizationId: z.string().optional(),
  code: z.string().min(1),
  name: z.string().min(1),
  isDefault: z.boolean().optional(),
});

const upsertPriceLineSchema = z.object({
  productVariantId: z.string().min(1),
  price: z.number().min(0),
});

mastersRouter.get(
  "/products",
  requireAuth,
  authorize("order", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const orgId = (req.query.organizationId as string) || "MILL";
      const data = await mastersService.getProductsMaster(orgId);
      res.json(data);
    } catch (err) {
      next(err);
    }
  },
);

mastersRouter.post(
  "/products",
  requireAuth,
  authorize("inventory", "create"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const parsed = createProductSchema.safeParse(req.body);
      if (!parsed.success) throw parsed.error;
      const product = await mastersService.createProduct(
        parsed.data,
        req.user!,
      );
      res.status(201).json({ product });
    } catch (err) {
      next(err);
    }
  },
);

mastersRouter.put(
  "/products/:id",
  requireAuth,
  authorize("inventory", "update"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) throw new AppError("Product ID is required", 400);
      const parsed = updateProductSchema.safeParse(req.body);
      if (!parsed.success) throw parsed.error;
      const product = await mastersService.updateProduct(
        id,
        parsed.data,
        req.user!,
      );
      res.json({ product });
    } catch (err) {
      next(err);
    }
  },
);

mastersRouter.post(
  "/variants",
  requireAuth,
  authorize("inventory", "create"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const parsed = createVariantSchema.safeParse(req.body);
      if (!parsed.success) throw parsed.error;
      const variant = await mastersService.createVariant(
        parsed.data,
        req.user!,
      );
      res.status(201).json({ variant });
    } catch (err) {
      next(err);
    }
  },
);

mastersRouter.put(
  "/variants/:id",
  requireAuth,
  authorize("inventory", "update"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) throw new AppError("Variant ID is required", 400);
      const parsed = updateVariantSchema.safeParse(req.body);
      if (!parsed.success) throw parsed.error;
      const variant = await mastersService.updateVariant(
        id,
        parsed.data,
        req.user!,
      );
      res.json({ variant });
    } catch (err) {
      next(err);
    }
  },
);

mastersRouter.delete(
  "/variants/:id",
  requireAuth,
  authorize("inventory", "delete"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) throw new AppError("Variant ID is required", 400);
      const result = await mastersService.deleteVariant(id, req.user!);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

mastersRouter.get(
  "/price-lists",
  requireAuth,
  authorize("order", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const orgId = (req.query.organizationId as string) || "MILL";
      const data = await mastersService.getProductsMaster(orgId);
      res.json({ priceLists: data.priceLists });
    } catch (err) {
      next(err);
    }
  },
);

mastersRouter.post(
  "/price-lists",
  requireAuth,
  authorize("inventory", "create"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const parsed = createPriceListSchema.safeParse(req.body);
      if (!parsed.success) throw parsed.error;
      const priceList = await mastersService.createPriceList(
        parsed.data,
        req.user!,
      );
      res.status(201).json({ priceList });
    } catch (err) {
      next(err);
    }
  },
);

mastersRouter.put(
  "/price-lists/:id/lines",
  requireAuth,
  authorize("inventory", "update"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) throw new AppError("Price list ID is required", 400);
      const parsed = upsertPriceLineSchema.safeParse(req.body);
      if (!parsed.success) throw parsed.error;
      const line = await mastersService.upsertPriceListLine(
        id,
        parsed.data,
        req.user!,
      );
      res.json({ line });
    } catch (err) {
      next(err);
    }
  },
);

mastersRouter.get(
  "/organization",
  requireAuth,
  authorize("report", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const orgId = (req.query.organizationId as string) || "MILL";
      const organization = await mastersService.getOrganization(orgId);
      res.json({ organization });
    } catch (err) {
      next(err);
    }
  },
);

mastersRouter.put(
  "/organization",
  requireAuth,
  authorize("user", "update"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const orgId = (req.body?.organizationId as string) || "MILL";
      const organization = await mastersService.updateOrganization(
        orgId,
        req.body || {},
        req.user!,
      );
      res.json({ organization });
    } catch (err) {
      next(err);
    }
  },
);
