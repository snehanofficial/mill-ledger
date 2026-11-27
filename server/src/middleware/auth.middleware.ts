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

    const isActive = (session.user as { isActive?: boolean }).isActive ?? true;
    if (!isActive) {
      throw new AppError("Forbidden: User account is inactive", 403);
    }

    const organizationId = (session.user as { organizationId?: string | null })
      .organizationId;
    if (!organizationId) {
      throw new AppError(
        "Forbidden: User account is not assigned to an organization",
        403,
      );
    }

    req.user = {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: (session.user as { role?: Role }).role ?? "SALESMAN",
      isActive,
      organizationId,
      image: session.user.image,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function authorize(
  resource: Resource,
  action: Action,
  resolveAttributes?: (
    req: AuthenticatedRequest,
  ) =>
    | Promise<Record<string, unknown> | undefined>
    | Record<string, unknown>
    | undefined,
) {
  return async (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user) {
        return next(new AppError("Unauthorized", 401));
      }

      if (!hasRbacPermission(req.user.role, resource, action)) {
        return next(
          new AppError(
            `Forbidden: Role ${req.user.role} lacks permission ${action} on ${resource}`,
            403,
          ),
        );
      }

      // BOLA protection (MLD-002 / DEC-001): Deny cross-tenant data requests
      const requestedOrg =
        (req.query?.organizationId as string | undefined) ||
        (req.body?.organizationId as string | undefined) ||
        (req.headers?.["x-organization-id"] as string | undefined);

      if (
        requestedOrg &&
        req.user.organizationId &&
        requestedOrg !== req.user.organizationId
      ) {
        return next(
          new AppError(
            `Forbidden: Access denied to organization ${requestedOrg}`,
            403,
          ),
        );
      }

      const resourceAttributes = resolveAttributes
        ? ((await resolveAttributes(req)) ??
          (req.body as Record<string, unknown>))
        : (req.body as Record<string, unknown>);

      const isAbacAllowed = evaluateAbac({
        user: req.user,
        resource,
        action,
        resourceAttributes,
      });

      if (!isAbacAllowed) {
        return next(
          new AppError("Forbidden: Policy evaluation denied request", 403),
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Extract the authoritative organizationId from the authenticated session.
 * Never falls back to a default org code or client-supplied parameters.
 */
export function getSessionOrgId(req: AuthenticatedRequest): string {
  const orgId = req.user?.organizationId;
  if (!orgId) {
    throw new AppError(
      "Forbidden: Authenticated session lacks organization context",
      403,
    );
  }
  return orgId;
}
