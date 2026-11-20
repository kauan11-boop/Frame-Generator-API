import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../server/runtime.js';

test('runtime carrega configurações e informa que IA é opcional', async () => {
  const runtime = await createRuntime();
  const status = runtime.status();
  assert.equal(status.status, 'ready');
  assert.equal(status.aiRequired, false);
  assert.ok(status.configsLoaded >= 1);
});

test('contrato da API contém namespaces', async () => {
  const runtime = await createRuntime();
  const contract = runtime.contract();
  assert.ok(Array.isArray(contract.namespaces));
  assert.ok(contract.namespaces.some(x => x.includes('/models/')));
});

test('validador de pipeline aceita etapas válidas e não executa', async () => {
  const runtime = await createRuntime();
  const result = runtime.validatePipeline({ stages: [{ id: 'input', type: 'source' }] });
  assert.equal(result.ok, true);
  assert.equal(result.executed, false);
});

test('validador detecta IDs duplicados', async () => {
  const runtime = await createRuntime();
  const result = runtime.validatePipeline({ stages: [
    { id: 'same', type: 'source' },
    { id: 'same', type: 'transform' }
  ] });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(x => x.includes('duplicado')));
});
