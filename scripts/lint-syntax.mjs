/**
 * FGUA v2 — verificação de sintaxe dos módulos JS/MJS (node --check).
 */
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

async function walk(dir, exts) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(p, exts));
    else if (!exts || exts.some((e) => entry.name.endsWith(e))) out.push(p);
  }
  return out;
}

function checkFile(file) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ['--check', file], { stdio: 'pipe' });
    let err = '';
    p.stderr?.on('data', (d) => { err += d; });
    p.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`sintaxe inválida em ${relative(ROOT, file)}:\n${err}`));
    });
  });
}

const files = [
  ...await walk(join(ROOT, 'src'), ['.js']),
  ...await walk(join(ROOT, 'Public'), ['.js']),
  ...await walk(join(ROOT, 'scripts'), ['.mjs']),
  ...await walk(join(ROOT, 'tests'), ['.mjs'])
];

let failed = 0;
for (const f of files) {
  try {
    await checkFile(f);
  } catch (err) {
    failed++;
    console.error(`  ✖ ${err?.message || err}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} arquivo(s) com erro de sintaxe.`);
  process.exit(1);
}
console.log(`✔ ${files.length} módulos com sintaxe válida`);
