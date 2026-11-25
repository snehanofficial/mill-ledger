import fs from 'node:fs';
import path from 'node:path';

const results = {
  placeholderStrings: [],
  noopButtons: [],
  commentedCode: [],
  placeholderPages: [],
  todoFixme: []
};

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'audit', '.system_generated'].includes(entry.name)) continue;
      walk(full);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.js'))) {
      scanFile(full);
    }
  }
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  // Check if file itself is a placeholder or scaffold
  if (filePath.includes('placeholder')) {
    results.placeholderPages.push({
      file: filePath,
      linesCount: lines.length,
      detail: 'File name includes "placeholder"'
    });
  }

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();

    // 1. Placeholder strings / Coming soon
    if (/coming soon/i.test(line)) {
      results.placeholderStrings.push({
        file: filePath,
        line: lineNum,
        text: trimmed
      });
    }

    // 2. TODO / FIXME / WIP / STUB / MOCK
    if (/\b(TODO|FIXME|WIP|STUB|XXX)\b/i.test(line) && !filePath.includes('test')) {
      results.todoFixme.push({
        file: filePath,
        line: lineNum,
        marker: trimmed
      });
    }

    // 3. Commented-out code (lines starting with // that look like JS/TS/JSX code)
    if (/^\/\/\s*(const\s+[a-zA-Z0-9_$]+\s*=|let\s+[a-zA-Z0-9_$]+\s*=|var\s+|import\s+|export\s+|function\s+[a-zA-Z0-9_$]+|return\s+|<[A-Z][a-zA-Z0-9]*\b|if\s*\(|await\s+[a-zA-Z0-9_$]+)/.test(trimmed)) {
      results.commentedCode.push({
        file: filePath,
        line: lineNum,
        code: trimmed
      });
    }

    // 4. No-op onClick
    if (/onClick\s*=\s*\{\s*(\(\s*\)\s*=>\s*\{\s*\}|\(\s*\)\s*=>\s*undefined|\(\s*\)\s*=>\s*null|\(\s*\)\s*=>\s*void\s+0|\(\s*\)\s*=>\s*\{\s*\/\*.*?\*\/\s*\})\s*\}/.test(line)) {
      results.noopButtons.push({
        file: filePath,
        line: lineNum,
        snippet: trimmed
      });
    }
  });

  // Check JSX for Button elements without onClick and without type="submit"
  // Scan multiline JSX tags for <Button ... > or <button ... >
  const btnRegex = /<(Button|button)\b([^>]*?)(\/?>)/g;
  let match;
  while ((match = btnRegex.exec(content)) !== null) {
    const tagName = match[1];
    const attrs = match[2];
    const isSelfClosing = match[3] === '/>';
    const lineNum = content.slice(0, match.index).split('\n').length;

    // Check if it has onClick, type="submit", type="reset", asChild, form, or disabled
    const hasOnClick = /\bonClick\b/.test(attrs);
    const isSubmit = /\btype\s*=\s*["']submit["']/.test(attrs);
    const isReset = /\btype\s*=\s*["']reset["']/.test(attrs);
    const hasAsChild = /\basChild\b/.test(attrs);
    const hasForm = /\bform\b/.test(attrs);
    const isDropdownTrigger = /\bDropdownMenuTrigger\b/.test(content.slice(Math.max(0, match.index - 50), match.index));

    // If it's a Button component definition (e.g., in ui/button.tsx), skip
    if (filePath.includes('components/ui/button.tsx')) continue;

    if (!hasOnClick && !isSubmit && !isReset && !hasAsChild && !hasForm && !isDropdownTrigger) {
      results.noopButtons.push({
        file: filePath,
        line: lineNum,
        snippet: match[0].replace(/\s+/g, ' ').slice(0, 100),
        reason: 'Button without onClick, type="submit", asChild, or form action'
      });
    }
  }
}

walk('client/src');
walk('server/src');
walk('shared/src');

fs.writeFileSync('audit/evidence/quality/dead-ui-and-stubs.json', JSON.stringify(results, null, 2));
console.log('Results summary:');
console.log('Placeholder strings:', results.placeholderStrings.length);
console.log('TODO / FIXME:', results.todoFixme.length);
console.log('Commented-out code lines:', results.commentedCode.length);
console.log('Placeholder files:', results.placeholderPages.length);
console.log('No-op / unhandled buttons:', results.noopButtons.length);
