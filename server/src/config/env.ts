import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from root or server directory
config({ path: path.resolve(__dirname, "../../../.env") });
config({ path: path.resolve(__dirname, "../../.env") });
config();

export const DEV_DEFAULT_SECRET = "mill-ledger-development-secret-123456";

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().default(4000),
    DATABASE_URL: z
      .string({ message: "DATABASE_URL is required" })
      .min(1, "DATABASE_URL is required")
      .url("DATABASE_URL must be a valid URL"),
    BETTER_AUTH_SECRET: z.string().min(16).default(DEV_DEFAULT_SECRET),
    BETTER_AUTH_URL: z.string().url().default("http://localhost:4000"),
    CORS_ORIGIN: z.string().default("http://localhost:5173"),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production") {
      if (!data.BETTER_AUTH_SECRET || data.BETTER_AUTH_SECRET === DEV_DEFAULT_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["BETTER_AUTH_SECRET"],
          message:
            "BETTER_AUTH_SECRET must not use the default development secret in production",
        });
      } else if (data.BETTER_AUTH_SECRET.length < 32) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["BETTER_AUTH_SECRET"],
          message:
            "BETTER_AUTH_SECRET must be at least 32 characters in production",
        });
      }

      if (
        !data.CORS_ORIGIN ||
        data.CORS_ORIGIN === "http://localhost:5173" ||
        data.CORS_ORIGIN.includes("localhost") ||
        data.CORS_ORIGIN.includes("127.0.0.1")
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["CORS_ORIGIN"],
          message:
            "CORS_ORIGIN must be explicitly configured with non-local production origin(s) in production",
        });
      }

      if (
        data.DATABASE_URL.includes("localhost") ||
        data.DATABASE_URL.includes("127.0.0.1")
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["DATABASE_URL"],
          message:
            "DATABASE_URL must be explicitly configured with a non-localhost production database in production",
        });
      }
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Invalid environment variables configuration:",
    parsed.error.format(),
  );
  throw new Error("Invalid server environment configuration");
}

export const env = parsed.data;
