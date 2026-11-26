import { useQuery } from "@tanstack/react-query";
import type { ShellUser } from "@/components/shell/authenticated-shell";
import { authClient, type AuthUser } from "@/lib/auth-client";

export const AUTH_SESSION_QUERY_KEY = ["auth", "session"] as const;

export interface CurrentUserResult {
  user: ShellUser | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
}

export function getInitials(nameOrEmail: string): string {
  const clean = nameOrEmail.trim();
  const parts = clean.split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[parts.length - 1]) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase() || "ML";
}

export function mapAuthUserToShellUser(user: AuthUser): ShellUser {
  return {
    id: user.id,
    name: user.name || "User",
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    initials: getInitials(user.name || user.email),
    avatar: user.image || undefined,
  };
}

export function useCurrentUser(): CurrentUserResult {
  const query = useQuery({
    queryKey: AUTH_SESSION_QUERY_KEY,
    queryFn: async (): Promise<ShellUser | null> => {
      const authUser = await authClient.getSession();
      if (!authUser) {
        return null;
      }
      return mapAuthUserToShellUser(authUser);
    },
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    gcTime: 1000 * 60 * 15,
    retry: false, // Never retry 401 unauthenticated
    refetchOnWindowFocus: true,
  });

  return {
    user: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
