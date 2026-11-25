import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../../..");

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(root, "./client/src"),
      "@mill-ledger/shared": path.resolve(root, "./shared/src"),
    },
  },
  test: {
    include: ["audit/scripts/verify/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
