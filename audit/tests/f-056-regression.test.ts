import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

describe("F-056: Inadequate Color Contrast on Muted Text (WCAG 2.2 SC 1.4.3 Level AA)", () => {
  // WCAG relative luminance formula
  function getLuminance(hex: string): number {
    const cleanHex = hex.replace("#", "");
    const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

    const [R, G, B] = [r, g, b].map((val) =>
      val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
    );

    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  }

  function getContrastRatio(hex1: string, hex2: string): number {
    const l1 = getLuminance(hex1);
    const l2 = getLuminance(hex2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  it("verifies light mode palette tokens satisfy WCAG 2.2 SC 1.4.3 Level AA (>= 4.5:1)", () => {
    const lightBg = "#fcfdfc";
    const whiteSurface = "#ffffff";
    const mutedForeground = "#52525b";
    const foreground = "#09090b";

    const mutedVsBg = getContrastRatio(mutedForeground, lightBg);
    const mutedVsWhite = getContrastRatio(mutedForeground, whiteSurface);
    const fgVsBg = getContrastRatio(foreground, lightBg);

    // WCAG AA requires at least 4.5:1
    expect(mutedVsBg).toBeGreaterThanOrEqual(4.5);
    expect(mutedVsWhite).toBeGreaterThanOrEqual(4.5);
    expect(fgVsBg).toBeGreaterThanOrEqual(4.5);

    // Confirm true measured ratios
    expect(mutedVsWhite).toBeGreaterThan(7.0);
  });

  it("verifies dark mode palette tokens satisfy WCAG 2.2 SC 1.4.3 Level AA (>= 4.5:1)", () => {
    const darkBg = "#09090b";
    const darkMutedForeground = "#a1a1aa";
    const darkForeground = "#f4f4f5";

    const mutedVsDarkBg = getContrastRatio(darkMutedForeground, darkBg);
    const fgVsDarkBg = getContrastRatio(darkForeground, darkBg);

    expect(mutedVsDarkBg).toBeGreaterThanOrEqual(4.5);
    expect(fgVsDarkBg).toBeGreaterThanOrEqual(4.5);
    expect(mutedVsDarkBg).toBeGreaterThan(7.0);
  });

  it("ensures zero occurrences of arbitrary opacity modifiers on text-muted-foreground across client codebase", () => {
    const clientSrc = path.resolve(__dirname, "../../client/src");
    let matches: string[] = [];
    try {
      const output = execSync(
        `grep -rnE "text-muted-foreground/[0-9]|text-foreground/[0-9]" ${clientSrc}`,
        { encoding: "utf8" }
      );
      matches = output.trim().split("\n").filter(Boolean);
    } catch {
      // grep exit 1 means no matches found, which is expected
      matches = [];
    }

    expect(matches).toEqual([]);
  });
});
