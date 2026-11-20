import { apiUrl, CONFIG } from './config.js';

export async function fetchJson(path) {
  const url = apiUrl(path);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.json();
}

export async function loadAll() {
  const [discovery, status, models, frames, templates, packages, commands, repack, adapters, prompt, content] = await Promise.all([
    fetchJson('api/v1/index.json'),
    fetchJson('api/v1/system/status.json'),
    fetchJson('api/v1/models/index.json'),
    fetchJson('api/v1/frames/index.json'),
    fetchJson('api/v1/frames/templates.json'),
    fetchJson('api/v1/packages/index.json'),
    fetchJson('api/v1/commands/index.json'),
    fetchJson('api/v1/repack/index.json'),
    fetchJson('api/v1/adapters/index.json'),
    fetchJson('api/v1/prompts/integration.json'),
    fetchJson('api/v1/content/index.json').catch(() => null)
  ]);
  return { discovery, status, models, frames, templates, packages, commands, repack, adapters, prompt, content, config: CONFIG };
}
