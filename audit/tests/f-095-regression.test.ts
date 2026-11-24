import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

describe("F-095 Regression: Strict Type Safety & Domain Zero-any Enforcement", () => {
  it("enforces strict mode in client/tsconfig.app.json", () => {
    const tsconfigPath = path.resolve(process.cwd(), "client/tsconfig.app.json");
    expect(fs.existsSync(tsconfigPath)).toBe(true);
    const { config, error } = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
    expect(error).toBeUndefined();
    expect(config.compilerOptions.strict).toBe(true);
  });

  it("enforces zero explicit 'any' types in domain layer files", () => {
    const domainDirs = [
      path.resolve(process.cwd(), "server/src/modules"),
      path.resolve(process.cwd(), "server/src/policies"),
      path.resolve(process.cwd(), "shared/src"),
    ];

    const domainFiles: string[] = [];

    function findDomainFiles(dir: string) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          findDomainFiles(full);
        } else if (
          (entry.name.endsWith(".service.ts") ||
            (dir.includes("policies") && entry.name.endsWith(".ts") && !entry.name.includes(".test.")) ||
            (dir.includes("shared/src") && entry.name.endsWith(".ts") && !entry.name.includes(".test."))) &&
          !entry.name.includes(".test.")
        ) {
          domainFiles.push(full);
        }
      }
    }

    for (const d of domainDirs) {
      findDomainFiles(d);
    }

    expect(domainFiles.length).toBeGreaterThan(15);

    const filesWithAny: { file: string; line: number; text: string }[] = [];

    for (const file of domainFiles) {
      const code = fs.readFileSync(file, "utf-8");
      const sf = ts.createSourceFile(
        file,
        code,
        ts.ScriptTarget.Latest,
        true,
      );

      function visit(node: ts.Node) {
        if (node.kind === ts.SyntaxKind.AnyKeyword) {
          const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
          filesWithAny.push({
            file: path.relative(process.cwd(), file),
            line: line + 1,
            text: node.parent ? node.parent.getText(sf) : "any",
          });
        }
        ts.forEachChild(node, visit);
      }

      visit(sf);
    }

    expect(filesWithAny).toEqual([]);
  });
});
