/**
 * FGUA v2 — executor de todas as suítes de teste.
 */

const suites = [
  './validate-configs.mjs',
  './gguf-parser.test.mjs',
  './quantizer.test.mjs',
  './api-router.test.mjs',
  './fs.test.mjs'
];

let failed = 0;
for (const s of suites) {
  const name = s.split('/').pop();
  const t0 = performance.now();
  try {
    const mod = await import(s);
    const msg = await mod.test();
    const ms = Math.round(performance.now() - t0);
    console.log(`  ✔ ${name.padEnd(28)} ${ms} ms — ${msg}`);
  } catch (err) {
    failed++;
    console.error(`  ✖ ${name.padEnd(28)} FALHOU`);
    console.error(err);
  }
}

console.log('');
if (failed > 0) {
  console.error(`${failed} suíte(s) falharam.`);
  process.exit(1);
}
console.log(`Todas as ${suites.length} suítes passaram.`);
