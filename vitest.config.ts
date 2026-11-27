import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
      "@mill-ledger/shared/contracts": path.resolve(
        __dirname,
        "./shared/src/contracts/index.ts",
      ),
      "@mill-ledger/shared/schemas": path.resolve(
        __dirname,
        "./shared/src/schemas/index.ts",
      ),
      "@mill-ledger/shared/types": path.resolve(
        __dirname,
        "./shared/src/types/index.ts",
      ),
      "@mill-ledger/shared/formatters": path.resolve(
        __dirname,
        "./shared/src/formatters.ts",
      ),
      "@mill-ledger/shared": path.resolve(__dirname, "./shared/src/index.ts"),
    },
  },
  test: {
    env: {
      VITE_BACKEND_URL: "http://localhost:4000",
    },
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**", "**/audit/**"],
    fileParallelism: false,
  },
});
