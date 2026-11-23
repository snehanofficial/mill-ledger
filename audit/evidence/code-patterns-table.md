# Code Patterns Inventory

| Pattern | Total Occurrences | Files Count |
|---------|-------------------|-------------|
| `TODO` | **0** | 0 |
| `FIXME` | **0** | 0 |
| `HACK` | **0** | 0 |
| `XXX` | **0** | 0 |
| `@ts-ignore` | **0** | 0 |
| `eslint-disable` | **1** | 1 |
| `console.log` | **33** | 4 |
| `any (TypeScript type)` | **43** | 14 |

## Detailed Occurrences List

| Pattern | File:Line | Snippet |
|---------|-----------|---------|
| `any (TypeScript type)` | `client/src/lib/auth-client.test.ts:51` | `} as any);` |
| `any (TypeScript type)` | `client/src/lib/auth-client.test.ts:129` | `} as any);` |
| `any (TypeScript type)` | `client/src/offline/sync-engine.ts:39` | `apiClient.get<{ customers: Array<any> }>("/sales/customers"),` |
| `any (TypeScript type)` | `client/src/offline/sync-engine.ts:40` | `apiClient.get<{ products: Array<any> }>("/sales/products"),` |
| `any (TypeScript type)` | `client/src/offline/sync-engine.ts:229` | `} catch (err: any) {` |
| `any (TypeScript type)` | `client/src/pages/dispatch-page.tsx:149` | `onError: (err: any) => {` |
| `any (TypeScript type)` | `client/src/pages/orders-page.tsx:289` | `} catch (err: any) {` |
| `any (TypeScript type)` | `client/src/pages/payments-page.tsx:183` | `(i: any) => Number(i.outstandingAmount) > 0,` |
| `any (TypeScript type)` | `client/src/pages/payments-page.tsx:217` | `onError: (err: any) => {` |
| `any (TypeScript type)` | `client/src/pages/purchases-page.tsx:160` | `onError: (err: any) => {` |
| `any (TypeScript type)` | `client/src/pages/reports-page.tsx:235` | `{(salesData?.rows || []).map((row: any, idx: number) => (` |
| `any (TypeScript type)` | `client/src/pages/reports-page.tsx:330` | `{(gstData?.rateBreakup || []).map((r: any, idx: number) => (` |
| `any (TypeScript type)` | `client/src/pages/reports-page.tsx:365` | `{(gstData?.hsnSummary || []).map((h: any, idx: number) => (` |
| `any (TypeScript type)` | `client/src/pages/reports-page.tsx:428` | `{(stockData?.rows || []).map((row: any) => (` |
| `any (TypeScript type)` | `client/src/pages/reports-page.tsx:513` | `{(prodData?.rows || []).map((row: any) => (` |
| `any (TypeScript type)` | `client/src/pages/reports-page.tsx:592` | `{(recData?.rows || []).map((row: any) => (` |
| `any (TypeScript type)` | `client/src/pages/reports-page.tsx:670` | `auditData?.logs.map((log: any) => (` |
| `any (TypeScript type)` | `server/src/auth.integration.test.ts:28` | `): Promise<{ cookie: string; user: any }> {` |
| `eslint-disable` | `server/src/db/client.ts:13` | `// eslint-disable-next-line no-var` |
| `console.log` | `server/src/db/seed.ts:70` | `console.log("Seeding test users for M1...");` |
| `console.log` | `server/src/db/seed.ts:118` | `console.log('Created user ${user.email} with role ${user.role}');` |
| `console.log` | `server/src/db/seed.ts:123` | `console.log("Seeding benchmark master data and opening stock (M2)...");` |
| `console.log` | `server/src/db/seed.ts:592` | `console.log("M2 benchmark master data seed successfully completed.");` |
| `console.log` | `server/src/index.ts:7` | `console.log(` |
| `console.log` | `server/src/index.ts:13` | `console.log("Shutting down gracefully...");` |
| `console.log` | `server/src/index.ts:15` | `console.log("HTTP server closed");` |
| `any (TypeScript type)` | `server/src/modules/reporting/audit.service.ts:71` | `const where: any = {` |
| `any (TypeScript type)` | `server/src/modules/reporting/reporting.routes.ts:140` | `let data: any;` |
| `any (TypeScript type)` | `server/src/modules/reporting/reporting.routes.ts:239` | `let result: any;` |
| `any (TypeScript type)` | `server/src/modules/reporting/reporting.service.ts:35` | `const where: any = {` |
| `any (TypeScript type)` | `server/src/modules/reporting/reporting.service.ts:68` | `const rows: any[] = [];` |
| `any (TypeScript type)` | `server/src/modules/reporting/reporting.service.ts:147` | `const where: any = {` |
| `any (TypeScript type)` | `server/src/modules/reporting/reporting.service.ts:169` | `const b2bSupplies: any[] = [];` |
| `any (TypeScript type)` | `server/src/modules/reporting/reporting.service.ts:171` | `const b2cSupplies: any[] = [];` |
| `any (TypeScript type)` | `server/src/modules/reporting/reporting.service.ts:173` | `const creditNotes: any[] = [];` |
| `any (TypeScript type)` | `server/src/modules/reporting/reporting.service.ts:328` | `const where: any = {` |
| `any (TypeScript type)` | `server/src/modules/reporting/reporting.service.ts:358` | `const rows: any[] = [];` |
| `any (TypeScript type)` | `server/src/modules/reporting/reporting.service.ts:513` | `const where: any = {` |
| `any (TypeScript type)` | `server/src/modules/reporting/reporting.service.ts:625` | `const where: any = {` |
| `any (TypeScript type)` | `server/src/modules/reporting/reporting.service.ts:919` | `userContext?: any,` |
| `any (TypeScript type)` | `server/src/modules/reporting/reporting.service.ts:921` | `let reportData: any;` |
| `any (TypeScript type)` | `server/src/modules/reporting/reporting.service.ts:960` | `const rows: any[] = reportData.rows || reportData.b2bSupplies || [];` |
| `any (TypeScript type)` | `server/src/payments.test.ts:252` | `(e: any) => e.documentType === "INVOICE",` |
| `any (TypeScript type)` | `server/src/payments.test.ts:255` | `(e: any) => e.documentType === "PAYMENT",` |
| `any (TypeScript type)` | `server/src/purchases.test.ts:154` | `(b: any) => b.sku === "RM-FLOUR",` |
| `any (TypeScript type)` | `server/src/reports.test.ts:275` | `const flourRow = stock.rows.find((r: any) => r.sku === "RM-FLOUR");` |
| `any (TypeScript type)` | `server/src/reports.test.ts:281` | `const fgRow = stock.rows.find((r: any) => r.sku === "FG-MURUKKU-200G");` |
| `any (TypeScript type)` | `server/src/reports.test.ts:314` | `const retARow = rec.rows.find((r: any) => r.customerCode === "CUST-RET-A");` |
| `any (TypeScript type)` | `server/src/reports.test.ts:356` | `const exportLog = auditData.logs.find((l: any) => l.action === "EXPORT");` |
| `any (TypeScript type)` | `server/src/reports.test.ts:405` | `const customerCodes = sales1Rec.rows.map((r: any) => r.customerCode);` |
| `any (TypeScript type)` | `server/src/reports.test.ts:418` | `const spoofCodes = spoofRec.rows.map((r: any) => r.customerCode);` |
| `console.log` | `server/src/scripts/run-benchmark.ts:20` | `console.log("==========================================================");` |
| `console.log` | `server/src/scripts/run-benchmark.ts:21` | `console.log(" MillLedger CDI Benchmark Acceptance Oracle Runner");` |
| `console.log` | `server/src/scripts/run-benchmark.ts:22` | `console.log(" Target: docs/benchmark.md (100% exact numerical match)");` |
| `console.log` | `server/src/scripts/run-benchmark.ts:23` | `console.log("==========================================================\n");` |
| `console.log` | `server/src/scripts/run-benchmark.ts:28` | `console.log("Cleaning database tables...");` |
| `console.log` | `server/src/scripts/run-benchmark.ts:52` | `console.log("Seeding benchmark masters and opening stock...");` |
| `console.log` | `server/src/scripts/run-benchmark.ts:124` | `console.log(` |
| `console.log` | `server/src/scripts/run-benchmark.ts:157` | `console.log(` |
| `console.log` | `server/src/scripts/run-benchmark.ts:234` | `console.log(` |
| `console.log` | `server/src/scripts/run-benchmark.ts:288` | `console.log(` |
| `console.log` | `server/src/scripts/run-benchmark.ts:325` | `console.log(` |
| `console.log` | `server/src/scripts/run-benchmark.ts:358` | `console.log(` |
| `console.log` | `server/src/scripts/run-benchmark.ts:391` | `console.log(` |
| `console.log` | `server/src/scripts/run-benchmark.ts:449` | `console.log("Verifying sales register and stock valuation reports...");` |
| `console.log` | `server/src/scripts/run-benchmark.ts:473` | `console.log("\n==========================================================");` |
| `console.log` | `server/src/scripts/run-benchmark.ts:474` | `console.log(" Benchmark Acceptance Summary Results");` |
| `console.log` | `server/src/scripts/run-benchmark.ts:475` | `console.log("==========================================================");` |
| `console.log` | `server/src/scripts/run-benchmark.ts:481` | `console.log(` |
| `console.log` | `server/src/scripts/run-benchmark.ts:486` | `console.log("==========================================================");` |
| `console.log` | `server/src/scripts/run-benchmark.ts:488` | `console.log(" SUCCESS: All 18 benchmark assertions matched 100%!");` |
| `console.log` | `server/src/scripts/run-benchmark.ts:489` | `console.log(" Exit code: 0");` |
| `console.log` | `server/src/scripts/run-benchmark.ts:493` | `console.log(" Exit code: 1");` |
| `console.log` | `server/prisma/seed.ts:70` | `console.log("Seeding test users for M1...");` |
| `console.log` | `server/prisma/seed.ts:118` | `console.log('Created user ${user.email} with role ${user.role}');` |
| `console.log` | `server/prisma/seed.ts:123` | `console.log("Seeding benchmark master data and opening stock (M2)...");` |
| `console.log` | `server/prisma/seed.ts:592` | `console.log("M2 benchmark master data seed successfully completed.");` |
