import fs from 'node:fs';
import path from 'node:path';

interface StubItem {
  file: string;
  line: number;
  type: string;
  detail: string;
  snippet: string;
}

const stubs: StubItem[] = [];

function walk(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'audit', '.system_generated'].includes(entry.name)) continue;
      walk(full);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      scanFile(full);
    }
  }
}

function scanFile(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();

    // 1. Placeholder copy / Coming soon
    if (/coming soon/i.test(line)) {
      stubs.push({
        file: filePath,
        line: lineNum,
        type: 'COMING_SOON',
        detail: 'User-facing "Coming soon" string',
        snippet: trimmed
      });
    }

    // 2. TODO / FIXME / WIP / STUB
    if (/\b(TODO|FIXME|WIP|STUB|XXX)\b/i.test(line) && !filePath.includes('test')) {
      stubs.push({
        file: filePath,
        line: lineNum,
        type: 'TODO_OR_FIXME',
        detail: 'Developer TODO/FIXME marker',
        snippet: trimmed
      });
    }

    // 3. No-op click handlers: onClick={() => {}} or () => void
    if (/onClick=\{?\s*\(\)\s*=>\s*\{\s*\}?\s*\}/.test(line) || /onClick=\{?\s*\(\)\s*=>\s*(undefined|null)\s*\}?/.test(line)) {
      stubs.push({
        file: filePath,
        line: lineNum,
        type: 'NOOP_ONCLICK',
        detail: 'No-op onClick handler',
        snippet: trimmed
      });
    }

    // 4. Commented-out code heuristic (at least 3 consecutive commented lines containing code keywords, or single line obvious code comment)
    if (/^\/\/\s*(const |let |var |import |export |function |return |<[A-Z]|if\s*\(|await )/.test(trimmed)) {
      stubs.push({
        file: filePath,
        line: lineNum,
        type: 'COMMENTED_CODE',
        detail: 'Commented-out code statement',
        snippet: trimmed
      });
    }
  });

  // Check multi-line commented code /* ... */
  const blockCommentRegex = /\/\*([\s\S]*?)\*\//g;
  let match;
  while ((match = blockCommentRegex.exec(content)) !== null) {
    const commentBody = match[1];
    if (/(import |export |function |const |return |<div|<Button)/.test(commentBody)) {
      const lineNum = content.slice(0, match.index).split('\n').length;
      stubs.push({
        file: filePath,
        line: lineNum,
        type: 'BLOCK_COMMENTED_CODE',
        detail: 'Multi-line commented-out code block',
        snippet: commentBody.slice(0, 80).replace(/\n/g, ' ')
      });
    }
  }
}

walk('client/src');
walk('server/src');
walk('shared/src');

fs.writeFileSync('audit/evidence/quality/dead-ui-and-stubs.json', JSON.stringify(stubs, null, 2));

console.log(`Scan completed. Found ${stubs.length} dead UI/stub/comment items.`);
const typeCounts: Record<string, number> = {};
for (const s of stubs) {
  typeCounts[s.type] = (typeCounts[s.type] || 0) + 1;
}
console.log('Summary by type:', typeCounts);
