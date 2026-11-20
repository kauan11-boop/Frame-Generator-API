import test from 'node:test';
import assert from 'node:assert/strict';
import { QuantizationAnalyzer } from '../src/quantization/QuantizationAnalyzer.js';
import { ModelCompatibility } from '../src/models/ModelCompatibility.js';
import { PermissionManager } from '../src/security/PermissionManager.js';
import { ValidationManager } from '../src/security/ValidationManager.js';
import { ManifestLoader } from '../src/repacks/ManifestLoader.js';

test('QuantizationAnalyzer returns estimate and honest compatibility', () => {
  const qa = new QuantizationAnalyzer();
  const res = qa.analyze({ format: 'gguf', size: 1024 * 1024, tensorTypes: ['F16'] }, 'Q4_K_M');
  assert.equal(res.ok, true);
  assert.equal(res.compatibility.possible, 'requires-runtime');
  assert.equal(res.estimate.ok, true);
});

test('ModelCompatibility flags unknown format as unsupported', () => {
  const mc = new ModelCompatibility();
  const res = mc.assess({ format: 'unknown', size: 10 }, { capabilities: {} });
  assert.equal(res.status, 'unsupported');
});

test('PermissionManager supports configured roles and wildcard checks', () => {
  const pm = new PermissionManager();
  pm.setRoles({ User: { allow: ['models.read', 'tasks.*'] } });
  assert.equal(pm.check({ role: 'User' }, 'models.read').ok, true);
  assert.equal(pm.check({ role: 'User' }, 'tasks.cancel').ok, true);
  assert.equal(pm.check({ role: 'Viewer' }, 'tasks.cancel').ok, false);
});

test('ValidationManager validates endpoint and JSON safely', () => {
  const vm = new ValidationManager();
  assert.equal(vm.validateEndpoint('https://example.com/api').ok, true);
  assert.equal(vm.validateEndpoint('ftp://example.com').ok, false);
  assert.equal(vm.validateJson('{"a":1}').ok, true);
  assert.equal(vm.validateJson('{bad').ok, false);
});

test('ManifestLoader normalizes without raw override of core arrays', () => {
  const ml = new ManifestLoader();
  const normalized = ml.normalize({ id: 'x', name: 'X', modules: 'bad', permissions: ['a'], dependencies: null, extra: 1 });
  assert.equal(normalized.id, 'x');
  assert.deepEqual(normalized.modules, []);
  assert.deepEqual(normalized.permissions, ['a']);
  assert.deepEqual(normalized.dependencies, []);
  assert.equal(normalized.extra, 1);
});
