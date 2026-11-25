/**
 * AUDIT-ONLY SCRIPT: Phase 14 Database Operations Verification
 *
 * Checks:
 * 1. Connection pool sizing and timeouts in code (statement_timeout, idleTimeoutMillis, max)
 * 2. Execute pg_dump against populated database (timing and size)
 * 3. Execute pg_restore into throwaway test database (timing, validation of record counts)
 * 4. Execute prisma migrate deploy against populated database
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "../../server/node_modules/pg/lib/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const SCRATCH_DIR = path.resolve(ROOT, "audit/scratch");
const EVIDENCE_DIR = path.resolve(ROOT, "audit/evidence");

if (!fs.existsSync(SCRATCH_DIR)) fs.mkdirSync(SCRATCH_DIR, { recursive: true });
if (!fs.existsSync(EVIDENCE_DIR)) fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

const PG_HOST = process.env.PGHOST || "localhost";
const PG_PORT = process.env.PGPORT || "5432";
const PG_USER = process.env.PGUSER || "postgres";
const PG_PASSWORD = process.env.PGPASSWORD || "postgres";
const SOURCE_DB = "mill_ledger_audit_throwaway";
const RESTORE_TARGET_DB = "mill_ledger_restore_test";

async function main() {
  console.log("=== Phase 14 Database Operations Verification ===");

  // 1. Check client pool settings in server/src/db/client.ts
  const clientTsPath = path.resolve(ROOT, "server/src/db/client.ts");
  const clientTsContent = fs.readFileSync(clientTsPath, "utf-8");

  const poolHasMax = /max\s*:/.test(clientTsContent);
  const poolHasStatementTimeout = /statement_timeout/i.test(clientTsContent);
  const poolHasIdleTimeout = /idleTimeoutMillis/i.test(clientTsContent);
  const poolHasConnectionTimeout = /connectionTimeoutMillis/i.test(clientTsContent);

  console.log("Pool configuration checks in server/src/db/client.ts:");
  console.log(`  Explicit max pool size: ${poolHasMax}`);
  console.log(`  Statement timeout configured: ${poolHasStatementTimeout}`);
  console.log(`  Idle timeout configured: ${poolHasIdleTimeout}`);
  console.log(`  Connection timeout configured: ${poolHasConnectionTimeout}`);

  // 2. Query source database table count and row counts
  const sourcePool = new pg.Pool({
    host: PG_HOST,
    port: Number(PG_PORT),
    user: PG_USER,
    password: PG_PASSWORD,
    database: SOURCE_DB,
  });

  const tablesRes = await sourcePool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  const tables = tablesRes.rows.map((r: { table_name: string }) => r.table_name);
  console.log(`Source DB (${SOURCE_DB}) has ${tables.length} tables.`);

  const sourceCounts: Record<string, number> = {};
  for (const table of tables) {
    const countRes = await sourcePool.query(`SELECT COUNT(*)::int as count FROM "${table}"`);
    sourceCounts[table] = countRes.rows[0].count;
  }
  await sourcePool.end();

  // 3. Perform pg_dump
  const dumpFile = path.resolve(SCRATCH_DIR, "audit_backup.sql");
  console.log(`\nExecuting pg_dump from ${SOURCE_DB} to ${dumpFile}...`);
  const dumpStart = performance.now();
  execSync(
    `PGPASSWORD="${PG_PASSWORD}" pg_dump -h ${PG_HOST} -p ${PG_PORT} -U ${PG_USER} -d ${SOURCE_DB} -F p -f "${dumpFile}"`,
    { stdio: "pipe" }
  );
  const dumpDurationMs = Math.round(performance.now() - dumpStart);
  const dumpSizeBytes = fs.statSync(dumpFile).size;
  console.log(`pg_dump completed in ${dumpDurationMs} ms (${dumpSizeBytes} bytes)`);

  // 4. Create fresh restore target database
  const adminPool = new pg.Pool({
    host: PG_HOST,
    port: Number(PG_PORT),
    user: PG_USER,
    password: PG_PASSWORD,
    database: "postgres",
  });

  await adminPool.query(`DROP DATABASE IF EXISTS "${RESTORE_TARGET_DB}";`);
  await adminPool.query(`CREATE DATABASE "${RESTORE_TARGET_DB}";`);
  console.log(`Created target database ${RESTORE_TARGET_DB}.`);

  // 5. Perform RESTORE and time it
  console.log(`Executing restore into ${RESTORE_TARGET_DB}...`);
  const restoreStart = performance.now();
  execSync(
    `PGPASSWORD="${PG_PASSWORD}" psql -h ${PG_HOST} -p ${PG_PORT} -U ${PG_USER} -d ${RESTORE_TARGET_DB} -f "${dumpFile}"`,
    { stdio: "pipe" }
  );
  const restoreDurationMs = Math.round(performance.now() - restoreStart);
  console.log(`Restore completed in ${restoreDurationMs} ms.`);

  // 6. Verify restored data fidelity
  const targetPool = new pg.Pool({
    host: PG_HOST,
    port: Number(PG_PORT),
    user: PG_USER,
    password: PG_PASSWORD,
    database: RESTORE_TARGET_DB,
  });

  const restoredTablesRes = await targetPool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
  const restoredTables = restoredTablesRes.rows.map((r: { table_name: string }) => r.table_name);

  let discrepancies = 0;
  const comparison: Record<string, { source: number; restored: number }> = {};
  for (const table of tables) {
    const countRes = await targetPool.query(`SELECT COUNT(*)::int as count FROM "${table}"`);
    const targetCount = countRes.rows[0].count;
    comparison[table] = { source: sourceCounts[table], restored: targetCount };
    if (sourceCounts[table] !== targetCount) {
      discrepancies++;
      console.error(`Discrepancy in table ${table}: source=${sourceCounts[table]}, restored=${targetCount}`);
    }
  }

  console.log(`Data fidelity check: ${discrepancies === 0 ? "100% MATCH" : `${discrepancies} MISMATCHES`}`);

  // 7. Test running prisma migrate deploy against the populated restored database
  console.log("\nTesting prisma migrate deploy against populated realistic DB...");
  let migrateDeploySuccess = false;
  let migrateDeployOutput = "";
  try {
    const migrateRes = execSync("pnpm --filter @mill-ledger/server exec prisma migrate deploy", {
      env: {
        ...process.env,
        DATABASE_URL: `postgresql://${PG_USER}:${PG_PASSWORD}@${PG_HOST}:${PG_PORT}/${RESTORE_TARGET_DB}?schema=public`,
      },
      encoding: "utf-8",
    });
    migrateDeploySuccess = true;
    migrateDeployOutput = migrateRes.trim();
    console.log(`Prisma migrate deploy output:\n${migrateDeployOutput}`);
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    migrateDeploySuccess = false;
    migrateDeployOutput = (e.stdout || "") + "\n" + (e.stderr || "") + "\n" + (e.message || "");
    console.error("Prisma migrate deploy failed:", migrateDeployOutput);
  }

  // 8. Clean up throwaway database and dump file
  await targetPool.end();
  await adminPool.query(`DROP DATABASE IF EXISTS "${RESTORE_TARGET_DB}";`);
  await adminPool.end();
  if (fs.existsSync(dumpFile)) fs.unlinkSync(dumpFile);
  console.log(`Cleaned up temporary database ${RESTORE_TARGET_DB} and dump file.`);

  // 9. Save evidence
  const opsEvidence = {
    poolConfiguration: {
      clientFile: "server/src/db/client.ts",
      poolHasMax,
      defaultMaxInPg: 10,
      poolHasStatementTimeout,
      poolHasIdleTimeout,
      poolHasConnectionTimeout,
    },
    backupAndRestoreVerification: {
      sourceDatabase: SOURCE_DB,
      tableCount: tables.length,
      dumpDurationMs,
      dumpSizeBytes,
      restoreTargetDatabase: RESTORE_TARGET_DB,
      restoreDurationMs,
      dataFidelityDiscrepancies: discrepancies,
      tableComparison: comparison,
    },
    migrateDeployOnPopulatedDb: {
      success: migrateDeploySuccess,
      output: migrateDeployOutput,
    },
    ciMigrationReality: {
      ciWorkflowFile: ".github/workflows/ci.yml",
      runsAgainstFreshDbOnly: true,
      runsAgainstRealisticDataCopy: false,
    },
  };

  fs.writeFileSync(
    path.join(EVIDENCE_DIR, "database-ops-results.json"),
    JSON.stringify(opsEvidence, null, 2)
  );
  console.log("Saved evidence to audit/evidence/database-ops-results.json");
}

main().catch(console.error);
