/**
 * FGUA v2 — roteador do contrato lógico /api/v1.
 * Uma única API que controla tudo: 16 namespaces, JSON in/out, estados explícitos,
 * guarda de permissões por namespace e modo demo/local/remote.
 */

import { result } from '../core/states.js';
import { createLMStudio } from './lmstudio.js';
import * as quantizer from '../models/quantizer.js';
import { createModelRegistry } from '../models/registry.js';
import { createPlanner } from '../generators/planner.js';
import { createRepackManager } from '../repacks/manager.js';

export function createRouter(kernel) {
  const { config, settings, caps, security, store } = kernel;
  const lmstudio = createLMStudio(settings);
  const registry = createModelRegistry(store);
  const planner = createPlanner(config.generators, caps);
  const repacks = createRepackManager({ repacksConfig: config.repacks, route: (path, opts) => route(path, opts) });
  const jobs = store.get('fgua.jobs', 'list', []);
  const mounts = new Map(); // handlers de arquivo (metadata.parse, videos.probe…)

  function mount(action, fn) { mounts.set(action, fn); }

  function mode() { return settings.mode ?? 'demo'; }

  function setMode(m) {
    if (!['demo', 'local', 'remote'].includes(m)) return result('invalid', null, { error: `Modo inválido: ${m}` });
    settings.mode = m;
    store.set('fgua.config', 'settings-overrides', { ...(store.get('fgua.config', 'settings-overrides', {})), mode: m });
    return result('succeeded', { mode: m });
  }

  function envelope(state, data, meta, error = null) {
    return { ok: state !== 'failed' && state !== 'invalid', state, data, error, meta };
  }

  async function route(path, { method = 'GET', payload = null } = {}) {
    const t0 = performance.now();
    const clean = String(path).replace(/^\/+/, '');
    const parts = clean.split('/').filter(Boolean);
    if (parts[0] === 'api' && parts[1] === 'v1') parts.splice(0, 2);
    if (parts.length < 2) return envelope('invalid', null, meta(t0, null, null), `Caminho inválido: ${path} — use /api/v1/<ns>/<acao>`);
    const [ns, action] = parts;

    const perm = config.api.namespaces[ns]?.permission ?? 'public';
    const guard = security.guard(perm);
    if (guard.state !== 'ready') return envelope('unavailable', { allowed: false }, meta(t0, ns, action), guard.error);

    // modo local/remote com backend custom: proxy direto
    if (mode() !== 'demo' && settings.backends?.customBackend?.enabled && settings.backends.customBackend.baseUrl) {
      const base = settings.backends.customBackend.baseUrl.replace(/\/+$/, '');
      try {
        const res = await fetch(`${base}/api/v1/${ns}/${action}`, { method, headers: { 'Content-Type': 'application/json' }, body: method === 'POST' ? JSON.stringify(payload ?? {}) : undefined });
        const json = await res.json().catch(() => null);
        return envelope(res.ok ? 'succeeded' : 'failed', json, meta(t0, ns, action));
      } catch (err) {
        return envelope('unavailable', null, meta(t0, ns, action), `Backend custom inacessível: ${err?.message || err}`);
      }
    }

    const out = await dispatch(ns, action, payload);
    return envelope(out.state, out.data ?? null, meta(t0, ns, action), out.error ?? null);
  }

  function meta(t0, ns, action) {
    return { ns, action, mode: mode(), elapsedMs: Math.round(performance.now() - t0), at: new Date().toISOString() };
  }

  async function dispatch(ns, action, payload) {
    const key = `${ns}.${action}`;

    if (mounts.has(key)) {
      try { return await mounts.get(key)(payload); }
      catch (err) { return result('failed', null, { error: String(err?.message || err) }); }
    }

    switch (key) {
      // system
      case 'system.info': return result('ready', { nome: 'Frame-Generator-API', versao: '2.0.0', contrato: '/api/v1', modo: mode(), bootadoEm: kernel.bootedAt });
      case 'system.capabilities': return result('ready', caps);
      case 'system.health': {
        const subs = {
          kernel: 'ready', storage: store.driver, seguranca: security.session() ? 'ready' : 'unavailable',
          lmstudio: mode() === 'demo' ? 'requires-provider' : 'planned',
          webgpu: caps.webgpu?.supported ? 'ready' : 'unavailable',
          wasm: caps.wasm?.supported ? 'ready' : 'unavailable'
        };
        return result('ready', subs);
      }

      // models
      case 'models.list': {
        const local = registry.list();
        return result('ready', { builtin: config.models.models, analisados: local.data.custom, total: config.models.models.length + local.data.custom.length });
      }
      case 'models.get': {
        const id = payload?.id;
        const builtin = config.models.models.find(m => m.id === id);
        if (builtin) return result('ready', builtin);
        const local = registry.get(id);
        return local ? result('ready', local) : result('invalid', null, { error: `Modelo não encontrado: ${id}` });
      }
      case 'models.register': return registry.register(payload);
      case 'models.load': {
        if (mode() === 'demo') return result('requires-provider', null, { error: 'Modo demo: conecte um provedor (LM Studio) em modo local para carregar modelos.' });
        const r = await lmstudio.loadModel({ model: payload?.model ?? payload?.id, config: payload?.config });
        return r;
      }
      case 'models.list-remote': {
        if (mode() === 'demo') return result('requires-provider', null, { error: 'Modo demo: sem provedor conectado.' });
        const r = await lmstudio.listModelsNative();
        return r;
      }

      // metadata
      case 'metadata.summary': {
        const local = registry.list().data.custom;
        return result('ready', {
          builtin: config.models.models.length, analisados: local.length,
          porFormato: config.models.models.reduce((acc, m) => { acc[m.format] = (acc[m.format] ?? 0) + 1; return acc; }, {})
        });
      }

      // quantization
      case 'quantization.types': return quantizer.types();
      case 'quantization.estimate': return quantizer.estimate(payload ?? {});
      case 'quantization.plan': return quantizer.plan(payload ?? {});

      // generators / frames / images / videos
      case 'generators.list': return planner.list();
      case 'generators.plan': return planner.plan(payload ?? {});
      case 'frames.plan': return planner.plan(payload ?? {});
      case 'frames.budget': return planner.frameBudget(payload ?? {});
      case 'images.plan': return planner.plan({ genre: 'imagem', params: payload?.params ?? payload });
      case 'videos.plan': return planner.plan({ genre: 'video', params: payload?.params ?? payload });

      // engines
      case 'engines.detect': {
        const { enginesDetect } = await import('../runtime/detect.js');
        return enginesDetect(caps);
      }
      case 'engines.select': {
        const formato = payload?.formato ?? 'gguf';
        const operacao = payload?.operacao ?? 'inferencia';
        const escolhas = [];
        if (caps.webgpu?.supported) escolhas.push('WebGPU');
        if (caps.webgl2?.supported) escolhas.push('WebGL2');
        if (caps.wasm?.supported) escolhas.push('WASM');
        if (formato === 'gguf' && operacao === 'inferencia') escolhas.push('LM Studio (modo local)');
        return result('planned', {
          formato, operacao, candidatos: escolhas,
          recomendado: escolhas[0] ?? 'nenhum compatível',
          nota: 'Seleção é planejamento; execução real exige runtime/provedor carregado.'
        });
      }

      // repack (multi-ferramenta em 1 comando)
      case 'repack.list': return repacks.list();
      case 'repack.get': return repacks.get(payload?.id);
      case 'repack.install': return await repacks.install(payload?.id, { payload: payload ?? {} });
      case 'repack.bundle': return await repacks.install(payload?.id ?? 'frame-gen-starter', { payload: payload ?? {} });
      case 'repack.addLocal': return repacks.addLocal(payload);

      // tools
      case 'tools.list': {
        const ferramentas = [];
        for (const [nsName, nsDef] of Object.entries(config.api.namespaces)) {
          for (const ep of nsDef.endpoints) ferramentas.push({ ns: nsName, ...ep });
        }
        return result('ready', { total: ferramentas.length, ferramentas });
      }
      case 'tools.run': {
        const endpoint = payload?.endpoint;
        if (!endpoint) return result('invalid', null, { error: 'endpoint é obrigatório.' });
        return await route(endpoint, { method: 'POST', payload: payload?.payload ?? {} });
      }

      // users / permissions
      case 'users.list': return security.listUsers();
      case 'users.create': return security.createUser(payload ?? {});
      case 'users.auth': return await security.login(payload?.id, payload?.password ?? '');
      case 'permissions.roles': return security.rolesMatrix();
      case 'permissions.check': return security.guard(payload?.perm ?? 'public');

      // config
      case 'config.get': return result('ready', settings);
      case 'config.set': {
        const patch = payload ?? {};
        const merged = { ...(store.get('fgua.config', 'settings-overrides', {})), ...patch };
        store.set('fgua.config', 'settings-overrides', merged);
        Object.assign(settings, patch);
        return result('succeeded', settings);
      }

      // jobs
      case 'jobs.list': return result('ready', { jobs });
      case 'jobs.create': {
        const job = {
          id: `job-${Date.now().toString(36)}`,
          titulo: payload?.titulo ?? 'Job sem título',
          genero: payload?.genero ?? 'jogos',
          plano: payload?.plano ?? null,
          state: 'planned',
          criadoEm: new Date().toISOString()
        };
        jobs.unshift(job);
        if (jobs.length > 50) jobs.pop();
        store.set('fgua.jobs', 'list', jobs);
        return result('planned', job);
      }
      case 'jobs.cancel': {
        const job = jobs.find(j => j.id === payload?.id);
        if (!job) return result('invalid', null, { error: `Job não encontrado: ${payload?.id}` });
        if (job.state === 'succeeded' || job.state === 'cancelled') return result('invalid', null, { error: `Job em estado terminal: ${job.state}` });
        job.state = 'cancelled';
        store.set('fgua.jobs', 'list', jobs);
        return result('cancelled', job);
      }

      // storage
      case 'storage.ls': return await storageHandler('ls', payload);
      case 'storage.read': return await storageHandler('read', payload);
      case 'storage.write': return await storageHandler('write', payload);
      case 'storage.remove': return await storageHandler('remove', payload);

      default:
        return result('invalid', null, { error: `Ação desconhecida: ${ns}/${action}` });
    }
  }

  async function storageHandler(op, payload) {
    try {
      const { createVFS } = await import('../storage/fs.js');
      if (!kernel.get('vfs')) {
        const vfs = createVFS();
        kernel.register('vfs', vfs);
        await vfs.seed();
      }
      const vfs = kernel.get('vfs');
      switch (op) {
        case 'ls': return await vfs.ls(payload?.path ?? '/');
        case 'read': return await vfs.readFile(payload?.path, { asBlob: payload?.asBlob });
        case 'write': return await vfs.writeFile(payload?.path, payload?.content ?? '', payload?.meta ?? {});
        case 'remove': return await vfs.remove(payload?.path);
        default: return result('invalid', null, { error: 'operação de storage desconhecida' });
      }
    } catch (err) {
      return result('failed', null, { error: String(err?.message || err) });
    }
  }

  return { route, mount, mode, setMode, lmstudio, registry, planner, repacks, jobs, setLmStudio: (fn) => Object.assign(lmstudio, fn) };
}
