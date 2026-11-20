/**
 * AUDIT-ONLY SCRIPT
 * Task: Introspect runtime middleware chain for Express 5 app and all mounted routers
 */
import { createApp } from "../../server/src/app.js";
import { salesRouter } from "../../server/src/modules/sales/sales.routes.js";
import { productionRouter } from "../../server/src/modules/production/production.routes.js";
import { inventoryRouter } from "../../server/src/modules/inventory/inventory.routes.js";
import { financeRouter } from "../../server/src/modules/finance/finance.routes.js";
import { paymentRouter } from "../../server/src/modules/finance/payment.routes.js";
import { reportingRouter } from "../../server/src/modules/reporting/reporting.routes.js";
import { authRouter } from "../../server/src/modules/auth/auth.routes.js";
import { healthRouter } from "../../server/src/modules/health/health.routes.js";

function getLayerInfo(layer: any): { name: string; path?: string; type: string } {
  const name = layer.name || "<anonymous>";
  const path = layer.path || layer.route?.path || (layer.regexp ? layer.regexp.toString() : "");
  const type = layer.route ? "route" : layer.handle?.name === "router" ? "router" : "middleware";
  return { name, path, type };
}

function introspectRouter(router: any, name: string) {
  console.log(`\n==================================================`);
  console.log(`ROUTER: ${name}`);
  console.log(`==================================================`);
  const stack = router.stack || [];
  if (stack.length === 0) {
    console.log(`  (Empty stack)`);
    return;
  }
  stack.forEach((layer: any, idx: number) => {
    const info = getLayerInfo(layer);
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).join(",").toUpperCase();
      const handlerStack = layer.route.stack.map((h: any) => h.name || "<anonymous>").join(" -> ");
      console.log(`  [${idx}] ROUTE ${methods} ${layer.route.path}: handlers = [ ${handlerStack} ]`);
    } else {
      console.log(`  [${idx}] MIDDLEWARE ${info.name} (handle: ${layer.handle?.name || "anonymous"}, regexp: ${layer.regexp})`);
    }
  });
}

function introspectApp() {
  const app = createApp();
  console.log(`==================================================`);
  console.log(`APP-LEVEL MIDDLEWARE STACK (Express 5 createApp)`);
  console.log(`==================================================`);
  const stack = (app as any).router?.stack || [];
  stack.forEach((layer: any, idx: number) => {
    const info = getLayerInfo(layer);
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).join(",").toUpperCase();
      console.log(`  [${idx}] ROUTE ${methods} ${layer.route.path}`);
    } else if (layer.handle?.name === "router") {
      console.log(`  [${idx}] SUBROUTER mounted at regexp: ${layer.regexp}`);
    } else {
      console.log(`  [${idx}] MIDDLEWARE: name="${info.name}"`);
    }
  });

  introspectRouter(salesRouter, "salesRouter");
  introspectRouter(productionRouter, "productionRouter");
  introspectRouter(inventoryRouter, "inventoryRouter");
  introspectRouter(financeRouter, "financeRouter");
  introspectRouter(paymentRouter, "paymentRouter");
  introspectRouter(reportingRouter, "reportingRouter");
  introspectRouter(authRouter, "authRouter");
  introspectRouter(healthRouter, "healthRouter");
}

introspectApp();
