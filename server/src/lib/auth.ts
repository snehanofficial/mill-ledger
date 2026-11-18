import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "../db/client.js";
import { env } from "../config/env.js";

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [
    env.CORS_ORIGIN,
    env.BETTER_AUTH_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://localhost:4000",
    "http://127.0.0.1:4000",
  ].filter(Boolean),
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
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
  },
  emailAndPassword: {
    enabled: true,
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
