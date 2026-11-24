import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("F-050 Regression Test: Dark Mode Infrastructure and Design Tokens", () => {
  const repoRoot = path.resolve(__dirname, "../..");

  it("client/src/index.css defines Tailwind 4 dark variant and .dark token block", () => {
    const cssSource = fs.readFileSync(
      path.join(repoRoot, "client/src/index.css"),
      "utf8",
    );

    expect(cssSource).toContain("@variant dark (&:where(.dark, .dark *));");
    expect(cssSource).toContain(".dark {");
    expect(cssSource).toContain("color-scheme: dark;");
    expect(cssSource).toContain("--background: #09090b;");
    expect(cssSource).toContain("--foreground: #f4f4f5;");
    expect(cssSource).toContain("--card: #121215;");
    expect(cssSource).toContain("--border: #27272a;");
  });

  it("client/src/hooks/use-theme.ts provides robust theme management", () => {
    const hookSource = fs.readFileSync(
      path.join(repoRoot, "client/src/hooks/use-theme.ts"),
      "utf8",
    );

    expect(hookSource).toContain("export function useTheme()");
    expect(hookSource).toContain("localStorage.getItem(STORAGE_KEY)");
    expect(hookSource).toContain("root.classList.add(\"dark\")");
    expect(hookSource).toContain("root.classList.remove(\"dark\")");
    expect(hookSource).toContain("prefers-color-scheme: dark");
    expect(hookSource).toContain("toggleTheme");
  });

  it("authenticated-shell.tsx integrates theme toggle in header and dropdown menus", () => {
    const shellSource = fs.readFileSync(
      path.join(repoRoot, "client/src/components/shell/authenticated-shell.tsx"),
      "utf8",
    );

    expect(shellSource).toContain("useTheme");
    expect(shellSource).toContain("SunIcon");
    expect(shellSource).toContain("MoonIcon");
    expect(shellSource).toContain("Switch to light mode");
    expect(shellSource).toContain("Switch to dark mode");
    expect(shellSource).toContain("Light mode");
    expect(shellSource).toContain("Dark mode");
  });
});
