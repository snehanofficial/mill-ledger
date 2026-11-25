import { auth } from "../lib/auth.js";
import { AppError } from "./error.middleware.js";
import { hasRbacPermission } from "../policies/rbac.js";
import { evaluateAbac } from "../policies/abac.js";
export async function requireAuth(req, _res, next) {
    try {
        const session = await auth.api.getSession({
            headers: req.headers,
        });
        if (!session || !session.user) {
            throw new AppError("Unauthorized: Session required", 401);
        }
        const isActive = session.user.isActive ?? true;
        if (!isActive) {
            throw new AppError("Forbidden: User account is inactive", 403);
        }
        req.user = {
            id: session.user.id,
            name: session.user.name,
            email: session.user.email,
            role: session.user.role ?? "SALESMAN",
            isActive,
            organizationId: session.user.organizationId || "MILL",
            image: session.user.image,
        };
        next();
    }
    catch (error) {
        next(error);
    }
}
export function requireTenant(req, _res, next) {
    if (!req.user) {
        return next(new AppError("Unauthorized", 401));
    }
    const requestedOrg = req.query?.organizationId ||
        req.body?.organizationId;
    if (requestedOrg &&
        req.user.organizationId &&
        requestedOrg !== req.user.organizationId &&
        requestedOrg !== "MILL") {
        return next(new AppError(`Forbidden: Access denied to organization ${requestedOrg}`, 403));
    }
    next();
}
export function authorize(resource, action) {
    return (req, _res, next) => {
        if (!req.user) {
            return next(new AppError("Unauthorized", 401));
        }
        if (!hasRbacPermission(req.user.role, resource, action)) {
            return next(new AppError(`Forbidden: Role ${req.user.role} lacks permission ${action} on ${resource}`, 403));
        }
        // BOLA protection (MLD-002 / DEC-001): Deny cross-tenant data requests
        const requestedOrg = req.query?.organizationId ||
            req.body?.organizationId;
        if (requestedOrg &&
            req.user.organizationId &&
            requestedOrg !== req.user.organizationId &&
            requestedOrg !== "MILL") {
            return next(new AppError(`Forbidden: Access denied to organization ${requestedOrg}`, 403));
        }
        const isAbacAllowed = evaluateAbac({
            user: req.user,
            resource,
            action,
            resourceAttributes: req.body,
        });
        if (!isAbacAllowed) {
            return next(new AppError("Forbidden: Policy evaluation denied request", 403));
        }
        next();
    };
}
