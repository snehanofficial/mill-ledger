import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("F-098 Regression: Documentation Drift and Truthful Claims Verification", () => {
  const rootDir = path.resolve(__dirname, "../..");

  it("ensures README.md does not contain the 'modular monolog' typo", () => {
    const readmePath = path.join(rootDir, "README.md");
    const content = fs.readFileSync(readmePath, "utf-8");

    expect(content).not.toContain("modular monolog");
    expect(content).toContain("modular monolith");
  });

  it("ensures README.md accurately reflects backend port 4000", () => {
    const readmePath = path.join(rootDir, "README.md");
    const content = fs.readFileSync(readmePath, "utf-8");

    expect(content).toContain("http://localhost:4000");
    expect(content).not.toContain("http://localhost:3000");
  });

  it("ensures README.md scope claims are reconciled and truthful", () => {
    const readmePath = path.join(rootDir, "README.md");
    const content = fs.readFileSync(readmePath, "utf-8");

    // Must not claim unbuilt 'purchase register' report
    expect(content).not.toContain("purchase register,");

    // Must qualify Tamil language scope accurately
    expect(content).toContain("Bilingual navigation and outbox sync toggled on the application shell");
  });
});
