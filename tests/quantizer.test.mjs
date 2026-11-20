/**
 * FGUA v2 — testes do quantizador (estimativa e plano).
 */

import assert from 'node:assert/strict';
import * as quantizer from '../src/models/quantizer.js';

export async function test() {
  // tabela completa
  const t = quantizer.types();
  assert.equal(t.state, 'ready');
  assert.ok(t.data.quants.length >= 25, 'tabela de quantização completa');
  const q4km = t.data.quants.find(q => q.label === 'Q4_K_M');
  assert.ok(q4km && q4km.bitsPerWeight > 4 && q4km.bitsPerWeight < 5.2, 'bpw Q4_K_M aproximado 4.85');

  // tamanho a partir de params
  const size1BQ4 = quantizer.sizeFromParams(1e9, 'Q4_K_M');
  assert.ok(size1BQ4 > 500e6 && size1BQ4 < 700e6, `1B em Q4_K_M ≈ 600 MB (obtido ${(size1BQ4 / 1e6).toFixed(0)} MB)`);

  // params a partir de tamanho
  const params = quantizer.paramsFromSize(2e9, 'F16');
  assert.ok(Math.abs(params - 1e9) < 5e6, '2 GB em F16 ≈ 1B de parâmetros');

  // estimate: 7.6B Q4_K_M (qwen 7B) → alvo Q8_0 maior
  const est = quantizer.estimate({ params: 7.6e9, quantFrom: 'Q4_K_M', sizeBytes: size1BQ4 * 7.6, targets: ['Q8_0', 'Q2_K', 'F16'] });
  assert.equal(est.state, 'planned');
  const q8 = est.data.targets.find(x => x.quant === 'Q8_0');
  const q2 = est.data.targets.find(x => x.quant === 'Q2_K');
  assert.ok(q8.sizeBytes > q2.sizeBytes, 'Q8_0 maior que Q2_K');
  assert.ok(est.data.targets.every(x => x.sizeHuman !== '—'));

  // estimate inválido → invalid
  const bad = quantizer.estimate({});
  assert.equal(bad.state, 'invalid');

  // plan: sempre requires-runtime e original preservado
  const plan = quantizer.plan({ fileName: 'modelo.gguf', quantFrom: 'F16', quantTo: 'Q4_K_M', sizeBytes: 4.68e9 });
  assert.equal(plan.state, 'requires-runtime');
  assert.equal(plan.data.originalPreservado, true);
  assert.match(plan.data.comandoSugerido, /llama-quantize .* Q4_K_M/, 'comando runtime externo');
  assert.match(plan.data.aviso, /somente uma especificação/);

  return `quantizador OK: 1B→Q4_K_M ≈ ${(size1BQ4 / 1e6).toFixed(0)} MB, plano requires-runtime com original preservado`;
}

export default { test };
