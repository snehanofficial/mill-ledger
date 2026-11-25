import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { authClient } from "./auth-client";
import { apiClient } from "./api-client";
import { BACKEND_URL, requireEnvUrl } from "./env";
import { getInitials, mapAuthUserToShellUser } from "../hooks/use-current-user";

describe("authClient and OWASP authentication security", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("authClient.signIn", () => {
    it("rejects empty email or password upfront", async () => {
      await expect(
        authClient.signIn({ email: "", password: "secret" }),
      ).rejects.toThrow("Email and password are required");

      await expect(
        authClient.signIn({ email: "admin@test.com", password: "" }),
      ).rejects.toThrow("Email and password are required");
    });

    it("trims email before sending", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          user: {
            id: "user-1",
            email: "admin@millledger.local",
            name: "Admin",
            role: "ADMIN",
          },
        }),
      });
      globalThis.fetch = fetchMock;

      vi.spyOn(apiClient, "get").mockResolvedValue({
        data: {
          user: {
            id: "user-1",
            email: "admin@millledger.local",
            name: "Admin",
            role: "ADMIN",
          },
        },
      } as any);

      await authClient.signIn({
        email: "  admin@millledger.local  ",
        password: "AdminPassword123!",
      });

      expect(fetchMock).toHaveBeenCalledWith(
        `${BACKEND_URL}/api/auth/sign-in/email`,
        expect.objectContaining({
          body: JSON.stringify({
            email: "admin@millledger.local",
            password: "AdminPassword123!",
          }),
        }),
      );
    });

    it("returns generic 'Invalid email or password' error on failure to prevent account enumeration (OWASP A07)", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: "User not found with email" }),
      });

      await expect(
        authClient.signIn({
          email: "nonexistent@millledger.local",
          password: "wrong",
        }),
      ).rejects.toThrow("Invalid email or password");
    });

    it("surfaces rate-limiting notice on HTTP 429", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ message: "Too many requests" }),
      });

      await expect(
        authClient.signIn({
          email: "admin@millledger.local",
          password: "wrong",
        }),
      ).rejects.toThrow(
        "Too many sign-in attempts. Please try again later.",
      );
    });
  });

  describe("authClient.signOut", () => {
    it("calls sign out and does not throw if network fails", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network offline"));
      await expect(authClient.signOut()).resolves.toBeUndefined();
    });
  });

  describe("authClient.getSession", () => {
    it("returns null when /api/v1/me returns 401", async () => {
      vi.spyOn(apiClient, "get").mockRejectedValue({
        response: { status: 401 },
      });

      const session = await authClient.getSession();
      expect(session).toBeNull();
    });

    it("returns AuthUser when session is valid", async () => {
      vi.spyOn(apiClient, "get").mockResolvedValue({
        data: {
          user: {
            id: "u-123",
            name: "Audit User",
            email: "accountant@millledger.local",
            role: "ACCOUNTANT",
          },
        },
      } as any);

      const session = await authClient.getSession();
      expect(session).toEqual({
        id: "u-123",
        name: "Audit User",
        email: "accountant@millledger.local",
        role: "ACCOUNTANT",
      });
    });
  });

  describe("useCurrentUser helpers", () => {
    it("derives initials accurately from multi-word names", () => {
      expect(getInitials("Factory Admin")).toBe("FA");
      expect(getInitials("Mill Ledger System")).toBe("MS");
    });

    it("derives initials from single word names or email", () => {
      expect(getInitials("Admin")).toBe("AD");
      expect(getInitials("salesman@millledger.local")).toBe("SA");
    });

    it("maps AuthUser to ShellUser interface", () => {
      const shellUser = mapAuthUserToShellUser({
        id: "usr-42",
        name: "Production Manager",
        email: "production@millledger.local",
        role: "PRODUCTION",
      });

      expect(shellUser).toEqual({
        id: "usr-42",
        name: "Production Manager",
        email: "production@millledger.local",
        role: "PRODUCTION",
        initials: "PM",
        avatar: undefined,
      });
    });
  });

  describe("requireEnvUrl", () => {
    it("strips trailing slashes and whitespace", () => {
      expect(requireEnvUrl("  http://localhost:4000///  ", "VITE_BACKEND_URL")).toBe(
        "http://localhost:4000",
      );
    });

    it("throws when the required environment variable is missing or blank", () => {
      expect(() => requireEnvUrl(undefined, "VITE_BACKEND_URL")).toThrow(
        "Missing required environment variable: VITE_BACKEND_URL",
      );
      expect(() => requireEnvUrl("   ", "VITE_BACKEND_URL")).toThrow(
        "Missing required environment variable: VITE_BACKEND_URL",
      );
    });
  });
});
