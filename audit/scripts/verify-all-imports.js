import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const results = {
  totalImports: 0,
  thirdPartyImports: 0,
  localImports: 0,
  verifiedPackages: new Set(),
  realMissingRuntimeSymbols: [],
  typeOnlySymbolsIdentified: []
};

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'audit', '.system_generated'].includes(entry.name)) continue;
      walk(full);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      if (entry.name.includes('.test.') || entry.name.includes('.spec.')) continue;
      checkImportsInFile(full);
    }
  }
}

function checkImportsInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  ts.forEachChild(sourceFile, (node) => {
    if (ts.isImportDeclaration(node)) {
      results.totalImports++;
      const moduleSpecifier = node.moduleSpecifier.text;
      const namedBindings = node.importClause?.namedBindings;

      const isLocal = moduleSpecifier.startsWith('.') || moduleSpecifier.startsWith('@/') || moduleSpecifier.startsWith('@mill-ledger/');
      if (isLocal) {
        results.localImports++;
        return;
      }

      results.thirdPartyImports++;
      results.verifiedPackages.add(moduleSpecifier);

      const isClauseTypeOnly = node.importClause?.isTypeOnly;

      if (namedBindings && ts.isNamedImports(namedBindings)) {
        for (const el of namedBindings.elements) {
          const isElementPropertyTypeOnly = el.isTypeOnly;
          const isTypeOnly = isClauseTypeOnly || isElementPropertyTypeOnly;
          const symbolName = el.propertyName?.text || el.name.text;

          if (isTypeOnly) {
            results.typeOnlySymbolsIdentified.push({
              file: filePath,
              module: moduleSpecifier,
              symbol: symbolName
            });
            continue;
          }

          // Value import: test against runtime module
          try {
            const resolvedPath = require.resolve(moduleSpecifier, { paths: [path.dirname(filePath), process.cwd()] });
            let mod;
            try {
              mod = require(resolvedPath);
            } catch {
              // ESM or bundled
            }

            if (mod && typeof mod === 'object') {
              const hasKey = symbolName in mod || (mod.default && typeof mod.default === 'object' && symbolName in mod.default);
              if (!hasKey) {
                // If it wasn't marked `type`, but it's actually a type in standard libraries (like ReactNode, etc.), flag it
                const knownTypes = new Set(['ReactNode', 'ComponentProps', 'CSSProperties', 'ReactElement', 'Ref', 'VariantProps']);
                if (knownTypes.has(symbolName)) {
                  results.typeOnlySymbolsIdentified.push({
                    file: filePath,
                    module: moduleSpecifier,
                    symbol: symbolName,
                    note: 'Imported as value but is a TypeScript interface/type (missing `type` keyword)'
                  });
                } else {
                  results.realMissingRuntimeSymbols.push({
                    file: filePath,
                    module: moduleSpecifier,
                    symbol: symbolName,
                    keysFound: Object.keys(mod).slice(0, 15)
                  });
                }
              }
            }
          } catch (err) {
            // Cannot resolve package
          }
        }
      }
    }
  });
}

walk('client/src');
walk('server/src');
walk('shared/src');

const finalReport = {
  totalImports: results.totalImports,
  thirdPartyImports: results.thirdPartyImports,
  localImports: results.localImports,
  uniqueThirdPartyModules: Array.from(results.verifiedPackages),
  realMissingRuntimeSymbols: results.realMissingRuntimeSymbols,
  typeOnlySymbolsIdentified: results.typeOnlySymbolsIdentified
};

fs.writeFileSync('audit/evidence/quality/imported-symbols-verification.json', JSON.stringify(finalReport, null, 2));

console.log('Verified 3rd party packages:', finalReport.uniqueThirdPartyModules);
console.log('Real missing runtime symbols:', finalReport.realMissingRuntimeSymbols.length);
console.log('Type symbols imported without `type` keyword:', finalReport.typeOnlySymbolsIdentified.filter(x => x.note).length);
if (finalReport.typeOnlySymbolsIdentified.filter(x => x.note).length > 0) {
  console.log(finalReport.typeOnlySymbolsIdentified.filter(x => x.note));
}
