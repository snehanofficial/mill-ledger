/**
 * AUDIT-ONLY VERIFICATION SCRIPT: Phase 14 Config & Boot Validation
 *
 * Tests:
 * 1. Missing / invalid variables in production mode (fail-fast behavior)
 * 2. Missing variables in development mode (fail-fast vs quiet fallback)
 * 3. Seed script execution under NODE_ENV=production
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const SERVER_DIR = path.resolve(ROOT, "server");

interface TestCase {
  name: string;
  env: Record<string, string>;
  expectedFail: boolean;
  expectedInStderrOrStdout: string;
}

const testCases: TestCase[] = [
  {
    name: "Production with default dev secret",
    env: {
      NODE_ENV: "production",
      BETTER_AUTH_SECRET: "mill-ledger-development-secret-123456",
      CORS_ORIGIN: "https://mill.example.com",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/mill_ledger_audit_throwaway",
    },
    expectedFail: true,
    expectedInStderrOrStdout: "BETTER_AUTH_SECRET must not use the default development secret",
  },
  {
    name: "Production with short secret (< 32 chars)",
    env: {
      NODE_ENV: "production",
      BETTER_AUTH_SECRET: "short-secret-only-24-chr",
      CORS_ORIGIN: "https://mill.example.com",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/mill_ledger_audit_throwaway",
    },
    expectedFail: true,
    expectedInStderrOrStdout: "BETTER_AUTH_SECRET must be at least 32 characters in production",
  },
  {
    name: "Production with localhost CORS_ORIGIN",
    env: {
      NODE_ENV: "production",
      BETTER_AUTH_SECRET: "a-valid-production-secret-with-more-than-32-characters!",
      CORS_ORIGIN: "http://localhost:5173",
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/mill_ledger_audit_throwaway",
    },
    expectedFail: true,
    expectedInStderrOrStdout: "CORS_ORIGIN must be explicitly configured with non-local production origin(s)",
  },
  {
    name: "Production with completely MISSING DATABASE_URL (Does it fail loudly or quietly default?)",
    env: {
      NODE_ENV: "production",
      BETTER_AUTH_SECRET: "a-valid-production-secret-with-more-than-32-characters!",
      CORS_ORIGIN: "https://mill.example.com",
      // Notice: DATABASE_URL not provided
    },
    expectedFail: true, // User requirement: "If a required setting is missing, fail loudly. Don't quietly carry on."
    expectedInStderrOrStdout: "DATABASE_URL",
  },
  {
    name: "Development with completely MISSING DATABASE_URL (Does it fail loudly or quietly default to localhost?)",
    env: {
      NODE_ENV: "development",
      DATABASE_URL: "",
    },
    expectedFail: true, // Should fail fast if required setting is missing
    expectedInStderrOrStdout: "DATABASE_URL",
  },
];

console.log("=== Testing Environment Boot Validation ===");
const results: Record<string, unknown>[] = [];

for (const tc of testCases) {
  // Use node --input-type=module with isolated env (clear process.env except essential PATH/NODE)
  const childEnv: Record<string, string> = {
    PATH: process.env.PATH || "",
    HOME: process.env.HOME || "",
    ...tc.env,
  };

  const envModulePath = path.resolve(SERVER_DIR, "src/config/env.ts").replace(/\\/g, "/");
  const code = `
    import { env } from "${envModulePath}";
    console.log("PARSED_SUCCESS: NODE_ENV=" + env.NODE_ENV + ", DB=" + env.DATABASE_URL);
  `;

  const res = spawnSync("pnpm", ["--filter", "@mill-ledger/server", "exec", "tsx", "-e", code], {
    cwd: SERVER_DIR,
    env: childEnv,
    encoding: "utf-8",
  });

  const passedValidation = res.status === 0;
  const output = (res.stdout || "") + "\n" + (res.stderr || "");
  const matchedExpectation = tc.expectedFail ? res.status !== 0 : res.status === 0;
  const messageFound = output.includes(tc.expectedInStderrOrStdout);

  console.log(`[TEST] ${tc.name}`);
  console.log(`  Exit code: ${res.status}`);
  console.log(`  Expected fail: ${tc.expectedFail}, Actually failed: ${res.status !== 0}`);
  console.log(`  Matched expectation: ${matchedExpectation && messageFound}`);
  if (!matchedExpectation || !messageFound) {
    console.log(`  Output preview: ${output.trim().split("\n").slice(0, 5).join(" ")}`);
  }

  results.push({
    test: tc.name,
    exitCode: res.status,
    passedValidation,
    expectedFail: tc.expectedFail,
    outputSummary: output.trim().slice(0, 300),
    verdict: matchedExpectation && messageFound ? "PASS" : "FAIL",
  });
}

console.log("\n=== Testing Seed Script Under NODE_ENV=production ===");
// Test if prisma/seed.ts refuses to run when NODE_ENV=production
// We pass a dummy throwaway or dry-run check
const seedDryCheckCode = `
import { runFullSeed } from "./prisma/seed.js";
console.log("Seed module loaded");
`;

const seedProdRes = spawnSync("pnpm", ["--filter", "@mill-ledger/server", "exec", "tsx", "prisma/seed.ts"], {
  cwd: SERVER_DIR,
  env: {
    PATH: process.env.PATH || "",
    HOME: process.env.HOME || "",
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/mill_ledger_audit_throwaway?schema=public",
    BETTER_AUTH_SECRET: "a-valid-production-secret-with-more-than-32-characters!",
    CORS_ORIGIN: "https://mill.example.com",
  },
  encoding: "utf-8",
});

console.log(`Seed script exit code under NODE_ENV=production: ${seedProdRes.status}`);
console.log(`Seed stdout: ${seedProdRes.stdout?.slice(0, 300)}`);
console.log(`Seed stderr: ${seedProdRes.stderr?.slice(0, 300)}`);

const seedRefused = seedProdRes.status !== 0 && (seedProdRes.stderr?.includes("production") || seedProdRes.stdout?.includes("production"));
console.log(`Seed refused in production: ${seedRefused}`);

import fs from "node:fs";
const evidenceDir = path.resolve(ROOT, "audit/evidence");
if (!fs.existsSync(evidenceDir)) fs.mkdirSync(evidenceDir, { recursive: true });

fs.writeFileSync(
  path.join(evidenceDir, "config-boot-results.json"),
  JSON.stringify(
    {
      bootValidation: results,
      seedInProduction: {
        exitCode: seedProdRes.status,
        refused: seedRefused,
        stdout: seedProdRes.stdout?.slice(0, 300),
        stderr: seedProdRes.stderr?.slice(0, 300),
      },
    },
    null,
    2
  )
);

console.log("\nDone config checks. Saved to audit/evidence/config-boot-results.json");
