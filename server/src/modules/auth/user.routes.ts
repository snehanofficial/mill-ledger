import { Router } from "express";
import {
  requireAuth,
  authorize,
  getSessionOrgId,
  type AuthenticatedRequest,
} from "../../middleware/auth.middleware.js";
import { userService } from "./user.service.js";
import { auditService } from "../reporting/audit.service.js";

export const userRouter = Router();

userRouter.use(requireAuth);

// GET /api/v1/users - List users
userRouter.get(
  "/",
  authorize("user", "read"),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const orgId = getSessionOrgId(req);
      const { role, isActive } = req.query;
      const users = await userService.getUsers({
        role: role as string | undefined,
        isActive:
          isActive === undefined
            ? undefined
            : isActive === "true" || isActive === "1",
        organizationId: orgId,
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
      const orgId = getSessionOrgId(req);
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const user = await userService.getUserById(id, orgId);
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
      const orgId = getSessionOrgId(req);
      const { name, email, password, role } = req.body;
      const user = await userService.createUser({
        name,
        email,
        password,
        role,
        organizationId: orgId,
      });

      await auditService.log({
        organizationId: orgId,
        userId: req.user?.id,
        userEmail: req.user?.email,
        action: "CREATE",
        entity: "User",
        entityId: user.id,
        details: { email: user.email, role: user.role, name: user.name },
        requestId: req.id,
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
      const orgId = getSessionOrgId(req);
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const { name, role, isActive } = req.body;
      const user = await userService.updateUser(
        id,
        {
          name,
          role,
          isActive,
        },
        orgId,
      );

      await auditService.log({
        organizationId: orgId,
        userId: req.user?.id,
        userEmail: req.user?.email,
        action: "UPDATE",
        entity: "User",
        entityId: user.id,
        details: { role: user.role, isActive: user.isActive, name: user.name },
        requestId: req.id,
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
      const orgId = getSessionOrgId(req);
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const { name, role, isActive } = req.body;
      const user = await userService.updateUser(
        id,
        {
          name,
          role,
          isActive,
        },
        orgId,
      );

      await auditService.log({
        organizationId: orgId,
        userId: req.user?.id,
        userEmail: req.user?.email,
        action: "UPDATE",
        entity: "User",
        entityId: user.id,
        details: { role: user.role, isActive: user.isActive, name: user.name },
        requestId: req.id,
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
      const orgId = getSessionOrgId(req);
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await userService.deleteUser(id, orgId);

      await auditService.log({
        organizationId: orgId,
        userId: req.user?.id,
        userEmail: req.user?.email,
        action: "DELETE",
        entity: "User",
        entityId: id,
        details: { deletedUserId: id },
        requestId: req.id,
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);
