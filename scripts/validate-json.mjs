import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const targets = [
  'manifest.json',
  'package.json',
  'configs',
  'Public/manifests',
  'Public/presets',
  'Public/templates',
  'Public/locales',
];

const files = [];

function collect(p) {
  let st;
  try { st = statSync(p); } catch { return; }
  if (st.isDirectory()) {
    for (const name of readdirSync(p)) collect(join(p, name));
  } else if (/\.json$/i.test(p)) {
    files.push(p);
  }
}

for (const t of targets) collect(t);

let failed = 0;
for (const f of files) {
  try {
    JSON.parse(readFileSync(f, 'utf8'));
  } catch (e) {
    failed++;
    console.error(`Invalid JSON: ${f}\n  ${e.message}`);
  }
}

if (failed) {
  console.error(`JSON validation failed for ${failed} file(s).`);
  process.exit(1);
}
console.log(`JSON OK (${files.length} files).`);
