/**
 * AuthenticatedLayout route component.
 *
 * Used as the `element` for the authenticated route subtree in createBrowserRouter.
 * Public auth routes (login, forgot password) must NOT be nested under this.
 *
 * Usage in createBrowserRouter:
 *   {
 *     path: '/',
 *     element: <AuthenticatedLayout />,
 *     handle: { breadcrumb: undefined },
 *     children: [
 *       { path: 'dashboard', element: <DashboardPage />, handle: { breadcrumb: 'Overview' } },
 *       ...
 *     ],
 *   }
 */

import { Outlet, Navigate } from "react-router-dom";
import { AuthenticatedShell } from "@/components/shell/authenticated-shell";
import { useCurrentUser } from "@/hooks/use-current-user";

export function AuthenticatedLayout() {
  const { user, isLoading } = useCurrentUser();

  // Show loading shell to prevent flash/remount
  if (isLoading) {
    return <AuthenticatedShellSkeleton />;
  }

  // Redirect unauthenticated users to login
  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  return (
    <AuthenticatedShell user={user} notificationCount={0}>
      <Outlet />
    </AuthenticatedShell>
  );
}

// Minimal skeleton that matches shell geometry during auth check.
// Same dimensions as the real shell to prevent CLS on hydration.
function AuthenticatedShellSkeleton() {
  return (
    <div
      className="flex min-h-svh w-full bg-background"
      aria-busy="true"
      aria-label="Loading"
    >
      {/* Sidebar skeleton */}
      <div className="hidden md:flex h-svh w-62 shrink-0 flex-col border-r border-border bg-surface" />
      {/* Main area */}
      <div className="flex flex-1 flex-col min-h-svh">
        {/* Header skeleton - exact 64px height */}
        <div className="sticky top-0 h-16 shrink-0 border-b border-border bg-surface" />
        {/* Content */}
        <div className="flex flex-1" />
      </div>
    </div>
  );
}
