import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("F-005 Regression Suite: Unused Dependency `cn` Removal", () => {
  const clientPackageJsonPath = path.resolve(__dirname, "../../client/package.json");
  const utilsPath = path.resolve(__dirname, "../../client/src/lib/utils.ts");

  it("verifies that client/package.json does not list cn dependency", () => {
    const pkg = JSON.parse(fs.readFileSync(clientPackageJsonPath, "utf-8"));

    expect(pkg.dependencies?.cn).toBeUndefined();
    expect(pkg.devDependencies?.cn).toBeUndefined();
  });

  it("verifies that client/src/lib/utils.ts exports cn using clsx and twMerge locally", () => {
    const utilsSource = fs.readFileSync(utilsPath, "utf-8");

    expect(utilsSource).toContain("clsx");
    expect(utilsSource).toContain("twMerge");
    expect(utilsSource).toContain("export function cn");
  });
});
