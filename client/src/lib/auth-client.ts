import { apiClient } from "./api-client";

export interface SignInCredentials {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "OWNER" | "ACCOUNTANT" | "OPERATOR" | "SALESMAN";
  image?: string | null;
}

export interface SessionResponse {
  user: AuthUser;
}

export const authClient = {
  async signIn(credentials: SignInCredentials): Promise<AuthUser> {
    const response = await fetch("/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || errorData.error || "Invalid email or password",
      );
    }

    const data = await response.json();
    return data.user;
  },

  async signOut(): Promise<void> {
    await fetch("/api/auth/sign-out", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    }).catch(() => {});
  },

  async getSession(): Promise<AuthUser | null> {
    try {
      const res = await apiClient.get<SessionResponse>("/me");
      return res.data.user;
    } catch {
      return null;
    }
  },
};
