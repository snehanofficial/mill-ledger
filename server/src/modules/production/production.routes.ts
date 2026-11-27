import { Router } from "express";
import {
  authorize,
  getSessionOrgId,
  requireAuth,
  type AuthenticatedRequest,
} from "../../middleware/auth.middleware.js";
import { productionService } from "./production.service.js";
import { AppError } from "../../middleware/error.middleware.js";
import {
  createDraftRunSchema,
  postProductionRunSchema,
  reverseRunSchema,
} from "@mill-ledger/shared";
import { parsePaginationQuery } from "../../utils/pagination.js";

export const productionRouter = Router();

// GET /api/v1/production-runs - List runs
productionRouter.get(
  "/",
  requireAuth,
  authorize("production_run", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const orgId = getSessionOrgId(req);
      const { limit, offset } = parsePaginationQuery(req.query);
      const status =
        typeof req.query.status === "string" ? req.query.status : undefined;
      const q = typeof req.query.q === "string" ? req.query.q : undefined;

      const result = await productionService.getProductionRunsPaginated(orgId, {
        status,
        q,
        limit,
        offset,
      });
      res.json(result);
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
      const orgId = getSessionOrgId(req);

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
        throw parsed.error;
      }

      const run = await productionService.createDraftRun(
        { ...parsed.data, organizationId: getSessionOrgId(req) },
        req.user,
      );
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
        throw parsed.error;
      }

      const result = await productionService.postProductionRun(
        undefined,
        { ...parsed.data, organizationId: getSessionOrgId(req) },
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
        throw parsed.error;
      }

      const result = await productionService.postProductionRun(
        runId,
        { ...parsed.data, organizationId: getSessionOrgId(req) },
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
        throw parsed.error;
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

// PUT /api/v1/production-runs/:id - Update DRAFT production run (IMP-013)
productionRouter.put(
  "/:id",
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
      const updated = await productionService.updateDraftRun(
        runId,
        req.body || {},
        req.user,
      );
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/v1/production-runs/:id - Delete DRAFT production run (IMP-013)
productionRouter.delete(
  "/:id",
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
      const result = await productionService.deleteDraftRun(runId, req.user);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/production-runs/recipes - Create BOM recipe (IMP-011)
productionRouter.post(
  "/recipes",
  requireAuth,
  authorize("inventory", "create"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const recipe = await productionService.createRecipe(req.body, req.user);
      res.status(201).json({ recipe });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/production-runs/recipes/:id/version - Clone new BOM version (IMP-011)
productionRouter.post(
  "/recipes/:id/version",
  requireAuth,
  authorize("inventory", "create"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) throw new AppError("Recipe ID is required", 400);
      const recipe = await productionService.createRecipeVersion(
        id,
        req.body || {},
        req.user,
      );
      res.status(201).json({ recipe });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/production-runs/recipes/:id/archive - Archive/restore BOM (IMP-011)
productionRouter.patch(
  "/recipes/:id/archive",
  requireAuth,
  authorize("inventory", "update"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) throw new AppError("Recipe ID is required", 400);
      const isActive = Boolean(req.body?.isActive);
      const recipe = await productionService.archiveRecipe(
        id,
        isActive,
        req.user,
      );
      res.json({ recipe });
    } catch (err) {
      next(err);
    }
  },
);
