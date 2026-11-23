/**
 * AuthenticatedLayout route component.
 *
 * Used as the `element` for the authenticated route subtree in createBrowserRouter.
 * Public auth routes (login) must NOT be nested under this.
 */

import { Suspense, useEffect } from "react";
import { Outlet, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AuthenticatedShell } from "@/components/shell/authenticated-shell";
import { useCurrentUser } from "@/hooks/use-current-user";
import { authClient } from "@/lib/auth-client";
import { offlineDb } from "@/offline/db";

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
  const location = useLocation();
  const queryClient = useQueryClient();

  // Listen for unauthorized session expiration across active API queries
  useEffect(() => {
    const handleUnauthorized = () => {
      queryClient.clear();
      navigate("/auth/login", {
        replace: true,
        state: { from: location },
      });
    };

    window.addEventListener("millledger:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("millledger:unauthorized", handleUnauthorized);
    };
  }, [navigate, queryClient, location]);

  // REQ-062 & Owner Decision 2: Keep authenticated ERP pages noindex, nofollow
  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    const created = !meta;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "robots";
      document.head.appendChild(meta);
    }
    const previousContent = meta.content;
    meta.content = "noindex, nofollow";

    return () => {
      if (created) {
        meta?.remove();
      } else if (previousContent) {
        meta!.content = previousContent;
      }
    };
  }, []);

  // Show loading shell to prevent layout shift during initial session verification
  if (isLoading) {
    return <AuthenticatedShellSkeleton />;
  }

  // OWASP A01: Redirect unauthenticated users to login page, preserving return route
  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
    } catch (err) {
      console.warn("Sign out error:", err);
    } finally {
      // OWASP ASVS 8.3.1 & 3.5.3: Purge all cached sensitive enterprise data, customer PII, and offline outbox
      try {
        await offlineDb.purgeOnSignOut();
      } catch (dbErr) {
        console.warn("Failed to purge offline database on logout:", dbErr);
      }
      queryClient.clear();
      navigate("/auth/login", { replace: true });
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
      aria-label="Loading workspace"
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
