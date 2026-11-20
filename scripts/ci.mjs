/**
 * FGUA v2 — CI completa:
 * 1. valida configs JSON
 * 2. valida presets/templates/manifests
 * 3. executa todas as suítes de teste
 * 4. confere referências de assets em HTML/CSS (arquivos existem)
 * 5. confere limites de arquitetura (src ≤ 10 pastas, Public ≤ 10/20 pastas)
 * 6. sintaxe de todos os módulos JS (parse)
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import assert from 'node:assert/strict';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
let steps = [];
let failed = false;

function step(name, fn) {
  return { name, fn };
}

async function walk(dir, exts) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(p, exts));
    else if (!exts || exts.some(e => entry.name.endsWith(e))) out.push(p);
  }
  return out;
}

const stepsList = [
  step('validação das configs', async () => {
    const mod = await import('../tests/validate-configs.mjs');
    return await mod.test();
  }),
  step('validação de presets/templates/manifests', async () => {
    for (const f of ['Public/presets/default-presets.json', 'Public/templates/job-template.json',
      'Public/templates/integration-spec.json', 'Public/manifests/sample-repack.json']) {
      const json = JSON.parse(await readFile(join(ROOT, f), 'utf-8'));
      assert.ok(json && typeof json === 'object', `${f} parseável`);
    }
    const presets = JSON.parse(await readFile(join(ROOT, 'Public/presets/default-presets.json'), 'utf-8'));
    assert.ok(Object.keys(presets.presets).length >= 5, 'presets suficientes');
    return '4 recursos públicos parseados, 5+ presets';
  }),
  step('suítes de teste', async () => {
    const { spawn } = await import('node:child_process');
    await new Promise((resolve, reject) => {
      const p = spawn(process.execPath, [join(ROOT, 'tests/run-all.mjs')], { stdio: 'inherit' });
      p.on('exit', code => code === 0 ? resolve() : reject(new Error('testes falharam')));
    });
    return '5 suítes passaram';
  }),
  step('referências de assets em HTML/CSS', async () => {
    const files = [...await walk(join(ROOT, 'Public'), ['.html', '.css']), join(ROOT, 'index.html')];
    let refs = 0;
    for (const f of files) {
      const src = await readFile(f, 'utf-8');
      const re = /(?:href|src)="([^"#][^"]*)"/g;
      let m;
      while ((m = re.exec(src))) {
        const ref = m[1].split('#')[0];
        if (/^(https?:|data:|mailto:|javascript:|#)/.test(ref) || ref === '') continue;
        const target = join(f, '..', ref);
        refs++;
        try { await stat(target); } catch {
          // ícones externos via use href="assets/..." são relativos ao desktop; resolver a partir do arquivo
          throw new Error(`referência quebrada em ${relative(ROOT, f)} → ${ref}`);
        }
      }
      // url(...) de CSS
      if (f.endsWith('.css')) {
        const re2 = /url\((['"]?)([^'")]+)\1\)/g;
        let m2;
        while ((m2 = re2.exec(src))) {
          const ref = m2[2];
          if (/^(https?:|data:)/.test(ref)) continue;
          refs++;
          try { await stat(join(f, '..', ref)); } catch { throw new Error(`url() quebrada em ${relative(ROOT, f)} → ${ref}`); }
        }
      }
    }
    return `${refs} referências verificadas em ${files.length} arquivos`;
  }),
  step('limites de arquitetura (SRC ≤ 10, PUBLIC ≤ 20)', async () => {
    const src = (await readdir(join(ROOT, 'src'), { withFileTypes: true })).filter(e => e.isDirectory());
    const pub = (await readdir(join(ROOT, 'Public'), { withFileTypes: true })).filter(e => e.isDirectory());
    assert.ok(src.length <= 10, `src tem ${src.length} pastas (≤ 10)`);
    assert.ok(pub.length <= 20, `Public tem ${pub.length} pastas (≤ 20)`);
    return `src: ${src.length} pastas · Public: ${pub.length} pastas — dentro dos limites`;
  }),
  step('sintaxe dos módulos JS', async () => {
    const { spawn } = await import('node:child_process');
    const files = [...await walk(join(ROOT, 'src'), ['.js']), ...await walk(join(ROOT, 'Public'), ['.js']), ...await walk(join(ROOT, 'scripts'), ['.mjs']), ...await walk(join(ROOT, 'tests'), ['.mjs'])];
    for (const f of files) {
      await new Promise((resolve, reject) => {
        const p = spawn(process.execPath, ['--check', f], { stdio: 'pipe' });
        let err = '';
        p.stderr?.on('data', d => { err += d; });
        p.on('exit', code => code === 0 ? resolve() : reject(new Error(`sintaxe inválida em ${relative(ROOT, f)}:\n${err}`)));
      });
    }
    return `${files.length} módulos com sintaxe válida`;
  })
];

console.log('FGUA v2 — CI completa\n');
for (const s of stepsList) {
  const t0 = performance.now();
  try {
    const msg = await s.fn();
    console.log(`  ✔ ${s.name} (${Math.round(performance.now() - t0)} ms) — ${msg}`);
  } catch (err) {
    failed = true;
    console.error(`  ✖ ${s.name}: ${err?.message || err}`);
  }
}

console.log('');
if (failed) {
  console.error('CI FALHOU — corrija os itens acima.');
  process.exit(1);
}
console.log('CI PASSOU — pacote pronto para uso.');
