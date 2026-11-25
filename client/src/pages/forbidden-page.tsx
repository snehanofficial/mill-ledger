import { ShieldAlertIcon, ArrowRightIcon, LogOutIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getDefaultRouteForRole } from "@/lib/role-routing";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useQueryClient } from "@tanstack/react-query";

interface ForbiddenPageProps {
  requiredRoles?: string[];
}

export function ForbiddenPage({ requiredRoles }: ForbiddenPageProps) {
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const userRole = user?.role || "GUEST";
  const defaultWorkspace = getDefaultRouteForRole(user?.role);

  const getWorkspaceName = (role?: string) => {
    switch (role) {
      case "SALESMAN":
        return "Orders workspace";
      case "PRODUCTION":
        return "Production floor";
      case "ACCOUNTANT":
        return "Finance & Invoices";
      case "ADMIN":
      case "OWNER":
      default:
        return "Operations dashboard";
    }
  };

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
    } catch {
      // Continue cleanup on network failure
    } finally {
      queryClient.clear();
      navigate("/auth/login", { replace: true });
    }
  };

  return (
    <div
      role="region"
      aria-labelledby="forbidden-heading"
      className="flex min-h-[calc(100vh-4rem)] flex-1 flex-col items-center justify-center p-6 bg-background text-foreground"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-xs text-center">
        {/* Status indicator */}
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
          <ShieldAlertIcon className="size-7" aria-hidden="true" />
        </div>

        <div className="inline-flex items-center rounded-full border border-destructive/20 bg-destructive/5 px-2.5 py-0.5 text-xs font-semibold text-destructive mb-3">
          HTTP 403 Forbidden
        </div>

        <h1
          id="forbidden-heading"
          className="text-2xl font-bold tracking-tight text-foreground"
        >
          Access Denied
        </h1>

        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Your account role <span className="font-semibold text-foreground">({userRole})</span> is
          not authorized to access this operational view.
        </p>

        {requiredRoles && requiredRoles.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Requires: {requiredRoles.join(", ")}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <Button
            onClick={() => navigate(defaultWorkspace)}
            className="gap-2 w-full sm:w-auto"
          >
            Go to {getWorkspaceName(userRole)}
            <ArrowRightIcon className="size-4" aria-hidden="true" />
          </Button>

          <Button
            variant="outline"
            onClick={handleSignOut}
            className="gap-2 w-full sm:w-auto"
          >
            <LogOutIcon className="size-4" aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
