import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "../tests",
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm --filter server dev",
      url: "http://127.0.0.1:4000/api/v1/health",
      reuseExistingServer: true,
      timeout: 30000,
    },
    {
      command: "pnpm --filter client exec vite --host 127.0.0.1 --port 4173",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: true,
      timeout: 30000,
    },
  ],
});
