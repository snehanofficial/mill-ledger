import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import type { Role } from "@mill-ledger/shared";
import { useCurrentUser } from "@/hooks/use-current-user";
import { ForbiddenPage } from "@/pages/forbidden-page";
import { getDefaultRouteForRole } from "@/lib/role-routing";

interface RoleGuardProps {
  allowedRoles: Role[];
  children: ReactNode;
}

/**
 * Route-level authorization barrier (OWASP Top 10:2021 A01).
 * Inspects the current user session role against permitted route roles.
 * Renders an accessible 403 Forbidden page on unauthorized access attempts.
 */
export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { user, isLoading } = useCurrentUser();

  // Defer while auth session is validating
  if (isLoading) {
    return null;
  }

  // If not logged in, AuthenticatedLayout handles redirect to /auth/login
  if (!user) {
    return null;
  }

  // Enforce role authorization
  if (!allowedRoles.includes(user.role)) {
    return <ForbiddenPage requiredRoles={allowedRoles} />;
  }

  return <>{children}</>;
}

/**
 * Role-aware root redirect component.
 * Directs each authenticated role to their dedicated operational workspace:
 * - SALESMAN -> /orders
 * - PRODUCTION -> /production/today
 * - ACCOUNTANT -> /invoices
 * - ADMIN / OWNER -> /dashboard
 */
export function RoleDefaultRedirect() {
  const { user, isLoading } = useCurrentUser();

  if (isLoading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  const destination = getDefaultRouteForRole(user.role);
  return <Navigate to={destination} replace />;
}
