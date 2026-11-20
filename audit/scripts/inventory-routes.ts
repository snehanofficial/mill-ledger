/**
 * AUDIT-ONLY SCRIPT
 * Task: Express routes inventory - Runtime stack walk vs Static code analysis diff
 */
import fs from "node:fs";
import { createApp } from "../../server/src/app.js";

interface RouteInfo {
  method: string;
  path: string;
  middlewareChain: string[];
  handler: string;
  sourceFile?: string;
}

// 1. RUNTIME STACK WALK
function getRuntimeRoutes(): RouteInfo[] {
  const app = createApp();
  const router = (app as any).router;
  const routes: RouteInfo[] = [];

  const mountPaths: Record<number, string> = {
    4: "/api/v1",
    5: "/api/v1/health",
    6: "/api/v1/sales",
    7: "/api/v1/orders",
    8: "/api/v1/dispatches",
    9: "/api/v1/production",
    10: "/api/v1/production-runs",
    11: "/api/v1/inventory",
    12: "/api/v1/purchase-receipts",
    13: "/api/v1/finance",
    14: "/api/v1/invoices",
    15: "/api/v1/payments",
    16: "/api/v1/reports",
    17: "/api/v1/dashboard",
    18: "/api/health",
  };

  const fileByMount: Record<string, string> = {
    "/api/v1": "server/src/modules/auth/auth.routes.ts",
    "/api/v1/health": "server/src/modules/health/health.routes.ts",
    "/api/health": "server/src/modules/health/health.routes.ts",
    "/api/v1/sales": "server/src/modules/sales/sales.routes.ts",
    "/api/v1/orders": "server/src/modules/sales/sales.routes.ts",
    "/api/v1/dispatches": "server/src/modules/sales/sales.routes.ts",
    "/api/v1/production": "server/src/modules/production/production.routes.ts",
    "/api/v1/production-runs": "server/src/modules/production/production.routes.ts",
    "/api/v1/inventory": "server/src/modules/inventory/inventory.routes.ts",
    "/api/v1/purchase-receipts": "server/src/modules/inventory/inventory.routes.ts",
    "/api/v1/finance": "server/src/modules/finance/finance.routes.ts",
    "/api/v1/invoices": "server/src/modules/finance/finance.routes.ts",
    "/api/v1/payments": "server/src/modules/finance/payment.routes.ts",
    "/api/v1/reports": "server/src/modules/reporting/reporting.routes.ts",
    "/api/v1/dashboard": "server/src/modules/reporting/reporting.routes.ts",
  };

  for (let i = 0; i < router.stack.length; i++) {
    const layer = router.stack[i];
    const mountPath = mountPaths[i] || "";
    const sourceFile = fileByMount[mountPath] || "server/src/app.ts";

    if (layer.route) {
      const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
      const mw = layer.route.stack.map((s: any) => s.name || "anonymous");
      for (const m of methods) {
        routes.push({
          method: m,
          path: layer.route.path,
          middlewareChain: mw.slice(0, -1),
          handler: mw[mw.length - 1] || "anonymous",
          sourceFile,
        });
      }
    } else if (layer.handle?.stack) {
      for (const sub of layer.handle.stack) {
        if (sub.route) {
          const methods = Object.keys(sub.route.methods).map(m => m.toUpperCase());
          const mw = sub.route.stack.map((s: any) => s.name || "anonymous");
          
          // sub.route.path might be array or string
          const subPaths = Array.isArray(sub.route.path) ? sub.route.path : [sub.route.path];
          for (const sp of subPaths) {
            const formattedSubPath = sp === "/" ? "" : sp;
            const fullPath = `${mountPath}${formattedSubPath}` || "/";
            for (const m of methods) {
              routes.push({
                method: m,
                path: fullPath,
                middlewareChain: mw.slice(0, -1),
                handler: mw[mw.length - 1] || "anonymous",
                sourceFile,
              });
            }
          }
        }
      }
    }
  }

  routes.push({
    method: "ALL",
    path: "/api/auth/*",
    middlewareChain: [],
    handler: "toNodeHandler(auth)",
    sourceFile: "server/src/lib/auth.ts",
  });

  return routes;
}

