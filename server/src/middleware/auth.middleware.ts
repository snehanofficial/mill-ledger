import type { NextFunction, Request, Response } from "express";
import type { Action, Resource, Role, UserContext } from "@mill-ledger/shared";
import { auth } from "../lib/auth.js";
import { AppError } from "./error.middleware.js";
import { hasRbacPermission } from "../policies/rbac.js";
import { evaluateAbac } from "../policies/abac.js";

export interface AuthenticatedRequest extends Request {
  user?: UserContext;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const session = await auth.api.getSession({
      headers: req.headers as unknown as Headers,
    });

    if (!session || !session.user) {
      throw new AppError("Unauthorized: Session required", 401);
    }

    req.user = {
      id: session.user.id,
      email: session.user.email,
      role: (session.user as { role?: Role }).role ?? "salesman",
      isActive: (session.user as { isActive?: boolean }).isActive ?? true,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function authorize(resource: Resource, action: Action) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError("Unauthorized", 401));
    }

    if (!hasRbacPermission(req.user.role, resource, action)) {
      return next(
        new AppError(`Forbidden: Role ${req.user.role} lacks permission ${action} on ${resource}`, 403),
      );
    }

    const isAbacAllowed = evaluateAbac({
      user: req.user,
      resource,
      action,
      resourceAttributes: req.body as Record<string, unknown>,
    });

    if (!isAbacAllowed) {
      return next(new AppError("Forbidden: Policy evaluation denied request", 403));
    }

    next();
  };
}
