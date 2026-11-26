import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

process.env.FGUA_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'fgua-test-'));

const { TOOLS, dispatch } = await import('../src/engine/tools.js');
const store = await import('../src/store.js');
const { runCode } = await import('../src/sandbox.js');
const { extractCode } = await import('../src/llm.js');

test('catálogo de ferramentas tem nomes únicos e schemas válidos', () => {
  const names = TOOLS.map((t) => t.name);
  assert.equal(new Set(names).size, names.length);
  for (const tool of TOOLS) {
    assert.match(tool.name, /^fgua_/);
    assert.ok(tool.description?.length > 10, `${tool.name} sem descrição`);
    assert.equal(tool.inputSchema.type, 'object');
    assert.ok(typeof tool.handler === 'function');
    for (const field of tool.inputSchema.required || []) {
      assert.ok(tool.inputSchema.properties[field], `${tool.name}: required ${field} ausente`);
    }
  }
});

test('presets: salvar, listar, filtrar, obter e remover', async () => {
  await store.savePreset({ id: 'test-preset', name: 'Teste', kind: 'reverse', config: { steps: ['open_binary'] }, tags: ['x'] });
  assert.ok(store.getPreset('test-preset'));
  assert.equal(store.listPresets('reverse').some((p) => p.id === 'test-preset'), true);
  assert.equal(store.listPresets('repair').some((p) => p.id === 'test-preset'), false);
  const removed = await store.deletePreset('test-preset');
  assert.equal(removed.removed, true);
  assert.equal(store.getPreset('test-preset'), null);
});

test('prompts: salvar e renderizar variáveis', async () => {
  await store.savePrompt({ id: 'test-prompt', name: 'Teste', body: 'Olá {{alvo}}', variables: [] });
  assert.equal(store.renderPrompt('test-prompt', { alvo: 'REA' }), 'Olá REA');
  assert.equal(store.renderPrompt('test-prompt', {}), 'Olá {{alvo}}');
  await store.deletePrompt('test-prompt');
});

test('configurações: atualização parcial preserva demais campos', async () => {
  const before = store.getSettings();
  const after = await store.updateSettings({ temperature: 0.7 });
  assert.equal(after.temperature, 0.7);
  assert.equal(after.maxIterations, before.maxIterations);
  await store.updateSettings({ temperature: before.temperature });
});

test('sandbox JavaScript: reward 1 em teste que passa e 0 em teste que falha', async () => {
  const ok = await runCode({ code: 'export const soma = (a,b) => a+b;', tests: 'import { soma } from "./solution.mjs"; console.assert(soma(2,3) === 5);', language: 'javascript' });
  assert.equal(ok.passed, true);
  assert.equal(ok.reward, 1);
  const fail = await runCode({ code: 'export const soma = (a,b) => a-b;', tests: 'import { soma } from "./solution.mjs"; console.assert(soma(2,3) === 5, "falhou");', language: 'javascript' });
  assert.equal(fail.passed, false);
  assert.equal(fail.reward, 0);
});

test('extração de código e motivo da resposta do modelo', () => {
  const parsed = extractCode('```js\nconst x = 1;\n```\nMOTIVO: corrigido o sinal');
  assert.equal(parsed.code, 'const x = 1;');
  assert.equal(parsed.motive, 'corrigido o sinal');
});

test('dispatch rejeita ferramenta desconhecida', async () => {
  await assert.rejects(() => dispatch('fgua_inexistente'), /desconhecida/);
});

test('dispatch ops de leitura responde sem depender de REA/LM Studio', async () => {
  const presets = await dispatch('fgua_presets', { action: 'list' });
  assert.ok(Array.isArray(presets.presets));
  const prompts = await dispatch('fgua_prompts', { action: 'list' });
  assert.ok(Array.isArray(prompts.prompts));
  const jobs = await dispatch('fgua_jobs', { action: 'list' });
  assert.ok(Array.isArray(jobs.jobs));
  const settings = await dispatch('fgua_settings', { action: 'get' });
  assert.ok(settings.settings);
});
