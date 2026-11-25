import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("F-002 Regression: README Quick Start Path and Port Accuracy", () => {
  const rootDir = path.resolve(__dirname, "../..");

  it("ensures .env.example exists at workspace root and in server directory", () => {
    const rootEnvExample = path.join(rootDir, ".env.example");
    const serverEnvExample = path.join(rootDir, "server/.env.example");

    expect(fs.existsSync(rootEnvExample)).toBe(true);
    expect(fs.existsSync(serverEnvExample)).toBe(true);
  });

  it("ensures README.md specifies correct environment template copy instruction", () => {
    const readmePath = path.join(rootDir, "README.md");
    const readmeContent = fs.readFileSync(readmePath, "utf-8");

    expect(readmeContent).toContain("cp .env.example server/.env");
  });

  it("ensures README.md specifies backend port 4000 matching server config and vite proxy", () => {
    const readmePath = path.join(rootDir, "README.md");
    const readmeContent = fs.readFileSync(readmePath, "utf-8");

    expect(readmeContent).toContain("http://localhost:4000");
    expect(readmeContent).not.toContain("backend API runs at `http://localhost:3000`");

    // Verify consistency with server default port
    const envConfigPath = path.join(rootDir, "server/src/config/env.ts");
    const envConfig = fs.readFileSync(envConfigPath, "utf-8");
    expect(envConfig).toContain("default(4000)");

    // Verify consistency with client vite proxy
    const viteConfigPath = path.join(rootDir, "client/vite.config.ts");
    const viteConfig = fs.readFileSync(viteConfigPath, "utf-8");
    expect(viteConfig).toContain("http://localhost:4000");
  });
});
