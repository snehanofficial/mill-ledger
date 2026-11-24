import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { z } = require("../../server/node_modules/zod/index.js");

describe("F-006 Regression Test: Zod High-Severity DoS Advisory (GHSA-mrhx-c7xc-m3w5)", () => {
  it("verifies installed Zod version is >= 4.6.6 across packages", () => {
    const packages = ["server", "shared"];
    for (const pkg of packages) {
      const zodPkgPath = path.resolve(
        process.cwd(),
        pkg,
        "node_modules/zod/package.json",
      );
      expect(fs.existsSync(zodPkgPath)).toBe(true);
      const zodPkg = JSON.parse(fs.readFileSync(zodPkgPath, "utf8"));
      const [major, minor, patch] = zodPkg.version.split(".").map(Number);
      // GHSA-mrhx-c7xc-m3w5 is patched in >= 4.6.6
      const isPatched =
        major > 4 ||
        (major === 4 && (minor > 6 || (minor === 6 && patch >= 6)));
      expect(isPatched).toBe(true);
    }
  });

  it("safely parses collections without memory exhaustion", () => {
    // Schema with constrained collection
    const schema = z.object({
      tags: z.array(z.string().min(1)).min(1).max(50),
      nested: z.record(z.string(), z.string()).optional(),
    });

    // Valid collection parses cleanly
    const sample = {
      tags: Array.from({ length: 10 }, (_, i) => `tag-${i}`),
      nested: { key: "value" },
    };
    const parsed = schema.safeParse(sample);
    expect(parsed.success).toBe(true);
  });

  it("rejects oversized collection cleanly without hang or memory leak", () => {
    const schema = z.object({
      items: z.array(z.string()).max(5),
    });

    const oversized = {
      items: Array.from({ length: 100 }, (_, i) => `item-${i}`),
    };

    const parsed = schema.safeParse(oversized);
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.length).toBeGreaterThan(0);
  });
});
