import test from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../src/core/EventBus.js';
import { ModuleRegistry } from '../src/core/ModuleRegistry.js';
import { ApiController } from '../src/core/ApiController.js';
import { JsonManager } from '../src/configuration/JsonManager.js';

test('EventBus removes wildcard once listeners correctly', async () => {
  const bus = new EventBus();
  let count = 0;
  bus.once('*', () => { count++; });
  await bus.emit('a', 1);
  await bus.emit('b', 2);
  assert.equal(count, 1);
});

test('ModuleRegistry prevents duplicate register by default', () => {
  const reg = new ModuleRegistry('test');
  reg.register('a', { v: 1 });
  assert.throws(() => reg.register('a', { v: 2 }), /duplicado/);
  assert.equal(reg.get('a').v, 1);
});

test('ApiController returns unavailable in demo without backend', async () => {
  const api = new ApiController({ mode: 'demo' });
  const res = await api.get('/api/v1/system/status');
  assert.equal(res.ok, false);
  assert.equal(res.state, 'unavailable');
  assert.equal(res.error.code, 'BACKEND_UNAVAILABLE');
});

test('JsonManager merge is deep and blocks dangerous keys', () => {
  const jm = new JsonManager();
  const base = { a: { b: 1 } };
  const patch = JSON.parse('{"a":{"c":2},"__proto__":{"x":1}}');
  const out = jm.merge(base, patch);
  assert.deepEqual(out.a, { b: 1, c: 2 });
  assert.equal(({}).x, undefined);
});
