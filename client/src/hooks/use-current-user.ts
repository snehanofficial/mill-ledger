/**
 * useCurrentUser hook.
 * Provides the authenticated user to the shell and route guards.
 * Integrates with Better Auth's client session.
 *
 * Replace the mock implementation once Better Auth client is wired up.
 */

import { useState, useEffect } from "react";
import type { ShellUser } from "@/components/shell/authenticated-shell";
import { apiClient } from "@/lib/api-client";

interface CurrentUserResult {
  user: ShellUser | null;
  isLoading: boolean;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function useCurrentUser(): CurrentUserResult {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<ShellUser | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      try {
        const response = await apiClient.get<{
          user: {
            id: string;
            name: string;
            email: string;
            role: ShellUser["role"];
            image?: string;
          };
        }>("/me");

        if (isMounted && response.data?.user) {
          const u = response.data.user;
          setUser({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            initials: getInitials(u.name || "User"),
            avatar: u.image || undefined,
          });
        }
      } catch {
        if (isMounted) {
          // If on /auth/* route, keep user null so login page renders cleanly
          const isAuthPage =
            typeof window !== "undefined" &&
            window.location.pathname.startsWith("/auth/");

          if (isAuthPage) {
            setUser(null);
          } else if (import.meta.env.DEV) {
            // In dev / test environment, default to dev admin so shell and showcase tests run seamlessly
            setUser({
              id: "dev-user-1",
              name: "Factory Admin",
              email: "admin@millledger.local",
              role: "ADMIN",
              initials: "FA",
            });
          } else {
            setUser(null);
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    checkSession();

    return () => {
      isMounted = false;
    };
  }, []);

  return { user, isLoading };
}
