import { Router } from "express";
import { z } from "zod";
import { SUPPORTED_LOCALES } from "@mill-ledger/shared";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../../middleware/auth.middleware.js";
import { AppError } from "../../middleware/error.middleware.js";
import { prisma } from "../../db/client.js";

export const authRouter = Router();

const updatePreferencesSchema = z.object({
  preferredLanguage: z.enum(SUPPORTED_LOCALES),
});

authRouter.get("/me", requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({
    user: req.user,
  });
});

authRouter.patch(
  "/me/preferences",
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const parsed = updatePreferencesSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError("Unsupported language preference", 400);
      }

      const updated = await prisma.user.update({
        where: { id: req.user!.id },
        data: { preferredLanguage: parsed.data.preferredLanguage },
        select: {
          id: true,
          preferredLanguage: true,
        },
      });

      res.json({
        preferredLanguage: updated.preferredLanguage,
      });
    } catch (err) {
      next(err);
    }
  },
);
