import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'src');
const ALLOWLIST = new Set([
  'index.css',
  'PineappleLogo.jsx',
  'Icons.jsx',
  'Category3DBadges.jsx',
  'KidIllustrations.jsx',
  'TeacherReportSheet.jsx',
]);

const HEX_RE = /#(?:[0-9a-fA-F]{3,8})\b/g;
const findings = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'lottie') continue;
      walk(full);
    } else if (/\.(js|jsx|css)$/.test(entry.name)) {
      if (ALLOWLIST.has(entry.name) || entry.name.endsWith('.test.js')) continue;
      const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/);
      lines.forEach((line, idx) => {
        const matches = line.match(HEX_RE);
        if (matches) {
          findings.push({
            file: path.relative(process.cwd(), full).replace(/\\/g, '/'),
            line: idx + 1,
            values: matches.join(', '),
          });
        }
      });
    }
  }
}

walk(ROOT);
console.log(`Palette check scanned src/ (excluding allow-listed SVG/print/token files): ${findings.length} hardcoded hex occurrences.`);
for (const f of findings.slice(0, 30)) {
  console.log(`  ${f.file}:${f.line} -> ${f.values}`);
}
if (findings.length > 30) {
  console.log(`  ... and ${findings.length - 30} more.`);
}
process.exit(0);
