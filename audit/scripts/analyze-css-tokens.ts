/**
 * AUDIT SCRIPT: Analyze CSS Tokens and Slop Detection
 * Counts distinct colors, font sizes, spacing values, radii, shadows, and animations
 * Standards: Check 7 (Visual Quality & Design Tokens)
 */

import fs from "node:fs";
import path from "node:path";

function findCssFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findCssFiles(full));
    } else if (entry.name.endsWith(".css")) {
      files.push(full);
    }
  }
  return files;
}

const rootDir = fs.existsSync("client") ? process.cwd() : path.resolve(process.cwd(), "..");
const cssFiles = findCssFiles(path.join(rootDir, "client/dist/assets"));
if (!cssFiles.length) {
  console.error("No CSS files found in client/dist/assets. Please build client first.");
  process.exit(1);
}

const cssContent = cssFiles.map((f) => fs.readFileSync(f, "utf8")).join("\n");

// 1. Extract colors (hex, rgb, rgba, hsl, oklch)
const hexMatches = cssContent.match(/#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g) || [];
const rgbMatches = cssContent.match(/rgba?\([^)]+\)/g) || [];
const hslMatches = cssContent.match(/hsla?\([^)]+\)/g) || [];
const oklchMatches = cssContent.match(/oklch\([^)]+\)/g) || [];

const distinctColors = new Set([
  ...hexMatches.map((c) => c.toLowerCase()),
  ...rgbMatches.map((c) => c.replace(/\s+/g, "")),
  ...hslMatches.map((c) => c.replace(/\s+/g, "")),
  ...oklchMatches.map((c) => c.replace(/\s+/g, "")),
]);

// 2. Extract font sizes
const fontSizeMatches = cssContent.match(/font-size:\s*([^;!}]+)/g) || [];
const distinctFontSizes = new Set(
  fontSizeMatches.map((m) => m.replace(/font-size:\s*/, "").trim())
);

// 3. Extract spacing values (padding, margin, gap)
const spacingMatches = cssContent.match(/(?:padding|margin|gap)(?:-[a-z]+)?:\s*([^;!}]+)/g) || [];
const distinctSpacingValues = new Set(
  spacingMatches.map((m) => m.replace(/^[a-z-]+:\s*/, "").trim())
);

// 4. Extract font families
const fontFamilyMatches = cssContent.match(/font-family:\s*([^;!}]+)/g) || [];
const distinctFontFamilies = new Set(
  fontFamilyMatches.map((m) => m.replace(/font-family:\s*/, "").trim())
);

// 5. Extract border radii
const radiusMatches = cssContent.match(/border-radius:\s*([^;!}]+)/g) || [];
const distinctRadii = new Set(
  radiusMatches.map((m) => m.replace(/border-radius:\s*/, "").trim())
);

// 6. Extract box shadows
const shadowMatches = cssContent.match(/box-shadow:\s*([^;!}]+)/g) || [];
const distinctShadows = new Set(
  shadowMatches.map((m) => m.replace(/box-shadow:\s*/, "").trim())
);

// 7. Extract gradients
const gradientMatches = cssContent.match(/linear-gradient\([^)]+\)/g) || [];
const distinctGradients = new Set(gradientMatches);

// 8. Extract animations
const animationMatches = cssContent.match(/animation(?:-name)?:\s*([^;!}]+)/g) || [];
const distinctAnimations = new Set(
  animationMatches.map((m) => m.replace(/animation(?:-name)?:\s*/, "").trim())
);

const report = {
  cssFileSize: cssContent.length,
  totalColorOccurrences: hexMatches.length + rgbMatches.length + hslMatches.length + oklchMatches.length,
  distinctColorCount: distinctColors.size,
  distinctColors: Array.from(distinctColors).sort(),
  distinctFontSizeCount: distinctFontSizes.size,
  distinctFontSizes: Array.from(distinctFontSizes).sort(),
  distinctSpacingCount: distinctSpacingValues.size,
  distinctSpacingValues: Array.from(distinctSpacingValues).sort(),
  distinctFontFamiliesCount: distinctFontFamilies.size,
  distinctFontFamilies: Array.from(distinctFontFamilies).sort(),
  distinctRadiusCount: distinctRadii.size,
  distinctRadii: Array.from(distinctRadii).sort(),
  distinctShadowCount: distinctShadows.size,
  distinctShadows: Array.from(distinctShadows).sort(),
  distinctGradientCount: distinctGradients.size,
  distinctGradients: Array.from(distinctGradients).sort(),
  distinctAnimationCount: distinctAnimations.size,
  distinctAnimations: Array.from(distinctAnimations).sort(),
};

fs.writeFileSync(path.join(rootDir, "audit/evidence/css-tokens-analysis.json"), JSON.stringify(report, null, 2));
console.log("CSS Tokens Analysis completed:");
console.log(`- Distinct Colors: ${report.distinctColorCount}`);
console.log(`- Distinct Font Sizes: ${report.distinctFontSizeCount}`);
console.log(`- Distinct Spacing Values: ${report.distinctSpacingCount}`);
console.log(`- Distinct Font Families: ${report.distinctFontFamiliesCount}`);
console.log(`- Distinct Radii: ${report.distinctRadiusCount}`);
console.log(`- Distinct Shadows: ${report.distinctShadowCount}`);
console.log(`- Gradients: ${report.distinctGradientCount}`);
console.log(`- Animations: ${report.distinctAnimationCount}`);
