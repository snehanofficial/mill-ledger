import { Router } from "express";
import {
  authorize,
  requireAuth,
  type AuthenticatedRequest,
} from "../../middleware/auth.middleware.js";

export const salesRouter = Router();

// Order creation endpoint protected by RBAC
salesRouter.post(
  "/orders",
  requireAuth,
  authorize("order", "create"),
  (req: AuthenticatedRequest, res) => {
    res.status(201).json({ status: "created", user: req.user });
  },
);

// Order update endpoint protected by RBAC and ABAC
salesRouter.put(
  "/orders/:id",
  requireAuth,
  authorize("order", "update"),
  (req: AuthenticatedRequest, res) => {
    res.json({ status: "updated", user: req.user });
  },
);
