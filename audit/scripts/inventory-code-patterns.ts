/**
 * AUDIT-ONLY SCRIPT
 * Task: Count occurrences of TODO|FIXME|HACK|XXX|@ts-ignore|eslint-disable|console.log|any
 */
import fs from "node:fs";
import path from "node:path";

const patterns = [
  { name: "TODO", regex: /\bTODO\b/g },
  { name: "FIXME", regex: /\bFIXME\b/g },
  { name: "HACK", regex: /\bHACK\b/g },
  { name: "XXX", regex: /\bXXX\b/g },
  { name: "@ts-ignore", regex: /@ts-ignore/g },
  { name: "eslint-disable", regex: /eslint-disable/g },
  { name: "console.log", regex: /console\.log\s*\(/g },
  { name: "any (TypeScript type)", regex: /:\s*any\b|<any>|\bas\s+any\b/g },
];

interface Occurrence {
  pattern: string;
  file: string;
  line: number;
  snippet: string;
}

const targetDirs = ["client/src", "server/src", "shared/src", "server/prisma"];

function walkDir(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDir(full));
    } else if (/\.(ts|tsx|js|jsx|prisma)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const occurrences: Occurrence[] = [];
const counts: Record<string, number> = Object.fromEntries(patterns.map(p => [p.name, 0]));

const allFiles = targetDirs.flatMap(walkDir);

for (const file of allFiles) {
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split("\n");

  lines.forEach((lineText, idx) => {
    for (const p of patterns) {
      p.regex.lastIndex = 0;
      if (p.regex.test(lineText)) {
        counts[p.name]++;
        occurrences.push({
          pattern: p.name,
          file,
          line: idx + 1,
          snippet: lineText.trim().slice(0, 100),
        });
      }
    }
  });
}

fs.writeFileSync("audit/evidence/code-patterns-inventory.json", JSON.stringify({ counts, occurrences }, null, 2));

let md = "# Code Patterns Inventory\n\n";
md += "| Pattern | Total Occurrences | Files Count |\n";
md += "|---------|-------------------|-------------|\n";

for (const [pat, count] of Object.entries(counts)) {
  const filesWithPat = new Set(occurrences.filter(o => o.pattern === pat).map(o => o.file)).size;
  md += `| \`${pat}\` | **${count}** | ${filesWithPat} |\n`;
}

md += "\n## Detailed Occurrences List\n\n";
md += "| Pattern | File:Line | Snippet |\n";
md += "|---------|-----------|---------|\n";

for (const o of occurrences) {
  md += `| \`${o.pattern}\` | \`${o.file}:${o.line}\` | \`${o.snippet.replace(/`/g, "'")}\` |\n`;
}

fs.writeFileSync("audit/evidence/code-patterns-table.md", md);
console.log("Code patterns count:", counts);