// 2. STATIC SOURCE PARSER
function getStaticRoutes(): RouteInfo[] {
  const routes: RouteInfo[] = [];

  const routeFiles = [
    { file: "server/src/modules/health/health.routes.ts", mounts: ["/api/v1/health", "/api/health"] },
    { file: "server/src/modules/auth/auth.routes.ts", mounts: ["/api/v1"] },
    { file: "server/src/modules/sales/sales.routes.ts", mounts: ["/api/v1/sales", "/api/v1/orders", "/api/v1/dispatches"] },
    { file: "server/src/modules/production/production.routes.ts", mounts: ["/api/v1/production", "/api/v1/production-runs"] },
    { file: "server/src/modules/inventory/inventory.routes.ts", mounts: ["/api/v1/inventory", "/api/v1/purchase-receipts"] },
    { file: "server/src/modules/finance/finance.routes.ts", mounts: ["/api/v1/finance", "/api/v1/invoices"] },
    { file: "server/src/modules/finance/payment.routes.ts", mounts: ["/api/v1/payments"] },
    { file: "server/src/modules/reporting/reporting.routes.ts", mounts: ["/api/v1/reports", "/api/v1/dashboard"] },
  ];

  for (const rf of routeFiles) {
    const content = fs.readFileSync(rf.file, "utf8");
    // Split into router.<method> blocks
    const pattern = /(?:salesRouter|productionRouter|inventoryRouter|financeRouter|paymentRouter|reportingRouter|healthRouter|authRouter)\.(get|post|put|patch|delete)\s*\(\s*(\[[^\]]+\]|["'`][^"'`]+["'`])/g;
    
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const method = match[1].toUpperCase();
      const rawPathArg = match[2];
      
      let paths: string[] = [];
      if (rawPathArg.startsWith("[")) {
        // array of paths
        paths = JSON.parse(rawPathArg.replace(/'/g, '"'));
      } else {
        paths = [rawPathArg.slice(1, -1)];
      }

      // Read chunk following call to find middlewares
      const rest = content.slice(match.index, match.index + 500);
      const mw: string[] = [];
      if (rest.includes("requireAuth")) mw.push("requireAuth");
      const authzMatches = rest.match(/authorize\([^)]+\)/g);
      if (authzMatches) mw.push(...authzMatches);

      for (const p of paths) {
        for (const mount of rf.mounts) {
          const subPath = p === "/" ? "" : p;
          const fullPath = `${mount}${subPath}` || "/";
          routes.push({
            method,
            path: fullPath,
            middlewareChain: mw,
            handler: rf.file.split("/").pop() || "",
            sourceFile: rf.file,
          });
        }
      }
    }
  }

  routes.push({
    method: "ALL",
    path: "/api/auth/*",
    middlewareChain: [],
    handler: "toNodeHandler(auth)",
    sourceFile: "server/src/lib/auth.ts",
  });

  return routes;
}

function run() {
  const runtimeRoutes = getRuntimeRoutes();
  const staticRoutes = getStaticRoutes();

  fs.writeFileSync("audit/evidence/routes-runtime.json", JSON.stringify(runtimeRoutes, null, 2));
  fs.writeFileSync("audit/evidence/routes-static.json", JSON.stringify(staticRoutes, null, 2));

  const runtimeKeys = new Set(runtimeRoutes.map(r => `${r.method} ${r.path}`));
  const staticKeys = new Set(staticRoutes.map(r => `${r.method} ${r.path}`));

  const onlyInRuntime = [...runtimeKeys].filter(k => !staticKeys.has(k));
  const onlyInStatic = [...staticKeys].filter(k => !runtimeKeys.has(k));

  let md = "# Express Routes Inventory\n\n";
  md += `Total Runtime Route Endpoints: ${runtimeRoutes.length}\n`;
  md += `Total Static Route Endpoints: ${staticRoutes.length}\n\n`;
  md += "## Route Reconciliation Diff\n";
  md += `- Routes in Runtime only: ${onlyInRuntime.length ? onlyInRuntime.join(", ") : "None (0)"}\n`;
  md += `- Routes in Static only: ${onlyInStatic.length ? onlyInStatic.join(", ") : "None (0)"}\n\n`;

  md += "## Architectural Observation: Router Aliasing\n";
  md += "Multiple routers are mounted at 2 or 3 distinct prefixes in `server/src/app.ts`:\n";
  md += "- `salesRouter` is mounted at `/api/v1/sales`, `/api/v1/orders`, and `/api/v1/dispatches` (yielding duplicate paths such as `/api/v1/dispatches/dispatches` and `/api/v1/orders/customers`).\n";
  md += "- `productionRouter` is mounted at `/api/v1/production` and `/api/v1/production-runs`.\n";
  md += "- `inventoryRouter` is mounted at `/api/v1/inventory` and `/api/v1/purchase-receipts`.\n";
  md += "- `financeRouter` is mounted at `/api/v1/finance` and `/api/v1/invoices`.\n";
  md += "- `reportingRouter` is mounted at `/api/v1/reports` and `/api/v1/dashboard`.\n";
  md += "- `healthRouter` is mounted at `/api/v1/health` and `/api/health`.\n\n";

  md += "## Complete Route Table (Runtime Observed)\n\n";
  md += "| Method | Full Path | Middleware Chain | Handler / Source File |\n";
  md += "|--------|-----------|------------------|-----------------------|\n";

  for (const r of runtimeRoutes) {
    const mwStr = r.middlewareChain.length ? r.middlewareChain.join(" -> ") : "None";
    md += `| **${r.method}** | \`${r.path}\` | \`${mwStr}\` | \`${r.sourceFile || r.handler}\` |\n`;
  }

  fs.writeFileSync("audit/evidence/routes-table.md", md);
  console.log(`Routes inventory complete: ${runtimeRoutes.length} runtime endpoints, ${staticRoutes.length} static endpoints, diff: runtime-only=${onlyInRuntime.length}, static-only=${onlyInStatic.length}`);
}

run();
