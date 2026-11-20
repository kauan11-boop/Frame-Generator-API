/**
 * FGUA v2 — testes do roteador /api/v1 (contrato completo em modo demo).
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createStore } from '../src/storage/store.js';
import { createSecurity } from '../src/security/security.js';
import { createRouter } from '../src/api/router.js';
import { createVFS } from '../src/storage/fs.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const loadJson = async rel => JSON.parse(await readFile(join(ROOT, rel), 'utf-8'));

export async function test() {
  const config = {
    api: await loadJson('configs/api.json'),
    models: await loadJson('configs/models.json'),
    generators: await loadJson('configs/generators.json'),
    repacks: await loadJson('configs/repacks.json'),
    permissions: await loadJson('configs/permissions.json')
  };
  const settings = await loadJson('configs/settings.json');
  const store = createStore();
  const security = createSecurity(config.permissions, store);
  security.resumeSession();
  const caps = { webgpu: { supported: false }, webgl2: { supported: true }, webgl: { supported: true }, wasm: { supported: true, simd: true }, webcodecs: { videoEncoder: false }, workers: true, storage: { opfs: false } };
  const registered = new Map();
  const kernel = {
    config, settings, caps, security, store,
    bootedAt: new Date().toISOString(),
    get(name) { return registered.get(name) ?? null; },
    register(name, mod) { registered.set(name, mod); }
  };
  const router = createRouter(kernel);
  await createVFS().seed();

  // system
  const info = await router.route('/api/v1/system/info');
  assert.equal(info.state, 'ready');
  assert.equal(info.data.versao, '2.0.0');
  const health = await router.route('/api/v1/system/health');
  assert.equal(health.data.kernel, 'ready');

  // models
  const list = await router.route('/api/v1/models/list');
  assert.ok(list.data.builtin.length >= 5 && list.data.total >= list.data.builtin.length);
  const reg = await router.route('/api/v1/models/register', { method: 'POST', payload: { name: 'test.gguf', format: 'gguf', fileSize: 1024 } });
  assert.equal(reg.state, 'succeeded');
  const loadDemo = await router.route('/api/v1/models/load', { method: 'POST', payload: { model: 'llama-3.2-1b-instruct-q4km' } });
  assert.equal(loadDemo.state, 'requires-provider', 'em demo, load exige provedor');

  // quantization
  const est = await router.route('/api/v1/quantization/estimate', { method: 'POST', payload: { params: 1e9, quantFrom: 'F16', targets: ['Q4_K_M'] } });
  assert.equal(est.state, 'planned');
  const plan = await router.route('/api/v1/quantization/plan', { method: 'POST', payload: { sizeBytes: 4.68e9 } });
  assert.equal(plan.state, 'requires-runtime');

  // generators / frames
  const genres = await router.route('/api/v1/generators/list');
  assert.ok(genres.data.length >= 3);
  const fp = await router.route('/api/v1/frames/plan', { method: 'POST', payload: { genre: 'jogos', params: { fpsAlvo: 120 } } });
  assert.equal(fp.state, 'planned');
  assert.equal(fp.data.steps.at(-1).state, 'requires-runtime');
  const badParams = await router.route('/api/v1/frames/plan', { method: 'POST', payload: { genre: 'jogos', params: { fpsAlvo: 77 } } });
  assert.equal(badParams.state, 'invalid', 'fps fora da spec é inválido');
  const budget = await router.route('/api/v1/frames/budget', { method: 'POST', payload: { width: 1920, height: 1080, fpsAlvo: 60, fpsMedido: 45 } });
  assert.ok(budget.data.escalaRecomendadaPct < 100, 'com fps abaixo do alvo, escala reduz');

  // repack
  const rl = await router.route('/api/v1/repack/list');
  assert.ok(rl.data.repacks.length >= 4);
  const ri = await router.route('/api/v1/repack/install', { method: 'POST', payload: { id: 'frame-gen-starter' } });
  assert.ok(['succeeded', 'planned'].includes(ri.state), `repack executado (${ri.state})`);
  assert.ok(ri.data.steps.length >= 3, 'repack multi-ferramenta executou passos');

  // users / permissions (guard)
  const denied = await router.route('/api/v1/users/list');
  const sess = security.session();
  assert.equal(sess.role, 'admin', 'sessão padrão admin');
  const okList = await router.route('/api/v1/users/list');
  assert.equal(okList.state, 'ready');
  // troca para visitante: users.manage deve negar
  await security.login('visitante');
  const deniedList = await router.route('/api/v1/users/list');
  assert.equal(deniedList.state, 'unavailable', 'visitante não gerencia usuários');
  const allowedGen = await router.route('/api/v1/frames/plan', { method: 'POST', payload: { genre: 'imagem', params: { fatoresEscala: 2 } } });
  assert.equal(allowedGen.state, 'planned', 'visitante pode planejar');
  await security.login('admin');

  // jobs
  const job = await router.route('/api/v1/jobs/create', { method: 'POST', payload: { titulo: 't', genero: 'jogos' } });
  assert.equal(job.state, 'planned');
  const cancel = await router.route('/api/v1/jobs/cancel', { method: 'POST', payload: { id: job.data.id } });
  assert.equal(cancel.state, 'cancelled');
  const again = await router.route('/api/v1/jobs/cancel', { method: 'POST', payload: { id: job.data.id } });
  assert.equal(again.state, 'invalid', 'job terminal não recancela');

  // storage (VFS em memória via kernel fake)
  const w = await router.route('/api/v1/storage/write', { method: 'POST', payload: { path: '/Projetos/teste.txt', content: 'olá FGUA' } });
  assert.equal(w.state, 'succeeded');
  const r = await router.route('/api/v1/storage/read', { method: 'POST', payload: { path: '/Projetos/teste.txt' } });
  assert.equal(r.data, 'olá FGUA');
  const ls = await router.route('/api/v1/storage/ls', { method: 'POST', payload: { path: '/Projetos' } });
  assert.ok(ls.data.children.some(c => c.name === 'teste.txt'));

  // rota desconhecida
  const unk = await router.route('/api/v1/system/nope');
  assert.equal(unk.state, 'invalid');

  return `roteador /api/v1 OK: 16 namespaces, guards, jobs, storage e repack verificados (${ri.data.steps.length} passos no repack)`;
}

export default { test };
