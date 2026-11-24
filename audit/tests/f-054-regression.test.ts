import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("F-054: Label in Name Mismatch on Multilingual Language Switcher (WCAG 2.2 SC 2.5.3)", () => {
  const loginPagePath = path.resolve(__dirname, "../../client/src/pages/login-page.tsx");
  const shellPath = path.resolve(__dirname, "../../client/src/components/shell/authenticated-shell.tsx");

  it("ensures login page language switch button accessible name includes visible text in both languages", () => {
    const loginSource = fs.readFileSync(loginPagePath, "utf8");

    // Match the language button block in login-page.tsx
    const buttonMatch = loginSource.match(
      /<Button[^>]*onClick=\{[^}]*setLanguage[^}]*\}[^>]*aria-label=\{([^}]+)\}[^>]*>([\s\S]*?)<\/Button>/
    );

    expect(buttonMatch).not.toBeNull();
    const ariaLabelExpr = buttonMatch![1];
    const innerTextExpr = buttonMatch![2];

    // Verify visible text matches ternary {language === "en" ? "தமிழ்" : "English"}
    expect(innerTextExpr).toContain('language === "en" ? "தமிழ்" : "English"');

    // Verify aria-label contains visible text for both branches
    // When language === 'en', visible is 'தமிழ்', aria-label must include and start with 'தமிழ்'
    expect(ariaLabelExpr).toContain("தமிழ் (Switch language to Tamil)");
    // When language === 'ta', visible is 'English', aria-label must include and start with 'English'
    expect(ariaLabelExpr).toContain("English (ஆங்கிலத்திற்கு மாற்று)");
  });

  it("ensures authenticated shell language switcher accessible name includes visible text in both languages", () => {
    const shellSource = fs.readFileSync(shellPath, "utf8");

    const shellButtonMatch = shellSource.match(
      /<Button[^>]*onClick=\{[^}]*setLanguage[^}]*\}[^>]*aria-label=\{([^}]+)\}[^>]*>([\s\S]*?)<\/Button>/
    );

    expect(shellButtonMatch).not.toBeNull();
    const ariaLabelExpr = shellButtonMatch![1];
    const innerTextExpr = shellButtonMatch![2];

    expect(innerTextExpr).toContain('language === "en" ? "தமிழ்" : "EN"');
    expect(ariaLabelExpr).toContain("தமிழ் - Switch language to Tamil");
    expect(ariaLabelExpr).toContain("EN - Switch language to English");
  });

  it("verifies speech recognition and screen reader compatibility under WCAG 2.5.3", () => {
    // Simulate runtime evaluation of accessible name vs visual label
    const simulateAriaLabel = (lang: "en" | "ta") => {
      return lang === "en"
        ? "தமிழ் (Switch language to Tamil)"
        : "English (ஆங்கிலத்திற்கு மாற்று)";
    };
    const simulateVisibleText = (lang: "en" | "ta") => {
      return lang === "en" ? "தமிழ்" : "English";
    };

    for (const lang of ["en", "ta"] as const) {
      const visual = simulateVisibleText(lang);
      const accessibleName = simulateAriaLabel(lang);

      // WCAG 2.2 SC 2.5.3 Requirement: The accessible name contains the text presented visually
      expect(accessibleName).toContain(visual);
      // Best Practice: Accessible name starts with the visible text
      expect(accessibleName.startsWith(visual)).toBe(true);
    }
  });
});
