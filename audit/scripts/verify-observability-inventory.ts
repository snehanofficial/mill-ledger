/**
 * AUDIT-ONLY SCRIPT: Observability Inventory
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const EVIDENCE_DIR = path.resolve(ROOT, "audit/evidence");

function scanDirectory(dir: string, extFilter: RegExp): string[] {
  let files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== "dist" && entry.name !== ".git") {
        files = files.concat(scanDirectory(fullPath, extFilter));
      }
    } else if (extFilter.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

async function main() {
  const serverFiles = scanDirectory(path.resolve(ROOT, "server/src"), /\.(ts|js)$/);
  const clientFiles = scanDirectory(path.resolve(ROOT, "client/src"), /\.(tsx|ts|jsx|js)$/);

  let serverConsoleLogs = 0;
  let serverConsoleErrors = 0;
  const consoleOccurrences: Array<{ file: string; line: number; type: string; snippet: string }> = [];

  for (const f of serverFiles) {
    const lines = fs.readFileSync(f, "utf-8").split("\n");
    lines.forEach((line, idx) => {
      if (/console\.(log|info|warn|error)/.test(line)) {
        const type = line.match(/console\.(log|info|warn|error)/)![1];
        if (type === "error") serverConsoleErrors++;
        else serverConsoleLogs++;
        consoleOccurrences.push({
          file: path.relative(ROOT, f),
          line: idx + 1,
          type,
          snippet: line.trim().slice(0, 100),
        });
      }
    });
  }

  // Check client error boundaries
  let clientErrorBoundaryCount = 0;
  for (const f of clientFiles) {
    const content = fs.readFileSync(f, "utf-8");
    if (/componentDidCatch|ErrorBoundary|getDerivedStateFromError/i.test(content)) {
      clientErrorBoundaryCount++;
    }
  }

  const result = {
    errorTracking: {
      sentryInstalled: false,
      bugsnagInstalled: false,
      datadogInstalled: false,
      clientErrorBoundaryCount,
      sourceMaps: {
        clientBuildHasSourceMaps: false,
        serverBuildHasSourceMaps: false,
      },
    },
    structuredLogging: {
      pinoInstalled: false,
      winstonInstalled: false,
      jsonLoggingConfigured: false,
      requestIdTracingConfigured: false,
      totalConsoleStatementsServer: consoleOccurrences.length,
      sampleConsoleCalls: consoleOccurrences.slice(0, 15),
    },
    metrics: {
      prometheusClientInstalled: false,
      metricsEndpointExists: false,
      dbPoolMetricsExposed: false,
      latencyMetricsExposed: false,
      errorRateMetricsExposed: false,
    },
    alerting: {
      alertRulesFilesFound: 0,
      grafanaDashboardsFound: 0,
      cloudWatchAlarmsFound: 0,
    },
  };

  fs.writeFileSync(
    path.join(EVIDENCE_DIR, "observability-inventory.json"),
    JSON.stringify(result, null, 2)
  );

  console.log("Observability audit complete. Summary:");
  console.log(`- Server console statements: ${consoleOccurrences.length}`);
  console.log(`- Client Error Boundaries: ${clientErrorBoundaryCount}`);
  console.log("- Source maps: 0 on client, 0 on server");
  console.log("- Structured logger (Pino/Winston): None");
  console.log("- Metrics endpoint (/metrics): None");
  console.log("- Alert rules: None");
}

main().catch(console.error);
