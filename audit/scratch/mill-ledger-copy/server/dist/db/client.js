import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";
const pool = new pg.Pool({
    connectionString: env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
export const prisma = globalThis.__prisma ??
    new PrismaClient({
        adapter,
        log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
if (env.NODE_ENV !== "production") {
    globalThis.__prisma = prisma;
}
