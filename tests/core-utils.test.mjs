import test from 'node:test';
import assert from 'node:assert/strict';
import { deepMergeSafe, uid, normalizeBaseUrl, joinPath } from '../src/core/utils.js';

test('deepMergeSafe merges plain objects without prototype pollution keys', () => {
  const base = { a: 1, nested: { x: 1 } };
  const patch = JSON.parse('{"nested":{"y":2},"__proto__":{"polluted":true},"b":2}');
  const out = deepMergeSafe(base, patch);
  assert.equal(out.a, 1);
  assert.equal(out.b, 2);
  assert.deepEqual(out.nested, { x: 1, y: 2 });
  assert.equal(({}).polluted, undefined);
  assert.equal(Object.prototype.polluted, undefined);
});

test('uid generates prefixed string', () => {
  const id = uid('job');
  assert.match(id, /^job_/);
});

test('normalizeBaseUrl and joinPath work', () => {
  assert.equal(normalizeBaseUrl('https://x.test///'), 'https://x.test');
  assert.equal(joinPath('https://x.test/', '/api/v1/models'), 'https://x.test/api/v1/models');
  assert.equal(joinPath('https://x.test/api', 'models'), 'https://x.test/api/models');
});
