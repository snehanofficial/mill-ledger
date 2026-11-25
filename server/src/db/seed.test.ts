import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runFullSeed, seedBenchmarkMasters, seedUsers } from "./seed.js";

describe("F-004 / F-101: Production Guard on Seed Script", () => {
  it("seedUsers() throws fatal error when NODE_ENV=production without ALLOW_PRODUCTION_SEED", async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalAllow = process.env.ALLOW_PRODUCTION_SEED;
    try {
      process.env.NODE_ENV = "production";
      delete process.env.ALLOW_PRODUCTION_SEED;

      await expect(seedUsers()).rejects.toThrow(
        "Seeding is strictly disabled in production environments. Set ALLOW_PRODUCTION_SEED=true to override.",
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalAllow !== undefined) {
        process.env.ALLOW_PRODUCTION_SEED = originalAllow;
      } else {
        delete process.env.ALLOW_PRODUCTION_SEED;
      }
    }
  });

  it("seedBenchmarkMasters() throws fatal error when NODE_ENV=production without ALLOW_PRODUCTION_SEED", async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalAllow = process.env.ALLOW_PRODUCTION_SEED;
    try {
      process.env.NODE_ENV = "production";
      delete process.env.ALLOW_PRODUCTION_SEED;

      await expect(seedBenchmarkMasters()).rejects.toThrow(
        "Seeding is strictly disabled in production environments. Set ALLOW_PRODUCTION_SEED=true to override.",
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalAllow !== undefined) {
        process.env.ALLOW_PRODUCTION_SEED = originalAllow;
      } else {
        delete process.env.ALLOW_PRODUCTION_SEED;
      }
    }
  });

  it("runFullSeed() throws fatal error when NODE_ENV=production without ALLOW_PRODUCTION_SEED", async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalAllow = process.env.ALLOW_PRODUCTION_SEED;
    try {
      process.env.NODE_ENV = "production";
      delete process.env.ALLOW_PRODUCTION_SEED;

      await expect(runFullSeed()).rejects.toThrow(
        "Seeding is strictly disabled in production environments. Set ALLOW_PRODUCTION_SEED=true to override.",
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalAllow !== undefined) {
        process.env.ALLOW_PRODUCTION_SEED = originalAllow;
      } else {
        delete process.env.ALLOW_PRODUCTION_SEED;
      }
    }
  });

  it("invoking prisma/seed.ts directly exits with code 1 in production mode", () => {
    const tsxBin = fs.existsSync(path.resolve(process.cwd(), "node_modules/.bin/tsx"))
      ? path.resolve(process.cwd(), "node_modules/.bin/tsx")
      : path.resolve(process.cwd(), "server/node_modules/.bin/tsx");
    const seedPath = path.resolve(process.cwd(), "server/prisma/seed.ts");
    const result = spawnSync(
      tsxBin,
      [seedPath],
      {
        env: {
          ...process.env,
          NODE_ENV: "production",
          DATABASE_URL: "postgresql://prod_user:secret@db.prod.mill-ledger.internal:5432/mill_ledger_prod?schema=public",
          BETTER_AUTH_SECRET: "long-secure-production-secret-for-guard-test-1234",
          CORS_ORIGIN: "https://millledger.com",
          BETTER_AUTH_URL: "https://millledger.com",
        },
        encoding: "utf8",
      },
    );

    expect(result.status).toBe(1);
    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    expect(combinedOutput).toContain(
      "FATAL: Database seed script cannot be run in production environment (NODE_ENV=production)",
    );
  });
});
