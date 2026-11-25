/**
 * AUDIT-ONLY SCRIPT
 * Inspect Express 5 router layer path matching
 */
import { createApp } from "../../server/src/app.js";

const app = createApp();
const router = (app as any).router;

for (let i = 0; i < router.stack.length; i++) {
  const layer = router.stack[i];
  if (layer.handle?.stack) {
    // Test some known paths against layer.matchers[0]
    const testPaths = [
      "/api/v1",
      "/api/v1/health",
      "/api/v1/sales",
      "/api/v1/orders",
      "/api/v1/dispatches",
      "/api/v1/production",
      "/api/v1/production-runs",
      "/api/v1/inventory",
      "/api/v1/purchase-receipts",
      "/api/v1/finance",
      "/api/v1/invoices",
      "/api/v1/payments",
      "/api/v1/reports",
      "/api/v1/dashboard",
      "/api/health",
      "/api/auth",
      "/unknown"
    ];
    const matched = testPaths.filter(p => {
      try {
        return !!layer.matchers[0](p);
      } catch {
        return false;
      }
    });
    console.log(`Layer ${i} (${layer.handle.stack.length} routes): matched ->`, matched);
  }
}
