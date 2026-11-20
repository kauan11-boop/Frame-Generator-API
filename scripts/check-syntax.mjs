import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const roots = ['src', 'Public/js', 'workers', 'Public/workers', 'scripts', 'tests'];
const files = [];

function walk(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p);
    else if (/\.(js|mjs)$/i.test(name)) files.push(p);
  }
}

for (const r of roots) walk(r);

let failed = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, ['--check', f], { stdio: 'inherit' });
  if (r.status !== 0) failed++;
}

if (failed) {
  console.error(`Syntax check failed for ${failed} file(s).`);
  process.exit(1);
}
console.log(`Syntax OK (${files.length} files).`);
