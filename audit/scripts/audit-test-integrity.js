import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const testFiles = [
  'client/src/lib/auth-client.test.ts',
  'client/src/lib/utils.test.ts',
  'client/src/lib/i18n.test.ts',
  'server/src/masters.test.ts',
  'server/src/invoice-dispatch.test.ts',
  'server/src/sequence-concurrency.test.ts',
  'server/src/policies/abac.test.ts',
  'server/src/policies/rbac.test.ts',
  'server/src/purchases.test.ts',
  'server/src/auth.integration.test.ts',
  'server/src/payments.test.ts',
  'server/src/config/env.test.ts',
  'server/src/middleware/auth.middleware.test.ts',
  'server/src/reports.test.ts',
  'server/src/inventory-concurrency.test.ts',
  'server/src/lib/origins.test.ts',
  'server/src/app.test.ts',
  'server/src/orders.test.ts',
  'server/src/offline-sync.test.ts',
  'server/src/production.test.ts'
];

const report = {
  totalTestFiles: testFiles.length,
  totalTests: 0,
  zeroAssertionTests: [],
  trivialAssertions: [],
  snapshotTests: [],
  mockOnlyAssertionTests: [],
  mockedUnitsUnderTest: [],
  databaseUsage: {
    realPostgresTests: [],
    mockedTests: [],
    pureUnitTests: []
  }
};

for (const filePath of testFiles) {
  const content = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  // Check DB usage
  const usesPrisma = /prismaClient|@prisma\/client|prisma\./.test(content);
  const usesMockPrisma = /vi\.mock\(.*prisma/i.test(content) || /mockDeep/.test(content);
  const usesFetchOrSupertest = /supertest|fetch\(|request\(app\)/.test(content);

  if (usesMockPrisma) {
    report.databaseUsage.mockedTests.push(filePath);
  } else if (usesPrisma || usesFetchOrSupertest) {
    report.databaseUsage.realPostgresTests.push(filePath);
  } else {
    report.databaseUsage.pureUnitTests.push(filePath);
  }

  // Check mocks of unit under test
  // If filePath is reports.test.ts, check if reports.service or reporting is mocked
  const basename = path.basename(filePath, path.extname(filePath)).replace('.test', '');
  const mockRegex = /vi\.mock\(\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = mockRegex.exec(content)) !== null) {
    const mockedModule = m[1];
    if (mockedModule.includes(basename)) {
      report.mockedUnitsUnderTest.push({
        file: filePath,
        mockedModule
      });
    }
  }

  // Walk AST to find test/it calls
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const callText = node.expression.getText(sourceFile);
      if (callText === 'it' || callText === 'test' || callText === 'it.skip' || callText === 'test.skip' || callText === 'it.only') {
        report.totalTests++;
        const testNameNode = node.arguments[0];
        const testName = testNameNode && ts.isStringLiteral(testNameNode) ? testNameNode.text : '<unnamed>';
        const testFn = node.arguments[1];

        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());

        if (testFn) {
          const fnText = testFn.getText(sourceFile);
          
          // Count expects
          const expectMatches = fnText.match(/\bexpect\s*\(/g) || [];
          if (expectMatches.length === 0) {
            report.zeroAssertionTests.push({
              file: filePath,
              line: line + 1,
              testName
            });
          }

          // Check for trivial assertions like expect(true).toBe(true) or expect(1).toBe(1)
          if (/expect\s*\(\s*(true|false|1|0)\s*\)\s*\.\s*to(Be|Equal)\s*\(\s*\1\s*\)/.test(fnText) ||
              /expect\s*\(\s*true\s*\)\s*\.\s*toBe(Truthy)?\s*\(\s*\)/.test(fnText)) {
            report.trivialAssertions.push({
              file: filePath,
              line: line + 1,
              testName,
              snippet: fnText.slice(0, 100)
            });
          }

          // Check for snapshot
          if (/toMatchSnapshot|toMatchInlineSnapshot/.test(fnText)) {
            report.snapshotTests.push({
              file: filePath,
              line: line + 1,
              testName
            });
          }

          // Check if it ONLY asserts mocks were called
          if (expectMatches.length > 0) {
            const mockCalls = fnText.match(/\bexpect\([^)]+\)\.(toHaveBeenCalled|toHaveBeenCalledTimes|toHaveBeenCalledWith)/g) || [];
            if (mockCalls.length === expectMatches.length) {
              report.mockOnlyAssertionTests.push({
                file: filePath,
                line: line + 1,
                testName,
                mockCallsCount: mockCalls.length
              });
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

fs.writeFileSync('audit/evidence/quality/test-integrity-report.json', JSON.stringify(report, null, 2));

console.log('=== TEST INTEGRITY REPORT ===');
console.log(`Total test files: ${report.totalTestFiles}`);
console.log(`Total tests detected: ${report.totalTests}`);
console.log(`Tests with 0 assertions: ${report.zeroAssertionTests.length}`);
console.log(`Trivial assertions [expect(true)]: ${report.trivialAssertions.length}`);
console.log(`Snapshot tests: ${report.snapshotTests.length}`);
console.log(`Mock-only assertion tests: ${report.mockOnlyAssertionTests.length}`);
console.log(`Tests mocking unit under test: ${report.mockedUnitsUnderTest.length}`);
console.log(`Real PostgreSQL integration test files: ${report.databaseUsage.realPostgresTests.length}`);
console.log(`Mocked DB test files: ${report.databaseUsage.mockedTests.length}`);
console.log(`Pure unit test files (no DB): ${report.databaseUsage.pureUnitTests.length}`);
console.log('\nDB Usage breakdown:');
console.log('Real DB:', report.databaseUsage.realPostgresTests);
console.log('Mocked DB:', report.databaseUsage.mockedTests);
console.log('Pure Unit:', report.databaseUsage.pureUnitTests);
