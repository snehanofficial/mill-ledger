import { Router } from "express";
import {
  requireAuth,
  authorize,
  type AuthenticatedRequest,
} from "../../middleware/auth.middleware.js";
import { userService } from "./user.service.js";

export const userRouter = Router();

userRouter.use(requireAuth);

// GET /api/v1/users - List users
userRouter.get(
  "/",
  authorize("user", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { role, isActive, organizationId } = req.query;
      const users = await userService.getUsers({
        role: role as string | undefined,
        isActive:
          isActive === undefined
            ? undefined
            : isActive === "true" || isActive === "1",
        organizationId: organizationId as string | undefined,
      });
      res.json({ users });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/v1/users/:id - Get single user
userRouter.get(
  "/:id",
  authorize("user", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const user = await userService.getUserById(id);
      res.json({ user });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/users - Create user
userRouter.post(
  "/",
  authorize("user", "create"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { name, email, password, role, organizationId } = req.body;
      const user = await userService.createUser({
        name,
        email,
        password,
        role,
        organizationId: organizationId || req.user?.organizationId,
      });
      res.status(201).json({ user });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /api/v1/users/:id - Update user
userRouter.put(
  "/:id",
  authorize("user", "update"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const { name, role, isActive, organizationId } = req.body;
      const user = await userService.updateUser(id, {
        name,
        role,
        isActive,
        organizationId,
      });
      res.json({ user });
    } catch (err) {
      next(err);
    }
  },
);

// PATCH /api/v1/users/:id - Update user (alias)
userRouter.patch(
  "/:id",
  authorize("user", "update"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const { name, role, isActive, organizationId } = req.body;
      const user = await userService.updateUser(id, {
        name,
        role,
        isActive,
        organizationId,
      });
      res.json({ user });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/v1/users/:id - Delete user
userRouter.delete(
  "/:id",
  authorize("user", "delete"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await userService.deleteUser(id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);
