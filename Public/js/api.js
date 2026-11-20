import { apiUrl, CONFIG } from './config.js';

export async function fetchJson(path) {
  const url = apiUrl(path);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.json();
}

export async function loadLegacy() {
  // Dados legados/controlados (manifests estáticos), quando presentes
  const names = ['index','system_status','models','frames','templates','packages','commands','repack','adapters','prompt','content'];
  const candidates = (p) => [`../archive/Legacy/${p}`, `Legacy/${p}`, p];
  const paths = {
    index: '03_API/v1/index.json',
    system_status: '03_API/v1/system/status.json',
    models: '03_API/v1/models/index.json',
    frames: '03_API/v1/frames/index.json',
    templates: '03_API/v1/frames/templates.json',
    packages: '03_API/v1/packages/index.json',
    commands: '03_API/v1/commands/index.json',
    repack: '03_API/v1/repack/index.json',
    adapters: '03_API/v1/adapters/index.json',
    prompt: '03_API/v1/prompts/integration.json',
    content: '03_API/v1/content/index.json'
  };
  const out = {};
  await Promise.all(names.map(async (n) => {
    out[n] = null;
    for (const p of candidates(paths[n])) {
      try { out[n] = await fetchJson(p); break; } catch {}
    }
  }));
  // normaliza chaves esperadas por partes antigas
  if (out.system_status) out.status = out.system_status;
  out.discovery = out.index;
  out.config = CONFIG;
  return out;
}

export async function bootCore() {
  try {
    const mod = await import('../../src/app.js');
    const createApp = mod.createApp || mod.default;
    const app = await createApp();
    return app;
  } catch (e) {
    console.error('Falha ao inicializar FGUA core', e);
    return { error: e };
  }
}
