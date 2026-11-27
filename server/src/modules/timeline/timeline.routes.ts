import { Router } from "express";
import { timelineParamsSchema, timelineQuerySchema } from "@mill-ledger/shared";
import {
  getSessionOrgId,
  requireAuth,
  type AuthenticatedRequest,
} from "../../middleware/auth.middleware.js";
import { AppError } from "../../middleware/error.middleware.js";
import { timelineService } from "./timeline.service.js";

export const timelineRouter = Router();

timelineRouter.use(requireAuth);

timelineRouter.get(
  "/:entityType/:entityId",
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const parsedParams = timelineParamsSchema.safeParse(req.params);
      if (!parsedParams.success) {
        throw new AppError("Invalid timeline entity type or identifier", 400);
      }

      const parsedQuery = timelineQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        throw new AppError("Invalid timeline query parameters", 400);
      }

      const organizationId = getSessionOrgId(req);
      const user = req.user;
      if (!user) {
        throw new AppError("Unauthorized", 401);
      }

      const result = await timelineService.getEntityTimeline({
        organizationId,
        user,
        entityType: parsedParams.data.entityType,
        entityId: parsedParams.data.entityId,
        filter: parsedQuery.data.filter,
        limit: parsedQuery.data.limit,
        offset: parsedQuery.data.offset,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);
