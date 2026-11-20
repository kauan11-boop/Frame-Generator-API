/**
 * FGUA v2 — validação de JSON/configurações.
 * Garante que os JSONs do projeto são parseáveis e que as configs principais
 * atendem às regras de validate-configs.
 */
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { test as validateConfigs } from '../tests/validate-configs.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

async function walkJson(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walkJson(p));
    else if (entry.name.endsWith('.json')) out.push(p);
  }
  return out;
}

async function parseJsonFile(file) {
  const raw = await readFile(file, 'utf-8');
  JSON.parse(raw);
}

let failed = false;

// 1) Regras de consistência das configs principais
try {
  const msg = await validateConfigs();
  console.log(`  ✔ configs: ${msg}`);
} catch (err) {
  failed = true;
  console.error(`  ✖ configs: ${err?.message || err}`);
}

// 2) Todos os JSONs versionados relevantes devem ser parseáveis
const jsonDirs = ['configs', 'Public/presets', 'Public/templates', 'Public/manifests', 'Public/locales'];
const files = (await Promise.all(jsonDirs.map((d) => walkJson(join(ROOT, d))))).flat();
for (const f of files) {
  try {
    await parseJsonFile(f);
    console.log(`  ✔ ${relative(ROOT, f)}`);
  } catch (err) {
    failed = true;
    console.error(`  ✖ ${relative(ROOT, f)}: ${err?.message || err}`);
  }
}

if (failed) {
  console.error('\nValidação de JSON falhou.');
  process.exit(1);
}
console.log(`\n✔ JSON válido (${files.length} arquivos verificados além das regras de configs)`);
