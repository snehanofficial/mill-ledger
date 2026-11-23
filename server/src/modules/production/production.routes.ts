import { Router } from "express";
import {
  authorize,
  requireAuth,
  type AuthenticatedRequest,
} from "../../middleware/auth.middleware.js";
import { productionService } from "./production.service.js";
import { z } from "zod";
import { AppError } from "../../middleware/error.middleware.js";

export const productionRouter = Router();

const createDraftRunSchema = z.object({
  organizationId: z.string().min(1),
  warehouseId: z.string().min(1),
  recipeId: z.string().min(1),
  runNumber: z.string().min(1),
  batchCount: z.number().positive().optional(),
  notes: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

const consumedMaterialSchema = z.object({
  inventoryItemId: z.string().min(1),
  actualQty: z.number().min(0),
  damagedQty: z.number().min(0).optional(),
});

const postProductionRunSchema = z.object({
  organizationId: z.string().min(1),
  warehouseId: z.string().min(1).optional(),
  recipeId: z.string().min(1).optional(),
  runNumber: z.string().min(1).optional(),
  batchCount: z.number().positive().optional(),
  actualGoodQty: z.number().positive(),
  actualRejectedQty: z.number().min(0).optional(),
  directLaborCost: z.number().min(0).optional(),
  utilityCost: z.number().min(0).optional(),
  notes: z.string().optional(),
  idempotencyKey: z.string().optional(),
  consumedMaterials: z.array(consumedMaterialSchema).min(1),
});

const reverseRunSchema = z.object({
  reason: z.string().min(1, "Reversal reason is required"),
});

// GET /api/v1/production-runs - List runs
productionRouter.get(
  "/",
  requireAuth,
  authorize("production_run", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const orgId = req.query.organizationId as string;
      if (!orgId) {
        throw new AppError("organizationId query parameter is required", 400);
      }

      const runs = await productionService.getProductionRuns(orgId);
      res.json({ runs });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/production-runs/recipes - List active BOM recipes
productionRouter.get(
  "/recipes",
  requireAuth,
  authorize("production_run", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const orgId =
        (req.query.organizationId as string) ||
        req.user?.organizationId ||
        "MILL";

      const recipes = await productionService.getRecipes(orgId);
      res.json({ recipes });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/production-runs/:id - Get single run
productionRouter.get(
  "/:id",
  requireAuth,
  authorize("production_run", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const runId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      if (!runId) {
        throw new AppError("Production run ID is required", 400);
      }

      const run = await productionService.getProductionRunById(runId);
      res.json(run);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/production-runs/draft - Create draft run
productionRouter.post(
  "/draft",
  requireAuth,
  authorize("production_run", "create"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const parsed = createDraftRunSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(
          `Invalid draft run data: ${parsed.error.errors.map((e) => e.message).join(", ")}`,
          400,
        );
      }

      const run = await productionService.createDraftRun(parsed.data, req.user);
      res.status(201).json(run);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/production-runs - Post a production run directly
productionRouter.post(
  "/",
  requireAuth,
  authorize("production_run", "create"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const parsed = postProductionRunSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(
          `Invalid production run data: ${parsed.error.errors.map((e) => e.message).join(", ")}`,
          400,
        );
      }

      const result = await productionService.postProductionRun(
        undefined,
        parsed.data,
        req.user,
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/production-runs/:id/post - Post an existing draft run
productionRouter.post(
  "/:id/post",
  requireAuth,
  authorize("production_run", "update"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const runId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      if (!runId) {
        throw new AppError("Production run ID is required", 400);
      }

      const parsed = postProductionRunSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(
          `Invalid production run data: ${parsed.error.errors.map((e) => e.message).join(", ")}`,
          400,
        );
      }

      const result = await productionService.postProductionRun(
        runId,
        parsed.data,
        req.user,
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/production-runs/:id/reverse - Reverse a posted production run
productionRouter.post(
  "/:id/reverse",
  requireAuth,
  authorize("production_run", "update"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const runId = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      if (!runId) {
        throw new AppError("Production run ID is required", 400);
      }

      const parsed = reverseRunSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(
          `Invalid reversal data: ${parsed.error.errors.map((e) => e.message).join(", ")}`,
          400,
        );
      }

      const reversedRun = await productionService.reverseProductionRun(
        runId,
        {
          reason: parsed.data.reason,
          reversedByUserId: req.user?.id,
        },
        req.user,
      );
      res.status(200).json(reversedRun);
    } catch (err) {
      next(err);
    }
  },
);
