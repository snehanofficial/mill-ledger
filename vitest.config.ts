import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
    },
  },
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**", "**/audit/**"],
    fileParallelism: false,
  },
});
