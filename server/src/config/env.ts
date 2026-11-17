import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url().default("postgresql://postgres:postgres@localhost:5432/mill_ledger?schema=public"),
  BETTER_AUTH_SECRET: z.string().min(16).default("mill-ledger-development-secret-123456"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:4000"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("oInvalid environment variables configuration:", parsed.error.format());
  throw new Error("Invalid server environment configuration");
}

export const env = parsed.data;
