import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("F-062: Continuous Pulsing Badges and Skeletons Pause/Stop/Hide Mechanism (WCAG 2.2 SC 2.2.2 & Apple HIG)", () => {
  const motionHookPath = path.resolve(__dirname, "../../client/src/hooks/use-motion.ts");
  const indexCssPath = path.resolve(__dirname, "../../client/src/index.css");
  const shellPath = path.resolve(__dirname, "../../client/src/components/shell/authenticated-shell.tsx");
  const ordersPagePath = path.resolve(__dirname, "../../client/src/pages/orders-page.tsx");
  const outboxSheetPath = path.resolve(__dirname, "../../client/src/components/shell/device-outbox-sheet.tsx");
  const skeletonPath = path.resolve(__dirname, "../../client/src/components/ui/skeleton.tsx");
  const settingsPagePath = path.resolve(__dirname, "../../client/src/pages/settings-page.tsx");

  it("ensures useMotion hook manages pause state, document attributes, and storage persistence", () => {
    expect(fs.existsSync(motionHookPath)).toBe(true);
    const source = fs.readFileSync(motionHookPath, "utf8");

    expect(source).toContain("mill-ledger-motion-preference");
    expect(source).toContain("prefers-reduced-motion: reduce");
    expect(source).toContain('root.classList.add("motion-paused")');
    expect(source).toContain('root.setAttribute("data-reduce-motion", "true")');
    expect(source).toContain('root.classList.remove("motion-paused")');
    expect(source).toContain('root.removeAttribute("data-reduce-motion")');
    expect(source).toContain("export function useMotion");
  });

  it("ensures CSS styles suppress animations on motion-paused / data-reduce-motion and provide finite pulse", () => {
    const css = fs.readFileSync(indexCssPath, "utf8");

    // Check motion pause selector and properties
    expect(css).toMatch(/html\[data-reduce-motion="true"\]/);
    expect(css).toMatch(/html\.motion-paused/);
    expect(css).toContain("animation-duration: 0.01ms !important");
    expect(css).toContain("animation-iteration-count: 1 !important");
    expect(css).toContain("animation: none !important");

    // Check finite pulse utility (max <= 5 seconds per SC 2.2.2)
    expect(css).toMatch(/\.animate-pulse-finite\s*\{[^}]*animation:\s*pulse 2s[^}]*2 forwards/);
  });

  it("ensures global pause control button with data-pause-motion is present in header", () => {
    const shell = fs.readFileSync(shellPath, "utf8");

    // Must match selector from phase-09-motion-audit.spec.ts: [data-pause-motion] or button[aria-label*="pause" i]
    expect(shell).toContain("data-pause-motion");
    expect(shell).toMatch(/aria-label=\{[\s\S]*?Pause animations[\s\S]*?\}/);
    expect(shell).toMatch(/useMotion\(\)/);
    expect(shell).toMatch(/PauseIcon/);
    expect(shell).toMatch(/PlayIcon/);
  });

  it("ensures syncing badges use finite pulse rather than indefinite continuous pulsing", () => {
    const orders = fs.readFileSync(ordersPagePath, "utf8");
    const outbox = fs.readFileSync(outboxSheetPath, "utf8");

    expect(orders).toMatch(/ord\.status === "syncing"[\s\S]*?animate-pulse-finite/);
    expect(orders).not.toMatch(/ord\.status === "syncing"[\s\S]*?className="[^"]*(^|\s)animate-pulse(\s|")/);

    expect(outbox).toMatch(/ord\.status === "syncing"[\s\S]*?animate-pulse-finite/);
    expect(outbox).not.toMatch(/ord\.status === "syncing"[\s\S]*?className="[^"]*(^|\s)animate-pulse(\s|")/);
  });

  it("ensures skeletons respect reduced motion via motion-reduce:animate-none", () => {
    const skeleton = fs.readFileSync(skeletonPath, "utf8");

    expect(skeleton).toContain("motion-reduce:animate-none");
  });

  it("ensures Settings page provides user preference toggle for interface motion & accessibility", () => {
    const settings = fs.readFileSync(settingsPagePath, "utf8");

    expect(settings).toContain("data-pause-motion");
    expect(settings).toContain("Interface Motion & Accessibility");
    expect(settings).toContain("WCAG 2.2 Success Criterion 2.2.2");
  });
});
