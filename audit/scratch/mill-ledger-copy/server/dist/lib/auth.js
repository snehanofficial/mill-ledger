import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "../db/client.js";
import { env } from "../config/env.js";
import { getConfiguredOrigins, isAllowedOrigin } from "./origins.js";
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
                }
                catch {
                    // ignore
                }
            }
            const referer = request.headers.get("referer");
            if (referer && isAllowedOrigin(referer)) {
                try {
                    origins.push(new URL(referer).origin);
                }
                catch {
                    // ignore
                }
            }
        }
        return Array.from(new Set(origins));
    },
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
