/**
 * AUDIT-ONLY SCRIPT
 * Inspect layer properties in Express 5
 */
import { createApp } from "../../server/src/app.js";

const app = createApp();
const router = (app as any).router;

for (let i = 0; i < router.stack.length; i++) {
  const layer = router.stack[i];
  console.log(`Layer ${i}: name=${layer.name}`);
  for (const k of Object.keys(layer)) {
    if (k !== "handle") {
      console.log(`  ${k}:`, (layer as any)[k]);
    }
  }
}
