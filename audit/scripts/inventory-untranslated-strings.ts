import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

interface StringInventory {
  jsxTexts: Array<{ file: string; line: number; text: string }>;
  attributes: Array<{ file: string; line: number; attr: string; text: string }>;
  toasts: Array<{ file: string; line: number; type: string; text: string }>;
  placeholders: Array<{ file: string; line: number; text: string }>;
  titles: Array<{ file: string; line: number; text: string }>;
  ariaLabels: Array<{ file: string; line: number; text: string }>;
  tCalls: Array<{ file: string; line: number; key: string; fallback?: string }>;
}

const inventory: StringInventory = {
  jsxTexts: [],
  attributes: [],
  toasts: [],
  placeholders: [],
  titles: [],
  ariaLabels: [],
  tCalls: [],
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const clientSrcDir = path.resolve(repoRoot, "client/src");

function walk(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath, fileList);
    } else if (/\.(tsx|ts)$/.test(file) && !file.endsWith(".test.ts") && !file.endsWith(".test.tsx")) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const files = walk(clientSrcDir);

for (const filePath of files) {
  const relPath = path.relative(repoRoot, filePath);
  const content = fs.readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  function getLine(pos: number) {
    return sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
  }

  function visit(node: ts.Node) {
    // 1. Check JSX Text
    if (ts.isJsxText(node)) {
      const text = node.getText(sourceFile).trim();
      // Filter empty or pure punctuation / numbers
      if (text.length > 1 && /[a-zA-Z]/.test(text)) {
        inventory.jsxTexts.push({
          file: relPath,
          line: getLine(node.getStart(sourceFile)),
          text,
        });
      }
    }

    // 2. Check JSX Attributes (placeholder, aria-label, title)
    if (ts.isJsxAttribute(node)) {
      const attrName = node.name.text;
      if (node.initializer && ts.isStringLiteral(node.initializer)) {
        const val = node.initializer.text.trim();
        if (val.length > 0) {
          if (attrName === "placeholder") {
            inventory.placeholders.push({ file: relPath, line: getLine(node.getStart(sourceFile)), text: val });
          } else if (attrName === "aria-label") {
            inventory.ariaLabels.push({ file: relPath, line: getLine(node.getStart(sourceFile)), text: val });
          } else if (attrName === "title") {
            inventory.titles.push({ file: relPath, line: getLine(node.getStart(sourceFile)), text: val });
          }
        }
      }
    }

    // 3. Check calls to t("...")
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (ts.isIdentifier(expr) && expr.text === "t") {
        const firstArg = node.arguments[0];
        const secondArg = node.arguments[1];
        let key = "";
        let fallback: string | undefined;
        if (firstArg && ts.isStringLiteral(firstArg)) {
          key = firstArg.text;
        }
        if (secondArg && ts.isStringLiteral(secondArg)) {
          fallback = secondArg.text;
        }
        inventory.tCalls.push({
          file: relPath,
          line: getLine(node.getStart(sourceFile)),
          key,
          fallback,
        });
      }

      // Check toast calls: toast.error("..."), toast.success("..."), toast.info("...")
      if (ts.isPropertyAccessExpression(expr)) {
        if (ts.isIdentifier(expr.expression) && expr.expression.text === "toast") {
          const toastType = expr.name.text;
          const firstArg = node.arguments[0];
          if (firstArg && ts.isStringLiteral(firstArg)) {
            inventory.toasts.push({
              file: relPath,
              line: getLine(node.getStart(sourceFile)),
              type: toastType,
              text: firstArg.text,
            });
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

fs.mkdirSync(path.resolve(repoRoot, "audit/evidence"), { recursive: true });
fs.writeFileSync(
  path.resolve(repoRoot, "audit/evidence/i18n-string-inventory.json"),
  JSON.stringify(inventory, null, 2)
);

console.log("=== I18N STRING INVENTORY RESULTS ===");
console.log(`Total JSX Text strings: ${inventory.jsxTexts.length}`);
console.log(`Total Placeholders: ${inventory.placeholders.length}`);
console.log(`Total Aria Labels: ${inventory.ariaLabels.length}`);
console.log(`Total Titles: ${inventory.titles.length}`);
console.log(`Total Toasts: ${inventory.toasts.length}`);
console.log(`Total t() translation calls: ${inventory.tCalls.length}`);
console.log(`Untranslated client user-visible strings: ${inventory.jsxTexts.length + inventory.placeholders.length + inventory.ariaLabels.length + inventory.titles.length + inventory.toasts.length}`);
