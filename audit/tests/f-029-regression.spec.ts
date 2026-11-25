import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runFullSeed } from "../../server/src/db/seed.js";

describe("F-029 Regression Test: Supply Chain Security & Production Guardrails", () => {
  it("pins all GitHub Actions in CI workflow to full 40-character commit SHAs", () => {
    const ciPath = path.resolve(process.cwd(), ".github/workflows/ci.yml");
    expect(fs.existsSync(ciPath)).toBe(true);

    const ciContent = fs.readFileSync(ciPath, "utf-8");
    const actionUses = ciContent
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("uses:"));

    expect(actionUses.length).toBeGreaterThanOrEqual(3);

    for (const line of actionUses) {
      // Must match 'uses: <org>/<repo>@<40-char-sha> [# comment]'
      const match = line.match(/^uses:\s+[^@]+@([a-f0-9]{40})(?:\s+#.*)?$/);
      expect(
        match,
        `Action reference '${line}' must be pinned to a full 40-character commit SHA`,
      ).toBeTruthy();
    }
  });

  it("enforces minimum package release age in .npmrc", () => {
    const npmrcPath = path.resolve(process.cwd(), ".npmrc");
    expect(fs.existsSync(npmrcPath)).toBe(true);

    const npmrcContent = fs.readFileSync(npmrcPath, "utf-8");
    expect(npmrcContent).toMatch(/min-release-age\s*=\s*[1-9]\d*/);
  });

  it("enforces exotic subdependencies block policy in pnpm-workspace.yaml", () => {
    const workspacePath = path.resolve(process.cwd(), "pnpm-workspace.yaml");
    expect(fs.existsSync(workspacePath)).toBe(true);

    const workspaceContent = fs.readFileSync(workspacePath, "utf-8");
    expect(workspaceContent).toMatch(/blockExoticSubdeps:\s*true/);
  });

  it("strictly disables database seeding in production environments", async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "production";
      await expect(runFullSeed()).rejects.toThrow(
        "Seeding is strictly disabled in production environments.",
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
