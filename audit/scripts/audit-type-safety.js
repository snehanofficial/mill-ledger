import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const stats = {
  totalFiles: 0,
  domainFiles: 0,
  anyCount: 0,
  asUnknownAsCount: 0,
  nonNullCount: 0,
  tsIgnoreCount: 0,
  lintDisableCount: 0,
  violations: {
    domainAny: [],
    nonDomainAny: [],
    asUnknownAs: [],
    nonNull: [],
    tsDirectives: [],
    lintDisables: []
  }
};

function isDomainLayer(filePath) {
  // Domain layer includes domain services, policies, domain calculations, ledger, costing, GST, shared contracts/schemas
  const normalized = filePath.replace(/\\/g, '/');
  return (
    normalized.includes('server/src/modules/') && normalized.endsWith('.service.ts') ||
    normalized.includes('server/src/policies/') ||
    normalized.includes('shared/src/')
  );
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'audit', '.system_generated'].includes(entry.name)) continue;
      walk(full);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      if (entry.name.includes('.test.') || entry.name.includes('.spec.')) continue;
      scanSourceFile(full);
    }
  }
}

function scanSourceFile(filePath) {
  stats.totalFiles++;
  const isDomain = isDomainLayer(filePath);
  if (isDomain) stats.domainFiles++;

  const content = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  // 1. Comments scan for @ts-ignore, @ts-expect-error, @ts-nocheck, eslint-disable, oxlint-disable
  const commentRanges = ts.getLeadingCommentRanges(content, 0) || [];
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    if (/@ts-(ignore|expect-error|nocheck)/.test(line)) {
      stats.tsIgnoreCount++;
      stats.violations.tsDirectives.push({
        file: filePath,
        line: lineNum,
        text: line.trim()
      });
    }
    if (/(eslint|oxlint)-disable/.test(line)) {
      stats.lintDisableCount++;
      stats.violations.lintDisables.push({
        file: filePath,
        line: lineNum,
        text: line.trim()
      });
    }
  });

  // 2. AST visitor
  function visit(node) {
    // Non-null assertion: expr!
    if (ts.isNonNullExpression(node)) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      stats.nonNullCount++;
      stats.violations.nonNull.push({
        file: filePath,
        line: line + 1,
        col: character + 1,
        code: node.getText(sourceFile),
        isDomain
      });
    }

    // Type assertion 'as unknown as ...'
    if (ts.isAsExpression(node)) {
      // check if expr is another AsExpression with unknown
      if (ts.isAsExpression(node.expression)) {
        const innerType = node.expression.type.getText(sourceFile);
        if (innerType === 'unknown') {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          stats.asUnknownAsCount++;
          stats.violations.asUnknownAs.push({
            file: filePath,
            line: line + 1,
            col: character + 1,
            code: node.getText(sourceFile),
            isDomain
          });
        }
      }
    }

    // Explicit `any` keyword
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      stats.anyCount++;
      const item = {
        file: filePath,
        line: line + 1,
        col: character + 1,
        parentKind: ts.SyntaxKind[node.parent.kind],
        snippet: node.parent.getText(sourceFile).slice(0, 80).replace(/\n/g, ' ')
      };
      if (isDomain) {
        stats.violations.domainAny.push(item);
      } else {
        stats.violations.nonDomainAny.push(item);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

walk('client/src');
walk('server/src');
walk('shared/src');

fs.writeFileSync('audit/evidence/quality/type-safety-audit.json', JSON.stringify(stats, null, 2));

console.log('=== TYPE SAFETY AUDIT METRICS ===');
console.log(`Total non-test TS/TSX files: ${stats.totalFiles}`);
console.log(`Domain layer files: ${stats.domainFiles}`);
console.log(`Total 'any' keywords: ${stats.anyCount}`);
console.log(`  - in Domain layer: ${stats.violations.domainAny.length}`);
console.log(`  - in Non-domain: ${stats.violations.nonDomainAny.length}`);
console.log(`'as unknown as' count: ${stats.asUnknownAsCount}`);
console.log(`Non-null assertions count (!): ${stats.nonNullCount}`);
console.log(`@ts-ignore / @ts-expect-error count: ${stats.tsIgnoreCount}`);
console.log(`eslint/oxlint-disable count: ${stats.lintDisableCount}`);
