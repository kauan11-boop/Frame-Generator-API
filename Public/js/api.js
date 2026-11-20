import { apiUrl, siteBaseUrl } from './config.js';

export async function fetchJson(path, options = {}) {
  const url = apiUrl(path);
  const res = await fetch(url, { cache: options.cache ?? 'no-store', signal: options.signal });
  if (!res.ok) {
    const err = new Error(`${res.status} ${res.statusText} — ${url}`);
    err.status = res.status;
    err.url = url;
    throw err;
  }
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch (e) {
    const err = new Error(`JSON inválido em ${url}: ${e?.message || e}`);
    err.url = url;
    throw err;
  }
}

export async function loadLegacy() {
  // Dados legados/controlados (manifests estáticos), quando presentes no repositório.
  // Não são fonte de verdade do runtime atual; falhas são silenciosas e não bloqueiam o dashboard.
  const names = ['index', 'system_status', 'models', 'frames', 'templates', 'packages', 'commands', 'repack', 'adapters', 'prompt', 'content'];
  const paths = {
    index: 'archive/Legacy/03_API/v1/index.json',
    system_status: 'archive/Legacy/03_API/v1/system/status.json',
    models: 'archive/Legacy/03_API/v1/models/index.json',
    frames: 'archive/Legacy/03_API/v1/frames/index.json',
    templates: 'archive/Legacy/03_API/v1/frames/templates.json',
    packages: 'archive/Legacy/03_API/v1/packages/index.json',
    commands: 'archive/Legacy/03_API/v1/commands/index.json',
    repack: 'archive/Legacy/03_API/v1/repack/index.json',
    adapters: 'archive/Legacy/03_API/v1/adapters/index.json',
    prompt: 'archive/Legacy/03_API/v1/prompts/integration.json',
    content: 'archive/Legacy/03_API/v1/content/index.json',
  };

  const out = {};
  await Promise.all(names.map(async (n) => {
    out[n] = null;
    const rel = paths[n];
    if (!rel) return;
    try {
      out[n] = await fetchJson(rel);
    } catch {
      out[n] = null;
    }
  }));

  if (out.system_status) out.status = out.system_status;
  out.discovery = out.index;
  out.siteBase = siteBaseUrl();
  return out;
}

export async function bootCore() {
  try {
    const mod = await import('../../src/app.js');
    const createApp = mod.createApp || mod.default;
    if (typeof createApp !== 'function') throw new Error('createApp não encontrado em src/app.js');
    const app = await createApp();
    return app;
  } catch (e) {
    console.error('Falha ao inicializar FGUA core', e);
    return { error: e, ok: false, state: 'error' };
  }
}

export function getSiteBase() {
  return siteBaseUrl();
}
