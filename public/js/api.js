import { apiUrl, CONFIG } from './config.js';

export async function fetchJson(path) {
  const url = apiUrl(path);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.json();
}

export async function loadAll() {
  const [discovery, status, models, frames, templates, packages, commands, repack, adapters, prompt, content] = await Promise.all([
    fetchJson('03_API/v1/index.json'),
    fetchJson('03_API/v1/system/status.json'),
    fetchJson('03_API/v1/models/index.json'),
    fetchJson('03_API/v1/frames/index.json'),
    fetchJson('03_API/v1/frames/templates.json'),
    fetchJson('03_API/v1/packages/index.json'),
    fetchJson('03_API/v1/commands/index.json'),
    fetchJson('03_API/v1/repack/index.json'),
    fetchJson('03_API/v1/adapters/index.json'),
    fetchJson('03_API/v1/prompts/integration.json'),
    fetchJson('03_API/v1/content/index.json').catch(() => null)
  ]);
  return { discovery, status, models, frames, templates, packages, commands, repack, adapters, prompt, content, config: CONFIG };
}
