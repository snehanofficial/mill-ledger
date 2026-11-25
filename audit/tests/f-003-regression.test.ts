import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("F-003 Regression Suite: Prisma 7 CLI DB Seed Configuration", () => {
  const prismaConfigPath = path.resolve(__dirname, "../../server/prisma.config.ts");
  const serverPackageJsonPath = path.resolve(__dirname, "../../server/package.json");
  const seedScriptPath = path.resolve(__dirname, "../../server/prisma/seed.ts");

  it("verifies that server/prisma.config.ts defines migrations.seed property", () => {
    const configSource = fs.readFileSync(prismaConfigPath, "utf-8");

    expect(configSource).toContain("migrations:");
    expect(configSource).toMatch(/seed:\s*["']tsx \.\/prisma\/seed\.ts["']/);
  });

  it("verifies that server/package.json declares db:seed script", () => {
    const pkg = JSON.parse(fs.readFileSync(serverPackageJsonPath, "utf-8"));

    expect(pkg.scripts["db:seed"]).toBe("tsx prisma/seed.ts");
  });

  it("verifies that the target seed script exists on disk", () => {
    expect(fs.existsSync(seedScriptPath)).toBe(true);
    const seedSource = fs.readFileSync(seedScriptPath, "utf-8");
    expect(seedSource).toContain("Seeding test users");
    expect(seedSource).toContain("Seeding benchmark master data");
  });
});
