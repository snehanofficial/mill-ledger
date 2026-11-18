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

import { Suspense } from "react";
import { Outlet, Navigate, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AuthenticatedShell } from "@/components/shell/authenticated-shell";
import { useCurrentUser } from "@/hooks/use-current-user";
import { authClient } from "@/lib/auth-client";

function RouteLoadingFallback() {
  return (
    <div className="flex h-[40vh] w-full items-center justify-center p-8">
      <div className="flex flex-col items-center gap-2">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-xs font-medium text-muted-foreground">Loading view...</span>
      </div>
    </div>
  );
}

export function AuthenticatedLayout() {
  const { user, isLoading } = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Show loading shell to prevent flash/remount
  if (isLoading) {
    return <AuthenticatedShellSkeleton />;
  }

  // Redirect unauthenticated users to login
  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
    } catch (err) {
      console.warn("Sign out request error:", err);
    } finally {
      queryClient.clear();
      navigate("/auth/login", { replace: true });
      window.location.reload();
    }
  };

  return (
    <AuthenticatedShell user={user} notificationCount={0} onSignOut={handleSignOut}>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Outlet />
      </Suspense>
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
