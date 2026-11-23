import { createAuthClient } from "better-auth/react";
import type { Role } from "@mill-ledger/shared";
import { apiClient } from "./api-client";
import { offlineDb } from "../offline/db";

export interface SignInCredentials {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  image?: string | null;
  isActive?: boolean;
  organizationId?: string;
}

export interface SessionResponse {
  user: AuthUser;
}

export const betterAuth = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : undefined,
  basePath: "/api/auth",
});

export const authClient = {
  /**
   * Signs in user with email and password following OWASP standards:
   * - Trims input
   * - Prevents account enumeration by surfacing uniform credential rejection
   * - Gracefully conveys rate-limit throttling (HTTP 429)
   */
  async signIn(credentials: SignInCredentials): Promise<AuthUser> {
    const email = credentials.email.trim();
    const password = credentials.password;

    if (!email || !password) {
      throw new Error("Email and password are required");
    }

    const response = await fetch("/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("Too many sign-in attempts. Please try again later.");
      }
      // OWASP: Generic error message to prevent user enumeration
      throw new Error("Invalid email or password");
    }

    const data = await response.json();

    // Verify session context against /api/v1/me to ensure user role and active state are hydrated
    try {
      const res = await apiClient.get<SessionResponse>("/me");
      if (res.data?.user) {
        return res.data.user;
      }
    } catch {
      // Fallback to response user data if /api/v1/me is delayed
    }

    return data.user;
  },

  /**
   * Signs out the user session server-side, invalidating the session token.
   */
  async signOut(): Promise<void> {
    try {
      await (betterAuth.signOut as () => Promise<unknown>)();
    } catch {
      // Fallback POST to ensure session cookie is purged
      await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }).catch(() => {});
    } finally {
      // OWASP ASVS 8.3.1 / 3.5.3: Purge client persistent storage upon sign-out
      try {
        await offlineDb.purgeOnSignOut();
      } catch {
        // Ignore storage purge errors during unmount/offline
      }
    }
  },

  /**
   * Resolves current user session via /api/v1/me.
   * Returns null if unauthenticated, session expired, or user is inactive.
   */
  async getSession(): Promise<AuthUser | null> {
    try {
      const res = await apiClient.get<SessionResponse>("/me");
      return res.data?.user ?? null;
    } catch {
      return null;
    }
  },
};
