import { describe, it, expect } from "vitest";
import { envSchema, DEV_DEFAULT_SECRET } from "./env.js";
describe("Environment schema validation (MLD-005)", () => {
    it("allows development default secret in development environment", () => {
        const result = envSchema.safeParse({
            NODE_ENV: "development",
            DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/mill_ledger?schema=public",
            BETTER_AUTH_URL: "http://localhost:4000",
            CORS_ORIGIN: "http://localhost:5173",
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.BETTER_AUTH_SECRET).toBe(DEV_DEFAULT_SECRET);
        }
    });
    it("fails loudly when default secret is used in production", () => {
        const result = envSchema.safeParse({
            NODE_ENV: "production",
            DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/mill_ledger?schema=public",
            BETTER_AUTH_URL: "https://api.mill-ledger.internal",
            CORS_ORIGIN: "https://app.mill-ledger.internal",
            BETTER_AUTH_SECRET: DEV_DEFAULT_SECRET,
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            const issue = result.error.issues.find((i) => i.path.join(".") === "BETTER_AUTH_SECRET");
            expect(issue).toBeDefined();
            expect(issue?.message).toContain("must not use the default development secret in production");
        }
    });
    it("fails loudly when secret is shorter than 32 characters in production", () => {
        const result = envSchema.safeParse({
            NODE_ENV: "production",
            DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/mill_ledger?schema=public",
            BETTER_AUTH_URL: "https://api.mill-ledger.internal",
            CORS_ORIGIN: "https://app.mill-ledger.internal",
            BETTER_AUTH_SECRET: "short-production-secret-12345", // 29 chars
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            const issue = result.error.issues.find((i) => i.path.join(".") === "BETTER_AUTH_SECRET");
            expect(issue).toBeDefined();
            expect(issue?.message).toContain("must be at least 32 characters in production");
        }
    });
    it("fails loudly when CORS_ORIGIN is default localhost in production", () => {
        const result = envSchema.safeParse({
            NODE_ENV: "production",
            DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/mill_ledger?schema=public",
            BETTER_AUTH_URL: "https://api.mill-ledger.internal",
            CORS_ORIGIN: "http://localhost:5173",
            BETTER_AUTH_SECRET: "prod-super-secure-high-entropy-secret-key-9876543210",
        });
        expect(result.success).toBe(false);
        if (!result.success) {
            const issue = result.error.issues.find((i) => i.path.join(".") === "CORS_ORIGIN");
            expect(issue).toBeDefined();
            expect(issue?.message).toContain("must be explicitly configured with non-local production origin(s)");
        }
    });
    it("accepts high-entropy secrets >= 32 characters in production", () => {
        const strongSecret = "prod-super-secure-high-entropy-secret-key-9876543210";
        const result = envSchema.safeParse({
            NODE_ENV: "production",
            DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/mill_ledger?schema=public",
            BETTER_AUTH_URL: "https://api.mill-ledger.internal",
            CORS_ORIGIN: "https://app.mill-ledger.internal",
            BETTER_AUTH_SECRET: strongSecret,
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.BETTER_AUTH_SECRET).toBe(strongSecret);
        }
    });
});
