/**
 * FGUA v2 — validação das configs JSON (fonte única de verdade).
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

async function loadJson(rel) {
  return JSON.parse(await readFile(join(ROOT, rel), 'utf-8'));
}

export async function test() {
  const api = await loadJson('configs/api.json');
  const models = await loadJson('configs/models.json');
  const generators = await loadJson('configs/generators.json');
  const repacks = await loadJson('configs/repacks.json');
  const permissions = await loadJson('configs/permissions.json');
  const settings = await loadJson('configs/settings.json');

  assert.equal(api.contract, '/api/v1', 'contrato deve ser /api/v1');
  assert.ok(Object.keys(api.namespaces).length >= 16, 'pelo menos 16 namespaces');
  const allPerms = new Set();
  for (const [ns, def] of Object.entries(api.namespaces)) {
    assert.ok(def.permission, `namespace ${ns} precisa de permission`);
    assert.ok(Array.isArray(def.endpoints) && def.endpoints.length > 0, `${ns} precisa de endpoints`);
    for (const ep of def.endpoints) {
      assert.match(ep.path, new RegExp(`^/${ns}/`), `endpoint de ${ns} com caminho inválido`);
      assert.match(ep.method, /^(GET|POST)$/);
    }
    allPerms.add(def.permission);
  }
  assert.ok(models.models.length >= 5, 'catálogo com pelo menos 5 modelos');
  for (const m of models.models) {
    assert.ok(m.id && m.name && m.format && m.quantization, `modelo ${m.id} incompleto`);
    assert.ok(['gguf', 'onnx'].includes(m.format), `formato de ${m.id} deve ser gguf/onnx`);
    assert.ok(['requires-provider', 'requires-runtime'].includes(m.state), `estado de ${m.id} explícito`);
  }
  for (const g of Object.keys(generators.genres)) {
    assert.ok(generators.genres[g].engines, `gênero ${g} sem engines`);
    assert.ok(generators.pixelBudgets[generators.genres[g].pixelBudgetPreset], `gênero ${g} sem budget`);
  }
  assert.ok(repacks.repacks.length >= 4, 'pelo menos 4 repacks');
  for (const r of repacks.repacks) {
    assert.ok(Array.isArray(r.tools) && r.tools.length > 0, `repack ${r.id} sem tools`);
    assert.ok(Array.isArray(r.steps), `repack ${r.id} sem steps`);
  }
  // permissões: cada guard deve existir em algum papel
  const rolePerms = new Set(Object.values(permissions.roles).flatMap(r => r.permissions));
  for (const guard of Object.values(permissions.namespaceGuard)) {
    assert.ok(rolePerms.has(guard), `guard "${guard}" não existe em nenhum papel`);
  }
  assert.ok(['demo', 'local', 'remote'].includes(settings.mode), 'settings.mode inválido');
  assert.match(settings.backends.lmstudio.baseUrl, /^http:\/\/localhost:\d+$/, 'baseUrl LM Studio local');
  return '6 configs válidas (contrato, catálogo, gêneros, repacks, permissões, settings)';
}

export default { test };
