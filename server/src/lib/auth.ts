import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "../db/client.js";
import { env } from "../config/env.js";
import { getConfiguredOrigins, isAllowedOrigin } from "./origins.js";
import { lockoutService } from "./lockout.js";
import { auditService } from "../modules/reporting/audit.service.js";

export const lockoutPlugin = (): BetterAuthPlugin => ({
  id: "account-lockout",
  hooks: {
    before: [
      {
        matcher(context) {
          return context.path === "/sign-in/email";
        },
        handler: createAuthMiddleware(async (ctx) => {
          const email = (ctx.body as { email?: string })?.email;
          if (email && lockoutService.isLocked(email)) {
            const remaining = lockoutService.getRemainingLockoutSeconds(email);
            throw new APIError("FORBIDDEN", {
              code: "ACCOUNT_LOCKED",
              message: `Account is temporarily locked due to multiple failed login attempts. Please try again in ${Math.ceil(remaining / 60)} minutes or reset your password.`,
            });
          }
        }),
      },
    ],
    after: [
      {
        matcher(context) {
          return (
            context.path === "/sign-in/email" ||
            context.path === "/reset-password"
          );
        },
        handler: createAuthMiddleware(async (ctx) => {
          if (ctx.path === "/sign-in/email") {
            const email = (ctx.body as { email?: string })?.email;
            if (!email) return;

            const returned = ctx.context.returned;
            if (
              returned &&
              isAPIError(returned) &&
              returned.statusCode === 401
            ) {
              const { locked, attempts } = lockoutService.recordFailure(email);
              if (locked) {
                console.warn(
                  `[Better Auth Lockout] Account ${email} locked after ${attempts} failed attempts.`,
                );
                await auditService.log({
                  userEmail: email,
                  action: "ACCOUNT_LOCKED",
                  entity: "User",
                  reason: `Account locked after ${attempts} consecutive failed login attempts`,
                });
              }
            } else if (returned && !isAPIError(returned)) {
              lockoutService.recordSuccess(email);
            }
          } else if (ctx.path === "/reset-password") {
            const returned = ctx.context.returned;
            if (returned && !isAPIError(returned)) {
              const email = (ctx.body as { email?: string })?.email;
              if (email) {
                lockoutService.reset(email);
              }
            }
          }
        }),
      },
    ],
  },
});

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: async (request) => {
    const origins = getConfiguredOrigins();

    if (request) {
      const origin = request.headers.get("origin");
      if (origin && isAllowedOrigin(origin)) {
        try {
          origins.push(new URL(origin).origin);
        } catch {
          // ignore
        }
      }
      const referer = request.headers.get("referer");
      if (referer && isAllowedOrigin(referer)) {
        try {
          origins.push(new URL(referer).origin);
        } catch {
          // ignore
        }
      }
    }

    return Array.from(new Set(origins));
  },
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  plugins: [lockoutPlugin()],
  rateLimit: {
    enabled: process.env.NODE_ENV !== "test",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": {
        window: 60,
        max: process.env.NODE_ENV === "production" ? 5 : 50,
      },
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    ipAddress: {
      ipAddressHeaders: ["x-forwarded-for", "x-real-ip", "cf-connecting-ip"],
      trustedProxies: ["127.0.0.1", "::1"],
    },
  },
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      console.log(
        `[Better Auth] Password reset link generated for ${user.email}: ${url}`,
      );
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "SALESMAN",
      },
      isActive: {
        type: "boolean",
        required: false,
        defaultValue: true,
      },
      organizationId: {
        type: "string",
        required: false,
      },
    },
  },
});
